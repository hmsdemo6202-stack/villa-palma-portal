'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import CheckoutModal from '@/components/CheckoutModal'

type Guest  = { id: string; full_name: string }
type Room   = { id: string; room_number: string; room_types: { name: string; base_price: number } | null }

type Reservation = {
  id: string
  guest_id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  nights: number
  total_amount: number | null
  status: 'inquiry' | 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
  notes: string | null
  created_at: string
  guests: { full_name: string } | null
  rooms:  { room_number: string; room_types: { name: string } | null } | null
}

type ResForm = {
  guest_id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  total_amount: string
  status: Reservation['status']
  notes: string
}

const STATUS_COLORS: Record<string, string> = {
  inquiry:     'bg-violet-100 text-violet-700',
  pending:     'bg-yellow-100 text-yellow-700',
  confirmed:   'bg-blue-100 text-blue-700',
  checked_in:  'bg-green-100 text-green-700',
  checked_out: 'bg-gray-100 text-gray-600',
  cancelled:   'bg-red-100 text-red-600',
  no_show:     'bg-orange-100 text-orange-700',
}

function todayStr() { return new Date().toISOString().split('T')[0] }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] }

function emptyForm(): ResForm {
  return { guest_id: '', room_id: '', check_in_date: todayStr(), check_out_date: tomorrowStr(), total_amount: '', status: 'confirmed', notes: '' }
}

