'use client'

import { createContext, useContext, type ReactNode } from 'react'

const VehicleActionsCompactContext = createContext(false)

export function useVehicleActionsCompact() {
  return useContext(VehicleActionsCompactContext)
}

/**
 * Vehicle actions group: מאחסנה · ידני · תקלות · סוג גרר (RTL right→left).
 * Always wraps — never horizontal-scrolls — so grown triggers (e.g. תקלות with
 * selections) cannot push siblings outside FormSubcard/FormCard overflow-hidden
 * and make them unclickable.
 * `compact` — smaller triggers for half-width exchange columns.
 */
export function VehicleCardActions({
  children,
  className = '',
  wrap: _wrap = false,
  compact = false,
}: {
  children: ReactNode
  className?: string
  /** @deprecated Wrapping is always on; kept for call-site compatibility. */
  wrap?: boolean
  /** Compact triggers for half-width exchange columns. */
  compact?: boolean
}) {
  void _wrap
  const layoutClass = compact ? 'flex-wrap gap-1.5' : 'flex-wrap gap-2'

  return (
    <VehicleActionsCompactContext.Provider value={compact}>
      <div
        className={['flex w-full items-stretch', layoutClass, className]
          .filter(Boolean)
          .join(' ')}
        dir="rtl"
        role="group"
        aria-label="פעולות רכב"
      >
        {children}
      </div>
    </VehicleActionsCompactContext.Provider>
  )
}

/** Shared trigger look for vehicle-card actions. */
export function vehicleActionTriggerClass(
  active: boolean,
  extra = '',
  compact = false,
): string {
  return [
    compact
      ? 'inline-flex max-w-full min-h-[32px] shrink-0 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium transition-colors whitespace-nowrap'
      : 'inline-flex max-w-full min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 sm:px-3 text-sm font-semibold transition-colors whitespace-nowrap',
    active
      ? 'border-gt-brand bg-gt-brand-subtle text-gt-brand-text'
      : 'border-gt-border bg-white text-gt-text-primary hover:border-gt-brand hover:bg-gt-brand-subtle/40',
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}
