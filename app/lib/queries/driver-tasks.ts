import { supabase } from '../supabase'

// ==================== טיפוסים ====================

export interface DriverTaskVehicle {
  id: string
  plate_number: string
  manufacturer: string | null
  model: string | null
  year: number | null
  color: string | null
  is_working: boolean | null
  tow_reason: string | null
  fuel_type: string | null
  drive_type: string | null
  gear_type: string | null
  total_weight: number | null
  drive_technology: string | null
}

export interface DriverTaskLeg {
  id: string
  leg_type: 'empty_drive' | 'pickup' | 'delivery'
  leg_order: number
  from_address: string | null
  to_address: string | null
  distance_km: number | null
  status: 'pending' | 'in_progress' | 'completed' | null
}

export interface DriverTaskPoint {
  id: string
  point_order: number
  point_type: 'pickup' | 'dropoff'
  address: string | null
  lat: number | null
  lng: number | null
  contact_name: string | null
  contact_phone: string | null
  status: 'pending' | 'arrived' | 'completed' | 'skipped'
  arrived_at: string | null
  completed_at: string | null
  recipient_name: string | null
  recipient_phone: string | null
  notes: string | null
  point_vehicles?: { id: string; tow_vehicle_id: string; action: string }[]
}

export interface DriverTask {
  id: string
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  tow_type: 'simple' | 'with_base' | 'transfer' | 'multi_vehicle' | 'custom'
  scheduled_at: string | null
  notes: string | null
  created_at: string
  customer: {
    id: string
    name: string
    phone: string | null
  } | null
  truck: {
    id: string
    plate_number: string
  } | null
  vehicles: DriverTaskVehicle[]
  legs: DriverTaskLeg[]
  points: DriverTaskPoint[]
}

export interface DriverInfo {
  id: string
  company_id: string
  status: 'available' | 'busy' | 'unavailable' | null
  truck: {
    id: string
    plate_number: string
    manufacturer: string | null
    model: string | null
  } | null
  user: {
    full_name: string
    phone: string | null
  }
}

export type TowImageType = 'before_pickup' | 'after_pickup' | 'before_dropoff' | 'after_dropoff' | 'damage' | 'other'

export interface TowImage {
  id: string
  tow_id: string
  tow_point_id: string | null
  tow_vehicle_id: string | null
  uploaded_by: string
  image_url: string
  image_type: TowImageType
  notes: string | null
  created_at: string
}

export interface TowStatusHistoryEntry {
  id: string
  tow_id: string
  tow_leg_id: string | null
  status: string
  changed_by: string
  notes: string | null
  created_at: string
}

export interface TaskDetailFull {
  id: string
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  tow_type: 'simple' | 'with_base' | 'transfer' | 'multi_vehicle' | 'custom'
  scheduled_at: string | null
  notes: string | null
  final_price: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  customer: {
    id: string
    name: string
    phone: string | null
    email: string | null
    customer_type: 'private' | 'business' | 'insurance' | 'fleet' | null
  } | null
  truck: {
    id: string
    plate_number: string
    manufacturer: string | null
    model: string | null
  } | null
  vehicles: DriverTaskVehicle[]
  legs: DriverTaskLeg[]
  points: DriverTaskPoint[]
  images: TowImage[]
}

// ==================== שליפת פרטי נהג ====================

