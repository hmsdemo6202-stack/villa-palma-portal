'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [profile, setProfile] = useState<{
    username: string
    fullName: string
    role: string
  } | null>(null)
  const [allowedSections, setAllowedSections] = useState<Set<string> | undefined>(undefined)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }

      const { data: staff } = await supabase
        .from('users')
        .select('username, full_name, role, is_active')
        .eq('id', user.id)
        .maybeSingle()

      if (!staff || !staff.is_active) { router.replace('/login'); return }

      setProfile({
        username: staff.username,
        fullName: staff.full_name ?? staff.username,
        role:     staff.role,
      })

      // Fetch permissions for non-admin roles
      if (staff.role !== 'admin') {
        const { data: perms } = await supabase
          .from('role_permissions')
          .select('section_id, allowed')
          .eq('role', staff.role)

        const allowed = new Set<string>()
        if (perms) {
          for (const p of perms) {
            if (p.allowed) allowed.add(p.section_id)
          }
        }
        setAllowedSections(allowed)
      }
    })
  }, [router])

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar username={profile.username} fullName={profile.fullName} role={profile.role} allowedSections={allowedSections} />
      <main className="flex-1 min-w-0 p-5 sm:p-6 lg:p-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
