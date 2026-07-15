'use client'
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'

type Room = {
  id: string
  room_number: string
  floor: number | null
  status: string
  room_types: { id: string; name: string } | null
}

type Reservation = {
  id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  status: string
  guests: { full_name: string | null } | null
}

type Block = {
  id: string
  room_id: string
  start_date: string
  end_date: string
  reason: string | null
}

type CellStatus = 'available' | 'reserved' | 'occupied' | 'blocked' | 'maintenance' | 'dirty'

type Modal =
  | { type: 'block';  room: Room; date: string }
  | { type: 'unblock'; room: Room; block: Block }
  | { type: 'detail'; room: Room; res: Reservation }

const DAYS_VISIBLE = 14

const CELL_BG: Record<CellStatus, string> = {
  available:   'bg-emerald-50',
  reserved:    'bg-amber-100',
  occupied:    'bg-red-200',
  blocked:     'bg-slate-200',
  maintenance: 'bg-orange-100',
  dirty:       'bg-pink-100',
}

const CELL_HOVER: Record<CellStatus, string> = {
  available:   'hover:bg-emerald-100',
  reserved:    'hover:bg-amber-200',
  occupied:    'hover:bg-red-300',
  blocked:     'hover:bg-slate-300',
  maintenance: 'hover:bg-orange-200',
  dirty:       'hover:bg-pink-200',
}

const CELL_BORDER: Record<CellStatus, string> = {
  available:   'border-emerald-100',
  reserved:    'border-amber-200',
  occupied:    'border-red-300',
  blocked:     'border-slate-300',
  maintenance: 'border-orange-200',
  dirty:       'border-pink-200',
}

const CELL_TEXT: Record<CellStatus, string> = {
  available:   '',
  reserved:    'R',
  occupied:    'IN',
  blocked:     '🔒',
  maintenance: 'MX',
  dirty:       'DC',
}

const LEGEND: [CellStatus, string][] = [
  ['available',   'Available'],
  ['reserved',    'Reserved'],
  ['occupied',    'Checked In'],
  ['blocked',     'Blocked'],
  ['maintenance', 'Maintenance'],
  ['dirty',       'Dirty / Cleaning'],
]

