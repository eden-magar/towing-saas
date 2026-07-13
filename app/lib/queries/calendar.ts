import { supabase } from '../supabase'
import { TowWithDetails, TowVehicle, TowLeg } from './tows'
import { insertDriverTruckAssignments, driverHasCurrentAssignment } from './driver-truck-assignments'
import {
  getEffectiveTowStartIso,
  getTowTimeBounds,
  type TowTimeBoundsInput,
} from '../utils/tow-time-bounds'

type CalendarTowVehicleSummary = Pick<TowVehicle, 'id' | 'tow_id' | 'plate_number' | 'order_index'>
type CalendarTowLegSummary = Pick<TowLeg, 'id' | 'tow_id' | 'leg_order' | 'from_address' | 'to_address'>

// ==================== שליפת גרירות ליומן ====================

export async function getCalendarTows(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<TowWithDetails[]> {
  const startIso = startDate.toISOString()
  const endIso = endDate.toISOString()

  const towSelect = `
      id,
      status,
      order_number,
      driver_id,
      created_at,
      scheduled_at,
      scheduled_end_at,
      started_at,
      completed_at,
      final_price,
      price_mode,
      price_breakdown,
      customer:customers (
        id,
        name,
        phone
      )
    `

  // Prefer chained .gte/.lte over an unquoted .or() with ISO timestamps
  // (dots in "…00.000Z" can break PostgREST filter parsing).
  const [scheduledRes, unscheduledRes] = await Promise.all([
    supabase
      .from('tows')
      .select(towSelect)
      .eq('company_id', companyId)
      .neq('status', 'cancelled')
      .gte('scheduled_at', startIso)
      .lte('scheduled_at', endIso)
      .order('created_at', { ascending: false }),
    supabase
      .from('tows')
      .select(towSelect)
      .eq('company_id', companyId)
      .neq('status', 'cancelled')
      .is('scheduled_at', null)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false }),
  ])

  if (scheduledRes.error) {
    console.error('Error fetching calendar tows (scheduled):', JSON.stringify(scheduledRes.error), scheduledRes.error)
    throw scheduledRes.error
  }
  if (unscheduledRes.error) {
    console.error('Error fetching calendar tows (unscheduled):', JSON.stringify(unscheduledRes.error), unscheduledRes.error)
    throw unscheduledRes.error
  }

  const byId = new Map<string, (typeof scheduledRes.data)[number]>()
  for (const tow of [...(scheduledRes.data ?? []), ...(unscheduledRes.data ?? [])]) {
    byId.set(tow.id, tow)
  }
  const tows = [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  if (tows.length === 0) return []

  // שליפת כלי רכב
  const towIds = tows.map(t => t.id)
  
  const { data: vehicles } = await supabase
    .from('tow_vehicles')
    .select('id, tow_id, plate_number, order_index')
    .in('tow_id', towIds)
    .order('order_index', { ascending: true })

  // שליפת רגליים
  const { data: legs } = await supabase
    .from('tow_legs')
    .select('id, tow_id, leg_order, from_address, to_address')
    .in('tow_id', towIds)
    .order('leg_order', { ascending: true })

  // מיפוי לפי tow_id
  const vehiclesByTow: Record<string, CalendarTowVehicleSummary[]> = {}
  vehicles?.forEach(v => {
    if (!vehiclesByTow[v.tow_id]) vehiclesByTow[v.tow_id] = []
    vehiclesByTow[v.tow_id].push(v)
  })

  const legsByTow: Record<string, CalendarTowLegSummary[]> = {}
  legs?.forEach(l => {
    if (!legsByTow[l.tow_id]) legsByTow[l.tow_id] = []
    legsByTow[l.tow_id].push(l)
  })

  return tows.map(tow => ({
    ...tow,
    customer: tow.customer as any,
    driver: null,
    truck: null,
    vehicles: (vehiclesByTow[tow.id] || []) as unknown as TowVehicle[],
    legs: (legsByTow[tow.id] || []) as unknown as TowLeg[]
  })) as unknown as TowWithDetails[]
}

// ==================== שליפת גרירות לשבוע ====================

export async function getWeekTows(companyId: string, weekStart: Date): Promise<TowWithDetails[]> {
  const startOfWeek = new Date(weekStart)
  startOfWeek.setHours(0, 0, 0, 0)
  
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 7)
  endOfWeek.setHours(23, 59, 59, 999)

  return getCalendarTows(companyId, startOfWeek, endOfWeek)
}

// ==================== שליפת גרירות ליום ====================

export async function getDayTows(companyId: string, date: Date): Promise<TowWithDetails[]> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  return getCalendarTows(companyId, startOfDay, endOfDay)
}

/**
 * Like getDayTows, but widens the fetch to also include the previous day so
 * that midnight-crossing tows (scheduled the day before, continuing into
 * `date`) are available for client-side day-overlap filtering via
 * towOverlapsCalendarDay. Mirrors how the main calendar fetches a wide range
 * (a whole week) and filters per-day in the component. Kept separate from
 * getDayTows so its other callers (single-day pickers that position by start
 * hour) are not affected.
 */
