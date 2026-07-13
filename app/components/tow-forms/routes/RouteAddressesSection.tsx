'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowLeft, Plus } from 'lucide-react'

/** Shared empty-leg pill — label only; callers keep their own state/handlers. */
export function EmptyLegToggleButton({
  active,
  onClick,
  label,
  className = '',
}: {
  active: boolean
  onClick: () => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? 'border-gt-brand/40 bg-gt-brand/10 text-gt-brand-text'
          : 'border-gt-border bg-white text-gt-text-secondary hover:border-gt-border-strong'
      } ${className}`}
    >
      {label}
    </button>
  )
}

export function RouteAddressFieldLabel({
  tone,
  children,
  required,
}: {
  tone: 'origin' | 'destination' | 'stop'
  children: ReactNode
  required?: boolean
}) {
  const dot =
    tone === 'origin'
      ? 'bg-emerald-500'
      : tone === 'destination'
        ? 'bg-red-500'
        : 'bg-sky-500'
  return (
    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gt-text-secondary">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      {children}
      {required ? <span className="text-red-500">*</span> : null}
    </span>
  )
}

/**
 * Origin | arrow | destination grid. Stacks on mobile (or when `stacked`).
 * Address-specific controls under a field belong in `underDestination` / field slots.
 */
export function RouteOriginDestGrid({
  origin,
  destination,
  underDestination,
  stacked = false,
}: {
  origin: ReactNode
  destination: ReactNode
  underDestination?: ReactNode
  stacked?: boolean
}) {
  if (stacked) {
    return (
      <div className="flex flex-col gap-3">
        <div className="min-w-0">{origin}</div>
        <div className="flex justify-center text-gt-text-tertiary" aria-hidden>
          <ArrowDown size={16} />
        </div>
        <div className="min-w-0 space-y-2">
          {destination}
          {underDestination}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <div className="min-w-0">{origin}</div>
      <div
        className="hidden items-center justify-center pt-8 text-gt-text-tertiary sm:flex"
        aria-hidden
      >
        <ArrowLeft size={16} />
      </div>
      <div className="flex justify-center text-gt-text-tertiary sm:hidden" aria-hidden>
        <ArrowDown size={16} />
      </div>
      <div className="min-w-0 space-y-2">
        {destination}
        {underDestination}
      </div>
    </div>
  )
}

export function RouteAddStopButton({
  onClick,
  className = '',
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <div className={`flex justify-center ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gt-brand px-3 py-2 text-sm font-medium text-gt-brand transition-colors hover:bg-gt-brand-subtle"
      >
        <Plus className="h-4 w-4 shrink-0" />
        הוסף נקודת עצירה
      </button>
    </div>
  )
}

/**
 * Footer: distance on one side, empty-leg pricing toggles on the other.
 * Pass `bleed` when nested inside FormSubcard padding so the tint reaches the card edge.
 */
export function RouteAddressesFooter({
  distance,
  startFromBase,
  onStartFromBaseChange,
  showStartFromBase = false,
  chargeDeadheadReturn,
  onChargeDeadheadReturnChange,
  showDeadhead = false,
  deadheadHints,
  bleed = false,
}: {
  distance: ReactNode
  startFromBase?: boolean
  onStartFromBaseChange?: (next: boolean) => void
  showStartFromBase?: boolean
  chargeDeadheadReturn?: boolean
  onChargeDeadheadReturnChange?: (next: boolean) => void
  showDeadhead?: boolean
  deadheadHints?: ReactNode
  bleed?: boolean
}) {
  const showEmptyLegs =
    (showStartFromBase && onStartFromBaseChange) ||
    (showDeadhead && onChargeDeadheadReturnChange)

  return (
    <div
      className={`border-t border-gt-border-subtle bg-gt-surface-subtle/90 px-3.5 py-3 sm:px-3 ${
        bleed ? '-mx-3.5 -mb-3.5 mt-4 sm:-mx-3 sm:-mb-3' : ''
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-sm font-medium text-gt-text-secondary">{distance}</div>
        {showEmptyLegs ? (
          <div className="space-y-1.5 sm:text-left">
            <p className="text-[11px] font-medium text-gt-text-tertiary">
              חיוב נסיעה ריקה
            </p>
            <div className="flex flex-wrap gap-2">
              {showStartFromBase && onStartFromBaseChange ? (
                <EmptyLegToggleButton
                  active={!!startFromBase}
                  onClick={() => onStartFromBaseChange(!startFromBase)}
                  label="מהחניון למוצא"
                />
              ) : null}
              {showDeadhead && onChargeDeadheadReturnChange ? (
                <EmptyLegToggleButton
                  active={!!chargeDeadheadReturn}
                  onClick={() =>
                    onChargeDeadheadReturnChange(!chargeDeadheadReturn)
                  }
                  label="מהיעד לחניון"
                />
              ) : null}
            </div>
            {deadheadHints}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Storage / drop-to-storage pill that sits under the destination field. */
export function DropToStorageToggle({
  active,
  onClick,
  label = 'הורדה לאחסנה',
}: {
  active: boolean
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-purple-300 bg-purple-50 text-purple-700'
          : 'border-gt-border-subtle bg-gt-surface-subtle text-gt-text-tertiary hover:border-purple-200 hover:text-purple-600'
      }`}
    >
      <span aria-hidden>⚑</span>
      {label}
    </button>
  )
}
