'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Reservation = {
  id: string
  guest_id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  nights: number
  total_amount: number | null
  status: string
  notes: string | null
  guests: { full_name: string; phone: string | null; nationality: string | null } | null
  rooms: { room_number: string; floor: number | null; bed_type: string | null; room_types: { name: string; base_price: number } | null } | null
}

type CheckInForm = {
  key_card_number: string
  vehicle_plate: string
  companion_names: string
  id_verified: boolean
  deposit_amount: string
  actual_check_in: string
  special_requests: string
}

function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function emptyForm(): CheckInForm {
  return {
    key_card_number: '', vehicle_plate: '', companion_names: '',
    id_verified: false, deposit_amount: '', actual_check_in: nowLocal(), special_requests: '',
  }
}

function currency(n: number) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CheckInPage() {
  const supabase = createClient()
  const [arrivals, setArrivals] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [form, setForm] = useState<CheckInForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tab, setTab] = useState<'today' | 'all'>('today')

  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reservations')
      .select('id, guest_id, room_id, check_in_date, check_out_date, nights, total_amount, status, notes, guests(full_name, phone, nationality), rooms(room_number, floor, bed_type, room_types(name, base_price))')
      .in('status', ['pending', 'confirmed'])
      .order('check_in_date')
    setArrivals((data as unknown as Reservation[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 5000)
  }

  function select(res: Reservation) {
    setActiveId(res.id)
    setForm({ ...emptyForm(), special_requests: res.notes ?? '' })
    setError(null)
  }

  async function handleCheckIn() {
    const res = arrivals.find(r => r.id === activeId)
    if (!res) return
    setSaving(true)
    setError(null)

    const companions = form.companion_names.split(',').map(s => s.trim()).filter(Boolean)

    const { error: resErr } = await supabase.from('reservations').update({
      status:           'checked_in',
      actual_check_in:  new Date(form.actual_check_in).toISOString(),
      key_card_number:  form.key_card_number.trim() || null,
      vehicle_plate:    form.vehicle_plate.trim()   || null,
      companion_names:  companions.length > 0 ? companions : null,
      id_verified:      form.id_verified,
      deposit_amount:   form.deposit_amount ? Number(form.deposit_amount) : 0,
      special_requests: form.special_requests.trim() || null,
    }).eq('id', activeId!)

    if (resErr) { flash(resErr.message, false); setSaving(false); return }

    const { error: roomErr } = await supabase.from('rooms').update({ status: 'occupied' }).eq('id', res.room_id)
    if (roomErr) { flash('Checked in, but could not update room status: ' + roomErr.message, false); setSaving(false); return }

    flash(`${res.guests?.full_name ?? 'Guest'} checked in to Room ${res.rooms?.room_number}.`)
    setSaving(false)
    setActiveId(null)
    setForm(emptyForm())
    load()
  }

  const todayArrivals = arrivals.filter(r => r.check_in_date === today)
  const visible = tab === 'today' ? todayArrivals : arrivals

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-brown">Check-In Station</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          {todayArrivals.length > 0 && ` · ${todayArrivals.length} arriving today`}
        </p>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">✓ {success}</div>}

      <div className="flex gap-2">
        {([['today', `Today (${todayArrivals.length})`], ['all', `All Pending (${arrivals.length})`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setActiveId(null) }}
            className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${
              tab === key ? 'bg-terra text-white border-terra' : 'border-warm-border text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading arrivals…</p>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🔑</p>
          <p className="font-medium">{tab === 'today' ? 'No arrivals scheduled for today.' : 'No pending reservations.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(res => {
            const isActive = res.id === activeId
            const isOverdue = res.check_in_date < today
            return (
              <div key={res.id} className={`rounded-xl border transition-colors bg-white ${isActive ? 'border-terra' : 'border-warm-border'}`}>
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-brown">{res.guests?.full_name ?? '—'}</span>
                      {res.guests?.nationality && <span className="text-xs text-gray-400">{res.guests.nationality}</span>}
                      {isOverdue && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Overdue</span>}
                      {res.status === 'confirmed' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Confirmed</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Room {res.rooms?.room_number} · {res.rooms?.room_types?.name ?? '—'}</span>
                      {res.rooms?.bed_type && <span>{res.rooms.bed_type}</span>}
                      {res.rooms?.floor && <span>Floor {res.rooms.floor}</span>}
                      <span>
                        {new Date(res.check_in_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        {' → '}
                        {new Date(res.check_out_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        {' · '}{res.nights} night{res.nights !== 1 ? 's' : ''}
                      </span>
                      {res.total_amount != null && <span className="font-medium text-brown">{currency(res.total_amount)}</span>}
                    </div>
                  </div>
                  {isActive ? (
                    <button onClick={() => setActiveId(null)} className="text-xs border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50 shrink-0">Cancel</button>
                  ) : (
                    <button onClick={() => select(res)}
                      className="text-sm bg-terra text-white px-4 py-2 rounded-lg font-medium hover:bg-terra-dark transition-colors shrink-0">
                      Check In
                    </button>
                  )}
                </div>

                {isActive && (
                  <div className="border-t border-warm-border px-4 pb-4 pt-4 space-y-4">
                    <h3 className="text-sm font-semibold text-brown">Check-In Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Key Card Number</label>
                        <input value={form.key_card_number} onChange={e => setForm(f => ({ ...f, key_card_number: e.target.value }))}
                          className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                          placeholder="K-101" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle Plate <span className="text-gray-400">(optional)</span></label>
                        <input value={form.vehicle_plate} onChange={e => setForm(f => ({ ...f, vehicle_plate: e.target.value }))}
                          className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                          placeholder="ABC 1234" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Deposit Amount (₱)</label>
                        <input type="number" min={0} step="0.01" value={form.deposit_amount}
                          onChange={e => setForm(f => ({ ...f, deposit_amount: e.target.value }))}
                          className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                          placeholder="0.00" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Actual Check-in Time</label>
                        <input type="datetime-local" value={form.actual_check_in}
                          onChange={e => setForm(f => ({ ...f, actual_check_in: e.target.value }))}
                          className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Companion Names <span className="text-gray-400">(comma-separated)</span></label>
                        <input value={form.companion_names} onChange={e => setForm(f => ({ ...f, companion_names: e.target.value }))}
                          className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                          placeholder="Maria Santos, Pedro Reyes" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Special Requests / Notes</label>
                        <input value={form.special_requests} onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))}
                          className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                          placeholder="Extra pillows, late checkout, etc." />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input type="checkbox" checked={form.id_verified}
                            onChange={e => setForm(f => ({ ...f, id_verified: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-300 accent-terra" />
                          <span className="text-sm text-gray-700 font-medium">ID has been sighted and verified</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleCheckIn} disabled={saving}
                        className="bg-terra text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
                        {saving ? 'Checking in…' : '✓ Confirm Check-In'}
                      </button>
                      <button onClick={() => setActiveId(null)}
                        className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
