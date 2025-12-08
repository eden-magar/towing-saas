import { supabase } from '../supabase'
import { TowWithDetails, TowVehicle, TowLeg } from './tows'

// ==================== טיפוסים ====================

export interface DashboardStats {
  towsToday: number
  pendingTows: number
  completedToday: number
  availableDrivers: number
}

// ==================== סטטיסטיקות ====================

export async function getDashboardStats(companyId: string): Promise<DashboardStats> {
  const today = new Date().toISOString().split('T')[0]
  
  // גרירות היום (כל הסטטוסים מלבד cancelled)
  const { count: towsToday } = await supabase
    .from('tows')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', `${today}T00:00:00`)
    .neq('status', 'cancelled')

  // ממתינות לשיבוץ
  const { count: pendingTows } = await supabase
    .from('tows')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'pending')

  // הושלמו היום
  const { count: completedToday } = await supabase
    .from('tows')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('completed_at', `${today}T00:00:00`)

  // נהגים זמינים
  const { count: availableDrivers } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'available')

  return {
    towsToday: towsToday || 0,
    pendingTows: pendingTows || 0,
    completedToday: completedToday || 0,
    availableDrivers: availableDrivers || 0
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