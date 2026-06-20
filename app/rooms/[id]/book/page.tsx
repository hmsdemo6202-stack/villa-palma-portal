'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type RoomWithType = {
  id: string
  room_number: string
  floor: number | null
  room_types: {
    name: string
    description: string | null
    base_price: number
    capacity: number
    image_url: string | null
  } | null
}

function todayStr() { return new Date().toISOString().split('T')[0] }

const inputClass = "w-full border border-warm-border rounded-lg px-3 py-2 text-sm bg-white text-brown focus:outline-none focus:ring-2 focus:ring-terra focus:border-terra transition-colors"

function BookForm() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const [room, setRoom] = useState<RoomWithType | null>(null)
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') ?? '')
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') ?? '')
  const [upgrade, setUpgrade] = useState<RoomWithType | null>(null)
  const [fetching, setFetching] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRoom() {
      const { data, error: err } = await supabase
        .from('rooms').select('*, room_types(*)').eq('id', id).single()
      if (err || !data) { router.push('/rooms'); return }
      setRoom(data as RoomWithType)
      setFetching(false)
    }
    fetchRoom()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const checkUpgrade = useCallback(async (
    currentRoom: RoomWithType,
    ci: string,
    co: string,
  ) => {
    if (!ci || !co || ci >= co) { setUpgrade(null); return }
    const currentPrice = Number(currentRoom.room_types?.base_price ?? 0)
    const { data: conflicts } = await supabase
      .from('room_reservations').select('room_id')
      .neq('status', 'cancelled').lt('check_in', co).gt('check_out', ci)
    const blockedIds = (conflicts ?? []).map(c => c.room_id)
    let query = supabase.from('rooms').select('*, room_types(*)')
      .eq('status', 'available').neq('id', currentRoom.id)
    if (blockedIds.length > 0) query = query.not('id', 'in', `(${blockedIds.join(',')})`)
    const { data: available } = await query
    const candidates = (available as RoomWithType[] ?? [])
      .filter(r => { const p = Number(r.room_types?.base_price ?? 0); return p > currentPrice && p <= currentPrice * 1.75 })
      .sort((a, b) => Number(a.room_types?.base_price ?? 0) - Number(b.room_types?.base_price ?? 0))
    setUpgrade(candidates[0] ?? null)
  }, [supabase])

  useEffect(() => {
    if (room) checkUpgrade(room, checkIn, checkOut)
  }, [room, checkIn, checkOut, checkUpgrade])

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (checkIn >= checkOut) { setError('Check-out must be after check-in.'); return }
    setLoading(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { error: err } = await supabase.from('room_reservations').insert({
      user_id: user.id, room_id: id, check_in: checkIn, check_out: checkOut, status: 'pending',
    })
    if (err) {
      setError(err.code === '23P01'
        ? 'That room is already booked for part of your selected dates. Please choose different dates.'
        : err.message)
      setLoading(false)
    } else {
      router.push('/my-activity?booked=room')
    }
  }

  if (fetching) return <div className="p-8 text-brown-light">Loading room…</div>
  if (!room) return null

  const type = room.room_types
  const nights = checkIn && checkOut && checkIn < checkOut
    ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    : 0
  const estimatedTotal = nights * Number(type?.base_price ?? 0)

  return (
    <div className="min-h-screen bg-cream p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/rooms" className="text-sm text-terra hover:text-terra-dark mb-5 inline-flex items-center gap-1 transition-colors">
          ← Back to rooms
        </Link>

        {/* Room Details Card */}
        <div className="bg-white border border-warm-border rounded-xl overflow-hidden mb-5 shadow-sm">
          {type?.image_url && (
            <img src={type.image_url} alt={type.name} className="w-full h-48 object-cover" />
          )}
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-xl font-bold text-brown">Room {room.room_number}</h1>
                <p className="text-brown-mid text-sm">{type?.name}</p>
                {type?.description && <p className="text-xs text-brown-light mt-1">{type.description}</p>}
              </div>
              <div className="text-right">
                <p className="font-bold text-terra text-lg">₱{Number(type?.base_price ?? 0).toLocaleString()}</p>
                <p className="text-xs text-brown-light">per night</p>
              </div>
            </div>
            <p className="text-xs text-brown-light mt-3">
              {type?.capacity} guests max{room.floor ? ` · Floor ${room.floor}` : ''}
            </p>
          </div>
        </div>

        {/* Upgrade Suggestion Banner */}
        {upgrade && upgrade.room_types && nights > 0 && (
          <div className="mb-5 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-indigo-800 mb-1">✨ Upgrade suggestion</p>
            <p className="text-sm text-indigo-700">
              <strong>{upgrade.room_types.name}</strong> (Room {upgrade.room_number}) is available
              for the same dates at{' '}
              <strong>₱{Number(upgrade.room_types.base_price).toLocaleString()} / night</strong>
              {' '}— just{' '}
              <strong>₱{((Number(upgrade.room_types.base_price) - Number(type?.base_price ?? 0)) * nights).toLocaleString()}</strong>{' '}
              more for your stay.
            </p>
            <p className="text-xs text-indigo-500 mt-1.5">
              {upgrade.room_types.capacity} guests max
              {upgrade.floor ? ` · Floor ${upgrade.floor}` : ''}
              {upgrade.room_types.description ? ` · ${upgrade.room_types.description}` : ''}
            </p>
            <Link
              href={`/rooms/${upgrade.id}/book?checkIn=${checkIn}&checkOut=${checkOut}`}
              className="mt-3 inline-block text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
              View {upgrade.room_types.name} instead →
            </Link>
          </div>
        )}

        {/* Booking Form */}
        <form onSubmit={handleBook} className="bg-white border border-warm-border rounded-xl p-5 shadow-sm space-y-5">
          <h2 className="font-serif font-semibold text-lg text-brown">Book this room</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-brown-light uppercase tracking-[0.15em] mb-1.5">
                Check-in *
              </label>
              <input type="date" required value={checkIn} min={todayStr()}
                onChange={e => setCheckIn(e.target.value)}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-brown-light uppercase tracking-[0.15em] mb-1.5">
                Check-out *
              </label>
              <input type="date" required value={checkOut} min={checkIn || todayStr()}
                onChange={e => setCheckOut(e.target.value)}
                className={inputClass} />
            </div>
          </div>

          {nights > 0 && (
            <div className="bg-terra-light border border-[#f0c8aa] rounded-lg p-4 text-sm">
              <p className="text-brown-mid">
                {nights} night{nights !== 1 ? 's' : ''} × ₱{Number(type?.base_price ?? 0).toLocaleString()}
              </p>
              <p className="font-bold text-terra text-lg mt-0.5">
                Estimated total: ₱{estimatedTotal.toLocaleString()}
              </p>
              <p className="text-xs text-brown-light mt-1">Final price confirmed by the system after booking.</p>
            </div>
          )}

          {error && (
            <div className="bg-[#fdf2f2] border border-[#e8b4b4] text-[#7a2020] rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || nights <= 0}
            className="w-full bg-terra text-white py-3 rounded-lg font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors tracking-wide">
            {loading ? 'Booking…' : 'Confirm Booking'}
          </button>
          <p className="text-xs text-brown-light text-center">
            Status starts as <strong>Pending</strong>. Cancel anytime while pending.
          </p>
        </form>
      </div>
    </div>
  )
}

export default function BookPage() {
  return (
    <Suspense fallback={<div className="p-8 text-brown-light">Loading…</div>}>
      <BookForm />
    </Suspense>
  )
}
