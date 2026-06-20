'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type CartItem = { menu_item_id: string; name: string; price: number; quantity: number }
type Table = { id: string; table_number: string; capacity: number }
type Room = { id: string; room_number: string }

function getCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('hms-cart') || '[]') } catch { return [] }
}

export default function OrderPage() {
  const supabase = createClient()
  const router = useRouter()

  const [cart, setCart] = useState<CartItem[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [orderType, setOrderType] = useState<'table' | 'room'>('table')
  const [tableId, setTableId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const c = getCart()
    if (c.length === 0) { router.push('/restaurant/menu'); return }
    setCart(c)

    async function fetchOptions() {
      const [{ data: t }, { data: r }] = await Promise.all([
        supabase.from('restaurant_tables').select('id, table_number, capacity').order('table_number'),
        supabase.from('rooms').select('id, room_number').order('room_number'),
      ])
      setTables(t ?? [])
      setRooms(r ?? [])
      if (t && t.length > 0) setTableId(t[0].id)
      if (r && r.length > 0) setRoomId(r[0].id)
    }
    fetchOptions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const estimatedTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)

  async function placeOrder() {
    if (orderType === 'table' && !tableId) { setError('Please select a table.'); return }
    if (orderType === 'room' && !roomId) { setError('Please select a room.'); return }
    setLoading(true); setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const orderPayload: Record<string, unknown> = { user_id: user.id, status: 'pending' }
    if (orderType === 'table') orderPayload.table_id = tableId
    else orderPayload.room_id = roomId

    const { data: order, error: orderErr } = await supabase
      .from('orders').insert(orderPayload).select().single()

    if (orderErr) { setError(orderErr.message); setLoading(false); return }

    const orderItems = cart.map(item => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      price_at_order: 0, // overwritten by trg_snapshot_order_item_price BEFORE INSERT
    }))

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems)
    if (itemsErr) { setError(itemsErr.message); setLoading(false); return }

    localStorage.removeItem('hms-cart')
    router.push('/my-activity?booked=order')
  }

  if (cart.length === 0) return null

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <a href="/restaurant/menu" className="text-sm text-blue-600 hover:underline mb-4 block">← Back to menu</a>
      <h1 className="text-2xl font-bold mb-6">Review Your Order</h1>

      <div className="bg-white border rounded-xl p-5 mb-5 shadow-sm">
        <h2 className="font-semibold mb-3">Items</h2>
        <div className="divide-y">
          {cart.map(item => (
            <div key={item.menu_item_id} className="flex items-center justify-between py-2 text-sm">
              <span className="flex-1">{item.name}</span>
              <span className="text-gray-500 mx-4">×{item.quantity}</span>
              <span className="font-medium">₱{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="border-t mt-2 pt-2 flex justify-between font-bold">
          <span>Estimated total</span>
          <span>₱{estimatedTotal.toLocaleString()}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Prices are locked in at order time — menu changes won't affect this total.
        </p>
      </div>

      <div className="bg-white border rounded-xl p-5 mb-5 shadow-sm space-y-4">
        <h2 className="font-semibold">Where are you ordering for?</h2>

        <div className="flex gap-3">
          <button onClick={() => setOrderType('table')}
            className={`flex-1 border rounded-lg py-2 text-sm font-medium transition-colors ${
              orderType === 'table' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}>
            Dine In (Table)
          </button>
          <button onClick={() => setOrderType('room')}
            className={`flex-1 border rounded-lg py-2 text-sm font-medium transition-colors ${
              orderType === 'room' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}>
            Room Service
          </button>
        </div>

        {orderType === 'table' && (
          <div>
            <label className="block text-xs font-medium mb-1">Select table</label>
            <select value={tableId} onChange={e => setTableId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              {tables.map(t => (
                <option key={t.id} value={t.id}>Table {t.table_number} ({t.capacity} seats)</option>
              ))}
            </select>
          </div>
        )}

        {orderType === 'room' && (
          <div>
            <label className="block text-xs font-medium mb-1">Select room</label>
            <select value={roomId} onChange={e => setRoomId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3 mb-4">{error}</p>}

      <button onClick={placeOrder} disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-base hover:bg-blue-700 disabled:opacity-50">
        {loading ? 'Placing order…' : 'Place Order'}
      </button>
      <p className="text-xs text-gray-400 text-center mt-2">
        Order starts as <strong>Pending</strong> → Instructor marks it Preparing → Served → you can then Pay.
      </p>
    </div>
  )
}
