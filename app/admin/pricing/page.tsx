'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type PlanType = 'standard' | 'weekend' | 'holiday' | 'seasonal' | 'corporate' | 'group' | 'promo'

type RatePlan = {
  id: string
  name: string
  plan_type: PlanType
  room_type_id: string | null
  rate_per_night: number
  start_date: string | null
  end_date: string | null
  days_of_week: number[] | null
  promo_code: string | null
  discount_pct: number | null
  min_nights: number
  is_active: boolean
  created_at: string
  room_types: { name: string } | null
}

type RoomType = { id: string; name: string; base_price: number }

type PlanForm = {
  name: string
  plan_type: PlanType
  room_type_id: string
  rate_per_night: string
  start_date: string
  end_date: string
  days_of_week: number[]
  promo_code: string
  discount_pct: string
  min_nights: string
  is_active: boolean
}

const PLAN_TYPES: { value: PlanType; label: string; color: string }[] = [
  { value: 'standard',  label: 'Standard',  color: 'bg-gray-100 text-gray-700'   },
  { value: 'weekend',   label: 'Weekend',   color: 'bg-blue-100 text-blue-700'   },
  { value: 'holiday',   label: 'Holiday',   color: 'bg-red-100 text-red-700'     },
  { value: 'seasonal',  label: 'Seasonal',  color: 'bg-orange-100 text-orange-700'},
  { value: 'corporate', label: 'Corporate', color: 'bg-purple-100 text-purple-700'},
  { value: 'group',     label: 'Group',     color: 'bg-teal-100 text-teal-700'   },
  { value: 'promo',     label: 'Promo',     color: 'bg-green-100 text-green-700' },
]

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ptColor(t: PlanType) { return PLAN_TYPES.find(x => x.value === t)?.color ?? '' }

function currency(n: number) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function emptyForm(): PlanForm {
  return {
    name: '', plan_type: 'standard', room_type_id: '', rate_per_night: '',
    start_date: '', end_date: '', days_of_week: [], promo_code: '',
    discount_pct: '', min_nights: '1', is_active: true,
  }
}