export async function getDayTowsWithPrevDay(companyId: string, date: Date): Promise<TowWithDetails[]> {
  const rangeStart = new Date(date)
  rangeStart.setDate(rangeStart.getDate() - 1)
  rangeStart.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  return getCalendarTows(companyId, rangeStart, endOfDay)
}

// ==================== חיפוש גרירות (כל התאריכים) ====================

export interface CalendarTowSearchHit {
  id: string
  customer_name: string | null
  scheduled_at: string | null
  plate: string | null
  driver_name: string | null
  status: string
  order_number: string | null
  customer_order_number: string | null
  /** Legacy first/last leg addresses from search RPC — prefer tow_points for full route. */
  pickup_address: string | null
  dropoff_address: string | null
  time_range_label: string
  /** Local calendar day for navigation (midnight). */
  scheduled_date: Date
}

/** Slim tow_points row for calendar popups (fetched on open, not in the week grid query). */
export type CalendarTowRoutePoint = {
  id: string
  point_order: number
  point_type: string
  address: string | null
  stop_subtype: string | null
}

/** Load ordered route points for a single tow — use when a calendar popup opens. */
export async function getCalendarTowRoutePoints(
  towId: string
): Promise<CalendarTowRoutePoint[]> {
  const { data, error } = await supabase
    .from('tow_points')
    .select('id, point_order, point_type, address, stop_subtype')
    .eq('tow_id', towId)
    .order('point_order', { ascending: true })

  if (error) {
    console.error('Error fetching calendar tow route points:', error)
    throw error
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    point_order: row.point_order,
    point_type: row.point_type,
    address: row.address ?? null,
    stop_subtype: row.stop_subtype ?? null,
  }))
}

function formatSearchTimeRange(tow: TowTimeBoundsInput, now: number): string {
  const { startMs, endMs } = getTowTimeBounds(tow, now)
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  const start = new Date(startMs).toLocaleTimeString('he-IL', timeOpts)
  const end = new Date(endMs).toLocaleTimeString('he-IL', timeOpts)
  return `${start}–${end}`
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

type SearchCalendarTowsRow = {
  id: string
  customer_name: string | null
  scheduled_at: string | null
  scheduled_end_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  status: string
  plate: string | null
  driver_name: string | null
  order_number: string | null
  customer_order_number: string | null
  pickup_address: string | null
  dropoff_address: string | null
}

/** Company-scoped global calendar search via search_calendar_tows RPC (single round-trip). */
export async function searchTows(
  companyId: string,
  query: string,
  limit = 50
): Promise<CalendarTowSearchHit[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const { data, error } = await supabase.rpc('search_calendar_tows', {
    p_company_id: companyId,
    p_query: trimmed,
    p_limit: limit,
  })

  if (error) {
    console.error('Error searching calendar tows:', error)
    throw error
  }

  const rows = (data ?? []) as SearchCalendarTowsRow[]
  if (rows.length === 0) return []

  const now = Date.now()

  return rows.map((row) => {
    const towInput: TowTimeBoundsInput = {
      status: row.status,
      scheduled_at: row.scheduled_at,
      scheduled_end_at: row.scheduled_end_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      created_at: row.created_at,
    }
    const startIso = getEffectiveTowStartIso(towInput)

    return {
      id: row.id,
      customer_name: row.customer_name ?? null,
      scheduled_at: row.scheduled_at,
      plate: row.plate ?? null,
      driver_name: row.driver_name ?? null,
      status: row.status,
      order_number: row.order_number ?? null,
      customer_order_number: row.customer_order_number ?? null,
      pickup_address: row.pickup_address ?? null,
      dropoff_address: row.dropoff_address ?? null,
      time_range_label: formatSearchTimeRange(towInput, now),
      scheduled_date: startOfLocalDay(new Date(startIso)),
    }
  })
}

// ==================== עדכון זמן מתוזמן ====================

export async function updateTowSchedule(
  towId: string,
  scheduledAt: Date,
  driverId?: string,
  truckId?: string
) {
  const updates: Record<string, any> = {
    scheduled_at: scheduledAt.toISOString()
  }

  if (driverId) {
    updates.driver_id = driverId
    updates.status = 'assigned'
    if (truckId) {
      updates.truck_id = truckId
    }
  }

  const { error } = await supabase
    .from('tows')
    .update(updates)
    .eq('id', towId)

  if (error) {
    console.error('Error updating tow schedule:', error)
    throw error
  }

  if (driverId && truckId) {
    try {
      // Only seed a permanent assignment if the driver has none yet.
      // insertDriverTruckAssignments is idempotent against the unique index,
      // so a concurrent seed is a benign no-op rather than a thrown error.
      if (!(await driverHasCurrentAssignment(driverId))) {
        await insertDriverTruckAssignments(driverId, [truckId])
      }
    } catch (err) {
      console.error('Failed to check/create driver-truck assignment:', err)
    }
  }

  return true
}
