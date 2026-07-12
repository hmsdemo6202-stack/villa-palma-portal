'use client'
import React, { useState, useEffect, useCallback } from 'react'
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

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN:  'bg-gray-100 text-gray-600',
}

function actionColor(action: string) {
  const key = action.split(' ')[0].toUpperCase()
  return ACTION_COLORS[key] ?? 'bg-gray-100 text-gray-600'
}

export default function AuditLogPage() {
  const supabase = createClient()
  const [logs, setLogs]       = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    setLogs((data as AuditLog[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const tables = Array.from(new Set(logs.map(l => l.table_name).filter(Boolean) as string[])).sort()

  const filtered = logs.filter(l => {
    if (tableFilter && l.table_name !== tableFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (l.username_snapshot ?? '').toLowerCase().includes(q)
        || (l.action ?? '').toLowerCase().includes(q)
        || (l.table_name ?? '').toLowerCase().includes(q)
        || (l.record_id ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  if (loading) return <div className="text-gray-400">Loading audit log…</div>

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-brown">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-0.5">{logs.length} entries (last 500)</p>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">No audit entries yet.</p>
          <p className="text-sm mt-1">Entries are written by your server actions and triggers. Run the Phase 2 SQL to enable the audit_logs table, then configure your server actions to insert here.</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search by user, action, table…"
              className="border border-warm-border rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-terra" />
            <select value={tableFilter} onChange={e => { setTableFilter(e.target.value); setPage(0) }}
              className="border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
              <option value="">All tables</option>
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(search || tableFilter) && (
              <button onClick={() => { setSearch(''); setTableFilter(''); setPage(0) }}
                className="text-xs text-terra hover:underline">Clear filters</button>
            )}
            <span className="text-sm text-gray-400 ml-auto">{filtered.length} matching</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-warm-border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>{['Date / Time', 'User', 'Action', 'Table', 'Record ID', 'IP', ''].map(h =>
                  <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {paged.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No entries match your filters.</td></tr>
                )}
                {paged.map(log => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDT(log.created_at)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-brown">{log.username_snapshot ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${actionColor(log.action)}`}>{log.action}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{log.table_name ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[100px] truncate">{log.record_id ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{log.ip_address ?? '—'}</td>
                      <td className="px-4 py-3">
                        {(log.old_data || log.new_data) && (
                          <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            className="text-xs text-terra hover:underline">
                            {expandedId === log.id ? 'Hide' : 'Data'}
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
                                <pre className="text-xs bg-red-50 border border-red-100 rounded-lg p-3 overflow-x-auto text-red-800 max-h-40">
                                  {JSON.stringify(log.old_data, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.new_data && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1">After</p>
                                <pre className="text-xs bg-green-50 border border-green-100 rounded-lg p-3 overflow-x-auto text-green-800 max-h-40">
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3 justify-center">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                ← Previous
              </button>
              <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="text-sm border border-warm-border px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
