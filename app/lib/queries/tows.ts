import { supabase } from '../supabase'
import {
  getVehiclesReservedForTow,
  unreserveVehicleFromTow,
} from './storage'
import { getCompanySettings } from './settings'
import { updatePointStatus } from './driver-tasks'
import type {
  TowChangeLog,
  VehicleLookupResult,
  TowPoint,
  TowPointWithDetails,
  PointStatus,
  PointType,
} from '../types'
import { normalizePlate } from '../utils/plate-number'

// ==================== טיפוסים ====================

export interface PriceBreakdown {
  base_price: number
  vehicle_type: string
  vehicle_count?: number      
  distance_km: number
  distance_price: number
  time_surcharges: { id: string; label: string; percent: number; amount: number }[]
  location_surcharges: { id: string; label: string; percent: number; amount: number }[]
  service_surcharges: {
    id: string
    label: string
    price: number
    units?: number
    amount: number
    vehicle_role?: 'working' | 'defective'
  }[]
  subtotal: number
  discount_percent: number
  discount_amount: number
  vat_amount: number
  total: number
  route_points?: any[]
}

export interface TowVehicle {
  id: string
  tow_id: string
  plate_number: string
  manufacturer: string | null
  model: string | null
  year: number | null
  vehicle_type: 'motorcycle' | 'small' | 'medium' | 'large' | 'truck' | null
  color: string | null
  is_working: boolean | null
  tow_reason: string | null
  notes: string | null
  order_index: number | null
  created_at: string
}

export interface TowLeg {
  id: string
  tow_id: string
  tow_vehicle_id: string | null
  leg_type: 'empty_drive' | 'pickup' | 'delivery'
  leg_order: number
  from_address: string | null
  from_lat: number | null
  from_lng: number | null
  to_address: string | null
  to_lat: number | null
  to_lng: number | null
  distance_km: number | null
  status: 'pending' | 'in_progress' | 'completed' | null
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
}

export type { TowPoint, TowPointWithDetails, PointStatus, PointType }

export interface TowWithDetails {
  id: string
  order_number: string | null
  customer_order_number: string | null
  linked_tow_id: string | null
  company_id: string
  customer_id: string | null
  driver_id: string | null
  truck_id: string | null
  created_by: string | null
  tow_type: 'simple' | 'with_base' | 'transfer' | 'multi_vehicle' | 'exchange'
  status: 'quote' | 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
  scheduled_end_at: string | null
  duration_minutes?: number
  notes: string | null
  recommended_price: number | null
  final_price: number | null
  price_breakdown: PriceBreakdown | null
  price_list_id: string | null
  required_truck_types: string[] | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  price_mode: 'recommended' | 'fixed' | 'customer' | 'custom' | null
  payment_method: string | null
  invoice_name: string | null
  start_from_base: boolean | null
  dropoff_to_storage: boolean | null
  visibility_overrides: Record<string, boolean> | null
  manually_closed_at?: string | null
  manually_closed_by?: string | null
  manually_closed_by_user?: {
    full_name: string
  } | null

  // שדות מורחבים
  customer: {
    id: string
    name: string
    phone: string | null
    email: string | null
    address: string | null
    customer_type: 'private' | 'business'
  } | null
  department: string | null
  ordered_by: string | null
  driver: {
    id: string
    user: {
      full_name: string
      phone: string | null
    }
  } | null
  second_driver: {
    id: string
    user: {
      full_name: string
      phone: string | null
    }
  } | null
  second_driver_id: string | null
  second_driver_scheduled_at: string | null
  truck: {
    id: string
    plate_number: string
  } | null
  vehicles: TowVehicle[]
  legs: TowLeg[]
  // NEW: נקודות גרירה
  points?: TowPointWithDetails[]
}

// ==================== שליפת גרירות ====================

export interface GetTowsOptions {
  /** ISO date string. If null, no date filter. Default: 90 days ago. */
  since?: string | null
  /** Max rows. If null, no limit. Default: 100. */
  limit?: number | null
}