function toISO(d: Date) { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c }
function fmtShort(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export default function AvailabilityPage() {
  const supabase = createClient()

  const [rooms,        setRooms]        = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [blocks,       setBlocks]       = useState<Block[]>([])
  const [loading,      setLoading]      = useState(true)
  const [blocksReady,  setBlocksReady]  = useState(true)
  const [rangeStart,   setRangeStart]   = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })

  const [modal,       setModal]       = useState<Modal | null>(null)
  const [blockStart,  setBlockStart]  = useState('')
  const [blockEnd,    setBlockEnd]    = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [err,         setErr]         = useState<string | null>(null)

  const dates = useMemo(
    () => Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(rangeStart, i)),
    [rangeStart],
  )
  const rangeEnd = dates[dates.length - 1]

  const load = useCallback(async () => {
    setLoading(true)
    const s = toISO(rangeStart)
    const e = toISO(addDays(rangeEnd, 1))

    const [{ data: rs }, { data: res }, { data: bl, error: blErr }] = await Promise.all([
      supabase.from('rooms')
        .select('id, room_number, floor, status, room_types(id, name)')
        .order('room_number'),
      supabase.from('reservations')
        .select('id, room_id, check_in_date, check_out_date, status, guests(full_name)')
        .not('status', 'in', '("cancelled","no_show")')
        .lt('check_in_date', e)
        .gt('check_out_date', s),
      supabase.from('room_blocks')
        .select('id, room_id, start_date, end_date, reason')
        .lte('start_date', toISO(rangeEnd))
        .gte('end_date', s),
    ])

    setRooms((rs as unknown as Room[]) ?? [])
    setReservations((res as unknown as Reservation[]) ?? [])

    if (blErr) {
      // Table may not exist yet (HMS_ROOM_BLOCKS.sql not run)
      setBlocks([])
      setBlocksReady(false)
    } else {
      setBlocks((bl as unknown as Block[]) ?? [])
      setBlocksReady(true)
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, rangeStart.getTime(), rangeEnd.getTime()])

  useEffect(() => { load() }, [load])

  // Auto-refresh when reservations or rooms change (check-in, checkout, status updates)
  useEffect(() => {
    const channel = supabase
      .channel('availability-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, load])

  const todayIso = toISO(new Date())

  function cellStatus(room: Room, date: Date): { status: CellStatus; res?: Reservation; block?: Block } {
    const iso = toISO(date)
    const res = reservations.find(
      r => r.room_id === room.id && r.check_in_date <= iso && iso < r.check_out_date,
    )
    if (res) return { status: res.status === 'checked_in' ? 'occupied' : 'reserved', res }

    const block = blocks.find(
      b => b.room_id === room.id && b.start_date <= iso && iso <= b.end_date,
    )
    if (block) return { status: 'blocked', block }

    if (iso === todayIso && (room.status === 'maintenance' || room.status === 'dirty')) {
      return { status: room.status as CellStatus }
    }
    return { status: 'available' }
  }

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rooms: Room[] }>()
    for (const room of rooms) {
      const key  = room.room_types?.id   ?? '__other'
      const name = room.room_types?.name ?? 'Other'
      if (!map.has(key)) map.set(key, { name, rooms: [] })
      map.get(key)!.rooms.push(room)
    }
    return Array.from(map.values())
  }, [rooms])

  function availCount(typeRooms: Room[], date: Date) {
    return typeRooms.filter(r => cellStatus(r, date).status === 'available').length
  }

  function openBlockModal(room: Room, date: string) {
    if (!blocksReady) {
      setErr('Run HMS_ROOM_BLOCKS.sql in Supabase first to enable room blocking.')
      return
    }
    setBlockStart(date)
    setBlockEnd(date)
    setBlockReason('')
    setErr(null)
    setModal({ type: 'block', room, date })
  }

  async function createBlock() {
    if (modal?.type !== 'block') return
    if (!blockStart || !blockEnd) return
    setSubmitting(true)
    const { error } = await supabase.from('room_blocks').insert({
      room_id:    modal.room.id,
      start_date: blockStart,
      end_date:   blockEnd,
      reason:     blockReason.trim() || null,
    })
    setSubmitting(false)
    if (error) { setErr(error.message); return }
    setModal(null)
    setBlockStart(''); setBlockEnd(''); setBlockReason('')
    load()
  }

  async function removeBlock() {
    if (modal?.type !== 'unblock') return
    setSubmitting(true)
    const { error } = await supabase.from('room_blocks').delete().eq('id', modal.block.id)
    setSubmitting(false)
    if (error) { setErr(error.message); return }
    setModal(null)
    load()
  }

  const COL = `160px repeat(${DAYS_VISIBLE}, 52px)`
  const MIN_W = 160 + DAYS_VISIBLE * 52

  return (
    <div className="space-y-4 max-w-full">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Availability Grid</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {dates[0].toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            {' – '}
            {rangeEnd.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRangeStart(d => addDays(d, -7))}
            className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            ← Prev
          </button>
          <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setRangeStart(d) }}
            className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            Today
          </button>
          <button onClick={() => setRangeStart(d => addDays(d, 7))}
            className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            Next →
          </button>
          <button onClick={() => load()}
            className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-gray-500">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* SQL notice */}
      {!blocksReady && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          <strong>Block/unblock controls unavailable.</strong> Run <code className="font-mono bg-amber-100 px-1 rounded">sql/HMS_ROOM_BLOCKS.sql</code> in the Supabase SQL Editor to enable them.
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {LEGEND.map(([status, label]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm inline-block border ${CELL_BG[status]} ${CELL_BORDER[status]}`} />
            <span className="text-gray-500">{label}</span>
          </span>
        ))}
        <span className="text-gray-400 ml-2">· Click a cell to view details or block/unblock</span>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm py-10 text-center">Loading grid…</p>
      ) : rooms.length === 0 ? (
        <p className="text-gray-400 text-sm py-10 text-center">No rooms found.</p>
      ) : (
        <div className="border border-warm-border rounded-xl overflow-x-auto shadow-sm">
          <div style={{ display: 'grid', gridTemplateColumns: COL, minWidth: MIN_W }}>

            {/* ── Date header ── */}
            <div className="sticky left-0 top-0 z-20 bg-gray-50 border-b border-r border-warm-border px-3 py-2 text-xs font-semibold text-gray-500">
              Room
            </div>
            {dates.map(d => {
              const iso = toISO(d)
              const isToday = iso === todayIso
              return (
                <div key={iso} className={`sticky top-0 z-10 border-b border-r border-warm-border px-1 py-2 text-center text-[11px] select-none ${
                  isToday ? 'bg-[#fdf0eb] text-[#b85c38] font-semibold' : 'bg-gray-50 text-gray-500'
                }`}>
                  <div>{d.toLocaleDateString('en-PH', { weekday: 'short' })}</div>
                  <div className="font-medium">{d.getDate()}</div>
                </div>
              )
            })}

            {/* ── Room type groups ── */}
            {groups.map(({ name, rooms: typeRooms }) => (
              <Fragment key={name}>

                {/* Type label */}
                <div
                  className="sticky left-0 z-10 bg-[#f5ede4] border-b border-r border-warm-border px-3 py-1.5 text-[11px] font-semibold text-[#6b4535] uppercase tracking-wide"
                  style={{ gridColumn: '1 / -1' }}
                >
                  {name} &mdash; {typeRooms.length} {typeRooms.length === 1 ? 'room' : 'rooms'}
                </div>

                {/* Inventory summary row */}
                <div className="sticky left-0 z-10 bg-gray-50 border-b border-r border-warm-border px-3 py-1.5 flex items-center">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Available</span>
                </div>
                {dates.map(date => {
                  const avail = availCount(typeRooms, date)
                  const total = typeRooms.length
                  const color = avail === 0 ? 'bg-red-50 text-red-500' : avail === total ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  return (
                    <div key={toISO(date)} className={`border-b border-r border-warm-border/60 py-1.5 text-center text-[11px] font-bold select-none ${color}`}>
                      {avail}/{total}
                    </div>
                  )
                })}

                {/* Individual room rows */}
                {typeRooms.map(room => (
                  <Fragment key={room.id}>
                    <div className="sticky left-0 z-10 bg-white border-b border-r border-warm-border px-3 py-2 text-xs">
                      <p className="font-semibold text-[#2d1c14]">Room {room.room_number}</p>
                      <p className="text-gray-400 text-[10px]">Floor {room.floor ?? '—'}</p>
                    </div>
                    {dates.map(date => {
                      const iso = toISO(date)
                      const { status, res, block } = cellStatus(room, date)
                      const label = CELL_TEXT[status]
                      const title =
                        status === 'reserved'    ? `Reserved · ${res?.guests?.full_name ?? 'Guest'} · ${fmtShort(res!.check_in_date)} → ${fmtShort(res!.check_out_date)}` :
                        status === 'occupied'    ? `Checked In · ${res?.guests?.full_name ?? 'Guest'} · ${fmtShort(res!.check_in_date)} → ${fmtShort(res!.check_out_date)}` :
                        status === 'blocked'     ? `Blocked${block?.reason ? ': ' + block.reason : ''} · ${fmtShort(block!.start_date)} → ${fmtShort(block!.end_date)} · click to remove` :
                        status === 'maintenance' ? 'Maintenance' :
                        status === 'dirty'       ? 'Dirty / Cleaning' :
                        'Available — click to block'
                      return (
                        <button
                          key={`${room.id}-${iso}`}
                          title={title}
                          onClick={() => {
                            if (status === 'available')       openBlockModal(room, iso)
                            else if (status === 'blocked' && block) setModal({ type: 'unblock', room, block })
                            else if (res)                     setModal({ type: 'detail', room, res })
                          }}
                          className={`border-b border-r h-10 text-[10px] font-semibold transition-colors
                            ${CELL_BG[status]} ${CELL_BORDER[status]} ${CELL_HOVER[status]}
                            ${status !== 'available' ? 'cursor-pointer' : blocksReady ? 'cursor-pointer' : 'cursor-default'}
                          `}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </Fragment>
                ))}
              </Fragment>
            ))}

          </div>
        </div>
      )}

      {/* ── Block modal ── */}
      {modal?.type === 'block' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5 uppercase tracking-wide">Room {modal.room.room_number} · {modal.room.room_types?.name}</p>
              <h2 className="text-base font-semibold text-[#2d1c14]">Block Room</h2>
              <p className="text-xs text-gray-500 mt-1">Prevent new reservations for the selected date range. Existing bookings are not affected.</p>
            </div>
            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input type="date" value={blockStart} onChange={e => setBlockStart(e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b85c38]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To (inclusive)</label>
                <input type="date" min={blockStart} value={blockEnd} onChange={e => setBlockEnd(e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b85c38]" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reason (optional)</label>
              <input value={blockReason} onChange={e => setBlockReason(e.target.value)}
                placeholder="e.g. Scheduled maintenance, deep cleaning…"
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b85c38]" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={createBlock} disabled={!blockStart || !blockEnd || submitting}
                className="flex-1 bg-[#b85c38] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#a04f2e] disabled:opacity-40 transition-colors">
                {submitting ? 'Blocking…' : 'Block Room'}
              </button>
              <button onClick={() => { setModal(null); setErr(null) }}
                className="flex-1 border border-warm-border py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unblock modal ── */}
      {modal?.type === 'unblock' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5 uppercase tracking-wide">Room {modal.room.room_number} · {modal.room.room_types?.name}</p>
              <h2 className="text-base font-semibold text-[#2d1c14]">Remove Block</h2>
            </div>
            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wide">Dates</span>
                <span className="font-medium text-[#2d1c14]">{fmtShort(modal.block.start_date)} → {fmtShort(modal.block.end_date)}</span>
              </div>
              {modal.block.reason && (
                <div className="flex justify-between gap-4">
                  <span className="text-xs text-gray-400 uppercase tracking-wide shrink-0">Reason</span>
                  <span className="text-gray-600 text-right">{modal.block.reason}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={removeBlock} disabled={submitting}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-40 transition-colors">
                {submitting ? 'Removing…' : 'Remove Block'}
              </button>
              <button onClick={() => { setModal(null); setErr(null) }}
                className="flex-1 border border-warm-border py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reservation detail modal ── */}
      {modal?.type === 'detail' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl p-5 max-w-xs w-full space-y-3" onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5 uppercase tracking-wide">Room {modal.room.room_number} · {modal.room.room_types?.name}</p>
              <p className="font-bold text-[#2d1c14] text-base">{modal.res.guests?.full_name ?? 'Guest'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Check-in</span>
                <span className="font-medium">{fmtShort(modal.res.check_in_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Check-out</span>
                <span className="font-medium">{fmtShort(modal.res.check_out_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Status</span>
                <span className="capitalize font-medium text-[#b85c38]">{modal.res.status.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <button onClick={() => setModal(null)}
              className="w-full border border-warm-border py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
