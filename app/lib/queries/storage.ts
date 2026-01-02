import { supabase } from '../supabase'

// ==================== Types ====================

export interface StoredVehicle {
  id: string
  company_id: string
  customer_id: string | null
  plate_number: string
  vehicle_data: {
    manufacturer?: string
    model?: string
    year?: string
    color?: string
    gearType?: string
    driveType?: string
    totalWeight?: string
  } | null
  current_status: 'stored' | 'released'
  location: string | null
  last_stored_at: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StoredVehicleWithCustomer extends StoredVehicle {
  customer_name: string | null
}

export interface StorageHistoryItem {
  id: string
  action: 'in' | 'out'
  tow_id: string | null
  performed_at: string
  performed_by_name: string | null
  notes: string | null
}

// ==================== שליפת רכבים באחסנה ====================

export async function getStoredVehicles(
  companyId: string, 
  customerId?: string | null,
  statusFilter: 'stored' | 'released' | 'all' = 'stored'
): Promise<StoredVehicleWithCustomer[]> {
  let query = supabase
    .from('stored_vehicles')
    .select(`
      *,
      customer:customers!customer_id (
        id,
        name
      )
    `)
    .eq('company_id', companyId)
    .order('last_stored_at', { ascending: false })

  // סינון לפי סטטוס
  if (statusFilter !== 'all') {
    query = query.eq('current_status', statusFilter)
  }

  // סינון לפי לקוח
  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching stored vehicles:', error)
    throw error
  }

  return (data || []).map(item => ({
    ...item,
    customer_name: (item.customer as any)?.name || null
  }))
}

// ==================== חיפוש רכב לפי מספר ====================

export async function searchStoredVehicle(
  companyId: string,
  plateNumber: string
): Promise<StoredVehicleWithCustomer | null> {
  const { data, error } = await supabase
    .from('stored_vehicles')
    .select(`
      *,
      customer:customers!customer_id (
        id,
        name
      )
    `)
    .eq('company_id', companyId)
    .eq('plate_number', plateNumber)
    .maybeSingle()

  if (error) {
    console.error('Error searching stored vehicle:', error)
    throw error
  }

  if (!data) return null

  return {
    ...data,
    customer_name: (data.customer as any)?.name || null
  }
}

// ==================== הכנסת רכב לאחסנה ====================

interface AddToStorageInput {
  companyId: string
  customerId?: string | null
  plateNumber: string
  vehicleData?: StoredVehicle['vehicle_data']
  location?: string
  towId?: string
  performedBy?: string
  notes?: string
}

export async function addVehicleToStorage(input: AddToStorageInput): Promise<string> {
  const { data, error } = await supabase.rpc('add_vehicle_to_storage', {
    p_company_id: input.companyId,
    p_customer_id: input.customerId || null,
    p_plate_number: input.plateNumber,
    p_vehicle_data: input.vehicleData || null,
    p_location: input.location || null,
    p_tow_id: input.towId || null,
    p_performed_by: input.performedBy || null,
    p_notes: input.notes || null
  })

  if (error) {
    console.error('Error adding vehicle to storage:', error)
    throw error
  }

  return data
}

// ==================== שחרור רכב מאחסנה ====================

interface ReleaseFromStorageInput {
  storedVehicleId: string
  towId?: string
  performedBy?: string
  notes?: string
}

export async function releaseVehicleFromStorage(input: ReleaseFromStorageInput): Promise<boolean> {
  const { data, error } = await supabase.rpc('release_vehicle_from_storage', {
    p_stored_vehicle_id: input.storedVehicleId,
    p_tow_id: input.towId || null,
    p_performed_by: input.performedBy || null,
    p_notes: input.notes || null
  })

  if (error) {
    console.error('Error releasing vehicle from storage:', error)
    throw error
  }

  return data
}

// ==================== עדכון פרטי רכב באחסנה ====================

interface UpdateStoredVehicleInput {
  id: string
  customerId?: string | null
  location?: string | null
  notes?: string | null
}

export async function updateStoredVehicle(input: UpdateStoredVehicleInput): Promise<boolean> {
  const { error } = await supabase
    .from('stored_vehicles')
    .update({
      customer_id: input.customerId,
      location: input.location,
      notes: input.notes
    })
    .eq('id', input.id)

  if (error) {
    console.error('Error updating stored vehicle:', error)
    throw error
  }

  return true
}

// ==================== היסטוריית רכב ====================

export async function getVehicleStorageHistory(
  storedVehicleId: string,
  limit: number = 20
): Promise<StorageHistoryItem[]> {
  const { data, error } = await supabase.rpc('get_vehicle_storage_history', {
    p_stored_vehicle_id: storedVehicleId,
    p_limit: limit
  })

  if (error) {
    console.error('Error fetching storage history:', error)
    throw error
  }

  return data || []
}

// ==================== סטטיסטיקות ====================

export async function getStorageStats(companyId: string): Promise<{
  total: number
  stored: number
  released: number
  byCustomer: { customerId: string; customerName: string; count: number }[]
}> {
  // סה"כ רכבים
  const { data: allVehicles, error } = await supabase
    .from('stored_vehicles')
    .select('id, current_status, customer_id, customer:customers!customer_id(name)')
    .eq('company_id', companyId)

  if (error) {
    console.error('Error fetching storage stats:', error)
    throw error
  }

  const vehicles = allVehicles || []
  const stored = vehicles.filter(v => v.current_status === 'stored')
  const released = vehicles.filter(v => v.current_status === 'released')

  // ספירה לפי לקוח (רק באחסנה)
  const byCustomerMap: Record<string, { name: string; count: number }> = {}
  stored.forEach(v => {
    if (v.customer_id) {
      const customerName = (v.customer as any)?.name || 'לא ידוע'
      if (!byCustomerMap[v.customer_id]) {
        byCustomerMap[v.customer_id] = { name: customerName, count: 0 }
      }
      byCustomerMap[v.customer_id].count++
    }
  })

  const byCustomer = Object.entries(byCustomerMap)
    .map(([customerId, data]) => ({
      customerId,
      customerName: data.name,
      count: data.count
    }))
    .sort((a, b) => b.count - a.count)

  return {
    total: vehicles.length,
    stored: stored.length,
    released: released.length,
    byCustomer
  }
}

// ==================== רכבים של לקוח באחסנה ====================

export async function getCustomerStoredVehicles(
  companyId: string,
  customerId: string
): Promise<StoredVehicleWithCustomer[]> {
  return getStoredVehicles(companyId, customerId, 'stored')
}