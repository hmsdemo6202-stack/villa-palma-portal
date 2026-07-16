'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createStaffUser, deleteStaffUser, updateStaffUser } from '@/app/actions/users'

type Department = { id: string; name: string }

type StaffUser = {
  id: string
  username: string
  full_name: string | null
  phone: string | null
  role: string
  is_active: boolean
  department_id: string | null
  created_at: string
  departments: { name: string } | null
}

type CreateForm = {
  username: string
  password: string
  fullName: string
  phone: string
  role: string
  departmentId: string
}

type EditForm = {
  fullName: string
  phone: string
  role: string
  departmentId: string
  isActive: boolean
}

const emptyCreate: CreateForm = {
  username: '', password: '', fullName: '', phone: '', role: 'front_desk', departmentId: '',
}

const ROLES = [
  { value: 'admin',        label: 'Administrator' },
  { value: 'manager',      label: 'Manager' },
  { value: 'front_desk',   label: 'Front Desk' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'restaurant',   label: 'Restaurant' },
  { value: 'accounting',   label: 'Accounting' },
  { value: 'maintenance',  label: 'Maintenance' },
]

const ROLE_COLORS: Record<string, string> = {
  admin:        'bg-red-100 text-red-700',
  manager:      'bg-purple-100 text-purple-700',
  front_desk:   'bg-blue-100 text-blue-700',
  housekeeping: 'bg-green-100 text-green-700',
  restaurant:   'bg-orange-100 text-orange-700',
  accounting:   'bg-yellow-100 text-yellow-700',
  maintenance:  'bg-gray-100 text-gray-600',
}

