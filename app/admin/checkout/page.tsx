'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import CheckoutModal from '@/components/CheckoutModal'

type Reservation = {
  id: string
  guest_id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  nights: number
  total_amount: number | null
  actual_check_in: string | null
  key_card_number: string | null
  guests: { full_name: string; phone: string | null } | null
  rooms:  { room_number: string; room_types: { name: string } | null } | null
}

function currency(n: number) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function CheckOutPage() {
  const supabase = createClient()
  const [inHouse, setInHouse] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutTarget, setCheckoutTarget] = useState<Reservation | null>(null)
  const [search, setSearch] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reservations')
      .select('id, guest_id, room_id, check_in_date, check_out_date, nights, total_amount, actual_check_in, key_card_number, guests(full_name, phone), rooms(room_number, room_types(name))')
      .eq('status', 'checked_in')
      .order('check_out_date')
    setInHouse((data as unknown as Reservation[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const visible = inHouse.filter(r =>
    !search ||
    (r.guests?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (r.rooms?.room_number ?? '').includes(search)
  )

  const dueToday    = inHouse.filter(r => r.check_out_date === today).length
  const overdue     = inHouse.filter(r => r.check_out_date < today).length

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-brown">Check-Out Station</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {inHouse.length} in-house
          {dueToday > 0 && ` · ${dueToday} due today`}
          {overdue > 0 && ` · `}
          {overdue > 0 && <span className="text-red-600 font-medium">{overdue} overdue</span>}
        </p>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by guest name or room number…"
        className="border border-warm-border rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-terra" />

      {loading ? (
        <p className="text-gray-400 text-sm">Loading in-house guests…</p>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🧾</p>
          <p className="font-medium">{search ? 'No guests match that search.' : 'No guests currently checked in.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(res => {
            const isOverdue = res.check_out_date < today
            const isDueToday = res.check_out_date === today
            return (
              <div key={res.id} className={`flex items-center gap-4 p-4 bg-white rounded-xl border transition-colors ${
                isOverdue ? 'border-red-200' : isDueToday ? 'border-yellow-200' : 'border-warm-border'
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-brown">{res.guests?.full_name ?? '—'}</span>
                    {isOverdue  && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Overdue</span>}
                    {isDueToday && !isOverdue && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Due Today</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Room {res.rooms?.room_number} · {res.rooms?.room_types?.name ?? '—'}</span>
                    <span>Checked in {fmtTime(res.actual_check_in)}</span>
                    <span>Check-out {fmtDate(res.check_out_date)} · {res.nights} night{res.nights !== 1 ? 's' : ''}</span>
                    {res.total_amount != null && <span className="font-medium text-brown">{currency(res.total_amount)}</span>}
                    {res.key_card_number && <span className="text-gray-400">Key {res.key_card_number}</span>}
                  </div>
                </div>
                <button onClick={() => setCheckoutTarget(res)}
                  className="text-sm bg-terra text-white px-4 py-2 rounded-lg font-medium hover:bg-terra-dark transition-colors shrink-0">
                  Check Out
                </button>
              </div>
            )
          })}
        </div>
      )}

      {checkoutTarget && (
        <CheckoutModal
          reservation={checkoutTarget}
          onClose={() => setCheckoutTarget(null)}
          onComplete={() => { setCheckoutTarget(null); load() }}
        />
      )}
    </div>
  )
}
