'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'reserved' | 'dirty' | 'cleaning' | 'inspection'

type Room = {
  id: string
  room_number: string
  floor: number | null
  status: RoomStatus
  housekeeper_name: string | null
  cleaning_started_at: string | null
  cleaning_finished_at: string | null
  room_types: { name: string } | null
}

const STATUS_COLORS: Record<RoomStatus, string> = {
  available:   'bg-green-100 text-green-700 border-green-200',
  occupied:    'bg-red-100 text-red-700 border-red-200',
  reserved:    'bg-yellow-100 text-yellow-700 border-yellow-200',
  maintenance: 'bg-gray-100 text-gray-500 border-gray-200',
  dirty:       'bg-orange-100 text-orange-700 border-orange-200',
  cleaning:    'bg-blue-100 text-blue-700 border-blue-200',
  inspection:  'bg-purple-100 text-purple-700 border-purple-200',
}

const STATUS_LABELS: Record<RoomStatus, string> = {
  available: 'Available', occupied: 'Occupied', maintenance: 'Maintenance',
  reserved: 'Reserved', dirty: 'Dirty', cleaning: 'Cleaning', inspection: 'Inspection',
}

const FILTERS: (RoomStatus | 'all')[] = ['all', 'dirty', 'cleaning', 'inspection', 'occupied', 'available', 'maintenance', 'reserved']

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

export default function HousekeepingPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RoomStatus | 'all'>('all')
  const [active, setActive] = useState<Room | null>(null)
  const [housekeeperInput, setHousekeeperInput] = useState('')
  const [statusInput, setStatusInput] = useState<RoomStatus>('dirty')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('rooms')
      .select('id, room_number, floor, status, housekeeper_name, cleaning_started_at, cleaning_finished_at, room_types(name)')
      .order('room_number')
    setRooms((data as unknown as Room[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function openRoom(room: Room) {
    setActive(room)
    setHousekeeperInput(room.housekeeper_name ?? '')
    setStatusInput(room.status)
  }

  async function save() {
    if (!active) return
    setSaving(true)

    const payload: Partial<Room> = {
      status: statusInput,
      housekeeper_name: housekeeperInput || null,
    }

    // Stamp cleaning start/finish as the status moves through the workflow.
    if (statusInput === 'cleaning' && !active.cleaning_started_at) {
      payload.cleaning_started_at = new Date().toISOString()
    }
    if (active.status === 'cleaning' && statusInput !== 'cleaning' && !active.cleaning_finished_at) {
      payload.cleaning_finished_at = new Date().toISOString()
    }
    if (statusInput === 'dirty') {
      payload.cleaning_started_at = null
      payload.cleaning_finished_at = null
    }

    const { error } = await supabase.from('rooms').update(payload).eq('id', active.id)
    setSaving(false)
    if (!error) {
      setActive(null)
      load()
    }
  }

  const counts = FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f] = f === 'all' ? rooms.length : rooms.filter(r => r.status === f).length
    return acc
  }, {})

  const visible = filter === 'all' ? rooms : rooms.filter(r => r.status === filter)

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-brown">Housekeeping</h1>
        <p className="text-sm text-gray-500 mt-0.5">Room cleaning status board</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f ? 'bg-terra text-white border-terra' : 'border-warm-border text-gray-500 hover:border-terra bg-white'
            }`}>
            {f === 'all' ? 'All' : STATUS_LABELS[f]} ({counts[f] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading rooms…</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No rooms with this status.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {visible.map(room => (
            <button key={room.id} onClick={() => openRoom(room)}
              className="text-left bg-white border border-warm-border rounded-xl p-4 hover:border-terra transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-brown text-lg">{room.room_number}</p>
                  <p className="text-xs text-gray-400">{room.room_types?.name ?? '—'} · Floor {room.floor ?? '—'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[room.status]}`}>
                  {STATUS_LABELS[room.status]}
                </span>
              </div>
              {room.housekeeper_name && (
                <p className="text-xs text-gray-500 mt-2">🧹 {room.housekeeper_name}</p>
              )}
              {room.status === 'cleaning' && room.cleaning_started_at && (
                <p className="text-[11px] text-gray-400 mt-1">Started {fmtTime(room.cleaning_started_at)}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setActive(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-brown">Room {active.room_number}</h2>
                <p className="text-xs text-gray-400">{active.room_types?.name ?? '—'} · Floor {active.floor ?? '—'}</p>
              </div>
              <button onClick={() => setActive(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 mb-1">Started</p>
                <p className="font-semibold text-brown">{fmtTime(active.cleaning_started_at)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 mb-1">Finished</p>
                <p className="font-semibold text-brown">{fmtTime(active.cleaning_finished_at)}</p>
              </div>
            </div>

            <label className="block text-xs font-medium mb-1">Housekeeper</label>
            <input value={housekeeperInput} onChange={e => setHousekeeperInput(e.target.value)}
              placeholder="e.g. Maria"
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-terra" />

            <label className="block text-xs font-medium mb-1.5">Change Status</label>
            <div className="space-y-2 mb-5">
              {(['dirty', 'cleaning', 'inspection', 'available', 'maintenance'] as RoomStatus[]).map(s => (
                <label key={s} className="flex items-center gap-2.5 border border-warm-border rounded-lg px-3 py-2 text-sm cursor-pointer">
                  <input type="radio" name="status" value={s} checked={statusInput === s}
                    onChange={() => setStatusInput(s)} className="accent-terra" />
                  {STATUS_LABELS[s]}
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={save} disabled={saving}
                className="flex-1 bg-terra text-white py-2.5 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setActive(null)} className="border border-warm-border px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
