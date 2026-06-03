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
