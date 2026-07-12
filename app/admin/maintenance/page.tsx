'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Priority = 'low' | 'normal' | 'high' | 'urgent'
type TicketStatus = 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed'

type Ticket = {
  id: string
  ticket_no: string
  room_id: string | null
  equipment: string | null
  description: string
  priority: Priority
  status: TicketStatus
  reported_by: string | null
  assigned_to: string | null
  due_date: string | null
  resolved_at: string | null
  resolution: string | null
  created_at: string
  rooms: { room_number: string } | null
}

type Room  = { id: string; room_number: string }
type Staff = { id: string; username: string; full_name: string | null }

type TicketForm = {
  room_id: string
  equipment: string
  description: string
  priority: Priority
  status: TicketStatus
  assigned_to: string
  due_date: string
  resolution: string
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low',    label: 'Low',    color: 'bg-gray-100 text-gray-600'   },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700'   },
  { value: 'high',   label: 'High',   color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700'     },
]

const STATUSES: { value: TicketStatus; label: string; color: string }[] = [
  { value: 'open',        label: 'Open',        color: 'bg-yellow-100 text-yellow-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700'    },
  { value: 'on_hold',     label: 'On Hold',     color: 'bg-gray-100 text-gray-600'    },
  { value: 'resolved',    label: 'Resolved',    color: 'bg-green-100 text-green-700'  },
  { value: 'closed',      label: 'Closed',      color: 'bg-gray-50 text-gray-400'     },
]

const pColor = (p: Priority) => PRIORITIES.find(x => x.value === p)?.color ?? ''
const sColor = (s: TicketStatus) => STATUSES.find(x => x.value === s)?.color ?? ''
const sLabel = (s: TicketStatus) => STATUSES.find(x => x.value === s)?.label ?? s

