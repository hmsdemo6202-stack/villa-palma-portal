'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [profile, setProfile] = useState<{ fullName: string; role: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

      if (!prof || (prof.role !== 'admin' && prof.role !== 'staff')) { router.replace('/login'); return }

      setProfile({ fullName: prof.full_name ?? user.email ?? 'Admin', role: prof.role })
    })
  }, [router])

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">Loading…</div>
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar fullName={profile.fullName} role={profile.role} />
      <main className="flex-1 min-w-0 p-5 sm:p-6 lg:p-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
