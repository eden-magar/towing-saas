import type { StoredVehicle } from '../queries/storage'
import { hydrateDefectsFromTowReason } from '../constants/defects'

export type StoredVehicleConditionFields = {
  isFaulty: boolean
  defects: string[]
}

export type StoredVehicleHydrationSlot =
  | 'single'
  | 'exchange-working'
  | 'exchange-defective'

export type StoredPlateResolveResult =
  | { status: 'not-in-storage' }
  | { status: 'blocked'; message: string }
  | { status: 'hydrated' }

export const STORAGE_TAKE_OUT_CONFIRM_MESSAGE =
  'הרכב נמצא באחסנה — להוציא מהאחסנה?'

export const STORAGE_OTHER_CUSTOMER_MESSAGE =
  'הרכב שייך ללקוח אחר ונמצא באחסנה'

export const STORAGE_TAKE_OUT_CANCELLED_MESSAGE =
  'הרכב נמצא באחסנה — לא ניתן להמשיך ללא הוצאה מהאחסנה'

/** Map stored_vehicles row → form defect/condition fields (pure, no side effects). */
export function storedVehicleToCondition(
  stored: Pick<StoredVehicle, 'vehicle_condition' | 'defects'>
): StoredVehicleConditionFields {
  return {
    isFaulty: stored.vehicle_condition === 'faulty',
    defects: hydrateDefectsFromTowReason((stored.defects ?? []).join(', ')),
  }
}

const ISRAEL_TZ = 'Asia/Jerusalem'
const MS_PER_DAY = 24 * 60 * 60 * 1000

const israelDatePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ISRAEL_TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

/** Israel-local calendar Y/M/D as a UTC midnight Date for day-diff math (DST-safe). */
function toIsraelCalendarDay(date: Date): Date {
  const parts = israelDatePartsFormatter.formatToParts(date)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Whole calendar days in Asia/Jerusalem between last_stored_at and now.
 * Returns null when the timestamp is missing/invalid.
 */
export function getStorageCalendarDays(
  lastStoredAt: string | Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (lastStoredAt == null || lastStoredAt === '') return null
  const storedAt = lastStoredAt instanceof Date ? lastStoredAt : new Date(lastStoredAt)
  if (Number.isNaN(storedAt.getTime())) return null

  const storedDay = toIsraelCalendarDay(storedAt)
  const today = toIsraelCalendarDay(now)
  return Math.max(
    0,
    Math.round((today.getTime() - storedDay.getTime()) / MS_PER_DAY)
  )
}

/**
 * Hebrew "time in storage" label from last_stored_at → now.
 * Counts whole calendar days in Asia/Jerusalem (not absolute 24h spans).
 * Returns null when the timestamp is missing/invalid.
 */
export function formatTimeInStorageHebrew(
  lastStoredAt: string | Date | null | undefined,
  now: Date = new Date()
): string | null {
  const days = getStorageCalendarDays(lastStoredAt, now)
  if (days == null) return null

  if (days < 1) return 'באחסנה היום'
  if (days === 1) return 'באחסנה יום'
  if (days <= 30) return `באחסנה ${days} ימים`

  const months = Math.max(1, Math.round(days / 30))
  if (months === 1) return 'באחסנה חודש'
  return `באחסנה ${months} חודשים`
}
