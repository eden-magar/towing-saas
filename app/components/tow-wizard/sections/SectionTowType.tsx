'use client'

import { Truck, ArrowLeftRight, Route, type LucideIcon } from 'lucide-react'
import { useTowForm } from '../../../hooks/useTowForm'

type Form = ReturnType<typeof useTowForm>

const OPTIONS: {
  value: 'single' | 'exchange' | 'custom'
  label: string
  icon: LucideIcon
}[] = [
  { value: 'single', label: 'פשוטה', icon: Truck },
  { value: 'exchange', label: 'החלפה', icon: ArrowLeftRight },
  { value: 'custom', label: 'מותאם', icon: Route },
]

/**
 * Tow-type selection section (mobile scroll page). Three compact side-by-side
 * buttons (icon + short label) to minimize vertical scroll. Tapping selects the
 * type via form.selectTowType.
 */
export function SectionTowType({ form }: { form: Form }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const isActive = form.towType === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => form.selectTowType(option.value)}
            className={
              isActive
                ? 'flex flex-col items-center justify-center gap-1.5 min-h-[76px] px-2 py-3 rounded-xl border-2 border-gt-brand bg-gt-brand-subtle text-gt-brand transition-colors'
                : 'flex flex-col items-center justify-center gap-1.5 min-h-[76px] px-2 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-600 transition-colors'
            }
          >
            <Icon size={22} className="shrink-0" />
            <span
              className={
                isActive
                  ? 'text-sm font-bold text-gt-brand'
                  : 'text-sm font-bold text-gray-800'
              }
            >
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
