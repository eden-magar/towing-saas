/** Convert stored "YYYY-MM-DD" to display "DD/MM/YYYY". */
export function yyyyMmDdToDisplay(value: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

/** Strip to at most 8 digit characters for live DD/MM/YYYY entry. */
export function extractDateDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 8)
}

/** Extract DDMMYYYY digits from stored "YYYY-MM-DD". */
export function extractDateDigitsFromYyyyMmDd(value: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const [y, m, d] = value.split('-')
  return `${d}${m}${y}`
}

/** Live display while typing: 0610→"06/10/", 06102026→"06/10/2026". */
export function formatDateDigitsLive(digits: string): string {
  const d = digits.slice(0, 8)
  if (d.length === 0) return ''
  if (d.length <= 2) return d.length === 2 ? `${d}/` : d
  if (d.length <= 4) {
    return d.length === 4 ? `${d.slice(0, 2)}/${d.slice(2)}/` : `${d.slice(0, 2)}/${d.slice(2)}`
  }
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

function buildYyyyMmDd(day: number, month: number, year: number): { ok: true; value: string } | { ok: false } {
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 1000 ||
    year > 9999
  ) {
    return { ok: false }
  }

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { ok: false }
  }

  return {
    ok: true,
    value: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  }
}

/** Normalize typed / pasted input into stored "YYYY-MM-DD". */
export function normalizeDateInput(
  raw: string,
): { ok: true; value: string } | { ok: false } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: '' }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    return buildYyyyMmDd(
      parseInt(slashMatch[1], 10),
      parseInt(slashMatch[2], 10),
      parseInt(slashMatch[3], 10),
    )
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 8) {
    return buildYyyyMmDd(
      parseInt(digits.slice(0, 2), 10),
      parseInt(digits.slice(2, 4), 10),
      parseInt(digits.slice(4, 8), 10),
    )
  }

  return { ok: false }
}

export function formatTodayYyyyMmDd(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function yyyyMmDdToDate(value: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function dateToYyyyMmDd(date: Date): string {
  return formatTodayYyyyMmDd(date)
}
