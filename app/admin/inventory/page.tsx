'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type InventoryItem = {
  id: string
  name: string
  unit: string
  quantity_on_hand: number
  reorder_threshold: number
}

type Transaction = {
  id: string
  inventory_item_id: string
  change_qty: number
  reason: string | null
  created_at: string
  inventory_items: { name: string; unit: string } | null
}

type ItemForm = Omit<InventoryItem, 'id'>

type StockAction = { itemId: string; itemName: string; type: 'restock' | 'consume' }

const emptyForm: ItemForm = { name: '', unit: 'pcs', quantity_on_hand: 0, reorder_threshold: 0 }

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminInventoryPage() {
  const supabase = createClient()

  const [items, setItems] = useState<InventoryItem[]>([])
  const [form, setForm] = useState<ItemForm>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [stockAction, setStockAction] = useState<StockAction | null>(null)
  const [actionQty, setActionQty] = useState<number>(1)
  const [actionReason, setActionReason] = useState('')

  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // ── Data Loading ──────────────────────────────────────────────────────────

  const loadItems = useCallback(async () => {
    const { data } = await supabase.from('inventory_items').select('*').order('name')
    setItems((data as InventoryItem[]) ?? [])
  }, [supabase])

  const loadTransactions = useCallback(async () => {
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*, inventory_items(name, unit)')
      .order('created_at', { ascending: false })
      .limit(30)
    setTransactions((data as Transaction[]) ?? [])
  }, [supabase])

  useEffect(() => { loadItems(); loadTransactions() }, [loadItems, loadTransactions])

  function flash(msg: string, ok = true) {
    if (ok) setSuccessMsg(msg); else setError(msg)
    setTimeout(() => { setSuccessMsg(null); setError(null) }, 4000)
  }

  // ── Item CRUD ──────────────────────────────────────────────────────────────

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const payload = {
      ...form,
      quantity_on_hand: Number(form.quantity_on_hand),
      reorder_threshold: Number(form.reorder_threshold),
    }
    const { error: err } = editId
      ? await supabase.from('inventory_items').update(payload).eq('id', editId)
      : await supabase.from('inventory_items').insert(payload)
    if (err) { setError(err.message); return }
    setForm(emptyForm); setEditId(null); setShowForm(false)
    flash(editId ? 'Item updated.' : 'Item added.')
    loadItems()
  }

  function startEdit(item: InventoryItem) {
    setForm({ name: item.name, unit: item.unit, quantity_on_hand: item.quantity_on_hand, reorder_threshold: item.reorder_threshold })
    setEditId(item.id); setShowForm(true); setStockAction(null)
  }

  async function deleteItem(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This also deletes its transaction history.`)) return
    const { error: err } = await supabase.from('inventory_items').delete().eq('id', id)
    if (err) { setError(err.message); return }
    flash('Item deleted.')
    loadItems(); loadTransactions()
  }

  // ── Restock / Consume ──────────────────────────────────────────────────────

  function openStockAction(item: InventoryItem, type: 'restock' | 'consume') {
    setStockAction({ itemId: item.id, itemName: item.name, type })
    setActionQty(1)
    setActionReason('')
    setShowForm(false); setEditId(null)
  }

  async function applyStockAction(e: React.FormEvent) {
    e.preventDefault()
    if (!stockAction) return
    setError(null)

    const delta = stockAction.type === 'restock' ? Math.abs(actionQty) : -Math.abs(actionQty)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: current } = await supabase
      .from('inventory_items')
      .select('quantity_on_hand')
      .eq('id', stockAction.itemId)
      .single()

    const newQty = Number(current?.quantity_on_hand ?? 0) + delta
    if (newQty < 0) { setError('Cannot consume more than available stock.'); return }

    const [{ error: updateErr }, { error: txErr }] = await Promise.all([
      supabase.from('inventory_items').update({ quantity_on_hand: newQty }).eq('id', stockAction.itemId),
      supabase.from('inventory_transactions').insert({
        inventory_item_id: stockAction.itemId,
        change_qty: delta,
        reason: actionReason || (stockAction.type === 'restock' ? 'manual restock' : 'manual consume'),
        created_by: user?.id ?? null,
      }),
    ])

    if (updateErr || txErr) { setError((updateErr ?? txErr)?.message ?? 'Error'); return }

    flash(`${stockAction.type === 'restock' ? 'Restocked' : 'Consumed'} ${Math.abs(actionQty)} units of ${stockAction.itemName}.`)
    setStockAction(null)
    loadItems(); loadTransactions()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const lowStock = items.filter(i => i.quantity_on_hand <= i.reorder_threshold)

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">Inventory</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">{successMsg}</div>
      )}

      {/* ── Low-Stock Alert Band ── */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            ⚠ {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} at or below reorder threshold
          </p>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(i => (
              <span key={i.id}
                className="text-xs bg-amber-100 border border-amber-300 text-amber-800 px-3 py-1 rounded-full">
                {i.name}: {i.quantity_on_hand} {i.unit} (threshold: {i.reorder_threshold})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Items Table ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Stock Items</h2>
          <button
            onClick={() => { setForm(emptyForm); setEditId(null); setStockAction(null); setShowForm(v => !v) }}
            className="text-sm bg-terra text-white px-3 py-1.5 rounded-lg hover:bg-terra-dark transition-colors">
            {showForm && !editId ? 'Cancel' : '+ Add Item'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={saveItem} className="mb-4 bg-gray-50 border rounded-lg p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Chicken Breast" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Unit *</label>
              <input required value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="kg / pcs / liters" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">On Hand *</label>
              <input required type="number" min={0} step="0.01" value={form.quantity_on_hand}
                onChange={e => setForm(f => ({ ...f, quantity_on_hand: +e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Reorder Threshold</label>
              <input type="number" min={0} step="0.01" value={form.reorder_threshold}
                onChange={e => setForm(f => ({ ...f, reorder_threshold: +e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" />
              <p className="text-xs text-gray-400 mt-0.5">Alert shows when on-hand ≤ this</p>
            </div>
            <div className="col-span-2 sm:col-span-4 flex gap-2">
              <button type="submit" className="bg-terra text-white px-4 py-2 rounded-lg text-sm hover:bg-terra-dark transition-colors">
                {editId ? 'Update Item' : 'Add Item'}
              </button>
              <button type="button"
                onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm) }}
                className="border px-4 py-2 rounded text-sm hover:bg-gray-100">Cancel</button>
            </div>
          </form>
        )}

        {stockAction && (
          <form onSubmit={applyStockAction}
            className="mb-4 border rounded-lg p-4 flex flex-wrap gap-3 items-end bg-blue-50 border-blue-200">
            <div>
              <p className="text-xs font-semibold text-blue-800 mb-1">
                {stockAction.type === 'restock' ? 'Restock' : 'Consume'}: {stockAction.itemName}
              </p>
              <label className="block text-xs font-medium mb-1">Quantity</label>
              <input required type="number" min={0.01} step="0.01" value={actionQty}
                onChange={e => setActionQty(+e.target.value)}
                className="border rounded px-3 py-2 text-sm w-28" />
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium mb-1">Reason (optional)</label>
              <input value={actionReason} onChange={e => setActionReason(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder={stockAction.type === 'restock' ? 'e.g. weekly delivery' : 'e.g. staff meal'} />
            </div>
            <div className="flex gap-2">
              <button type="submit"
                className={`px-4 py-2 rounded text-sm text-white ${stockAction.type === 'restock' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'}`}>
                {stockAction.type === 'restock' ? '+ Add Stock' : '− Remove Stock'}
              </button>
              <button type="button" onClick={() => setStockAction(null)}
                className="border px-3 py-2 rounded text-sm hover:bg-white">Cancel</button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-left">
              <tr>
                {['Item', 'Unit', 'On Hand', 'Threshold', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No inventory items yet. Add items to start tracking stock.
                </td></tr>
              )}
              {items.map(item => {
                const isLow = item.quantity_on_hand <= item.reorder_threshold
                return (
                  <tr key={item.id} className={`hover:bg-gray-50 ${isLow ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                    <td className={`px-4 py-3 font-semibold ${isLow ? 'text-red-700' : 'text-gray-900'}`}>
                      {item.quantity_on_hand}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.reorder_threshold}</td>
                    <td className="px-4 py-3">
                      {isLow ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Low</span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => openStockAction(item, 'restock')}
                          className="text-xs border border-green-400 text-green-700 px-2.5 py-1 rounded-lg hover:bg-green-50">
                          Restock
                        </button>
                        <button onClick={() => openStockAction(item, 'consume')}
                          className="text-xs border border-orange-400 text-orange-700 px-2.5 py-1 rounded-lg hover:bg-orange-50">
                          Consume
                        </button>
                        <button onClick={() => startEdit(item)}
                          className="text-xs border text-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-50">
                          Edit
                        </button>
                        <button onClick={() => deleteItem(item.id, item.name)}
                          className="text-xs text-red-500 hover:underline">
                          Delete
                        </button>
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
        <h2 className="text-lg font-semibold mb-3">Recent Transactions (last 30)</h2>
        <p className="text-xs text-gray-400 mb-3">
          Auto-generated rows appear here when food is ordered and ingredients are linked via <code>menu_item_ingredients</code>.
          Manual restock/consume rows are added above.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-left">
              <tr>
                {['Item', 'Change', 'Reason', 'Date'].map(h => (
                  <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {transactions.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No transactions yet.</td></tr>
              )}
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {tx.inventory_items?.name ?? '—'}
                    <span className="text-gray-400 text-xs ml-1">{tx.inventory_items?.unit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${Number(tx.change_qty) > 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {Number(tx.change_qty) > 0 ? '+' : ''}{tx.change_qty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{tx.reason ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                    {new Date(tx.created_at).toLocaleString('en-PH', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
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
