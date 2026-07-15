'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import RoomPhotoManager from '@/components/RoomPhotoManager'
import RetryImg from '@/components/RetryImg'

type RoomType = {
  id: string
  name: string
  description: string
  base_price: number
  capacity: number
  amenities: string
  image_url: string
}

type Room = {
  id: string
  room_number: string
  room_type_id: string
  floor: number | null
  status: 'available' | 'occupied' | 'maintenance' | 'reserved' | 'dirty' | 'cleaning' | 'inspection'
  bed_type: string | null
  is_smoking: boolean
  description: string
  room_types: { name: string; base_price: number } | null
}

const STATUS_COLORS: Record<string, string> = {
  available:   'bg-green-100 text-green-700',
  occupied:    'bg-red-100 text-red-700',
  reserved:    'bg-yellow-100 text-yellow-700',
  maintenance: 'bg-gray-100 text-gray-500',
  dirty:       'bg-orange-100 text-orange-700',
  cleaning:    'bg-blue-100 text-blue-700',
  inspection:  'bg-purple-100 text-purple-700',
}

const emptyType: Omit<RoomType, 'id'> = { name: '', description: '', base_price: 0, capacity: 1, amenities: '', image_url: '' }
const BED_TYPES = ['Single', 'Twin', 'Double', 'Queen', 'King', 'Suite King', 'Bunk']

const STATUS_LABELS: Record<string, string> = {
  available:   'Available',
  occupied:    'Occupied',
  reserved:    'Reserved',
  dirty:       'Dirty',
  cleaning:    'Cleaning',
  inspection:  'Inspection',
  maintenance: 'Maintenance',
}

const emptyRoom: Omit<Room, 'id' | 'room_types'> = {
  room_number: '', room_type_id: '', floor: null,
  status: 'available', bed_type: null, is_smoking: false, description: '',
}

