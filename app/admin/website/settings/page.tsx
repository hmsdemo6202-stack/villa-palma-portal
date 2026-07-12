'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Setting = { key: string; value: string; label: string; description: string }

const HERO_KEYS    = ['hero_image_url', 'cta_image_url']
const CONTACT_KEYS = ['contact_phone', 'contact_email', 'contact_address']
const SOCIAL_KEYS  = ['facebook_url', 'instagram_url']
const ALL_KEYS     = [...HERO_KEYS, ...CONTACT_KEYS, ...SOCIAL_KEYS]

const BUCKET = 'gallery-images'

export default function WebsiteSettingsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<Record<string, Setting>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const heroRef = useRef<HTMLInputElement>(null)
  const ctaRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('site_settings')
      .select('key, value, label, description')
      .in('key', ALL_KEYS)
      .then(({ data }) => {
        const map: Record<string, Setting> = {}
        for (const row of (data ?? []) as Setting[]) map[row.key] = row
        setSettings(map)
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  function val(key: string) { return settings[key]?.value ?? '' }

  function set(key: string, value: string) {
    setSettings(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { key, label: key, description: '' }), value },
    }))
  }

  async function saveKeys(keys: string[], section: string) {
    setSaving(section)
    const updates = keys.map(k => ({ key: k, value: val(k) }))
    const { error } = await supabase.from('site_settings').upsert(updates, { onConflict: 'key' })
    setSaving(null)
    if (error) flash(error.message, false)
    else flash(`${section} saved.`)
  }

  async function uploadHero(file: File, key: string) {
    setUploading(key)
    const ext  = file.name.split('.').pop() || 'jpg'
    const path = `hero/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (upErr) { flash(upErr.message, false); setUploading(null); return }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    set(key, pub.publicUrl)
    setUploading(null)
  }

  if (loading) return <div className="text-gray-400 text-sm py-10">Loading settings…</div>

  const Section = ({ title, sub, children, keys, id }: {
    title: string; sub: string; children: React.ReactNode; keys: string[]; id: string
  }) => (
    <div className="bg-white border border-warm-border rounded-xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-brown">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
        </div>
        <button
          onClick={() => saveKeys(keys, title)}
          disabled={saving === title}
          className="text-sm bg-terra text-white px-4 py-1.5 rounded-lg hover:bg-terra-dark transition-colors disabled:opacity-50 shrink-0"
        >
          {saving === title ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  )

  const Field = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-brown mb-1">{label}</label>
      {desc && <p className="text-[10px] text-gray-400 mb-1.5">{desc}</p>}
      {children}
    </div>
  )

  const inp = 'w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-brown">Site Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Control what visitors see on the public website.</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${msg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* ── Hero Images ── */}
      <Section title="Hero Images" sub="Background photos shown on the homepage" keys={HERO_KEYS} id="hero">
        {[
          { key: 'hero_image_url', label: 'Homepage Hero Photo', desc: 'Large background photo in the first section', ref: heroRef },
          { key: 'cta_image_url',  label: 'CTA Banner Photo',    desc: '"Ready to Book?" section background',       ref: ctaRef  },
        ].map(({ key, label, desc, ref }) => (
          <Field key={key} label={label} desc={desc}>
            <div className="flex gap-2">
              <input
                value={val(key)}
                onChange={e => set(key, e.target.value)}
                placeholder="https://… or upload a file"
                className={`${inp} flex-1`}
              />
              <button
                type="button"
                onClick={() => ref.current?.click()}
                disabled={uploading === key}
                className="shrink-0 border border-warm-border px-3 py-2 rounded-lg text-xs text-brown-mid hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {uploading === key ? 'Uploading…' : 'Upload'}
              </button>
              <input ref={ref} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadHero(f, key); e.target.value = '' }} />
            </div>
            {val(key) && (
              <div className="mt-2 h-32 w-full rounded-lg overflow-hidden bg-gray-100">
                <img src={val(key)} alt="preview" className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              </div>
            )}
          </Field>
        ))}
      </Section>

      {/* ── Contact Info ── */}
      <Section title="Contact Information" sub="Shown on the Contact page and footer" keys={CONTACT_KEYS} id="contact">
        <Field label="Phone Number">
          <input value={val('contact_phone')} onChange={e => set('contact_phone', e.target.value)}
            placeholder="(033) 320-1234" className={inp} />
        </Field>
        <Field label="Email Address">
          <input type="email" value={val('contact_email')} onChange={e => set('contact_email', e.target.value)}
            placeholder="info@cabalumhotel.ph" className={inp} />
        </Field>
        <Field label="Hotel Address">
          <textarea rows={3} value={val('contact_address')} onChange={e => set('contact_address', e.target.value)}
            placeholder={'Iloilo City, Iloilo\nPhilippines 5000'}
            className={`${inp} resize-none`} />
        </Field>
      </Section>

      {/* ── Social Links ── */}
      <Section title="Social Media Links" sub="Leave blank to hide the link on the website" keys={SOCIAL_KEYS} id="social">
        <Field label="Facebook Page URL">
          <input value={val('facebook_url')} onChange={e => set('facebook_url', e.target.value)}
            placeholder="https://facebook.com/cabalumhotel" className={inp} />
        </Field>
        <Field label="Instagram Profile URL">
          <input value={val('instagram_url')} onChange={e => set('instagram_url', e.target.value)}
            placeholder="https://instagram.com/cabalumhotel" className={inp} />
        </Field>
      </Section>
    </div>
  )
}
