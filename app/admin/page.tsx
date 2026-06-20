'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type DayRevenue = { date: string; revenue: number }
type StatusCount = { status: string; count: number }

type KPIs = {
  todayRevenue: number
  weekRevenue: number
  totalRooms: number
  bookedTodayRooms: number
  pendingOrders: number
  preparingOrders: number
  lowStockCount: number
  revenueByDay: DayRevenue[]
  orderStatusCounts: StatusCount[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function startOfDay(d: Date) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r
}

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return startOfDay(d)
}

function currency(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent = false, warn = false,
}: { label: string; value: string; sub?: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${warn ? 'border-[#e8b4b4] bg-[#fdf2f2]' : accent ? 'border-[#f0c8aa] bg-terra-light' : 'bg-white border-warm-border'}`}>
      <p className="text-xs font-medium text-brown-light uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${warn ? 'text-[#7a2020]' : accent ? 'text-terra' : 'text-brown'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Custom Tooltip for Recharts ───────────────────────────────────────────────

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

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const supabase = createClient()
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const load = useCallback(async () => {
    const today = isoDate(new Date())
    const todayStart = startOfDay(new Date()).toISOString()
    const weekStart = daysAgo(6).toISOString()
    const chartStart = daysAgo(13).toISOString()

    const [
      { data: todayPmts },
      { data: weekPmts },
      { data: chartPmts },
      { data: bookedRooms },
      { count: totalRooms },
      { data: orders },
      { data: invItems },
    ] = await Promise.all([
      supabase.from('payments').select('amount').gte('paid_at', todayStart),
      supabase.from('payments').select('amount').gte('paid_at', weekStart),
      supabase.from('payments').select('amount, paid_at').gte('paid_at', chartStart).order('paid_at'),
      supabase.from('room_reservations').select('room_id')
        .in('status', ['pending', 'confirmed', 'checked_in'])
        .lte('check_in', today)
        .gt('check_out', today),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).neq('status', 'maintenance'),
      supabase.from('orders').select('status'),
      supabase.from('inventory_items').select('quantity_on_hand, reorder_threshold'),
    ])

    const todayRevenue = (todayPmts ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const weekRevenue = (weekPmts ?? []).reduce((s, p) => s + Number(p.amount), 0)

    const revenueByDay: DayRevenue[] = Array.from({ length: 14 }, (_, i) => {
      const d = daysAgo(13 - i)
      const key = isoDate(d)
      const dayTotal = (chartPmts ?? [])
        .filter(p => p.paid_at.startsWith(key))
        .reduce((s, p) => s + Number(p.amount), 0)
      return {
        date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        revenue: dayTotal,
      }
    })

    const bookedTodayRooms = new Set((bookedRooms ?? []).map(r => r.room_id)).size

    const orderList = orders ?? []
    const statusOrder = ['pending', 'preparing', 'served', 'paid', 'cancelled']
    const orderStatusCounts: StatusCount[] = statusOrder.map(s => ({
      status: s,
      count: orderList.filter(o => o.status === s).length,
    }))

    const pendingOrders = orderList.filter(o => o.status === 'pending').length
    const preparingOrders = orderList.filter(o => o.status === 'preparing').length

    const lowStockCount = (invItems ?? []).filter(
      i => Number(i.quantity_on_hand) <= Number(i.reorder_threshold)
    ).length

    setKpis({
      todayRevenue,
      weekRevenue,
      totalRooms: totalRooms ?? 0,
      bookedTodayRooms,
      pendingOrders,
      preparingOrders,
      lowStockCount,
      revenueByDay,
      orderStatusCounts,
    })
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-gray-400 p-4">Loading dashboard…</div>
  if (!kpis) return null

  const occupancyPct = kpis.totalRooms > 0
    ? Math.round((kpis.bookedTodayRooms / kpis.totalRooms) * 100)
    : 0

  const STATUS_COLORS: Record<string, string> = {
    pending: '#fbbf24', preparing: '#fb923c', served: '#34d399', paid: '#10b981', cancelled: '#f87171',
  }

  const todayLabel = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button onClick={load} className="text-xs text-blue-600 hover:underline">Refresh</button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Today's Revenue" value={currency(kpis.todayRevenue)} sub="from payments" accent />
        <StatCard label="This Week" value={currency(kpis.weekRevenue)} sub="last 7 days" />
        <StatCard
          label="Occupancy Today"
          value={`${occupancyPct}%`}
          sub={`${kpis.bookedTodayRooms} / ${kpis.totalRooms} rooms`}
          accent={occupancyPct >= 70}
        />
        <StatCard label="Pending Orders" value={String(kpis.pendingOrders)} sub="awaiting kitchen" warn={kpis.pendingOrders > 5} />
        <StatCard label="Preparing" value={String(kpis.preparingOrders)} sub="in the kitchen" />
        <StatCard label="Low Stock" value={String(kpis.lowStockCount)} sub="items at/below threshold" warn={kpis.lowStockCount > 0} />
      </div>

      {/* ── Revenue Chart ── */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Revenue — Last 14 Days</h2>
        {mounted ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={kpis.revenueByDay} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v === 0 ? '0' : `₱${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {kpis.revenueByDay.map((entry, index) => (
                  <Cell key={index} fill={entry.date === todayLabel ? '#2563eb' : '#93c5fd'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-60 bg-gray-50 rounded-lg animate-pulse" />
        )}
        <p className="text-xs text-gray-400 mt-2">
          Blue = today. Each bar is the sum of all <code>payments.amount</code> rows for that day.
        </p>
      </div>

      {/* ── Order Status Breakdown ── */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold mb-4">All-Time Order Breakdown</h2>
        {mounted ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={kpis.orderStatusCounts}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 60, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
              <Tooltip formatter={(v) => [`${v} orders`, 'Count']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {kpis.orderStatusCounts.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-44 bg-gray-50 rounded-lg animate-pulse" />
        )}
      </div>

      {/* ── Low-Stock Alert ── */}
      {kpis.lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          <p className="font-semibold mb-1">
            ⚠ {kpis.lowStockCount} inventory item{kpis.lowStockCount !== 1 ? 's' : ''} at or below reorder threshold.
          </p>
          <a href="/admin/inventory" className="underline hover:no-underline">Go to Inventory →</a>
        </div>
      )}
    </div>
  )
}
