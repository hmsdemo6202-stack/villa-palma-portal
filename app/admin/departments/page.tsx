'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Department = { id: string; name: string; description: string | null; created_at: string }
type DeptForm = { name: string; description: string }
const emptyForm: DeptForm = { name: '', description: '' }

export default function AdminDepartmentsPage() {
  const supabase = createClient()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<DeptForm>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepartments(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  function openAdd() { setForm(emptyForm); setEditId(null); setShowForm(true) }

  function openEdit(d: Department) {
    setForm({ name: d.name, description: d.description ?? '' })
    setEditId(d.id); setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = { name: form.name, description: form.description || null }
    const { error: err } = editId
      ? await supabase.from('departments').update(payload).eq('id', editId)
      : await supabase.from('departments').insert(payload)
    if (err) { flash(err.message, false); setSaving(false); return }
    flash(editId ? 'Department updated.' : 'Department added.')
    setSaving(false); setShowForm(false); setEditId(null); setForm(emptyForm)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete department "${name}"? Users and inventory items linked to it will lose their department assignment.`)) return
    const { error: err } = await supabase.from('departments').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Department deleted.')
    load()
  }

  if (loading) return <div className="text-gray-400">Loading departments…</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Departments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{departments.length} departments</p>
        </div>
        <button onClick={openAdd}
          className="bg-terra text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark transition-colors">
          + Add Department
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-warm-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-brown">{editId ? 'Edit Department' : 'Add Department'}</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Department Name *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
              placeholder="e.g. Housekeeping" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
              placeholder="Optional description of responsibilities" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-terra text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Department'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {departments.length === 0 && <p className="text-center text-gray-400 py-8">No departments yet.</p>}
        {departments.map(d => (
          <div key={d.id} className="bg-white border border-warm-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-1">
              <p className="font-semibold text-brown">{d.name}</p>
              <span className="text-xs text-gray-400 shrink-0 ml-2">
                {new Date(d.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            {d.description && <p className="text-xs text-gray-500 mt-1">{d.description}</p>}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button onClick={() => openEdit(d)} className="flex-1 text-xs border text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50">Edit</button>
              <button onClick={() => handleDelete(d.id, d.name)} className="flex-1 text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-warm-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>{['Department', 'Description', 'Created', 'Actions'].map(h =>
              <th key={h} className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {departments.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No departments yet.</td></tr>
            )}
            {departments.map(d => (
              <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-semibold text-brown">{d.name}</td>
                <td className="px-4 py-3 text-gray-500">{d.description ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(d.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(d)} className="text-xs border text-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                    <button onClick={() => handleDelete(d.id, d.name)} className="text-xs border border-red-200 text-red-500 px-2.5 py-1 rounded-lg hover:bg-red-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
