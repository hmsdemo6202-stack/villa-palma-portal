import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'

export default async function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role').eq('id', user.id).single()

  return (
    <>
      <NavBar role={(profile?.role ?? 'student') as 'student' | 'instructor'} fullName={profile?.full_name ?? user.email ?? ''} />
      {children}
    </>
  )
}
