'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type FAQ = {
  id: string
  question: string
  answer: string
  category: string
  sort_order: number
  is_active: boolean
}

const empty: Omit<FAQ, 'id'> = {
  question: '', answer: '', category: 'General', sort_order: 0, is_active: true,
}

export default function AdminFAQsPage() {
  const supabase = createClient()
  const [items, setItems] = useState<FAQ[]>([])
  const [form, setForm] = useState<Omit<FAQ, 'id'>>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('faqs').select('*').order('sort_order').order('created_at')
    setItems((data as FAQ[]) ?? [])
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
      ? await supabase.from('faqs').update(payload).eq('id', editId)
      : await supabase.from('faqs').insert(payload)
    if (error) { flash(error.message, false); return }
    flash(editId ? 'FAQ updated.' : 'FAQ added.')
    setForm(empty); setEditId(null); setShowForm(false)
    load()
  }

  function startEdit(f: FAQ) {
    setForm({ question: f.question, answer: f.answer, category: f.category, sort_order: f.sort_order, is_active: f.is_active })
    setEditId(f.id); setShowForm(true)
  }

  async function del(id: string) {
    if (!confirm('Delete this FAQ?')) return
    const { error } = await supabase.from('faqs').delete().eq('id', id)
    if (error) { flash(error.message, false); return }
    flash('FAQ deleted.')
    load()
  }

  async function toggle(id: string, current: boolean) {
    await supabase.from('faqs').update({ is_active: !current }).eq('id', id)
    load()
  }

  const categories = Array.from(new Set(items.map(i => i.category)))

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">FAQs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage frequently asked questions shown on the website.</p>
        </div>
        <button onClick={() => { setForm(empty); setEditId(null); setShowForm(v => !v) }}
          className="text-sm bg-terra text-white px-4 py-2 rounded-lg hover:bg-terra-dark transition-colors">
          {showForm && !editId ? 'Cancel' : '+ Add FAQ'}
        </button>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${msg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="bg-white border border-warm-border rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Question *</label>
            <input required value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
              placeholder="What time is check-in?" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Answer *</label>
            <textarea required rows={4} value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none resize-none"
              placeholder="Check-in is at 2:00 PM…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                list="faq-cats"
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none"
                placeholder="e.g. Policies" />
              <datalist id="faq-cats">
                {['General', 'Policies', 'Dining', 'Amenities', 'Transportation'].map(c => <option key={c} value={c} />)}
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Sort Order</label>
              <input type="number" min={0} step={10} value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: +e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-terra focus:outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="faqactive" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
            <label htmlFor="faqactive" className="text-sm text-gray-600">Visible on website</label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
              {editId ? 'Update FAQ' : 'Add FAQ'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(empty) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading FAQs…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No FAQs yet. Add your first above.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-warm-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>{['#', 'Question', 'Category', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y bg-white">
              {items.map((f, i) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{f.sort_order || i + 1}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-brown truncate">{f.question}</p>
                    <p className="text-gray-400 text-xs truncate mt-0.5">{f.answer}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{f.category}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggle(f.id, f.is_active)}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium cursor-pointer ${f.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {f.is_active ? 'Visible' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(f)} className="text-xs text-blue-600 border px-2.5 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                      <button onClick={() => del(f.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