export async function getTows(
  companyId: string,
  options: GetTowsOptions = {}
): Promise<TowWithDetails[]> {
  const defaultSince = new Date()
  defaultSince.setDate(defaultSince.getDate() - 90)
  const sinceIso =
    options.since === null
      ? null
      : (options.since ?? defaultSince.toISOString())
  const limitValue =
    options.limit === null ? null : (options.limit ?? 100)

  let query = supabase
    .from('tows')
    .select(`
      id,
      company_id,
      customer_id,
      driver_id,
      second_driver_id,
      truck_id,
      status,
      created_at,
      scheduled_at,
      order_number,
      customer_order_number,
      final_price,
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
      second_driver:drivers!tows_second_driver_id_fkey (
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

  if (sinceIso) {
    query = query.gte('created_at', sinceIso)
  }
  if (limitValue !== null) {
    query = query.limit(limitValue)
  }

  const { data: tows, error } = await query

  if (error) {
    console.error('Error fetching tows:', error)
    throw error
  }

  if (!tows || tows.length === 0) return []

  // שליפת כלי רכב עבור כל הגרירות
  const towIds = tows.map(t => t.id)
  
  const { data: vehicles } = await supabase
    .from('tow_vehicles')
    .select('*')
    .in('tow_id', towIds)
    .order('order_index', { ascending: true })

  // שליפת רגליים עבור כל הגרירות
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

  // Cast: Task 1.9 dropped heavy columns from the SELECT (price_breakdown,
  // notes, visibility_overrides, etc.). The tow list page (the only caller)
  // doesn't access those fields. If a future caller needs them, use getTow
  // or getTowWithPoints instead, or add the columns back to the SELECT here.
  return tows.map(tow => ({
    ...tow,
    customer: tow.customer as any,
    driver: tow.driver as any,
    truck: tow.truck as any,
    vehicles: vehiclesByTow[tow.id] || [],
    legs: legsByTow[tow.id] || []
  })) as unknown as TowWithDetails[]
}

export async function searchTows(companyId: string, query: string): Promise<TowWithDetails[]> {
  const q = query.trim()
  if (!q) return []

  const pattern = `%${q}%`

  const [orderRes, customerOrderRes, customersRes, vehiclesRes] = await Promise.all([
    supabase.from('tows').select('id').eq('company_id', companyId).ilike('order_number', pattern),
    supabase.from('tows').select('id').eq('company_id', companyId).ilike('customer_order_number', pattern),
    supabase.from('customers').select('id').ilike('name', pattern),
    supabase.from('tow_vehicles').select('tow_id').ilike('plate_number', pattern),
  ])

  const ids = new Set<string>()
  orderRes.data?.forEach((r: { id: string }) => ids.add(r.id))
  customerOrderRes.data?.forEach((r: { id: string }) => ids.add(r.id))

  const customerIds = customersRes.data?.map((c: { id: string }) => c.id) || []
  if (customerIds.length > 0) {
    const { data: towRows } = await supabase
      .from('tows')
      .select('id')
      .eq('company_id', companyId)
      .in('customer_id', customerIds)
    towRows?.forEach((r: { id: string }) => ids.add(r.id))
  }

  const vehicleTowIds = [...new Set(vehiclesRes.data?.map((v: { tow_id: string }) => v.tow_id) || [])]
  if (vehicleTowIds.length > 0) {
    const { data: towRows } = await supabase
      .from('tows')
      .select('id')
      .eq('company_id', companyId)
      .in('id', vehicleTowIds)
    towRows?.forEach((r: { id: string }) => ids.add(r.id))
  }

  if (ids.size === 0) return []

  const idList = Array.from(ids)

  const { data: tows, error } = await supabase
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
      second_driver:drivers!tows_second_driver_id_fkey (
        id,
        user:users!drivers_user_id_fkey (
          full_name,
          phone
        )
      ),
      truck:tow_trucks (
        id,
        plate_number
      ),
      vehicles:tow_vehicles (
        plate_number,
        vehicle_type,
        order_index
      )
    `)
    .eq('company_id', companyId)
    .in('id', idList)
    .order('created_at', { ascending: false })
    .limit(8)

  if (error) {
    console.error('Error searching tows:', error)
    throw error
  }

  if (!tows || tows.length === 0) return []

  return tows.map(tow => {
    const raw = (tow as { vehicles?: { plate_number: string; vehicle_type: string | null; order_index: number | null }[] }).vehicles
    const vehiclesSorted = [...(raw || [])].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    )
    return {
      ...tow,
      customer: tow.customer as any,
      driver: tow.driver as any,
      truck: tow.truck as any,
      vehicles: vehiclesSorted as TowVehicle[],
      legs: [],
    }
  })
}

// ==================== שליפת גרירה בודדת ====================

/** Snapshot of tow fields at edit load — used for change logs / save without re-fetching. */
export interface EditTowSnapshot {
  final_price: number | null
  payment_method: string | null
  notes: string | null
  scheduled_at: string | null
  price_breakdown: PriceBreakdown | null
}

const TOW_WITH_RELATIONS_SELECT = `
  *,
  customer:customers (
    id,
    name,
    phone,
    email,
    address,
    customer_type
  ),
  driver:drivers!tows_driver_id_fkey (
    id,
    user:users!drivers_user_id_fkey (
      full_name,
      phone
    )
  ),
  second_driver:drivers!tows_second_driver_id_fkey (
    id,
    user:users!drivers_user_id_fkey (
      full_name,
      phone
    )
  ),
  truck:tow_trucks (
    id,
    plate_number
  ),
  manually_closed_by_user:users!tows_manually_closed_by_fkey (
    full_name
  )
`

export async function getTow(towId: string): Promise<TowWithDetails | null> {
  const [towRes, vehiclesRes, legsRes] = await Promise.all([
    supabase
      .from('tows')
      .select(TOW_WITH_RELATIONS_SELECT)
      .eq('id', towId)
      .single(),
    supabase
      .from('tow_vehicles')
      .select('*')
      .eq('tow_id', towId)
      .order('order_index', { ascending: true }),
    supabase
      .from('tow_legs')
      .select('*')
      .eq('tow_id', towId)
      .order('leg_order', { ascending: true }),
  ])

  if (towRes.error) {
    console.error('Error fetching tow:', towRes.error)
    throw towRes.error
  }

  if (!towRes.data) return null

  if (vehiclesRes.error) {
    console.error('Error fetching tow vehicles:', vehiclesRes.error)
    throw vehiclesRes.error
  }

  if (legsRes.error) {
    console.error('Error fetching tow legs:', legsRes.error)
    throw legsRes.error
  }

  const tow = towRes.data

  return {
    ...tow,
    customer: tow.customer as any,
    driver: tow.driver as any,
    truck: tow.truck as any,
    vehicles: vehiclesRes.data || [],
    legs: legsRes.data || [],
  }
}

// ==================== NEW: שליפת גרירה עם נקודות ====================

