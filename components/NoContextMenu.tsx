'use client'
import { useEffect } from 'react'

export default function NoContextMenu() {
  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', block)
    return () => document.removeEventListener('contextmenu', block)
  }, [])
  return null
}
