'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// Must match the section IDs in Sidebar.tsx
const SECTIONS = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'frontdesk',    label: 'Front Desk' },
  { id: 'rooms',        label: 'Rooms' },
  { id: 'restaurant',   label: 'Restaurant' },
  { id: 'financials',   label: 'Financials' },
  { id: 'reports',      label: 'Reports' },
  { id: 'website',      label: 'Website' },
  { id: 'content',      label: 'Content' },
]

const ROLES = [
  { id: 'manager',      label: 'Manager',      desc: 'Oversees hotel operations' },
  { id: 'front_desk',   label: 'Front Desk',   desc: 'Check-in / check-out, guests' },
  { id: 'housekeeping', label: 'Housekeeping', desc: 'Room cleaning and status' },
  { id: 'restaurant',   label: 'Restaurant',   desc: 'Menu, orders, POS' },
  { id: 'accounting',   label: 'Accounting',   desc: 'Payments, expenses, reports' },
  { id: 'maintenance',  label: 'Maintenance',  desc: 'Tickets and room upkeep' },
]

type PermMatrix = Record<string, Record<string, boolean>>

function buildDefault(): PermMatrix {
  const m: PermMatrix = {}
  for (const r of ROLES) {
    m[r.id] = {}
    for (const s of SECTIONS) {
      m[r.id][s.id] = true
    }
  }
  return m
}

export default function PermissionsPage() {
  const supabase = createClient()
  const [matrix,  setMatrix]  = useState<PermMatrix>(buildDefault())
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null) // 'role:section'
  const [flash,   setFlash]   = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('role_permissions')
      .select('role, section_id, allowed')
    if (!data) { setLoading(false); return }

    const m = buildDefault()
    for (const row of data) {
      if (m[row.role] !== undefined && SECTIONS.find(s => s.id === row.section_id)) {
        m[row.role][row.section_id] = row.allowed
      }
    }
    setMatrix(m)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(roleId: string, sectionId: string) {
    const current = matrix[roleId]?.[sectionId] ?? true
    const next    = !current
    const key     = `${roleId}:${sectionId}`

    // Optimistic update
    setMatrix(prev => ({
      ...prev,
      [roleId]: { ...prev[roleId], [sectionId]: next },
    }))
    setSaving(key)

    const { error } = await supabase
      .from('role_permissions')
      .upsert({ role: roleId, section_id: sectionId, allowed: next, updated_at: new Date().toISOString() },
               { onConflict: 'role,section_id' })

    setSaving(null)
    if (error) {
      // Revert on failure
      setMatrix(prev => ({
        ...prev,
        [roleId]: { ...prev[roleId], [sectionId]: current },
      }))
      setFlash('Save failed: ' + error.message)
      setTimeout(() => setFlash(null), 4000)
    }
  }

  async function setAll(roleId: string, allowed: boolean) {
    // Optimistic
    setMatrix(prev => ({
      ...prev,
      [roleId]: Object.fromEntries(SECTIONS.map(s => [s.id, allowed])),
    }))

    const rows = SECTIONS.map(s => ({
      role: roleId, section_id: s.id, allowed, updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('role_permissions')
      .upsert(rows, { onConflict: 'role,section_id' })

    if (error) { load(); setFlash('Save failed: ' + error.message); setTimeout(() => setFlash(null), 4000) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading permissions…</div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-brown">Permissions</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Control which portal sections each staff role can access. Admins always have full access.
        </p>
      </div>

      {flash && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{flash}</div>
      )}

      <div className="bg-white border border-warm-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 680 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-warm-border">
                <th className="px-5 py-3.5 text-left font-semibold text-brown w-44 shrink-0">Role</th>
                {SECTIONS.map(s => (
                  <th key={s.id} className="px-3 py-3.5 text-center font-medium text-gray-500 whitespace-nowrap text-xs">
                    {s.label}
                  </th>
                ))}
                <th className="px-4 py-3.5 text-center font-medium text-gray-400 text-xs whitespace-nowrap">Bulk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ROLES.map(role => {
                const perms   = matrix[role.id] ?? {}
                const countOn = SECTIONS.filter(s => perms[s.id] !== false).length
                const allOn   = countOn === SECTIONS.length
                const allOff  = countOn === 0

                return (
                  <tr key={role.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Role name */}
                    <td className="px-5 py-4 shrink-0">
                      <div className="font-semibold text-brown text-sm">{role.label}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{role.desc}</div>
                      <div className="text-[10px] text-terra mt-1 font-medium">
                        {countOn} / {SECTIONS.length} sections
                      </div>
                    </td>

                    {/* Section toggles */}
                    {SECTIONS.map(section => {
                      const allowed = perms[section.id] !== false
                      const key     = `${role.id}:${section.id}`
                      const isBusy  = saving === key

                      return (
                        <td key={section.id} className="px-3 py-4 text-center">
                          <button
                            onClick={() => toggle(role.id, section.id)}
                            disabled={isBusy}
                            aria-label={`${allowed ? 'Disable' : 'Enable'} ${section.label} for ${role.label}`}
                            className={`
                              relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                              transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2
                              focus-visible:ring-terra focus-visible:ring-offset-1
                              ${allowed ? 'bg-terra' : 'bg-gray-200'}
                              ${isBusy  ? 'opacity-50 cursor-wait' : ''}
                            `}
                          >
                            <span
                              className={`
                                pointer-events-none inline-block h-4 w-4 transform rounded-full
                                bg-white shadow-sm ring-0 transition duration-200 ease-in-out
                                ${allowed ? 'translate-x-4' : 'translate-x-0'}
                              `}
                            />
                          </button>
                        </td>
                      )
                    })}

                    {/* Bulk actions */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        {!allOn && (
                          <button
                            onClick={() => setAll(role.id, true)}
                            className="text-[10px] text-emerald-600 hover:underline whitespace-nowrap font-medium"
                          >
                            All on
                          </button>
                        )}
                        {!allOff && (
                          <button
                            onClick={() => setAll(role.id, false)}
                            className="text-[10px] text-red-500 hover:underline whitespace-nowrap font-medium"
                          >
                            All off
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-5 py-4 border-t border-warm-border bg-gray-50 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded-full bg-terra" /> Allowed — staff can see and use this section
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded-full bg-gray-200" /> Hidden — section not visible in their sidebar
          </span>
          <span className="text-gray-400">Changes save immediately. Admins always see everything.</span>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-900 space-y-1">
        <p className="font-semibold">How it works</p>
        <p className="text-xs text-amber-700 leading-relaxed">
          Toggling a section off hides the entire group from that role's sidebar — they won't see the tab or any of its sub-pages.
          It does not change what data they can read or write in the database (those are controlled by RLS policies).
          Use this to keep the interface focused for each role.
        </p>
      </div>
    </div>
  )
}
