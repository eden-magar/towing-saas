'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

/**
 * Brief top-of-viewport success notice — same fixed-banner pattern as create-form errors.
 */
export function useFlashNotice(durationMs = 3500) {
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), durationMs)
    return () => window.clearTimeout(t)
  }, [notice, durationMs])

  return { notice, setNotice, clearNotice: () => setNotice(null) }
}

export function FlashNotice({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      className="fixed top-4 left-4 right-4 z-[60] flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 shadow-sm"
      dir="rtl"
      role="status"
    >
      <Check size={16} className="shrink-0 text-emerald-600" aria-hidden />
      <span>{message}</span>
    </div>
  )
}
