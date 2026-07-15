'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type BackupPayload = {
  version: number
  app: string
  exported_at: string
  exported_by: string
  tables: Record<string, Record<string, unknown>[]>
}

type BackupLog = {
  id: string
  type: 'export' | 'import'
  filename: string
  tables_included: string[]
  row_count: number
  file_size_bytes: number | null
  performed_by: string | null
  username: string | null
  created_at: string
  notes: string | null
}

// ─── Crypto ──────────────────────────────────────────────────────────────────

// File format: [4B magic] [16B salt] [12B IV] [N bytes AES-GCM ciphertext]
const HMS_MAGIC   = new Uint8Array([0x48, 0x4d, 0x53, 0x02])
const HMS_PASS    = 'CabalumHMS—DataVault—v2—2025'

// Next.js 16 strict TS types require ArrayBuffer (not ArrayBufferLike) for Web Crypto APIs.
// cx() safely casts Uint8Array to satisfy SubtleCrypto parameter types at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cx = (u: Uint8Array | string): any => typeof u === 'string' ? new TextEncoder().encode(u) : u

async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey('raw', cx(HMS_PASS), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: cx(salt), iterations: 100_000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  )
}

async function encryptToHms(json: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv   = crypto.getRandomValues(new Uint8Array(12))
  const key  = await deriveKey(salt)
  const ct   = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: cx(iv) }, key, cx(json)))
  const out  = new Uint8Array(4 + 16 + 12 + ct.byteLength)
  out.set(HMS_MAGIC, 0); out.set(salt, 4); out.set(iv, 20); out.set(ct, 32)
  return out
}

async function decryptHms(buf: ArrayBuffer): Promise<string> {
  const b = new Uint8Array(buf)
  if (b[0] !== 0x48 || b[1] !== 0x4d || b[2] !== 0x53 || b[3] !== 0x02)
    throw new Error('Not a valid .hms backup file. Make sure you are using a file exported by this system.')
  const key   = await deriveKey(b.slice(4, 20))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: cx(b.slice(20, 32)) }, key, cx(b.slice(32)))
  return new TextDecoder().decode(plain)
}

// ─── Table registry ───────────────────────────────────────────────────────────

