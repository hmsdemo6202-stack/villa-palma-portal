import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) redirect('/login')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        fullName={profile.full_name ?? user.email ?? 'Admin'}
        role={profile.role}
      />
      <main className="flex-1 min-w-0 p-5 sm:p-6 lg:p-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
