import { supabase } from '../supabase'
import { TowWithDetails, TowVehicle, TowLeg } from './tows'
import { insertDriverTruckAssignments, driverHasCurrentAssignment } from './driver-truck-assignments'

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

  const { data: tows, error } = await supabase
    .from('tows')
    .select(`
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
    `)
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .or(
      `and(scheduled_at.gte.${startIso},scheduled_at.lte.${endIso}),` +
        `and(scheduled_at.is.null,created_at.gte.${startIso},created_at.lte.${endIso})`
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching calendar tows:', JSON.stringify(error), error)
    throw error
  }

  if (!tows || tows.length === 0) return []

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
