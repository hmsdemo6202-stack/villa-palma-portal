'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function GuestLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'admin' || profile?.role === 'staff') {
      router.push('/admin/dashboard')
    } else {
      router.push('/guest/rooms')
    }
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col">
      <div className="bg-[#2d1c14] px-6 pt-16 pb-10 text-center">
        <p className="text-[9px] tracking-[0.4em] text-[#8a6a5a] uppercase mb-2">Welcome to</p>
        <h1 className="font-serif text-3xl font-bold text-[#f0e0d0] tracking-wide">Cabalum Hotel</h1>
        <div className="w-10 h-px bg-[#b85c38] mx-auto mt-4" />
      </div>

      <div className="flex-1 px-6 py-10 max-w-md mx-auto w-full">
        <h2 className="text-xl font-semibold text-[#3d2018] mb-1">Sign In</h2>
        <p className="text-sm text-[#8a6a5a] mb-8">Access your reservations and hotel services</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#7a5040] uppercase tracking-wide mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="w-full border border-[#e8d5c8] rounded-xl px-4 py-3.5 text-sm bg-white text-[#3d2018] placeholder-[#c8a898] focus:outline-none focus:ring-2 focus:ring-[#b85c38] focus:border-[#b85c38]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#7a5040] uppercase tracking-wide mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full border border-[#e8d5c8] rounded-xl px-4 py-3.5 text-sm bg-white text-[#3d2018] placeholder-[#c8a898] focus:outline-none focus:ring-2 focus:ring-[#b85c38] focus:border-[#b85c38]"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#b85c38] text-white py-4 rounded-xl font-medium hover:bg-[#9a4a2a] disabled:opacity-50 transition-colors tracking-wide"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-[#8a6a5a] mt-8">
          New guest?{' '}
          <Link href="/guest/register" className="text-[#b85c38] font-medium hover:underline">
            Create account
          </Link>
        </p>
        <p className="text-center text-xs text-[#c8a898] mt-3">
          Hotel staff?{' '}
          <Link href="/login" className="hover:underline">Staff sign in</Link>
        </p>
      </div>
    </div>
  )
}
