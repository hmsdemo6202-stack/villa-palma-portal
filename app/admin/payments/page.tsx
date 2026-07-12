'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type PaymentMethod = 'cash' | 'card' | 'gcash' | 'maya' | 'bank_transfer' | 'other'

type Payment = {
  id: string
  reservation_id: string | null
  order_id: string | null
  guest_id: string | null
  amount: number
  method: PaymentMethod
  reference: string | null
  notes: string | null
  paid_at: string
  created_by: string | null
  guests: { full_name: string } | null
  reservations: { id: string } | null
  orders: { id: string } | null
}

type PayForm = {
  guest_id: string
  reservation_id: string
  order_id: string
  amount: string
  method: PaymentMethod
  reference: string
  notes: string
  paid_at: string
}

type Guest = { id: string; full_name: string }
type Reservation = { id: string; guests: { full_name: string } | null; check_in_date: string; rooms: { room_number: string } | null }
type Order = { id: string; guests: { full_name: string } | null; created_at: string }

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',          label: 'Cash' },
  { value: 'card',          label: 'Credit/Debit Card' },
  { value: 'gcash',         label: 'GCash' },
  { value: 'maya',          label: 'Maya' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other',         label: 'Other' },
]

const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash:          'bg-green-100 text-green-700',
  card:          'bg-blue-100 text-blue-700',
  gcash:         'bg-blue-50 text-blue-600',
  maya:          'bg-emerald-100 text-emerald-700',
  bank_transfer: 'bg-purple-100 text-purple-700',
  other:         'bg-gray-100 text-gray-600',
}

function currency(n: number) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const BLANK: PayForm = {
  guest_id: '', reservation_id: '', order_id: '',
  amount: '', method: 'cash', reference: '', notes: '',
  paid_at: new Date().toISOString().slice(0, 16),
}

export default function PaymentsPage() {
  const supabase = createClient()
  const [payments, setPayments]     = useState<Payment[]>([])
  const [guests, setGuests]         = useState<Guest[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [orders, setOrders]         = useState<Order[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState<PayForm>(BLANK)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [filter, setFilter]         = useState<PaymentMethod | 'all'>('all')

  const load = useCallback(async () => {
    const [{ data: pmts }, { data: gs }, { data: res }, { data: ords }] = await Promise.all([
      supabase
        .from('payments')
        .select('id, reservation_id, order_id, guest_id, amount, method, reference, notes, paid_at, created_by, guests(full_name), reservations(id), orders(id)')
        .order('paid_at', { ascending: false }),
      supabase.from('guests').select('id, full_name').order('full_name'),
      supabase
        .from('reservations')
        .select('id, check_in_date, guests(full_name), rooms(room_number)')
        .order('check_in_date', { ascending: false }),
      supabase
        .from('orders')
        .select('id, created_at, guests(full_name)')
        .order('created_at', { ascending: false }),
    ])
    setPayments((pmts as unknown as Payment[]) ?? [])
    setGuests(gs ?? [])
    setReservations((res as unknown as Reservation[]) ?? [])
    setOrders((ords as unknown as Order[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function submit() {
    if (!form.amount || Number(form.amount) <= 0) { setError('Amount must be greater than zero.'); return }
    setSaving(true); setError('')
    const payload = {
      guest_id:       form.guest_id       || null,
      reservation_id: form.reservation_id || null,
      order_id:       form.order_id       || null,
      amount:         Number(form.amount),
      method:         form.method,
      reference:      form.reference.trim() || null,
      notes:          form.notes.trim()    || null,
      paid_at:        new Date(form.paid_at).toISOString(),
    }
    const { error: err } = await supabase.from('payments').insert(payload)
    setSaving(false)
    if (err) { setError(err.message) } else { setShowForm(false); setForm(BLANK); load() }
  }

  const displayed = filter === 'all' ? payments : payments.filter(p => p.method === filter)
  const total = displayed.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Payments</h1>
          <p className="text-sm text-gray-500">Log and track all payment transactions</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm(BLANK); setError('') }}
          className="bg-terra text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra/90 transition-colors"
        >
          + Log Payment
        </button>
      </div>

      {/* Log Payment form */}
      {showForm && (
        <div className="bg-white border border-warm-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-brown">New Payment</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Guest</label>
              <select
                value={form.guest_id}
                onChange={e => setForm(f => ({ ...f, guest_id: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Select guest —</option>
                {guests.map(g => <option key={g.id} value={g.id}>{g.full_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Amount (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
              <select
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm"
              >
                {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date &amp; Time Paid</label>
              <input
                type="datetime-local"
                value={form.paid_at}
                onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Linked Reservation <span className="text-gray-400">(optional)</span></label>
              <select
                value={form.reservation_id}
                onChange={e => setForm(f => ({ ...f, reservation_id: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {reservations.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.guests?.full_name ?? 'Unknown'} · {r.rooms?.room_number ?? '?'} · {fmt(r.check_in_date)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Linked Order <span className="text-gray-400">(optional)</span></label>
              <select
                value={form.order_id}
                onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.guests?.full_name ?? 'Unknown'} · {fmt(o.created_at)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reference No. <span className="text-gray-400">(optional)</span></label>
              <input
                type="text"
                placeholder="Receipt / transaction ref"
                value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
              <input
                type="text"
                placeholder="Any additional notes"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={submit}
              disabled={saving}
              className="bg-terra text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-terra/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Log Payment'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError('') }}
              className="border border-warm-border px-5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter + summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {(['all', ...METHODS.map(m => m.value)] as const).map(m => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filter === m
                  ? 'bg-terra text-white border-terra'
                  : 'bg-white border-warm-border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m === 'all' ? 'All' : METHODS.find(x => x.value === m)?.label ?? m}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500">
          {displayed.length} payment{displayed.length !== 1 ? 's' : ''} · <span className="font-semibold text-brown">{currency(total)}</span>
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">💳</p>
          <p className="font-medium">No payments recorded yet.</p>
          <p className="text-sm mt-1">Click "Log Payment" to record the first transaction.</p>
        </div>
      ) : (
        <div className="bg-white border border-warm-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-border bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Guest</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Linked To</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((p, i) => (
                  <tr key={p.id} className={`border-b border-warm-border/60 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(p.paid_at)}</td>
                    <td className="px-4 py-3 font-medium text-brown">{p.guests?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.reservation_id ? (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Reservation</span>
                      ) : p.order_id ? (
                        <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded">Order</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${METHOD_COLORS[p.method]}`}>
                        {METHODS.find(m => m.value === p.method)?.label ?? p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brown tabular-nums">{currency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-warm-border bg-terra-light/30">
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-600">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-brown tabular-nums">{currency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