// Ordered by FK dependency so import never violates constraints
const EXPORT_TABLES = [
  'departments',
  'room_types',
  'rooms',
  'room_type_images',
  'rate_plans',
  'pos_categories',
  'pos_items',
  'inventory_items',
  'inventory_transactions',
  'promotions',
  'faqs',
  'contacts',
  'support_tickets',
  'reviews',
  'users',
  'guests',
  'reservations',
  'reservation_charges',
  'payments',
  'expenses',
  'orders',
  'order_items',
  'maintenance_tickets',
  'lost_and_found',
  'messages',
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function fmtBytes(n: number) {
  if (n < 1024)        return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

// Type-safe escape hatch for dynamic table names
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function anyFrom(sb: ReturnType<typeof createClient>, table: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (sb as any).from(table)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DataBackupPage() {

  // Export
  const [exporting,  setExporting]  = useState(false)
  const [expStep,    setExpStep]    = useState({ cur: 0, total: EXPORT_TABLES.length, table: '' })
  const [expDone,    setExpDone]    = useState<{ rows: number; size: number } | null>(null)
  const [expError,   setExpError]   = useState('')

  // Import – file parsing
  const fileRef                         = useRef<HTMLInputElement>(null)
  const [parsing,      setParsing]      = useState(false)
  const [parseError,   setParseError]   = useState('')
  const [parsed,       setParsed]       = useState<BackupPayload | null>(null)
  const [parsedSize,   setParsedSize]   = useState(0)
  const [parsedFile,   setParsedFile]   = useState('')

  // Import – table selection + run
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [importing,    setImporting]    = useState(false)
  const [impStep,      setImpStep]      = useState({ cur: 0, total: 0, table: '' })
  const [impDone,      setImpDone]      = useState<{ rows: number; errors: string[] } | null>(null)

  // History
  const [history,      setHistory]      = useState<BackupLog[]>([])
  const [histLoading,  setHistLoading]  = useState(true)
  const [histSearch,   setHistSearch]   = useState('')
  const [histType,     setHistType]     = useState('')

  const loadHistory = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb.from('backup_logs').select('*').order('created_at', { ascending: false }).limit(200)
    setHistory((data as BackupLog[]) ?? [])
    setHistLoading(false)
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  // ── Export ──────────────────────────────────────────────────────────────────

  async function runExport() {
    setExporting(true)
    setExpDone(null)
    setExpError('')
    const sb = createClient()

    const { data: { user } } = await sb.auth.getUser()
    const { data: profile }  = await sb.from('users' as never).select('username').eq('id', user?.id ?? '').maybeSingle()

    const tables: Record<string, Record<string, unknown>[]> = {}
    let totalRows = 0

    for (let i = 0; i < EXPORT_TABLES.length; i++) {
      const tbl = EXPORT_TABLES[i]
      setExpStep({ cur: i + 1, total: EXPORT_TABLES.length, table: tbl })
      try {
        const rows: Record<string, unknown>[] = []
        let page = 0
        while (true) {
          const { data, error } = await anyFrom(sb, tbl)
            .select('*')
            .range(page * 1000, (page + 1) * 1000 - 1)
          if (error || !data || data.length === 0) break
          rows.push(...(data as Record<string, unknown>[]))
          if (data.length < 1000) break
          page++
        }
        tables[tbl] = rows
        totalRows += rows.length
      } catch {
        tables[tbl] = []
      }
    }

    const payload: BackupPayload = {
      version: 2,
      app: 'CabalumHMS',
      exported_at: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exported_by: (profile as any)?.username ?? user?.email ?? 'unknown',
      tables,
    }

    try {
      const bytes = await encryptToHms(JSON.stringify(payload))
      const fname = `cabalum-hms-backup-${new Date().toISOString().slice(0, 10)}.hms`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const url = URL.createObjectURL(new Blob([bytes as any], { type: 'application/octet-stream' }))
      const a   = Object.assign(document.createElement('a'), { href: url, download: fname })
      a.click()
      URL.revokeObjectURL(url)

      await sb.from('backup_logs' as never).insert({
        type: 'export',
        filename: fname,
        tables_included: Object.keys(tables).filter(t => (tables[t]?.length ?? 0) > 0),
        row_count: totalRows,
        file_size_bytes: bytes.byteLength,
        performed_by: user?.id ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        username: (profile as any)?.username ?? null,
      } as never)

      setExpDone({ rows: totalRows, size: bytes.byteLength })
      loadHistory()
    } catch (e) {
      setExpError((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  // ── Import: parse ────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setParsing(true)
    setParseError('')
    setParsed(null)
    setImpDone(null)
    try {
      const buf  = await file.arrayBuffer()
      const json = await decryptHms(buf)
      const data = JSON.parse(json) as BackupPayload
      if (data.app !== 'CabalumHMS' || !data.tables)
        throw new Error('File is corrupted or from an incompatible version.')
      setParsed(data)
      setParsedSize(buf.byteLength)
      setParsedFile(file.name)
      setSelected(new Set(Object.keys(data.tables).filter(t => (data.tables[t]?.length ?? 0) > 0)))
    } catch (e) {
      setParseError((e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  // ── Import: restore ──────────────────────────────────────────────────────────

  async function runImport() {
    if (!parsed) return
    setImporting(true)
    setImpDone(null)
    const sb = createClient()

    const { data: { user } } = await sb.auth.getUser()
    const { data: profile }  = await sb.from('users' as never).select('username').eq('id', user?.id ?? '').maybeSingle()

    // Import in FK-safe order
    const tablesToRun = EXPORT_TABLES.filter(t => selected.has(t) && (parsed.tables[t]?.length ?? 0) > 0)
    let   totalRows   = 0
    const errors: string[] = []

    for (let i = 0; i < tablesToRun.length; i++) {
      const tbl  = tablesToRun[i]
      const rows = parsed.tables[tbl] ?? []
      setImpStep({ cur: i + 1, total: tablesToRun.length, table: tbl })

      for (let j = 0; j < rows.length; j += 100) {
        const { error } = await anyFrom(sb, tbl)
          .upsert(rows.slice(j, j + 100), { onConflict: 'id' })
        if (error) { errors.push(`${tbl}: ${error.message}`); break }
        totalRows += Math.min(100, rows.length - j)
      }
    }

    await sb.from('backup_logs' as never).insert({
      type: 'import',
      filename: parsedFile,
      tables_included: tablesToRun,
      row_count: totalRows,
      performed_by: user?.id ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      username: (profile as any)?.username ?? null,
      notes: errors.length > 0 ? `${errors.length} table(s) had errors` : null,
    } as never)

    setImpDone({ rows: totalRows, errors })
    setImporting(false)
    loadHistory()
  }

  function resetImport() {
    setParsed(null)
    setImpDone(null)
    setParseError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── History filter ───────────────────────────────────────────────────────────

  const filteredHistory = history.filter(h => {
    if (histType && h.type !== histType) return false
    if (histSearch) {
      const q = histSearch.toLowerCase()
      return h.filename.toLowerCase().includes(q) ||
             (h.username ?? '').toLowerCase().includes(q) ||
             h.tables_included.some(t => t.toLowerCase().includes(q))
    }
    return true
  })

  const exportPct = expStep.total > 0 ? (expStep.cur / expStep.total) * 100 : 0
  const impPct    = impStep.total  > 0 ? (impStep.cur  / impStep.total)  * 100 : 0

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brown">Data Backup</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Export all hotel data to an AES-256 encrypted <code className="bg-gray-100 px-1 rounded text-xs">.hms</code> file,
          or restore from a previous backup.
        </p>
      </div>

      {/* ── Export ─────────────────────────────────────────────────────────── */}
      <section className="border border-warm-border rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-5 py-3.5 border-b border-warm-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-brown text-sm">Export Data</h2>
            <p className="text-xs text-gray-400 mt-0.5">All {EXPORT_TABLES.length} tables are always exported. File is AES-256 encrypted.</p>
          </div>
          <span className="text-xs bg-terra-light text-terra border border-[#f0c8a0] px-2 py-0.5 rounded-full font-medium">
            {EXPORT_TABLES.length} tables
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Table list */}
          <div className="flex flex-wrap gap-1.5">
            {EXPORT_TABLES.map(t => (
              <span key={t} className="text-[11px] bg-[#faf6f0] border border-warm-border px-2 py-0.5 rounded text-brown-mid font-mono">
                {t}
              </span>
            ))}
          </div>

          {/* Progress */}
          {exporting && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Exporting <code className="bg-gray-100 px-1 rounded">{expStep.table}</code>…</span>
                <span>{expStep.cur} / {expStep.total}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-terra rounded-full transition-all duration-300" style={{ width: `${exportPct}%` }} />
              </div>
            </div>
          )}

          {/* Success */}
          {expDone && !exporting && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <span>✓</span>
              <span>Exported <strong>{expDone.rows.toLocaleString()}</strong> rows · {fmtBytes(expDone.size)} · Download started</span>
            </div>
          )}

          {/* Error */}
          {expError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {expError}
            </div>
          )}

          <button
            onClick={runExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-terra text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-terra-dark transition-colors disabled:opacity-50"
          >
            {exporting
              ? <><span className="inline-block animate-spin">⟳</span> Exporting…</>
              : <>⬇&nbsp; Export All Data to .hms</>
            }
          </button>
        </div>
      </section>

      {/* ── Import ─────────────────────────────────────────────────────────── */}
      <section className="border border-warm-border rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-5 py-3.5 border-b border-warm-border">
          <h2 className="font-semibold text-brown text-sm">Import / Restore</h2>
          <p className="text-xs text-gray-400 mt-0.5">Choose which tables to restore. Existing records are overwritten (upsert by ID).</p>
        </div>

        <div className="p-5 space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".hms"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />

          {/* Drop zone (no file loaded yet) */}
          {!parsed && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={parsing}
                className="w-full border-2 border-dashed border-warm-border rounded-xl py-12 text-center hover:border-terra hover:bg-[#faf6f0] transition-colors"
              >
                {parsing ? (
                  <div className="text-sm text-gray-400">
                    <span className="inline-block animate-spin mr-1">⟳</span> Decrypting…
                  </div>
                ) : (
                  <>
                    <p className="text-3xl mb-2">📦</p>
                    <p className="text-sm font-medium text-gray-600">Click to choose a .hms backup file</p>
                    <p className="text-xs text-gray-400 mt-1">Only files exported by this system can be opened</p>
                  </>
                )}
              </button>
              {parseError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  {parseError}
                  <button onClick={() => setParseError('')} className="ml-3 underline text-xs">Dismiss</button>
                </div>
              )}
            </>
          )}

          {/* File loaded — selection UI */}
          {parsed && (
            <div className="space-y-4">

              {/* Backup metadata */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                  <span>📦</span>
                  <span className="font-mono">{parsedFile}</span>
                  <span className="text-blue-400 font-normal text-xs">{fmtBytes(parsedSize)}</span>
                </div>
                <p className="text-xs text-blue-600">
                  Exported <strong>{fmtDate(parsed.exported_at)}</strong> by <strong>{parsed.exported_by}</strong>
                </p>
                <p className="text-xs text-blue-500">
                  {Object.values(parsed.tables).reduce((s, r) => s + r.length, 0).toLocaleString()} total rows
                  · {Object.keys(parsed.tables).length} tables in file
                </p>
              </div>

              {/* Table checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select tables to import</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelected(new Set(
                        Object.keys(parsed.tables).filter(t => (parsed.tables[t]?.length ?? 0) > 0)
                      ))}
                      className="text-xs text-terra hover:underline"
                    >Select all</button>
                    <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:underline">
                      Clear
                    </button>
                  </div>
                </div>

                <div className="border border-warm-border rounded-xl overflow-hidden divide-y divide-warm-border">
                  {EXPORT_TABLES.filter(t => t in parsed.tables).map(tbl => {
                    const count = parsed.tables[tbl]?.length ?? 0
                    const on    = selected.has(tbl)
                    return (
                      <label
                        key={tbl}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none ${
                          on ? 'bg-white' : 'bg-gray-50 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            const s = new Set(selected)
                            on ? s.delete(tbl) : s.add(tbl)
                            setSelected(s)
                          }}
                          className="accent-terra w-4 h-4 shrink-0"
                        />
                        <span className="flex-1 text-sm text-brown font-mono">{tbl}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          count > 0 ? 'bg-terra-light text-terra border border-[#f0c8a0]' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {count.toLocaleString()} {count === 1 ? 'row' : 'rows'}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  {selected.size} of {Object.keys(parsed.tables).length} tables selected
                </p>
              </div>

              {/* Progress */}
              {importing && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Importing <code className="bg-gray-100 px-1 rounded">{impStep.table}</code>…</span>
                    <span>{impStep.cur} / {impStep.total}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${impPct}%` }} />
                  </div>
                </div>
              )}

              {/* Result */}
              {impDone && (
                <div className={`rounded-lg px-4 py-3 text-sm border ${
                  impDone.errors.length > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-green-50 border-green-200 text-green-700'
                }`}>
                  <p className="font-medium">
                    ✓ Import complete — {impDone.rows.toLocaleString()} rows restored
                  </p>
                  {impDone.errors.length > 0 && (
                    <ul className="text-xs mt-1.5 space-y-0.5 list-disc ml-4 text-amber-600">
                      {impDone.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={runImport}
                  disabled={importing || selected.size === 0}
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {importing
                    ? <><span className="inline-block animate-spin">⟳</span> Importing…</>
                    : <>⬆&nbsp; Import {selected.size} Table{selected.size !== 1 ? 's' : ''}</>
                  }
                </button>
                <button
                  onClick={resetImport}
                  disabled={importing}
                  className="border border-warm-border px-4 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  Choose different file
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── History ────────────────────────────────────────────────────────── */}
      <section className="border border-warm-border rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-5 py-3.5 border-b border-warm-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-brown text-sm">Backup History</h2>
            <p className="text-xs text-gray-400 mt-0.5">Last 200 export and import operations.</p>
          </div>
          <button
            onClick={loadHistory}
            className="text-xs border border-warm-border px-3 py-1.5 rounded-lg hover:bg-white transition-colors text-gray-400"
          >
            ↻ Refresh
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <input
              value={histSearch}
              onChange={e => setHistSearch(e.target.value)}
              placeholder="Search file, user, table name…"
              className="border border-warm-border rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-terra"
            />
            <select
              value={histType}
              onChange={e => setHistType(e.target.value)}
              className="border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
            >
              <option value="">All types</option>
              <option value="export">Export only</option>
              <option value="import">Import only</option>
            </select>
            {(histSearch || histType) && (
              <button onClick={() => { setHistSearch(''); setHistType('') }} className="text-xs text-terra hover:underline">
                Clear
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400">{filteredHistory.length} record{filteredHistory.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Table */}
          {histLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 border border-warm-border rounded-xl bg-white">
              <p className="text-3xl mb-2">🗄️</p>
              {history.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-gray-600">No backups yet</p>
                  <p className="text-xs text-gray-400 mt-1">Run your first export above to start building a history.</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    If you already ran the SQL, make sure <code className="bg-gray-100 px-1 rounded">HMS_BACKUP_LOGS.sql</code> was applied in Supabase.
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">No records match your filters.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-warm-border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    {['Date', 'Type', 'File', 'Tables', 'Rows', 'Size', 'By', 'Notes'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {filteredHistory.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          log.type === 'export'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {log.type === 'export' ? '⬇ export' : '⬆ import'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-brown max-w-[180px] truncate" title={log.filename}>
                        {log.filename}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{log.tables_included?.length ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{log.row_count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {log.file_size_bytes != null ? fmtBytes(log.file_size_bytes) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-brown">{log.username ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[140px] truncate" title={log.notes ?? ''}>
                        {log.notes ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
