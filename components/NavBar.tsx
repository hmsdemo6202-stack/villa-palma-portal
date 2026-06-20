'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavBarProps {
  role: 'student' | 'instructor'
  fullName: string
}

export default function NavBar({ role, fullName }: NavBarProps) {
  const router = useRouter()
  const pathname = usePathname()

  function linkClass(prefix: string) {
    return `text-sm transition-colors ${
      pathname.startsWith(prefix)
        ? 'text-[#f0e0d0] font-semibold'
        : 'text-[#8a6a5a] hover:text-[#c8a898]'
    }`
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="bg-[#2d1c14] px-6 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-5 flex-wrap py-3.5">
        {/* Logo */}
        <div className="flex items-center gap-4 shrink-0">
          <span className="font-serif text-sm tracking-[0.2em] text-[#f0e0d0] uppercase font-bold">
            Villa Palma
          </span>
          <div className="w-px h-4 bg-[#5a3a2a]" />
        </div>

        <Link href="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
        <Link href="/rooms" className={linkClass('/rooms')}>Rooms</Link>
        <Link href="/restaurant/menu" className={linkClass('/restaurant/menu')}>Menu</Link>
        <Link href="/restaurant/tables" className={linkClass('/restaurant/tables')}>Tables</Link>
        <Link href="/my-activity" className={linkClass('/my-activity')}>My Activity</Link>

        {role === 'instructor' && (
          <>
            <div className="w-px h-4 bg-[#5a3a2a] mx-1" />
            <span className="text-[10px] tracking-[0.2em] text-[#5a3a2a] uppercase font-bold select-none">
              Admin
            </span>
            <Link href="/admin/rooms" className={linkClass('/admin/rooms')}>Rooms</Link>
            <Link href="/admin/tables" className={linkClass('/admin/tables')}>Tables</Link>
            <Link href="/admin/menu" className={linkClass('/admin/menu')}>Menu</Link>
            <Link href="/admin/inventory" className={linkClass('/admin/inventory')}>Inventory</Link>
            <Link href="/admin/reservations" className={linkClass('/admin/reservations')}>Reservations</Link>
            <Link href="/admin/orders" className={linkClass('/admin/orders')}>Orders</Link>
            <Link href="/admin/users" className={linkClass('/admin/users')}>Users</Link>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0 py-3.5">
        <span className="text-sm text-[#8a6a5a]">
          {fullName}
          <span className="ml-2 text-[10px] bg-[#3d2418] text-[#c4906a] px-2 py-0.5 rounded-full capitalize tracking-wide">
            {role}
          </span>
        </span>
        <button
          onClick={signOut}
          className="text-xs text-[#8a6a5a] hover:text-[#c8a898] border border-[#4a2e20] hover:border-[#7a5040] px-3 py-1.5 rounded-full transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
