'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function GuestRegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { data: authData, error: signUpErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, role: 'guest' } },
    })

    if (signUpErr) { setError(signUpErr.message); setLoading(false); return }
    if (!authData.user) { setError('Registration failed. Please try again.'); setLoading(false); return }

    const { error: guestErr } = await supabase.from('guests').insert({
      profile_id: authData.user.id,
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
    })

    if (guestErr) {
      setError(`Account created but guest profile setup failed: ${guestErr.message}`)
      setLoading(false)
      return
    }

    router.push('/guest/rooms')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col">
      <div className="bg-[#2d1c14] px-6 pt-14 pb-8 text-center">
        <h1 className="font-serif text-2xl font-bold text-[#f0e0d0] tracking-wide">Cabalum Hotel</h1>
        <div className="w-10 h-px bg-[#b85c38] mx-auto mt-3" />
      </div>

      <div className="flex-1 px-6 py-8 max-w-md mx-auto w-full">
        <h2 className="text-xl font-semibold text-[#3d2018] mb-1">Create Account</h2>
        <p className="text-sm text-[#8a6a5a] mb-7">Book rooms and access hotel services</p>

        <form onSubmit={handleRegister} className="space-y-4">
          {[
            { label: 'Full Name *', field: 'full_name', type: 'text', placeholder: 'Juan Dela Cruz', required: true },
            { label: 'Email *', field: 'email', type: 'email', placeholder: 'you@email.com', required: true },
            { label: 'Phone', field: 'phone', type: 'tel', placeholder: '+63 9XX XXX XXXX', required: false },
            { label: 'Password *', field: 'password', type: 'password', placeholder: 'Min 6 characters', required: true },
            { label: 'Confirm Password *', field: 'confirm', type: 'password', placeholder: 'Repeat your password', required: true },
          ].map(({ label, field, type, placeholder, required }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-[#7a5040] uppercase tracking-wide mb-1.5">{label}</label>
              <input
                type={type}
                required={required}
                value={form[field as keyof typeof form]}
                onChange={e => set(field, e.target.value)}
                placeholder={placeholder}
                minLength={field === 'password' || field === 'confirm' ? 6 : undefined}
                className="w-full border border-[#e8d5c8] rounded-xl px-4 py-3.5 text-sm bg-white text-[#3d2018] placeholder-[#c8a898] focus:outline-none focus:ring-2 focus:ring-[#b85c38]"
              />
            </div>
          ))}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-[#b85c38] text-white py-4 rounded-xl font-medium hover:bg-[#9a4a2a] disabled:opacity-50 transition-colors mt-2">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#8a6a5a] mt-6">
          Already have an account?{' '}
          <Link href="/guest/login" className="text-[#b85c38] font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
