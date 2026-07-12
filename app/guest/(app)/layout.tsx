'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GuestNav from '@/components/GuestNav'

export default function GuestAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/guest/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'guest') { router.replace('/guest/login'); return }

      setReady(true)
    })
  }, [router])

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] text-gray-400 text-sm">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-20 max-w-lg mx-auto">
      {children}
      <div className="print:hidden"><GuestNav /></div>
    </div>
  )
}
