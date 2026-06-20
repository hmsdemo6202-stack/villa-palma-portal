'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Category = { id: string; name: string }
type MenuItem = {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  category_id: string
}
type CartItem = { menu_item_id: string; name: string; price: number; quantity: number }
type PopularItem = { menu_item_id: string; total_ordered: number }

function getCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('hms-cart') || '[]') } catch { return [] }
}

function saveCart(cart: CartItem[]) {
  localStorage.setItem('hms-cart', JSON.stringify(cart))
}

export default function MenuPage() {
  const supabase = createClient()
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [popularIds, setPopularIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const [{ data: cats }, { data: menuItems }, { data: popular }] = await Promise.all([
      supabase.from('menu_categories').select('*').order('name'),
      supabase.from('menu_items').select('*').eq('is_available', true).order('name'),
      supabase.rpc('get_popular_menu_items', { limit_count: 3 }),
    ])
    const catList = cats ?? []
    setCategories(catList)
    setItems(menuItems ?? [])
    setPopularIds(new Set((popular as PopularItem[] ?? []).map(p => p.menu_item_id)))
    if (catList.length > 0) setActiveCategory(catList[0].id)
  }, [supabase])

  useEffect(() => { load() }, [load])
  useEffect(() => { setCart(getCart()) }, [])

  function addToCart(item: MenuItem) {
    const current = getCart()
    const idx = current.findIndex(i => i.menu_item_id === item.id)
    if (idx >= 0) { current[idx].quantity += 1 } else {
      current.push({ menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 })
    }
    saveCart(current); setCart([...current])
  }

  function removeFromCart(menuItemId: string) {
    const current = getCart()
    const idx = current.findIndex(i => i.menu_item_id === menuItemId)
    if (idx < 0) return
    if (current[idx].quantity > 1) { current[idx].quantity -= 1 } else { current.splice(idx, 1) }
    saveCart(current); setCart([...current])
  }

  function cartQty(menuItemId: string) {
    return cart.find(i => i.menu_item_id === menuItemId)?.quantity ?? 0
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  const visibleItems = activeCategory ? items.filter(i => i.category_id === activeCategory) : items

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Main content */}
      <div className="flex-1 p-6 max-w-3xl">
        <div className="mb-6">
          <p className="text-[10px] font-bold text-brown-light uppercase tracking-[0.25em] mb-1">Dining</p>
          <h1 className="font-serif text-2xl font-bold text-brown">Restaurant Menu</h1>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap mb-6">
          {categories.map(cat => (
            <button key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCategory === cat.id
                  ? 'bg-terra text-white border-terra'
                  : 'bg-white text-brown-mid border-warm-border hover:border-terra hover:text-terra'
              }`}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Items */}
        <div className="space-y-3">
          {visibleItems.length === 0 && (
            <p className="text-brown-light text-center py-12">No items in this category.</p>
          )}
          {visibleItems.map(item => {
            const qty = cartQty(item.id)
            return (
              <div key={item.id} className="bg-white border border-warm-border rounded-xl p-4 flex gap-4 shadow-sm hover:border-terra hover:shadow-md transition-all">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-20 h-20 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-20 h-20 bg-cream-dark rounded-lg shrink-0 flex items-center justify-center">
                    <span className="text-2xl">🍽️</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-brown">{item.name}</p>
                  {popularIds.has(item.id) && (
                    <span className="inline-block mt-0.5 text-xs bg-[#fef3e8] text-[#b85c38] border border-[#f0c8a0] px-2 py-0.5 rounded-full font-medium">
                      🔥 Popular
                    </span>
                  )}
                  {item.description && (
                    <p className="text-xs text-brown-mid mt-1 line-clamp-2">{item.description}</p>
                  )}
                  <p className="text-terra font-bold mt-1.5">₱{Number(item.price).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {qty === 0 ? (
                    <button onClick={() => addToCart(item)}
                      className="bg-terra text-white text-sm px-4 py-1.5 rounded-lg hover:bg-terra-dark transition-colors font-medium">
                      Add
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(item.id)}
                        className="w-7 h-7 border border-warm-border rounded-full flex items-center justify-center text-lg font-bold text-brown-mid hover:bg-cream-dark transition-colors">
                        −
                      </button>
                      <span className="w-5 text-center font-semibold text-sm text-brown">{qty}</span>
                      <button onClick={() => addToCart(item)}
                        className="w-7 h-7 bg-terra text-white rounded-full flex items-center justify-center text-lg font-bold hover:bg-terra-dark transition-colors">
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cart sidebar */}
      <div className="w-72 shrink-0 border-l border-warm-border bg-white p-5 sticky top-0 h-screen overflow-y-auto">
        <h2 className="font-serif font-bold text-lg text-brown mb-1">
          Your Order
          {cartCount > 0 && <span className="text-terra ml-2 text-base">({cartCount})</span>}
        </h2>
        <div className="w-8 h-px bg-terra mb-5" />
        {cart.length === 0 ? (
          <p className="text-brown-light text-sm">Your cart is empty. Add items from the menu.</p>
        ) : (
          <>
            <div className="space-y-2.5 mb-5">
              {cart.map(item => (
                <div key={item.menu_item_id} className="flex items-center justify-between text-sm">
                  <span className="flex-1 truncate text-brown">{item.name}</span>
                  <span className="text-brown-light ml-2">×{item.quantity}</span>
                  <span className="ml-2 font-medium text-brown">₱{(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-warm-border pt-4 mb-5">
              <div className="flex justify-between font-bold text-brown">
                <span>Estimated total</span>
                <span className="text-terra">₱{cartTotal.toLocaleString()}</span>
              </div>
              <p className="text-xs text-brown-light mt-1">Final total confirmed by the system.</p>
            </div>
            <button onClick={() => router.push('/restaurant/order')}
              className="w-full bg-terra text-white py-2.5 rounded-lg font-medium hover:bg-terra-dark transition-colors">
              Proceed to Checkout
            </button>
            <button onClick={() => { saveCart([]); setCart([]) }}
              className="w-full mt-2 text-xs text-brown-light hover:text-[#9e3535] transition-colors">
              Clear cart
            </button>
          </>
        )}
      </div>
    </div>
  )
}
