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
}

const STATUS_COLORS: Record<string, string> = {
  open:        'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved:    'bg-green-100 text-green-700',
  closed:      'bg-gray-100 text-gray-500',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) +
    ' ' + new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

export default function GuestSupportPage() {
  const supabase = createClient()
  const [guestId, setGuestId] = useState<string | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: guest } = await supabase.from('guests').select('id').eq('profile_id', user.id).maybeSingle()
    setGuestId(guest?.id ?? null)

    if (guest?.id) {
      const { data } = await supabase
        .from('support_tickets')
        .select('id, subject, message, status, admin_reply, replied_at, created_at')
        .eq('guest_id', guest.id)
        .order('created_at', { ascending: false })
      setTickets((data as Ticket[]) ?? [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!guestId) { setError('Guest profile not found. Please contact front desk.'); return }
    if (!subject.trim() || !message.trim()) return

    setSending(true)
    setError(null)
    const { error: err } = await supabase.from('support_tickets').insert({
      guest_id: guestId,
      subject: subject.trim(),
      message: message.trim(),
    })
    setSending(false)

    if (err) { setError(err.message); return }
    setSubject('')
    setMessage('')
    setSuccess('Ticket sent! Our team will get back to you soon.')
    setTimeout(() => setSuccess(null), 5000)
    load()
  }

  return (
    <div>
      <div className="bg-[#2d1c14] px-6 pt-14 pb-6">
        <h1 className="font-serif text-2xl font-bold text-[#f0e0d0]">Support</h1>
        <p className="text-[#7a5040] text-xs mt-0.5">Send a message to our front desk team</p>
      </div>

      <div className="p-5 space-y-6">
        {/* New ticket form */}
        <form onSubmit={submit} className="bg-white border border-[#e8d5c8] rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-[#3d2018]">Send a Message</h2>

          <div>
            <label className="block text-xs font-medium text-[#7a5040] uppercase tracking-wide mb-1.5">Subject</label>
            <input
              required
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Air conditioning not working"
              className="w-full border border-[#e8d5c8] rounded-xl px-4 py-3 text-sm text-[#3d2018] focus:outline-none focus:ring-2 focus:ring-[#b85c38]/30 focus:border-[#b85c38]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#7a5040] uppercase tracking-wide mb-1.5">Message</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe what you need help with…"
              className="w-full border border-[#e8d5c8] rounded-xl px-4 py-3 text-sm text-[#3d2018] focus:outline-none focus:ring-2 focus:ring-[#b85c38]/30 focus:border-[#b85c38] resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}

          <button
            type="submit"
            disabled={sending || !guestId}
            className="w-full bg-[#b85c38] text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-[#a0502f] transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send to Front Desk'}
          </button>
        </form>

        {/* Ticket history */}
        <section>
          <h2 className="font-semibold text-[#3d2018] mb-3">My Tickets</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-10 text-[#8a6a5a]">
              <p className="text-3xl mb-2">🎫</p>
              <p className="text-sm">No support tickets yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map(t => (
                <div key={t.id} className="bg-white border border-[#e8d5c8] rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-medium text-[#3d2018] text-sm leading-snug">{t.subject}</p>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize shrink-0 ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[#7a5040] leading-relaxed mb-2">{t.message}</p>
                  <p className="text-[10px] text-[#b0a098] mb-2">{fmt(t.created_at)}</p>
                  {t.admin_reply && (
                    <div className="mt-2 pt-3 border-t border-gray-100">
                      <p className="text-[10px] uppercase tracking-wide text-[#b85c38] font-medium mb-1">Front Desk Reply</p>
                      <p className="text-xs text-[#3d2018] leading-relaxed">{t.admin_reply}</p>
                      {t.replied_at && <p className="text-[10px] text-[#b0a098] mt-1">{fmt(t.replied_at)}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