export async function getTowWithPoints(towId: string): Promise<TowWithDetails | null> {
  const [towRes, vehiclesRes, legsRes, pointsRes] = await Promise.all([
    supabase
      .from('tows')
      .select(TOW_WITH_RELATIONS_SELECT)
      .eq('id', towId)
      .single(),
    supabase
      .from('tow_vehicles')
      .select('*')
      .eq('tow_id', towId)
      .order('order_index', { ascending: true }),
    supabase
      .from('tow_legs')
      .select('*')
      .eq('tow_id', towId)
      .order('leg_order', { ascending: true }),
    supabase
      .from('tow_points')
      .select(`
      *,
      vehicles:tow_point_vehicles (
        id,
        action,
        vehicle:tow_vehicles (
          id,
          plate_number,
          manufacturer,
          model,
          color,
          is_working,
          vehicle_type,
          tow_reason
        )
      ),
      images:tow_images (
        id,
        image_url,
        image_type,
        tow_point_id,
        tow_vehicle_id,
        notes,
        created_at
      )
    `)
      .eq('tow_id', towId)
      .order('point_order', { ascending: true }),
  ])

  if (towRes.error) {
    console.error('Error fetching tow:', towRes.error)
    throw towRes.error
  }

  if (!towRes.data) return null

  if (vehiclesRes.error) {
    console.error('Error fetching tow vehicles:', vehiclesRes.error)
    throw vehiclesRes.error
  }

  if (legsRes.error) {
    console.error('Error fetching tow legs:', legsRes.error)
    throw legsRes.error
  }

  if (pointsRes.error) {
    console.error('Error fetching tow points:', pointsRes.error)
  }

  const tow = towRes.data

  return {
    ...tow,
    customer: tow.customer as any,
    driver: tow.driver as any,
    truck: tow.truck as any,
    vehicles: vehiclesRes.data || [],
    legs: legsRes.data || [],
    points: pointsRes.data || [],
  }
}

// ==================== יצירת גרירה ====================

// NEW: טייפ לנקודה מוכנה לשמירה
export interface PreparedTowPoint {
  point_order: number
  point_type: 'pickup' | 'dropoff' | 'exchange' | 'stop'
  address: string | null
  lat: number | null
  lng: number | null
  contact_name: string | null
  contact_phone: string | null
  notes: string | null
  order_notes?: string | null
  driver_visited_at?: string | null
  driver_notes?: string | null
  vehicleIndices: number[]
  dropToStorage?: boolean
  isStorage?: boolean
  stop_subtype?:
    | 'key'
    | 'customer_pickup'
    | 'customer_dropoff'
    | 'other'
    | 'customer'
    | 'general'
    | null
}

interface CreateTowInput {
  companyId: string
  createdBy: string
  customerOrderNumber?: string
  department?: string | null
  ordered_by?: string | null
  customerId?: string
  driverId?: string
  truckId?: string
  towType: 'simple' | 'with_base' | 'transfer' | 'multi_vehicle' | 'exchange'
  scheduledAt?: string
  scheduledEndAt?: string | null
  notes?: string
  finalPrice?: number
  priceMode?: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  priceBreakdown?: PriceBreakdown | null
  requiredTruckTypes?: string[]
  vehicles: {
    plateNumber: string
    vehicleCode?: string
    manufacturer?: string
    model?: string
    year?: number
    vehicleType?: 'motorcycle' | 'private' | 'heavy' | 'machinery'
    color?: string
    isWorking?: boolean
    towReason?: string
    notes?: string
    driveType?: string
    fuelType?: string
    totalWeight?: number
    gearType?: string
    driveTechnology?: string
    registrySource?: string | null
  }[]
  legs: {
    legType: 'empty_drive' | 'pickup' | 'delivery'
    fromAddress?: string
    toAddress?: string
    towVehicleIndex?: number
  }[]
  // NEW: נקודות גרירה
  points?: PreparedTowPoint[]
  paymentMethod?: string
  invoiceName?: string
  startFromBase?: boolean
  dropoffToStorage?: boolean
  linkedTowId?: string
  secondDriverId?: string
  secondDriverScheduledAt?: string
  status?: 'quote' | 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'

}

