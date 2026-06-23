'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Guest = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  address: string | null
  id_type: string | null
  id_number: string | null
  nationality: string | null
  notes: string | null
  created_at: string
}

type GuestForm = {
  full_name: string
  email: string
  phone: string
  address: string
  id_type: string
  id_number: string
  nationality: string
  notes: string
}

const emptyForm: GuestForm = {
  full_name: '', email: '', phone: '', address: '',
  id_type: '', id_number: '', nationality: '', notes: ''
}

const ID_TYPES = ['Passport', "Driver's License", 'PhilSys / National ID', 'SSS ID', 'UMID', 'Voter\'s ID', 'Other']

export default function AdminGuestsPage() {
  const supabase = createClient()
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<GuestForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [viewGuest, setViewGuest] = useState<Guest | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('guests')
      .select('*')
      .order('created_at', { ascending: false })
    setGuests((data as Guest[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  function openAdd() {
    setForm(emptyForm); setEditId(null); setShowForm(true); setViewGuest(null)
  }

  function openEdit(g: Guest) {
    setForm({
      full_name: g.full_name, email: g.email ?? '', phone: g.phone ?? '',
      address: g.address ?? '', id_type: g.id_type ?? '', id_number: g.id_number ?? '',
      nationality: g.nationality ?? '', notes: g.notes ?? ''
    })
    setEditId(g.id); setShowForm(true); setViewGuest(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      full_name:   form.full_name,
      email:       form.email       || null,
      phone:       form.phone       || null,
      address:     form.address     || null,
      id_type:     form.id_type     || null,
      id_number:   form.id_number   || null,
      nationality: form.nationality || null,
      notes:       form.notes       || null,
    }
    const { error: err } = editId
      ? await supabase.from('guests').update(payload).eq('id', editId)
      : await supabase.from('guests').insert(payload)
    if (err) { flash(err.message, false); setSaving(false); return }
    flash(editId ? 'Guest record updated.' : 'Guest registered.')
    setSaving(false); setShowForm(false); setEditId(null); setForm(emptyForm)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete guest record for "${name}"? This cannot be undone.`)) return
    const { error: err } = await supabase.from('guests').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Guest record deleted.')
    if (viewGuest?.id === id) setViewGuest(null)
    load()
  }

  const visible = guests.filter(g =>
    !search || g.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (g.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (g.phone ?? '').includes(search)
  )

  if (loading) return <div className="text-gray-400">Loading guests…</div>

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Guests</h1>
          <p className="text-sm text-gray-500 mt-0.5">{guests.length} registered guests</p>
        </div>
        <button onClick={openAdd}
          className="bg-terra text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark transition-colors">
          + Register Guest
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {/* ── Register / Edit Form ── */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-warm-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-brown">{editId ? 'Edit Guest Record' : 'Register New Guest'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="Juan Dela Cruz" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nationality</label>
              <input value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="Filipino" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="guest@email.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="+63 9XX XXX XXXX" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ID Type</label>
              <select value={form.id_type} onChange={e => setForm(f => ({ ...f, id_type: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="">— Select —</option>
                {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ID Number</label>
              <input value={form.id_number} onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="e.g. P12345678A" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="Street, City, Province" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="Special requests, preferences, VIP status…" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-terra text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Register Guest'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {/* ── Guest Profile View ── */}
      {viewGuest && (
        <div className="bg-white border border-warm-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-brown">{viewGuest.full_name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Registered {new Date(viewGuest.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <button onClick={() => setViewGuest(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              ['Email', viewGuest.email], ['Phone', viewGuest.phone],
              ['Nationality', viewGuest.nationality], ['ID Type', viewGuest.id_type],
              ['ID Number', viewGuest.id_number], ['Address', viewGuest.address],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-brown font-medium">{val || <span className="text-gray-300 font-normal">—</span>}</p>
              </div>
            ))}
          </div>
          {viewGuest.notes && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <span className="font-semibold">Notes: </span>{viewGuest.notes}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => { openEdit(viewGuest); setViewGuest(null) }}
              className="text-sm border text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50">Edit</button>
            <button onClick={() => handleDelete(viewGuest.id, viewGuest.full_name)}
              className="text-sm border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50">Delete</button>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, email, or phone…"
        className="border border-warm-border rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-terra" />

      {/* ── Guest Table ── */}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {visible.length === 0 && <p className="text-center text-gray-400 py-8">{search ? 'No guests match that search.' : 'No guests registered yet.'}</p>}
        {visible.map(g => (
          <div key={g.id} className="bg-white border border-warm-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <button onClick={() => setViewGuest(viewGuest?.id === g.id ? null : g)}
                  className="font-semibold text-brown hover:text-terra transition-colors text-left">
                  {g.full_name}
                </button>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(g.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              {g.nationality && <span className="text-xs text-gray-500 shrink-0 ml-2">{g.nationality}</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-gray-400">Email</span>
              <span className="text-brown truncate">{g.email ?? '—'}</span>
              <span className="text-gray-400">Phone</span>
              <span className="text-brown">{g.phone ?? '—'}</span>
              <span className="text-gray-400">ID</span>
              <span className="text-brown">{g.id_type ? `${g.id_type}${g.id_number ? ' · ' + g.id_number : ''}` : '—'}</span>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button onClick={() => openEdit(g)} className="flex-1 text-xs border text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50">Edit</button>
              <button onClick={() => handleDelete(g.id, g.full_name)} className="flex-1 text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-warm-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>{['Name', 'Nationality', 'Email', 'Phone', 'ID', 'Registered', 'Actions'].map(h =>
              <th key={h} className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                {search ? 'No guests match that search.' : 'No guests registered yet.'}
              </td></tr>
            )}
            {visible.map(g => (
              <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-brown">
                  <button onClick={() => setViewGuest(viewGuest?.id === g.id ? null : g)}
                    className="hover:text-terra transition-colors text-left">
                    {g.full_name}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-500">{g.nationality ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{g.email ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{g.phone ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {g.id_type ? `${g.id_type}${g.id_number ? ' · ' + g.id_number : ''}` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(g.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(g)} className="text-xs border text-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                    <button onClick={() => handleDelete(g.id, g.full_name)} className="text-xs border border-red-200 text-red-500 px-2.5 py-1 rounded-lg hover:bg-red-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
