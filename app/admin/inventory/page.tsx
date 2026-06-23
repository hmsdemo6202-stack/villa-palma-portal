'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Department = { id: string; name: string }

type InventoryItem = {
  id: string
  name: string
  unit: string
  unit_cost: number
  quantity_on_hand: number
  reorder_threshold: number
  department_id: string | null
  departments: { name: string } | null
}

type Transaction = {
  id: string
  item_id: string
  tx_type: 'restock' | 'consume' | 'adjustment' | 'waste'
  quantity: number
  unit_cost: number | null
  total_cost: number
  notes: string | null
  created_at: string
  inventory_items: { name: string; unit: string } | null
}

type ItemForm = {
  name: string
  unit: string
  unit_cost: number
  quantity_on_hand: number
  reorder_threshold: number
  department_id: string
}

type StockAction = { itemId: string; itemName: string; unit: string; unitCost: number; type: 'restock' | 'consume' | 'adjustment' | 'waste' }

const emptyForm: ItemForm = { name: '', unit: 'pcs', unit_cost: 0, quantity_on_hand: 0, reorder_threshold: 0, department_id: '' }

const TX_COLORS: Record<string, string> = {
  restock:    'text-green-700',
  consume:    'text-orange-600',
  adjustment: 'text-blue-600',
  waste:      'text-red-600',
}

