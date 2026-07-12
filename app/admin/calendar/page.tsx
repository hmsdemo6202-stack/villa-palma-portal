'use client'
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'

type Room = {
  id: string
  room_number: string
  floor: number | null
  status: string
  room_types: { name: string } | null
}

type Reservation = {
  id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  status: string
  guests: { full_name: string } | null
}

const DAYS_VISIBLE = 14

const STATUS_STYLES: Record<string, string> = {
  occupied:    'bg-red-200 text-red-800',
  reserved:    'bg-yellow-200 text-yellow-800',
  maintenance: 'bg-gray-300 text-gray-700',
  dirty:       'bg-orange-200 text-orange-800',
  cleaning:    'bg-blue-200 text-blue-800',
  inspection:  'bg-purple-200 text-purple-800',
  available:   'bg-green-50 text-green-700',
}

function toISO(d: Date) { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c }

export default function CalendarPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [rangeStart, setRangeStart] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [popover, setPopover] = useState<{ room: Room; date: string; res: Reservation } | null>(null)

  const dates = useMemo(
    () => Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(rangeStart, i)),
    [rangeStart]
  )
  const rangeEnd = dates[dates.length - 1]

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: rs }, { data: res }] = await Promise.all([
      supabase.from('rooms').select('id, room_number, floor, status, room_types(name)').order('room_number'),
      supabase.from('reservations')
        .select('id, room_id, check_in_date, check_out_date, status, guests(full_name)')
        .not('status', 'in', '("cancelled","no_show")')
        .lt('check_in_date', toISO(addDays(rangeEnd, 1)))
        .gt('check_out_date', toISO(rangeStart)),
    ])
    setRooms((rs as unknown as Room[]) ?? [])
    setReservations((res as unknown as Reservation[]) ?? [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, rangeStart.getTime(), rangeEnd.getTime()])

  useEffect(() => { load() }, [load])

  const todayIso = toISO(new Date())

  function cellFor(room: Room, date: Date): { style: string; res?: Reservation } {
    const iso = toISO(date)
    const res = reservations.find(r => r.room_id === room.id && r.check_in_date <= iso && iso < r.check_out_date)
    if (res) return { style: STATUS_STYLES[res.status === 'checked_in' ? 'occupied' : 'reserved'], res }
    if (iso === todayIso && ['maintenance', 'dirty', 'cleaning', 'inspection'].includes(room.status)) {
      return { style: STATUS_STYLES[room.status] }
    }
    return { style: STATUS_STYLES.available }
  }

  // Group rooms by type for the sub-header rows.
  const groups = useMemo(() => {
    const map = new Map<string, Room[]>()
    for (const room of rooms) {
      const key = room.room_types?.name ?? 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(room)
    }
    return Array.from(map.entries())
  }, [rooms])

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Availability Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {dates[0].toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – {rangeEnd.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRangeStart(d => addDays(d, -7))} className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50">← Prev week</button>
          <button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setRangeStart(d) }} className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50">Today</button>
          <button onClick={() => setRangeStart(d => addDays(d, 7))} className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50">Next week →</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {(['available', 'reserved', 'occupied', 'dirty', 'cleaning', 'inspection', 'maintenance'] as const).map(s => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm inline-block ${STATUS_STYLES[s]}`} />
            <span className="text-gray-500 capitalize">{s}</span>
          </span>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading calendar…</p>
      ) : (
        <div className="border border-warm-border rounded-xl overflow-x-auto">
          <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${DAYS_VISIBLE}, 64px)`, minWidth: 160 + DAYS_VISIBLE * 64 }}>
            {/* Header row */}
            <div className="sticky left-0 top-0 z-20 bg-gray-50 border-b border-r border-warm-border px-3 py-2 text-xs font-semibold text-gray-500">
              Room
            </div>
            {dates.map(d => (
              <div key={toISO(d)} className={`sticky top-0 z-10 border-b border-warm-border px-1 py-2 text-center text-[11px] ${
                toISO(d) === todayIso ? 'bg-terra-light text-terra font-semibold' : 'bg-gray-50 text-gray-500'
              }`}>
                <div>{d.toLocaleDateString('en-PH', { weekday: 'short' })}</div>
                <div className="font-medium">{d.getDate()}</div>
              </div>
            ))}

            {/* Rows grouped by room type */}
            {groups.map(([typeName, typeRooms]) => (
              <Fragment key={typeName}>
                <div
                  className="sticky left-0 z-10 bg-cream border-b border-r border-warm-border px-3 py-1.5 text-[11px] font-semibold text-brown uppercase tracking-wide"
                  style={{ gridColumn: '1 / -1' }}>
                  {typeName}
                </div>
                {typeRooms.map(room => (
                  <Fragment key={room.id}>
                    <div className="sticky left-0 z-10 bg-white border-b border-r border-warm-border px-3 py-2 text-xs">
                      <p className="font-semibold text-brown">{room.room_number}</p>
                      <p className="text-gray-400">Floor {room.floor ?? '—'}</p>
                    </div>
                    {dates.map(date => {
                      const { style, res } = cellFor(room, date)
                      return (
                        <button
                          key={`${room.id}-${toISO(date)}`}
                          onClick={() => res && setPopover({ room, date: toISO(date), res })}
                          className={`border-b border-r border-warm-border/60 h-11 ${style} ${res ? 'cursor-pointer hover:opacity-80' : ''}`}
                        />
                      )
                    })}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {popover && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPopover(null)}>
          <div className="bg-white rounded-xl p-5 max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <p className="text-xs text-gray-400 mb-1">Room {popover.room.room_number} · {popover.room.room_types?.name}</p>
            <p className="font-bold text-brown text-base mb-2">{popover.res.guests?.full_name ?? 'Guest'}</p>
            <p className="text-sm text-gray-600">
              {new Date(popover.res.check_in_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
              {' → '}
              {new Date(popover.res.check_out_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </p>
            <p className="text-xs text-gray-400 mt-1 capitalize">Status: {popover.res.status.replace('_', ' ')}</p>
            <button onClick={() => setPopover(null)} className="mt-4 w-full border border-warm-border py-2 rounded-lg text-sm hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
