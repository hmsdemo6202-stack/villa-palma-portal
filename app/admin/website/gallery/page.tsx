'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

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
const BUCKET = 'gallery-images'

const empty: Omit<GalleryItem, 'id'> = {
  title: '', description: '', image_url: '', category: 'general', sort_order: 0, is_active: true,
}

export default function WebsiteGalleryPage() {
  const supabase = createClient()
  const [items, setItems] = useState<GalleryItem[]>([])
  const [form, setForm] = useState<Omit<GalleryItem, 'id'>>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [catFilter, setCatFilter] = useState<string>('all')
  const fileRef = useRef<HTMLInputElement>(null)

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

  async function uploadFile(file: File) {
    setUploading(true)
    const ext  = file.name.split('.').pop() || 'jpg'
    const path = `${form.category || 'general'}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (upErr) { flash(upErr.message, false); setUploading(false); return }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    setForm(f => ({ ...f, image_url: pub.publicUrl }))
    setUploading(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.image_url) { flash('Please provide an image URL or upload a file.', false); return }
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  const filtered = catFilter === 'all' ? items : items.filter(i => i.category === catFilter)

  const inp = 'w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra'

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Gallery</h1>
          <p className="text-sm text-gray-500 mt-0.5">Photos shown on the public website gallery page.</p>
        </div>
        <button
          onClick={() => { setForm(empty); setEditId(null); setShowForm(v => !v) }}
          className="text-sm bg-terra text-white px-4 py-2 rounded-lg hover:bg-terra-dark transition-colors"
        >
          {showForm && !editId ? 'Cancel' : '+ Add Photo'}
        </button>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${msg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="bg-white border border-warm-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-brown">{editId ? 'Edit Photo' : 'Add New Photo'}</h2>

          {/* Image input — URL or upload */}
          <div>
            <label className="block text-xs font-medium text-brown mb-1">Image *</label>
            <div className="flex gap-2">
              <input
                value={form.image_url}
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                placeholder="Paste a URL, or upload a file →"
                className={`${inp} flex-1`}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="shrink-0 border border-warm-border px-3 py-2 rounded-lg text-xs text-brown-mid hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : '↑ Upload File'}
              </button>
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }}
              />
            </div>
            {form.image_url && (
              <div className="mt-2 h-36 w-full rounded-lg overflow-hidden bg-gray-100">
                <img src={form.image_url} alt="preview" className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-brown mb-1">Title</label>
              <input value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Hotel Lobby" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-brown mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className={inp}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-brown mb-1">Sort Order</label>
              <input type="number" min={0} value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: +e.target.value }))}
                className={inp} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-brown mb-1">Description</label>
            <input value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Short caption shown under the photo"
              className={inp} />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
            <label htmlFor="active" className="text-sm text-gray-600">Visible on public gallery</label>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
              {editId ? 'Update Photo' : 'Add Photo'}
            </button>
            <button type="button"
              onClick={() => { setShowForm(false); setEditId(null); setForm(empty) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {['all', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
              catFilter === c ? 'bg-terra text-white border-terra' : 'border-warm-border text-brown-mid hover:bg-gray-50'
            }`}>
            {c === 'all' ? `All (${items.length})` : `${c} (${items.filter(i => i.category === c).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No photos in this category yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="bg-white border border-warm-border rounded-xl overflow-hidden group">
              <div className="relative h-36 bg-gray-100">
                <img src={item.image_url} alt={item.title ?? ''} className="w-full h-full object-cover" />
                {/* Delete on hover */}
                <button
                  onClick={() => del(item.id)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow text-base leading-none"
                  title="Delete photo"
                >×</button>
                <button
                  onClick={() => toggle(item.id, item.is_active)}
                  className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full font-medium cursor-pointer ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                >
                  {item.is_active ? 'Live' : 'Hidden'}
                </button>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-brown truncate">{item.title ?? 'Untitled'}</p>
                <p className="text-[10px] text-terra uppercase tracking-widest mt-0.5">{item.category}</p>
                <button onClick={() => startEdit(item)} className="text-xs text-blue-600 hover:underline mt-1.5 block">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
