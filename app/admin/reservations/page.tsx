'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type RoomRes = {
  id: string
  check_in: string
  check_out: string
  total_price: number | null
  status: string
  created_at: string
  profiles: { full_name: string | null } | null
  rooms: { room_number: string; room_types: { name: string } | null } | null
}

type TableRes = {
  id: string
  reservation_time: string
  duration_minutes: number
  party_size: number
  status: string
  created_at: string
  profiles: { full_name: string | null } | null
  restaurant_tables: { table_number: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-800',
  confirmed:   'bg-blue-100 text-blue-800',
  checked_in:  'bg-indigo-100 text-indigo-800',
  checked_out: 'bg-gray-100 text-gray-600',
  cancelled:   'bg-red-100 text-red-600',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[status] ?? 'bg-gray-100'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTime(d: string) {
  return new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const ROOM_ACTIONS: Record<string, { label: string; next: string }[]> = {
  pending:    [{ label: 'Confirm', next: 'confirmed' }, { label: 'Cancel', next: 'cancelled' }],
  confirmed:  [{ label: 'Check In', next: 'checked_in' }, { label: 'Cancel', next: 'cancelled' }],
  checked_in: [{ label: 'Check Out', next: 'checked_out' }],
}

const TABLE_ACTIONS: Record<string, { label: string; next: string }[]> = {
  pending:   [{ label: 'Confirm', next: 'confirmed' }, { label: 'Cancel', next: 'cancelled' }],
  confirmed: [{ label: 'Cancel', next: 'cancelled' }],
}

export default function AdminReservationsPage() {
  const supabase = createClient()
  const [roomRes, setRoomRes] = useState<RoomRes[]>([])
  const [tableRes, setTableRes] = useState<TableRes[]>([])
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async () => {
    const [{ data: rr }, { data: tr }] = await Promise.all([
      supabase
        .from('room_reservations')
        .select('*, profiles(full_name), rooms(room_number, room_types(name))')
        .order('created_at', { ascending: false }),
      supabase
        .from('table_reservations')
        .select('*, profiles(full_name), restaurant_tables(table_number)')
        .order('reservation_time', { ascending: false }),
    ])
    setRoomRes((rr as RoomRes[]) ?? [])
    setTableRes((tr as TableRes[]) ?? [])
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function updateRoomStatus(id: string, status: string) {
    const { error } = await supabase.from('room_reservations').update({ status }).eq('id', id)
    setMsg({ id, text: error ? error.message : `Status updated to "${status.replace('_', ' ')}".`, ok: !error })
    load()
  }

  async function updateTableStatus(id: string, status: string) {
    const { error } = await supabase.from('table_reservations').update({ status }).eq('id', id)
    setMsg({ id, text: error ? error.message : `Status updated to "${status}".`, ok: !error })
    load()
  }

  const filterStatuses = ['all', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']
  const filteredRoom = statusFilter === 'all' ? roomRes : roomRes.filter(r => r.status === statusFilter)
  const filteredTable = statusFilter === 'all' ? tableRes : tableRes.filter(r => r.status === statusFilter)

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Reservations</h1>
        <div className="flex gap-1 flex-wrap">
          {filterStatuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                statusFilter === s ? 'bg-terra text-white border-terra' : 'hover:border-terra text-brown-mid border-warm-border'}`}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Room Reservations */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          Room Reservations
          <span className="ml-2 text-sm font-normal text-gray-400">({filteredRoom.length})</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-left">
              <tr>
                {['Guest', 'Room', 'Check-in', 'Check-out', 'Nights', 'Total', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {filteredRoom.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No reservations.</td></tr>
              )}
              {filteredRoom.map(r => {
                const nights = Math.round(
                  (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000
                )
                const actions = ROOM_ACTIONS[r.status] ?? []
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{r.profiles?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.rooms?.room_number}
                      <span className="text-gray-400 text-xs ml-1">{r.rooms?.room_types?.name}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmt(r.check_in)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmt(r.check_out)}</td>
                    <td className="px-4 py-3">{nights}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.total_price != null ? `₱${Number(r.total_price).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      {msg?.id === r.id && (
                        <p className={`text-xs mb-1 ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
                      )}
                      <div className="flex gap-1 flex-wrap">
                        {actions.map(({ label, next }) => (
                          <button key={next} onClick={() => updateRoomStatus(r.id, next)}
                            className={`text-xs px-2.5 py-1 rounded-lg border whitespace-nowrap ${
                              next === 'cancelled'
                                ? 'border-[#e8b4b4] text-[#9e3535] hover:bg-[#fdf2f2]'
                                : 'border-[#f0c8aa] text-terra hover:bg-terra-light'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Table Reservations */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          Table Reservations
          <span className="ml-2 text-sm font-normal text-gray-400">({filteredTable.length})</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-left">
              <tr>
                {['Guest', 'Table', 'Date & Time', 'Duration', 'Party', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {filteredTable.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No reservations.</td></tr>
              )}
              {filteredTable.map(r => {
                const actions = TABLE_ACTIONS[r.status] ?? []
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{r.profiles?.full_name ?? '—'}</td>
                    <td className="px-4 py-3">Table {r.restaurant_tables?.table_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtTime(r.reservation_time)}</td>
                    <td className="px-4 py-3">{r.duration_minutes} min</td>
                    <td className="px-4 py-3">{r.party_size}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      {msg?.id === r.id && (
                        <p className={`text-xs mb-1 ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
                      )}
                      <div className="flex gap-1">
                        {actions.map(({ label, next }) => (
                          <button key={next} onClick={() => updateTableStatus(r.id, next)}
                            className={`text-xs px-2.5 py-1 rounded-lg border whitespace-nowrap ${
                              next === 'cancelled'
                                ? 'border-[#e8b4b4] text-[#9e3535] hover:bg-[#fdf2f2]'
                                : 'border-[#f0c8aa] text-terra hover:bg-terra-light'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
