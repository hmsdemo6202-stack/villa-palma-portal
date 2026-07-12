'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

export type GalleryPhoto = { id: string; image_url: string; alt_text?: string | null; sort_order?: number }

const MAX_SCALE = 4

function touchDistance(touches: React.TouchList) {
  const a = touches[0], b = touches[1]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export default function RoomGalleryModal({
  photos, roomTypeName, startIndex = 0, onClose,
}: { photos: GalleryPhoto[]; roomTypeName: string; startIndex?: number; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [interacting, setInteracting] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null)
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const resetZoom = useCallback(() => { setScale(1); setPos({ x: 0, y: 0 }) }, [])

  const prev = useCallback(() => { setIndex(i => (i - 1 + photos.length) % photos.length); resetZoom() }, [photos.length, resetZoom])
  const next = useCallback(() => { setIndex(i => (i + 1) % photos.length); resetZoom() }, [photos.length, resetZoom])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (scale === 1) {
        if (e.key === 'ArrowLeft') prev()
        if (e.key === 'ArrowRight') next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next, scale])

  // Native (non-passive) wheel + touchmove listeners so preventDefault
  // reliably stops page scroll / the browser's own pinch-zoom while the
  // user is zooming the photo — React's synthetic handlers for these
  // events are passive by default and can't reliably preventDefault.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function zoomBy(delta: number) {
      setScale(s => {
        const next = Math.min(MAX_SCALE, Math.max(1, s + delta))
        if (next === 1) setPos({ x: 0, y: 0 })
        return next
      })
    }

    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      zoomBy(-e.deltaY * 0.0015)
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const d = touchDistance(e.touches as unknown as React.TouchList)
        const next = Math.min(MAX_SCALE, Math.max(1, pinchRef.current.scale * (d / pinchRef.current.dist)))
        setScale(next)
        if (next === 1) setPos({ x: 0, y: 0 })
      } else if (e.touches.length === 1 && dragRef.current) {
        e.preventDefault()
        const t = e.touches[0]
        const dx = t.clientX - dragRef.current.startX
        const dy = t.clientY - dragRef.current.startY
        setPos({ x: dragRef.current.posX + dx, y: dragRef.current.posY + dy })
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  function zoomAt(newScale: number) {
    const clamped = Math.min(MAX_SCALE, Math.max(1, newScale))
    setScale(clamped)
    if (clamped === 1) setPos({ x: 0, y: 0 })
  }

  function onDoubleClick() {
    zoomAt(scale > 1 ? 1 : 2.5)
  }

  function onMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return
    setInteracting(true)
    dragRef.current = { startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPos({ x: dragRef.current.posX + dx, y: dragRef.current.posY + dy })
  }
  function endDrag() { dragRef.current = null; setInteracting(false) }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      setInteracting(true)
      pinchRef.current = { dist: touchDistance(e.touches), scale }
    } else if (e.touches.length === 1 && scale > 1) {
      setInteracting(true)
      dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, posX: pos.x, posY: pos.y }
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null
    if (e.touches.length === 0) { dragRef.current = null; setInteracting(false) }
  }

  if (photos.length === 0) return null

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-white text-sm">{roomTypeName} — {index + 1} / {photos.length}</p>
          <div className="flex items-center gap-3">
            {scale > 1 && (
              <button onClick={() => zoomAt(1)} className="text-white/80 hover:text-white text-xs bg-white/10 px-2.5 py-1 rounded-full">Reset zoom</button>
            )}
            <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative bg-black rounded-xl overflow-hidden select-none"
          style={{ touchAction: 'none' }}
          onDoubleClick={onDoubleClick}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            src={photos[index].image_url}
            alt={photos[index].alt_text ?? roomTypeName}
            draggable={false}
            className="w-full max-h-[70vh] object-contain"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              cursor: scale > 1 ? 'grab' : 'zoom-in',
              transition: interacting ? 'none' : 'transform 0.15s ease-out',
            }}
          />
          {photos.length > 1 && scale === 1 && (
            <>
              <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white w-9 h-9 rounded-full flex items-center justify-center">‹</button>
              <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white w-9 h-9 rounded-full flex items-center justify-center">›</button>
            </>
          )}
        </div>

        <p className="text-center text-white/50 text-[11px] mt-2">Scroll, pinch, or double-click to zoom · drag to pan</p>

        {photos.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => { setIndex(i); resetZoom() }}
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
