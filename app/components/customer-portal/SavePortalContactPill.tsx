'use client'

import { Check, Loader2, Plus } from 'lucide-react'

interface SavePortalContactPillProps {
  visible: boolean
  /** True after a successful save for this pair (feedback). */
  saved?: boolean
  saving?: boolean
  onSave: () => void
  disabled?: boolean
  className?: string
}

/**
 * Explicit save — not a pending toggle. Portal contacts are written immediately
 * when the user clicks (unlike staff SaveCustomerContactPill which flags for submit).
 */
export function SavePortalContactPill({
  visible,
  saved = false,
  saving = false,
  onSave,
  disabled = false,
  className = '',
}: SavePortalContactPillProps) {
  if (!visible) return null

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={disabled || saving || saved}
      aria-pressed={saved}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        saved
          ? 'bg-[#33d4ff]/15 text-[#1a9bc7] border border-[#33d4ff]/40'
          : 'bg-transparent text-gray-600 border border-gray-300 hover:border-gray-400 hover:bg-gray-50'
      } ${className}`}
      dir="rtl"
    >
      {saving ? (
        <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
      ) : saved ? (
        <Check size={14} className="shrink-0" aria-hidden />
      ) : (
        <Plus size={14} className="shrink-0" aria-hidden />
      )}
      {saved ? 'נשמר ברשימה' : 'שמור לרשימה'}
    </button>
  )
}
