'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import RetryImg from '@/components/RetryImg'

type Category = { id: string; name: string; sort_order: number }
type Item = {
  id: string; name: string; description: string
  price: number; category_id: string | null; is_available: boolean
  image_url: string | null
}
type CartLine = { item: Item; qty: number }

type GuestInHouse = {
  id: string
  full_name: string
  phone: string | null
  reservationId: string
  roomNumber: string
}

function peso(n: number) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PosTerminalPage() {
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [items,      setItems]      = useState<Item[]>([])
  const [activeCat,  setActiveCat]  = useState<string>('all')
  const [cart,       setCart]       = useState<CartLine[]>([])
  const [guests,     setGuests]     = useState<GuestInHouse[]>([])
  const [payType,    setPayType]    = useState<'room_charge' | 'walkin'>('room_charge')
  const [selectedGuest, setSelectedGuest] = useState<GuestInHouse | null>(null)
  const [notes,      setNotes]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [flash,      setFlash]      = useState<{ msg: string; ok: boolean } | null>(null)
  const [loading,    setLoading]    = useState(true)

  const load = useCallback(async () => {
    const [{ data: cats }, { data: its }, { data: res }] = await Promise.all([
      supabase.from('pos_categories').select('id, name, sort_order').order('sort_order').order('name'),
      supabase.from('pos_items').select('id, name, description, price, category_id, is_available, image_url').eq('is_available', true).order('name'),
      supabase
        .from('reservations')
        .select('id, guests(id, full_name, phone), rooms(room_number)')
        .eq('status', 'checked_in')
        .order('created_at', { ascending: false }),
    ])
    setCategories((cats as Category[]) ?? [])
    setItems((its as Item[]) ?? [])

    const mapped: GuestInHouse[] = ((res as any[]) ?? []).map((r: any) => ({
      id:            r.guests?.id ?? '',
      full_name:     r.guests?.full_name ?? 'Guest',
      phone:         r.guests?.phone ?? null,
      reservationId: r.id,
      roomNumber:    r.rooms?.room_number ?? '?',
    })).filter((g: GuestInHouse) => g.id)

    setGuests(mapped)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  function showFlash(msg: string, ok = true) {
    setFlash({ msg, ok })
    setTimeout(() => setFlash(null), 4000)
  }

  // Cart helpers
  function addToCart(item: Item) {
    setCart(prev => {
      const idx = prev.findIndex(l => l.item.id === item.id)
      if (idx >= 0) return prev.map((l, i) => i === idx ? { ...l, qty: l.qty + 1 } : l)
      return [...prev, { item, qty: 1 }]
    })
  }

  function setQty(itemId: string, qty: number) {
    if (qty <= 0) { setCart(prev => prev.filter(l => l.item.id !== itemId)); return }
    setCart(prev => prev.map(l => l.item.id === itemId ? { ...l, qty } : l))
  }

  function clearCart() {
    setCart([]); setSelectedGuest(null); setNotes('')
  }

  const subtotal = cart.reduce((s, l) => s + l.item.price * l.qty, 0)
  const visible  = items.filter(i => activeCat === 'all' || i.category_id === activeCat)

  async function submit() {
    if (cart.length === 0) { showFlash('Cart is empty.', false); return }
    if (payType === 'room_charge' && !selectedGuest) {
      showFlash('Select a guest for room charge.', false); return
    }

    setSaving(true)

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        guest_id:       payType === 'room_charge' ? selectedGuest!.id : null,
        reservation_id: payType === 'room_charge' ? selectedGuest!.reservationId : null,
        status:         'paid',
        total_amount:   subtotal,
        notes:          notes.trim() || null,
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      showFlash(orderErr?.message ?? 'Failed to create order.', false)
      setSaving(false); return
    }

    const { error: itemsErr } = await supabase.from('order_items').insert(
      cart.map(l => ({
        order_id:    order.id,
        pos_item_id: l.item.id,
        name:        l.item.name,
        quantity:    l.qty,
        unit_price:  l.item.price,
      }))
    )

    if (itemsErr) {
      showFlash('Order created but items failed: ' + itemsErr.message, false)
      setSaving(false); return
    }

    showFlash(
      payType === 'room_charge'
        ? `Order #${order.id.slice(-6)} charged to Room ${selectedGuest!.roomNumber}.`
        : `Walk-in order #${order.id.slice(-6)} recorded.`
    )
    setSaving(false)
    clearCart()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
  }

  return (
    <div className="flex gap-0 h-[calc(100vh-5rem)] -m-6 overflow-hidden">

      {/* ── Left: Menu ── */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-warm-border">
        {/* Category tabs */}
        <div className="flex gap-1 p-3 overflow-x-auto shrink-0 border-b border-warm-border bg-gray-50">
          <button
            onClick={() => setActiveCat('all')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
              activeCat === 'all' ? 'bg-terra text-white' : 'border border-warm-border text-gray-600 hover:bg-white'
            }`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                activeCat === c.id ? 'bg-terra text-white' : 'border border-warm-border text-gray-600 hover:bg-white'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Item grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {visible.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-16">No items in this category.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {visible.map(item => {
                const inCart = cart.find(l => l.item.id === item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={`relative text-left rounded-xl border-2 overflow-hidden transition-all hover:shadow-sm active:scale-95 ${
                      inCart ? 'border-terra bg-amber-50' : 'border-warm-border bg-white hover:border-terra/40'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-terra text-white text-[10px] font-bold flex items-center justify-center z-10">
                        {inCart.qty}
                      </span>
                    )}
                    {item.image_url && (
                      <RetryImg src={item.image_url} alt={item.name} className="w-full h-24 object-cover" />
                    )}
                    <div className="p-3">
                      <div className="text-sm font-semibold text-brown leading-tight mb-1 pr-5">{item.name}</div>
                      {item.description && (
                        <div className="text-[10px] text-gray-400 leading-tight mb-1.5 line-clamp-2">{item.description}</div>
                      )}
                      <div className="text-sm font-bold text-terra">{peso(item.price)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Cart ── */}
      <div className="w-72 xl:w-80 flex flex-col bg-white shrink-0">
        <div className="px-4 py-3 border-b border-warm-border shrink-0">
          <h2 className="font-semibold text-brown">Order</h2>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-500 hover:underline mt-0.5">Clear all</button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-gray-400 text-xs text-center pt-10">Tap menu items to add them here.</p>
          ) : (
            cart.map(line => (
              <div key={line.item.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-brown truncate">{line.item.name}</div>
                  <div className="text-[10px] text-gray-400">{peso(line.item.price)} each</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setQty(line.item.id, line.qty - 1)}
                    className="w-6 h-6 rounded-full border border-warm-border text-xs flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors">
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{line.qty}</span>
                  <button onClick={() => setQty(line.item.id, line.qty + 1)}
                    className="w-6 h-6 rounded-full border border-warm-border text-xs flex items-center justify-center hover:bg-green-50 hover:border-green-200 transition-colors">
                    +
                  </button>
                </div>
                <div className="text-xs font-bold text-brown shrink-0 w-16 text-right">
                  {peso(line.item.price * line.qty)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals + payment */}
        <div className="border-t border-warm-border px-4 py-4 space-y-3 shrink-0">
          {flash && (
            <div className={`text-xs px-3 py-2 rounded-lg ${flash.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {flash.msg}
            </div>
          )}

          {/* Subtotal */}
          <div className="flex justify-between font-bold">
            <span className="text-brown">Total</span>
            <span className="text-terra text-lg">{peso(subtotal)}</span>
          </div>

          {/* Notes */}
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Order notes (optional)…"
            className="w-full border border-warm-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-terra"
          />

          {/* Payment type */}
          <div className="flex gap-1">
            {(['room_charge', 'walkin'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setPayType(t); setSelectedGuest(null) }}
                className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                  payType === t ? 'bg-brown text-white border-brown' : 'border-warm-border text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t === 'room_charge' ? 'Room Charge' : 'Walk-in / Cash'}
              </button>
            ))}
          </div>

          {/* Guest picker for room charge */}
          {payType === 'room_charge' && (
            <div>
              <label className="block text-[10px] text-gray-500 font-medium mb-1 uppercase tracking-wide">In-House Guest</label>
              {guests.length === 0 ? (
                <p className="text-xs text-gray-400">No guests currently checked in.</p>
              ) : (
                <select
                  value={selectedGuest?.id ?? ''}
                  onChange={e => setSelectedGuest(guests.find(g => g.id === e.target.value) ?? null)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-terra"
                >
                  <option value="">— Select guest —</option>
                  {guests.map(g => (
                    <option key={g.id} value={g.id}>
                      Room {g.roomNumber} · {g.full_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <button
            onClick={submit}
            disabled={saving || cart.length === 0}
            className="w-full bg-terra text-white py-3 rounded-xl font-semibold text-sm hover:bg-terra-dark disabled:opacity-40 transition-colors"
          >
            {saving ? 'Processing…' : payType === 'room_charge' ? 'Charge to Room' : 'Complete Sale'}
          </button>
        </div>
      </div>
    </div>
  )
}
