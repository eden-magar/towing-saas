'use client'

import type { ReactNode } from 'react'

/**
 * One-row vehicle actions group: תקלות · סוג גרר · פרטי רכב ידנית.
 * Children should be full-width triggers (DefectSelector / TowTruckTypeSelector / manual button).
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
      className={`grid w-full grid-cols-3 gap-2 ${className}`.trim()}
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
    'inline-flex w-full min-w-0 min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2.5 text-sm font-semibold transition-colors',
    active
      ? 'border-gt-brand bg-gt-brand-subtle text-gt-brand-text'
      : 'border-gt-border bg-white text-gt-text-primary hover:border-gt-brand hover:bg-gt-brand-subtle/40',
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}
