'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type RoomType = {
  id: string
  name: string
  description: string
  base_price: number
  capacity: number
  image_url: string
}

type Room = {
  id: string
  room_number: string
  room_type_id: string
  floor: number | null
  status: 'available' | 'occupied' | 'maintenance'
}

const emptyType: Omit<RoomType, 'id'> = { name: '', description: '', base_price: 0, capacity: 1, image_url: '' }
const emptyRoom: Omit<Room, 'id'> = { room_number: '', room_type_id: '', floor: null, status: 'available' }

export default function AdminRoomsPage() {
  const supabase = createClient()

  const [types, setTypes] = useState<RoomType[]>([])
  const [typeForm, setTypeForm] = useState<Omit<RoomType, 'id'>>(emptyType)
  const [typeEditId, setTypeEditId] = useState<string | null>(null)
  const [showTypeForm, setShowTypeForm] = useState(false)

  const [rooms, setRooms] = useState<Room[]>([])
  const [roomForm, setRoomForm] = useState<Omit<Room, 'id'>>(emptyRoom)
  const [roomEditId, setRoomEditId] = useState<string | null>(null)
  const [showRoomForm, setShowRoomForm] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const loadTypes = useCallback(async () => {
    const { data } = await supabase.from('room_types').select('*').order('name')
    setTypes(data ?? [])
  }, [supabase])

  const loadRooms = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').order('room_number')
    setRooms(data ?? [])
  }, [supabase])

  useEffect(() => { loadTypes(); loadRooms() }, [loadTypes, loadRooms])

  async function saveType(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const payload = { ...typeForm, base_price: Number(typeForm.base_price), capacity: Number(typeForm.capacity) }
    const { error: err } = typeEditId
      ? await supabase.from('room_types').update(payload).eq('id', typeEditId)
      : await supabase.from('room_types').insert(payload)
    if (err) { setError(err.message); return }
    setTypeForm(emptyType); setTypeEditId(null); setShowTypeForm(false)
    loadTypes()
  }

  function editType(t: RoomType) {
    setTypeForm({ name: t.name, description: t.description ?? '', base_price: t.base_price, capacity: t.capacity, image_url: t.image_url ?? '' })
    setTypeEditId(t.id); setShowTypeForm(true)
  }

  async function deleteType(id: string) {
    if (!confirm('Delete this room type? Any rooms using it will also be affected.')) return
    const { error: err } = await supabase.from('room_types').delete().eq('id', id)
    if (err) { setError(err.message); return }
    loadTypes()
  }

  async function saveRoom(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const payload = { ...roomForm, floor: roomForm.floor !== null ? Number(roomForm.floor) : null }
    const { error: err } = roomEditId
      ? await supabase.from('rooms').update(payload).eq('id', roomEditId)
      : await supabase.from('rooms').insert(payload)
    if (err) { setError(err.message); return }
    setRoomForm(emptyRoom); setRoomEditId(null); setShowRoomForm(false)
    loadRooms()
  }

  function editRoom(r: Room) {
    setRoomForm({ room_number: r.room_number, room_type_id: r.room_type_id, floor: r.floor, status: r.status })
    setRoomEditId(r.id); setShowRoomForm(true)
  }

  async function deleteRoom(id: string) {
    if (!confirm('Delete this room?')) return
    const { error: err } = await supabase.from('rooms').delete().eq('id', id)
    if (err) { setError(err.message); return }
    loadRooms()
  }

  const typeById = Object.fromEntries(types.map(t => [t.id, t.name]))

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">Rooms</h1>
      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">{error}</p>}

      {/* Room Types */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Room Types</h2>
          <button onClick={() => { setTypeForm(emptyType); setTypeEditId(null); setShowTypeForm(v => !v) }}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            {showTypeForm && !typeEditId ? 'Cancel' : '+ Add Type'}
          </button>
        </div>

        {showTypeForm && (
          <form onSubmit={saveType} className="mb-4 bg-gray-50 border rounded-lg p-4 grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium mb-1">Name *</label>
              <input required value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Standard Double" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium mb-1">Capacity *</label>
              <input required type="number" min={1} value={typeForm.capacity}
                onChange={e => setTypeForm(f => ({ ...f, capacity: +e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium mb-1">Base Price / night (₱) *</label>
              <input required type="number" min={0} step="0.01" value={typeForm.base_price}
                onChange={e => setTypeForm(f => ({ ...f, base_price: +e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium mb-1">Image URL</label>
              <input value={typeForm.image_url} onChange={e => setTypeForm(f => ({ ...f, image_url: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Description</label>
              <textarea value={typeForm.description} onChange={e => setTypeForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                {typeEditId ? 'Update Type' : 'Add Type'}
              </button>
              <button type="button" onClick={() => { setShowTypeForm(false); setTypeEditId(null); setTypeForm(emptyType) }}
                className="border px-4 py-2 rounded text-sm hover:bg-gray-100">Cancel</button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-gray-100 text-left">
              <tr>
                {['Name', 'Capacity', 'Base Price', 'Description', ''].map(h => (
                  <th key={h} className="px-4 py-2 font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {types.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No room types yet.</td></tr>
              )}
              {types.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  <td className="px-4 py-2">{t.capacity}</td>
                  <td className="px-4 py-2">₱{Number(t.base_price).toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-500 max-w-xs truncate">{t.description}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => editType(t)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => deleteType(t.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Individual Rooms */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Individual Rooms</h2>
          <button onClick={() => { setRoomForm(emptyRoom); setRoomEditId(null); setShowRoomForm(v => !v) }}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
            disabled={types.length === 0}>
            {showRoomForm && !roomEditId ? 'Cancel' : '+ Add Room'}
          </button>
        </div>
        {types.length === 0 && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3 mb-3">
            Add at least one room type above before creating rooms.
          </p>
        )}

        {showRoomForm && (
          <form onSubmit={saveRoom} className="mb-4 bg-gray-50 border rounded-lg p-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Room Number *</label>
              <input required value={roomForm.room_number}
                onChange={e => setRoomForm(f => ({ ...f, room_number: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. 101" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Floor</label>
              <input type="number" value={roomForm.floor ?? ''}
                onChange={e => setRoomForm(f => ({ ...f, floor: e.target.value ? +e.target.value : null }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="1" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Room Type *</label>
              <select required value={roomForm.room_type_id}
                onChange={e => setRoomForm(f => ({ ...f, room_type_id: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="">Select type…</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status *</label>
              <select value={roomForm.status}
                onChange={e => setRoomForm(f => ({ ...f, status: e.target.value as Room['status'] }))}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                {roomEditId ? 'Update Room' : 'Add Room'}
              </button>
              <button type="button" onClick={() => { setShowRoomForm(false); setRoomEditId(null); setRoomForm(emptyRoom) }}
                className="border px-4 py-2 rounded text-sm hover:bg-gray-100">Cancel</button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-gray-100 text-left">
              <tr>
                {['Room #', 'Type', 'Floor', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2 font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rooms.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No rooms yet.</td></tr>
              )}
              {rooms.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.room_number}</td>
                  <td className="px-4 py-2">{typeById[r.room_type_id] ?? '—'}</td>
                  <td className="px-4 py-2">{r.floor ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === 'available' ? 'bg-green-100 text-green-700' :
                      r.status === 'occupied' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => editRoom(r)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => deleteRoom(r.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
