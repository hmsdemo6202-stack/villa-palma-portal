'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Preset = '7d' | '30d' | 'mtd' | 'ytd' | 'custom'

interface Summary {
  totalRevenue: number
  reservationCount: number
  cancelledCount: number
  avgRate: number
  avgNights: number
  inHouseNow: number
}

interface ByStatus { status: string; count: number; revenue: number }
interface ByRoomType { name: string; count: number; revenue: number }
interface DailyRev { date: string; revenue: number }

const PRESET_LABELS: Record<Preset, string> = {
  '7d': 'Last 7 Days', '30d': 'Last 30 Days',
  'mtd': 'Month-to-Date', 'ytd': 'Year-to-Date', 'custom': 'Custom Range',
}

function currency(n: number) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function presetDates(preset: Preset): { start: string; end: string } {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const pad = (d: Date) => d.toISOString().split('T')[0]

  if (preset === '7d') {
    const s = new Date(today); s.setDate(s.getDate() - 6)
    return { start: pad(s), end: todayStr }
  }
  if (preset === '30d') {
    const s = new Date(today); s.setDate(s.getDate() - 29)
    return { start: pad(s), end: todayStr }
  }
  if (preset === 'mtd') {
    return { start: `${todayStr.slice(0, 7)}-01`, end: todayStr }
  }
  if (preset === 'ytd') {
    return { start: `${todayStr.slice(0, 4)}-01-01`, end: todayStr }
  }
  return { start: todayStr, end: todayStr }
}

