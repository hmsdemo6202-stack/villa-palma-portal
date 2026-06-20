'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type RoomWithType = {
  id: string
  room_number: string
  floor: number | null
  status: string
  room_types: {
    name: string
    description: string | null
    base_price: number
    capacity: number
    image_url: string | null
  } | null
}

function todayStr() { return new Date().toISOString().split('T')[0] }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
}

const inputClass = "border border-warm-border rounded-lg px-3 py-2 text-sm bg-white text-brown focus:outline-none focus:ring-2 focus:ring-terra focus:border-terra transition-colors"

export default function RoomsPage() {
  const supabase = createClient()

  const [checkIn, setCheckIn] = useState(todayStr())
  const [checkOut, setCheckOut] = useState(tomorrowStr())
  const [rooms, setRooms] = useState<RoomWithType[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    if (checkIn >= checkOut) { setError('Check-out must be after check-in.'); return }
    setLoading(true); setError(null)

    const { data: conflicts } = await supabase
      .from('room_reservations')
      .select('room_id')
      .neq('status', 'cancelled')
      .lt('check_in', checkOut)
      .gt('check_out', checkIn)

    const blockedIds = (conflicts ?? []).map((c: { room_id: string }) => c.room_id)

    let query = supabase
      .from('rooms')
      .select('*, room_types(*)')
      .eq('status', 'available')
      .order('room_number')

    if (blockedIds.length > 0) {
      query = query.not('id', 'in', `(${blockedIds.join(',')})`)
    }

    const { data, error: err } = await query
    if (err) setError(err.message)
    else { setRooms((data as RoomWithType[]) ?? []); setSearched(true) }
    setLoading(false)
  }

  useEffect(() => { search() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function nights() {
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
    return Math.max(0, Math.round(ms / 86400000))
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Search header */}
      <div className="bg-white border-b border-warm-border shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="font-serif text-2xl font-bold text-brown mb-4">Find Your Room</h1>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[10px] font-bold text-brown-light uppercase tracking-[0.15em] mb-1.5">
                Check-in
              </label>
              <input type="date" value={checkIn} min={todayStr()}
                onChange={e => setCheckIn(e.target.value)}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-brown-light uppercase tracking-[0.15em] mb-1.5">
                Check-out
              </label>
              <input type="date" value={checkOut} min={checkIn || todayStr()}
                onChange={e => setCheckOut(e.target.value)}
                className={inputClass} />
            </div>
            <button onClick={search} disabled={loading}
              className="bg-terra text-white px-6 py-2 rounded-lg text-sm hover:bg-terra-dark disabled:opacity-50 transition-colors font-medium tracking-wide">
              {loading ? 'Searching…' : 'Search Rooms'}
            </button>
          </div>
          {error && <p className="text-[#9e3535] text-sm mt-2">{error}</p>}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {searched && rooms.length === 0 && !loading && (
          <p className="text-brown-light text-center py-16">
            No rooms available for those dates. Try different dates.
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(room => {
            const type = room.room_types
            const n = nights()
            const total = type ? type.base_price * n : 0
            return (
              <div key={room.id}
                className="bg-white border border-warm-border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-terra transition-all group">
                {type?.image_url ? (
                  <img src={type.image_url} alt={type.name} className="w-full h-44 object-cover" />
                ) : (
                  <div className="w-full h-44 bg-cream-dark flex items-center justify-center">
                    <span className="font-serif text-4xl font-bold text-[#d4b8a8]">{room.room_number}</span>
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-brown">Room {room.room_number}</p>
                      <p className="text-sm text-brown-light">{type?.name ?? '—'}</p>
                    </div>
                    <span className="text-xs bg-[#f0f7f2] text-[#2e6b4a] border border-[#a3ccb3] px-2 py-0.5 rounded-full font-medium">
                      Available
                    </span>
                  </div>
                  <p className="text-xs text-brown-light mb-1">
                    {type?.capacity ?? '?'} guests max
                    {room.floor ? ` · Floor ${room.floor}` : ''}
                  </p>
                  {type?.description && (
                    <p className="text-xs text-brown-mid mb-3 line-clamp-2">{type.description}</p>
                  )}
                  <div className="flex items-end justify-between mt-3 pt-3 border-t border-warm-border">
                    <div>
                      <p className="text-xs text-brown-light">₱{Number(type?.base_price ?? 0).toLocaleString()} / night</p>
                      {n > 0 && (
                        <p className="text-sm font-bold text-terra">
                          ₱{total.toLocaleString()} for {n} night{n !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/rooms/${room.id}/book?checkIn=${checkIn}&checkOut=${checkOut}`}
                      className="bg-terra text-white text-sm px-4 py-2 rounded-lg hover:bg-terra-dark transition-colors font-medium">
                      Book
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
