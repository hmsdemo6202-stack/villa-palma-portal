'use client'
import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'

const MENU_BUCKET = 'menu-images'

type Category = { id: string; name: string; department_id: string | null }
type PosItem = {
  id: string
  category_id: string
  name: string
  description: string
  price: number
  cost: number
  image_url: string
  is_available: boolean
}

const emptyItem: Omit<PosItem, 'id'> = {
  category_id: '', name: '', description: '', price: 0, cost: 0, image_url: '', is_available: true,
}

export default function AdminMenuPage() {
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [catForm, setCatForm] = useState({ name: '' })
  const [catEditId, setCatEditId] = useState<string | null>(null)
  const [showCatForm, setShowCatForm] = useState(false)

  const [items, setItems] = useState<PosItem[]>([])
  const [itemForm, setItemForm] = useState<Omit<PosItem, 'id'>>(emptyItem)
  const [itemEditId, setItemEditId] = useState<string | null>(null)
  const [showItemForm, setShowItemForm] = useState(false)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const menuImgRef = useRef<HTMLInputElement>(null)

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('pos_categories').select('*').order('sort_order').order('name')
    setCategories(data ?? [])
  }, [supabase])

  const loadItems = useCallback(async () => {
    const { data } = await supabase.from('pos_items').select('*').order('name')
    setItems(data ?? [])
  }, [supabase])

  useEffect(() => { loadCategories(); loadItems() }, [loadCategories, loadItems])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) } else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault()
    const { error: err } = catEditId
      ? await supabase.from('pos_categories').update({ name: catForm.name }).eq('id', catEditId)
      : await supabase.from('pos_categories').insert({ name: catForm.name })
    if (err) { flash(err.message, false); return }
    flash(catEditId ? 'Category updated.' : 'Category added.')
    setCatForm({ name: '' }); setCatEditId(null); setShowCatForm(false)
    loadCategories()
  }

  function editCategory(c: Category) {
    setCatForm({ name: c.name }); setCatEditId(c.id); setShowCatForm(true)
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category? Items in it will lose their category link.')) return
    const { error: err } = await supabase.from('pos_categories').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Category deleted.')
    loadCategories()
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...itemForm, price: Number(itemForm.price), cost: Number(itemForm.cost) }
    const { error: err } = itemEditId
      ? await supabase.from('pos_items').update(payload).eq('id', itemEditId)
      : await supabase.from('pos_items').insert(payload)
    if (err) { flash(err.message, false); return }
    flash(itemEditId ? 'Item updated.' : 'Item added.')
    setItemForm(emptyItem); setItemEditId(null); setShowItemForm(false); setExpandedItemId(null)
    loadItems()
  }

  function editItem(item: PosItem) {
    if (expandedItemId === item.id) {
      setExpandedItemId(null); setItemEditId(null); setItemForm(emptyItem)
      return
    }
    setShowItemForm(false)
    setItemForm({
      category_id: item.category_id,
      name: item.name,
      description: item.description ?? '',
      price: item.price,
      cost: item.cost ?? 0,
      image_url: item.image_url ?? '',
      is_available: item.is_available,
    })
    setItemEditId(item.id); setExpandedItemId(item.id)
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this menu item?')) return
    const { error: err } = await supabase.from('pos_items').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Item deleted.')
    loadItems()
  }

  async function uploadMenuImage(file: File) {
    setUploading(true)
    const ext  = file.name.split('.').pop() || 'jpg'
    const path = `items/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from(MENU_BUCKET).upload(path, file, { upsert: false })
    if (upErr) { flash(upErr.message, false); setUploading(false); return }
    const { data: pub } = supabase.storage.from(MENU_BUCKET).getPublicUrl(path)
    setItemForm(f => ({ ...f, image_url: pub.publicUrl }))
    setUploading(false)
  }

  async function toggleAvail(id: string, current: boolean) {
    const { error: err } = await supabase.from('pos_items').update({ is_available: !current }).eq('id', id)
    if (!err) loadItems()
  }

  const categoryById = Object.fromEntries(categories.map(c => [c.id, c.name]))

  return (
    <div className="space-y-10 max-w-5xl">
      <h1 className="text-2xl font-bold text-brown">Menu</h1>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {/* ── Categories ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-brown">Categories</h2>
          <button onClick={() => { setCatForm({ name: '' }); setCatEditId(null); setShowCatForm(v => !v) }}
            className="text-sm bg-terra text-white px-3 py-1.5 rounded-lg hover:bg-terra-dark transition-colors">
            {showCatForm && !catEditId ? 'Cancel' : '+ Add Category'}
          </button>
        </div>

        {showCatForm && (
          <form onSubmit={saveCategory} className="mb-4 bg-white border border-warm-border rounded-xl p-4 flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Category Name *</label>
              <input required value={catForm.name} onChange={e => setCatForm({ name: e.target.value })}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
                placeholder="e.g. Main Course, Beverages" />
            </div>
            <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
              {catEditId ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowCatForm(false); setCatEditId(null) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && <p className="text-sm text-gray-400">No categories yet.</p>}
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-1 bg-[#fdf0eb] text-terra rounded-full pl-3 pr-1 py-1 text-sm border border-[#f0c8a0]">
              <span>{c.name}</span>
              <button onClick={() => editCategory(c)} className="hover:underline text-xs px-1.5">Edit</button>
              <button onClick={() => deleteCategory(c.id)} className="text-red-400 hover:text-red-600 text-xs px-1">×</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Menu Items ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-brown">Menu Items</h2>
          <button onClick={() => { setItemForm(emptyItem); setItemEditId(null); setExpandedItemId(null); setShowItemForm(v => !v) }}
            className="text-sm bg-terra text-white px-3 py-1.5 rounded-lg hover:bg-terra-dark transition-colors"
            disabled={categories.length === 0}>
            {showItemForm ? 'Cancel' : '+ Add Item'}
          </button>
        </div>

        {categories.length === 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-3">
            Add at least one category before creating menu items.
          </p>
        )}

        {showItemForm && (
          <form onSubmit={saveItem} className="mb-4 bg-white border border-warm-border rounded-xl p-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium mb-1">Name *</label>
              <input required value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
                placeholder="e.g. Grilled Bangus" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category *</label>
              <select required value={itemForm.category_id} onChange={e => setItemForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none">
                <option value="">— Select —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Price (₱) *</label>
              <input required type="number" min={0} step="0.01" value={itemForm.price}
                onChange={e => setItemForm(f => ({ ...f, price: +e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cost (₱)</label>
              <input type="number" min={0} step="0.01" value={itemForm.cost}
                onChange={e => setItemForm(f => ({ ...f, cost: +e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
                placeholder="Cost to hotel" />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-xs font-medium mb-1">Photo</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => menuImgRef.current?.click()} disabled={uploading}
                  className="shrink-0 border border-warm-border px-3 py-2 rounded-lg text-xs text-brown-mid hover:bg-gray-50 transition-colors disabled:opacity-50">
                  {uploading ? 'Uploading…' : itemForm.image_url ? 'Replace Photo' : 'Upload Photo'}
                </button>
                <input value={itemForm.image_url} onChange={e => setItemForm(f => ({ ...f, image_url: e.target.value }))}
                  className="flex-1 border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
                  placeholder="or paste a URL" />
                {itemForm.image_url && (
                  <button type="button" onClick={() => setItemForm(f => ({ ...f, image_url: '' }))}
                    className="shrink-0 text-red-400 hover:text-red-600 text-xs px-2">✕ Remove</button>
                )}
              </div>
              <input ref={menuImgRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadMenuImage(f); e.target.value = '' }} />
              {itemForm.image_url && (
                <div className="mt-2 h-24 w-24 rounded-lg overflow-hidden bg-gray-100 border border-warm-border">
                  <img src={itemForm.image_url} alt="preview" className="w-full h-full object-cover"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                </div>
              )}
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-xs font-medium mb-1">Description</label>
              <input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
                placeholder="Short description visible to guests" />
            </div>
            <div className="col-span-2 sm:col-span-3 flex items-center gap-2">
              <input type="checkbox" id="avail-new" checked={itemForm.is_available}
                onChange={e => setItemForm(f => ({ ...f, is_available: e.target.checked }))}
                className="rounded" />
              <label htmlFor="avail-new" className="text-sm text-gray-600">Available (visible to guests)</label>
            </div>
            <div className="col-span-2 sm:col-span-3 flex gap-2">
              <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
                Add Item
              </button>
              <button type="button" onClick={() => { setShowItemForm(false); setItemForm(emptyItem) }}
                className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-xl border border-warm-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>{['Name', 'Category', 'Price', 'Cost', 'Margin', 'Available', 'Actions'].map(h =>
                <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No menu items yet.</td></tr>}
              {items.map(item => {
                const margin = item.cost > 0 ? Math.round(((item.price - item.cost) / item.price) * 100) : null
                const isOpen = expandedItemId === item.id
                return (
                  <Fragment key={item.id}>
                    <tr className={`transition-colors ${isOpen ? 'bg-amber-50/40' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 font-medium text-brown">{item.name}</td>
                      <td className="px-4 py-3 text-gray-500">{categoryById[item.category_id] ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold">₱{Number(item.price).toLocaleString('en-PH')}</td>
                      <td className="px-4 py-3 text-gray-500">{item.cost > 0 ? `₱${Number(item.cost).toLocaleString('en-PH')}` : '—'}</td>
                      <td className="px-4 py-3">
                        {margin !== null
                          ? <span className={`text-xs font-medium ${margin >= 60 ? 'text-green-700' : margin >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{margin}%</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleAvail(item.id, item.is_available)}
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium cursor-pointer ${
                            item.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {item.is_available ? 'Available' : 'Hidden'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => editItem(item)}
                            className={`text-xs border px-2.5 py-1 rounded-lg transition-colors ${isOpen ? 'bg-terra text-white border-terra' : 'text-blue-600 border-gray-200 hover:bg-blue-50'}`}>
                            {isOpen ? 'Close' : 'Edit'}
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} className="px-6 py-5 bg-amber-50/30 border-t border-amber-100">
                          <form onSubmit={saveItem} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <div>
                              <label className="block text-xs font-medium mb-1">Name *</label>
                              <input required value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Category *</label>
                              <select required value={itemForm.category_id} onChange={e => setItemForm(f => ({ ...f, category_id: e.target.value }))}
                                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none">
                                <option value="">— Select —</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Price (₱) *</label>
                              <input required type="number" min={0} step="0.01" value={itemForm.price}
                                onChange={e => setItemForm(f => ({ ...f, price: +e.target.value }))}
                                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Cost (₱)</label>
                              <input type="number" min={0} step="0.01" value={itemForm.cost}
                                onChange={e => setItemForm(f => ({ ...f, cost: +e.target.value }))}
                                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
                                placeholder="Cost to hotel" />
                            </div>
                            <div className="col-span-2 sm:col-span-3">
                              <label className="block text-xs font-medium mb-1">Description</label>
                              <input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
                                placeholder="Short description visible to guests" />
                            </div>
                            <div className="col-span-2 sm:col-span-3">
                              <label className="block text-xs font-medium mb-1">Photo</label>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => menuImgRef.current?.click()} disabled={uploading}
                                  className="shrink-0 border border-warm-border px-3 py-2 rounded-lg text-xs text-brown-mid hover:bg-gray-50 transition-colors disabled:opacity-50">
                                  {uploading ? 'Uploading…' : itemForm.image_url ? 'Replace Photo' : 'Upload Photo'}
                                </button>
                                <input value={itemForm.image_url} onChange={e => setItemForm(f => ({ ...f, image_url: e.target.value }))}
                                  className="flex-1 border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
                                  placeholder="or paste a URL" />
                                {itemForm.image_url && (
                                  <button type="button" onClick={() => setItemForm(f => ({ ...f, image_url: '' }))}
                                    className="shrink-0 text-red-400 hover:text-red-600 text-xs px-2">✕ Remove</button>
                                )}
                              </div>
                              <input ref={menuImgRef} type="file" accept="image/*" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadMenuImage(f); e.target.value = '' }} />
                              {itemForm.image_url && (
                                <div className="mt-2 h-20 w-20 rounded-lg overflow-hidden bg-gray-100 border border-warm-border">
                                  <img src={itemForm.image_url} alt="preview" className="w-full h-full object-cover"
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                                </div>
                              )}
                            </div>
                            <div className="col-span-2 sm:col-span-3 flex items-center gap-2">
                              <input type="checkbox" id={`avail-${item.id}`} checked={itemForm.is_available}
                                onChange={e => setItemForm(f => ({ ...f, is_available: e.target.checked }))}
                                className="rounded" />
                              <label htmlFor={`avail-${item.id}`} className="text-sm text-gray-600">Available (visible to guests)</label>
                            </div>
                            <div className="col-span-2 sm:col-span-3 flex gap-2">
                              <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
                                Update Item
                              </button>
                              <button type="button"
                                onClick={() => { setExpandedItemId(null); setItemEditId(null); setItemForm(emptyItem) }}
                                className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
