import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GuestNav from '@/components/GuestNav'

export default async function GuestAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/guest/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'guest') redirect('/guest/login')

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-20 max-w-lg mx-auto">
      {children}
      <div className="print:hidden"><GuestNav /></div>
    </div>
  )
}
