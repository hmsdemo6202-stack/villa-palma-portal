'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type NavLink = { href: string; label: string }
type Section = {
  id: string
  label: string
  icon: string
  href?: string       // direct-navigate on click (no sub-links)
  links?: NavLink[]
}

const SECTIONS: Section[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '▦',
    href: '/admin/dashboard',
  },
  {
    id: 'reservations',
    label: 'Reservations',
    icon: '📋',
    links: [
      { href: '/admin/reservations', label: 'All Reservations' },
      { href: '/admin/availability', label: 'Availability' },
      { href: '/admin/calendar',     label: 'Calendar' },
      { href: '/admin/pricing',      label: 'Rate Plans' },
    ],
  },
  {
    id: 'frontdesk',
    label: 'Front Desk',
    icon: '🏨',
    links: [
      { href: '/admin/checkin',  label: 'Check-In' },
      { href: '/admin/checkout', label: 'Check-Out' },
      { href: '/admin/guests',   label: 'Guests (CRM)' },
    ],
  },
  {
    id: 'rooms',
    label: 'Rooms',
    icon: '🛏',
    links: [
      { href: '/admin/rooms',        label: 'Room List' },
      { href: '/admin/housekeeping', label: 'Housekeeping' },
      { href: '/admin/maintenance',  label: 'Maintenance' },
    ],
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    icon: '🍽',
    links: [
      { href: '/admin/menu',         label: 'Menu' },
      { href: '/admin/orders',       label: 'Orders' },
      { href: '/admin/pos-terminal', label: 'POS Terminal' },
      { href: '/admin/pos',          label: 'POS Items' },
    ],
  },
  {
    id: 'financials',
    label: 'Financials',
    icon: '💰',
    links: [
      { href: '/admin/payments',  label: 'Payments' },
      { href: '/admin/expenses',  label: 'Expenses' },
      { href: '/admin/inventory', label: 'Inventory' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: '📊',
    href: '/admin/reports',
  },
  {
    id: 'website',
    label: 'Website',
    icon: '🌐',
    links: [
      { href: '/admin/website/settings', label: 'Site Settings' },
      { href: '/admin/website/gallery',  label: 'Gallery' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    icon: '🌐',
    links: [
      { href: '/admin/gallery',         label: 'Gallery' },
      { href: '/admin/promotions',      label: 'Promotions' },
      { href: '/admin/reviews',         label: 'Reviews' },
      { href: '/admin/faqs',            label: 'FAQs' },
      { href: '/admin/contacts',        label: 'Contacts' },
      { href: '/admin/support-tickets', label: 'Support Tickets' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: '⚙️',
    links: [
      { href: '/admin/users',       label: 'Users' },
      { href: '/admin/departments', label: 'Departments' },
      { href: '/admin/permissions', label: 'Permissions' },
      { href: '/admin/audit-log',   label: 'Activity Log' },
      { href: '/admin/settings',    label: 'Settings' },
    ],
  },
]

function findSection(pathname: string): string {
  for (const s of SECTIONS) {
    if (s.href && (pathname === s.href || pathname.startsWith(s.href + '/'))) return s.id
    if (s.links?.some(l => pathname === l.href || pathname.startsWith(l.href + '/'))) return s.id
  }
  return 'dashboard'
}

const ROLE_LABELS: Record<string, string> = {
  admin:        'Administrator',
  manager:      'Manager',
  front_desk:   'Front Desk',
  housekeeping: 'Housekeeping',
  restaurant:   'Restaurant',
  accounting:   'Accounting',
  maintenance:  'Maintenance',
}

interface SidebarProps {
  username: string
  fullName: string
  role: string
  allowedSections?: Set<string>
}

export default function Sidebar({ username, fullName, role, allowedSections }: SidebarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openSection, setOpenSection] = useState<string>(() => findSection(pathname))

  useEffect(() => {
    setOpenSection(findSection(pathname))
  }, [pathname])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleTab(s: Section) {
    if (s.href) {
      router.push(s.href)
      setMobileOpen(false)
    } else {
      setOpenSection(cur => cur === s.id ? '' : s.id)
    }
  }

  function isLinkActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Admin always sees everything; other roles filtered by allowedSections
  const visibleSections = SECTIONS.filter(s => {
    if (s.id === 'admin') return role === 'admin'
    if (role === 'admin') return true
    if (!allowedSections) return true   // permissions not loaded yet → show all
    return allowedSections.has(s.id)
  })

  const Nav = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#3d2418] shrink-0">
        <p className="text-[9px] tracking-[0.35em] text-[#8a6a5a] uppercase mb-0.5">Staff Portal</p>
        <h1 className="font-serif text-[17px] font-bold text-[#f0e0d0] tracking-wide leading-tight">
          Cabalum Hotel
        </h1>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleSections.map(section => {
          const isOpen   = openSection === section.id
          const isDirect = !!section.href

          // Determine if this section is "active" (a link inside it is current)
          const sectionActive = isDirect
            ? isLinkActive(section.href!)
            : section.links?.some(l => isLinkActive(l.href)) ?? false

          return (
            <div key={section.id}>
              {/* Section tab */}
              <button
                onClick={() => handleTab(section)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium
                  transition-all text-left border-l-[3px] ${
                  sectionActive || isOpen
                    ? 'border-[#b85c38] bg-[#3d2418] text-[#f0e0d0]'
                    : 'border-transparent text-[#9a7868] hover:bg-[#3d2418]/50 hover:text-[#d4b8a8]'
                }`}
              >
                <span className="text-[15px] w-5 text-center shrink-0 leading-none">{section.icon}</span>
                <span className="flex-1 leading-tight">{section.label}</span>
                {!isDirect && (
                  <svg
                    className={`w-3 h-3 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {/* Sub-links */}
              {!isDirect && isOpen && section.links && (
                <div className="border-l-[3px] border-[#b85c38] bg-[#231410]">
                  {section.links.map(link => {
                    const active = isLinkActive(link.href)
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2 pl-9 pr-4 py-2 text-[13px] transition-colors ${
                          active
                            ? 'text-[#e07850] font-semibold'
                            : 'text-[#8a6a5a] hover:text-[#d4a898]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-[#e07850]' : 'bg-[#4a3028]'}`} />
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-[#3d2418] shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#b85c38]/20 border border-[#b85c38]/30 flex items-center justify-center shrink-0">
            <span className="text-xs text-[#e07850] font-bold">
              {(fullName || username).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-[#f0e0d0] font-medium truncate">{fullName || username}</p>
            <p className="text-[10px] text-[#8a6a5a] truncate">
              @{username} · {ROLE_LABELS[role] ?? role}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full text-xs text-[#8a6a5a] hover:text-[#c8a898] border border-[#4a2e20] hover:border-[#7a5040] px-3 py-1.5 rounded-lg transition-colors text-left"
        >
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between bg-[#2d1c14] px-4 py-3 sticky top-0 z-40 border-b border-[#3d2418]">
        <span className="font-serif text-sm font-bold text-[#f0e0d0] tracking-wide">Cabalum Hotel</span>
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="text-[#c8a898] p-1.5 rounded hover:bg-[#3d2418] transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
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

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-[#2d1c14] h-full shadow-2xl z-40 overflow-y-auto">
            <Nav />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-56 xl:w-60 shrink-0 bg-[#2d1c14] min-h-screen sticky top-0 h-screen">
        <Nav />
      </aside>
    </>
  )
}
