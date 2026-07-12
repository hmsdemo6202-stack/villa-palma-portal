'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  RoomTypeImage, MIN_RECOMMENDED_PHOTOS,
  listRoomTypeImages, uploadRoomTypeImage, deleteRoomTypeImage,
  reorderRoomTypeImage, setPrimaryRoomTypeImage,
} from '@/lib/supabase/roomImages'

export default function RoomPhotoManager({
  roomTypeId, roomTypeName, onClose,
}: { roomTypeId: string; roomTypeName: string; onClose: () => void }) {
  const supabase = createClient()
  const [images, setImages] = useState<RoomTypeImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setImages(await listRoomTypeImages(supabase, roomTypeId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load photos.')
    }
    setLoading(false)
  }, [supabase, roomTypeId])

  useEffect(() => { load() }, [load])

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (list.length === 0) return
    setUploading(true)
    setError(null)
    let sortOrder = images.length
    let needsPrimary = images.length === 0
    for (const file of list) {
      try {
        const img = await uploadRoomTypeImage(supabase, roomTypeId, file, sortOrder++)
        setImages(prev => [...prev, img])
        if (needsPrimary) {
          await setPrimaryRoomTypeImage(supabase, roomTypeId, img)
          needsPrimary = false
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : `Failed to upload ${file.name}.`)
      }
    }
    setUploading(false)
    load()
  }

  async function handleDelete(image: RoomTypeImage) {
    if (!confirm('Delete this photo?')) return
    try {
      await deleteRoomTypeImage(supabase, image)
      setImages(prev => prev.filter(i => i.id !== image.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete photo.')
    }
  }

  async function handleSetPrimary(image: RoomTypeImage) {
    try {
      await setPrimaryRoomTypeImage(supabase, roomTypeId, image)
      setImages(prev => prev.map(i => ({ ...i, is_primary: i.id === image.id })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set cover photo.')
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[index], next[target]] = [next[target], next[index]]
    setImages(next)
    try {
      await Promise.all(next.map((img, i) => reorderRoomTypeImage(supabase, img.id, i)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reorder photos.')
    }
  }

  const count = images.length
  const remaining = Math.max(0, MIN_RECOMMENDED_PHOTOS - count)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-brown">Photos — {roomTypeName}</h2>
            <p className={`text-xs mt-0.5 ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {count} photo{count !== 1 ? 's' : ''} uploaded
              {remaining > 0
                ? ` — add ${remaining} more to reach the recommended minimum of ${MIN_RECOMMENDED_PHOTOS}`
                : ' — minimum reached, you can keep adding more'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm mb-4">{error}</div>
        )}

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-5 ${
            dragOver ? 'border-terra bg-terra-light/20' : 'border-warm-border hover:border-terra'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
          />
          <p className="text-sm text-brown-mid">
            {uploading ? 'Uploading…' : 'Drag photos here or click to select files'}
          </p>
          <p className="text-xs text-gray-400 mt-1">You can select multiple images at once</p>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading photos…</p>
        ) : images.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No photos yet. Upload the first one above.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((img, i) => (
              <div key={img.id} className="relative bg-gray-100 rounded-lg overflow-hidden border border-warm-border group">
                <img src={img.image_url} alt={img.alt_text ?? ''} className="w-full h-28 object-cover" />
                {img.is_primary && (
                  <span className="absolute top-1.5 left-1.5 text-[10px] bg-terra text-white px-1.5 py-0.5 rounded-full">Cover</span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-xs">
                  <div className="flex gap-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0}
                      className="bg-white/90 px-1.5 py-0.5 rounded disabled:opacity-30">←</button>
                    <button onClick={() => move(i, 1)} disabled={i === images.length - 1}
                      className="bg-white/90 px-1.5 py-0.5 rounded disabled:opacity-30">→</button>
                  </div>
                  {!img.is_primary && (
                    <button onClick={() => handleSetPrimary(img)} className="bg-white/90 px-2 py-0.5 rounded text-terra">
                      Set as cover
                    </button>
                  )}
                  <button onClick={() => handleDelete(img)} className="bg-white/90 px-2 py-0.5 rounded text-red-500">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