function emptyForm(): TicketForm {
  return { room_id: '', equipment: '', description: '', priority: 'normal', status: 'open', assigned_to: '', due_date: '', resolution: '' }
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MaintenancePage() {
  const supabase = createClient()
  const [tickets, setTickets]   = useState<Ticket[]>([])
  const [rooms, setRooms]       = useState<Room[]>([])
  const [staff, setStaff]       = useState<Staff[]>([])
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState<TicketForm>(emptyForm())
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)
  const [viewId, setViewId]     = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: ts }, { data: rs }, { data: sf }] = await Promise.all([
      supabase
        .from('maintenance_tickets')
        .select('*, rooms(room_number)')
        .order('created_at', { ascending: false }),
      supabase.from('rooms').select('id, room_number').order('room_number'),
      supabase.from('users').select('id, username, full_name').eq('is_active', true).order('full_name'),
    ])
    setTickets((ts as unknown as Ticket[]) ?? [])
    setRooms(rs ?? [])
    setStaff((sf as unknown as Staff[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  function openAdd() {
    setForm(emptyForm()); setEditId(null); setShowForm(true); setViewId(null)
  }

  function openEdit(t: Ticket) {
    setForm({
      room_id: t.room_id ?? '', equipment: t.equipment ?? '',
      description: t.description, priority: t.priority, status: t.status,
      assigned_to: t.assigned_to ?? '', due_date: t.due_date ?? '', resolution: t.resolution ?? '',
    })
    setEditId(t.id); setShowForm(true); setViewId(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      room_id:     form.room_id     || null,
      equipment:   form.equipment   || null,
      description: form.description,
      priority:    form.priority,
      status:      form.status,
      assigned_to: form.assigned_to || null,
      due_date:    form.due_date    || null,
      resolution:  form.resolution  || null,
      resolved_at: form.status === 'resolved' && !editId ? new Date().toISOString() : undefined,
      reported_by: editId ? undefined : (user?.id ?? null),
    }
    const { error: err } = editId
      ? await supabase.from('maintenance_tickets').update(payload).eq('id', editId)
      : await supabase.from('maintenance_tickets').insert(payload)
    if (err) { flash(err.message, false); setSaving(false); return }
    flash(editId ? 'Ticket updated.' : 'Ticket created.')
    setSaving(false); setShowForm(false); setEditId(null); setForm(emptyForm())
    load()
  }

  async function handleDelete(id: string, no: string) {
    if (!confirm(`Delete ticket ${no}?`)) return
    const { error: err } = await supabase.from('maintenance_tickets').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Ticket deleted.')
    if (viewId === id) setViewId(null)
    load()
  }

  async function quickStatus(id: string, status: TicketStatus) {
    const patch: Record<string, unknown> = { status }
    if (status === 'resolved') patch.resolved_at = new Date().toISOString()
    await supabase.from('maintenance_tickets').update(patch).eq('id', id)
    load()
  }

  const staffById = Object.fromEntries(staff.map(s => [s.id, s]))
  function staffName(id: string | null) {
    if (!id) return null
    const s = staffById[id]
    return s ? (s.full_name ?? s.username) : null
  }

  const counts = {
    all:        tickets.length,
    open:       tickets.filter(t => t.status === 'open').length,
    in_progress:tickets.filter(t => t.status === 'in_progress').length,
    on_hold:    tickets.filter(t => t.status === 'on_hold').length,
    resolved:   tickets.filter(t => t.status === 'resolved').length,
    closed:     tickets.filter(t => t.status === 'closed').length,
  }

  const visible = statusFilter === 'all' ? tickets : tickets.filter(t => t.status === statusFilter)
  const viewTicket = viewId ? tickets.find(t => t.id === viewId) ?? null : null

  if (loading) return <div className="text-gray-400">Loading tickets…</div>

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Maintenance</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tickets.length} total · {counts.open} open · {counts.in_progress} in progress</p>
        </div>
        <button onClick={openAdd}
          className="bg-terra text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark transition-colors">
          + New Ticket
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-warm-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-brown">{editId ? 'Edit Ticket' : 'New Maintenance Ticket'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Room <span className="text-gray-400">(optional)</span></label>
              <select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="">— No specific room —</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.room_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Equipment / Area <span className="text-gray-400">(optional)</span></label>
              <input value={form.equipment} onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="AC unit, shower, corridor lights…" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
              <textarea required rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="Describe the issue in detail…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TicketStatus }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assign To</label>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="">— Unassigned —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.username}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date <span className="text-gray-400">(optional)</span></label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>
            {(form.status === 'resolved' || form.status === 'closed') && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Resolution Notes</label>
                <textarea rows={2} value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                  placeholder="What was done to resolve the issue…" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-terra text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Ticket'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm()) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {/* Ticket detail panel */}
      {viewTicket && (
        <div className="bg-white border border-warm-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-gray-400 font-mono">{viewTicket.ticket_no}</p>
              <h2 className="font-bold text-brown text-lg">{viewTicket.description}</h2>
            </div>
            <button onClick={() => setViewId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-4">
            {[
              ['Room',      viewTicket.rooms?.room_number],
              ['Equipment', viewTicket.equipment],
              ['Reported',  fmtDate(viewTicket.created_at)],
              ['Due Date',  fmtDate(viewTicket.due_date)],
              ['Reporter',  staffName(viewTicket.reported_by)],
              ['Assignee',  staffName(viewTicket.assigned_to)],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-brown font-medium">{val || <span className="text-gray-300 font-normal">—</span>}</p>
              </div>
            ))}
          </div>
          {viewTicket.resolution && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 mb-4">
              <span className="font-semibold">Resolution: </span>{viewTicket.resolution}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => openEdit(viewTicket)} className="text-sm border text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50">Edit</button>
            <button onClick={() => handleDelete(viewTicket.id, viewTicket.ticket_no)} className="text-sm border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50">Delete</button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-1 flex-wrap">
        {(['all', 'open', 'in_progress', 'on_hold', 'resolved', 'closed'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === s ? 'bg-terra text-white border-terra' : 'border-warm-border text-gray-600 hover:border-terra bg-white'}`}>
            {s === 'all' ? `All (${counts.all})` : `${sLabel(s as TicketStatus)} (${counts[s as keyof typeof counts]})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-warm-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>{['Ticket', 'Room / Equipment', 'Description', 'Priority', 'Status', 'Assignee', 'Due', 'Actions'].map(h =>
              <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {visible.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No tickets found.</td></tr>
            )}
            {visible.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <button onClick={() => setViewId(viewId === t.id ? null : t.id)}
                    className="font-mono text-xs text-terra hover:underline">{t.ticket_no}</button>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {t.rooms?.room_number ? `Room ${t.rooms.room_number}` : '—'}
                  {t.equipment && <span className="text-gray-400 block text-xs">{t.equipment}</span>}
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                  <span className="line-clamp-2">{t.description}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pColor(t.priority)}`}>
                    {PRIORITIES.find(p => p.value === t.priority)?.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select value={t.status} onChange={e => quickStatus(t.id, e.target.value as TicketStatus)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${sColor(t.status)}`}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {staffName(t.assigned_to) ?? <span className="text-gray-300">Unassigned</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {t.due_date ? (
                    <span className={t.due_date < new Date().toISOString().split('T')[0] && t.status !== 'resolved' && t.status !== 'closed' ? 'text-red-600 font-medium' : ''}>
                      {fmtDate(t.due_date)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(t)} className="text-xs border text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                    <button onClick={() => handleDelete(t.id, t.ticket_no)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
