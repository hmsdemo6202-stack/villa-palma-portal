'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/admin/dashboard',   label: 'Dashboard',    icon: '▦' },
  { href: '/admin/rooms',       label: 'Rooms',         icon: '⊞' },
  { href: '/admin/guests',      label: 'Guests',        icon: '👤' },
  { href: '/admin/reservations',label: 'Reservations',  icon: '📅' },
  { href: '/admin/pos',         label: 'POS Items',     icon: '🏷' },
  { href: '/admin/inventory',   label: 'Inventory',     icon: '📦' },
  { href: '/admin/expenses',    label: 'Expenses',      icon: '💳' },
  { href: '/admin/departments', label: 'Departments',   icon: '🏢' },
  { href: '/admin/users',       label: 'Users',         icon: '👥' },
]

interface SidebarProps {
  fullName: string
  role: string
}

export default function Sidebar({ fullName, role }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[#3d2418]">
        <p className="text-[9px] tracking-[0.35em] text-[#8a6a5a] uppercase mb-1">Admin Portal</p>
        <h1 className="font-serif text-lg font-bold text-[#f0e0d0] tracking-wide leading-tight">
          Cabalum Hotel
        </h1>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive(href)
                ? 'bg-terra text-white font-semibold'
                : 'text-[#c8a898] hover:bg-[#3d2418] hover:text-[#f0e0d0]'
            }`}
          >
            <span className="text-base w-5 text-center shrink-0">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* User info + sign out */}
      <div className="px-4 py-4 border-t border-[#3d2418]">
        <p className="text-xs text-[#f0e0d0] font-medium truncate">{fullName}</p>
        <p className="text-[10px] text-[#8a6a5a] capitalize mt-0.5">{role}</p>
        <button
          onClick={signOut}
          className="mt-3 w-full text-xs text-[#8a6a5a] hover:text-[#c8a898] border border-[#4a2e20] hover:border-[#7a5040] px-3 py-1.5 rounded-lg transition-colors text-left"
        >
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden flex items-center justify-between bg-[#2d1c14] px-4 py-3 sticky top-0 z-40">
        <span className="font-serif text-sm font-bold text-[#f0e0d0] tracking-wide">Cabalum Hotel</span>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-[#c8a898] p-1.5 rounded hover:bg-[#3d2418] transition-colors"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-64 bg-[#2d1c14] h-full shadow-2xl z-40">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex lg:flex-col w-56 xl:w-60 shrink-0 bg-[#2d1c14] min-h-screen sticky top-0 h-screen">
        <SidebarContent />
      </aside>
    </>
  )
}
