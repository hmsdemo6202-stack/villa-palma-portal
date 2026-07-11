'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Inquiry = {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string | null
  message: string
  status: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  new:     'bg-blue-100 text-blue-700',
  read:    'bg-gray-100 text-gray-600',
  replied: 'bg-green-100 text-green-700',
  closed:  'bg-gray-200 text-gray-500',
}

const STATUS_ACTIONS: Record<string, { label: string; next: string }[]> = {
  new:     [{ label: 'Mark Read', next: 'read' }],
  read:    [{ label: 'Mark Replied', next: 'replied' }],
  replied: [{ label: 'Close', next: 'closed' }],
}

function fmt(d: string) {
  return new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminContactsPage() {
  const supabase = createClient()
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [filter, setFilter] = useState<string>('active')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('contact_inquiries')
      .select('id, name, email, phone, subject, message, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    setInquiries((data as Inquiry[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('contact_inquiries').update({ status }).eq('id', id)
    setMsg({ id, text: error ? error.message : `Status updated to "${status}".`, ok: !error })
    load()
  }

  async function del(id: string) {
    if (!confirm('Delete this inquiry?')) return
    const { error } = await supabase.from('contact_inquiries').delete().eq('id', id)
    if (error) { setMsg({ id, text: error.message, ok: false }); return }
    load()
  }

  const filterMap: Record<string, string[]> = {
    active:  ['new', 'read', 'replied'],
    all:     ['new', 'read', 'replied', 'closed'],
    new:     ['new'],
    read:    ['read'],
    replied: ['replied'],
    closed:  ['closed'],
  }

  const visible = inquiries.filter(i => (filterMap[filter] ?? []).includes(i.status))
  const newCount = inquiries.filter(i => i.status === 'new').length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Contact Inquiries</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Messages submitted via the website contact form.
            {newCount > 0 && <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">{newCount} new</span>}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 flex-wrap">
        {(['active', 'all', 'new', 'read', 'replied', 'closed'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
              filter === s ? 'bg-terra text-white border-terra' : 'hover:border-terra text-brown-mid border-warm-border'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading inquiries…</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No {filter === 'all' ? '' : filter} inquiries.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(inq => {
            const isExpanded = expanded === inq.id
            const actions = STATUS_ACTIONS[inq.status] ?? []
            return (
              <div key={inq.id} className="bg-white border border-warm-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : inq.id)}
                  className="w-full text-left p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-brown text-sm">{inq.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[inq.status] ?? 'bg-gray-100'}`}>
                        {inq.status}
                      </span>
                      {inq.subject && <span className="text-xs text-gray-500">· {inq.subject}</span>}
                    </div>
                    <p className="text-xs text-gray-400">{inq.email}{inq.phone ? ` · ${inq.phone}` : ''} · {fmt(inq.created_at)}</p>
                    {!isExpanded && (
                      <p className="text-sm text-gray-600 mt-1 truncate">{inq.message}</p>
                    )}
                  </div>
                  <span className={`text-gray-400 text-lg shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>⌄</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-warm-border">
                    <p className="text-sm text-brown leading-relaxed whitespace-pre-wrap mb-4">{inq.message}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={`mailto:${inq.email}?subject=Re: ${encodeURIComponent(inq.subject ?? 'Your Inquiry')}`}
                        className="text-xs bg-terra text-white px-3 py-1.5 rounded-lg hover:bg-terra-dark transition-colors">
                        Reply via Email
                      </a>
                      {actions.map(({ label, next }) => (
                        <button key={next} onClick={() => updateStatus(inq.id, next)}
                          className="text-xs border border-warm-border text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                          {label}
                        </button>
                      ))}
                      <button onClick={() => del(inq.id)}
                        className="text-xs text-red-400 hover:text-red-600 ml-auto">Delete</button>
                    </div>
                    {msg?.id === inq.id && (
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
