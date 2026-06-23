'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type RoomType = { id: string; name: string; base_price: number }
type Reservation = {
  id: string
  check_in_date: string
  check_out_date: string
  nights: number
  total_amount: number | null
  status: string
  notes: string | null
  rooms: { room_number: string; room_types: { name: string } | null } | null
}

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-700',
  confirmed:   'bg-blue-100 text-blue-700',
  checked_in:  'bg-green-100 text-green-700',
  checked_out: 'bg-gray-100 text-gray-500',
  cancelled:   'bg-red-100 text-red-600',
  no_show:     'bg-orange-100 text-orange-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending confirmation',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  no_show: 'No show',
}

function todayStr() { return new Date().toISOString().split('T')[0] }
function currency(n: number) { return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 }) }

function ReservationsContent() {
  const supabase = createClient()
  const params = useSearchParams()

  const [guestId, setGuestId] = useState<string | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(!!params.get('type'))

  const [selectedTypeId, setSelectedTypeId] = useState(params.get('type') ?? '')
  const [checkIn, setCheckIn] = useState(todayStr())
  const [checkOut, setCheckOut] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
  })
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: guest }, { data: types }] = await Promise.all([
      supabase.from('guests').select('id').eq('profile_id', user.id).single(),
      supabase.from('room_types').select('id, name, base_price').order('name'),
    ])

    setGuestId(guest?.id ?? null)
    setRoomTypes(types ?? [])

    if (guest?.id) {
      const { data: res } = await supabase
        .from('reservations')
        .select('id, check_in_date, check_out_date, nights, total_amount, status, notes, rooms(room_number, room_types(name))')
        .eq('guest_id', guest.id)
        .order('check_in_date', { ascending: false })
      setReservations((res as Reservation[]) ?? [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const nights = checkIn && checkOut && checkOut > checkIn
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    : 0
  const selectedType = roomTypes.find(t => t.id === selectedTypeId)
  const estimatedTotal = selectedType && nights > 0 ? nights * selectedType.base_price : null

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!guestId) { setError('Guest profile not found. Please contact front desk.'); return }
    if (!selectedTypeId) { setError('Please select a room type.'); return }
    if (checkOut <= checkIn) { setError('Check-out must be after check-in.'); return }
    setSaving(true)
    setError(null)

    const { data: availableRooms } = await supabase
      .from('rooms')
      .select('id, room_number')
      .eq('room_type_id', selectedTypeId)
      .eq('status', 'available')

    if (!availableRooms?.length) {
      setError('No rooms of this type are available. Please try a different room type.')
      setSaving(false)
      return
    }

    const { data: conflicts } = await supabase
      .from('reservations')
      .select('room_id')
      .in('status', ['pending', 'confirmed', 'checked_in'])
      .lt('check_in_date', checkOut)
      .gt('check_out_date', checkIn)

    const conflictIds = new Set((conflicts ?? []).map(c => c.room_id))
    const room = availableRooms.find(r => !conflictIds.has(r.id))

    if (!room) {
      setError('All rooms of this type are booked for those dates. Please choose different dates.')
      setSaving(false)
      return
    }

    const { error: err } = await supabase.from('reservations').insert({
      guest_id: guestId,
      room_id: room.id,
      check_in_date: checkIn,
      check_out_date: checkOut,
      total_amount: estimatedTotal,
      status: 'pending',
      notes: notes || null,
    })

    if (err) { setError(err.message); setSaving(false); return }

    setSuccess(`Booking confirmed for Room ${room.room_number}! Our team will reach out to verify details.`)
    setShowForm(false)
    setSaving(false)
    setNotes('')
    load()
  }

  if (loading) return (
    <div>
      <div className="bg-[#2d1c14] px-6 pt-14 pb-6">
        <h1 className="font-serif text-2xl font-bold text-[#f0e0d0]">My Stays</h1>
      </div>
      <div className="p-5 space-y-3">
        {[1, 2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  )

  return (
    <div>
      <div className="bg-[#2d1c14] px-6 pt-14 pb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#f0e0d0]">My Stays</h1>
          <p className="text-[#7a5040] text-xs mt-0.5">
            {reservations.length} reservation{reservations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-[#b85c38] text-white text-xs px-4 py-2.5 rounded-xl font-medium hover:bg-[#9a4a2a] transition-colors shrink-0"
        >
          {showForm ? 'Cancel' : '+ Book a Room'}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">{success}</div>}

        {/* Booking form */}
        {showForm && (
          <form onSubmit={handleBook} className="bg-white border border-[#e8d5c8] rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-[#3d2018]">New Reservation</h2>

            <div>
              <label className="block text-xs font-medium text-[#7a5040] mb-1.5">Room Type *</label>
              <select required value={selectedTypeId} onChange={e => setSelectedTypeId(e.target.value)}
                className="w-full border border-[#e8d5c8] rounded-xl px-4 py-3 text-sm text-[#3d2018] bg-white focus:outline-none focus:ring-2 focus:ring-[#b85c38] appearance-none">
                <option value="">— Choose a room —</option>
                {roomTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} · {currency(t.base_price)}/night</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#7a5040] mb-1.5">Check-in *</label>
                <input required type="date" value={checkIn} min={todayStr()}
                  onChange={e => setCheckIn(e.target.value)}
                  className="w-full border border-[#e8d5c8] rounded-xl px-3 py-3 text-sm text-[#3d2018] bg-white focus:outline-none focus:ring-2 focus:ring-[#b85c38]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#7a5040] mb-1.5">Check-out *</label>
                <input required type="date" value={checkOut} min={checkIn}
                  onChange={e => setCheckOut(e.target.value)}
                  className="w-full border border-[#e8d5c8] rounded-xl px-3 py-3 text-sm text-[#3d2018] bg-white focus:outline-none focus:ring-2 focus:ring-[#b85c38]" />
              </div>
            </div>

            {estimatedTotal !== null && (
              <div className="bg-[#fdf6f0] border border-[#f0c8aa] rounded-xl p-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#7a5040]">{nights} night{nights !== 1 ? 's' : ''} × {currency(selectedType!.base_price)}</span>
                  <span className="font-bold text-[#b85c38] text-base">{currency(estimatedTotal)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#7a5040] mb-1.5">Special Requests</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Early check-in, extra pillows, allergies…"
                className="w-full border border-[#e8d5c8] rounded-xl px-4 py-3 text-sm text-[#3d2018] placeholder-[#c8a898] bg-white focus:outline-none focus:ring-2 focus:ring-[#b85c38]" />
            </div>

            <button type="submit" disabled={saving}
              className="w-full bg-[#b85c38] text-white py-3.5 rounded-xl font-medium hover:bg-[#9a4a2a] disabled:opacity-50 transition-colors">
              {saving ? 'Booking…' : 'Confirm Booking'}
            </button>
          </form>
        )}

        {/* Empty state */}
        {reservations.length === 0 && !showForm && (
          <div className="text-center py-16 text-[#8a6a5a]">
            <p className="text-5xl mb-4">🗓</p>
            <p className="font-medium text-[#3d2018]">No reservations yet</p>
            <p className="text-xs mt-1 mb-6">Browse our rooms and book your stay</p>
            <button onClick={() => setShowForm(true)}
              className="bg-[#b85c38] text-white px-8 py-3.5 rounded-xl text-sm font-medium hover:bg-[#9a4a2a] transition-colors">
              Book a Room
            </button>
          </div>
        )}

        {/* Reservations list */}
        {reservations.map(r => (
          <div key={r.id} className="bg-white border border-[#e8d5c8] rounded-2xl overflow-hidden">
            <div className={`px-4 py-2 text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[r.status] ?? r.status}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-bold text-[#3d2018] text-base">Room {r.rooms?.room_number ?? '—'}</p>
                  <p className="text-xs text-[#8a6a5a] mt-0.5">{r.rooms?.room_types?.name ?? ''}</p>
                </div>
                {r.total_amount != null && (
                  <p className="font-bold text-[#b85c38] text-lg">{currency(r.total_amount)}</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-[#faf8f5] rounded-xl p-3">
                  <p className="text-[#8a6a5a] mb-1">Check-in</p>
                  <p className="font-semibold text-[#3d2018]">
                    {new Date(r.check_in_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-[#8a6a5a] text-[10px]">
                    {new Date(r.check_in_date + 'T00:00:00').getFullYear()}
                  </p>
                </div>
                <div className="bg-[#faf8f5] rounded-xl p-3">
                  <p className="text-[#8a6a5a] mb-1">Check-out</p>
                  <p className="font-semibold text-[#3d2018]">
                    {new Date(r.check_out_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-[#8a6a5a] text-[10px]">
                    {new Date(r.check_out_date + 'T00:00:00').getFullYear()}
                  </p>
                </div>
                <div className="bg-[#faf8f5] rounded-xl p-3">
                  <p className="text-[#8a6a5a] mb-1">Duration</p>
                  <p className="font-semibold text-[#3d2018]">{r.nights}</p>
                  <p className="text-[#8a6a5a] text-[10px]">night{r.nights !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {r.notes && (
                <p className="mt-3 text-xs text-[#7a5040] bg-[#fdf6f0] rounded-xl px-3 py-2">
                  📝 {r.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GuestReservationsPage() {
  return (
    <Suspense fallback={
      <div>
        <div className="bg-[#2d1c14] px-6 pt-14 pb-6">
          <h1 className="font-serif text-2xl font-bold text-[#f0e0d0]">My Stays</h1>
        </div>
        <div className="p-5 space-y-3">
          {[1, 2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    }>
      <ReservationsContent />
    </Suspense>
  )
}
