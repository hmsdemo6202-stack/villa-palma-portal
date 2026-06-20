'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Table = {
  id: string
  table_number: string
  capacity: number
  status: string
}

type ReserveForm = {
  date: string
  time: string
  party_size: number
  duration_minutes: number
}

function todayStr() { return new Date().toISOString().split('T')[0] }

const inputClass = "w-full border border-warm-border rounded-lg px-2.5 py-1.5 text-sm bg-white text-brown focus:outline-none focus:ring-2 focus:ring-terra focus:border-terra transition-colors"

export default function RestaurantTablesPage() {
  const supabase = createClient()
  const [tables, setTables] = useState<Table[]>([])
  const [activeTable, setActiveTable] = useState<string | null>(null)
  const [form, setForm] = useState<ReserveForm>({ date: todayStr(), time: '12:00', party_size: 2, duration_minutes: 90 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('restaurant_tables').select('*').order('table_number')
    setTables(data ?? [])
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function reserve(tableId: string, capacity: number) {
    if (form.party_size > capacity) {
      setError(`Party size exceeds table capacity of ${capacity}.`); return
    }
    setLoading(true); setError(null); setSuccess(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const reservationTime = `${form.date}T${form.time}:00`

    const { error: err } = await supabase.from('table_reservations').insert({
      user_id: user.id,
      table_id: tableId,
      reservation_time: reservationTime,
      duration_minutes: form.duration_minutes,
      party_size: form.party_size,
      status: 'pending',
    })

    if (err) {
      setError(err.code === '23P01'
        ? 'That table is already reserved for that time slot. Try a different time.'
        : err.message)
    } else {
      setSuccess('Table reserved! Check My Activity to view your reservation.')
      setActiveTable(null)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-[10px] font-bold text-brown-light uppercase tracking-[0.25em] mb-1">Dining</p>
          <h1 className="font-serif text-2xl font-bold text-brown">Reserve a Table</h1>
          <p className="text-brown-mid text-sm mt-2">
            Choose your table and preferred time. Default duration is 90 minutes.
          </p>
        </div>

        {success && (
          <div className="bg-[#f0f7f2] border border-[#a3ccb3] text-[#2a5c3a] rounded-xl px-5 py-4 text-sm mb-6">
            {success}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map(table => (
            <div key={table.id} className="bg-white border border-warm-border rounded-xl p-5 shadow-sm hover:border-terra hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-serif font-bold text-xl text-brown">Table {table.table_number}</p>
                  <p className="text-sm text-brown-mid mt-0.5">{table.capacity} seats</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                  table.status === 'available'
                    ? 'bg-[#f0f7f2] text-[#2e6b4a] border-[#a3ccb3]'
                    : table.status === 'occupied'
                    ? 'bg-[#fdf2f2] text-[#7a2020] border-[#e8b4b4]'
                    : 'bg-[#fdf6e8] text-[#7a5010] border-[#e8c87a]'
                }`}>
                  {table.status}
                </span>
              </div>

              {activeTable !== table.id ? (
                <button
                  onClick={() => { setActiveTable(table.id); setError(null); setSuccess(null) }}
                  className="w-full border border-terra text-terra rounded-lg py-2 text-sm hover:bg-terra-light font-medium transition-colors">
                  Reserve this table
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-brown-light uppercase tracking-wide mb-1">Date</label>
                      <input type="date" value={form.date} min={todayStr()}
                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-brown-light uppercase tracking-wide mb-1">Time</label>
                      <input type="time" value={form.time}
                        onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-brown-light uppercase tracking-wide mb-1">Party size</label>
                      <input type="number" min={1} max={table.capacity} value={form.party_size}
                        onChange={e => setForm(f => ({ ...f, party_size: +e.target.value }))}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-brown-light uppercase tracking-wide mb-1">Duration (min)</label>
                      <input type="number" min={30} step={30} value={form.duration_minutes}
                        onChange={e => setForm(f => ({ ...f, duration_minutes: +e.target.value }))}
                        className={inputClass} />
                    </div>
                  </div>
                  {error && (
                    <div className="bg-[#fdf2f2] border border-[#e8b4b4] text-[#7a2020] rounded-lg px-3 py-2 text-xs">
                      {error}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => reserve(table.id, table.capacity)} disabled={loading}
                      className="flex-1 bg-terra text-white rounded-lg py-2 text-sm hover:bg-terra-dark disabled:opacity-50 font-medium transition-colors">
                      {loading ? 'Reserving…' : 'Confirm'}
                    </button>
                    <button onClick={() => { setActiveTable(null); setError(null) }}
                      className="border border-warm-border rounded-lg px-3 py-2 text-sm text-brown-mid hover:bg-cream-dark transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {tables.length === 0 && (
            <p className="text-brown-light col-span-3 text-center py-16">No tables available yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