export default function PricingPage() {
  const supabase = createClient()
  const [plans, setPlans]         = useState<RatePlan[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading]     = useState(true)
  const [typeFilter, setTypeFilter] = useState<PlanType | 'all'>('all')
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [form, setForm]           = useState<PlanForm>(emptyForm())
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: ps }, { data: rts }] = await Promise.all([
      supabase.from('rate_plans').select('*, room_types(name)').order('plan_type').order('name'),
      supabase.from('room_types').select('id, name, base_price').order('name'),
    ])
    setPlans((ps as unknown as RatePlan[]) ?? [])
    setRoomTypes((rts as unknown as RoomType[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function flash(msg: string, ok = true) {
    if (ok) { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  function openAdd() {
    setForm(emptyForm()); setEditId(null); setShowForm(true)
  }

  function openEdit(p: RatePlan) {
    setForm({
      name: p.name, plan_type: p.plan_type, room_type_id: p.room_type_id ?? '',
      rate_per_night: String(p.rate_per_night), start_date: p.start_date ?? '',
      end_date: p.end_date ?? '', days_of_week: p.days_of_week ?? [],
      promo_code: p.promo_code ?? '', discount_pct: p.discount_pct != null ? String(p.discount_pct) : '',
      min_nights: String(p.min_nights), is_active: p.is_active,
    })
    setEditId(p.id); setShowForm(true)
  }

  function toggleDow(day: number) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter(d => d !== day)
        : [...f.days_of_week, day].sort(),
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name:           form.name,
      plan_type:      form.plan_type,
      room_type_id:   form.room_type_id   || null,
      rate_per_night: Number(form.rate_per_night),
      start_date:     form.start_date     || null,
      end_date:       form.end_date       || null,
      days_of_week:   form.days_of_week.length > 0 ? form.days_of_week : null,
      promo_code:     form.promo_code.trim() || null,
      discount_pct:   form.discount_pct   ? Number(form.discount_pct)   : null,
      min_nights:     Number(form.min_nights) || 1,
      is_active:      form.is_active,
    }
    const { error: err } = editId
      ? await supabase.from('rate_plans').update(payload).eq('id', editId)
      : await supabase.from('rate_plans').insert(payload)
    if (err) { flash(err.message, false); setSaving(false); return }
    flash(editId ? 'Rate plan updated.' : 'Rate plan created.')
    setSaving(false); setShowForm(false); setEditId(null); setForm(emptyForm())
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete rate plan "${name}"?`)) return
    const { error: err } = await supabase.from('rate_plans').delete().eq('id', id)
    if (err) { flash(err.message, false); return }
    flash('Rate plan deleted.')
    load()
  }

  async function toggleActive(p: RatePlan) {
    await supabase.from('rate_plans').update({ is_active: !p.is_active }).eq('id', p.id)
    load()
  }

  const visible = typeFilter === 'all' ? plans : plans.filter(p => p.plan_type === typeFilter)

  if (loading) return <div className="text-gray-400">Loading rate plans…</div>

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown">Rate Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">{plans.length} plans · {plans.filter(p => p.is_active).length} active</p>
        </div>
        <button onClick={openAdd}
          className="bg-terra text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark transition-colors">
          + New Rate Plan
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-warm-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-brown">{editId ? 'Edit Rate Plan' : 'New Rate Plan'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plan Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="e.g. Weekend Rate, Summer 2026" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plan Type</label>
              <select value={form.plan_type} onChange={e => setForm(f => ({ ...f, plan_type: e.target.value as PlanType }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                {PLAN_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Room Type <span className="text-gray-400">(all if blank)</span></label>
              <select value={form.room_type_id} onChange={e => setForm(f => ({ ...f, room_type_id: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                <option value="">— All room types —</option>
                {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name} (Base: {currency(rt.base_price)})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rate per Night (₱) *</label>
              <input required type="number" min={0} step="0.01" value={form.rate_per_night}
                onChange={e => setForm(f => ({ ...f, rate_per_night: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date <span className="text-gray-400">(optional)</span></label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date <span className="text-gray-400">(optional)</span></label>
              <input type="date" value={form.end_date} min={form.start_date || undefined}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Promo Code <span className="text-gray-400">(optional)</span></label>
              <input value={form.promo_code} onChange={e => setForm(f => ({ ...f, promo_code: e.target.value.toUpperCase() }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="SUMMER25" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount % <span className="text-gray-400">(optional override)</span></label>
              <input type="number" min={0} max={100} step="0.01" value={form.discount_pct}
                onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Minimum Nights</label>
              <input type="number" min={1} value={form.min_nights} onChange={e => setForm(f => ({ ...f, min_nights: e.target.value }))}
                className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 accent-terra" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-2">Applies on Days <span className="text-gray-400">(leave empty = all days)</span></label>
              <div className="flex gap-2 flex-wrap">
                {DOW.map((d, i) => (
                  <button key={i} type="button" onClick={() => toggleDow(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.days_of_week.includes(i) ? 'bg-terra text-white border-terra' : 'border-warm-border text-gray-600 hover:border-terra'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-terra text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Plan'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm()) }}
              className="border border-warm-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setTypeFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${typeFilter === 'all' ? 'bg-terra text-white border-terra' : 'border-warm-border text-gray-600 bg-white hover:border-terra'}`}>
          All ({plans.length})
        </button>
        {PLAN_TYPES.map(pt => {
          const count = plans.filter(p => p.plan_type === pt.value).length
          if (!count) return null
          return (
            <button key={pt.value} onClick={() => setTypeFilter(pt.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${typeFilter === pt.value ? 'bg-terra text-white border-terra' : 'border-warm-border text-gray-600 bg-white hover:border-terra'}`}>
              {pt.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">💲</p>
          <p className="font-medium">No rate plans yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-warm-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>{['Plan', 'Type', 'Room Type', 'Rate/Night', 'Period', 'Promo Code', 'Discount', 'Active', 'Actions'].map(h =>
                <th key={h} className="px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {visible.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-brown">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ptColor(p.plan_type)}`}>
                      {PLAN_TYPES.find(x => x.value === p.plan_type)?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.room_types?.name ?? <span className="text-gray-300">All types</span>}</td>
                  <td className="px-4 py-3 font-semibold text-brown">{currency(p.rate_per_night)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {p.start_date && p.end_date ? `${p.start_date} → ${p.end_date}` : p.start_date ? `From ${p.start_date}` : p.end_date ? `Until ${p.end_date}` : <span className="text-gray-300">Always</span>}
                    {p.days_of_week && p.days_of_week.length > 0 && (
                      <span className="block text-gray-400">{p.days_of_week.map(d => DOW[d]).join(', ')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.promo_code ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{p.discount_pct != null ? `${p.discount_pct}%` : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(p)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${p.is_active ? 'bg-terra' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${p.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => openEdit(p)} className="text-xs border text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                      <button onClick={() => handleDelete(p.id, p.name)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
