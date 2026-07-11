'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Review = {
  id: string
  rating: number | null
  title: string | null
  body: string | null
  status: string
  created_at: string
  guests: { full_name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

function Stars({ n }: { n: number | null }) {
  if (!n) return <span className="text-gray-300 text-sm">No rating</span>
  return (
    <span className="text-sm">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? 'text-amber-400' : 'text-gray-200'}>★</span>
      ))}
      <span className="text-xs text-gray-500 ml-1">{n}/5</span>
    </span>
  )
}

export default function AdminReviewsPage() {
  const supabase = createClient()
  const [reviews, setReviews] = useState<Review[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reviews')
      .select('id, rating, title, body, status, created_at, guests(full_name)')
      .order('created_at', { ascending: false })
      .limit(200)
    setReviews((data as unknown as Review[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from('reviews').update({ status }).eq('id', id)
    setMsg({ id, text: error ? error.message : `Marked as "${status}".`, ok: !error })
    load()
  }

  async function del(id: string) {
    if (!confirm('Delete this review?')) return
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (error) { setMsg({ id, text: error.message, ok: false }); return }
    load()
  }

  const visible = filter === 'all' ? reviews : reviews.filter(r => r.status === filter)
  const counts = {
    all: reviews.length,
    pending: reviews.filter(r => r.status === 'pending').length,
    approved: reviews.filter(r => r.status === 'approved').length,
    rejected: reviews.filter(r => r.status === 'rejected').length,
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-brown">Guest Reviews</h1>
        <p className="text-sm text-gray-500 mt-0.5">Moderate reviews before they appear on the public website.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
              filter === s ? 'bg-terra text-white border-terra' : 'hover:border-terra text-brown-mid border-warm-border'
            }`}>
            {s} ({counts[s]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading reviews…</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No {filter === 'all' ? '' : filter} reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <div key={r.id} className="bg-white border border-warm-border rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-brown">{r.guests?.full_name ?? 'Guest'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[r.status] ?? 'bg-gray-100'}`}>{r.status}</span>
                  </div>
                  <div className="mb-2"><Stars n={r.rating} /></div>
                  {r.title && <p className="font-medium text-sm text-brown mb-1">"{r.title}"</p>}
                  {r.body && <p className="text-sm text-gray-600 leading-relaxed">{r.body}</p>}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(r.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  {msg?.id === r.id && (
                    <p className={`text-xs mt-1 ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {r.status !== 'approved' && (
                    <button onClick={() => setStatus(r.id, 'approved')}
                      className="text-xs bg-terra text-white px-3 py-1.5 rounded-lg hover:bg-terra-dark transition-colors whitespace-nowrap">
                      Approve
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button onClick={() => setStatus(r.id, 'rejected')}
                      className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 whitespace-nowrap">
                      Reject
                    </button>
                  )}
                  <button onClick={() => del(r.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors text-center">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
