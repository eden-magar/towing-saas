import { supabase } from '../supabase'

// ==================== טיפוסים ====================

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

export interface TowWithDetails {
  id: string
  company_id: string
  customer_id: string | null
  driver_id: string | null
  truck_id: string | null
  created_by: string | null
  tow_type: 'simple' | 'with_base' | 'transfer' | 'multi_vehicle'
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
  notes: string | null
  recommended_price: number | null
  final_price: number | null
  price_list_id: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  // שדות מורחבים
  customer: {
    id: string
    name: string
    phone: string | null
  } | null
  driver: {
    id: string
    user: {
      full_name: string
      phone: string | null
    }
  } | null
  truck: {
    id: string
    plate_number: string
  } | null
  vehicles: TowVehicle[]
  legs: TowLeg[]
}

// ==================== שליפת גרירות ====================

export async function getTows(companyId: string): Promise<TowWithDetails[]> {
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

  return tows.map(tow => ({
    ...tow,
    customer: tow.customer as any,
    driver: tow.driver as any,
    truck: tow.truck as any,
    vehicles: vehiclesByTow[tow.id] || [],
    legs: legsByTow[tow.id] || []
  }))
}

// ==================== שליפת גרירה בודדת ====================

export async function getTow(towId: string): Promise<TowWithDetails | null> {
  const { data: tow, error } = await supabase
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
    .eq('id', towId)
    .single()

  if (error) {
    console.error('Error fetching tow:', error)
    throw error
  }

  if (!tow) return null

  // שליפת כלי רכב
  const { data: vehicles } = await supabase
    .from('tow_vehicles')
    .select('*')
    .eq('tow_id', towId)
    .order('order_index', { ascending: true })

  // שליפת רגליים
  const { data: legs } = await supabase
    .from('tow_legs')
    .select('*')
    .eq('tow_id', towId)
    .order('leg_order', { ascending: true })

  return {
    ...tow,
    customer: tow.customer as any,
    driver: tow.driver as any,
    truck: tow.truck as any,
    vehicles: vehicles || [],
    legs: legs || []
  }
}

// ==================== יצירת גרירה ====================

interface CreateTowInput {
  companyId: string
  createdBy: string
  customerId?: string
  driverId?: string
  truckId?: string
  towType: 'simple' | 'with_base' | 'transfer' | 'multi_vehicle'
  scheduledAt?: string
  notes?: string
  finalPrice?: number
  vehicles: {
    plateNumber: string
    manufacturer?: string
    model?: string
    year?: number
    vehicleType?: 'motorcycle' | 'small' | 'medium' | 'large' | 'truck'
    color?: string
    isWorking?: boolean
    towReason?: string
    notes?: string
    driveType?: string
    fuelType?: string
    totalWeight?: number
    gearType?: string
    driveTechnology?: string

  }[]
  legs: {
    legType: 'empty_drive' | 'pickup' | 'delivery'
    fromAddress?: string
    toAddress?: string
    towVehicleIndex?: number // אינדקס של הרכב ב-vehicles array
  }[]
}

export async function createTow(input: CreateTowInput) {
  const towId = crypto.randomUUID()
  const status = input.driverId ? 'assigned' : 'pending'

  // יצירת הגרירה
  const { error: towError } = await supabase
    .from('tows')
    .insert({
      id: towId,
      company_id: input.companyId,
      created_by: input.createdBy,
      customer_id: input.customerId || null,
      driver_id: input.driverId || null,
      truck_id: input.truckId || null,
      tow_type: input.towType,
      status,
      scheduled_at: input.scheduledAt || null,
      notes: input.notes || null,
      final_price: input.finalPrice || null
    })

  if (towError) {
    console.error('Error creating tow:', JSON.stringify(towError, null, 2))
    throw towError
  }

  // יצירת כלי רכב
  const vehicleIds: string[] = []
  for (let i = 0; i < input.vehicles.length; i++) {
    const v = input.vehicles[i]
    const vehicleId = crypto.randomUUID()
    vehicleIds.push(vehicleId)

    const { error: vehicleError } = await supabase
      .from('tow_vehicles')
      .insert({
        id: vehicleId,
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
      })

    if (vehicleError) {
      console.error('Error creating tow vehicle:', vehicleError)
      // ניקוי - מחיקת הגרירה
      await supabase.from('tows').delete().eq('id', towId)
      throw vehicleError
    }
  }

  // בדיקה אם יש delivery leg - אם לא, ניצור אוטומטית
  let legsToCreate = [...input.legs]
  const hasDelivery = legsToCreate.some(l => l.legType === 'delivery')
  const pickupLeg = legsToCreate.find(l => l.legType === 'pickup')
  
  if (!hasDelivery && pickupLeg) {
    // יצירת delivery leg אוטומטית עם היעד של ה-pickup
    legsToCreate.push({
      legType: 'delivery',
      fromAddress: pickupLeg.toAddress,
      toAddress: pickupLeg.toAddress
    })
  }

  // יצירת רגליים
  for (let i = 0; i < legsToCreate.length; i++) {
    const leg = legsToCreate[i]
    const towVehicleId = leg.towVehicleIndex !== undefined ? vehicleIds[leg.towVehicleIndex] : null

    const { error: legError } = await supabase
      .from('tow_legs')
      .insert({
        tow_id: towId,
        tow_vehicle_id: towVehicleId,
        leg_type: leg.legType,
        leg_order: i,
        from_address: leg.fromAddress || null,
        to_address: leg.toAddress || null,
        status: 'pending'
      })

    if (legError) {
      console.error('Error creating tow leg:', legError)
      // ניקוי
      await supabase.from('tow_vehicles').delete().eq('tow_id', towId)
      await supabase.from('tows').delete().eq('id', towId)
      throw legError
    }
  }

  return { id: towId }
}

