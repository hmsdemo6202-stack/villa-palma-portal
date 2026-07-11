'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Promotion = {
  id: string
  title: string
  description: string | null
  discount_pct: number | null
  promo_code: string | null
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  image_url: string | null
}

const empty: Omit<Promotion, 'id'> = {
  title: '', description: '', discount_pct: null, promo_code: '', valid_from: '', valid_until: '', is_active: true, image_url: '',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminPromotionsPage() {
  const supabase = createClient()
  const [items, setItems] = useState<Promotion[]>([])
  const [form, setForm] = useState<Omit<Promotion, 'id'>>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('promotions').select('*').order('created_at', { ascending: false })
    setItems((data as Promotion[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      discount_pct: form.discount_pct ? Number(form.discount_pct) : null,
      promo_code: form.promo_code || null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      image_url: form.image_url || null,
      description: form.description || null,
    }
    const { error } = editId
      ? await supabase.from('promotions').update(payload).eq('id', editId)
      : await supabase.from('promotions').insert(payload)
    if (error) { flash(error.message, false); return }
    flash(editId ? 'Promotion updated.' : 'Promotion created.')
    setForm(empty); setEditId(null); setShowForm(false)
    load()
  }

  function startEdit(p: Promotion) {
    setForm({ title: p.title, description: p.description ?? '', discount_pct: p.discount_pct, promo_code: p.promo_code ?? '', valid_from: p.valid_from ?? '', valid_until: p.valid_until ?? '', is_active: p.is_active, image_url: p.image_url ?? '' })
    setEditId(p.id); setShowForm(true)
  }

  async function del(id: string) {
    if (!confirm('Delete this promotion?')) return
    const { error } = await supabase.from('promotions').delete().eq('id', id)
    if (error) { flash(error.message, false); return }
    flash('Promotion deleted.')
    load()
  }

  async function toggle(id: string, current: boolean) {
    await supabase.from('promotions').update({ is_active: !current }).eq('id', id)
    load()
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Promotions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage special offers and discount codes shown on the website.</p>
        </div>
        <button onClick={() => { setForm(empty); setEditId(null); setShowForm(v => !v) }}
          className="text-sm bg-terra text-white px-4 py-2 rounded-lg hover:bg-terra-dark transition-colors">
          {showForm && !editId ? 'Cancel' : '+ New Promotion'}
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
            <label className="block text-xs font-medium mb-1">Title *</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
              placeholder="e.g. Weekend Getaway Special" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Discount (%)</label>
            <input type="number" min={0} max={100} step={0.01} value={form.discount_pct ?? ''}
              onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value ? +e.target.value : null }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
              placeholder="e.g. 20" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Promo Code</label>
            <input value={form.promo_code ?? ''} onChange={e => setForm(f => ({ ...f, promo_code: e.target.value.toUpperCase() }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-terra focus:outline-none"
              placeholder="e.g. SUMMER25" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Image URL</label>
            <input value={form.image_url ?? ''} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
              placeholder="https://..." />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Valid From</label>
            <input type="date" value={form.valid_from ?? ''} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Valid Until</label>
            <input type="date" value={form.valid_until ?? ''} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none" />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <label className="block text-xs font-medium mb-1">Description</label>
            <textarea rows={3} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none resize-none"
              placeholder="What does this promotion include?" />
          </div>
          <div className="col-span-2 sm:col-span-3 flex items-center gap-2">
            <input type="checkbox" id="pactive" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
            <label htmlFor="pactive" className="text-sm text-gray-600">Active (visible on website)</label>
          </div>
          <div className="col-span-2 sm:col-span-3 flex gap-2">
            <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
              {editId ? 'Update Promotion' : 'Create Promotion'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(empty) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading promotions…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No promotions yet. Create your first above.</p>
      ) : (
        <div className="space-y-3">
          {items.map(p => (
            <div key={p.id} className="bg-white border border-warm-border rounded-xl p-4 flex flex-wrap items-start gap-4">
              {p.image_url && (
                <div className="w-24 h-16 rounded-lg overflow-hidden shrink-0">
                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-brown">{p.title}</span>
                  {p.discount_pct && <span className="text-xs bg-terra text-white px-2 py-0.5 rounded-full font-bold">{p.discount_pct}% OFF</span>}
                  <button onClick={() => toggle(p.id, p.is_active)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
                {p.description && <p className="text-sm text-gray-500 mb-1 line-clamp-2">{p.description}</p>}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                  {p.promo_code && <span className="font-mono font-bold text-terra">Code: {p.promo_code}</span>}
                  <span>Valid: {fmt(p.valid_from)} — {fmt(p.valid_until)}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(p)} className="text-xs border text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50">Edit</button>
                <button onClick={() => del(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