export async function getDriverByUserId(userId: string): Promise<DriverInfo | null> {
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('id, status, company_id')
    .eq('user_id', userId)
    .single()

  if (driverError || !driver) {
    console.error('Error fetching driver:', driverError)
    return null
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('full_name, phone')
    .eq('id', userId)
    .single()

  if (userError) {
    console.error('Error fetching user:', userError)
    return null
  }

  const { data: assignment } = await supabase
    .from('driver_truck_assignments')
    .select(`
      truck:tow_trucks (
        id,
        plate_number,
        manufacturer,
        model
      )
    `)
    .eq('driver_id', driver.id)
    .eq('is_current', true)
    .single()

  return {
    id: driver.id,
    company_id: driver.company_id,
    status: driver.status,
    truck: assignment?.truck as any || null,
    user: user
  }
}

// ==================== שליפת משימות הנהג ====================

export async function getDriverTasks(driverId: string): Promise<DriverTask[]> {
  const { data: tows, error } = await supabase
    .from('tows')
    .select(`
      id,
      status,
      tow_type,
      scheduled_at,
      notes,
      created_at,
      customer:customers (
        id,
        name,
        phone
      ),
      truck:tow_trucks (
        id,
        plate_number
      )
    `)
    .eq('driver_id', driverId)
    .in('status', ['assigned', 'in_progress'])
    .order('scheduled_at', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching driver tasks:', error)
    throw error
  }

  if (!tows || tows.length === 0) return []

  const towIds = tows.map(t => t.id)

  // שליפת כלי רכב
  const { data: vehicles } = await supabase
    .from('tow_vehicles')
    .select('*')
    .in('tow_id', towIds)
    .order('order_index', { ascending: true })

  // שליפת רגליים (לתאימות לאחור)
  const { data: legs } = await supabase
    .from('tow_legs')
    .select('*')
    .in('tow_id', towIds)
    .order('leg_order', { ascending: true })

  // שליפת נקודות
  const { data: points } = await supabase
    .from('tow_points')
    .select('*')
    .in('tow_id', towIds)
    .order('point_order', { ascending: true })

  // מיפוי לפי tow_id
  const vehiclesByTow: Record<string, DriverTaskVehicle[]> = {}
  vehicles?.forEach(v => {
    if (!vehiclesByTow[v.tow_id]) vehiclesByTow[v.tow_id] = []
    vehiclesByTow[v.tow_id].push(v)
  })

  const legsByTow: Record<string, DriverTaskLeg[]> = {}
  legs?.forEach(l => {
    if (!legsByTow[l.tow_id]) legsByTow[l.tow_id] = []
    legsByTow[l.tow_id].push(l)
  })

  const pointsByTow: Record<string, DriverTaskPoint[]> = {}
  points?.forEach(p => {
    if (!pointsByTow[p.tow_id]) pointsByTow[p.tow_id] = []
    pointsByTow[p.tow_id].push(p)
  })

  return tows.map(tow => ({
    id: tow.id,
    status: tow.status,
    tow_type: tow.tow_type,
    scheduled_at: tow.scheduled_at,
    notes: tow.notes,
    created_at: tow.created_at,
    customer: tow.customer as any,
    truck: tow.truck as any,
    vehicles: vehiclesByTow[tow.id] || [],
    legs: legsByTow[tow.id] || [],
    points: pointsByTow[tow.id] || []
  }))
}

// ==================== משימות היום בלבד ====================

export async function getDriverTasksToday(driverId: string): Promise<DriverTask[]> {
  const today = new Date().toISOString().split('T')[0]
  
  const { data: tows, error } = await supabase
    .from('tows')
    .select(`
      id,
      status,
      tow_type,
      scheduled_at,
      notes,
      created_at,
      customer:customers (
        id,
        name,
        phone
      ),
      truck:tow_trucks (
        id,
        plate_number
      )
    `)
    .eq('driver_id', driverId)
    .neq('status', 'cancelled')
    .or(`scheduled_at.gte.${today}T00:00:00,created_at.gte.${today}T00:00:00`)
    .order('scheduled_at', { ascending: true })

  if (error) {
    console.error('Error fetching driver tasks today:', error)
    throw error
  }

  if (!tows || tows.length === 0) return []

  const towIds = tows.map(t => t.id)

  const { data: vehicles } = await supabase
    .from('tow_vehicles')
    .select('*')
    .in('tow_id', towIds)

  const { data: legs } = await supabase
    .from('tow_legs')
    .select('*')
    .in('tow_id', towIds)
    .order('leg_order', { ascending: true })

  const { data: points } = await supabase
    .from('tow_points')
    .select('*')
    .in('tow_id', towIds)
    .order('point_order', { ascending: true })

  const vehiclesByTow: Record<string, DriverTaskVehicle[]> = {}
  vehicles?.forEach(v => {
    if (!vehiclesByTow[v.tow_id]) vehiclesByTow[v.tow_id] = []
    vehiclesByTow[v.tow_id].push(v)
  })

  const legsByTow: Record<string, DriverTaskLeg[]> = {}
  legs?.forEach(l => {
    if (!legsByTow[l.tow_id]) legsByTow[l.tow_id] = []
    legsByTow[l.tow_id].push(l)
  })

  const pointsByTow: Record<string, DriverTaskPoint[]> = {}
  points?.forEach(p => {
    if (!pointsByTow[p.tow_id]) pointsByTow[p.tow_id] = []
    pointsByTow[p.tow_id].push(p)
  })

  return tows.map(tow => ({
    id: tow.id,
    status: tow.status,
    tow_type: tow.tow_type,
    scheduled_at: tow.scheduled_at,
    notes: tow.notes,
    created_at: tow.created_at,
    customer: tow.customer as any,
    truck: tow.truck as any,
    vehicles: vehiclesByTow[tow.id] || [],
    legs: legsByTow[tow.id] || [],
    points: pointsByTow[tow.id] || []
  }))
}

// ==================== שליפת פרטי משימה מלאים ====================

export async function getTaskDetail(towId: string): Promise<TaskDetailFull | null> {
  const { data: tow, error } = await supabase
    .from('tows')
    .select(`
      id,
      status,
      tow_type,
      scheduled_at,
      notes,
      final_price,
      started_at,
      completed_at,
      created_at,
      customer:customers (
        id,
        name,
        phone,
        email,
        customer_type
      ),
      truck:tow_trucks (
        id,
        plate_number,
        manufacturer,
        model
      )
    `)
    .eq('id', towId)
    .single()

  if (error || !tow) {
    console.error('Error fetching task detail:', error)
    return null
  }

  // שליפת כלי רכב
  const { data: vehicles } = await supabase
    .from('tow_vehicles')
    .select('*')
    .eq('tow_id', towId)
    .order('order_index', { ascending: true })

  // שליפת רגליים (לתאימות לאחור)
  const { data: legs } = await supabase
    .from('tow_legs')
    .select('*')
    .eq('tow_id', towId)
    .order('leg_order', { ascending: true })

  // שליפת נקודות עם רכבים משויכים
  const { data: points } = await supabase
    .from('tow_points')
    .select(`
      *,
      point_vehicles:tow_point_vehicles (
        id,
        tow_vehicle_id,
        action
      )
    `)
    .eq('tow_id', towId)
    .order('point_order', { ascending: true })

  // שליפת תמונות
  const { data: images } = await supabase
    .from('tow_images')
    .select('*')
    .eq('tow_id', towId)
    .order('created_at', { ascending: true })

  return {
    id: tow.id,
    status: tow.status,
    tow_type: tow.tow_type,
    scheduled_at: tow.scheduled_at,
    notes: tow.notes,
    final_price: tow.final_price,
    started_at: tow.started_at,
    completed_at: tow.completed_at,
    created_at: tow.created_at,
    customer: tow.customer as any,
    truck: tow.truck as any,
    vehicles: vehicles || [],
    legs: legs || [],
    points: points || [],
    images: images || []
  }
}

// ==================== סטטיסטיקות נהג ====================

export async function getDriverStats(driverId: string) {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { count: todayCount } = await supabase
    .from('tows')
    .select('*', { count: 'exact', head: true })
    .eq('driver_id', driverId)
    .gte('created_at', `${today}T00:00:00`)

  const { count: weekCompleted } = await supabase
    .from('tows')
    .select('*', { count: 'exact', head: true })
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .gte('completed_at', `${weekAgo}T00:00:00`)

  return {
    todayTasks: todayCount || 0,
    weekCompleted: weekCompleted || 0
  }
}

// ==================== עדכון סטטוס נהג ====================

export async function updateDriverStatus(
  driverId: string, 
  status: 'available' | 'busy' | 'unavailable'
) {
  const { error } = await supabase
    .from('drivers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', driverId)

  if (error) {
    console.error('Error updating driver status:', error)
    throw error
  }

  return true
}

// ==================== קבלת/דחיית משימה ====================

export async function acceptTask(towId: string) {
  const { error } = await supabase
    .from('tows')
    .update({ 
      status: 'in_progress',
      started_at: new Date().toISOString()
    })
    .eq('id', towId)

  if (error) {
    console.error('Error accepting task:', error)
    throw error
  }

  return true
}

export async function rejectTask(towId: string, reason: string, note?: string) {
  const { error } = await supabase
    .from('tows')
    .update({ 
      driver_id: null,
      truck_id: null,
      status: 'pending',
      notes: note ? `דחייה: ${reason} - ${note}` : `דחייה: ${reason}`
    })
    .eq('id', towId)

  if (error) {
    console.error('Error rejecting task:', error)
    throw error
  }

  return true
}

// ==================== עדכון סטטוס גרירה ====================

export async function updateTaskStatus(
  towId: string, 
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
) {
  const updates: Record<string, any> = { 
    status,
    updated_at: new Date().toISOString()
  }
  
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
    console.error('Error updating task status:', error)
    throw error
  }

  return true
}