// ==================== עדכון סטטוס גרירה ====================

export async function updateTowStatus(
  towId: string, 
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
) {
  const updates: Record<string, any> = { status }
  
  if (status === 'in_progress') {
    updates.started_at = new Date().toISOString()
  } else if (status === 'completed' || status === 'cancelled') {
    updates.completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('tows')
    .update(updates)
    .eq('id', towId)

  if (error) {
    console.error('Error updating tow status:', error)
    throw error
  }

  return true
}

// ==================== שיוך נהג לגרירה ====================

export async function assignDriver(towId: string, driverId: string, truckId?: string) {
  const { error } = await supabase
    .from('tows')
    .update({
      driver_id: driverId,
      truck_id: truckId || null,
      status: 'assigned'
    })
    .eq('id', towId)

  if (error) {
    console.error('Error assigning driver:', error)
    throw error
  }

  return true
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
  notes?: string | null
  finalPrice?: number | null
  scheduledAt?: string | null
  vehicles?: {
    id?: string // אם קיים - עדכון, אם לא - יצירה
    plateNumber: string
    manufacturer?: string
    model?: string
    year?: number
    vehicleType?: 'motorcycle' | 'small' | 'medium' | 'large' | 'truck'
    color?: string
    isWorking?: boolean
    towReason?: string
    notes?: string
  }[]
  legs?: {
    id?: string
    legType: 'empty_drive' | 'pickup' | 'delivery'
    fromAddress?: string
    toAddress?: string
  }[]
}

export async function updateTow(input: UpdateTowInput) {
  // עדכון פרטי הגרירה הבסיסיים
  const towUpdates: Record<string, any> = {}
  
  if (input.customerId !== undefined) towUpdates.customer_id = input.customerId
  if (input.notes !== undefined) towUpdates.notes = input.notes
  if (input.finalPrice !== undefined) towUpdates.final_price = input.finalPrice
  if (input.scheduledAt !== undefined) towUpdates.scheduled_at = input.scheduledAt  // הוספת זה


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

  // עדכון רכבים - מחיקה ויצירה מחדש (פשוט יותר)
  if (input.vehicles) {
    // מחיקת רכבים קיימים
    await supabase.from('tow_vehicles').delete().eq('tow_id', input.towId)

    // יצירת רכבים חדשים
    for (let i = 0; i < input.vehicles.length; i++) {
      const v = input.vehicles[i]
      const { error: vehicleError } = await supabase
        .from('tow_vehicles')
        .insert({
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
          order_index: i
        })

      if (vehicleError) {
        console.error('Error updating tow vehicle:', vehicleError)
        throw vehicleError
      }
    }
  }

  // עדכון רגליים
  if (input.legs) {
    // מחיקת רגליים קיימות
    await supabase.from('tow_legs').delete().eq('tow_id', input.towId)

    // יצירת רגליים חדשות
    for (let i = 0; i < input.legs.length; i++) {
      const leg = input.legs[i]
      const { error: legError } = await supabase
        .from('tow_legs')
        .insert({
          tow_id: input.towId,
          leg_type: leg.legType,
          leg_order: i,
          from_address: leg.fromAddress || null,
          to_address: leg.toAddress || null,
          status: 'pending'
        })

      if (legError) {
        console.error('Error updating tow leg:', legError)
        throw legError
      }
    }
  }

  return true
}

// ==================== מחיקת גרירה ====================

export async function deleteTow(towId: string) {
  // מחיקת רגליים
  await supabase.from('tow_legs').delete().eq('tow_id', towId)
  
  // מחיקת כלי רכב
  await supabase.from('tow_vehicles').delete().eq('tow_id', towId)
  
  // מחיקת הגרירה
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