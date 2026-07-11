import { supabase } from '../supabase'
import { persistVehicleCodeToCache } from '../vehicle-lookup'

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
    source?: string
    sourceLabel?: string
  } | null
  current_status: 'stored' | 'reserved_for_tow' | 'released'
  reserved_for_tow_id?: string | null
  location: string | null
  last_stored_at: string
  notes: string | null
  created_at: string
  vehicle_condition: 'operational' | 'faulty'
  vehicle_code: string | null
  defects: string[] | null
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

export type StoredVehicleStatus = StoredVehicle['current_status']

export function getStoredVehicleStatusDisplay(status: StoredVehicleStatus): {
  label: string
  badgeClass: string
  dotClass: string
} {
  switch (status) {
    case 'stored':
      return {
        label: 'באחסנה',
        badgeClass: 'bg-emerald-100 text-emerald-700',
        dotClass: 'bg-emerald-500',
      }
    case 'reserved_for_tow':
      return {
        label: 'ממתין לגרירה',
        badgeClass: 'bg-amber-100 text-amber-700',
        dotClass: 'bg-amber-500',
      }
    case 'released':
      return {
        label: 'שוחרר',
        badgeClass: 'bg-gray-100 text-gray-600',
        dotClass: 'bg-gray-400',
      }
  }
}

/** Vehicles selectable in tow-form storage picker modals */
export function isPickableStoredVehicle(
  vehicle: Pick<StoredVehicle, 'current_status'>
): boolean {
  return vehicle.current_status === 'stored'
}

// ==================== שליפת רכבים באחסנה ====================

export async function getStoredVehicles(
  companyId: string, 
  customerId?: string | null,
  statusFilter: 'stored' | 'reserved_for_tow' | 'released' | 'all' = 'stored'
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

// ==================== שמירת רכב לגרירה (reserved) ====================

export async function reserveVehicleForTow(params: {
  storedVehicleId: string
  towId: string
}): Promise<void> {
  const { storedVehicleId, towId } = params
  const { error } = await supabase
    .from('stored_vehicles')
    .update({
      current_status: 'reserved_for_tow',
      reserved_for_tow_id: towId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', storedVehicleId)
    .eq('current_status', 'stored')

  if (error) {
    console.error('[reserveVehicleForTow] error:', error)
    throw error
  }
}

export async function unreserveVehicleFromTow(params: {
  storedVehicleId: string
}): Promise<void> {
  const { storedVehicleId } = params
  const { error } = await supabase
    .from('stored_vehicles')
    .update({
      current_status: 'stored',
      reserved_for_tow_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', storedVehicleId)
    .eq('current_status', 'reserved_for_tow')

  if (error) {
    console.error('[unreserveVehicleFromTow] error:', error)
    throw error
  }
}

export async function getVehiclesReservedForTow(
  towId: string
): Promise<StoredVehicle[]> {
  const { data, error } = await supabase
    .from('stored_vehicles')
    .select('*')
    .eq('reserved_for_tow_id', towId)
    .eq('current_status', 'reserved_for_tow')

  if (error) {
    console.error('[getVehiclesReservedForTow] error:', error)
    return []
  }
  return (data as StoredVehicle[]) || []
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
    .eq('current_status', 'stored')
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

export async function getStoredVehicleById(
  companyId: string,
  vehicleId: string
): Promise<StoredVehicleWithCustomer | null> {
  const { data, error } = await supabase
    .from('stored_vehicles')
    .select(`
      *,
      customer:customers!customer_id (
        id,
        name,
        phone
      )
    `)
    .eq('id', vehicleId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching stored vehicle by id:', error)
    throw error
  }

  if (!data) return null

  return {
    ...data,
    customer_name: (data.customer as { name?: string } | null)?.name || null,
  }
}

/** Pickup completion: find vehicle in storage or reserved for this tow */
export async function findStoredVehicleForRelease(
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
    .in('current_status', ['stored', 'reserved_for_tow'])
    .maybeSingle()

  if (error) {
    console.error('Error finding stored vehicle for release:', error)
    throw error
  }

  if (!data) return null

  return {
    ...data,
    customer_name: (data.customer as any)?.name || null,
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
  vehicleCondition?: 'operational' | 'faulty'
  vehicleCode?: string
  defects?: string[]
}

export async function addVehicleToStorage(input: AddToStorageInput): Promise<string> {
  // בדיקה אם הרכב כבר באחסנה
  const { data: existing } = await supabase
    .from('stored_vehicles')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('plate_number', input.plateNumber)
    .eq('current_status', 'stored')
    .maybeSingle()

  if (existing) {
    throw new Error('הרכב כבר נמצא באחסנה')
  }

  const { data, error } = await supabase.rpc('add_vehicle_to_storage', {
    p_company_id: input.companyId,
    p_customer_id: input.customerId || null,
    p_plate_number: input.plateNumber,
    p_vehicle_data: input.vehicleData || null,
    p_location: input.location || null,
    p_tow_id: input.towId || null,
    p_performed_by: input.performedBy || null,
    p_notes: input.notes || null,
    p_vehicle_condition: input.vehicleCondition || 'operational',
    p_vehicle_code: input.vehicleCode || null,
    p_defects: input.defects ?? null,
  })

  if (error) {
    console.error('Error adding vehicle to storage:', error)
    throw error
  }

  persistVehicleCodeToCache(input.plateNumber, input.vehicleCode)

  return data
}

// ==================== שחרור רכב מאחסנה ====================

interface ReleaseFromStorageInput {
  storedVehicleId: string
  towId?: string
  performedBy?: string
  notes?: string
  vehicleCondition?: 'operational' | 'faulty'
  vehicleCode?: string
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
  vehicleCondition?: string | null
  vehicleCode?: string | null
  defects?: string[] | null
}
export async function updateStoredVehicle(input: UpdateStoredVehicleInput): Promise<boolean> {
  const { error } = await supabase
    .from('stored_vehicles')
    .update({
      customer_id: input.customerId,
      location: input.location,
      notes: input.notes,
      vehicle_condition: input.vehicleCondition,
      vehicle_code: input.vehicleCode,
      ...(input.defects !== undefined ? { defects: input.defects } : {}),
    })
    .eq('id', input.id)

  if (error) {
    console.error('Error updating stored vehicle:', error)
    throw error
  }

  if (input.vehicleCode?.trim()) {
    const { data: row } = await supabase
      .from('stored_vehicles')
      .select('plate_number')
      .eq('id', input.id)
      .maybeSingle()
    if (row?.plate_number) {
      persistVehicleCodeToCache(row.plate_number, input.vehicleCode)
    }
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
  reserved: number
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
  const reserved = vehicles.filter(v => v.current_status === 'reserved_for_tow')
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
    reserved: reserved.length,
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

/** Customer card: stored + reserved (not released) */
export async function getCustomerStoredVehiclesForDisplay(
  companyId: string,
  customerId: string
): Promise<StoredVehicleWithCustomer[]> {
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
    .eq('customer_id', customerId)
    .in('current_status', ['stored', 'reserved_for_tow'])
    .order('last_stored_at', { ascending: false })

  if (error) {
    console.error('Error fetching customer stored vehicles for display:', error)
    throw error
  }

  return (data || []).map((item) => ({
    ...item,
    customer_name: (item.customer as { name?: string } | null)?.name || null,
  }))
}