export default function ReportsPage() {
  const supabase = createClient()
  const [preset, setPreset] = useState<Preset>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [byStatus, setByStatus] = useState<ByStatus[]>([])
  const [byRoomType, setByRoomType] = useState<ByRoomType[]>([])
  const [daily, setDaily] = useState<DailyRev[]>([])

  const effectiveDates = preset === 'custom'
    ? { start: customStart, end: customEnd }
    : presetDates(preset)

  const load = useCallback(async () => {
    const { start, end } = effectiveDates
    if (!start || !end || start > end) return
    setLoading(true)

    // All reservations in date range (by check_in_date)
    const { data: resList } = await supabase
      .from('reservations')
      .select('id, status, total_amount, nights, check_in_date, rooms(room_types(name))')
      .gte('check_in_date', start)
      .lte('check_in_date', end)

    const list = (resList ?? []) as Array<{
      id: string; status: string; total_amount: number | null; nights: number; check_in_date: string;
      rooms: { room_types: { name: string } | null } | null
    }>

    const active = list.filter(r => !['cancelled', 'no_show'].includes(r.status))
    const cancelled = list.filter(r => ['cancelled', 'no_show'].includes(r.status))

    const totalRevenue = active.reduce((s, r) => s + (r.total_amount ?? 0), 0)
    const avgRate = active.length > 0
      ? active.reduce((s, r) => s + (r.total_amount ?? 0) / (r.nights || 1), 0) / active.length
      : 0
    const avgNights = active.length > 0
      ? active.reduce((s, r) => s + r.nights, 0) / active.length
      : 0

    // In-house now
    const { count: inHouseCount } = await supabase
      .from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'checked_in')

    setSummary({
      totalRevenue,
      reservationCount: active.length,
      cancelledCount: cancelled.length,
      avgRate,
      avgNights,
      inHouseNow: inHouseCount ?? 0,
    })

    // By status
    const statusMap = new Map<string, { count: number; revenue: number }>()
    list.forEach(r => {
      const s = statusMap.get(r.status) ?? { count: 0, revenue: 0 }
      statusMap.set(r.status, { count: s.count + 1, revenue: s.revenue + (r.total_amount ?? 0) })
    })
    setByStatus(Array.from(statusMap.entries()).map(([status, v]) => ({ status, ...v })).sort((a, b) => b.count - a.count))

    // By room type
    const typeMap = new Map<string, { count: number; revenue: number }>()
    active.forEach(r => {
      const name = r.rooms?.room_types?.name ?? 'Unknown'
      const t = typeMap.get(name) ?? { count: 0, revenue: 0 }
      typeMap.set(name, { count: t.count + 1, revenue: t.revenue + (r.total_amount ?? 0) })
    })
    setByRoomType(Array.from(typeMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue))

    // Daily revenue (group by check_in_date)
    const dayMap = new Map<string, number>()
    active.forEach(r => {
      dayMap.set(r.check_in_date, (dayMap.get(r.check_in_date) ?? 0) + (r.total_amount ?? 0))
    })
    const days = Array.from(dayMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date))
    setDaily(days)

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customStart, customEnd])

  useEffect(() => { load() }, [load])

  const maxRev = Math.max(...daily.map(d => d.revenue), 1)

  const STATUS_COLORS: Record<string, string> = {
    inquiry: 'bg-violet-100 text-violet-700',
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    checked_in: 'bg-green-100 text-green-700',
    checked_out: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-600',
    no_show: 'bg-orange-100 text-orange-700',
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-brown">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Revenue, bookings, and performance metrics</p>
      </div>

      {/* Date range selector */}
      <div className="flex flex-wrap gap-2 items-center">
        {(Object.keys(PRESET_LABELS) as Preset[]).map(p => (
          <button key={p} onClick={() => setPreset(p)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              preset === p
                ? 'bg-terra text-white border-terra'
                : 'border-warm-border text-brown-mid hover:bg-gray-50'
            }`}>
            {PRESET_LABELS[p]}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex gap-2 items-center ml-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="border border-warm-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-terra" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              min={customStart}
              className="border border-warm-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-terra" />
          </div>
        )}
        {!loading && (
          <span className="text-xs text-gray-400 ml-auto">
            {effectiveDates.start} → {effectiveDates.end}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-warm-border rounded-xl p-4 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
              <div className="h-6 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : !summary ? null : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Revenue', value: currency(summary.totalRevenue), sub: 'active bookings' },
              { label: 'Active Bookings', value: summary.reservationCount.toString(), sub: 'in period' },
              { label: 'In-House Now', value: summary.inHouseNow.toString(), sub: 'currently checked in' },
              { label: 'Avg Daily Rate', value: currency(summary.avgRate), sub: 'per room night' },
              { label: 'Avg Length of Stay', value: `${summary.avgNights.toFixed(1)} nights`, sub: 'per booking' },
              { label: 'Cancellations', value: summary.cancelledCount.toString(), sub: 'in period' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white border border-warm-border rounded-xl p-4">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{kpi.label}</p>
                <p className="text-xl font-bold text-brown">{kpi.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Daily revenue chart */}
          {daily.length > 0 && (
            <div className="bg-white border border-warm-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-brown mb-4">Daily Revenue</h2>
              <div className="flex items-end gap-1 h-32 overflow-x-auto pb-6">
                {daily.map(d => {
                  const pct = (d.revenue / maxRev) * 100
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-1 shrink-0" style={{ minWidth: daily.length > 20 ? '12px' : '24px' }}>
                      <div className="w-full rounded-t bg-terra opacity-80 transition-all hover:opacity-100"
                        style={{ height: `${Math.max(2, pct * 0.96)}%` }}
                        title={`${fmtDate(d.date)}: ${currency(d.revenue)}`} />
                      {daily.length <= 20 && (
                        <span className="text-[9px] text-gray-400 rotate-45 origin-left mt-1 whitespace-nowrap">
                          {fmtDate(d.date)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {daily.length > 20 && (
                <p className="text-[10px] text-gray-400 mt-2">Hover bars to see date and amount</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* By room type */}
            {byRoomType.length > 0 && (
              <div className="bg-white border border-warm-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-brown mb-4">Revenue by Room Type</h2>
                <div className="space-y-3">
                  {byRoomType.map(rt => (
                    <div key={rt.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-brown-mid">{rt.name}</span>
                        <span className="font-medium text-brown">{currency(rt.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-terra rounded-full"
                          style={{ width: `${(rt.revenue / (byRoomType[0]?.revenue || 1)) * 100}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{rt.count} booking{rt.count !== 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By status */}
            {byStatus.length > 0 && (
              <div className="bg-white border border-warm-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-brown mb-4">Booking Status Breakdown</h2>
                <div className="space-y-2">
                  {byStatus.map(s => (
                    <div key={s.status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {s.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">{s.count} booking{s.count !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-xs font-medium text-brown">{currency(s.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {summary.reservationCount === 0 && daily.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📊</p>
              <p className="font-medium text-gray-500">No reservations found for this period.</p>
              <p className="text-sm mt-1">Try selecting a broader date range.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
