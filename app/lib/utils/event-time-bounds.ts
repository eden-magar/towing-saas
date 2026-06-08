const ONE_HOUR_MS = 60 * 60 * 1000

export interface EventTimeBoundsInput {
  event_date: string | null
  start_time: string | null
  end_time: string | null
}

export interface EventTimeBounds {
  startMs: number
  endMs: number
}

function normalizeTimePart(time: string | null | undefined): string | null {
  if (!time?.trim()) return null
  const parts = time.trim().split(':')
  if (parts.length < 2) return null
  const hours = parts[0].padStart(2, '0')
  const minutes = parts[1].padStart(2, '0')
  return `${hours}:${minutes}`
}

/** Build local start/end ms from event_date (YYYY-MM-DD) + HH:MM times. */
export function getEventTimeBounds(event: EventTimeBoundsInput): EventTimeBounds | null {
  if (!event.event_date?.trim()) return null

  const startTime = normalizeTimePart(event.start_time)
  if (!startTime) return null

  const datePart = event.event_date.includes('T')
    ? event.event_date.split('T')[0]
    : event.event_date.trim()

  const startMs = new Date(`${datePart}T${startTime}:00`).getTime()
  if (!Number.isFinite(startMs)) return null

  const endTime = normalizeTimePart(event.end_time)
  let endMs: number

  if (endTime) {
    endMs = new Date(`${datePart}T${endTime}:00`).getTime()
    if (!Number.isFinite(endMs) || endMs <= startMs) {
      endMs = startMs + ONE_HOUR_MS
    }
  } else {
    endMs = startMs + ONE_HOUR_MS
  }

  return { startMs, endMs }
}
