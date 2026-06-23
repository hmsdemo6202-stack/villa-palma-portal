'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function GuestAccountPage() {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? '')
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => { setFullName(data?.full_name ?? ''); setLoading(false) })
    })
  }, [supabase])

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
        {/* Profile card */}
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
                <p>Dial 0 from your room phone for assistance</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-base shrink-0">🍽</span>
              <div>
                <p className="font-medium text-[#3d2018]">Room Service</p>
                <p>Available daily · Order from the Order tab</p>
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
