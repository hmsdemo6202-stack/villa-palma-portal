'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
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

type Guest = { id: string; full_name: string; phone: string | null; email: string | null }
type Room  = { id: string; room_number: string; floor: number | null; bed_type: string | null; room_types: { name: string; base_price: number } | null }

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
function todayISO() { return new Date().toISOString().split('T')[0] }
function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
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
  const [arrivals,  setArrivals]  = useState<Reservation[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeId,  setActiveId]  = useState<string | null>(null)
  const [form,      setForm]      = useState<CheckInForm>(emptyForm())
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState<string | null>(null)
  const [tab,       setTab]       = useState<'today' | 'all'>('today')
  const [showWalkin, setShowWalkin] = useState(false)

  // Walk-in form state
  const [guestSearch,   setGuestSearch]   = useState('')
  const [guestResults,  setGuestResults]  = useState<Guest[]>([])
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [availRooms,    setAvailRooms]    = useState<Room[]>([])
  const [selectedRoom,  setSelectedRoom]  = useState<Room | null>(null)
  const [wiCheckIn,     setWiCheckIn]     = useState(todayISO())
  const [wiNights,      setWiNights]      = useState(1)
  const [wiAmount,      setWiAmount]      = useState('')
  const [wiNotes,       setWiNotes]       = useState('')
  const [wiKeyCard,     setWiKeyCard]     = useState('')
  const [wiIdVerified,  setWiIdVerified]  = useState(false)
  const [wiDeposit,     setWiDeposit]     = useState('')
  const [wiSaving,      setWiSaving]      = useState(false)
  const guestDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = todayISO()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reservations')
      .select('id, guest_id, room_id, check_in_date, check_out_date, nights, total_amount, status, notes, guests(full_name, phone, nationality), rooms(room_number, floor, bed_type, room_types(name, base_price))')
      .in('status', ['pending', 'confirmed'])
      .order('check_in_date')
    setArrivals((data as unknown as Reservation[]) ?? [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAvailableRooms = useCallback(async () => {
    const { data } = await supabase
      .from('rooms')
      .select('id, room_number, floor, bed_type, room_types(name, base_price)')
      .eq('status', 'available')
      .order('room_number')
    setAvailRooms((data as unknown as Room[]) ?? [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (showWalkin) loadAvailableRooms()
  }, [showWalkin, loadAvailableRooms])

  // Auto-calc amount when room or nights change
  useEffect(() => {
    if (selectedRoom?.room_types?.base_price && wiNights > 0) {
      setWiAmount(String(selectedRoom.room_types.base_price * wiNights))
    }
  }, [selectedRoom, wiNights])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 5000)
  }

  function select(res: Reservation) {
    setActiveId(res.id)
    setForm({ ...emptyForm(), special_requests: res.notes ?? '' })
    setError(null)
    setShowWalkin(false)
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
    setSaving(false); setActiveId(null); setForm(emptyForm()); load()
  }

  // Guest search (debounced)
  function onGuestSearch(val: string) {
    setGuestSearch(val)
    setSelectedGuest(null)
    if (guestDebounce.current) clearTimeout(guestDebounce.current)
    if (val.trim().length < 2) { setGuestResults([]); return }
    guestDebounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from('guests')
        .select('id, full_name, phone, email')
        .ilike('full_name', `%${val.trim()}%`)
        .limit(8)
      setGuestResults((data as Guest[]) ?? [])
    }, 250)
  }

  function pickGuest(g: Guest) {
    setSelectedGuest(g); setGuestSearch(g.full_name); setGuestResults([])
  }

  async function handleWalkIn() {
    if (!selectedGuest) { flash('Please select a guest.', false); return }
    if (!selectedRoom)  { flash('Please select a room.', false); return }
    if (!wiNights || wiNights < 1) { flash('Nights must be at least 1.', false); return }

    setWiSaving(true)
    const checkOut = addDays(wiCheckIn, wiNights)

    const { error: resErr } = await supabase.from('reservations').insert({
      guest_id:        selectedGuest.id,
      room_id:         selectedRoom.id,
      check_in_date:   wiCheckIn,
      check_out_date:  checkOut,
      nights:          wiNights,
      total_amount:    wiAmount ? Number(wiAmount) : null,
      status:          'checked_in',
      actual_check_in: new Date().toISOString(),
      key_card_number: wiKeyCard.trim() || null,
      id_verified:     wiIdVerified,
      deposit_amount:  wiDeposit ? Number(wiDeposit) : 0,
      notes:           wiNotes.trim() || null,
    })
    if (resErr) { flash(resErr.message, false); setWiSaving(false); return }

    const { error: roomErr } = await supabase.from('rooms').update({ status: 'occupied' }).eq('id', selectedRoom.id)
    if (roomErr) { flash('Walk-in created, but could not update room status: ' + roomErr.message, false); setWiSaving(false); return }

    flash(`${selectedGuest.full_name} checked in to Room ${selectedRoom.room_number}.`)
    setWiSaving(false)
    setShowWalkin(false)
    resetWalkin()
    load()
  }

  function resetWalkin() {
    setGuestSearch(''); setGuestResults([]); setSelectedGuest(null)
    setSelectedRoom(null); setWiCheckIn(todayISO()); setWiNights(1)
    setWiAmount(''); setWiNotes(''); setWiKeyCard(''); setWiIdVerified(false); setWiDeposit('')
  }

  const todayArrivals = arrivals.filter(r => r.check_in_date === today)
  const visible = tab === 'today' ? todayArrivals : arrivals

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-brown">Check-In Station</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {todayArrivals.length > 0 && ` · ${todayArrivals.length} arriving today`}
          </p>
        </div>
        <button
          onClick={() => { setShowWalkin(v => !v); setActiveId(null) }}
          className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors border ${
            showWalkin
              ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
              : 'bg-terra text-white border-terra hover:bg-terra-dark'
          }`}
        >
          {showWalkin ? '← Back to Arrivals' : '+ Walk-in / Manual Check-In'}
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">✓ {success}</div>}

      {/* ── Walk-in form ── */}
      {showWalkin && (
        <div className="bg-white border border-warm-border rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-brown">Walk-in / Manual Check-In</h2>
            <p className="text-xs text-gray-500 mt-0.5">Create a reservation and check in a guest in one step.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Guest search */}
            <div className="sm:col-span-2 relative">
              <label className="block text-xs font-medium text-gray-600 mb-1">Guest *</label>
              <input
                value={guestSearch}
                onChange={e => onGuestSearch(e.target.value)}
                placeholder="Search guest by name (min 2 chars)…"
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
              />
              {guestResults.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-warm-border rounded-xl shadow-lg overflow-hidden">
                  {guestResults.map(g => (
                    <button key={g.id} onClick={() => pickGuest(g)}
                      className="w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-0">
                      <span className="font-medium text-brown text-sm">{g.full_name}</span>
                      {g.phone && <span className="text-xs text-gray-400 ml-2">{g.phone}</span>}
                      {g.email && <span className="text-xs text-gray-400 ml-2">{g.email}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedGuest && (
                <p className="text-xs text-green-600 mt-1">✓ {selectedGuest.full_name} selected</p>
              )}
              {guestSearch.length >= 2 && !selectedGuest && guestResults.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No guests found. <a href="/admin/guests" className="text-terra underline">Add guest in Guests CRM first.</a></p>
              )}
            </div>

            {/* Room picker */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Room *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                {availRooms.length === 0 && (
                  <p className="col-span-full text-xs text-gray-400">No available rooms found.</p>
                )}
                {availRooms.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoom(r)}
                    className={`text-left p-3 rounded-xl border-2 transition-colors ${
                      selectedRoom?.id === r.id
                        ? 'border-terra bg-amber-50'
                        : 'border-warm-border hover:border-terra/40 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-brown text-sm">Room {r.room_number}</div>
                    <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{r.room_types?.name ?? '—'}</div>
                    {r.room_types?.base_price && (
                      <div className="text-[10px] text-terra font-medium mt-0.5">₱{r.room_types.base_price.toLocaleString('en-PH')}/night</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates + nights */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-in Date *</label>
              <input type="date" value={wiCheckIn} onChange={e => setWiCheckIn(e.target.value)}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Number of Nights *</label>
              <input type="number" min={1} value={wiNights} onChange={e => setWiNights(+e.target.value)}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              {wiCheckIn && wiNights > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">Check-out: {addDays(wiCheckIn, wiNights)}</p>
              )}
            </div>

            {/* Amount + deposit */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Total Amount (₱)</label>
              <input type="number" min={0} step="0.01" value={wiAmount} onChange={e => setWiAmount(e.target.value)}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="Auto-filled from room rate" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Deposit Collected (₱)</label>
              <input type="number" min={0} step="0.01" value={wiDeposit} onChange={e => setWiDeposit(e.target.value)}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="0.00" />
            </div>

            {/* Key card */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Key Card Number</label>
              <input value={wiKeyCard} onChange={e => setWiKeyCard(e.target.value)}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="K-101" />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input value={wiNotes} onChange={e => setWiNotes(e.target.value)}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="Special requests, companion names, etc." />
            </div>

            {/* ID verified */}
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={wiIdVerified} onChange={e => setWiIdVerified(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-terra" />
                <span className="text-sm text-gray-700 font-medium">ID has been sighted and verified</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleWalkIn}
              disabled={wiSaving || !selectedGuest || !selectedRoom}
              className="bg-terra text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-40 transition-colors"
            >
              {wiSaving ? 'Checking in…' : '✓ Create & Check In'}
            </button>
            <button onClick={() => { setShowWalkin(false); resetWalkin() }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Scheduled arrivals ── */}
      {!showWalkin && (
        <>
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
              <p className="text-sm mt-2">Use <button onClick={() => setShowWalkin(true)} className="text-terra underline">Walk-in / Manual Check-In</button> for guests without a prior booking.</p>
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
        </>
      )}
    </div>
  )
}
