'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Category = { id: string; name: string }
type MenuItem = {
  id: string
  category_id: string
  name: string
  description: string
  price: number
  image_url: string
  is_available: boolean
}

const emptyItem: Omit<MenuItem, 'id'> = {
  category_id: '', name: '', description: '', price: 0, image_url: '', is_available: true
}

export default function AdminMenuPage() {
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [catForm, setCatForm] = useState({ name: '' })
  const [catEditId, setCatEditId] = useState<string | null>(null)
  const [showCatForm, setShowCatForm] = useState(false)

  const [items, setItems] = useState<MenuItem[]>([])
  const [itemForm, setItemForm] = useState<Omit<MenuItem, 'id'>>(emptyItem)
  const [itemEditId, setItemEditId] = useState<string | null>(null)
  const [showItemForm, setShowItemForm] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('menu_categories').select('*').order('name')
    setCategories(data ?? [])
  }, [supabase])

  const loadItems = useCallback(async () => {
    const { data } = await supabase.from('menu_items').select('*').order('name')
    setItems(data ?? [])
  }, [supabase])

  useEffect(() => { loadCategories(); loadItems() }, [loadCategories, loadItems])

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error: err } = catEditId
      ? await supabase.from('menu_categories').update(catForm).eq('id', catEditId)
      : await supabase.from('menu_categories').insert(catForm)
    if (err) { setError(err.message); return }
    setCatForm({ name: '' }); setCatEditId(null); setShowCatForm(false)
    loadCategories()
  }

  function editCategory(c: Category) {
    setCatForm({ name: c.name }); setCatEditId(c.id); setShowCatForm(true)
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category? Menu items in it will lose their category.')) return
    const { error: err } = await supabase.from('menu_categories').delete().eq('id', id)
    if (err) { setError(err.message); return }
    loadCategories()
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const payload = { ...itemForm, price: Number(itemForm.price) }
    const { error: err } = itemEditId
      ? await supabase.from('menu_items').update(payload).eq('id', itemEditId)
      : await supabase.from('menu_items').insert(payload)
    if (err) { setError(err.message); return }
    setItemForm(emptyItem); setItemEditId(null); setShowItemForm(false)
    loadItems()
  }

  function editItem(item: MenuItem) {
    setItemForm({
      category_id: item.category_id,
      name: item.name,
      description: item.description ?? '',
      price: item.price,
      image_url: item.image_url ?? '',
      is_available: item.is_available,
    })
    setItemEditId(item.id); setShowItemForm(true)
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this menu item?')) return
    const { error: err } = await supabase.from('menu_items').delete().eq('id', id)
    if (err) { setError(err.message); return }
    loadItems()
  }

  const categoryById = Object.fromEntries(categories.map(c => [c.id, c.name]))

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">Menu</h1>
      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">{error}</p>}

      {/* Categories */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Categories</h2>
          <button onClick={() => { setCatForm({ name: '' }); setCatEditId(null); setShowCatForm(v => !v) }}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            {showCatForm && !catEditId ? 'Cancel' : '+ Add Category'}
          </button>
        </div>

        {showCatForm && (
          <form onSubmit={saveCategory} className="mb-4 bg-gray-50 border rounded-lg p-4 flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Category Name *</label>
              <input required value={catForm.name}
                onChange={e => setCatForm({ name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Main Course" />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              {catEditId ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowCatForm(false); setCatEditId(null); setCatForm({ name: '' }) }}
              className="border px-4 py-2 rounded text-sm hover:bg-gray-100">Cancel</button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && <p className="text-sm text-gray-400">No categories yet.</p>}
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-1 bg-gray-100 rounded-full pl-3 pr-1 py-1 text-sm">
              <span>{c.name}</span>
              <button onClick={() => editCategory(c)} className="text-blue-600 hover:underline text-xs px-1">Edit</button>
              <button onClick={() => deleteCategory(c.id)} className="text-red-500 hover:text-red-700 text-xs px-1">×</button>
            </div>
          ))}
        </div>
      </section>

      {/* Menu Items */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Menu Items</h2>
          <button onClick={() => { setItemForm(emptyItem); setItemEditId(null); setShowItemForm(v => !v) }}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
            disabled={categories.length === 0}>
            {showItemForm && !itemEditId ? 'Cancel' : '+ Add Item'}
          </button>
        </div>
        {categories.length === 0 && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3 mb-3">
            Add at least one category above before creating menu items.
          </p>
        )}

        {showItemForm && (
          <form onSubmit={saveItem} className="mb-4 bg-gray-50 border rounded-lg p-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Name *</label>
              <input required value={itemForm.name}
                onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Grilled Salmon" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category *</label>
              <select required value={itemForm.category_id}
                onChange={e => setItemForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="">Select category…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Price (₱) *</label>
              <input required type="number" min={0} step="0.01" value={itemForm.price}
                onChange={e => setItemForm(f => ({ ...f, price: +e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Image URL</label>
              <input value={itemForm.image_url}
                onChange={e => setItemForm(f => ({ ...f, image_url: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Description</label>
              <textarea value={itemForm.description}
                onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="available" checked={itemForm.is_available}
                onChange={e => setItemForm(f => ({ ...f, is_available: e.target.checked }))}
                className="rounded" />
              <label htmlFor="available" className="text-sm">Available (visible to students)</label>
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                {itemEditId ? 'Update Item' : 'Add Item'}
              </button>
              <button type="button" onClick={() => { setShowItemForm(false); setItemEditId(null); setItemForm(emptyItem) }}
                className="border px-4 py-2 rounded text-sm hover:bg-gray-100">Cancel</button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-gray-100 text-left">
              <tr>
                {['Name', 'Category', 'Price', 'Available', ''].map(h => (
                  <th key={h} className="px-4 py-2 font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No menu items yet.</td></tr>
              )}
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{item.name}</td>
                  <td className="px-4 py-2 text-gray-500">{categoryById[item.category_id] ?? '—'}</td>
                  <td className="px-4 py-2">₱{Number(item.price).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.is_available ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => editItem(item)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => deleteItem(item.id)} className="text-red-500 hover:underline text-xs">Delete</button>
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
