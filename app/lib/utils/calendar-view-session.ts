export const CALENDAR_WEEK_START_SESSION_KEY = 'calendarWeekStart'
export const CALENDAR_SELECTED_DATE_SESSION_KEY = 'calendarSelectedDate'
export const CALENDAR_VIEW_SESSION_KEY = 'calendarView'

export type CalendarViewMode = 'week' | 'day'

export type CalendarViewSnapshot = {
  weekStart: Date
  selectedDate: Date
  view: CalendarViewMode
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
  sessionStorage.setItem(CALENDAR_WEEK_START_SESSION_KEY, snapshot.weekStart.toISOString())
  sessionStorage.setItem(CALENDAR_SELECTED_DATE_SESSION_KEY, snapshot.selectedDate.toISOString())
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

  const weekStart = new Date(weekStartRaw)
  const selectedDate = new Date(selectedDateRaw)
  if (Number.isNaN(weekStart.getTime()) || Number.isNaN(selectedDate.getTime())) {
    clearCalendarViewSession()
    return null
  }

  weekStart.setHours(0, 0, 0, 0)
  selectedDate.setHours(0, 0, 0, 0)
  clearCalendarViewSession()

  return { weekStart, selectedDate, view: viewRaw }
}
