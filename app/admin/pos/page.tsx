'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Department = { id: string; name: string }

type PosCategory = {
  id: string
  name: string
  department_id: string | null
  sort_order: number
  departments: { name: string } | null
}

type PosItem = {
  id: string
  category_id: string | null
  name: string
  description: string
  price: number
  cost: number
  is_available: boolean
  image_url: string
  pos_categories: { name: string } | null
}

const emptyCategory = { name: '', department_id: '', sort_order: 0 }
const emptyItem = { category_id: '', name: '', description: '', price: 0, cost: 0, is_available: true, image_url: '' }

export default function AdminPosPage() {
  const supabase = createClient()

  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<PosCategory[]>([])
  const [catForm, setCatForm] = useState(emptyCategory)
  const [catEditId, setCatEditId] = useState<string | null>(null)
  const [showCatForm, setShowCatForm] = useState(false)

  const [items, setItems] = useState<PosItem[]>([])
  const [itemForm, setItemForm] = useState(emptyItem)
  const [itemEditId, setItemEditId] = useState<string | null>(null)
  const [showItemForm, setShowItemForm] = useState(false)

  const [catFilter, setCatFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: depts }, { data: cats }, { data: its }] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('pos_categories').select('*, departments(name)').order('sort_order').order('name'),
      supabase.from('pos_items').select('*, pos_categories(name)').order('name'),
    ])
    setDepartments(depts ?? [])
    setCategories((cats as PosCategory[]) ?? [])
    setItems((its as PosItem[]) ?? [])
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  // ── Categories ──────────────────────────────────────────────

  async function saveCat(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...catForm, department_id: catForm.department_id || null, sort_order: Number(catForm.sort_order) }
    const { error: err } = catEditId
      ? await supabase.from('pos_categories').update(payload).eq('id', catEditId)
      : await supabase.from('pos_categories').insert(payload)
    if (err) { flash(err.message, false); return }
    flash(catEditId ? 'Category updated.' : 'Category added.')
    setCatForm(emptyCategory); setCatEditId(null); setShowCatForm(false)
    load()
  }

  async function deleteCat(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? Items in this category will become uncategorised.`)) return
    const { error: err } = await supabase.from('pos_categories').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Category deleted.')
    load()
  }

  function editCat(c: PosCategory) {
    setCatForm({ name: c.name, department_id: c.department_id ?? '', sort_order: c.sort_order })
    setCatEditId(c.id); setShowCatForm(true); setShowItemForm(false)
  }

  // ── Items ────────────────────────────────────────────────────

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...itemForm,
      category_id: itemForm.category_id || null,
      price: Number(itemForm.price),
      cost: Number(itemForm.cost),
    }
    const { error: err } = itemEditId
      ? await supabase.from('pos_items').update(payload).eq('id', itemEditId)
      : await supabase.from('pos_items').insert(payload)
    if (err) { flash(err.message, false); return }
    flash(itemEditId ? 'Item updated.' : 'Item added.')
    setItemForm(emptyItem); setItemEditId(null); setShowItemForm(false)
    load()
  }

  async function deleteItem(id: string, name: string) {
    if (!confirm(`Delete "${name}" from POS?`)) return
    const { error: err } = await supabase.from('pos_items').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Item deleted.')
    load()
  }

  async function toggleAvailable(id: string, current: boolean) {
    const { error: err } = await supabase.from('pos_items').update({ is_available: !current }).eq('id', id)
    if (err) { flash(err.message, false); return }
    load()
  }

  function editItem(i: PosItem) {
    setItemForm({ category_id: i.category_id ?? '', name: i.name, description: i.description, price: i.price, cost: i.cost, is_available: i.is_available, image_url: i.image_url })
    setItemEditId(i.id); setShowItemForm(true); setShowCatForm(false)
  }

  const visibleItems = items
    .filter(i => catFilter === 'all' || i.category_id === catFilter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))

  const margin = (i: PosItem) => i.price > 0 ? Math.round(((i.price - i.cost) / i.price) * 100) : 0

  return (
    <div className="space-y-10 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-brown">POS Items</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {items.length} items · {items.filter(i => i.is_available).length} available · {categories.length} categories
        </p>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {/* ── Categories ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-brown">Categories</h2>
          <button onClick={() => { setCatForm(emptyCategory); setCatEditId(null); setShowCatForm(v => !v); setShowItemForm(false) }}
            className="text-sm bg-terra text-white px-3 py-1.5 rounded-lg hover:bg-terra-dark transition-colors">
            {showCatForm && !catEditId ? 'Cancel' : '+ Add Category'}
          </button>
        </div>

        {showCatForm && (
          <form onSubmit={saveCat} className="mb-4 bg-white border border-warm-border rounded-xl p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Category Name *</label>
              <input required value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Beverages, Appetisers, Room Service" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Department</label>
              <select value={catForm.department_id} onChange={e => setCatForm(f => ({ ...f, department_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Sort Order</label>
              <input type="number" min={0} value={catForm.sort_order} onChange={e => setCatForm(f => ({ ...f, sort_order: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 sm:col-span-4 flex gap-2">
              <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
                {catEditId ? 'Update' : 'Add Category'}
              </button>
              <button type="button" onClick={() => { setShowCatForm(false); setCatEditId(null); setCatForm(emptyCategory) }}
                className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-1.5 bg-white border border-warm-border rounded-lg px-3 py-1.5 text-sm">
              <span className="font-medium text-brown">{c.name}</span>
              {c.departments && <span className="text-xs text-gray-400">· {c.departments.name}</span>}
              <button onClick={() => editCat(c)} className="ml-1 text-xs text-blue-500 hover:underline">Edit</button>
              <button onClick={() => deleteCat(c.id, c.name)} className="text-xs text-red-400 hover:underline">Del</button>
            </div>
          ))}
          {categories.length === 0 && <p className="text-sm text-gray-400">No categories yet.</p>}
        </div>
      </section>

      {/* ── POS Items ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-brown">Items</h2>
          <button onClick={() => { setItemForm(emptyItem); setItemEditId(null); setShowItemForm(v => !v); setShowCatForm(false) }}
            className="text-sm bg-terra text-white px-3 py-1.5 rounded-lg hover:bg-terra-dark transition-colors">
            {showItemForm && !itemEditId ? 'Cancel' : '+ Add Item'}
          </button>
        </div>

        {showItemForm && (
          <form onSubmit={saveItem} className="mb-4 bg-white border border-warm-border rounded-xl p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Item Name *</label>
              <input required value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Chicken Adobo" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select value={itemForm.category_id} onChange={e => setItemForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— Uncategorised —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Selling Price (₱) *</label>
              <input required type="number" min={0} step="0.01" value={itemForm.price}
                onChange={e => setItemForm(f => ({ ...f, price: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cost to Hotel (₱)</label>
              <input type="number" min={0} step="0.01" value={itemForm.cost}
                onChange={e => setItemForm(f => ({ ...f, cost: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
              <p className="text-[10px] text-gray-400 mt-0.5">Used for profit margin reports</p>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Description</label>
              <input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional short description" />
            </div>
            <div className="flex items-center gap-2 col-span-2 sm:col-span-4">
              <input type="checkbox" id="avail" checked={itemForm.is_available}
                onChange={e => setItemForm(f => ({ ...f, is_available: e.target.checked }))}
                className="rounded" />
              <label htmlFor="avail" className="text-sm text-gray-700">Available for sale</label>
            </div>
            <div className="col-span-2 sm:col-span-4 flex gap-2">
              <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
                {itemEditId ? 'Update Item' : 'Add Item'}
              </button>
              <button type="button" onClick={() => { setShowItemForm(false); setItemEditId(null); setItemForm(emptyItem) }}
                className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search items…"
            className="border border-warm-border rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-terra" />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="border border-warm-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-warm-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>{['Item', 'Category', 'Price', 'Cost', 'Margin', 'Status', 'Actions'].map(h =>
                <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {visibleItems.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No items found.</td></tr>}
              {visibleItems.map(i => (
                <tr key={i.id} className={`hover:bg-gray-50 transition-colors ${!i.is_available ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-brown">
                    {i.name}
                    {i.description && <p className="text-xs text-gray-400 font-normal mt-0.5">{i.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{i.pos_categories?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 font-semibold">₱{Number(i.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-gray-500">₱{Number(i.cost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${margin(i) >= 50 ? 'text-green-600' : margin(i) >= 25 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {margin(i)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleAvailable(i.id, i.is_available)}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                        i.is_available ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}>
                      {i.is_available ? 'Available' : 'Unavailable'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => editItem(i)} className="text-xs border text-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                      <button onClick={() => deleteItem(i.id, i.name)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
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
