/** Normalize fast numeric / typed time into 24h "HH:mm". */
export function normalizeTimeInput(
  raw: string,
): { ok: true; value: string } | { ok: false } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: '' }

  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{1,2})$/)
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10)
    const m = parseInt(colonMatch[2], 10)
    if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) {
      return { ok: false }
    }
    return {
      ok: true,
      value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    }
  }

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return { ok: true, value: '' }

  let h: number
  let m: number

  if (digits.length <= 2) {
    h = parseInt(digits, 10)
    m = 0
  } else if (digits.length === 3) {
    h = parseInt(digits[0], 10)
    m = parseInt(digits.slice(1), 10)
  } else if (digits.length === 4) {
    h = parseInt(digits.slice(0, 2), 10)
    m = parseInt(digits.slice(2), 10)
  } else {
    return { ok: false }
  }

  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) {
    return { ok: false }
  }

  return {
    ok: true,
    value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  }
}

/** Strip to at most 4 digit characters for live HH:mm entry. */
export function extractTimeDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4)
}

/** Live display while typing: 1→"1", 2→"14:", 3→"14:3", 4→"14:30". */
export function formatTimeDigitsLive(digits: string): string {
  const d = digits.slice(0, 4)
  if (d.length === 0) return ''
  if (d.length === 1) return d
  if (d.length === 2) return `${d}:`
  if (d.length === 3) return `${d.slice(0, 2)}:${d.slice(2)}`
  return `${d.slice(0, 2)}:${d.slice(2, 4)}`
}

export function formatNowTimeHHmm(date: Date = new Date()): string {
  const h = date.getHours()
  const m = date.getMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