export default function AdminInventoryPage() {
  const supabase = createClient()

  const [departments, setDepartments] = useState<Department[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [form, setForm] = useState<ItemForm>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deptFilter, setDeptFilter] = useState('')
  const [search, setSearch] = useState('')

  const [stockAction, setStockAction] = useState<StockAction | null>(null)
  const [actionQty, setActionQty] = useState<number>(1)
  const [actionCost, setActionCost] = useState<number>(0)
  const [actionNotes, setActionNotes] = useState('')

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    const [{ data: depts }, { data: its }, { data: txs }] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('inventory_items').select('*, departments(name)').order('name'),
      supabase.from('inventory_transactions')
        .select('*, inventory_items(name, unit)')
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    setDepartments(depts ?? [])
    setItems((its as InventoryItem[]) ?? [])
    setTransactions((txs as Transaction[]) ?? [])
  }, [supabase])

  useEffect(() => { loadAll() }, [loadAll])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  // ── Item CRUD ──────────────────────────────────────────────

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: form.name,
      unit: form.unit,
      unit_cost: Number(form.unit_cost),
      quantity_on_hand: Number(form.quantity_on_hand),
      reorder_threshold: Number(form.reorder_threshold),
      department_id: form.department_id || null,
    }
    const { error: err } = editId
      ? await supabase.from('inventory_items').update(payload).eq('id', editId)
      : await supabase.from('inventory_items').insert(payload)
    if (err) { flash(err.message, false); return }
    setForm(emptyForm); setEditId(null); setShowForm(false)
    flash(editId ? 'Item updated.' : 'Item added.')
    loadAll()
  }

  function startEdit(item: InventoryItem) {
    setForm({
      name: item.name, unit: item.unit, unit_cost: item.unit_cost,
      quantity_on_hand: item.quantity_on_hand, reorder_threshold: item.reorder_threshold,
      department_id: item.department_id ?? '',
    })
    setEditId(item.id); setShowForm(true); setStockAction(null)
  }

  async function deleteItem(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This also deletes its transaction history.`)) return
    const { error: err } = await supabase.from('inventory_items').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Item deleted.')
    loadAll()
  }

  // ── Stock Transactions ──────────────────────────────────────

  function openAction(item: InventoryItem, type: StockAction['type']) {
    setStockAction({ itemId: item.id, itemName: item.name, unit: item.unit, unitCost: item.unit_cost, type })
    setActionQty(1)
    setActionCost(item.unit_cost)
    setActionNotes('')
    setShowForm(false); setEditId(null)
  }

  async function applyAction(e: React.FormEvent) {
    e.preventDefault()
    if (!stockAction) return
    const { data: { user } } = await supabase.auth.getUser()

    const isOut = stockAction.type === 'consume' || stockAction.type === 'waste'
    const delta = isOut ? -Math.abs(actionQty) : Math.abs(actionQty)

    const { data: current } = await supabase
      .from('inventory_items').select('quantity_on_hand').eq('id', stockAction.itemId).single()
    const newQty = Number(current?.quantity_on_hand ?? 0) + delta
    if (newQty < 0) { flash('Cannot go below zero stock.', false); return }

    const [{ error: uErr }, { error: tErr }] = await Promise.all([
      supabase.from('inventory_items').update({ quantity_on_hand: newQty, unit_cost: actionCost || stockAction.unitCost }).eq('id', stockAction.itemId),
      supabase.from('inventory_transactions').insert({
        item_id:    stockAction.itemId,
        tx_type:    stockAction.type,
        quantity:   delta,
        unit_cost:  actionCost || null,
        notes:      actionNotes || null,
        created_by: user?.id ?? null,
      }),
    ])
    if (uErr || tErr) { flash((uErr ?? tErr)?.message ?? 'Error', false); return }

    flash(`${stockAction.type} applied — ${Math.abs(actionQty)} ${stockAction.unit}.`)
    setStockAction(null)
    loadAll()
  }

  const lowStock = items.filter(i => Number(i.quantity_on_hand) <= Number(i.reorder_threshold))

  const visibleItems = items
    .filter(i => !deptFilter || i.department_id === deptFilter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))

  const totalStockValue = items.reduce((s, i) => s + (Number(i.quantity_on_hand) * Number(i.unit_cost)), 0)

  return (
    <div className="space-y-10 max-w-5xl">
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brown">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {items.length} items · {lowStock.length} low stock · Total value: ₱{totalStockValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {/* ── Low Stock Alert ── */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            ⚠ {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} at or below reorder threshold
          </p>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(i => (
              <span key={i.id} className="text-xs bg-amber-100 border border-amber-300 text-amber-800 px-3 py-1 rounded-full">
                {i.name}: {i.quantity_on_hand} {i.unit} (threshold: {i.reorder_threshold})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Items ── */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-brown">Stock Items</h2>
          <button onClick={() => { setForm(emptyForm); setEditId(null); setStockAction(null); setShowForm(v => !v) }}
            className="text-sm bg-terra text-white px-3 py-1.5 rounded-lg hover:bg-terra-dark transition-colors">
            {showForm && !editId ? 'Cancel' : '+ Add Item'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={saveItem} className="mb-4 bg-white border border-warm-border rounded-xl p-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium mb-1">Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Chicken Breast" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Unit *</label>
              <input required value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="kg / pcs / L" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Unit Cost (₱) *</label>
              <input required type="number" min={0} step="0.01" value={form.unit_cost}
                onChange={e => setForm(f => ({ ...f, unit_cost: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">On Hand *</label>
              <input required type="number" min={0} step="0.001" value={form.quantity_on_hand}
                onChange={e => setForm(f => ({ ...f, quantity_on_hand: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Reorder Threshold</label>
              <input type="number" min={0} step="0.001" value={form.reorder_threshold}
                onChange={e => setForm(f => ({ ...f, reorder_threshold: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Department</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-3 flex gap-2">
              <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
                {editId ? 'Update Item' : 'Add Item'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm) }}
                className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        )}

        {stockAction && (
          <form onSubmit={applyAction} className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <p className="text-xs font-semibold text-blue-800 mb-1 capitalize">{stockAction.type}: {stockAction.itemName}</p>
              <label className="block text-xs font-medium mb-1">Quantity ({stockAction.unit})</label>
              <input required type="number" min={0.001} step="0.001" value={actionQty}
                onChange={e => setActionQty(+e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-28" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Unit Cost (₱)</label>
              <input type="number" min={0} step="0.01" value={actionCost}
                onChange={e => setActionCost(+e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-28" />
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium mb-1">Notes</label>
              <input value={actionNotes} onChange={e => setActionNotes(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. weekly delivery, staff meal" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className={`px-4 py-2 rounded-lg text-sm text-white ${
                stockAction.type === 'restock' ? 'bg-green-600 hover:bg-green-700' :
                stockAction.type === 'waste'   ? 'bg-red-600 hover:bg-red-700' :
                stockAction.type === 'adjustment' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'}`}>
                Apply
              </button>
              <button type="button" onClick={() => setStockAction(null)}
                className="border px-3 py-2 rounded-lg text-sm hover:bg-white">Cancel</button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search items…"
            className="border border-warm-border rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-terra" />
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="border border-warm-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-warm-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>{['Item', 'Dept', 'Unit', 'Unit Cost', 'On Hand', 'Value', 'Status', 'Actions'].map(h =>
                <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {visibleItems.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No inventory items.</td></tr>}
              {visibleItems.map(item => {
                const isLow = Number(item.quantity_on_hand) <= Number(item.reorder_threshold)
                const value = Number(item.quantity_on_hand) * Number(item.unit_cost)
                return (
                  <tr key={item.id} className={`hover:bg-gray-50 ${isLow ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-brown">{item.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.departments?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                    <td className="px-4 py-3">₱{Number(item.unit_cost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className={`px-4 py-3 font-semibold ${isLow ? 'text-red-700' : ''}`}>{item.quantity_on_hand}</td>
                    <td className="px-4 py-3 text-gray-600">₱{value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {isLow ? 'Low' : 'OK'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => openAction(item, 'restock')} className="text-xs border border-green-400 text-green-700 px-2 py-0.5 rounded-lg hover:bg-green-50">+In</button>
                        <button onClick={() => openAction(item, 'consume')} className="text-xs border border-orange-400 text-orange-700 px-2 py-0.5 rounded-lg hover:bg-orange-50">Use</button>
                        <button onClick={() => openAction(item, 'waste')}   className="text-xs border border-red-300 text-red-600 px-2 py-0.5 rounded-lg hover:bg-red-50">Waste</button>
                        <button onClick={() => startEdit(item)} className="text-xs border text-blue-600 px-2 py-0.5 rounded-lg hover:bg-blue-50">Edit</button>
                        <button onClick={() => deleteItem(item.id, item.name)} className="text-xs text-red-400 hover:underline">Del</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Transaction Log ── */}
      <section>
        <h2 className="text-lg font-semibold text-brown mb-3">Recent Transactions (last 50)</h2>
        <div className="overflow-x-auto rounded-xl border border-warm-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>{['Item', 'Type', 'Qty', 'Unit Cost', 'Total Cost', 'Notes', 'Date'].map(h =>
                <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {transactions.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No transactions yet.</td></tr>}
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{tx.inventory_items?.name ?? '—'} <span className="text-gray-400 text-xs">{tx.inventory_items?.unit}</span></td>
                  <td className={`px-4 py-3 capitalize font-medium ${TX_COLORS[tx.tx_type] ?? ''}`}>{tx.tx_type}</td>
                  <td className={`px-4 py-3 font-semibold ${Number(tx.quantity) > 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {Number(tx.quantity) > 0 ? '+' : ''}{tx.quantity}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{tx.unit_cost != null ? '₱' + Number(tx.unit_cost).toFixed(2) : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">₱{Number(tx.total_cost).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-400">{tx.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(tx.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
