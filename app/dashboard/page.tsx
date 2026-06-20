import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'

const studentLinks = [
  { href: '/rooms', label: 'Browse Rooms', icon: '🏨', desc: 'Check availability & book' },
  { href: '/restaurant/menu', label: 'Restaurant Menu', icon: '🍽️', desc: 'Browse our dining options' },
  { href: '/restaurant/tables', label: 'Reserve a Table', icon: '🪑', desc: 'Secure your dining time' },
  { href: '/my-activity', label: 'My Activity', icon: '📋', desc: 'View your reservations' },
]

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: '📊', desc: 'KPIs & analytics' },
  { href: '/admin/reservations', label: 'Reservations', icon: '📅', desc: 'Manage all bookings' },
  { href: '/admin/orders', label: 'Orders', icon: '🍳', desc: 'Kitchen & dining orders' },
  { href: '/admin/inventory', label: 'Inventory', icon: '📦', desc: 'Stock & supplies' },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'student') as 'student' | 'instructor'
  const fullName = profile?.full_name ?? user.email ?? ''
  const firstName = fullName.split(' ')[0]

  return (
    <>
      <NavBar role={role} fullName={fullName} />
      <main className="min-h-screen bg-cream">
        <div className="max-w-4xl mx-auto px-6 py-12">

          {/* Welcome header */}
          <div className="mb-10">
            <p className="text-xs tracking-[0.25em] text-brown-light uppercase mb-2">Guest Portal</p>
            <h1 className="font-serif text-3xl font-bold text-brown">
              Welcome back, {firstName}
            </h1>
            <div className="w-12 h-px bg-terra mt-3 mb-4" />
            <p className="text-brown-mid text-sm">
              {role === 'instructor'
                ? 'Manage the hotel from the admin panel, or browse as a guest.'
                : 'Browse rooms, dine with us, or track your reservations.'}
            </p>
          </div>

          {/* Guest Services */}
          <div className="mb-10">
            <h2 className="text-[10px] font-bold text-brown-light uppercase tracking-[0.25em] mb-4">
              Guest Services
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {studentLinks.map(({ href, label, icon, desc }) => (
                <a key={href} href={href}
                  className="bg-white border border-warm-border rounded-xl p-5 hover:border-terra hover:shadow-md transition-all group text-left">
                  <span className="text-2xl mb-3 block">{icon}</span>
                  <p className="font-semibold text-brown text-sm group-hover:text-terra transition-colors leading-tight">
                    {label}
                  </p>
                  <p className="text-xs text-brown-light mt-1">{desc}</p>
                </a>
              ))}
            </div>
          </div>

          {/* Admin section — instructors only */}
          {role === 'instructor' && (
            <div>
              <h2 className="text-[10px] font-bold text-brown-light uppercase tracking-[0.25em] mb-4">
                Management
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {adminLinks.map(({ href, label, icon, desc }) => (
                  <a key={href} href={href}
                    className="bg-[#2d1c14] rounded-xl p-5 hover:bg-[#3d2818] transition-colors group text-left">
                    <span className="text-2xl mb-3 block">{icon}</span>
                    <p className="font-semibold text-[#d4b8a8] text-sm group-hover:text-[#f0e0d0] transition-colors leading-tight">
                      {label}
                    </p>
                    <p className="text-xs text-[#5a3a2a] group-hover:text-[#7a5a4a] mt-1 transition-colors">{desc}</p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
