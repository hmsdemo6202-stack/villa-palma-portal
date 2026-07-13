'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type Reservation = {
  id: string
  check_in_date: string
  check_out_date: string
  status: string
  nights: number
  total_amount: number
  guest_id: string | null
}

type DayData = {
  date: string          // YYYY-MM-DD
  revenue: number
  occupied: number
  reservationCount: number
  guestCount: number
}

type PopoverDay = DayData & { dateLabel: string }

function toISO(d: Date) { return d.toISOString().split('T')[0] }

function revenueTier(rev: number): { bg: string; text: string; ring: string } {
  if (rev === 0)       return { bg: 'bg-gray-100',      text: 'text-gray-400',    ring: 'ring-gray-200' }
  if (rev < 3000)      return { bg: 'bg-emerald-50',    text: 'text-emerald-600', ring: 'ring-emerald-100' }
  if (rev < 8000)      return { bg: 'bg-emerald-100',   text: 'text-emerald-700', ring: 'ring-emerald-200' }
  if (rev < 18000)     return { bg: 'bg-emerald-200',   text: 'text-emerald-800', ring: 'ring-emerald-300' }
  if (rev < 35000)     return { bg: 'bg-emerald-400',   text: 'text-white',       ring: 'ring-emerald-500' }
  return               { bg: 'bg-emerald-600',   text: 'text-white',       ring: 'ring-emerald-700' }
}

