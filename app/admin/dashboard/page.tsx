'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'

type KPIs = {
  totalRooms: number
  availableRooms: number
  occupiedRooms: number
  maintenanceRooms: number
  dirtyRooms: number
  totalGuests: number
  revenueToday: number
  revenueThisMonth: number
  expensesThisMonth: number
  lowStockCount: number
  inventoryValue: number
  deptExpenses: { name: string; total: number }[]
  revenueByDay: { date: string; revenue: number }[]
  // Enterprise metrics
  checkInsToday: number
  checkOutsToday: number
  pendingReservations: number
  newContacts: number
  pendingReviews: number
  activePromotions: number
  openTickets: number
}

function currency(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function StatCard({ label, value, sub, accent = false, warn = false }: {
  label: string; value: string; sub?: string; accent?: boolean; warn?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      warn   ? 'border-red-200 bg-red-50' :
      accent ? 'border-[#f0c8aa] bg-terra-light' :
               'bg-white border-warm-border'}`}>
      <p className="text-xs font-medium uppercase tracking-wide mb-1 text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${warn ? 'text-red-700' : accent ? 'text-terra' : 'text-brown'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border rounded-lg shadow px-3 py-2 text-sm">
      <p className="font-medium text-gray-700">{label}</p>
      <p className="text-terra font-bold">{currency(payload[0].value)}</p>
    </div>
  )
}

export default function AdminDashboardPage() {
  const supabase = createClient()
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const load = useCallback(async () => {
    const today        = new Date().toISOString().split('T')[0]
    const monthStart   = today.slice(0, 8) + '01'
    const todayStart   = today + 'T00:00:00'
    const chartStart   = (() => { const d = new Date(); d.setDate(d.getDate() - 13); return d.toISOString().split('T')[0] })()

    const [
      { data: rooms },
      { data: guests },
      { data: todayPmts },
      { data: monthPmts },
      { data: chartPmts },
      { data: depts },
      { data: monthExp },
      { data: invItems },
      { count: newContacts },
      { count: pendingReviews },
      { count: checkInsToday },
      { count: checkOutsToday },
      { count: pendingReservations },
      { count: activePromotions },
      { count: openTickets },
    ] = await Promise.all([
      supabase.from('rooms').select('status'),
      supabase.from('guests').select('id', { count: 'exact' }),
      supabase.from('payments').select('amount').gte('paid_at', todayStart),
      supabase.from('payments').select('amount').gte('paid_at', monthStart),
      supabase.from('payments').select('amount, paid_at').gte('paid_at', chartStart).order('paid_at'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('expenses').select('department_id, amount').gte('expense_date', monthStart),
      supabase.from('inventory_items').select('quantity_on_hand, reorder_threshold, unit_cost'),
      supabase.from('contact_inquiries').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('check_in_date', today),
      supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('check_out_date', today),
      supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('promotions').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    ])

    const roomList = rooms ?? []
    const totalRooms      = roomList.length
    const availableRooms  = roomList.filter(r => r.status === 'available').length
    const occupiedRooms   = roomList.filter(r => r.status === 'occupied').length
    const maintenanceRooms= roomList.filter(r => r.status === 'maintenance').length
    const dirtyRooms       = roomList.filter(r => r.status === 'dirty' || r.status === 'cleaning' || r.status === 'inspection').length

    const revenueToday      = (todayPmts ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const revenueThisMonth  = (monthPmts ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const expensesThisMonth = (monthExp ?? []).reduce((s, e) => s + Number(e.amount), 0)

    // Per-dept expenses this month
    const deptExpenses = (depts ?? []).map(d => ({
      name:  d.name,
      total: (monthExp ?? []).filter(e => e.department_id === d.id).reduce((s, e) => s + Number(e.amount), 0),
    })).filter(d => d.total > 0).sort((a, b) => b.total - a.total)

    // 14-day revenue chart
    const revenueByDay = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i))
      const key = d.toISOString().split('T')[0]
      return {
        date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        revenue: (chartPmts ?? []).filter(p => p.paid_at.startsWith(key)).reduce((s, p) => s + Number(p.amount), 0),
      }
    })

    const invList = invItems ?? []
    const lowStockCount   = invList.filter(i => Number(i.quantity_on_hand) <= Number(i.reorder_threshold)).length
    const inventoryValue  = invList.reduce((s, i) => s + Number(i.quantity_on_hand) * Number(i.unit_cost), 0)

    setKpis({
      totalRooms, availableRooms, occupiedRooms, maintenanceRooms, dirtyRooms,
      totalGuests: guests?.length ?? 0,
      revenueToday, revenueThisMonth, expensesThisMonth,
      lowStockCount, inventoryValue, deptExpenses, revenueByDay,
      checkInsToday: checkInsToday ?? 0,
      checkOutsToday: checkOutsToday ?? 0,
      pendingReservations: pendingReservations ?? 0,
      newContacts: newContacts ?? 0,
      pendingReviews: pendingReviews ?? 0,
      activePromotions: activePromotions ?? 0,
      openTickets: openTickets ?? 0,
    })
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-gray-400 p-4">Loading dashboard…</div>
  if (!kpis) return null

  const occupancyPct = kpis.totalRooms > 0 ? Math.round((kpis.occupiedRooms / kpis.totalRooms) * 100) : 0
  const netThisMonth = kpis.revenueThisMonth - kpis.expensesThisMonth
  const todayLabel   = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

  const DEPT_COLORS = ['#b85c38','#e07850','#f0a880','#fad0b8','#2d6a4f','#52b788']

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Dashboard</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <button onClick={load} className="text-xs text-terra hover:underline border border-warm-border px-3 py-1.5 rounded-lg">
          ↻ Refresh
        </button>
      </div>

      {/* ── Rooms ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Rooms</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Total Rooms"   value={String(kpis.totalRooms)} />
          <StatCard label="Available"     value={String(kpis.availableRooms)} accent={kpis.availableRooms > 0} />
          <StatCard label="Occupied"      value={`${occupancyPct}%`} sub={`${kpis.occupiedRooms} rooms`} accent={occupancyPct >= 70} />
          <a href="/admin/housekeeping" className="block">
            <StatCard label="Dirty Rooms"   value={String(kpis.dirtyRooms)} warn={kpis.dirtyRooms > 0} sub="needs housekeeping" />
          </a>
          <StatCard label="Maintenance"   value={String(kpis.maintenanceRooms)} warn={kpis.maintenanceRooms > 0} />
        </div>
      </section>

      {/* ── Finance ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Finance — This Month</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Revenue Today"      value={currency(kpis.revenueToday)} accent />
          <StatCard label="Revenue This Month" value={currency(kpis.revenueThisMonth)} />
          <StatCard label="Expenses This Month" value={currency(kpis.expensesThisMonth)} warn={kpis.expensesThisMonth > kpis.revenueThisMonth} />
          <StatCard
            label="Net This Month"
            value={currency(netThisMonth)}
            accent={netThisMonth >= 0}
            warn={netThisMonth < 0}
            sub={netThisMonth >= 0 ? 'surplus' : 'deficit'}
          />
        </div>
      </section>

      {/* ── Operations ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Operations</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Registered Guests"  value={String(kpis.totalGuests)} />
          <StatCard label="Low Stock Items"     value={String(kpis.lowStockCount)} warn={kpis.lowStockCount > 0} sub="at or below threshold" />
          <StatCard label="Inventory Value"     value={currency(kpis.inventoryValue)} />
        </div>
      </section>

      {/* ── Today's Activity ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Today's Activity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <a href="/admin/reservations" className="block">
            <StatCard label="Check-ins Today"     value={String(kpis.checkInsToday)}     accent={kpis.checkInsToday > 0} sub="arriving guests" />
          </a>
          <a href="/admin/reservations" className="block">
            <StatCard label="Check-outs Today"    value={String(kpis.checkOutsToday)}    sub="departing guests" />
          </a>
          <a href="/admin/reservations" className="block">
            <StatCard label="Pending Reservations" value={String(kpis.pendingReservations)} warn={kpis.pendingReservations > 0} sub="awaiting confirmation" />
          </a>
        </div>
      </section>

      {/* ── Content & Engagement ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Content &amp; Engagement</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <a href="/admin/contacts" className="block">
            <StatCard label="New Inquiries"    value={String(kpis.newContacts)}    warn={kpis.newContacts > 0} sub="unread contact messages" />
          </a>
          <a href="/admin/reviews" className="block">
            <StatCard label="Pending Reviews"  value={String(kpis.pendingReviews)} warn={kpis.pendingReviews > 0} sub="awaiting moderation" />
          </a>
          <a href="/admin/promotions" className="block">
            <StatCard label="Active Promotions" value={String(kpis.activePromotions)} accent={kpis.activePromotions > 0} sub="live promo codes" />
          </a>
          <a href="/admin/support-tickets" className="block">
            <StatCard label="Open Support Tickets" value={String(kpis.openTickets)} warn={kpis.openTickets > 0} sub="from registered guests" />
          </a>
        </div>
      </section>

      {/* ── Revenue Chart ── */}
      <section className="bg-white border border-warm-border rounded-xl p-5">
        <h2 className="font-semibold text-brown mb-4">Revenue — Last 14 Days</h2>
        {mounted ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={kpis.revenueByDay} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={v => v === 0 ? '0' : `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<RevenueTooltip />} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {kpis.revenueByDay.map((entry, i) => (
                  <Cell key={i} fill={entry.date === todayLabel ? '#b85c38' : '#f0c8aa'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="h-56 bg-gray-50 rounded-lg animate-pulse" />}
      </section>

      {/* ── Dept Expenses ── */}
      {kpis.deptExpenses.length > 0 && (
        <section className="bg-white border border-warm-border rounded-xl p-5">
          <h2 className="font-semibold text-brown mb-4">Expenses by Department — This Month</h2>
          {mounted ? (
            <ResponsiveContainer width="100%" height={Math.max(160, kpis.deptExpenses.length * 42)}>
              <BarChart data={kpis.deptExpenses} layout="vertical" margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                <Tooltip formatter={(v) => [currency(v as number), 'Expenses']} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {kpis.deptExpenses.map((_, i) => (
                    <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-40 bg-gray-50 rounded-lg animate-pulse" />}
        </section>
      )}

      {/* ── Low Stock Alert ── */}
      {kpis.lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          <p className="font-semibold">
            ⚠ {kpis.lowStockCount} inventory item{kpis.lowStockCount !== 1 ? 's' : ''} at or below reorder threshold.
          </p>
          <a href="/admin/inventory" className="underline hover:no-underline text-red-700 mt-1 inline-block">Go to Inventory →</a>
        </div>
      )}
    </div>
  )
}
