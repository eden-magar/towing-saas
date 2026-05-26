import { supabase } from '../supabase'
import { TowWithDetails, TowVehicle, TowLeg } from './tows'
import { insertDriverTruckAssignments } from './driver-truck-assignments'

// ==================== שליפת גרירות ליומן ====================

export async function getCalendarTows(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<TowWithDetails[]> {
  // שאילתה פשוטה - מביאה את כל הגרירות של החברה
  const { data: allTows, error } = await supabase
    .from('tows')
    .select(`
      *,
      customer:customers (
        id,
        name,
        phone
      ),
      driver:drivers!tows_driver_id_fkey (
        id,
        user:users!drivers_user_id_fkey (
          full_name,
          phone
        )
      ),
      truck:tow_trucks (
        id,
        plate_number
      )
    `)
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching calendar tows:', JSON.stringify(error), error)
    throw error
  }

  if (!allTows || allTows.length === 0) return []

  // סינון בצד הקליינט
  const tows = allTows.filter(tow => {
    const towDate = new Date(tow.scheduled_at || tow.created_at)
    const inRange = towDate >= startDate && towDate <= endDate
    return inRange
  })

  if (tows.length === 0) return []

  // שליפת כלי רכב
  const towIds = tows.map(t => t.id)
  
  const { data: vehicles } = await supabase
    .from('tow_vehicles')
    .select('*')
    .in('tow_id', towIds)
    .order('order_index', { ascending: true })

  // שליפת רגליים
  const { data: legs } = await supabase
    .from('tow_legs')
    .select('*')
    .in('tow_id', towIds)
    .order('leg_order', { ascending: true })

  // מיפוי לפי tow_id
  const vehiclesByTow: Record<string, TowVehicle[]> = {}
  vehicles?.forEach(v => {
    if (!vehiclesByTow[v.tow_id]) vehiclesByTow[v.tow_id] = []
    vehiclesByTow[v.tow_id].push(v)
  })

  const legsByTow: Record<string, TowLeg[]> = {}
  legs?.forEach(l => {
    if (!legsByTow[l.tow_id]) legsByTow[l.tow_id] = []
    legsByTow[l.tow_id].push(l)
  })

  return tows.map(tow => ({
    ...tow,
    customer: tow.customer as any,
    driver: tow.driver as any,
    truck: tow.truck as any,
    vehicles: vehiclesByTow[tow.id] || [],
    legs: legsByTow[tow.id] || []
  }))
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
      const { data: existing } = await supabase
        .from('driver_truck_assignments')
        .select('id')
        .eq('driver_id', driverId)
        .eq('is_current', true)
        .limit(1)

      if (!existing || existing.length === 0) {
        await insertDriverTruckAssignments(driverId, [truckId])
      }
    } catch (err) {
      console.error('Failed to check/create driver-truck assignment:', err)
    }
  }

  return true
}
