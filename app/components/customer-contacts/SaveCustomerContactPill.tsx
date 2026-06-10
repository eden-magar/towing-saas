'use client'

import { Check, Plus } from 'lucide-react'

interface SaveCustomerContactPillProps {
  visible: boolean
  active: boolean
  onToggle: () => void
  disabled?: boolean
  className?: string
}

export function SaveCustomerContactPill({
  visible,
  active,
  onToggle,
  disabled = false,
  className = '',
}: SaveCustomerContactPillProps) {
  if (!visible) return null

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? 'bg-[#33d4ff]/15 text-[#1a9bc7] border border-[#33d4ff]/40'
          : 'bg-transparent text-gray-600 border border-gray-300 hover:border-gray-400 hover:bg-gray-50'
      } ${className}`}
      dir="rtl"
    >
      {active ? (
        <Check size={14} className="shrink-0" aria-hidden />
      ) : (
        <Plus size={14} className="shrink-0" aria-hidden />
      )}
      שמור לאנשי הקשר של הלקוח
    </button>
  )
}
