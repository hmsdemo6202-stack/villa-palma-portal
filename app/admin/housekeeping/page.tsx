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

type LostItem = {
  id: string
  item_name: string
  description: string | null
  location: string | null
  room_id: string | null
  found_by: string | null
  found_date: string
  status: 'found' | 'claimed' | 'donated' | 'discarded'
  guest_id: string | null
  claimed_at: string | null
  created_at: string
  rooms: { room_number: string } | null
}

type LostForm = {
  item_name: string
  description: string
  location: string
  room_id: string
  found_date: string
  status: LostItem['status']
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

const LAF_COLORS: Record<LostItem['status'], string> = {
  found:     'bg-yellow-100 text-yellow-700',
  claimed:   'bg-green-100 text-green-700',
  donated:   'bg-blue-100 text-blue-700',
  discarded: 'bg-gray-100 text-gray-500',
}

const FILTERS: (RoomStatus | 'all')[] = ['all', 'dirty', 'cleaning', 'inspection', 'occupied', 'available', 'maintenance', 'reserved']

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function emptyLafForm(): LostForm {
  return { item_name: '', description: '', location: '', room_id: '', found_date: new Date().toISOString().split('T')[0], status: 'found' }
}

type Tab = 'rooms' | 'lostfound'

export default function HousekeepingPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('rooms')

  // Rooms
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [filter, setFilter] = useState<RoomStatus | 'all'>('all')
  const [active, setActive] = useState<Room | null>(null)
  const [housekeeperInput, setHousekeeperInput] = useState('')
  const [statusInput, setStatusInput] = useState<RoomStatus>('dirty')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Lost & Found
  const [items, setItems] = useState<LostItem[]>([])
  const [lafLoading, setLafLoading] = useState(true)
  const [lafFilter, setLafFilter] = useState<LostItem['status'] | 'all'>('all')
  const [showLafForm, setShowLafForm] = useState(false)
  const [lafEditId, setLafEditId] = useState<string | null>(null)
  const [lafForm, setLafForm] = useState<LostForm>(emptyLafForm())
  const [lafSaving, setLafSaving] = useState(false)
  const [lafError, setLafError] = useState<string | null>(null)
  const [lafSuccess, setLafSuccess] = useState<string | null>(null)

  const loadRooms = useCallback(async () => {
    const { data } = await supabase
      .from('rooms')
      .select('id, room_number, floor, status, housekeeper_name, cleaning_started_at, cleaning_finished_at, room_types(name)')
      .order('room_number')
    setRooms((data as unknown as Room[]) ?? [])
    setRoomsLoading(false)
  }, [supabase])

  const loadLaf = useCallback(async () => {
    const { data } = await supabase
      .from('lost_and_found')
      .select('*, rooms(room_number)')
      .order('found_date', { ascending: false })
    setItems((data as unknown as LostItem[]) ?? [])
    setLafLoading(false)
  }, [supabase])

  useEffect(() => { loadRooms() }, [loadRooms])
  useEffect(() => { if (tab === 'lostfound') loadLaf() }, [tab, loadLaf])

  function openRoom(room: Room) {
    setActive(room)
    setHousekeeperInput(room.housekeeper_name ?? '')
    setStatusInput(room.status)
    setSaveError(null)
  }

  async function saveRoomStatus() {
    if (!active) return
    setSaving(true)

    const payload: Partial<Room> = {
      status: statusInput,
      housekeeper_name: housekeeperInput || null,
    }

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
    if (error) {
      setSaveError(error.message)
    } else {
      setSaveError(null)
      setActive(null)
      loadRooms()
    }
  }

  function lafFlash(msg: string, ok = true) {
    if (ok) { setLafSuccess(msg); setLafError(null) }
    else { setLafError(msg); setLafSuccess(null) }
    setTimeout(() => { setLafSuccess(null); setLafError(null) }, 4000)
  }

  async function handleLafSave(e: React.FormEvent) {
    e.preventDefault()
    setLafSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      item_name:   lafForm.item_name,
      description: lafForm.description  || null,
      location:    lafForm.location     || null,
      room_id:     lafForm.room_id      || null,
      found_date:  lafForm.found_date,
      status:      lafForm.status,
      found_by:    lafEditId ? undefined : (user?.id ?? null),
    }
    const { error: err } = lafEditId
      ? await supabase.from('lost_and_found').update(payload).eq('id', lafEditId)
      : await supabase.from('lost_and_found').insert(payload)
    if (err) { lafFlash(err.message, false); setLafSaving(false); return }
    lafFlash(lafEditId ? 'Item updated.' : 'Item logged.')
    setLafSaving(false); setShowLafForm(false); setLafEditId(null); setLafForm(emptyLafForm())
    loadLaf()
  }

  async function handleLafDelete(id: string, name: string) {
    if (!confirm(`Delete log entry for "${name}"?`)) return
    await supabase.from('lost_and_found').delete().eq('id', id)
    lafFlash('Entry deleted.')
    loadLaf()
  }

  const counts = FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f] = f === 'all' ? rooms.length : rooms.filter(r => r.status === f).length
    return acc
  }, {})

  const visible = filter === 'all' ? rooms : rooms.filter(r => r.status === filter)
  const visibleItems = lafFilter === 'all' ? items : items.filter(i => i.status === lafFilter)

  const lafCounts = {
    all:      items.length,
    found:    items.filter(i => i.status === 'found').length,
    claimed:  items.filter(i => i.status === 'claimed').length,
    donated:  items.filter(i => i.status === 'donated').length,
    discarded:items.filter(i => i.status === 'discarded').length,
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-brown">Housekeeping</h1>
        <p className="text-sm text-gray-500 mt-0.5">Room status board and lost &amp; found</p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-2 border-b border-warm-border">
        {([['rooms', '🧹 Rooms'], ['lostfound', '📦 Lost & Found']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key ? 'border-terra text-terra' : 'border-transparent text-gray-500 hover:text-brown'}`}>
            {label}
            {key === 'lostfound' && lafCounts.found > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px]">
                {lafCounts.found}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Rooms Tab ── */}
      {tab === 'rooms' && (
        <>
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

          {roomsLoading ? (
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

                {saveError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs mb-1">
                    <p className="font-semibold mb-0.5">Update failed</p>
                    <p>{saveError}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={saveRoomStatus} disabled={saving}
                    className="flex-1 bg-terra text-white py-2.5 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setActive(null); setSaveError(null) }} className="border border-warm-border px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Lost & Found Tab ── */}
      {tab === 'lostfound' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1 flex-wrap">
              {(['all', 'found', 'claimed', 'donated', 'discarded'] as const).map(s => (
                <button key={s} onClick={() => setLafFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    lafFilter === s ? 'bg-terra text-white border-terra' : 'border-warm-border text-gray-600 bg-white hover:border-terra'}`}>
                  {s === 'all' ? `All (${lafCounts.all})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${lafCounts[s]})`}
                </button>
              ))}
            </div>
            <button onClick={() => { setLafForm(emptyLafForm()); setLafEditId(null); setShowLafForm(true) }}
              className="bg-terra text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark transition-colors">
              + Log Item
            </button>
          </div>

          {lafError   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{lafError}</div>}
          {lafSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{lafSuccess}</div>}

          {showLafForm && (
            <form onSubmit={handleLafSave} className="bg-white border border-warm-border rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-brown text-sm">{lafEditId ? 'Edit Item' : 'Log Found Item'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Item Name *</label>
                  <input required value={lafForm.item_name} onChange={e => setLafForm(f => ({ ...f, item_name: e.target.value }))}
                    className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                    placeholder="Black umbrella, phone charger…" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Found Date</label>
                  <input type="date" value={lafForm.found_date} onChange={e => setLafForm(f => ({ ...f, found_date: e.target.value }))}
                    className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location / Room</label>
                  <input value={lafForm.location} onChange={e => setLafForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                    placeholder="e.g. Room 205, Restaurant, Lobby" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={lafForm.status} onChange={e => setLafForm(f => ({ ...f, status: e.target.value as LostItem['status'] }))}
                    className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                    <option value="found">Found</option>
                    <option value="claimed">Claimed</option>
                    <option value="donated">Donated</option>
                    <option value="discarded">Discarded</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-gray-400">(optional)</span></label>
                  <input value={lafForm.description} onChange={e => setLafForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                    placeholder="Color, brand, distinguishing marks…" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={lafSaving}
                  className="bg-terra text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
                  {lafSaving ? 'Saving…' : lafEditId ? 'Save Changes' : 'Log Item'}
                </button>
                <button type="button" onClick={() => { setShowLafForm(false); setLafEditId(null); setLafForm(emptyLafForm()) }}
                  className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          )}

          {lafLoading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : visibleItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">📦</p>
              <p>{lafFilter === 'all' ? 'No lost items logged yet.' : `No items with status "${lafFilter}".`}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-warm-border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>{['Item', 'Location', 'Found', 'Description', 'Status', 'Actions'].map(h =>
                    <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {visibleItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-brown">{item.item_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {item.location ?? (item.rooms?.room_number ? `Room ${item.rooms.room_number}` : '—')}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(item.found_date)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">{item.description ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LAF_COLORS[item.status]}`}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => { setLafForm({ item_name: item.item_name, description: item.description ?? '', location: item.location ?? '', room_id: item.room_id ?? '', found_date: item.found_date, status: item.status }); setLafEditId(item.id); setShowLafForm(true) }}
                            className="text-xs border text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                          <button onClick={() => handleLafDelete(item.id, item.item_name)}
                            className="text-xs text-red-500 hover:underline">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
