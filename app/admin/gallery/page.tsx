'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import RetryImg from '@/components/RetryImg'

type GalleryItem = {
  id: string
  title: string | null
  description: string | null
  image_url: string
  category: string
  sort_order: number
  is_active: boolean
}

const CATEGORIES = ['general', 'rooms', 'dining', 'exterior', 'events', 'amenities']

const empty: Omit<GalleryItem, 'id'> = {
  title: '', description: '', image_url: '', category: 'general', sort_order: 0, is_active: true,
}

export default function AdminGalleryPage() {
  const supabase = createClient()
  const [items, setItems] = useState<GalleryItem[]>([])
  const [form, setForm] = useState<Omit<GalleryItem, 'id'>>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('gallery_items').select('*').order('sort_order').order('created_at')
    setItems((data as GalleryItem[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...form, sort_order: Number(form.sort_order) }
    const { error } = editId
      ? await supabase.from('gallery_items').update(payload).eq('id', editId)
      : await supabase.from('gallery_items').insert(payload)
    if (error) { flash(error.message, false); return }
    flash(editId ? 'Photo updated.' : 'Photo added.')
    setForm(empty); setEditId(null); setShowForm(false)
    load()
  }

  function startEdit(item: GalleryItem) {
    setForm({ title: item.title ?? '', description: item.description ?? '', image_url: item.image_url, category: item.category, sort_order: item.sort_order, is_active: item.is_active })
    setEditId(item.id); setShowForm(true)
  }

  async function del(id: string) {
    if (!confirm('Delete this photo?')) return
    const { error } = await supabase.from('gallery_items').delete().eq('id', id)
    if (error) { flash(error.message, false); return }
    flash('Photo deleted.')
    load()
  }

  async function toggle(id: string, current: boolean) {
    await supabase.from('gallery_items').update({ is_active: !current }).eq('id', id)
    load()
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Gallery</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage photos shown on the public website gallery page.</p>
        </div>
        <button onClick={() => { setForm(empty); setEditId(null); setShowForm(v => !v) }}
          className="text-sm bg-terra text-white px-4 py-2 rounded-lg hover:bg-terra-dark transition-colors">
          {showForm && !editId ? 'Cancel' : '+ Add Photo'}
        </button>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${msg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="bg-white border border-warm-border rounded-xl p-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-3">
            <label className="block text-xs font-medium mb-1">Image URL *</label>
            <input required value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
              placeholder="https://..." />
            {form.image_url && (
              <div className="mt-2 h-32 w-full rounded-lg overflow-hidden bg-gray-100">
                <img src={form.image_url} alt="preview" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Title</label>
            <input value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
              placeholder="e.g. Hotel Lobby" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none">
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Sort Order</label>
            <input type="number" min={0} value={form.sort_order}
              onChange={e => setForm(f => ({ ...f, sort_order: +e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none" />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <label className="block text-xs font-medium mb-1">Description</label>
            <input value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
              placeholder="Short caption shown under the photo" />
          </div>
          <div className="col-span-2 sm:col-span-3 flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
            <label htmlFor="active" className="text-sm text-gray-600">Visible on public gallery</label>
          </div>
          <div className="col-span-2 sm:col-span-3 flex gap-2">
            <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
              {editId ? 'Update Photo' : 'Add Photo'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(empty) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading photos…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No gallery photos yet. Add your first photo above.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-warm-border rounded-xl overflow-hidden">
              <div className="relative h-36 bg-gray-100">
                <RetryImg src={item.image_url} alt={item.title ?? ''} className="w-full h-full object-cover" />
                <button onClick={() => toggle(item.id, item.is_active)}
                  className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                  {item.is_active ? 'Live' : 'Hidden'}
                </button>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-brown truncate">{item.title ?? 'Untitled'}</p>
                <p className="text-[10px] text-terra uppercase tracking-widest mt-0.5">{item.category}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => startEdit(item)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => del(item.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
