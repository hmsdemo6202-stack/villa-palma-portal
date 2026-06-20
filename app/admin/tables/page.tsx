'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type RestaurantTable = {
  id: string
  table_number: string
  capacity: number
  status: 'available' | 'occupied' | 'reserved'
}

const emptyTable: Omit<RestaurantTable, 'id'> = { table_number: '', capacity: 2, status: 'available' }

export default function AdminTablesPage() {
  const supabase = createClient()
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [form, setForm] = useState<Omit<RestaurantTable, 'id'>>(emptyTable)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('restaurant_tables').select('*').order('table_number')
    setTables(data ?? [])
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const payload = { ...form, capacity: Number(form.capacity) }
    const { error: err } = editId
      ? await supabase.from('restaurant_tables').update(payload).eq('id', editId)
      : await supabase.from('restaurant_tables').insert(payload)
    if (err) { setError(err.message); return }
    setForm(emptyTable); setEditId(null); setShowForm(false)
    load()
  }

  function startEdit(t: RestaurantTable) {
    setForm({ table_number: t.table_number, capacity: t.capacity, status: t.status })
    setEditId(t.id); setShowForm(true)
  }

  async function remove(id: string) {
    if (!confirm('Delete this table?')) return
    const { error: err } = await supabase.from('restaurant_tables').delete().eq('id', id)
    if (err) { setError(err.message); return }
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Restaurant Tables</h1>
        <button onClick={() => { setForm(emptyTable); setEditId(null); setShowForm(v => !v) }}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
          {showForm && !editId ? 'Cancel' : '+ Add Table'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">{error}</p>}

      {showForm && (
        <form onSubmit={save} className="bg-gray-50 border rounded-lg p-4 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Table Number *</label>
            <input required value={form.table_number}
              onChange={e => setForm(f => ({ ...f, table_number: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. T1" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Capacity (seats) *</label>
            <input required type="number" min={1} value={form.capacity}
              onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Status</label>
            <select value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as RestaurantTable['status'] }))}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
            </select>
          </div>
          <div className="col-span-3 flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              {editId ? 'Update Table' : 'Add Table'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyTable) }}
              className="border px-4 py-2 rounded text-sm hover:bg-gray-100">Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border rounded-lg overflow-hidden">
          <thead className="bg-gray-100 text-left">
            <tr>
              {['Table #', 'Capacity', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-2 font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {tables.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No tables yet.</td></tr>
            )}
            {tables.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{t.table_number}</td>
                <td className="px-4 py-2">{t.capacity} seats</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    t.status === 'available' ? 'bg-green-100 text-green-700' :
                    t.status === 'occupied' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button onClick={() => startEdit(t)} className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => remove(t.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