export default function AdminReservationsPage() {
  const supabase = createClient()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [guests, setGuests]   = useState<Guest[]>([])
  const [rooms, setRooms]     = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState<ResForm>(emptyForm())
  const [saving, setSaving]     = useState(false)

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [error, setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [checkoutTarget, setCheckoutTarget] = useState<Reservation | null>(null)

  const load = useCallback(async () => {
    const [{ data: res }, { data: gs }, { data: rs }] = await Promise.all([
      supabase.from('reservations')
        .select('*, guests(full_name), rooms(room_number, room_types(name))')
        .order('check_in_date', { ascending: false })
        .limit(100),
      supabase.from('guests').select('id, full_name').order('full_name'),
      supabase.from('rooms').select('id, room_number, room_types(name, base_price)').order('room_number'),
    ])
    setReservations((res as Reservation[]) ?? [])
    setGuests(gs ?? [])
    setRooms((rs as unknown as Room[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  function updateForm(patch: Partial<ResForm>) {
    setForm(prev => {
      const next = { ...prev, ...patch }
      const room = rooms.find(r => r.id === next.room_id)
      if (room?.room_types && next.check_in_date && next.check_out_date) {
        const nights = Math.max(0, (new Date(next.check_out_date).getTime() - new Date(next.check_in_date).getTime()) / 86400000)
        next.total_amount = (nights * room.room_types.base_price).toFixed(2)
      }
      return next
    })
  }

  function openAdd() { setForm(emptyForm()); setEditId(null); setShowForm(true) }

  function openEdit(r: Reservation) {
    setForm({
      guest_id: r.guest_id, room_id: r.room_id,
      check_in_date: r.check_in_date, check_out_date: r.check_out_date,
      total_amount: r.total_amount != null ? String(r.total_amount) : '',
      status: r.status, notes: r.notes ?? ''
    })
    setEditId(r.id); setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      guest_id:       form.guest_id,
      room_id:        form.room_id,
      check_in_date:  form.check_in_date,
      check_out_date: form.check_out_date,
      total_amount:   form.total_amount ? Number(form.total_amount) : null,
      status:         form.status,
      notes:          form.notes || null,
      created_by:     user?.id ?? null,
    }
    const { error: err } = editId
      ? await supabase.from('reservations').update(payload).eq('id', editId)
      : await supabase.from('reservations').insert(payload)
    if (err) { flash(err.message, false); setSaving(false); return }
    flash(editId ? 'Reservation updated.' : 'Reservation created.')
    setSaving(false); setShowForm(false); setEditId(null); setForm(emptyForm())
    load()
  }

  async function changeStatus(id: string, status: Reservation['status']) {
    const res = reservations.find(r => r.id === id)
    const { error: err } = await supabase.from('reservations').update({ status }).eq('id', id)
    if (err) { flash(err.message, false); return }
    // Sync room physical status when reservation status changes
    if (res?.room_id) {
      if (status === 'checked_in') {
        await supabase.from('rooms').update({ status: 'occupied' }).eq('id', res.room_id)
      } else if (status === 'checked_out') {
        await supabase.from('rooms').update({ status: 'dirty' }).eq('id', res.room_id)
      } else if (status === 'cancelled' || status === 'no_show') {
        await supabase.from('rooms').update({ status: 'available' }).eq('id', res.room_id)
      }
    }
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this reservation?')) return
    const { error: err } = await supabase.from('reservations').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Reservation deleted.')
    load()
  }

  const visible = reservations.filter(r => statusFilter === 'all' || r.status === statusFilter)

  if (loading) return <div className="text-gray-400">Loading reservations…</div>

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Reservations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{reservations.length} total</p>
        </div>
        <button onClick={openAdd}
          className="bg-terra text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark transition-colors">
          + New Reservation
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-warm-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-brown">{editId ? 'Edit Reservation' : 'New Reservation'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Guest *</label>
              <select required value={form.guest_id} onChange={e => updateForm({ guest_id: e.target.value })}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="">— Select Guest —</option>
                {guests.map(g => <option key={g.id} value={g.id}>{g.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Room *</label>
              <select required value={form.room_id} onChange={e => updateForm({ room_id: e.target.value })}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="">— Select Room —</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.room_number}{r.room_types ? ` — ${r.room_types.name} (₱${Number(r.room_types.base_price).toLocaleString('en-PH')}/night)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-in *</label>
              <input required type="date" value={form.check_in_date}
                onChange={e => updateForm({ check_in_date: e.target.value })}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-out *</label>
              <input required type="date" value={form.check_out_date} min={form.check_in_date}
                onChange={e => updateForm({ check_out_date: e.target.value })}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Total Amount (₱)</label>
              <input type="number" min={0} step="0.01" value={form.total_amount}
                onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="Auto-calculated from room rate" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Reservation['status'] }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="inquiry">Inquiry</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="Special requests, early check-in, etc." />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-terra text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Reservation'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex gap-1 flex-wrap">
        {(['all','inquiry','pending','confirmed','checked_in','checked_out','cancelled','no_show'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
              statusFilter === s ? 'bg-terra text-white border-terra' : 'text-brown-mid border-warm-border hover:border-terra'}`}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-warm-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>{['Guest', 'Room', 'Check-in', 'Check-out', 'Nights', 'Total', 'Status', 'Actions'].map(h =>
              <th key={h} className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {visible.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No reservations found.</td></tr>}
            {visible.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-brown">{r.guests?.full_name ?? '—'}</td>
                <td className="px-4 py-3">{r.rooms?.room_number ?? '—'} <span className="text-gray-400 text-xs">{r.rooms?.room_types?.name}</span></td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {new Date(r.check_in_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {new Date(r.check_out_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-gray-500">{r.nights}</td>
                <td className="px-4 py-3 font-semibold">{r.total_amount != null ? '₱' + Number(r.total_amount).toLocaleString('en-PH') : '—'}</td>
                <td className="px-4 py-3">
                  <select value={r.status} onChange={e => changeStatus(r.id, e.target.value as Reservation['status'])}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[r.status]}`}>
                    <option value="inquiry">Inquiry</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked_in">Checked In</option>
                    <option value="checked_out">Checked Out</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No Show</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {r.status === 'checked_in' && (
                      <button onClick={() => setCheckoutTarget(r)} className="text-xs border border-terra text-terra px-2.5 py-1 rounded-lg hover:bg-terra-light/20">Checkout</button>
                    )}
                    <button onClick={() => openEdit(r)} className="text-xs border text-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                    <button onClick={() => handleDelete(r.id)} className="text-xs border border-red-200 text-red-500 px-2.5 py-1 rounded-lg hover:bg-red-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {checkoutTarget && (
        <CheckoutModal
          reservation={checkoutTarget}
          onClose={() => setCheckoutTarget(null)}
          onComplete={load}
        />
      )}
    </div>
  )
}