export default function AdminUsersPage() {
  const supabase = createClient()
  const [users, setUsers]               = useState<StaffUser[]>([])
  const [departments, setDepartments]   = useState<Department[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)

  const [showCreate, setShowCreate]     = useState(false)
  const [editId, setEditId]             = useState<string | null>(null)
  const [createForm, setCreateForm]     = useState<CreateForm>(emptyCreate)
  const [editForm, setEditForm]         = useState<EditForm | null>(null)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [success, setSuccess]           = useState<string | null>(null)

  const [roleFilter, setRoleFilter]     = useState<string>('all')
  const [search, setSearch]             = useState('')

  const load = useCallback(async () => {
    const [{ data: { user } }, { data: staff }, { data: depts }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('users')
        .select('id, username, full_name, phone, role, is_active, department_id, created_at, departments(name)')
        .order('created_at', { ascending: false }),
      supabase.from('departments').select('id, name').order('name'),
    ])
    setCurrentUserId(user?.id ?? null)
    setUsers((staff as unknown as StaffUser[]) ?? [])
    setDepartments(depts ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else    { setError(msg);   setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  function openEdit(u: StaffUser) {
    setEditId(u.id)
    setEditForm({
      fullName:     u.full_name    ?? '',
      phone:        u.phone        ?? '',
      role:         u.role,
      departmentId: u.department_id ?? '',
      isActive:     u.is_active,
    })
  }

  function cancelEdit() {
    setEditId(null)
    setEditForm(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.username.trim()) { flash('Username is required.', false); return }
    if (createForm.username.includes('@')) { flash('Username must not include @. Enter only the name part (e.g. juan.reyes).', false); return }
    if (createForm.password.length < 6) { flash('Password must be at least 6 characters.', false); return }
    setSaving(true)
    const result = await createStaffUser({
      username:     createForm.username.trim().toLowerCase(),
      password:     createForm.password,
      fullName:     createForm.fullName.trim(),
      role:         createForm.role,
      phone:        createForm.phone.trim() || undefined,
      departmentId: createForm.departmentId || undefined,
    })
    setSaving(false)
    if (result.error) { flash(result.error, false); return }
    flash('User created.')
    setShowCreate(false)
    setCreateForm(emptyCreate)
    load()
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId || !editForm) return
    setSaving(true)
    const result = await updateStaffUser(editId, {
      fullName:     editForm.fullName     || undefined,
      phone:        editForm.phone        || undefined,
      role:         editForm.role,
      departmentId: editForm.departmentId || undefined,
      isActive:     editForm.isActive,
    })
    setSaving(false)
    if (result.error) { flash(result.error, false); return }
    flash('User updated.')
    cancelEdit()
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return
    const result = await deleteStaffUser(id)
    if (result.error) { flash(result.error, false); return }
    flash('User deleted.')
    load()
  }

  const visible = users
    .filter(u => roleFilter === 'all' || u.role === roleFilter)
    .filter(u => !search || (u.username + ' ' + (u.full_name ?? '')).toLowerCase().includes(search.toLowerCase()))

  const counts = Object.fromEntries(ROLES.map(r => [r.value, 0]))
  users.forEach(u => { counts[u.role] = (counts[u.role] ?? 0) + 1 })

  if (loading) return <div className="text-gray-400">Loading…</div>

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Staff Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} total · {users.filter(u => u.is_active).length} active</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditId(null) }}
          className="bg-terra text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark transition-colors"
        >
          + Add User
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {/* ── Create form ── */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-warm-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-brown">New Staff User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
              <input required value={createForm.username}
                onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                placeholder="e.g. juan.reyes"
                autoComplete="off"
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              <p className="text-[10px] text-gray-400 mt-1">Login email: {createForm.username || 'username'}@cabalum.internal — no @ symbol in this field</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
              <input required type="password" minLength={6} value={createForm.password}
                onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 6 characters"
                autoComplete="new-password"
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input required value={createForm.fullName}
                onChange={e => setCreateForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="Juan Reyes"
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={createForm.phone}
                onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+63 9XX XXX XXXX"
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
              <select value={createForm.role}
                onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select value={createForm.departmentId}
                onChange={e => setCreateForm(f => ({ ...f, departmentId: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="bg-terra text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
              {saving ? 'Creating…' : 'Create User'}
            </button>
            <button type="button" onClick={() => { setShowCreate(false); setCreateForm(emptyCreate) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by username or name…"
          className="border border-warm-border rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-terra" />
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setRoleFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${roleFilter === 'all' ? 'bg-terra text-white border-terra' : 'hover:border-terra text-brown-mid border-warm-border'}`}>
            All ({users.length})
          </button>
          {ROLES.map(r => (
            <button key={r.value} onClick={() => setRoleFilter(r.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${roleFilter === r.value ? 'bg-terra text-white border-terra' : 'hover:border-terra text-brown-mid border-warm-border'}`}>
              {r.label} {counts[r.value] > 0 ? `(${counts[r.value]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-xl border border-warm-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              {['Username', 'Full Name', 'Role', 'Department', 'Phone', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">No users match the filter.</td>
              </tr>
            )}
            {visible.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                {editId === u.id && editForm ? (
                  // Inline edit row
                  <td colSpan={8} className="px-4 py-3">
                    <form onSubmit={handleEdit} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Full Name</label>
                        <input value={editForm.fullName}
                          onChange={e => setEditForm(f => f ? { ...f, fullName: e.target.value } : f)}
                          className="w-full border border-warm-border rounded px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Phone</label>
                        <input value={editForm.phone}
                          onChange={e => setEditForm(f => f ? { ...f, phone: e.target.value } : f)}
                          className="w-full border border-warm-border rounded px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Role</label>
                        <select value={editForm.role}
                          onChange={e => setEditForm(f => f ? { ...f, role: e.target.value } : f)}
                          className="w-full border border-warm-border rounded px-2 py-1 text-sm">
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Department</label>
                        <select value={editForm.departmentId}
                          onChange={e => setEditForm(f => f ? { ...f, departmentId: e.target.value } : f)}
                          className="w-full border border-warm-border rounded px-2 py-1 text-sm">
                          <option value="">— None —</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={editForm.isActive}
                            onChange={e => setEditForm(f => f ? { ...f, isActive: e.target.checked } : f)} />
                          Active
                        </label>
                      </div>
                      <div className="flex items-end gap-2">
                        <button type="submit" disabled={saving}
                          className="bg-terra text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50">
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" onClick={cancelEdit}
                          className="border border-warm-border px-3 py-1.5 rounded text-xs hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono text-sm font-medium text-brown">
                      {u.username}
                      {u.id === currentUserId && (
                        <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-sans font-medium">You</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.full_name ?? <span className="text-gray-300 italic">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize whitespace-nowrap ${ROLE_COLORS[u.role] ?? 'bg-gray-100'}`}>
                        {ROLES.find(r => r.value === u.role)?.label ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.departments?.name ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.phone ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(u)}
                          className="text-xs border border-gray-300 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                          Edit
                        </button>
                        {u.id !== currentUserId && (
                          <button onClick={() => handleDelete(u.id, u.username)}
                            className="text-xs border border-red-200 text-red-500 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        Staff login uses <code className="bg-gray-100 px-1 py-0.5 rounded">username@cabalum.internal</code> internally.
        Your own account cannot be deleted from this page.
      </p>
    </div>
  )
}
