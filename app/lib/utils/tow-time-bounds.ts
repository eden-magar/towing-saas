export interface TowTimeBounds {
  startMs: number
  endMs: number
}

export interface TowTimeBoundsInput {
  status: string
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  scheduled_end_at: string | null
  created_at: string
}

/** Effective calendar start: actual start if the driver began, else scheduled, else created. */
export function getEffectiveTowStartIso(tow: TowTimeBoundsInput): string {
  return tow.started_at || tow.scheduled_at || tow.created_at
}

function endOfDayMs(date: Date): number {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export function startOfCalendarDayMs(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export interface TowDaySegment {
  startMs: number
  endMs: number
  isTopClipped: boolean
  isBottomClipped: boolean
  towStartMs: number
  towEndMs: number
}

/** Whether a tow's time range overlaps a calendar day at all. */
export function towOverlapsCalendarDay(
  tow: TowTimeBoundsInput,
  dayDate: Date,
  now: number,
): boolean {
  const { startMs, endMs } = getTowTimeBounds(tow, now)
  const dayStart = startOfCalendarDayMs(dayDate)
  const dayEnd = endOfDayMs(dayDate)
  return startMs < dayEnd && endMs > dayStart
}

/**
 * Clip a tow's time range to a single calendar day for rendering.
 * Returns null when the tow does not overlap that day.
 */
export function computeDaySegmentForTow(
  tow: TowTimeBoundsInput,
  dayDate: Date,
  now: number,
): TowDaySegment | null {
  const { startMs: towStartMs, endMs: towEndMs } = getTowTimeBounds(tow, now)
  const dayStart = startOfCalendarDayMs(dayDate)
  const dayEnd = endOfDayMs(dayDate)

  if (towStartMs >= dayEnd || towEndMs <= dayStart) {
    return null
  }

  const segmentStartMs = Math.max(towStartMs, dayStart)
  const segmentEndMs = Math.min(towEndMs, dayEnd)

  if (segmentEndMs <= segmentStartMs) {
    return null
  }

  return {
    startMs: segmentStartMs,
    endMs: segmentEndMs,
    isTopClipped: segmentStartMs > towStartMs,
    isBottomClipped: segmentEndMs < towEndMs,
    towStartMs,
    towEndMs,
  }
}

export function towSegmentOverlapKey(towId: string, dayDate: Date): string {
  return `${towId}:${dayDate.toDateString()}`
}

/**
 * Calendar block start/end in epoch ms.
 *
 * @example assigned tow 10:00, no end → block ends 11:00 (scheduled + 1h)
 * @example in_progress with clampEndToDay → end capped at min(now, that day's 23:59:59)
 * @example completed_at set → end follows completed_at regardless of scheduled_end_at
 */
export function getTowTimeBounds(
  tow: TowTimeBoundsInput,
  now: number,
  options?: { clampEndToDay?: Date }
): TowTimeBounds {
  const startIso = getEffectiveTowStartIso(tow)
  const startMs = new Date(startIso).getTime()

  let endMs: number

  if (tow.completed_at) {
    endMs = new Date(tow.completed_at).getTime()
  } else if (tow.scheduled_end_at) {
    endMs = new Date(tow.scheduled_end_at).getTime()
  } else if (tow.status === 'in_progress') {
    const clampDay = options?.clampEndToDay ?? new Date(startMs)
    endMs = Math.min(now, endOfDayMs(clampDay))
  } else if (tow.status === 'assigned') {
    const scheduledMs = tow.scheduled_at
      ? new Date(tow.scheduled_at).getTime()
      : startMs
    endMs = scheduledMs + 60 * 60 * 1000
  } else {
    endMs = startMs + 60 * 60 * 1000
  }

  endMs = Math.max(endMs, startMs + 30 * 60 * 1000)

  return { startMs, endMs }
}