// ==================== עדכון סטטוס עם היסטוריה ====================

export async function updateTaskStatusWithHistory(
  towId: string, 
  status: string,
  userId: string,
  legId?: string,
  notes?: string
) {
  // רישום בהיסטוריה
  await supabase
    .from('tow_status_history')
    .insert({
      tow_id: towId,
      tow_leg_id: legId || null,
      status,
      changed_by: userId,
      notes: notes || null
    })

  // עדכון סטטוס הגרירה
  const updates: Record<string, any> = { 
    status,
    updated_at: new Date().toISOString()
  }
  
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
    console.error('Error updating task status:', error)
    throw error
  }

  return true
}

// ==================== עדכון סטטוס רגל (לתאימות לאחור) ====================

export async function updateLegStatus(
  legId: string,
  status: 'pending' | 'in_progress' | 'completed'
) {
  const { error } = await supabase
    .from('tow_legs')
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', legId)

  if (error) {
    console.error('Error updating leg status:', error)
    throw error
  }

  return true
}

// ==================== עדכון סטטוס נקודה ====================

export async function updatePointStatus(
  pointId: string,
  status: 'pending' | 'arrived' | 'completed' | 'skipped',
  recipientName?: string,
  recipientPhone?: string,
  notes?: string
) {
  const updates: Record<string, any> = { 
    status,
    updated_at: new Date().toISOString()
  }
  
  if (status === 'arrived') {
    updates.arrived_at = new Date().toISOString()
  } else if (status === 'completed') {
    updates.completed_at = new Date().toISOString()
    if (recipientName) updates.recipient_name = recipientName
    if (recipientPhone) updates.recipient_phone = recipientPhone
    if (notes) updates.notes = notes
  }

  const { error } = await supabase
    .from('tow_points')
    .update(updates)
    .eq('id', pointId)

  if (error) {
    console.error('Error updating point status:', error)
    throw error
  }

  return true
}

