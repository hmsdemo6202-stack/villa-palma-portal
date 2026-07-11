'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function GuestAccountPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setEmail(user.email ?? '')
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle()
    if (data) {
      setFullName(data.full_name ?? '')
      setPhone(data.phone ?? '')
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!fullName.trim()) { setError('Full name is required.'); return }
    setSaving(true); setError(''); setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq('id', user.id)
    setSaving(false)
    if (err) { setError(err.message) } else { setSaved(true); load() }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/guest/login')
    router.refresh()
  }

  const initial = (fullName || email)[0]?.toUpperCase() ?? '?'

  return (
    <div>
      <div className="bg-[#2d1c14] px-6 pt-14 pb-6">
        <h1 className="font-serif text-2xl font-bold text-[#f0e0d0]">Account</h1>
      </div>

      <div className="p-5 space-y-4">
        {/* Avatar + name */}
        <div className="bg-white border border-[#e8d5c8] rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#b85c38] to-[#3d2018] flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {loading ? '…' : initial}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[#3d2018] text-lg truncate">{loading ? '…' : (fullName || 'Guest')}</p>
              <p className="text-sm text-[#8a6a5a] truncate">{email}</p>
              <span className="text-xs bg-[#fdf6f0] text-[#b85c38] border border-[#f0c8aa] px-2.5 py-0.5 rounded-full font-medium mt-1.5 inline-block">
                Guest
              </span>
            </div>
          </div>
        </div>

        {/* Edit profile */}
        <div className="bg-white border border-[#e8d5c8] rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-[#3d2018]">Profile Information</h2>

          <div>
            <label className="block text-xs font-medium text-[#7a5040] uppercase tracking-wide mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full border border-[#e8d5c8] rounded-xl px-4 py-3 text-sm text-[#3d2018] focus:outline-none focus:ring-2 focus:ring-[#b85c38]/30 focus:border-[#b85c38]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#7a5040] uppercase tracking-wide mb-1.5">Email Address</label>
            <div className="w-full border border-[#e8d5c8] rounded-xl px-4 py-3 text-sm text-[#9d8a80] bg-[#faf6f0]">
              {email}
            </div>
            <p className="text-xs text-[#b0a098] mt-1">Contact reception to change your email.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#7a5040] uppercase tracking-wide mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+63 9XX XXX XXXX"
              className="w-full border border-[#e8d5c8] rounded-xl px-4 py-3 text-sm text-[#3d2018] focus:outline-none focus:ring-2 focus:ring-[#b85c38]/30 focus:border-[#b85c38]"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-700">Profile updated successfully.</p>}

          <button
            onClick={save}
            disabled={saving || loading}
            className="w-full bg-[#b85c38] text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-[#a0502f] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Hotel info */}
        <div className="bg-white border border-[#e8d5c8] rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-[#3d2018]">Hotel Information</h2>
          <div className="space-y-3 text-sm text-[#7a5040]">
            <div className="flex items-start gap-3">
              <span className="text-base shrink-0">🕐</span>
              <div>
                <p className="font-medium text-[#3d2018]">Check-in / Check-out</p>
                <p>Check-in: 2:00 PM · Check-out: 12:00 PM noon</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-base shrink-0">📞</span>
              <div>
                <p className="font-medium text-[#3d2018]">Front Desk</p>
                <p>(033) 320-1234 · Open 24/7</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-base shrink-0">🍽</span>
              <div>
                <p className="font-medium text-[#3d2018]">Restaurant Hours</p>
                <p>Breakfast 6–10 AM · Lunch 11:30 AM–2 PM · Dinner 6–10 PM</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-base shrink-0">🚨</span>
              <div>
                <p className="font-medium text-[#3d2018]">Emergency</p>
                <p>Security dial 9 · Medical dial 8</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full border border-red-200 text-red-600 py-4 rounded-2xl font-medium hover:bg-red-50 transition-colors text-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
