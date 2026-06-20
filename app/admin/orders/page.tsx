'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Order = {
  id: string
  status: string
  total: number
  created_at: string
  profiles: { full_name: string | null } | null
  restaurant_tables: { table_number: string } | null
  rooms: { room_number: string } | null
  order_items: {
    quantity: number
    price_at_order: number
    menu_items: { name: string } | null
  }[]
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  preparing: 'bg-orange-100 text-orange-800',
  served:    'bg-green-100 text-green-700',
  paid:      'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}

const ORDER_ACTIONS: Record<string, { label: string; next: string }[]> = {
  pending:   [{ label: 'Start Preparing', next: 'preparing' }, { label: 'Cancel', next: 'cancelled' }],
  preparing: [{ label: 'Mark Served', next: 'served' }],
  served:    [],
}

function fmt(d: string) {
  return new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminOrdersPage() {
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('active')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, profiles(full_name), restaurant_tables(table_number), rooms(room_number), order_items(quantity, price_at_order, menu_items(name))')
      .order('created_at', { ascending: false })
    setOrders((data as Order[]) ?? [])
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id)
    setMsg({ id, text: error ? error.message : `Order updated to "${status}".`, ok: !error })
    load()
  }

  const filterMap: Record<string, string[]> = {
    active:    ['pending', 'preparing', 'served'],
    all:       ['pending', 'preparing', 'served', 'paid', 'cancelled'],
    pending:   ['pending'],
    preparing: ['preparing'],
    served:    ['served'],
    paid:      ['paid'],
    cancelled: ['cancelled'],
  }

  const visible = orders.filter(o => (filterMap[statusFilter] ?? []).includes(o.status))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">
          Orders
          <span className="ml-2 text-base font-normal text-gray-400">({visible.length})</span>
        </h1>
        <div className="flex gap-1 flex-wrap">
          {['active', 'all', 'pending', 'preparing', 'served', 'paid', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                statusFilter === s ? 'bg-terra text-white border-terra' : 'hover:border-terra text-brown-mid border-warm-border'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 && (
        <p className="text-gray-400 text-center py-12">No orders match this filter.</p>
      )}

      <div className="space-y-3">
        {visible.map(o => {
          const location = o.restaurant_tables
            ? `Table ${o.restaurant_tables.table_number}`
            : o.rooms ? `Room ${o.rooms.room_number} (room service)` : '—'
          const actions = ORDER_ACTIONS[o.status] ?? []
          return (
            <div key={o.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold">{o.profiles?.full_name ?? 'Unknown'}</p>
                    <span className="text-gray-400 text-sm">·</span>
                    <p className="text-sm text-gray-600">{location}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[o.status] ?? 'bg-gray-100'}`}>
                      {o.status}
                    </span>
                  </div>
                  <ul className="text-sm text-gray-500 space-y-0.5">
                    {o.order_items.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span>{item.menu_items?.name}</span>
                        <span className="text-gray-400">×{item.quantity}</span>
                        <span className="text-gray-400">— ₱{(item.price_at_order * item.quantity).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm font-bold text-blue-700 mt-1">Total: ₱{Number(o.total).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmt(o.created_at)}</p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  {msg?.id === o.id && (
                    <p className={`text-xs ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
                  )}
                  {actions.map(({ label, next }) => (
                    <button key={next} onClick={() => updateStatus(o.id, next)}
                      className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap ${
                        next === 'cancelled'
                          ? 'border-[#e8b4b4] text-[#9e3535] hover:bg-[#fdf2f2]'
                          : 'bg-terra text-white border-terra hover:bg-terra-dark'}`}>
                      {label}
                    </button>
                  ))}
                  {o.status === 'served' && (
                    <p className="text-xs text-gray-400 text-right">Waiting for student to Pay Now</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