export default function AdminRoomsPage() {
  const supabase = createClient()

  const [types, setTypes] = useState<RoomType[]>([])
  const [typeForm, setTypeForm] = useState<Omit<RoomType, 'id'>>(emptyType)
  const [typeEditId, setTypeEditId] = useState<string | null>(null)
  const [showTypeForm, setShowTypeForm] = useState(false)

  const [rooms, setRooms] = useState<Room[]>([])
  const [roomForm, setRoomForm] = useState<Omit<Room, 'id' | 'room_types'>>(emptyRoom)
  const [roomEditId, setRoomEditId] = useState<string | null>(null)
  const [showRoomForm, setShowRoomForm] = useState(false)

  const [photosFor, setPhotosFor] = useState<{ id: string; name: string } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadTypes = useCallback(async () => {
    const { data } = await supabase.from('room_types').select('*').order('name')
    setTypes(data ?? [])
  }, [supabase])

  const loadRooms = useCallback(async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*, room_types(name, base_price)')
      .order('room_number')
    setRooms((data as Room[]) ?? [])
  }, [supabase])

  useEffect(() => { loadTypes(); loadRooms() }, [loadTypes, loadRooms])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  // ── Room Types ──────────────────────────────────────────────

  async function saveType(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...typeForm, base_price: Number(typeForm.base_price), capacity: Number(typeForm.capacity) }
    const { error: err } = typeEditId
      ? await supabase.from('room_types').update(payload).eq('id', typeEditId)
      : await supabase.from('room_types').insert(payload)
    if (err) { flash(err.message, false); return }
    flash(typeEditId ? 'Room type updated.' : 'Room type added.')
    setTypeForm(emptyType); setTypeEditId(null); setShowTypeForm(false)
    loadTypes()
  }

  async function deleteType(id: string, name: string) {
    if (!confirm(`Delete room type "${name}"? Rooms using this type will lose their type link.`)) return
    const { error: err } = await supabase.from('room_types').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Room type deleted.')
    loadTypes()
  }

  function editType(t: RoomType) {
    setTypeForm({ name: t.name, description: t.description, base_price: t.base_price, capacity: t.capacity, amenities: t.amenities, image_url: t.image_url })
    setTypeEditId(t.id); setShowTypeForm(true); setShowRoomForm(false)
  }

  // ── Rooms ───────────────────────────────────────────────────

  async function saveRoom(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...roomForm, floor: roomForm.floor ? Number(roomForm.floor) : null }
    const { error: err } = roomEditId
      ? await supabase.from('rooms').update(payload).eq('id', roomEditId)
      : await supabase.from('rooms').insert(payload)
    if (err) { flash(err.message, false); return }
    flash(roomEditId ? 'Room updated.' : 'Room added.')
    setRoomForm(emptyRoom); setRoomEditId(null); setShowRoomForm(false)
    loadRooms()
  }

  async function deleteRoom(id: string, number: string) {
    if (!confirm(`Delete room ${number}?`)) return
    const { error: err } = await supabase.from('rooms').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Room deleted.')
    loadRooms()
  }

  async function updateStatus(id: string, status: Room['status']) {
    const { error: err } = await supabase.from('rooms').update({ status }).eq('id', id)
    if (err) { flash(err.message, false); return }
    loadRooms()
  }

  function editRoom(r: Room) {
    setRoomForm({
      room_number: r.room_number, room_type_id: r.room_type_id, floor: r.floor,
      status: r.status, bed_type: r.bed_type, is_smoking: r.is_smoking, description: r.description,
    })
    setRoomEditId(r.id); setShowRoomForm(true); setShowTypeForm(false)
  }

  const available   = rooms.filter(r => r.status === 'available').length
  const occupied    = rooms.filter(r => r.status === 'occupied').length
  const reserved    = rooms.filter(r => r.status === 'reserved').length
  const maintenance = rooms.filter(r => r.status === 'maintenance').length
  const dirty       = rooms.filter(r => r.status === 'dirty').length
  const cleaning    = rooms.filter(r => r.status === 'cleaning').length
  const inspection  = rooms.filter(r => r.status === 'inspection').length

  return (
    <div className="space-y-10 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-brown">Rooms</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {rooms.length} total &middot; {available} available &middot; {occupied} occupied &middot; {reserved} reserved
          {dirty > 0 ? ` · ${dirty} dirty` : ''}{cleaning > 0 ? ` · ${cleaning} cleaning` : ''}
          {inspection > 0 ? ` · ${inspection} inspection` : ''}{maintenance > 0 ? ` · ${maintenance} maintenance` : ''}
        </p>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {/* ── Room Types ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-brown">Room Types</h2>
          <button onClick={() => { setTypeForm(emptyType); setTypeEditId(null); setShowTypeForm(v => !v); setShowRoomForm(false) }}
            className="text-sm bg-terra text-white px-3 py-1.5 rounded-lg hover:bg-terra-dark transition-colors">
            {showTypeForm && !typeEditId ? 'Cancel' : '+ Add Type'}
          </button>
        </div>

        {showTypeForm && (
          <form onSubmit={saveType} className="mb-4 bg-white border border-warm-border rounded-xl p-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium mb-1">Type Name *</label>
              <input required value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Deluxe Double" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Base Price (₱) *</label>
              <input required type="number" min={0} step="0.01" value={typeForm.base_price}
                onChange={e => setTypeForm(f => ({ ...f, base_price: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Capacity (pax) *</label>
              <input required type="number" min={1} value={typeForm.capacity}
                onChange={e => setTypeForm(f => ({ ...f, capacity: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-xs font-medium mb-1">Description</label>
              <input value={typeForm.description} onChange={e => setTypeForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Brief description" />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-xs font-medium mb-1">Amenities</label>
              <input value={typeForm.amenities} onChange={e => setTypeForm(f => ({ ...f, amenities: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. AC, TV, Hot shower, WiFi" />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-xs font-medium mb-1">Image URL</label>
              <div className="flex gap-2 items-start">
                <input value={typeForm.image_url} onChange={e => setTypeForm(f => ({ ...f, image_url: e.target.value }))}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
                {typeForm.image_url && (
                  <img src={typeForm.image_url} alt="preview"
                    className="w-16 h-12 object-cover rounded-lg border border-warm-border flex-shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-3 flex gap-2">
              <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
                {typeEditId ? 'Update Type' : 'Add Type'}
              </button>
              <button type="button" onClick={() => { setShowTypeForm(false); setTypeEditId(null); setTypeForm(emptyType) }}
                className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-xl border border-warm-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>{['Image', 'Type', 'Base Price', 'Capacity', 'Amenities', 'Actions'].map(h =>
                <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {types.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No room types yet.</td></tr>}
              {types.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {t.image_url
                      ? <RetryImg src={t.image_url} alt={t.name} className="w-14 h-10 object-cover rounded-lg border border-warm-border" />
                      : <div className="w-14 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-xs">No img</div>}
                  </td>
                  <td className="px-4 py-3 font-medium text-brown">{t.name}</td>
                  <td className="px-4 py-3">₱{Number(t.base_price).toLocaleString('en-PH')}</td>
                  <td className="px-4 py-3">{t.capacity} pax</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{t.amenities || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setPhotosFor({ id: t.id, name: t.name })} className="text-xs border text-terra px-2.5 py-1 rounded-lg hover:bg-terra-light/20">Photos</button>
                      <button onClick={() => editType(t)} className="text-xs border text-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                      <button onClick={() => deleteType(t.id, t.name)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Individual Rooms ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-brown">Individual Rooms</h2>
          <button onClick={() => { setRoomForm(emptyRoom); setRoomEditId(null); setShowRoomForm(v => !v); setShowTypeForm(false) }}
            className="text-sm bg-terra text-white px-3 py-1.5 rounded-lg hover:bg-terra-dark transition-colors">
            {showRoomForm && !roomEditId ? 'Cancel' : '+ Add Room'}
          </button>
        </div>

        {showRoomForm && (
          <form onSubmit={saveRoom} className="mb-4 bg-white border border-warm-border rounded-xl p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium mb-1">Room No. *</label>
              <input required value={roomForm.room_number} onChange={e => setRoomForm(f => ({ ...f, room_number: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="101" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Type *</label>
              <select required value={roomForm.room_type_id} onChange={e => setRoomForm(f => ({ ...f, room_type_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— Select —</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Floor</label>
              <input type="number" min={1} value={roomForm.floor ?? ''} onChange={e => setRoomForm(f => ({ ...f, floor: e.target.value ? +e.target.value : null }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="1" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select value={roomForm.status} onChange={e => setRoomForm(f => ({ ...f, status: e.target.value as Room['status'] }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Bed Type</label>
              <select value={roomForm.bed_type ?? ''} onChange={e => setRoomForm(f => ({ ...f, bed_type: e.target.value || null }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— Select —</option>
                {BED_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={roomForm.is_smoking}
                  onChange={e => setRoomForm(f => ({ ...f, is_smoking: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-terra" />
                Smoking room
              </label>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <label className="block text-xs font-medium mb-1">Notes</label>
              <input value={roomForm.description} onChange={e => setRoomForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional notes" />
            </div>
            <div className="col-span-2 sm:col-span-4 flex gap-2">
              <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
                {roomEditId ? 'Update Room' : 'Add Room'}
              </button>
              <button type="button" onClick={() => { setShowRoomForm(false); setRoomEditId(null); setRoomForm(emptyRoom) }}
                className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-xl border border-warm-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>{['Room', 'Type', 'Bed', 'Floor', 'Rate/Night', 'Status', 'Actions'].map(h =>
                <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {rooms.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No rooms yet.</td></tr>}
              {rooms.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-brown">{r.room_number}</span>
                    {r.is_smoking && <span className="ml-1.5 text-xs text-orange-400" title="Smoking room">🚬</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.room_types?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.bed_type ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.floor ?? '—'}</td>
                  <td className="px-4 py-3">{r.room_types ? '₱' + Number(r.room_types.base_price).toLocaleString('en-PH') : '—'}</td>
                  <td className="px-4 py-3">
                    <select value={r.status} onChange={e => updateStatus(r.id, e.target.value as Room['status'])}
                      className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[r.status]}`}>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 items-center">
                      <button onClick={() => editRoom(r)} className="text-xs border text-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                      <button onClick={() => deleteRoom(r.id, r.room_number)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {photosFor && (
        <RoomPhotoManager
          roomTypeId={photosFor.id}
          roomTypeName={photosFor.name}
          onClose={() => { setPhotosFor(null); loadTypes() }}
        />
      )}
    </div>
  )
}
