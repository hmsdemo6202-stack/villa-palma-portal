'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Category = { id: string; name: string }
type Item = {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  category_id: string | null
}
type CartItem = Item & { qty: number }
type MyOrder = {
  id: string
  status: string
  total_amount: number
  created_at: string
  order_items: { quantity: number; name: string; unit_price: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  served:    'bg-green-100 text-green-700',
  paid:      'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
}

function currency(n: number) { return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 }) }

export default function GuestOrdersPage() {
  const supabase = createClient()
  const [guestId, setGuestId] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [myOrders, setMyOrders] = useState<MyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [orderNotes, setOrderNotes] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: guest }, { data: cats }, { data: its }] = await Promise.all([
      supabase.from('guests').select('id').eq('profile_id', user.id).single(),
      supabase.from('pos_categories').select('id, name').order('sort_order').order('name'),
      supabase.from('pos_items')
        .select('id, name, description, price, image_url, category_id')
        .eq('is_available', true)
        .order('name'),
    ])

    setGuestId(guest?.id ?? null)
    setCategories(cats ?? [])
    setItems(its ?? [])

    if (guest?.id) {
      const { data: ords } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at, order_items(quantity, name, unit_price)')
        .eq('guest_id', guest.id)
        .order('created_at', { ascending: false })
        .limit(10)
      setMyOrders((ords as MyOrder[]) ?? [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function addToCart(item: Item) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const item = prev.find(c => c.id === id)
      if (!item) return prev
      if (item.qty === 1) return prev.filter(c => c.id !== id)
      return prev.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c)
    })
  }

  const cartCount = cart.reduce((s, c) => s + c.qty, 0)
  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const visibleItems = catFilter === 'all' ? items : items.filter(i => i.category_id === catFilter)

  async function placeOrder() {
    if (!guestId) { setError('Guest profile not found. Please contact front desk.'); return }
    if (!cart.length) return
    setPlacing(true)
    setError(null)

    const { data: order, error: ordErr } = await supabase
      .from('orders')
      .insert({ guest_id: guestId, status: 'pending', notes: orderNotes || null })
      .select()
      .single()

    if (ordErr || !order) { setError(ordErr?.message ?? 'Failed to create order.'); setPlacing(false); return }

    const { error: itemErr } = await supabase.from('order_items').insert(
      cart.map(c => ({
        order_id: order.id,
        pos_item_id: c.id,
        name: c.name,
        quantity: c.qty,
        unit_price: c.price,
      }))
    )

    if (itemErr) { setError(itemErr.message); setPlacing(false); return }

    setCart([])
    setShowCart(false)
    setOrderNotes('')
    setSuccess('Order placed! Our team will prepare it shortly.')
    setTimeout(() => setSuccess(null), 5000)
    setPlacing(false)
    load()
  }

  if (loading) return (
    <div>
      <div className="bg-[#2d1c14] px-6 pt-14 pb-10">
        <h1 className="font-serif text-2xl font-bold text-[#f0e0d0]">Room Service</h1>
        <div className="flex gap-2 mt-4">
          {[1,2,3].map(i => <div key={i} className="h-8 w-20 bg-[#3d2418] rounded-full animate-pulse" />)}
        </div>
      </div>
      <div className="p-5 grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  )

  return (
    <div>
      {/* Header + category tabs */}
      <div className="bg-[#2d1c14] px-6 pt-14 pb-4">
        <h1 className="font-serif text-2xl font-bold text-[#f0e0d0]">Room Service</h1>
        <p className="text-[#7a5040] text-xs mt-0.5 mb-4">Order food & drinks to your room</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
          <button onClick={() => setCatFilter('all')}
            className={`shrink-0 text-xs px-4 py-2 rounded-full font-medium transition-colors ${
              catFilter === 'all' ? 'bg-[#b85c38] text-white' : 'bg-[#3d2418] text-[#c8a898]'}`}>
            All
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setCatFilter(c.id)}
              className={`shrink-0 text-xs px-4 py-2 rounded-full font-medium transition-colors ${
                catFilter === c.id ? 'bg-[#b85c38] text-white' : 'bg-[#3d2418] text-[#c8a898]'}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-6">
        {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">{success}</div>}

        {/* Menu grid */}
        <div className="grid grid-cols-2 gap-3">
          {visibleItems.length === 0 && (
            <div className="col-span-2 text-center py-12 text-[#8a6a5a]">
              <p className="text-4xl mb-2">🍽</p>
              <p>No items in this category.</p>
            </div>
          )}
          {visibleItems.map(item => {
            const inCart = cart.find(c => c.id === item.id)
            return (
              <div key={item.id} className="bg-white border border-[#e8d5c8] rounded-2xl overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-24 bg-gradient-to-br from-[#fdf6f0] to-[#f0c8aa] flex items-center justify-center text-3xl">
                    🍽
                  </div>
                )}
                <div className="p-3">
                  <p className="text-xs font-semibold text-[#3d2018] leading-tight">{item.name}</p>
                  {item.description && (
                    <p className="text-[10px] text-[#8a6a5a] mt-0.5 leading-tight line-clamp-2">{item.description}</p>
                  )}
                  <p className="text-sm font-bold text-[#b85c38] mt-1.5">{currency(item.price)}</p>

                  {inCart ? (
                    <div className="flex items-center justify-between mt-2">
                      <button onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 bg-[#f0e0d0] text-[#b85c38] rounded-full text-lg font-bold flex items-center justify-center">−</button>
                      <span className="font-bold text-[#3d2018]">{inCart.qty}</span>
                      <button onClick={() => addToCart(item)}
                        className="w-8 h-8 bg-[#b85c38] text-white rounded-full text-lg font-bold flex items-center justify-center">+</button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item)}
                      className="w-full mt-2 bg-[#b85c38] text-white text-xs py-2 rounded-xl font-medium hover:bg-[#9a4a2a] transition-colors">
                      Add
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* My recent orders */}
        {myOrders.length > 0 && (
          <section>
            <h2 className="font-semibold text-[#3d2018] mb-3">My Orders</h2>
            <div className="space-y-3">
              {myOrders.map(o => (
                <div key={o.id} className="bg-white border border-[#e8d5c8] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {o.status}
                    </span>
                    <span className="text-xs text-[#8a6a5a]">
                      {new Date(o.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      {' '}
                      {new Date(o.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {o.order_items.map((oi, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-[#7a5040]">{oi.quantity}× {oi.name}</span>
                        <span className="text-[#3d2018]">{currency(oi.quantity * oi.unit_price)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-[#8a6a5a]">Total</span>
                    <span className="font-bold text-[#b85c38]">{currency(o.total_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-20 left-4 right-4 z-40 max-w-lg mx-auto">
          <button onClick={() => setShowCart(true)}
            className="w-full bg-[#b85c38] text-white py-4 rounded-2xl font-medium shadow-lg flex items-center justify-between px-5 hover:bg-[#9a4a2a] transition-colors">
            <span className="bg-white text-[#b85c38] text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">
              {cartCount}
            </span>
            <span>View Cart</span>
            <span className="font-bold">{currency(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="relative bg-white rounded-t-3xl px-6 pt-6 pb-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#3d2018]">Your Order</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>

            <div className="space-y-3 mb-5">
              {cart.map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#3d2018] truncate">{c.name}</p>
                    <p className="text-xs text-[#8a6a5a]">{currency(c.price)} each</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => removeFromCart(c.id)}
                      className="w-8 h-8 bg-[#f0e0d0] text-[#b85c38] rounded-full font-bold flex items-center justify-center text-lg">−</button>
                    <span className="w-5 text-center font-bold text-[#3d2018]">{c.qty}</span>
                    <button onClick={() => addToCart(c)}
                      className="w-8 h-8 bg-[#b85c38] text-white rounded-full font-bold flex items-center justify-center text-lg">+</button>
                  </div>
                  <span className="text-sm font-semibold text-[#3d2018] w-16 text-right shrink-0">{currency(c.price * c.qty)}</span>
                </div>
              ))}
            </div>

            <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
              placeholder="Special instructions (optional)"
              className="w-full border border-[#e8d5c8] rounded-xl px-4 py-3 text-sm text-[#3d2018] placeholder-[#c8a898] bg-white focus:outline-none focus:ring-2 focus:ring-[#b85c38] mb-4" />

            <div className="flex justify-between items-center mb-5">
              <span className="font-medium text-[#3d2018]">Total</span>
              <span className="text-xl font-bold text-[#b85c38]">{currency(cartTotal)}</span>
            </div>

            <button onClick={placeOrder} disabled={placing}
              className="w-full bg-[#b85c38] text-white py-4 rounded-2xl font-semibold hover:bg-[#9a4a2a] disabled:opacity-50 transition-colors text-base">
              {placing ? 'Placing order…' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
