'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Ticket = {
  id: string
  subject: string
  message: string
  status: string
  admin_reply: string | null
  replied_at: string | null
  created_at: string
  guests: { full_name: string; email: string; phone: string | null } | null
}

const STATUS_COLORS: Record<string, string> = {
  open:        'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved:    'bg-green-100 text-green-700',
  closed:      'bg-gray-200 text-gray-500',
}

const STATUS_ACTIONS: Record<string, { label: string; next: string }[]> = {
  open:        [{ label: 'Mark In Progress', next: 'in_progress' }],
  in_progress: [{ label: 'Mark Resolved', next: 'resolved' }],
  resolved:    [{ label: 'Close', next: 'closed' }],
}

function fmt(d: string) {
  return new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminSupportTicketsPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filter, setFilter] = useState<string>('active')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('id, subject, message, status, admin_reply, replied_at, created_at, guests(full_name, email, phone)')
      .order('created_at', { ascending: false })
      .limit(200)
    setTickets((data as unknown as Ticket[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id)
    setMsg({ id, text: error ? error.message : `Status updated to "${status}".`, ok: !error })
    load()
  }

  async function sendReply(id: string) {
    if (!replyDraft.trim()) return
    const { error } = await supabase.from('support_tickets')
      .update({ admin_reply: replyDraft.trim(), replied_at: new Date().toISOString() })
      .eq('id', id)
    setMsg({ id, text: error ? error.message : 'Reply sent.', ok: !error })
    if (!error) setReplyDraft('')
    load()
  }

  async function del(id: string) {
    if (!confirm('Delete this ticket?')) return
    const { error } = await supabase.from('support_tickets').delete().eq('id', id)
    if (error) { setMsg({ id, text: error.message, ok: false }); return }
    load()
  }

  const filterMap: Record<string, string[]> = {
    active:      ['open', 'in_progress'],
    all:         ['open', 'in_progress', 'resolved', 'closed'],
    open:        ['open'],
    in_progress: ['in_progress'],
    resolved:    ['resolved'],
    closed:      ['closed'],
  }

  const visible = tickets.filter(t => (filterMap[filter] ?? []).includes(t.status))
  const openCount = tickets.filter(t => t.status === 'open').length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Messages from registered guests via the website or mobile app.
            {openCount > 0 && <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">{openCount} open</span>}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 flex-wrap">
        {(['active', 'all', 'open', 'in_progress', 'resolved', 'closed'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
              filter === s ? 'bg-terra text-white border-terra' : 'hover:border-terra text-brown-mid border-warm-border'
            }`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading tickets…</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No {filter === 'all' ? '' : filter.replace('_', ' ')} tickets.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(t => {
            const isExpanded = expanded === t.id
            const actions = STATUS_ACTIONS[t.status] ?? []
            return (
              <div key={t.id} className="bg-white border border-warm-border rounded-xl overflow-hidden">
                <button
                  onClick={() => { setExpanded(isExpanded ? null : t.id); setReplyDraft('') }}
                  className="w-full text-left p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-brown text-sm">{t.guests?.full_name ?? 'Unknown guest'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[t.status] ?? 'bg-gray-100'}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500">· {t.subject}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {t.guests?.email}{t.guests?.phone ? ` · ${t.guests.phone}` : ''} · {fmt(t.created_at)}
                    </p>
                    {!isExpanded && (
                      <p className="text-sm text-gray-600 mt-1 truncate">{t.message}</p>
                    )}
                  </div>
                  <span className={`text-gray-400 text-lg shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>⌄</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-warm-border">
                    <p className="text-sm text-brown leading-relaxed whitespace-pre-wrap mb-4">{t.message}</p>

                    {t.admin_reply && (
                      <div className="bg-[#f5ede4] border border-warm-border rounded-lg p-3 mb-4">
                        <p className="text-xs uppercase tracking-widest text-terra mb-1">Your Reply</p>
                        <p className="text-sm text-brown whitespace-pre-wrap">{t.admin_reply}</p>
                        {t.replied_at && <p className="text-xs text-gray-400 mt-1">{fmt(t.replied_at)}</p>}
                      </div>
                    )}

                    <div className="flex gap-2 mb-3">
                      <input
                        value={replyDraft}
                        onChange={e => setReplyDraft(e.target.value)}
                        placeholder="Write a reply to the guest…"
                        className="flex-1 border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                      />
                      <button onClick={() => sendReply(t.id)}
                        className="text-xs bg-terra text-white px-3 py-1.5 rounded-lg hover:bg-terra-dark transition-colors shrink-0">
                        Send Reply
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {actions.map(({ label, next }) => (
                        <button key={next} onClick={() => updateStatus(t.id, next)}
                          className="text-xs border border-warm-border text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                          {label}
                        </button>
                      ))}
                      <button onClick={() => del(t.id)}
                        className="text-xs text-red-400 hover:text-red-600 ml-auto">Delete</button>
                    </div>
                    {msg?.id === t.id && (
                      <p className={`text-xs mt-2 ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