function peso(n: number) {
  if (n === 0) return '—'
  if (n >= 1000) return '₱' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return '₱' + n.toLocaleString('en-PH')
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function CalendarPage() {
  const supabase = createClient()

  const [year,  setYear]  = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth()) // 0-indexed
  const [totalRooms, setTotalRooms] = useState(0)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [popover, setPopover] = useState<PopoverDay | null>(null)

  // First & last day of the selected month
  const firstDay = useMemo(() => new Date(year, month, 1), [year, month])
  const lastDay  = useMemo(() => new Date(year, month + 1, 0), [year, month])

  const load = useCallback(async () => {
    setLoading(true)
    const start = toISO(firstDay)
    const end   = toISO(new Date(year, month + 1, 1))

    const [{ data: rooms }, { data: res }] = await Promise.all([
      supabase.from('rooms').select('id', { count: 'exact' }),
      supabase.from('reservations')
        .select('id, check_in_date, check_out_date, status, nights, total_amount, guest_id')
        .not('status', 'in', '("cancelled","no_show","inquiry")')
        .lt('check_in_date', end)
        .gt('check_out_date', start),
    ])

    setTotalRooms((rooms ?? []).length)
    setReservations((res as unknown as Reservation[]) ?? [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  useEffect(() => { load() }, [load])

  // Build a map of dayData for every day in the month
  const dayMap = useMemo<Map<string, DayData>>(() => {
    const map = new Map<string, DayData>()
    const daysInMonth = lastDay.getDate()

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toISO(new Date(year, month, d))
      const active = reservations.filter(r =>
        r.check_in_date <= iso && iso < r.check_out_date
      )
      const revenue = active.reduce((sum, r) => {
        const nights = r.nights || 1
        return sum + (r.total_amount / nights)
      }, 0)
      const guestIds = new Set(active.map(r => r.guest_id).filter(Boolean))

      map.set(iso, {
        date: iso,
        revenue: Math.round(revenue),
        occupied: active.length,
        reservationCount: active.length,
        guestCount: guestIds.size,
      })
    }
    return map
  }, [reservations, year, month, lastDay])

  // Build calendar grid: weeks as arrays of 7 (null = padding)
  const weeks = useMemo(() => {
    const weeks: (string | null)[][] = []
    const startPad = firstDay.getDay()   // 0 = Sun
    const totalDays = lastDay.getDate()
    const cells: (string | null)[] = Array(startPad).fill(null)

    for (let d = 1; d <= totalDays; d++) {
      cells.push(toISO(new Date(year, month, d)))
    }
    while (cells.length % 7 !== 0) cells.push(null)

    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7))
    }
    return weeks
  }, [firstDay, lastDay, year, month])

  const todayIso = toISO(new Date())

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  function goToday() {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }

  // Monthly totals
  const monthlyRevenue = useMemo(() => {
    let total = 0
    dayMap.forEach(d => { total += d.revenue })
    return total
  }, [dayMap])

  const avgOccupancy = useMemo(() => {
    if (!totalRooms) return 0
    let total = 0; let count = 0
    dayMap.forEach(d => { total += d.occupied; count++ })
    return count ? Math.round((total / count / totalRooms) * 100) : 0
  }, [dayMap, totalRooms])

  const peakRevDay = useMemo(() => {
    let peak = 0
    dayMap.forEach(d => { if (d.revenue > peak) peak = d.revenue })
    return peak
  }, [dayMap])

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Revenue Heatmap</h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily occupancy and revenue — {MONTHS[month]} {year}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">← Prev</button>
          <button onClick={goToday}   className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">This Month</button>
          <button onClick={nextMonth} className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Next →</button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Monthly Revenue',   value: monthlyRevenue >= 1000 ? '₱' + (monthlyRevenue / 1000).toFixed(1) + 'k' : '₱' + monthlyRevenue.toLocaleString('en-PH') },
          { label: 'Avg Occupancy',     value: avgOccupancy + '%' },
          { label: 'Peak Day Revenue',  value: peakRevDay >= 1000 ? '₱' + (peakRevDay / 1000).toFixed(1) + 'k' : '₱' + peakRevDay.toLocaleString('en-PH') },
          { label: 'Total Rooms',       value: String(totalRooms) },
        ].map(k => (
          <div key={k.label} className="bg-white border border-warm-border rounded-xl p-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">{k.label}</p>
            <p className="text-xl font-bold text-brown">{loading ? '—' : k.value}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] items-center">
        <span className="text-gray-400 font-medium">Revenue / night:</span>
        {[
          { label: 'None',     bg: 'bg-gray-100' },
          { label: '< ₱3k',   bg: 'bg-emerald-50' },
          { label: '< ₱8k',   bg: 'bg-emerald-100' },
          { label: '< ₱18k',  bg: 'bg-emerald-200' },
          { label: '< ₱35k',  bg: 'bg-emerald-400' },
          { label: '₱35k+',   bg: 'bg-emerald-600' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1">
            <span className={`w-3.5 h-3.5 rounded-sm inline-block ${l.bg} border border-gray-200`} />
            <span className="text-gray-500">{l.label}</span>
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <p className="text-gray-400 text-sm py-10 text-center">Loading…</p>
      ) : (
        <div className="bg-white border border-warm-border rounded-xl overflow-hidden shadow-sm">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-warm-border bg-gray-50">
            {WEEKDAYS.map(w => (
              <div key={w} className="py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{w}</div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-warm-border/50 last:border-0">
              {week.map((iso, di) => {
                if (!iso) return <div key={di} className="bg-gray-50/50 min-h-[80px] border-r border-warm-border/40 last:border-r-0" />

                const data = dayMap.get(iso)
                const tier = data ? revenueTier(data.revenue) : revenueTier(0)
                const isToday = iso === todayIso
                const occ = data && totalRooms ? Math.round((data.occupied / totalRooms) * 100) : 0
                const dayNum = parseInt(iso.split('-')[2])

                return (
                  <button
                    key={iso}
                    onClick={() => {
                      if (!data) return
                      setPopover({
                        ...data,
                        dateLabel: new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
                          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                        }),
                      })
                    }}
                    className={`
                      min-h-[80px] p-2 text-left border-r border-warm-border/40 last:border-r-0
                      transition-all cursor-pointer group
                      ${tier.bg} hover:brightness-95
                      ${isToday ? 'ring-2 ring-inset ring-terra/60' : ''}
                    `}
                  >
                    {/* Date number */}
                    <div className={`text-xs font-bold mb-1.5 ${
                      isToday ? 'text-terra' : data?.revenue ? tier.text : 'text-gray-400'
                    }`}>
                      {dayNum}
                      {isToday && <span className="ml-1 text-[9px] font-semibold text-terra uppercase tracking-wide">Today</span>}
                    </div>

                    {data && data.occupied > 0 && (
                      <>
                        {/* Occupancy */}
                        <div className={`text-[11px] font-bold leading-none mb-0.5 ${tier.text}`}>{occ}%</div>
                        {/* Revenue */}
                        <div className={`text-[10px] leading-none ${data.revenue > 0 ? tier.text : 'text-gray-400'} opacity-80`}>
                          {peso(data.revenue)}
                        </div>
                      </>
                    )}

                    {/* Occupancy bar */}
                    {data && data.occupied > 0 && totalRooms > 0 && (
                      <div className="mt-2 h-1 rounded-full bg-black/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-current opacity-40"
                          style={{ width: `${occ}%`, color: 'currentColor' }}
                        />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Popover */}
      {popover && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPopover(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Daily Summary</p>
            <p className="font-bold text-brown text-base mb-5">{popover.dateLabel}</p>
            <div className="space-y-3">
              {[
                { label: 'Occupancy', value: totalRooms ? `${popover.occupied} / ${totalRooms} rooms (${Math.round(popover.occupied / totalRooms * 100)}%)` : `${popover.occupied} rooms` },
                { label: 'Revenue',        value: popover.revenue > 0 ? '₱' + popover.revenue.toLocaleString('en-PH') : '—' },
                { label: 'Reservations',   value: String(popover.reservationCount) },
                { label: 'Guests in-house',value: String(popover.guestCount) },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-500">{row.label}</span>
                  <span className="text-sm font-semibold text-brown">{row.value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setPopover(null)}
              className="mt-5 w-full border border-warm-border py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
