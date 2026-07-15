'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type AuditLog = {
  id: string
  user_id: string | null
  username_snapshot: string | null
  action: string
  table_name: string | null
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN:  'bg-gray-100 text-gray-600',
}

function actionColor(a: string) {
  return ACTION_COLORS[a.split(' ')[0].toUpperCase()] ?? 'bg-amber-100 text-amber-700'
}

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function getWeekBounds(offset: number): { start: Date; end: Date } {
  const now = new Date()
  const dow = now.getDay()
  const daysToMon = dow === 0 ? 6 : dow - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysToMon + offset * 7)
  monday.setHours(0, 0, 0, 0)
  monday.setMinutes(0); monday.setSeconds(0); monday.setMilliseconds(0)
  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)
  return { start: monday, end: nextMonday }
}

function weekLabel(offset: number): string {
  const { start, end } = getWeekBounds(offset)
  const sun = new Date(end); sun.setDate(end.getDate() - 1)
  const fmt = (d: Date) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(sun)}, ${start.getFullYear()}`
}

const TAB_SIZE = 500
const KNOWN_ACTIONS = ['INSERT', 'UPDATE', 'DELETE', 'LOGIN']

function visibleTabNumbers(totalTabs: number, current: number): (number | '...')[] {
  if (totalTabs <= 7) return Array.from({ length: totalTabs }, (_, i) => i)
  const show = new Set(
    [0, totalTabs - 1, current, current - 1, current + 1].filter(n => n >= 0 && n < totalTabs)
  )
  const sorted = Array.from(show).sort((a, b) => a - b)
  const result: (number | '...')[] = []
  let prev = -1
  for (const n of sorted) {
    if (n - prev > 1) result.push('...')
    result.push(n)
    prev = n
  }
  return result
}

export default function ActivityLogPage() {
  const [weekOffset, setWeekOffset]       = useState(0)
  const [tabIndex, setTabIndex]           = useState(0)
  const [searchInput, setSearchInput]     = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [tableFilter, setTableFilter]     = useState('')
  const [actionFilter, setActionFilter]   = useState('')
  const [logs, setLogs]                   = useState<AuditLog[]>([])
  const [totalCount, setTotalCount]       = useState(0)
  const [allTables, setAllTables]         = useState<string[]>([])
  const [loading, setLoading]             = useState(true)
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const fetchToken                        = useRef(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('audit_logs').select('table_name').not('table_name', 'is', null)
      .then(({ data }) => {
        const uniq = Array.from(new Set(
          (data ?? []).map((r: { table_name: string | null }) => r.table_name).filter(Boolean) as string[]
        )).sort()
        setAllTables(uniq)
      })
  }, [])

  const fetchLogs = useCallback(async (
    week: number, tab: number, search: string, table: string, action: string
  ) => {
    const token = ++fetchToken.current
    setLoading(true)
    const supabase = createClient()
    const { start, end } = getWeekBounds(week)

    let countQ = supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())

    let dataQ = supabase
      .from('audit_logs')
      .select('*')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .range(tab * TAB_SIZE, (tab + 1) * TAB_SIZE - 1)

    if (search) {
      const f = `username_snapshot.ilike.%${search}%,action.ilike.%${search}%,table_name.ilike.%${search}%`
      countQ = countQ.or(f)
      dataQ  = dataQ.or(f)
    }
    if (table)  { countQ = countQ.eq('table_name', table);  dataQ = dataQ.eq('table_name', table) }
    if (action) { countQ = countQ.eq('action', action);     dataQ = dataQ.eq('action', action) }

    try {
      const [{ count }, { data }] = await Promise.all([countQ, dataQ])
      if (token !== fetchToken.current) return
      setTotalCount(count ?? 0)
      setLogs((data as AuditLog[]) ?? [])
    } catch {
      if (token !== fetchToken.current) return
      setLogs([])
      setTotalCount(0)
    } finally {
      if (token === fetchToken.current) setLoading(false)
    }
  }, [])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedSearch(searchInput)
      setTabIndex(0)
      setExpandedId(null)
    }, searchInput ? 350 : 0)
    return () => clearTimeout(t)
  }, [searchInput])

  // Fetch whenever params change
  useEffect(() => {
    fetchLogs(weekOffset, tabIndex, appliedSearch, tableFilter, actionFilter)
  }, [weekOffset, tabIndex, appliedSearch, tableFilter, actionFilter, fetchLogs])

  function changeWeek(delta: number) {
    setWeekOffset(w => w + delta)
    setTabIndex(0)
    setExpandedId(null)
  }

  function changeTab(idx: number) {
    setTabIndex(idx)
    setExpandedId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function applyDropdown(setter: (v: string) => void, val: string) {
    setter(val)
    setTabIndex(0)
    setExpandedId(null)
  }

  function clearFilters() {
    setSearchInput('')
    setAppliedSearch('')
    setTableFilter('')
    setActionFilter('')
    setTabIndex(0)
    setExpandedId(null)
  }

  const totalTabs     = Math.max(1, Math.ceil(totalCount / TAB_SIZE))
  const isCurrentWeek = weekOffset === 0
  const hasFilters    = !!searchInput || !!tableFilter || !!actionFilter

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brown">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading
              ? 'Loading…'
              : `${totalCount.toLocaleString()} entr${totalCount === 1 ? 'y' : 'ies'}${hasFilters ? ' matching filters' : ' this week'}`
            }
          </p>
        </div>
        <button
          onClick={() => fetchLogs(weekOffset, tabIndex, appliedSearch, tableFilter, actionFilter)}
          disabled={loading}
          className="text-xs border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-40"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center border border-warm-border rounded-xl bg-white overflow-hidden">
        <button
          onClick={() => changeWeek(-1)}
          className="flex items-center gap-1 px-4 py-3 text-sm text-gray-500 hover:text-brown hover:bg-gray-50 transition-colors border-r border-warm-border shrink-0"
        >
          ← <span className="hidden sm:inline ml-1">Prev Week</span>
        </button>

        <div className="flex-1 text-center py-3 px-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-terra mb-0.5">
            {isCurrentWeek ? 'Current Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} weeks ago`}
          </p>
          <p className="text-sm font-medium text-brown">{weekLabel(weekOffset)}</p>
        </div>

        <button
          onClick={() => changeWeek(1)}
          disabled={isCurrentWeek}
          className="flex items-center gap-1 px-4 py-3 text-sm text-gray-500 hover:text-brown hover:bg-gray-50 transition-colors border-l border-warm-border shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="hidden sm:inline mr-1">Next Week</span> →
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search user, action, table…"
          className="border border-warm-border rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-terra"
        />
        <select
          value={tableFilter}
          onChange={e => applyDropdown(setTableFilter, e.target.value)}
          className="border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
        >
          <option value="">All tables</option>
          {allTables.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={e => applyDropdown(setActionFilter, e.target.value)}
          className="border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
        >
          <option value="">All actions</option>
          {KNOWN_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-terra hover:underline">
            Clear filters
          </button>
        )}
        {!loading && (
          <span className="text-sm text-gray-400 ml-auto">
            {totalCount.toLocaleString()} result{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Numbered Tab Bar */}
      {!loading && totalTabs > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-400 mr-0.5">Page</span>
          {visibleTabNumbers(totalTabs, tabIndex).map((t, i) =>
            t === '...' ? (
              <span key={`e-${i}`} className="px-1 text-gray-400 text-sm select-none">…</span>
            ) : (
              <button
                key={t}
                onClick={() => changeTab(t as number)}
                className={`min-w-[2rem] h-8 px-2 text-sm rounded-lg border transition-colors font-medium ${
                  tabIndex === t
                    ? 'bg-terra text-white border-terra'
                    : 'border-warm-border text-gray-500 hover:bg-gray-50'
                }`}
              >
                {(t as number) + 1}
              </button>
            )
          )}
          <span className="text-xs text-gray-400 ml-2">· 500 entries per page</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="border border-warm-border rounded-xl overflow-hidden bg-white">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b border-warm-border last:border-0 animate-pulse">
              <div className="h-3.5 bg-gray-100 rounded w-28 shrink-0" />
              <div className="h-3.5 bg-gray-100 rounded w-20 shrink-0" />
              <div className="h-3.5 bg-gray-100 rounded w-14 shrink-0" />
              <div className="h-3.5 bg-gray-100 rounded w-24 shrink-0" />
              <div className="h-3.5 bg-gray-100 rounded flex-1" />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 border border-warm-border rounded-xl bg-white">
          <p className="text-4xl mb-3">📋</p>
          {!hasFilters ? (
            <>
              <p className="font-medium text-gray-600">No activity recorded this week</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
                Activity is captured automatically when staff make changes in the portal.
                Try navigating to a previous week if you expect older entries.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-gray-600">No entries match your filters</p>
              <button onClick={clearFilters} className="mt-3 text-sm text-terra hover:underline">
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-warm-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                {['Date / Time', 'User', 'Action', 'Table', 'Record ID', 'IP', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {logs.map(log => (
                <React.Fragment key={log.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDT(log.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-brown">
                      {log.username_snapshot ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{log.table_name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[100px] truncate" title={log.record_id ?? ''}>
                      {log.record_id ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{log.ip_address ?? '—'}</td>
                    <td className="px-4 py-3">
                      {(log.old_data || log.new_data) && (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-xs text-terra hover:underline whitespace-nowrap"
                        >
                          {expandedId === log.id ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {log.old_data && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">Before</p>
                              <pre className="text-xs bg-red-50 border border-red-100 rounded-lg p-3 overflow-x-auto text-red-800 max-h-48">
                                {JSON.stringify(log.old_data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_data && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">After</p>
                              <pre className="text-xs bg-green-50 border border-green-100 rounded-lg p-3 overflow-x-auto text-green-800 max-h-48">
                                {JSON.stringify(log.new_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom page nav (mirrors top tab bar for long tables) */}
      {!loading && totalTabs > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={() => changeTab(Math.max(0, tabIndex - 1))}
            disabled={tabIndex === 0}
            className="text-sm border border-warm-border px-4 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {tabIndex + 1} of {totalTabs}</span>
          <button
            onClick={() => changeTab(Math.min(totalTabs - 1, tabIndex + 1))}
            disabled={tabIndex === totalTabs - 1}
            className="text-sm border border-warm-border px-4 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
