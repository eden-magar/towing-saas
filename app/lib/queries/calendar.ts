import { supabase } from '../supabase'
import { TowWithDetails, TowVehicle, TowLeg } from './tows'

// ==================== שליפת גרירות ליומן ====================

export async function getCalendarTows(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<TowWithDetails[]> {
  console.log('=== getCalendarTows DEBUG ===')
  console.log('companyId:', companyId)
  console.log('startDate:', startDate.toISOString())
  console.log('endDate:', endDate.toISOString())

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
      driver:drivers (
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
    console.error('Error fetching calendar tows:', error)
    throw error
  }

  console.log('All tows from DB:', allTows?.length || 0)
  allTows?.forEach(t => {
    console.log(`Tow ${t.id}: scheduled_at=${t.scheduled_at}, created_at=${t.created_at}`)
  })

  if (!allTows || allTows.length === 0) return []

  // סינון בצד הקליינט
  const tows = allTows.filter(tow => {
    const towDate = new Date(tow.scheduled_at || tow.created_at)
    const inRange = towDate >= startDate && towDate <= endDate
    console.log(`Tow ${tow.id}: towDate=${towDate.toISOString()}, inRange=${inRange}`)
    return inRange
  })

  console.log('Filtered tows:', tows.length)

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
  driverId?: string
) {
  const updates: Record<string, any> = {
    scheduled_at: scheduledAt.toISOString()
  }

  if (driverId) {
    updates.driver_id = driverId
    updates.status = 'assigned'
  }

  const { error } = await supabase
    .from('tows')
    .update(updates)
    .eq('id', towId)

  if (error) {
    console.error('Error updating tow schedule:', error)
    throw error
  }

  return true
}