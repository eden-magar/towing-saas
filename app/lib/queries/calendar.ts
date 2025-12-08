import { supabase } from '../supabase'
import { TowWithDetails, TowVehicle, TowLeg } from './tows'

// ==================== שליפת גרירות ליומן ====================

export async function getCalendarTows(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<TowWithDetails[]> {
  // פורמט תאריכים ל-ISO
  const startISO = startDate.toISOString()
  const endISO = endDate.toISOString()

  const { data: tows, error } = await supabase
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
    .or(`scheduled_at.gte.${startISO},created_at.gte.${startISO}`)
    .or(`scheduled_at.lte.${endISO},created_at.lte.${endISO}`)
    .order('scheduled_at', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching calendar tows:', error)
    throw error
  }

  if (!tows || tows.length === 0) return []

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