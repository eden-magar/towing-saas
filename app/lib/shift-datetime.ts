export const JERUSALEM_TZ = 'Asia/Jerusalem'

export const END_SHIFT_MINUTE_VALUES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const
export const END_SHIFT_HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i)

export function getJerusalemDateStr(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: JERUSALEM_TZ })
}

export function getJerusalemTimeParts(date: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: JERUSALEM_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  return {
    hour: parseInt(parts.find(p => p.type === 'hour')!.value, 10),
    minute: parseInt(parts.find(p => p.type === 'minute')!.value, 10),
  }
}

export function snapMinuteToFive(m: number): number {
  return Math.min(55, Math.max(0, Math.round(m / 5) * 5))
}

function roundToNearest15Min(hour: number, minute: number): { hour: number; minute: number } {
  const total = hour * 60 + minute
  const rounded = Math.round(total / 15) * 15
  return {
    hour: Math.floor(rounded / 60) % 24,
    minute: rounded % 60,
  }
}

function parseWorkHoursEnd(value: string | null | undefined): { hour: number; minute: number } | null {
  if (!value) return null
  const [h, m] = value.slice(0, 5).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return { hour: h, minute: snapMinuteToFive(m) }
}

export function computeEndShiftDefaults(startedAt: string, workHoursEnd: string | null) {
  const startDateStr = getJerusalemDateStr(new Date(startedAt))
  const todayStr = getJerusalemDateStr(new Date())
  const isToday = startDateStr === todayStr
  const workEnd = parseWorkHoursEnd(workHoursEnd)
  const date = isToday ? todayStr : startDateStr

  if (isToday) {
    if (workEnd) return { date, hour: workEnd.hour, minute: workEnd.minute }
    const { hour, minute } = getJerusalemTimeParts()
    const rounded = roundToNearest15Min(hour, minute)
    return { date, hour: rounded.hour, minute: snapMinuteToFive(rounded.minute) }
  }

  if (workEnd) return { date, hour: workEnd.hour, minute: workEnd.minute }
  return { date, hour: 23, minute: 55 }
}

export function formatEndShiftTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function dateTimeToJerusalemParts(iso: string): { date: string; hour: number; minute: number } {
  const d = new Date(iso)
  const { hour, minute } = getJerusalemTimeParts(d)
  return { date: getJerusalemDateStr(d), hour, minute: snapMinuteToFive(minute) }
}

export function formatShiftStartJerusalem(startedAt: string): string {
  const d = new Date(startedAt)
  const weekday = d.toLocaleDateString('he-IL', { weekday: 'short', timeZone: JERUSALEM_TZ })
  const date = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', timeZone: JERUSALEM_TZ })
  const time = d.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: JERUSALEM_TZ,
    hour12: false,
  })
  return `${weekday} ${date} ${time}`
}

export function formatOpenShiftDuration(startedAt: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(startedAt).getTime())
  const totalHours = Math.floor(diffMs / 3600000)
  if (totalHours < 24) {
    return `פתוחה ${totalHours} שעות`
  }
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (hours === 0) return `פתוחה ${days} ימים`
  return `פתוחה ${days} ימים, ${hours} שעות`
}

export function buildLocalDateTime(date: string, hour: number, minute: number): Date {
  return new Date(`${date}T${formatEndShiftTime(hour, minute)}:00`)
}