export async function createTow(input: CreateTowInput) {
  const towId = crypto.randomUUID()
  const status =
    input.status ?? (input.driverId ? 'assigned' : 'pending')

  // יצירת הגרירה
  const { error: towError } = await supabase
    .from('tows')
    .insert({
      id: towId,
      company_id: input.companyId,
      created_by: input.createdBy,
      customer_order_number: input.customerOrderNumber || null,
      department: input.department ?? null,
      ordered_by: input.ordered_by ?? null,
      customer_id: input.customerId || null,
      driver_id: input.driverId || null,
      truck_id: input.truckId || null,
      tow_type: input.towType,
      price_breakdown: input.priceBreakdown || null,
      required_truck_types: input.requiredTruckTypes || null,
      status,
      scheduled_at: input.scheduledAt || null,
      scheduled_end_at: input.scheduledEndAt ?? null,
      notes: input.notes || null,
      price_mode: input.priceMode || 'recommended',
      final_price: input.finalPrice || null,
      payment_method: input.paymentMethod || null,
      invoice_name: input.invoiceName || null,
      start_from_base: input.startFromBase || false,
      dropoff_to_storage: input.dropoffToStorage || false,
      linked_tow_id: input.linkedTowId || null,
      second_driver_id: input.secondDriverId || null,
      second_driver_scheduled_at: input.secondDriverScheduledAt || null,
      
    })

  if (towError) {
    console.error('Error creating tow:', JSON.stringify(towError, null, 2))
    throw towError
  }

  // Precompute IDs and bulk payloads
  const vehicleIds = input.vehicles.map(() => crypto.randomUUID())
  const pointIds = (input.points || []).map(() => crypto.randomUUID())

  const vehicleRows = input.vehicles.map((v, i) => ({
    id: vehicleIds[i],
    tow_id: towId,
    plate_number: v.plateNumber,
    manufacturer: v.manufacturer || null,
    model: v.model || null,
    year: v.year || null,
    vehicle_type: v.vehicleType || null,
    color: v.color || null,
    is_working: v.isWorking ?? true,
    tow_reason: v.towReason || null,
    notes: v.notes || null,
    order_index: i,
    drive_type: v.driveType || null,
    fuel_type: v.fuelType || null,
    total_weight: v.totalWeight || null,
    gear_type: v.gearType || null,
    drive_technology: v.driveTechnology || null,
    vehicle_code: v.vehicleCode || null,
    registry_source: v.registrySource ?? null,
  }))

  // בדיקה אם יש delivery leg - אם לא, ניצור אוטומטית
  let legsToCreate = [...input.legs]
  const hasDelivery = legsToCreate.some(l => l.legType === 'delivery')
  const pickupLeg = legsToCreate.find(l => l.legType === 'pickup')
  
  if (!hasDelivery && pickupLeg) {
    legsToCreate.push({
      legType: 'delivery',
      fromAddress: pickupLeg.toAddress,
      toAddress: pickupLeg.toAddress
    })
  }

  const legRows = legsToCreate.map((leg, i) => ({
    tow_id: towId,
    tow_vehicle_id: leg.towVehicleIndex !== undefined ? vehicleIds[leg.towVehicleIndex] : null,
    leg_type: leg.legType,
    leg_order: i,
    from_address: leg.fromAddress || null,
    to_address: leg.toAddress || null,
    status: 'pending',
  }))

  const pointRows = (input.points || []).map((point, i) => ({
    id: pointIds[i],
    tow_id: towId,
    point_order: point.point_order,
    point_type: point.point_type,
    address: point.address,
    lat: point.lat,
    lng: point.lng,
    contact_name: point.contact_name,
    contact_phone: point.contact_phone,
    notes: point.notes,
    order_notes: point.order_notes ?? null,
    driver_visited_at: point.driver_visited_at ?? null,
    driver_notes: point.driver_notes ?? null,
    is_storage: point.isStorage || false,
    stop_subtype: point.stop_subtype ?? null,
    status: 'pending',
  }))

  const pointVehicleRows = (input.points || []).flatMap((point, pointIndex) => {
    const pointId = pointIds[pointIndex]
    if (!pointId || !point.vehicleIndices || point.vehicleIndices.length === 0) return []
    return point.vehicleIndices
      .map((vehicleIndex) => {
        const vehicleId = vehicleIds[vehicleIndex]
        if (!vehicleId) return null
        return {
          tow_point_id: pointId,
          tow_vehicle_id: vehicleId,
          action: point.point_type,
        }
      })
      .filter((row): row is { tow_point_id: string; tow_vehicle_id: string; action: PreparedTowPoint['point_type'] } => row !== null)
  })

  const [vehiclesResult, legsResult, pointsResult] = await Promise.all([
    vehicleRows.length > 0
      ? supabase.from('tow_vehicles').insert(vehicleRows)
      : Promise.resolve({ error: null } as { error: any }),
    legRows.length > 0
      ? supabase.from('tow_legs').insert(legRows)
      : Promise.resolve({ error: null } as { error: any }),
    pointRows.length > 0
      ? supabase.from('tow_points').insert(pointRows)
      : Promise.resolve({ error: null } as { error: any }),
  ])

  if (vehiclesResult.error) {
    console.error('Error creating tow vehicle:', vehiclesResult.error)
    await supabase.from('tows').delete().eq('id', towId)
    throw vehiclesResult.error
  }

  if (legsResult.error) {
    console.error('Error creating tow leg:', legsResult.error)
    await supabase.from('tow_vehicles').delete().eq('tow_id', towId)
    await supabase.from('tows').delete().eq('id', towId)
    throw legsResult.error
  }

  if (pointsResult.error) {
    console.error('Error creating tow point:', pointsResult.error)
    // לא נעצור את כל התהליך - הנקודות הן תוספת
  } else if (pointVehicleRows.length > 0) {
    const { error: pointVehicleError } = await supabase
      .from('tow_point_vehicles')
      .insert(pointVehicleRows)

    if (pointVehicleError) {
      console.error('Error creating tow point vehicle:', pointVehicleError)
    }
  }

  return { id: towId }
}

// ==================== עדכון סטטוס גרירה ====================

