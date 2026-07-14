'use client'
import { useState } from 'react'

type Section = 'hotel' | 'schedule' | 'tax' | 'policies'

const TABS: { id: Section; label: string }[] = [
  { id: 'hotel',    label: 'Hotel Info' },
  { id: 'schedule', label: 'Check-in / Out' },
  { id: 'tax',      label: 'Tax & Currency' },
  { id: 'policies', label: 'Policies' },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<Section>('hotel')
  const [saved, setSaved] = useState(false)

  // Hotel info fields
  const [hotel, setHotel] = useState({
    name: 'Cabalum Hotel & Suites',
    tagline: 'Boutique Hospitality in the Heart of Iloilo',
    address: 'Dr. Fermin Caram Ave. Sr., Iznart St., Iloilo City, Iloilo 5000',
    phone: '(033) 337 2536',
    email: '1945cwc@gmail.com',
    website: 'www.cabalumhotel.ph',
    owner: 'George Michael L. Cabalum',
    total_rooms: '9',
  })

  // Schedule fields
  const [schedule, setSchedule] = useState({
    check_in_time: '14:00',
    check_out_time: '12:00',
    early_check_in_fee: '500',
    late_check_out_fee: '500',
  })

  // Tax fields
  const [tax, setTax] = useState({
    currency: 'PHP',
    currency_symbol: '₱',
    vat_rate: '12',
    tourism_tax: '0',
    include_vat_in_rates: 'yes',
  })

  // Policy fields
  const [policies, setPolicies] = useState({
    cancellation_hours: '48',
    deposit_percentage: '30',
    pets_allowed: 'no',
    smoking_allowed: 'no',
    min_checkin_age: '18',
    max_guests_per_room: '6',
  })

  function setH(f: string, v: string) { setHotel(x => ({ ...x, [f]: v })) }
  function setSch(f: string, v: string) { setSchedule(x => ({ ...x, [f]: v })) }
  function setT(f: string, v: string) { setTax(x => ({ ...x, [f]: v })) }
  function setP(f: string, v: string) { setPolicies(x => ({ ...x, [f]: v })) }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brown">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Hotel configuration and preferences</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-xs text-green-600 font-medium bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
              ✓ Changes saved
            </span>
          )}
          <button onClick={handleSave}
            className="bg-terra text-white text-sm px-4 py-2 rounded-lg hover:bg-terra-dark transition-colors font-medium">
            Save Changes
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-warm-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`text-sm px-4 py-2.5 transition-colors relative ${
              tab === t.id
                ? 'text-terra font-medium'
                : 'text-gray-500 hover:text-brown'
            }`}>
            {t.label}
            {tab === t.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-terra" />
            )}
          </button>
        ))}
      </div>

      <div className="bg-white border border-warm-border rounded-xl p-6 space-y-5">

        {/* Hotel Info */}
        {tab === 'hotel' && (
          <>
            <h2 className="font-semibold text-brown">Hotel Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Hotel Name</label>
                <input value={hotel.name} onChange={e => setH('name', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Tagline</label>
                <input value={hotel.tagline} onChange={e => setH('tagline', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Address</label>
                <input value={hotel.address} onChange={e => setH('address', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Phone</label>
                <input value={hotel.phone} onChange={e => setH('phone', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Email</label>
                <input type="email" value={hotel.email} onChange={e => setH('email', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Website</label>
                <input value={hotel.website} onChange={e => setH('website', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Total Rooms</label>
                <input type="number" min="1" value={hotel.total_rooms} onChange={e => setH('total_rooms', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Owner / Manager Name</label>
                <input value={hotel.owner} onChange={e => setH('owner', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
            </div>
          </>
        )}

        {/* Schedule */}
        {tab === 'schedule' && (
          <>
            <h2 className="font-semibold text-brown">Check-in &amp; Check-out Times</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Standard Check-in Time</label>
                <input type="time" value={schedule.check_in_time} onChange={e => setSch('check_in_time', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Standard Check-out Time</label>
                <input type="time" value={schedule.check_out_time} onChange={e => setSch('check_out_time', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Early Check-in Fee (₱)</label>
                <input type="number" min="0" value={schedule.early_check_in_fee} onChange={e => setSch('early_check_in_fee', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Late Check-out Fee (₱)</label>
                <input type="number" min="0" value={schedule.late_check_out_fee} onChange={e => setSch('late_check_out_fee', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
            </div>
          </>
        )}

        {/* Tax & Currency */}
        {tab === 'tax' && (
          <>
            <h2 className="font-semibold text-brown">Tax &amp; Currency</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Currency Code</label>
                <select value={tax.currency} onChange={e => setT('currency', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                  <option value="PHP">PHP — Philippine Peso</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Currency Symbol</label>
                <input value={tax.currency_symbol} onChange={e => setT('currency_symbol', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">VAT Rate (%)</label>
                <input type="number" min="0" max="100" step="0.5" value={tax.vat_rate} onChange={e => setT('vat_rate', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Tourism Tax (%)</label>
                <input type="number" min="0" max="100" step="0.5" value={tax.tourism_tax} onChange={e => setT('tourism_tax', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">VAT Included in Published Rates?</label>
                <select value={tax.include_vat_in_rates} onChange={e => setT('include_vat_in_rates', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                  <option value="yes">Yes — rates shown are VAT-inclusive</option>
                  <option value="no">No — VAT added at checkout</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Policies */}
        {tab === 'policies' && (
          <>
            <h2 className="font-semibold text-brown">Hotel Policies</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Free Cancellation Window (hours)</label>
                <input type="number" min="0" value={policies.cancellation_hours} onChange={e => setP('cancellation_hours', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
                <p className="text-xs text-gray-400 mt-1">Cancel within this many hours = no refund</p>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Deposit Required (%)</label>
                <input type="number" min="0" max="100" value={policies.deposit_percentage} onChange={e => setP('deposit_percentage', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Pets Allowed?</label>
                <select value={policies.pets_allowed} onChange={e => setP('pets_allowed', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="some">Some rooms only</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Smoking Policy</label>
                <select value={policies.smoking_allowed} onChange={e => setP('smoking_allowed', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra">
                  <option value="no">No smoking anywhere indoors</option>
                  <option value="designated">Designated areas only</option>
                  <option value="some">Some rooms designated smoking</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Minimum Check-in Age</label>
                <input type="number" min="0" value={policies.min_checkin_age} onChange={e => setP('min_checkin_age', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">Max Guests per Room</label>
                <input type="number" min="1" value={policies.max_guests_per_room} onChange={e => setP('max_guests_per_room', e.target.value)}
                  className="w-full border border-warm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terra" />
              </div>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        ℹ️ Settings are stored in this session for demonstration. In production, these would be persisted to a hotel_settings table.
      </p>
    </div>
  )
}
