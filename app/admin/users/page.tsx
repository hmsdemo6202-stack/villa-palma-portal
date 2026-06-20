'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  id: string
  full_name: string | null
  role: 'student' | 'instructor'
  created_at: string
}

export default function AdminUsersPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'instructor'>('all')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .order('created_at', { ascending: false })
    setProfiles((data as Profile[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function changeRole(id: string, newRole: 'student' | 'instructor') {
    const verb = newRole === 'instructor' ? 'Promote' : 'Demote'
    if (!confirm(`${verb} this user to ${newRole}?`)) return

    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id)

    if (error) {
      const displayMsg = error.message.includes('cannot demote')
        ? 'Cannot demote — this is the only instructor account.'
        : error.message
      setMsg({ id, text: displayMsg, ok: false })
    } else {
      setMsg({ id, text: `Role updated to ${newRole}.`, ok: true })
      load()
    }
  }

  const instructorCount = profiles.filter(p => p.role === 'instructor').length
  const visible = roleFilter === 'all' ? profiles : profiles.filter(p => p.role === roleFilter)

  if (loading) return <div className="text-gray-400">Loading users…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {profiles.length} total · {instructorCount} instructor{instructorCount !== 1 ? 's' : ''} · {profiles.length - instructorCount} students
          </p>
        </div>
        <div className="flex gap-1">
          {(['all', 'instructor', 'student'] as const).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                roleFilter === r ? 'bg-terra text-white border-terra' : 'hover:border-terra text-brown-mid border-warm-border'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border rounded-xl overflow-hidden">
          <thead className="bg-gray-50 text-left">
            <tr>
              {['Name', 'Role', 'Joined', 'Actions'].map(h => (
                <th key={h} className="px-4 py-2.5 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {visible.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No users.</td></tr>
            )}
            {visible.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  {p.full_name ?? <span className="text-gray-400 italic">No name</span>}
                  {p.id === currentUserId && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">You</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    p.role === 'instructor' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                    {p.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  {msg?.id === p.id && (
                    <p className={`text-xs mb-1 ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
                  )}
                  {p.id !== currentUserId && (
                    p.role === 'student' ? (
                      <button onClick={() => changeRole(p.id, 'instructor')}
                        className="text-xs border border-indigo-300 text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-50">
                        Promote to Instructor
                      </button>
                    ) : (
                      <button onClick={() => changeRole(p.id, 'student')}
                        className="text-xs border border-red-300 text-red-600 px-3 py-1 rounded-lg hover:bg-red-50"
                        disabled={instructorCount <= 1}
                        title={instructorCount <= 1 ? 'Cannot demote the only instructor' : ''}>
                        Demote to Student
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        The database prevents demoting the last instructor. Your own row cannot be changed from this page.
      </p>
    </div>
  )
}