// ==================== העלאת תמונה ====================

export async function uploadTowImage(
  towId: string,
  userId: string,
  imageType: TowImageType,
  imageFile: File,
  pointId?: string,
  vehicleId?: string,
  notes?: string
): Promise<TowImage | null> {
  const fileName = `${towId}/${imageType}_${Date.now()}.jpg`
  
  const { error: uploadError } = await supabase
    .storage
    .from('tow-images')
    .upload(fileName, imageFile)

  if (uploadError) {
    console.error('Error uploading image:', uploadError)
    throw uploadError
  }

  const { data: urlData } = supabase
    .storage
    .from('tow-images')
    .getPublicUrl(fileName)

  const { data: image, error: insertError } = await supabase
    .from('tow_images')
    .insert({
      tow_id: towId,
      tow_point_id: pointId || null,
      tow_vehicle_id: vehicleId || null,
      uploaded_by: userId,
      image_url: urlData.publicUrl,
      image_type: imageType,
      notes: notes || null
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error saving image record:', insertError)
    throw insertError
  }

  return image
}

// ==================== מחיקת תמונה ====================

export async function deleteTowImage(imageId: string, imageUrl: string) {
  const path = imageUrl.split('/tow-images/')[1]
  if (path) {
    await supabase.storage.from('tow-images').remove([path])
  }

  const { error } = await supabase
    .from('tow_images')
    .delete()
    .eq('id', imageId)

  if (error) {
    console.error('Error deleting image:', error)
    throw error
  }

  return true
}

// ==================== שליפת תמונות לפי נקודה ====================

export async function getPointImages(pointId: string): Promise<TowImage[]> {
  const { data, error } = await supabase
    .from('tow_images')
    .select('*')
    .eq('tow_point_id', pointId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching point images:', error)
    return []
  }

  return data || []
}

// ==================== שליפת היסטוריית סטטוסים ====================

export async function getTowStatusHistory(towId: string): Promise<TowStatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from('tow_status_history')
    .select('*')
    .eq('tow_id', towId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching status history:', error)
    return []
  }

  return data || []
}

// ==================== פונקציות עזר לנקודות ====================

export function areAllPointsCompleted(points: DriverTaskPoint[]): boolean {
  return points.every(p => p.status === 'completed' || p.status === 'skipped')
}

export function getCurrentPoint(points: DriverTaskPoint[]): DriverTaskPoint | null {
  return points.find(p => p.status !== 'completed' && p.status !== 'skipped') || null
}

export function getCurrentPointIndex(points: DriverTaskPoint[]): number {
  const index = points.findIndex(p => p.status !== 'completed' && p.status !== 'skipped')
  return index === -1 ? points.length : index
}