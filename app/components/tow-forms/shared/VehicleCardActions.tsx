'use client'

import type { ReactNode } from 'react'

/**
 * Vehicle actions group: פרטי רכב ידנית · תקלות · סוג גרר (RTL right→left).
 * One row on desktop; wrap only on narrow/mobile widths.
 */
export function VehicleCardActions({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex w-full flex-nowrap items-stretch gap-2 overflow-x-auto max-sm:flex-wrap sm:overflow-visible ${className}`.trim()}
      dir="rtl"
      role="group"
      aria-label="פעולות רכב"
    >
      {children}
    </div>
  )
}

/** Shared prominent trigger look for the three vehicle-card actions. */
export function vehicleActionTriggerClass(active: boolean, extra = ''): string {
  return [
    'inline-flex max-w-full min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 sm:px-3 text-sm font-semibold transition-colors whitespace-nowrap',
    active
      ? 'border-gt-brand bg-gt-brand-subtle text-gt-brand-text'
      : 'border-gt-border bg-white text-gt-text-primary hover:border-gt-brand hover:bg-gt-brand-subtle/40',
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}
