import { supabase } from '../supabase'
import { TowWithDetails, TowVehicle, TowLeg } from './tows'

// ==================== טיפוסים ====================

export interface DashboardStats {
  towsToday: number
  pendingTows: number
  completedToday: number
  availableDrivers: number
  inProgressTows: number
  todayRevenue: number
}

type DashboardTowVehicleSummary = Pick<TowVehicle, 'id' | 'tow_id' | 'plate_number' | 'order_index'>
type DashboardTowLegSummary = Pick<TowLeg, 'id' | 'tow_id' | 'leg_order' | 'from_address' | 'to_address'>

// ==================== סטטיסטיקות ====================

export async function getDashboardStats(companyId: string): Promise<DashboardStats> {
  const today = new Date().toISOString().split('T')[0]

  const [
    towsTodayRes,
    pendingTowsRes,
    completedTodayRes,
    availableDriversRes,
    inProgressTowsRes,
    todayRevenueRes,
  ] = await Promise.all([
    // גרירות היום (כל הסטטוסים מלבד cancelled)
    supabase
      .from('tows')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', `${today}T00:00:00`)
      .neq('status', 'cancelled'),
    // ממתינות לשיבוץ
    supabase
      .from('tows')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'pending'),
    // הושלמו היום
    supabase
      .from('tows')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('completed_at', `${today}T00:00:00`),
    // נהגים זמינים
    supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'available'),
    // בביצוע
    supabase
      .from('tows')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'in_progress'),
    // הכנסות היום
    supabase
      .from('tows')
      .select('final_price')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('completed_at', `${today}T00:00:00Z`)
      .lt('completed_at', `${today}T23:59:59Z`),
  ])

  const todayRevenue =
    todayRevenueRes.data?.reduce((sum, row) => sum + (row.final_price || 0), 0) ?? 0

  return {
    towsToday: towsTodayRes.count || 0,
    pendingTows: pendingTowsRes.count || 0,
    completedToday: completedTodayRes.count || 0,
    availableDrivers: availableDriversRes.count || 0,
    inProgressTows: inProgressTowsRes.count || 0,
    todayRevenue,
  }
}

// ==================== גרירות אחרונות ====================

export async function getRecentTows(companyId: string, limit: number = 5): Promise<TowWithDetails[]> {
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
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent tows:', error)
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
  const vehiclesByTow: Record<string, DashboardTowVehicleSummary[]> = {}
  vehicles?.forEach(v => {
    if (!vehiclesByTow[v.tow_id]) vehiclesByTow[v.tow_id] = []
    vehiclesByTow[v.tow_id].push(v)
  })

  const legsByTow: Record<string, DashboardTowLegSummary[]> = {}
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

/**
 * Pending tows that have not been assigned to a driver yet.
 * Used by the dashboard "ממתינות לשיבוץ" panel.
 */
export async function getPendingUnassignedTows(companyId: string): Promise<TowWithDetails[]> {
  const { data: tows, error } = await supabase
    .from('tows')
    .select(`
      id,
      status,
      order_number,
      created_at,
      scheduled_at,
      final_price,
      customer:customers (
        id,
        name,
        phone
      )
    `)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .is('driver_id', null)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('Error fetching pending unassigned tows:', error)
    return []
  }

  if (!tows || tows.length === 0) return []

  const towIds = tows.map(t => t.id)

  const [vehiclesRes, legsRes] = await Promise.all([
    supabase
      .from('tow_vehicles')
      .select('id, tow_id, plate_number, order_index')
      .in('tow_id', towIds)
      .order('order_index', { ascending: true }),
    supabase
      .from('tow_legs')
      .select('id, tow_id, leg_order, from_address, to_address')
      .in('tow_id', towIds)
      .order('leg_order', { ascending: true }),
  ])

  const vehiclesByTow: Record<string, DashboardTowVehicleSummary[]> = {}
  vehiclesRes.data?.forEach(v => {
    if (!vehiclesByTow[v.tow_id]) vehiclesByTow[v.tow_id] = []
    vehiclesByTow[v.tow_id].push(v)
  })

  const legsByTow: Record<string, DashboardTowLegSummary[]> = {}
  legsRes.data?.forEach(l => {
    if (!legsByTow[l.tow_id]) legsByTow[l.tow_id] = []
    legsByTow[l.tow_id].push(l)
  })

  return tows.map(tow => ({
    ...tow,
    customer: tow.customer as any,
    driver: null,
    truck: null,
    vehicles: (vehiclesByTow[tow.id] || []) as unknown as TowVehicle[],
    legs: (legsByTow[tow.id] || []) as unknown as TowLeg[],
  })) as unknown as TowWithDetails[]
}

/**
 * Tows in 'quote' status (price proposals not yet confirmed).
 * Used by the dashboard quotes panel.
 * Ordered oldest first so stale quotes are visible at the top.
 */
export async function getQuoteTows(companyId: string): Promise<TowWithDetails[]> {
  const { data: tows, error } = await supabase
    .from('tows')
    .select(`
      id,
      status,
      order_number,
      created_at,
      scheduled_at,
      final_price,
      customer:customers (
        id,
        name,
        phone
      )
    `)
    .eq('company_id', companyId)
    .eq('status', 'quote')
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('Error fetching quote tows:', error)
    return []
  }

  if (!tows || tows.length === 0) return []

  const towIds = tows.map(t => t.id)

  const [vehiclesRes, legsRes] = await Promise.all([
    supabase
      .from('tow_vehicles')
      .select('id, tow_id, plate_number, order_index')
      .in('tow_id', towIds)
      .order('order_index', { ascending: true }),
    supabase
      .from('tow_legs')
      .select('id, tow_id, leg_order, from_address, to_address')
      .in('tow_id', towIds)
      .order('leg_order', { ascending: true }),
  ])

  const vehiclesByTow: Record<string, DashboardTowVehicleSummary[]> = {}
  vehiclesRes.data?.forEach(v => {
    if (!vehiclesByTow[v.tow_id]) vehiclesByTow[v.tow_id] = []
    vehiclesByTow[v.tow_id].push(v)
  })

  const legsByTow: Record<string, DashboardTowLegSummary[]> = {}
  legsRes.data?.forEach(l => {
    if (!legsByTow[l.tow_id]) legsByTow[l.tow_id] = []
    legsByTow[l.tow_id].push(l)
  })

  return tows.map(tow => ({
    ...tow,
    customer: tow.customer as any,
    driver: null,
    truck: null,
    vehicles: (vehiclesByTow[tow.id] || []) as unknown as TowVehicle[],
    legs: (legsByTow[tow.id] || []) as unknown as TowLeg[],
  })) as unknown as TowWithDetails[]
}

/**
 * Count of open tows (assigned + in_progress) per driver, for a company.
 * Used by the dashboard overtime panel.
 * Returns a map: driver_id -> count.
 */
export async function getOpenTowsCountByDriver(companyId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('tows')
    .select('driver_id')
    .eq('company_id', companyId)
    .in('status', ['assigned', 'in_progress'])
    .not('driver_id', 'is', null)

  if (error) {
    console.error('Error fetching open tows count by driver:', error)
    return {}
  }

  const counts: Record<string, number> = {}
  for (const row of data || []) {
    if (row.driver_id) {
      counts[row.driver_id] = (counts[row.driver_id] || 0) + 1
    }
  }
  return counts
}