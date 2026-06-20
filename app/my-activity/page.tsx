'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type RoomReservation = {
  id: string
  room_id: string
  check_in: string
  check_out: string
  total_price: number | null
  status: string
  created_at: string
  rooms: { room_number: string; room_types: { name: string } | null } | null
}

type TableReservation = {
  id: string
  reservation_time: string
  duration_minutes: number
  party_size: number
  status: string
  created_at: string
  restaurant_tables: { table_number: string } | null
}

type Order = {
  id: string
  status: string
  total: number
  created_at: string
  restaurant_tables: { table_number: string } | null
  rooms: { room_number: string } | null
  order_items: {
    quantity: number
    price_at_order: number
    menu_items: { name: string } | null
  }[]
}

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-[#fdf6e8] text-[#7a5010] border border-[#e8c87a]',
  confirmed:   'bg-[#f0f7f2] text-[#2e6b4a] border border-[#a3ccb3]',
  checked_in:  'bg-terra-light text-terra border border-[#f0c8aa]',
  checked_out: 'bg-gray-50 text-gray-500 border border-gray-200',
  cancelled:   'bg-[#fdf2f2] text-[#7a2020] border border-[#e8b4b4]',
  preparing:   'bg-orange-50 text-orange-700 border border-orange-200',
  served:      'bg-[#f0f7f2] text-[#2e6b4a] border border-[#a3ccb3]',
  paid:        'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="font-serif text-lg font-semibold text-brown">{children}</h2>
      <div className="w-8 h-px bg-terra mt-1.5" />
    </div>
  )
}

function ActivityContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const booked = searchParams.get('booked')

  const [roomRes, setRoomRes] = useState<RoomReservation[]>([])
  const [tableRes, setTableRes] = useState<TableReservation[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: rr }, { data: tr }, { data: ord }] = await Promise.all([
      supabase.from('room_reservations')
        .select('*, rooms(room_number, room_types(name))')
        .eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('table_reservations')
        .select('*, restaurant_tables(table_number)')
        .eq('user_id', user.id).order('reservation_time', { ascending: false }),
      supabase.from('orders')
        .select('*, restaurant_tables(table_number), rooms(room_number), order_items(quantity, price_at_order, menu_items(name))')
        .eq('user_id', user.id).order('created_at', { ascending: false }),
    ])

    setRoomRes((rr as RoomReservation[]) ?? [])
    setTableRes((tr as TableReservation[]) ?? [])
    setOrders((ord as Order[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function cancelRoomRes(id: string) {
    if (!confirm('Cancel this room reservation?')) return
    const { error } = await supabase.from('room_reservations')
      .update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending')
    setActionMsg({ id, msg: error ? error.message : 'Reservation cancelled.', ok: !error })
    load()
  }

  async function cancelTableRes(id: string) {
    if (!confirm('Cancel this table reservation?')) return
    const { error } = await supabase.from('table_reservations')
      .update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending')
    setActionMsg({ id, msg: error ? error.message : 'Reservation cancelled.', ok: !error })
    load()
  }

  async function cancelOrder(id: string) {
    if (!confirm('Cancel this order?')) return
    const { error } = await supabase.from('orders')
      .update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending')
    setActionMsg({ id, msg: error ? error.message : 'Order cancelled.', ok: !error })
    load()
  }

  async function payRoom(id: string) {
    const { error } = await supabase.rpc('pay_now', { p_reference_type: 'room_reservation', p_reference_id: id })
    setActionMsg({ id, msg: error ? error.message : 'Payment recorded! Reservation confirmed.', ok: !error })
    load()
  }

  async function payOrder(id: string) {
    const { error } = await supabase.rpc('pay_now', { p_reference_type: 'table_order', p_reference_id: id })
    setActionMsg({ id, msg: error ? error.message : 'Payment recorded! Order marked as paid.', ok: !error })
    load()
  }

  if (loading) return <div className="p-8 text-brown-light">Loading your activity…</div>

  return (
    <div className="min-h-screen bg-cream">
      <div className="p-6 max-w-4xl mx-auto space-y-10">

        {/* Success banners */}
        {booked === 'room' && (
          <div className="bg-[#f0f7f2] border border-[#a3ccb3] rounded-xl p-4 text-[#2a5c3a] text-sm">
            Room booked! Status is <strong>Pending</strong>. You can pay now to confirm, or wait for the instructor.
          </div>
        )}
        {booked === 'order' && (
          <div className="bg-[#f0f7f2] border border-[#a3ccb3] rounded-xl p-4 text-[#2a5c3a] text-sm">
            Order placed! The instructor will update it to <strong>Preparing</strong> then <strong>Served</strong>. Pay once it&apos;s served.
          </div>
        )}

        {/* Book Again Nudge */}
        {(() => {
          const lastCheckout = roomRes.find(r => r.status === 'checked_out')
          if (!lastCheckout) return null
          return (
            <div className="bg-white border border-warm-border rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm">
              <div>
                <p className="text-sm font-medium text-brown">
                  Enjoyed your stay in Room {lastCheckout.rooms?.room_number}?
                </p>
                <p className="text-xs text-brown-light mt-0.5">
                  {lastCheckout.rooms?.room_types?.name} · checked out {fmt(lastCheckout.check_out)}
                </p>
              </div>
              <Link
                href={`/rooms/${lastCheckout.room_id}/book`}
                className="shrink-0 text-sm bg-terra text-white px-4 py-1.5 rounded-lg hover:bg-terra-dark transition-colors font-medium">
                Book again
              </Link>
            </div>
          )
        })()}

        <div>
          <p className="text-[10px] font-bold text-brown-light uppercase tracking-[0.25em] mb-1">Guest Portal</p>
          <h1 className="font-serif text-2xl font-bold text-brown">My Activity</h1>
          <div className="w-10 h-px bg-terra mt-2" />
        </div>

        {/* Room Reservations */}
        <section>
          <SectionHeading>Room Reservations</SectionHeading>
          {roomRes.length === 0 ? (
            <p className="text-brown-light text-sm">
              No room reservations yet.{' '}
              <Link href="/rooms" className="text-terra hover:text-terra-dark transition-colors">Browse rooms →</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {roomRes.map(r => (
                <div key={r.id} className="bg-white border border-warm-border rounded-xl p-4 shadow-sm hover:border-terra transition-colors">
                  {actionMsg?.id === r.id && (
                    <div className={`text-xs mb-3 p-2.5 rounded-lg ${actionMsg.ok ? 'bg-[#f0f7f2] text-[#2a5c3a] border border-[#a3ccb3]' : 'bg-[#fdf2f2] text-[#7a2020] border border-[#e8b4b4]'}`}>
                      {actionMsg.msg}
                    </div>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brown">
                        Room {r.rooms?.room_number}
                        <span className="text-brown-mid font-normal text-sm ml-2">{r.rooms?.room_types?.name}</span>
                      </p>
                      <p className="text-sm text-brown-mid mt-0.5">
                        {fmt(r.check_in)} → {fmt(r.check_out)}
                        {r.total_price != null && (
                          <span className="ml-2 font-bold text-terra">₱{Number(r.total_price).toLocaleString()}</span>
                        )}
                      </p>
                      <p className="text-xs text-brown-light mt-0.5">Booked {fmt(r.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={r.status} />
                      {r.status === 'pending' && (
                        <button onClick={() => cancelRoomRes(r.id)}
                          className="text-xs border border-[#e8b4b4] text-[#9e3535] px-3 py-1 rounded-lg hover:bg-[#fdf2f2] transition-colors">
                          Cancel
                        </button>
                      )}
                      {['pending', 'confirmed'].includes(r.status) && (
                        <button onClick={() => payRoom(r.id)}
                          className="text-xs bg-terra text-white px-3 py-1 rounded-lg hover:bg-terra-dark transition-colors font-medium">
                          Pay Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Table Reservations */}
        <section>
          <SectionHeading>Table Reservations</SectionHeading>
          {tableRes.length === 0 ? (
            <p className="text-brown-light text-sm">
              No table reservations yet.{' '}
              <Link href="/restaurant/tables" className="text-terra hover:text-terra-dark transition-colors">Reserve a table →</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {tableRes.map(r => (
                <div key={r.id} className="bg-white border border-warm-border rounded-xl p-4 shadow-sm hover:border-terra transition-colors">
                  {actionMsg?.id === r.id && (
                    <div className={`text-xs mb-3 p-2.5 rounded-lg ${actionMsg.ok ? 'bg-[#f0f7f2] text-[#2a5c3a] border border-[#a3ccb3]' : 'bg-[#fdf2f2] text-[#7a2020] border border-[#e8b4b4]'}`}>
                      {actionMsg.msg}
                    </div>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brown">Table {r.restaurant_tables?.table_number}</p>
                      <p className="text-sm text-brown-mid mt-0.5">
                        {fmtTime(r.reservation_time)} · {r.duration_minutes} min · {r.party_size} guests
                      </p>
                      <p className="text-xs text-brown-light mt-0.5">Reserved {fmt(r.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      {r.status === 'pending' && (
                        <button onClick={() => cancelTableRes(r.id)}
                          className="text-xs border border-[#e8b4b4] text-[#9e3535] px-3 py-1 rounded-lg hover:bg-[#fdf2f2] transition-colors">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Food Orders */}
        <section>
          <SectionHeading>Food Orders</SectionHeading>
          {orders.length === 0 ? (
            <p className="text-brown-light text-sm">
              No orders yet.{' '}
              <Link href="/restaurant/menu" className="text-terra hover:text-terra-dark transition-colors">Browse the menu →</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map(o => {
                const location = o.restaurant_tables
                  ? `Table ${o.restaurant_tables.table_number}`
                  : o.rooms ? `Room ${o.rooms.room_number} (room service)` : '—'
                return (
                  <div key={o.id} className="bg-white border border-warm-border rounded-xl p-4 shadow-sm hover:border-terra transition-colors">
                    {actionMsg?.id === o.id && (
                      <div className={`text-xs mb-3 p-2.5 rounded-lg ${actionMsg.ok ? 'bg-[#f0f7f2] text-[#2a5c3a] border border-[#a3ccb3]' : 'bg-[#fdf2f2] text-[#7a2020] border border-[#e8b4b4]'}`}>
                        {actionMsg.msg}
                      </div>
                    )}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-brown">{location}</p>
                          <StatusBadge status={o.status} />
                        </div>
                        <ul className="text-sm text-brown-mid space-y-0.5">
                          {o.order_items.map((item, i) => (
                            <li key={i}>
                              {item.menu_items?.name} ×{item.quantity}
                              <span className="text-brown-light ml-1">(₱{(item.price_at_order * item.quantity).toLocaleString()})</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-sm font-bold text-terra mt-1.5">Total: ₱{Number(o.total).toLocaleString()}</p>
                        <p className="text-xs text-brown-light mt-0.5">Ordered {fmt(o.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {o.status === 'pending' && (
                          <button onClick={() => cancelOrder(o.id)}
                            className="text-xs border border-[#e8b4b4] text-[#9e3535] px-3 py-1 rounded-lg hover:bg-[#fdf2f2] transition-colors">
                            Cancel
                          </button>
                        )}
                        {['pending', 'preparing', 'served'].includes(o.status) && (
                          <button onClick={() => payOrder(o.id)}
                            className="text-xs bg-terra text-white px-3 py-1 rounded-lg hover:bg-terra-dark transition-colors font-medium">
                            Pay Now
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default function MyActivityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-brown-light">Loading…</div>}>
      <ActivityContent />
    </Suspense>
  )
}
