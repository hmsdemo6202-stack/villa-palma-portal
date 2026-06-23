'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Department = { id: string; name: string }

type Expense = {
  id: string
  department_id: string | null
  category: string
  description: string
  amount: number
  expense_date: string
  notes: string | null
  created_at: string
  departments: { name: string } | null
}

type ExpenseForm = {
  department_id: string
  category: string
  description: string
  amount: number
  expense_date: string
  notes: string
}

const EXPENSE_CATEGORIES = [
  'Utilities', 'Supplies', 'Repairs & Maintenance', 'Salaries & Wages',
  'Food & Ingredients', 'Cleaning Products', 'Laundry', 'Marketing',
  'Equipment', 'Transportation', 'Insurance', 'Other'
]

function emptyForm(): ExpenseForm {
  return {
    department_id: '', category: '', description: '', amount: 0,
    expense_date: new Date().toISOString().split('T')[0], notes: ''
  }
}

export default function AdminExpensesPage() {
  const supabase = createClient()
  const [departments, setDepartments] = useState<Department[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const [deptFilter, setDeptFilter] = useState('')
  const [catFilter, setCatFilter]   = useState('')
  const [monthFilter, setMonthFilter] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: depts }, { data: exps }] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('expenses')
        .select('*, departments(name)')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200),
    ])
    setDepartments(depts ?? [])
    setExpenses((exps as Expense[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  function openAdd() { setForm(emptyForm()); setEditId(null); setShowForm(true) }

  function openEdit(e: Expense) {
    setForm({
      department_id: e.department_id ?? '', category: e.category,
      description: e.description, amount: e.amount,
      expense_date: e.expense_date, notes: e.notes ?? ''
    })
    setEditId(e.id); setShowForm(true)
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      department_id: form.department_id || null,
      category:      form.category,
      description:   form.description,
      amount:        Number(form.amount),
      expense_date:  form.expense_date,
      notes:         form.notes || null,
      created_by:    user?.id ?? null,
    }
    const { error: err } = editId
      ? await supabase.from('expenses').update(payload).eq('id', editId)
      : await supabase.from('expenses').insert(payload)
    if (err) { flash(err.message, false); setSaving(false); return }
    flash(editId ? 'Expense updated.' : 'Expense logged.')
    setSaving(false); setShowForm(false); setEditId(null); setForm(emptyForm())
    load()
  }

  async function handleDelete(id: string, desc: string) {
    if (!confirm(`Delete expense "${desc}"?`)) return
    const { error: err } = await supabase.from('expenses').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Expense deleted.')
    load()
  }

  // ── Filtering & Totals ──────────────────────────────────────

  const visible = expenses.filter(e => {
    if (deptFilter && e.department_id !== deptFilter) return false
    if (catFilter  && e.category !== catFilter) return false
    if (monthFilter && !e.expense_date.startsWith(monthFilter)) return false
    return true
  })

  const totalFiltered = visible.reduce((s, e) => s + Number(e.amount), 0)

  // Per-department totals (visible rows only)
  const deptTotals = departments.map(d => ({
    name: d.name,
    total: visible.filter(e => e.department_id === d.id).reduce((s, e) => s + Number(e.amount), 0),
  })).filter(d => d.total > 0).sort((a, b) => b.total - a.total)

  const months = [...new Set(expenses.map(e => e.expense_date.slice(0, 7)))].sort().reverse()

  if (loading) return <div className="text-gray-400">Loading expenses…</div>

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">{expenses.length} records</p>
        </div>
        <button onClick={openAdd}
          className="bg-terra text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark transition-colors">
          + Log Expense
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {/* ── Log / Edit Form ── */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-warm-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-brown">{editId ? 'Edit Expense' : 'Log New Expense'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="">— Select —</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₱) *</label>
              <input required type="number" min={0.01} step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input required type="date" value={form.expense_date}
                onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
              <input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="e.g. Monthly electric bill – Housekeeping wing" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="Receipt number, vendor, etc." />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-terra text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Log Expense'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm()) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {/* ── Dept Totals Summary ── */}
      {deptTotals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {deptTotals.map(d => (
            <div key={d.name} className="bg-white border border-warm-border rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{d.name}</p>
              <p className="text-lg font-bold text-brown">₱{d.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
            </div>
          ))}
          <div className="bg-terra-light border border-[#f0c8aa] rounded-xl p-4">
            <p className="text-xs text-terra mb-1">Total {monthFilter ? `(${monthFilter})` : '(filtered)'}</p>
            <p className="text-lg font-bold text-terra">₱{totalFiltered.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="border border-warm-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="border border-warm-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
          className="border border-warm-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {(deptFilter || catFilter || monthFilter) && (
          <button onClick={() => { setDeptFilter(''); setCatFilter(''); setMonthFilter('') }}
            className="text-xs text-terra hover:underline px-2">Clear filters</button>
        )}
      </div>

      {/* ── Expenses Table ── */}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {visible.length === 0 && <p className="text-center text-gray-400 py-8">No expenses found.</p>}
        {visible.map(e => (
          <div key={e.id} className="bg-white border border-warm-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-brown text-sm leading-snug">{e.description}</p>
                {e.notes && <p className="text-xs text-gray-400 mt-0.5">{e.notes}</p>}
              </div>
              <p className="font-bold text-red-700 text-sm ml-3 shrink-0">
                ₱{Number(e.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2">
              <span className="text-gray-400">Date</span>
              <span className="text-brown">{new Date(e.expense_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span className="text-gray-400">Department</span>
              <span className="text-brown">{e.departments?.name ?? '—'}</span>
              <span className="text-gray-400">Category</span>
              <span className="text-brown">{e.category}</span>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button onClick={() => openEdit(e)} className="flex-1 text-xs border text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50">Edit</button>
              <button onClick={() => handleDelete(e.id, e.description)} className="flex-1 text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
        {visible.length > 0 && (
          <div className="flex justify-between items-center bg-gray-50 border border-warm-border rounded-xl px-4 py-3">
            <span className="text-sm font-semibold text-gray-600">Total</span>
            <span className="font-bold text-red-700">₱{totalFiltered.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-warm-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>{['Date', 'Department', 'Category', 'Description', 'Amount', 'Actions'].map(h =>
              <th key={h} className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {visible.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No expenses found.</td></tr>}
            {visible.map(e => (
              <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {new Date(e.expense_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{e.departments?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{e.category}</span>
                </td>
                <td className="px-4 py-3 text-brown">
                  {e.description}
                  {e.notes && <p className="text-xs text-gray-400 mt-0.5">{e.notes}</p>}
                </td>
                <td className="px-4 py-3 font-semibold text-red-700">
                  ₱{Number(e.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(e)} className="text-xs border text-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                    <button onClick={() => handleDelete(e.id, e.description)} className="text-xs border border-red-200 text-red-500 px-2.5 py-1 rounded-lg hover:bg-red-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {visible.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-600 text-right">Total:</td>
                <td className="px-4 py-3 font-bold text-red-700">
                  ₱{totalFiltered.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
