'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import RoomGalleryModal, { GalleryPhoto } from '@/components/RoomGalleryModal'

type RoomType = {
  id: string
  name: string
  description: string | null
  base_price: number
  capacity: number
  amenities: string | null
  image_url: string | null
  room_type_images: GalleryPhoto[]
}

function currency(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

export default function GuestRoomsPage() {
  const router = useRouter()
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [gallery, setGallery] = useState<RoomType | null>(null)

  useEffect(() => {
    createClient()
      .from('room_types')
      .select('*, room_type_images(id, image_url, alt_text, sort_order)')
      .order('base_price')
      .then(({ data }) => {
        setRoomTypes((data as RoomType[]) ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="bg-[#2d1c14] px-6 pt-14 pb-8">
        <p className="text-[9px] tracking-[0.4em] text-[#8a6a5a] uppercase mb-1">Cabalum Hotel</p>
        <h1 className="font-serif text-2xl font-bold text-[#f0e0d0]">Our Rooms</h1>
        <p className="text-[#7a5040] text-xs mt-1">Discover comfort and elegance</p>
      </div>

      {/* Room cards */}
      <div className="p-5 space-y-5">
        {loading && (
          <>{[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#f0e0d0]">
              <div className="h-44 bg-gray-100 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-10 bg-gray-100 rounded-xl animate-pulse mt-3" />
              </div>
            </div>
          ))}</>
        )}

        {!loading && roomTypes.length === 0 && (
          <div className="text-center py-16 text-[#8a6a5a]">
            <p className="text-5xl mb-4">🏨</p>
            <p className="font-medium">No rooms available at this time.</p>
            <p className="text-xs mt-1">Please contact the front desk.</p>
          </div>
        )}

        {roomTypes.map(rt => (
          <div key={rt.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#f0e0d0]">
            {/* Image */}
            <div className="relative">
              {rt.image_url ? (
                <img src={rt.image_url} alt={rt.name} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-44 bg-gradient-to-br from-[#3d2418] via-[#7a4028] to-[#b85c38] flex items-center justify-center">
                  <span className="text-6xl opacity-25">🛏</span>
                </div>
              )}
              {rt.room_type_images.length > 0 && (
                <button
                  onClick={() => setGallery(rt)}
                  className="absolute bottom-3 right-3 text-xs bg-black/60 text-white px-3 py-1.5 rounded-full hover:bg-black/75 transition-colors"
                >
                  📷 View Photos ({rt.room_type_images.length})
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-base font-bold text-[#3d2018] leading-tight">{rt.name}</h2>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-xl font-bold text-[#b85c38] leading-tight">{currency(rt.base_price)}</p>
                  <p className="text-[10px] text-[#8a6a5a]">per night</p>
                </div>
              </div>

              {rt.description && (
                <p className="text-xs text-[#7a5040] leading-relaxed mb-3">{rt.description}</p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8a6a5a] mb-4">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Up to {rt.capacity} guest{rt.capacity !== 1 ? 's' : ''}
                </span>
                {rt.amenities && rt.amenities.split(',').slice(0, 3).map(a => (
                  <span key={a} className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#c8a898] inline-block" />
                    {a.trim()}
                  </span>
                ))}
              </div>

              <button
                onClick={() => router.push(
                  `/guest/reservations?type=${rt.id}&name=${encodeURIComponent(rt.name)}&price=${rt.base_price}`
                )}
                className="w-full bg-[#b85c38] text-white py-3.5 rounded-xl font-medium hover:bg-[#9a4a2a] transition-colors text-sm tracking-wide"
              >
                Book Now
              </button>
            </div>
          </div>
        ))}
      </div>

      {gallery && (
        <RoomGalleryModal
          photos={[...gallery.room_type_images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))}
          roomTypeName={gallery.name}
          onClose={() => setGallery(null)}
        />
      )}
    </div>
  )
}
