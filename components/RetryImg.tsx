'use client'
import { ImgHTMLAttributes, useEffect, useRef, useState } from 'react'

const MAX_RETRIES = 3

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
}

export default function RetryImg({ src, onError: _ignored, ...rest }: Props) {
  const baseSrc = useRef(src)
  const retries = useRef(0)
  const [displaySrc, setDisplaySrc] = useState(src)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    baseSrc.current = src
    retries.current = 0
    setDisplaySrc(src)
    setHidden(false)
  }, [src])

  function handleError() {
    if (retries.current >= MAX_RETRIES) { setHidden(true); return }
    retries.current++
    const n = retries.current
    setTimeout(() => {
      try {
        const u = new URL(baseSrc.current, window.location.href)
        u.searchParams.set('_r', String(n))
        setDisplaySrc(u.toString())
      } catch {
        setHidden(true)
      }
    }, n * 1500)
  }

  if (hidden) return null
  return <img {...rest} src={displaySrc} onError={handleError} />
}