export async function updateTowStatus(
  towId: string,
  status: 'quote' | 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled',
  cancellationReason?: string,
  cancellationDetails?: string
) {
  const updates: Record<string, any> = { status }

  if (cancellationReason !== undefined) {
    updates.cancellation_reason = cancellationReason
  }
  if (cancellationDetails !== undefined) {
    updates.cancellation_details = cancellationDetails
  }

  if (status === 'in_progress') {
    updates.started_at = new Date().toISOString()
  } else if (status === 'completed') {
    updates.completed_at = new Date().toISOString()
  } else if (status === 'cancelled') {
    updates.cancelled_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('tows')
    .update(updates)
    .eq('id', towId)

  if (error) {
    console.error('Error updating tow status:', error)
    throw error
  }

  if (status === 'cancelled') {
    try {
      const reserved = await getVehiclesReservedForTow(towId)
      for (const v of reserved) {
        await unreserveVehicleFromTow({ storedVehicleId: v.id })
      }
    } catch (err) {
      console.error('[updateTowStatus] failed to unreserve vehicles:', err)
    }
  }

  return true
}

// ==================== סגירה ידנית (מנהל) ====================

export async function manualCloseTow(towId: string, adminUserId: string, endTimeIso?: string) {
  const tow = await getTowWithPoints(towId)
  if (!tow) {
    throw new Error('הגרירה לא נמצאה')
  }

  if (tow.status !== 'assigned' && tow.status !== 'in_progress') {
    throw new Error('ניתן לסגור ידנית רק גרירות בשיבוץ או בביצוע')
  }

  const points = tow.points ?? []
  for (const point of points) {
    if (point.status !== 'completed' && point.status !== 'skipped') {
      await updatePointStatus(point.id, 'completed')
    }
  }

  const now = new Date().toISOString()
  const completedAt = endTimeIso ?? now
  const { error: towError } = await supabase
    .from('tows')
    .update({
      status: 'completed',
      completed_at: completedAt,
      manually_closed_at: now,
      manually_closed_by: adminUserId,
      updated_at: now,
    })
    .eq('id', towId)

  if (towError) {
    console.error('Error manually closing tow:', towError)
    throw towError
  }

  const { data: adminUser } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', adminUserId)
    .maybeSingle()

  const adminName = adminUser?.full_name || 'מנהל'
  const closedAtLabel = new Date(now).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  await saveTowChangeLogs(towId, adminUserId, [
    {
      field_name: 'סגירה ידנית',
      old_value: tow.status,
      new_value: `הגרירה נסגרה ידנית ע״י ${adminName} בתאריך ${closedAtLabel}`,
    },
  ])

  return true
}

// ==================== שיוך נהג לגרירה ====================

export async function assignDriver(towId: string, driverId: string, truckId?: string, scheduledAt?: string) {
  const { data: existing } = await supabase
    .from('tows')
    .select('scheduled_at')
    .eq('id', towId)
    .single()

  const { error } = await supabase
    .from('tows')
    .update({
      driver_id: driverId,
      truck_id: truckId || null,
      status: 'assigned',
      scheduled_at: scheduledAt || existing?.scheduled_at || new Date().toISOString()
    })
    .eq('id', towId)

  if (error) {
    console.error('Error assigning driver:', error)
    throw error
  }

  return true
}

function mapVehicleTypeForTow(
  vehicleType?: string
): 'motorcycle' | 'private' | 'heavy' | 'machinery' | undefined {
  if (!vehicleType) return undefined
  const valid = ['motorcycle', 'private', 'heavy', 'machinery'] as const
  return (valid as readonly string[]).includes(vehicleType)
    ? (vehicleType as 'motorcycle' | 'private' | 'heavy' | 'machinery')
    : undefined
}

export interface CreateStorageFollowUpInput {
  parentTowId: string
  companyId: string
  createdBy: string
  customerId: string | null
  vehiclePlate: string
  vehicleData: VehicleLookupResult | null
  vehicleType: string
  vehicleCode?: string | null
  vehicleManufacturer?: string | null
  vehicleModel?: string | null
  vehicleYear?: string | number | null
  vehicleColor?: string | null
  pickupAddress: string
  pickupLat: number | null
  pickupLng: number | null
  dropoffAddress: string
  dropoffLat: number | null
  dropoffLng: number | null
  dropoffContactName: string
  dropoffContactPhone: string
  requiredTruckTypes: string[]
}

/** Second tow: yard pickup → admin follow-up destination; unassigned, no schedule. */
export async function createStorageFollowUpTow(
  input: CreateStorageFollowUpInput
): Promise<{ id: string }> {
  const yearRaw = input.vehicleData?.data?.year ?? input.vehicleYear
  const year =
    yearRaw != null && yearRaw !== ''
      ? typeof yearRaw === 'number'
        ? yearRaw
        : Number(yearRaw)
      : undefined

  return createTow({
    companyId: input.companyId,
    createdBy: input.createdBy,
    customerId: input.customerId ?? undefined,
    towType: 'simple',
    linkedTowId: input.parentTowId,
    dropoffToStorage: false,
    requiredTruckTypes: input.requiredTruckTypes,
    scheduledAt: undefined,
    finalPrice: undefined,
    priceMode: 'recommended',
    priceBreakdown: null,
    notes: 'גרירת המשך מאחסנה',
    vehicles: [
      {
        plateNumber: normalizePlate(input.vehiclePlate),
        vehicleCode: input.vehicleCode || undefined,
        vehicleType: mapVehicleTypeForTow(input.vehicleType) ?? 'private',
        manufacturer:
          input.vehicleData?.data?.manufacturer ||
          input.vehicleManufacturer ||
          undefined,
        model: input.vehicleData?.data?.model || input.vehicleModel || undefined,
        year: Number.isFinite(year) ? year : undefined,
        color: input.vehicleData?.data?.color || input.vehicleColor || undefined,
        isWorking: true,
        driveType: input.vehicleData?.data?.driveType ?? undefined,
        fuelType: input.vehicleData?.data?.fuelType ?? undefined,
        totalWeight: input.vehicleData?.data?.totalWeight ?? undefined,
        gearType: input.vehicleData?.data?.gearType ?? undefined,
        driveTechnology: input.vehicleData?.data?.driveTechnology ?? undefined,
      },
    ],
    legs: [
      {
        legType: 'pickup',
        fromAddress: input.pickupAddress,
        toAddress: input.dropoffAddress,
        towVehicleIndex: 0,
      },
    ],
    points: [
      {
        point_order: 0,
        point_type: 'pickup',
        address: input.pickupAddress,
        lat: input.pickupLat,
        lng: input.pickupLng,
        contact_name: null,
        contact_phone: null,
        notes: null,
        vehicleIndices: [0],
        isStorage: true,
      },
      {
        point_order: 1,
        point_type: 'dropoff',
        address: input.dropoffAddress,
        lat: input.dropoffLat,
        lng: input.dropoffLng,
        contact_name: input.dropoffContactName || null,
        contact_phone: input.dropoffContactPhone || null,
        notes: null,
        vehicleIndices: [0],
        isStorage: false,
      },
    ],
  })
}

export async function createLinkedTow(
  originalTowId: string,
  input: {
    companyId: string
    createdBy: string
    driverId?: string
    truckId?: string
    scheduledAt?: string
  }
): Promise<{ id: string }> {
  const originalTow = await getTowWithPoints(originalTowId)
  if (!originalTow) throw new Error('Original tow not found')

  const defectiveVehicle = originalTow.vehicles?.find(v => !(v as any).is_working)
  const exchangePoint = originalTow.points?.find(p => p.point_type === 'exchange')
  const dropoffPoint = originalTow.points?.find(p => p.point_type === 'dropoff')

  const towId = crypto.randomUUID()
  const status = input.driverId ? 'assigned' : 'pending'

  const { error } = await supabase
    .from('tows')
    .insert({
      id: towId,
      company_id: input.companyId,
      created_by: input.createdBy,
      customer_id: originalTow.customer_id,
      driver_id: input.driverId || null,
      truck_id: input.truckId || null,
      tow_type: 'exchange',
      status,
      scheduled_at: input.scheduledAt || originalTow.scheduled_at,
      notes: originalTow.notes,
      required_truck_types: originalTow.required_truck_types,
      linked_tow_id: originalTowId,
      final_price: null,
      price_mode: 'recommended',
    })

  if (error) throw error

  if (defectiveVehicle) {
    await supabase.from('tow_vehicles').insert({
      tow_id: towId,
      plate_number: (defectiveVehicle as any).plate_number,
      manufacturer: (defectiveVehicle as any).manufacturer,
      model: (defectiveVehicle as any).model,
      year: (defectiveVehicle as any).year,
      vehicle_type: (defectiveVehicle as any).vehicle_type,
      color: (defectiveVehicle as any).color,
      is_working: false,
      order_index: 0,
    })
  }

  const points = []
  if (exchangePoint) {
    points.push({
      tow_id: towId,
      point_order: 0,
      point_type: 'pickup',
      address: exchangePoint.address,
      lat: exchangePoint.lat,
      lng: exchangePoint.lng,
      status: 'pending',
    })
  }
  if (dropoffPoint) {
    points.push({
      tow_id: towId,
      point_order: 1,
      point_type: 'dropoff',
      address: dropoffPoint.address,
      lat: dropoffPoint.lat,
      lng: dropoffPoint.lng,
      contact_name: dropoffPoint.contact_name,
      contact_phone: dropoffPoint.contact_phone,
      status: 'pending',
    })
  }
  if (points.length > 0) {
    await supabase.from('tow_points').insert(points)
  }

  return { id: towId }
}

// ==================== עדכון מחיר ====================

export async function updateTowPrice(towId: string, finalPrice: number) {
  const { error } = await supabase
    .from('tows')
    .update({ final_price: finalPrice })
    .eq('id', towId)

  if (error) {
    console.error('Error updating tow price:', error)
    throw error
  }

  return true
}

// ==================== עדכון גרירה ====================

interface UpdateTowInput {
  towId: string
  customerId?: string | null
  customerOrderNumber?: string | null
  department?: string | null
  ordered_by?: string | null
  notes?: string | null
  priceMode?: string | null
  finalPrice?: number | null
  recommendedPrice?: number | null
  scheduledAt?: string | null
  scheduledEndAt?: string | null
  completedAt?: string | null
  priceBreakdown?: PriceBreakdown | null
  requiredTruckTypes?: string[]
  vehicles?: {
    id?: string
    plateNumber: string
    vehicleCode?: string
    manufacturer?: string
    model?: string
    year?: number
    vehicleType?: 'motorcycle' | 'private' | 'heavy' | 'machinery'
    color?: string
    isWorking?: boolean
    towReason?: string
    notes?: string
    registrySource?: string | null
  }[]
  legs?: {
    id?: string
    legType: 'empty_drive' | 'pickup' | 'delivery'
    fromAddress?: string
    toAddress?: string
  }[]
  // NEW: נקודות גרירה
  points?: PreparedTowPoint[]
  paymentMethod?: string | null
  invoiceName?: string | null
  startFromBase?: boolean | null
  dropoffToStorage?: boolean | null
  visibilityOverrides?: Record<string, boolean> | null
  secondDriverId?: string | null
  secondDriverScheduledAt?: string | null
  towType?: 'simple' | 'with_base' | 'transfer' | 'multi_vehicle' | 'exchange'
  driverId?: string | null
  truckId?: string | null
  status?: 'quote' | 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'

}

export async function updateTow(input: UpdateTowInput) {
  const towUpdates: Record<string, any> = {}
  
  if (input.customerId !== undefined) towUpdates.customer_id = input.customerId
  if (input.customerOrderNumber !== undefined) towUpdates.customer_order_number = input.customerOrderNumber || null
  if (input.department !== undefined) towUpdates.department = input.department
  if (input.ordered_by !== undefined) towUpdates.ordered_by = input.ordered_by
  if (input.notes !== undefined) towUpdates.notes = input.notes
  if (input.finalPrice !== undefined) towUpdates.final_price = input.finalPrice
  if (input.recommendedPrice !== undefined) towUpdates.recommended_price = input.recommendedPrice
  if (input.priceBreakdown !== undefined) towUpdates.price_breakdown = input.priceBreakdown
  if (input.priceMode !== undefined) towUpdates.price_mode = input.priceMode
  if (input.requiredTruckTypes !== undefined) towUpdates.required_truck_types = input.requiredTruckTypes
  if (input.scheduledAt !== undefined) towUpdates.scheduled_at = input.scheduledAt
  if (input.scheduledEndAt !== undefined) towUpdates.scheduled_end_at = input.scheduledEndAt
  if (input.completedAt !== undefined) towUpdates.completed_at = input.completedAt
  if (input.paymentMethod !== undefined) towUpdates.payment_method = input.paymentMethod
  if (input.invoiceName !== undefined) towUpdates.invoice_name = input.invoiceName
  if (input.startFromBase !== undefined) towUpdates.start_from_base = input.startFromBase
  if (input.dropoffToStorage !== undefined) towUpdates.dropoff_to_storage = input.dropoffToStorage
  if (input.visibilityOverrides !== undefined) towUpdates.visibility_overrides = input.visibilityOverrides
  if (input.secondDriverId !== undefined) towUpdates.second_driver_id = input.secondDriverId
  if (input.secondDriverScheduledAt !== undefined) towUpdates.second_driver_scheduled_at = input.secondDriverScheduledAt
  if (input.towType !== undefined) towUpdates.tow_type = input.towType
  if (input.driverId !== undefined) towUpdates.driver_id = input.driverId
  if (input.truckId !== undefined) towUpdates.truck_id = input.truckId
  if (input.status !== undefined) towUpdates.status = input.status

  if (Object.keys(towUpdates).length > 0) {
    const { error: towError } = await supabase
      .from('tows')
      .update(towUpdates)
      .eq('id', input.towId)

    if (towError) {
      console.error('Error updating tow:', towError)
      throw towError
    }
  }

  if (input.vehicles) {
    await supabase.from('tow_vehicles').delete().eq('tow_id', input.towId)

    const vehicleRows = input.vehicles.map((v, i) => ({
      id: crypto.randomUUID(),
      tow_id: input.towId,
      plate_number: v.plateNumber,
      manufacturer: v.manufacturer || null,
      model: v.model || null,
      year: v.year || null,
      vehicle_type: v.vehicleType || null,
      color: v.color || null,
      is_working: v.isWorking ?? true,
      tow_reason: v.towReason || null,
      notes: v.notes || null,
      order_index: i,
      vehicle_code: v.vehicleCode || null,
      registry_source: v.registrySource ?? null,
    }))

    if (vehicleRows.length > 0) {
      const { error: vehicleError } = await supabase
        .from('tow_vehicles')
        .insert(vehicleRows)

      if (vehicleError) {
        console.error('Error updating tow vehicle:', vehicleError)
        throw vehicleError
      }
    }
  }

  if (input.legs) {
    await supabase.from('tow_legs').delete().eq('tow_id', input.towId)

    const legRows = input.legs.map((leg, i) => ({
      tow_id: input.towId,
      leg_type: leg.legType,
      leg_order: i,
      from_address: leg.fromAddress || null,
      to_address: leg.toAddress || null,
      status: 'pending',
    }))

    if (legRows.length > 0) {
      const { error: legError } = await supabase
        .from('tow_legs')
        .insert(legRows)

      if (legError) {
        console.error('Error updating tow leg:', legError)
        throw legError
      }
    }
  }

  // NEW: עדכון נקודות
  if (input.points) {
    // מחיקת רכבים בנקודות קודם
    const { data: existingPoints } = await supabase
      .from('tow_points')
      .select('id')
      .eq('tow_id', input.towId)
    
    if (existingPoints && existingPoints.length > 0) {
      const pointIds = existingPoints.map(p => p.id)
      await supabase.from('tow_point_vehicles').delete().in('tow_point_id', pointIds)
    }
    
    // מחיקת נקודות קיימות
    await supabase.from('tow_points').delete().eq('tow_id', input.towId)

    // שליפת מיפוי רכבים
    const { data: vehicles } = await supabase
      .from('tow_vehicles')
      .select('id, plate_number')
      .eq('tow_id', input.towId)
      .order('order_index', { ascending: true })
    
    const vehicleIds = vehicles?.map(v => v.id) || []

    const pointIds = input.points.map(() => crypto.randomUUID())
    const pointRows = input.points.map((point, i) => ({
      id: pointIds[i],
      tow_id: input.towId,
      point_order: point.point_order,
      point_type: point.point_type,
      address: point.address,
      lat: point.lat,
      lng: point.lng,
      contact_name: point.contact_name,
      contact_phone: point.contact_phone,
      notes: point.notes,
      order_notes: point.order_notes ?? null,
      driver_visited_at: point.driver_visited_at ?? null,
      driver_notes: point.driver_notes ?? null,
      is_storage: point.isStorage || false,
      stop_subtype: point.stop_subtype ?? null,
      status: 'pending',
    }))
    const pointVehicleRows = input.points.flatMap((point, pointIndex) =>
      (point.vehicleIndices || [])
        .map((vehicleIndex) => {
          const vehicleId = vehicleIds[vehicleIndex]
          const pointId = pointIds[pointIndex]
          if (!vehicleId || !pointId) return null
          return {
            tow_point_id: pointId,
            tow_vehicle_id: vehicleId,
            action: point.point_type,
          }
        })
        .filter((row): row is { tow_point_id: string; tow_vehicle_id: string; action: PreparedTowPoint['point_type'] } => row !== null)
    )

    const [pointsInsertResult] = await Promise.all([
      pointRows.length > 0
        ? supabase.from('tow_points').insert(pointRows)
        : Promise.resolve({ error: null } as { error: any }),
    ])

    if (pointsInsertResult.error) {
      throw pointsInsertResult.error
    }

    if (pointVehicleRows.length > 0) {
      const { error: pointVehiclesError } = await supabase
        .from('tow_point_vehicles')
        .insert(pointVehicleRows)

      if (pointVehiclesError) {
        throw pointVehiclesError
      }
    }
  }

  return true
}

// ==================== מחיקת גרירה ====================

export async function deleteTow(towId: string) {
  // מחיקת נקודות קודם (כולל רכבים ותמונות)
  const { data: points } = await supabase
    .from('tow_points')
    .select('id')
    .eq('tow_id', towId)
  
  if (points && points.length > 0) {
    const pointIds = points.map(p => p.id)
    await supabase.from('tow_images').delete().in('tow_point_id', pointIds)
    await supabase.from('tow_point_vehicles').delete().in('tow_point_id', pointIds)
  }
  await supabase.from('tow_points').delete().eq('tow_id', towId)
  
  await supabase.from('stored_vehicles').delete().eq('tow_id', towId)
  // מחיקת legs ו-vehicles
  await supabase.from('tow_legs').delete().eq('tow_id', towId)
  await supabase.from('tow_vehicles').delete().eq('tow_id', towId)
  
  const { error } = await supabase
    .from('tows')
    .delete()
    .eq('id', towId)

  if (error) {
    console.error('Error deleting tow:', error)
    throw error
  }

  return true
}

// ==================== חישוב מחיר מחדש לפי תאריך ====================

export async function recalculateTowPrice(
  towId: string,
  newScheduledAt: Date,
  companyId: string
): Promise<{ oldPrice: number; newPrice: number; newBreakdown: PriceBreakdown } | null> {
  // שליפת הגרירה
  const tow = await getTow(towId)
  if (!tow || !tow.price_breakdown) return null

  const oldPrice = tow.final_price || 0
  const breakdown = { ...tow.price_breakdown }

  // שליפת תוספות זמן
  const { data: timeSurcharges } = await supabase
    .from('time_surcharges')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (!timeSurcharges) return null

  // חישוב תוספות זמן חדשות
  const hour = newScheduledAt.getHours()
  const minute = newScheduledAt.getMinutes()
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  const dayOfWeek = newScheduledAt.getDay() // 0 = Sunday, 6 = Saturday

  const isSaturdayDay = dayOfWeek === 6
  const isFridayDay = dayOfWeek === 5

  let activeTimeSurcharges: typeof timeSurcharges = []

  // שבת - רק תוספת שבת (ללא בדיקת שעות)
  if (isSaturdayDay) {
    activeTimeSurcharges = timeSurcharges.filter(s => s.day_type === 'saturday')
  }
  // שישי - בדיקה אם עברנו את השעה שהוגדרה
  else if (isFridayDay) {
    const fridaySurcharge = timeSurcharges.find(s => s.day_type === 'friday')
    
    if (fridaySurcharge) {
      if (fridaySurcharge.time_start) {
        const [startHours, startMinutes] = fridaySurcharge.time_start.split(':').map(Number)
        const timeValue = hour * 60 + minute
        const startValue = startHours * 60 + startMinutes
        
        if (timeValue >= startValue) {
          activeTimeSurcharges = [fridaySurcharge]
        }
        // אחרת - ללא תוספות (מערך ריק)
      } else {
        // שישי כל היום
        activeTimeSurcharges = [fridaySurcharge]
      }
    }
    // אין תוספת שישי מוגדרת = ללא תוספות
  }
  // ראשון-חמישי - בדיקת תוספות ערב/לילה לפי שעות
  else {
    activeTimeSurcharges = timeSurcharges.filter(surcharge => {
      // לא כולל תוספות של שבת/שישי/חג
      if (surcharge.day_type === 'saturday' || surcharge.day_type === 'friday' || surcharge.day_type === 'holiday') {
        return false
      }
      
      // בדיקת שעות
      if (surcharge.time_start && surcharge.time_end) {
        const start = surcharge.time_start
        const end = surcharge.time_end

        if (start < end) {
          // טווח רגיל (למשל 15:00-19:00)
          if (timeStr < start || timeStr >= end) return false
        } else {
          // טווח שחוצה חצות (למשל 19:00-07:00)
          if (timeStr < start && timeStr >= end) return false
        }
      } else {
        // אין טווח שעות מוגדר = לא מחזירים
        return false
      }

      return true
    })
  }

  // חישוב הסכום הבסיסי (בלי תוספות זמן)
  const baseSubtotal = breakdown.base_price + breakdown.distance_price

  // חישוב תוספות זמן חדשות
  const newTimeSurcharges = activeTimeSurcharges.map(s => ({
    id: s.id,
    label: s.label,
    percent: s.surcharge_percent,
    amount: Math.round(baseSubtotal * s.surcharge_percent / 100)
  }))
  
  // לוקחים רק את התוספת הגבוהה ביותר
  const timeAmount = newTimeSurcharges.reduce((max, s) => Math.max(max, s.amount), 0)

  // תוספות מיקום ושירותים נשארות כמו שהיו
  const locationAmount = (breakdown.location_surcharges ?? []).reduce((sum, s) => sum + s.amount, 0)
  const servicesAmount = (breakdown.service_surcharges ?? []).reduce((sum, s) => sum + s.amount, 0)

  // חישוב סופי
  const beforeDiscount = baseSubtotal + timeAmount + locationAmount + servicesAmount
  const discountAmount = Math.round(beforeDiscount * breakdown.discount_percent / 100)
  const beforeVat = beforeDiscount - discountAmount
  const companySettings = await getCompanySettings(companyId)
  const vatRate = (companySettings?.default_vat_percent ?? 18) / 100
  const vatAmount = Math.round(beforeVat * vatRate)
  const newTotal = beforeVat + vatAmount

  // שמירת רק התוספת הגבוהה ביותר ב-breakdown
  const highestSurcharge = newTimeSurcharges.length > 0 
    ? [newTimeSurcharges.reduce((max, s) => s.amount > max.amount ? s : max, newTimeSurcharges[0])]
    : []

  const newBreakdown: PriceBreakdown = {
    ...breakdown,
    time_surcharges: highestSurcharge,
    subtotal: beforeDiscount,
    discount_amount: discountAmount,
    vat_amount: vatAmount,
    total: newTotal
  }

  return {
    oldPrice,
    newPrice: newTotal,
    newBreakdown
  }
}

// שמירת לוג שינויים
export async function saveTowChangeLogs(
  towId: string,
  changedBy: string,
  changes: { field_name: string; old_value: string | null; new_value: string | null }[]
) {
  if (changes.length === 0) return
  const { error } = await supabase
    .from('tow_change_log')
    .insert(changes.map(c => ({
      tow_id: towId,
      changed_by: changedBy,
      field_name: c.field_name,
      old_value: c.old_value,
      new_value: c.new_value
    })))
  if (error) throw error
}

// טעינת לוג שינויים
export async function getTowChangeLogs(towId: string): Promise<TowChangeLog[]> {
  const { data, error } = await supabase
    .from('tow_change_log')
    .select(`
      *,
      user:users!tow_change_log_changed_by_fkey (
        full_name
      )
    `)
    .eq('tow_id', towId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return data || []
}
