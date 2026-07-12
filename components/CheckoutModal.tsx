'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Order = { id: string; status: string; total_amount: number }
type Charge = { id: string; description: string; amount: number }

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya', label: 'Maya' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
]

function currency(n: number) { return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2 }) }

export default function CheckoutModal({
  reservation, onClose, onComplete,
}: {
  reservation: {
    id: string
    guest_id: string
    room_id: string
    total_amount: number | null
    guests: { full_name: string } | null
    rooms: { room_number: string; room_types: { name: string } | null } | null
    check_in_date: string
    check_out_date: string
    nights: number
  }
  onClose: () => void
  onComplete: () => void
}) {
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [loading, setLoading] = useState(true)
  const [newDesc, setNewDesc] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const load = useCallback(async () => {
    const [{ data: os }, { data: cs }] = await Promise.all([
      supabase.from('orders').select('id, status, total_amount').eq('reservation_id', reservation.id),
      supabase.from('reservation_charges').select('id, description, amount').eq('reservation_id', reservation.id).order('created_at'),
    ])
    setOrders((os ?? []).filter(o => o.status !== 'cancelled'))
    setCharges(cs ?? [])
    setLoading(false)
  }, [supabase, reservation.id])

  useEffect(() => { load() }, [load])

  const roomCharge = reservation.total_amount ?? 0
  const ordersTotal = orders.reduce((s, o) => s + Number(o.total_amount), 0)
  const extrasTotal = charges.reduce((s, c) => s + Number(c.amount), 0)
  const grandTotal = roomCharge + ordersTotal + extrasTotal

  async function addCharge() {
    const amount = Number(newAmount)
    if (!newDesc.trim() || !amount || amount <= 0) return
    const { data, error: err } = await supabase
      .from('reservation_charges')
      .insert({ reservation_id: reservation.id, description: newDesc.trim(), amount })
      .select('id, description, amount')
      .single()
    if (err) { setError(err.message); return }
    if (data) setCharges(prev => [...prev, data])
    setNewDesc(''); setNewAmount('')
  }

  async function removeCharge(id: string) {
    await supabase.from('reservation_charges').delete().eq('id', id)
    setCharges(prev => prev.filter(c => c.id !== id))
  }

  async function receivePaymentAndCheckOut() {
    setSaving(true)
    setError(null)

    const { error: payErr } = await supabase.from('payments').insert({
      reservation_id: reservation.id,
      guest_id: reservation.guest_id,
      amount: grandTotal,
      method,
      reference: reference || null,
      notes: 'Checkout payment',
    })
    if (payErr) { setError(payErr.message); setSaving(false); return }

    const { error: resErr } = await supabase
      .from('reservations')
      .update({ status: 'checked_out', actual_check_out: new Date().toISOString() })
      .eq('id', reservation.id)
    if (resErr) { setError(resErr.message); setSaving(false); return }

    await supabase.from('rooms').update({ status: 'dirty' }).eq('id', reservation.room_id)

    setSaving(false)
    setDone(true)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()} id="bill">
        <div className="print:hidden flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-brown">{done ? 'Checked Out' : 'Checkout & Billing'}</h2>
            <p className="text-xs text-gray-400">
              {reservation.guests?.full_name ?? 'Guest'} — {reservation.rooms?.room_types?.name} (Room {reservation.rooms?.room_number})
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {error && <div className="print:hidden bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm mb-4">{error}</div>}

        {done ? (
          <>
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4 print:hidden">
              ✓ Payment received. Room marked dirty for housekeeping.
            </div>
            <BillSummary reservation={reservation} roomCharge={roomCharge} orders={orders} charges={charges} grandTotal={grandTotal} method={method} />
            <div className="print:hidden flex gap-2 mt-4">
              <button onClick={() => window.print()} className="flex-1 border border-terra text-terra py-2.5 rounded-lg text-sm font-medium hover:bg-terra-light/20">
                Print Bill
              </button>
              <button onClick={() => { onClose(); onComplete() }} className="flex-1 bg-terra text-white py-2.5 rounded-lg text-sm font-medium hover:bg-terra-dark">
                Done
              </button>
            </div>
          </>
        ) : loading ? (
          <p className="text-gray-400 text-sm">Loading folio…</p>
        ) : (
          <div className="print:hidden">
            <BillSummary reservation={reservation} roomCharge={roomCharge} orders={orders} charges={charges} grandTotal={grandTotal} method={method} hideMethod />

            <div className="border border-warm-border rounded-lg p-3 mt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Add Extra Charge (minibar, laundry, extra bed, late checkout…)</p>
              <div className="flex gap-2">
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description"
                  className="flex-1 border border-warm-border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
                <input value={newAmount} onChange={e => setNewAmount(e.target.value)} type="number" min={0} step="0.01" placeholder="₱"
                  className="w-24 border border-warm-border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
                <button onClick={addCharge} className="bg-terra text-white px-3 rounded-lg text-sm hover:bg-terra-dark">Add</button>
              </div>
              {charges.map(c => (
                <div key={c.id} className="flex justify-between items-center text-xs text-gray-600 mt-2">
                  <span>{c.description} — {currency(c.amount)}</span>
                  <button onClick={() => removeCharge(c.id)} className="text-red-500 hover:underline">Remove</button>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
              <select value={method} onChange={e => setMethod(e.target.value)}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Reference (optional)</label>
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Transaction / receipt reference"
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>

            <button onClick={receivePaymentAndCheckOut} disabled={saving}
              className="w-full bg-terra text-white py-3 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 mt-5">
              {saving ? 'Processing…' : `Receive Payment (${currency(grandTotal)}) & Check Out`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function BillSummary({ reservation, roomCharge, orders, charges, grandTotal, method, hideMethod }: {
  reservation: { check_in_date: string; check_out_date: string; nights: number }
  roomCharge: number
  orders: Order[]
  charges: Charge[]
  grandTotal: number
  method: string
  hideMethod?: boolean
}) {
  return (
    <div className="border border-warm-border rounded-lg p-4 space-y-2 text-sm">
      <div className="flex justify-between text-gray-600">
        <span>Room charge ({reservation.nights} night{reservation.nights !== 1 ? 's' : ''})</span>
        <span className="font-medium text-brown">{currency(roomCharge)}</span>
      </div>
      {orders.map(o => (
        <div key={o.id} className="flex justify-between text-gray-600">
          <span>Food &amp; beverage order</span>
          <span className="font-medium text-brown">{currency(Number(o.total_amount))}</span>
        </div>
      ))}
      {charges.map(c => (
        <div key={c.id} className="flex justify-between text-gray-600">
          <span>{c.description}</span>
          <span className="font-medium text-brown">{currency(Number(c.amount))}</span>
        </div>
      ))}
      <div className="border-t border-warm-border pt-2 flex justify-between items-center">
        <span className="font-semibold text-brown">Total</span>
        <span className="font-bold text-terra text-lg">{currency(grandTotal)}</span>
      </div>
      {!hideMethod && (
        <div className="flex justify-between text-xs text-gray-400">
          <span>Payment Method</span>
          <span className="capitalize">{method.replace('_', ' ')}</span>
        </div>
      )}
    </div>
  )
}
