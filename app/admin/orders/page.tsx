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

function printReceipt(o: Order) {
  const location = o.restaurant_tables
    ? `Table ${o.restaurant_tables.table_number}`
    : o.rooms ? `Room ${o.rooms.room_number} (Room Service)` : '—'

  const rows = o.order_items.map(item => `
    <tr>
      <td style="padding:4px 0">${item.menu_items?.name ?? '—'}</td>
      <td style="padding:4px 8px;text-align:center">${item.quantity}</td>
      <td style="padding:4px 0;text-align:right">₱${(item.price_at_order * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>
  <style>
    body{font-family:'Courier New',monospace;font-size:13px;width:300px;margin:0 auto;padding:16px;color:#111}
    h1{font-size:16px;text-align:center;margin:0 0 2px}
    .sub{text-align:center;font-size:11px;color:#555;margin-bottom:12px}
    hr{border:none;border-top:1px dashed #999;margin:8px 0}
    table{width:100%;border-collapse:collapse}
    th{font-size:11px;text-align:left;border-bottom:1px solid #ccc;padding:4px 0;font-weight:bold}
    th:nth-child(2){text-align:center}
    th:nth-child(3){text-align:right}
    .total{font-weight:bold;font-size:14px}
    .footer{text-align:center;font-size:11px;color:#555;margin-top:12px}
    @media print{body{width:100%}}
  </style></head><body>
  <h1>CABALUM HOTEL</h1>
  <div class="sub">Official Receipt</div>
  <hr>
  <div><b>Guest:</b> ${o.profiles?.full_name ?? 'Guest'}</div>
  <div><b>Location:</b> ${location}</div>
  <div><b>Date:</b> ${fmt(o.created_at)}</div>
  <div><b>Order #:</b> ${o.id.slice(-8).toUpperCase()}</div>
  <hr>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <hr>
  <table><tr>
    <td class="total">TOTAL</td>
    <td class="total" style="text-align:right">₱${Number(o.total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
  </tr></table>
  <div class="footer"><br>Thank you for your visit!<br>Cabalum Hotel</div>
  <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>
  </body></html>`

  const w = window.open('', '_blank', 'width=380,height=600')
  if (w) { w.document.write(html); w.document.close() }
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
                  <button
                    onClick={() => printReceipt(o)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                  >
                    🖨 Print Receipt
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
