export const CALENDAR_WEEK_START_SESSION_KEY = 'calendarWeekStart'
export const CALENDAR_SELECTED_DATE_SESSION_KEY = 'calendarSelectedDate'
export const CALENDAR_VIEW_SESSION_KEY = 'calendarView'

export type CalendarViewMode = 'week' | 'day'

export type CalendarViewSnapshot = {
  weekStart: Date
  selectedDate: Date
  view: CalendarViewMode
}

/** Local calendar day as YYYY-MM-DD (avoids UTC day-shift via toISOString). */
export function toLocalYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse YYYY-MM-DD as local midnight. Also accepts legacy ISO strings. */
export function fromLocalYmdOrIso(raw: string): Date | null {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
  if (ymd) {
    const year = Number(ymd[1])
    const month = Number(ymd[2])
    const day = Number(ymd[3])
    const d = new Date(year, month - 1, day)
    d.setHours(0, 0, 0, 0)
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return null
    }
    return d
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

/** Same week-start rule as app/dashboard/calendar/page.tsx (Sunday-based local week). */
export function getCalendarWeekStartForDate(date: Date): Date {
  const weekStart = new Date(date)
  const day = weekStart.getDay()
  const diff = weekStart.getDate() - day
  weekStart.setDate(diff)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

export function buildCalendarViewSnapshotForScheduledDate(
  scheduledDate: Date,
  view: CalendarViewMode = 'day'
): CalendarViewSnapshot {
  const selectedDate = new Date(scheduledDate)
  selectedDate.setHours(0, 0, 0, 0)
  return {
    weekStart: getCalendarWeekStartForDate(selectedDate),
    selectedDate,
    view,
  }
}

function clearCalendarViewSession(): void {
  sessionStorage.removeItem(CALENDAR_WEEK_START_SESSION_KEY)
  sessionStorage.removeItem(CALENDAR_SELECTED_DATE_SESSION_KEY)
  sessionStorage.removeItem(CALENDAR_VIEW_SESSION_KEY)
}

export function persistCalendarViewForReturn(snapshot: CalendarViewSnapshot): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(CALENDAR_WEEK_START_SESSION_KEY, toLocalYmd(snapshot.weekStart))
  sessionStorage.setItem(CALENDAR_SELECTED_DATE_SESSION_KEY, toLocalYmd(snapshot.selectedDate))
  sessionStorage.setItem(CALENDAR_VIEW_SESSION_KEY, snapshot.view)
}

/** Read saved calendar view once, then clear keys so unrelated visits use defaults. */
export function consumeRestoredCalendarView(): CalendarViewSnapshot | null {
  if (typeof window === 'undefined') return null

  const weekStartRaw = sessionStorage.getItem(CALENDAR_WEEK_START_SESSION_KEY)
  const selectedDateRaw = sessionStorage.getItem(CALENDAR_SELECTED_DATE_SESSION_KEY)
  const viewRaw = sessionStorage.getItem(CALENDAR_VIEW_SESSION_KEY)

  if (!weekStartRaw || !selectedDateRaw || !viewRaw) return null
  if (viewRaw !== 'week' && viewRaw !== 'day') {
    clearCalendarViewSession()
    return null
  }

  const weekStart = fromLocalYmdOrIso(weekStartRaw)
  const selectedDate = fromLocalYmdOrIso(selectedDateRaw)
  if (!weekStart || !selectedDate) {
    clearCalendarViewSession()
    return null
  }

  clearCalendarViewSession()

  return { weekStart, selectedDate, view: viewRaw }
}
