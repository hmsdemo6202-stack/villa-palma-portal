'use client'
import { useState, useEffect, useCallback } from 'react'

export type GalleryPhoto = { id: string; image_url: string; alt_text?: string | null; sort_order?: number }

export default function RoomGalleryModal({
  photos, roomTypeName, startIndex = 0, onClose,
}: { photos: GalleryPhoto[]; roomTypeName: string; startIndex?: number; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex)

  const prev = useCallback(() => setIndex(i => (i - 1 + photos.length) % photos.length), [photos.length])
  const next = useCallback(() => setIndex(i => (i + 1) % photos.length), [photos.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  if (photos.length === 0) return null

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-white text-sm">{roomTypeName} — {index + 1} / {photos.length}</p>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="relative bg-black rounded-xl overflow-hidden">
          <img
            src={photos[index].image_url}
            alt={photos[index].alt_text ?? roomTypeName}
            className="w-full max-h-[70vh] object-contain"
          />
          {photos.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white w-9 h-9 rounded-full flex items-center justify-center">‹</button>
              <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white w-9 h-9 rounded-full flex items-center justify-center">›</button>
            </>
          )}
        </div>

        {photos.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setIndex(i)}
                className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 ${i === index ? 'border-terra' : 'border-transparent opacity-70'}`}
              >
                <img src={p.image_url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
