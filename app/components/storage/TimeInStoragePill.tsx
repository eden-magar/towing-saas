'use client'

import { Clock } from 'lucide-react'
import {
  formatTimeInStorageHebrew,
  getStorageCalendarDays,
} from '@/app/lib/utils/storage-vehicle'

/** Inclusive start of the warning band (4–7 calendar days in storage). */
export const STORAGE_DURATION_WARNING_MIN_DAYS = 4
/** Inclusive start of the alert band (8+ calendar days in storage). */
export const STORAGE_DURATION_ALERT_MIN_DAYS = 8

const STORAGE_DURATION_PILL_BASE =
  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium'

export function storageDurationPillClass(days: number): string {
  if (days >= STORAGE_DURATION_ALERT_MIN_DAYS) {
    return `${STORAGE_DURATION_PILL_BASE} bg-rose-200 text-rose-900`
  }
  if (days >= STORAGE_DURATION_WARNING_MIN_DAYS) {
    return `${STORAGE_DURATION_PILL_BASE} bg-amber-200 text-amber-900`
  }
  return `${STORAGE_DURATION_PILL_BASE} bg-sky-100 text-sky-800`
}

type TimeInStoragePillProps = {
  lastStoredAt: string | Date | null | undefined
  className?: string
}

/** Relative “באחסנה …” duration pill with 3 urgency tiers (portal + dashboard). */
export function TimeInStoragePill({ lastStoredAt, className = '' }: TimeInStoragePillProps) {
  const label = formatTimeInStorageHebrew(lastStoredAt)
  const days = getStorageCalendarDays(lastStoredAt)
  if (!label || days == null) return null

  return (
    <span className={`${storageDurationPillClass(days)} ${className}`.trim()}>
      <Clock size={12} className="shrink-0" />
      {label}
    </span>
  )
}
