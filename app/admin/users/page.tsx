'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Department = { id: string; name: string }

type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  role: 'admin' | 'staff' | 'guest'
  department_id: string | null
  created_at: string
  departments: { name: string } | null
}

type UserForm = {
  full_name: string
  email: string
  password: string
  phone: string
  role: 'admin' | 'staff' | 'guest'
  department_id: string
}

const emptyForm: UserForm = {
  full_name: '', email: '', password: '', phone: '', role: 'staff', department_id: ''
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  staff: 'bg-blue-100 text-blue-700',
  guest: 'bg-gray-100 text-gray-600',
}

export default function AdminUsersPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff' | 'guest'>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const [{ data: { user } }, { data: profs }, { data: depts }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('profiles')
        .select('id, full_name, phone, role, department_id, created_at, departments(name)')
        .order('created_at', { ascending: false }),
      supabase.from('departments').select('id, name').order('name'),
    ])
    setCurrentUserId(user?.id ?? null)
    setProfiles((profs as unknown as Profile[]) ?? [])
    setDepartments(depts ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  function openAdd() {
    setForm(emptyForm)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(p: Profile) {
    setForm({
      full_name: p.full_name ?? '',
      email: '',
      password: '',
      phone: p.phone ?? '',
      role: p.role,
      department_id: p.department_id ?? '',
    })
    setEditId(p.id)
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm)
    setError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (editId) {
      // Update existing profile (name, phone, role, department)
      const { error: err } = await supabase.from('profiles').update({
        full_name:     form.full_name || null,
        phone:         form.phone || null,
        role:          form.role,
        department_id: form.department_id || null,
      }).eq('id', editId)

      if (err) { flash(err.message, false); setSaving(false); return }
      flash('User updated.')
    } else {
      // Create new user via Supabase Auth Admin API (server action needed)
      // Fallback: use sign-up with metadata and immediately update profile
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            role:      form.role,
          },
          emailRedirectTo: undefined,
        },
      })

      if (signUpErr) { flash(signUpErr.message, false); setSaving(false); return }

      const newId = signUpData.user?.id
      if (newId) {
        await supabase.from('profiles').update({
          full_name:     form.full_name || null,
          phone:         form.phone || null,
          role:          form.role,
          department_id: form.department_id || null,
        }).eq('id', newId)

        if (form.role === 'guest') {
          await supabase.from('guests').insert({
            profile_id: newId,
            full_name:  form.full_name || null,
            email:      form.email,
            phone:      form.phone || null,
          })
        }
      }
      flash('User created. They can now sign in.')
    }

    setSaving(false)
    cancel()
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return
    // Delete profile row — auth.users row persists (admin must delete via Supabase dashboard for full removal)
    const { error: err } = await supabase.from('profiles').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('User removed from portal.')
    load()
  }

  const visible = profiles
    .filter(p => roleFilter === 'all' || p.role === roleFilter)
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return (p.full_name ?? '').toLowerCase().includes(q)
    })

  const counts = { admin: 0, staff: 0, guest: 0 }
  profiles.forEach(p => { counts[p.role] = (counts[p.role] ?? 0) + 1 })

  if (loading) return <div className="text-gray-400">Loading users…</div>

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {profiles.length} total · {counts.admin} admin · {counts.staff} staff · {counts.guest} guest
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-terra text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark transition-colors"
        >
          + Add User
        </button>
      </div>

      {/* ── Alerts ── */}
      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {/* ── Add / Edit Form ── */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-warm-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-brown">{editId ? 'Edit User' : 'Add New User'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input required value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="Juan Dela Cruz" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="+63 9XX XXX XXXX" />
            </div>
            {!editId && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                  <input required type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                    placeholder="staff@cabalumhotel.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                  <input required type="password" minLength={6} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                    placeholder="Min 6 characters" />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
              <select value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as UserForm['role'] }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="guest">Guest</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select value={form.department_id}
                onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="">— None —</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="bg-terra text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create User'}
            </button>
            <button type="button" onClick={cancel}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="border border-warm-border rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-terra" />
        <div className="flex gap-1">
          {(['all', 'admin', 'staff', 'guest'] as const).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                roleFilter === r
                  ? 'bg-terra text-white border-terra'
                  : 'hover:border-terra text-brown-mid border-warm-border'
              }`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {visible.length === 0 && <p className="text-center text-gray-400 py-8">{search || roleFilter !== 'all' ? 'No users match the filter.' : 'No users yet.'}</p>}
        {visible.map(p => (
          <div key={p.id} className="bg-white border border-warm-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-brown">
                  {p.full_name ?? <span className="text-gray-400 italic font-normal">No name</span>}
                  {p.id === currentUserId && (
                    <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">You</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize shrink-0 ml-2 ${ROLE_COLORS[p.role] ?? 'bg-gray-100'}`}>
                {p.role}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-gray-400">Department</span>
              <span className="text-brown">{p.departments?.name ?? '—'}</span>
              <span className="text-gray-400">Phone</span>
              <span className="text-brown">{p.phone ?? '—'}</span>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button onClick={() => openEdit(p)} className="flex-1 text-xs border border-gray-300 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">Edit</button>
              {p.id !== currentUserId && (
                <button onClick={() => handleDelete(p.id, p.full_name ?? 'this user')} className="flex-1 text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-warm-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              {['Name', 'Role', 'Department', 'Phone', 'Joined', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  {search || roleFilter !== 'all' ? 'No users match the filter.' : 'No users yet.'}
                </td>
              </tr>
            )}
            {visible.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-brown">
                  {p.full_name ?? <span className="text-gray-400 italic">No name</span>}
                  {p.id === currentUserId && (
                    <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">You</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${ROLE_COLORS[p.role] ?? 'bg-gray-100'}`}>
                    {p.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {p.departments?.name ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {p.phone ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)}
                      className="text-xs border border-gray-300 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                      Edit
                    </button>
                    {p.id !== currentUserId && (
                      <button onClick={() => handleDelete(p.id, p.full_name ?? 'this user')}
                        className="text-xs border border-red-200 text-red-500 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors">
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        Your own account cannot be deleted from this page. To fully remove an auth user, also delete them via Supabase Dashboard → Authentication → Users.
      </p>
    </div>
  )
}
