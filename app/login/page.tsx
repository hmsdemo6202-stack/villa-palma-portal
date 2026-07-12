'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email:    `${username.trim().toLowerCase()}@cabalum.internal`,
      password,
    })
    if (err) {
      setError('Invalid username or password.')
      setLoading(false)
    } else {
      router.push('/admin')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#2d1c14] flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '20px 20px' }} />
        <div className="relative text-center">
          <p className="text-[10px] tracking-[0.4em] text-[#8a6a5a] uppercase mb-5">Staff Portal</p>
          <h1 className="font-serif text-4xl font-bold text-[#f0e0d0] mb-4 tracking-wide">Cabalum Hotel</h1>
          <div className="w-16 h-px bg-[#b85c38] mx-auto mb-5" />
          <p className="text-[#7a5040] text-sm leading-relaxed max-w-[220px] mx-auto">
            Hotel management system for authorised staff only.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-cream px-8 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-10">
            <h1 className="font-serif text-3xl font-bold text-brown tracking-wide">Cabalum Hotel</h1>
            <div className="w-10 h-px bg-terra mx-auto mt-3" />
          </div>

          <h2 className="text-2xl font-serif font-semibold text-brown mb-1">Staff Sign In</h2>
          <p className="text-sm text-brown-light mb-8">Authorised personnel only</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-brown-mid uppercase tracking-wide mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="e.g. juan.reyes"
                className="w-full border border-warm-border rounded-lg px-4 py-2.5 text-sm bg-white text-brown placeholder-brown-light focus:outline-none focus:ring-2 focus:ring-terra focus:border-terra transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brown-mid uppercase tracking-wide mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full border border-warm-border rounded-lg px-4 py-2.5 text-sm bg-white text-brown placeholder-brown-light focus:outline-none focus:ring-2 focus:ring-terra focus:border-terra transition-colors"
              />
            </div>

            {error && (
              <div className="bg-[#fdf2f2] border border-[#e8b4b4] text-[#7a2020] rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-terra text-white py-2.5 rounded-lg font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors tracking-wide text-sm"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs mt-8 text-brown-light">
            Access is managed by your administrator.
          </p>
        </div>
      </div>
    </div>
  )
}
