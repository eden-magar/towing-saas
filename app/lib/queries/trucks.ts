import { supabase } from '../supabase'
import { TruckWithDetails } from '../types'

// ==================== העלאת קבצים ====================

export async function uploadTruckDocument(
  file: File,
  companyId: string,
  truckPlate: string,
  docType: string
): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${companyId}/${truckPlate}/${docType}_${Date.now()}.${fileExt}`

  const { error } = await supabase.storage
    .from('truck-documents')
    .upload(fileName, file, { upsert: true })

  if (error) {
    console.error('Error uploading file:', error)
    throw error
  }

  const { data } = supabase.storage
    .from('truck-documents')
    .getPublicUrl(fileName)

  return data.publicUrl
}

export async function deleteTruckDocument(url: string): Promise<void> {
  // מחלץ את הנתיב מה-URL
  const path = url.split('/truck-documents/')[1]
  if (path) {
    await supabase.storage.from('truck-documents').remove([path])
  }
}

// ==================== שליפת משאיות ====================

export async function getTrucks(companyId: string): Promise<TruckWithDetails[]> {
  const { data: trucks, error } = await supabase
    .from('tow_trucks')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching trucks:', error)
    throw error
  }

  if (!trucks) return []

  // שליפת שיוכי נהגים נוכחיים
  const { data: assignments } = await supabase
    .from('driver_truck_assignments')
    .select(`
      truck_id,
      driver:drivers (
        id,
        user:users!user_id (
          full_name,
          phone
        )
      )
    `)
    .eq('is_current', true)
    .in('truck_id', trucks.map(t => t.id))

  // שליפת ספירת גרירות היום
  const today = new Date().toISOString().split('T')[0]
  const { data: towCounts } = await supabase
    .from('tows')
    .select('truck_id')
    .eq('company_id', companyId)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)

  // מיפוי ספירות
  const countByTruck: Record<string, number> = {}
  towCounts?.forEach(tow => {
    if (tow.truck_id) {
      countByTruck[tow.truck_id] = (countByTruck[tow.truck_id] || 0) + 1
    }
  })

  // מיפוי שיוכים
const assignmentByTruck: Record<string, { id: string; user: { full_name: string; phone: string } }> = {}
assignments?.forEach(a => {
  const driver = a.driver as unknown as { id: string; user: { full_name: string; phone: string } | null }
  if (driver && driver.user && driver.user.full_name) {
    assignmentByTruck[a.truck_id] = {
      id: driver.id,
      user: driver.user
    }
  }
})

  return trucks.map(truck => ({
    ...truck,
    assigned_driver: assignmentByTruck[truck.id] || null,
    today_tows_count: countByTruck[truck.id] || 0
  }))
}

// ==================== הוספת משאית ====================

interface CreateTruckInput {
  companyId: string
  plateNumber: string
  truckType: string
  manufacturer?: string
  model?: string
  year?: number
  color?: string
  vehicleCapacity: number
  maxWeightKg?: number
  permittedWeightKg?: number
  upperPlatformWeightKg?: number
  lowerPlatformWeightKg?: number
  licenseExpiry?: string
  insuranceExpiry?: string
  // שדות חדשים
  licensePhotoUrl?: string
  tachographExpiry?: string
  tachographPhotoUrl?: string
  engineerReportExpiry?: string
  engineerReportPhotoUrl?: string
  lastWinterInspection?: string
  //
  notes?: string
  isActive: boolean
  driverId?: string
}

export async function createTruck(input: CreateTruckInput) {
  const { data: truck, error } = await supabase
    .from('tow_trucks')
    .insert({
      company_id: input.companyId,
      plate_number: input.plateNumber,
      truck_type: input.truckType,
      manufacturer: input.manufacturer || null,
      model: input.model || null,
      year: input.year || null,
      color: input.color || null,
      vehicle_capacity: input.vehicleCapacity,
      max_weight_kg: input.maxWeightKg || null,
      permitted_weight_kg: input.permittedWeightKg || null,
      upper_platform_weight_kg: input.upperPlatformWeightKg || null,
      lower_platform_weight_kg: input.lowerPlatformWeightKg || null,
      license_expiry: input.licenseExpiry || null,
      insurance_expiry: input.insuranceExpiry || null,
      // שדות חדשים
      license_photo_url: input.licensePhotoUrl || null,
      tachograph_expiry: input.tachographExpiry || null,
      tachograph_photo_url: input.tachographPhotoUrl || null,
      engineer_report_expiry: input.engineerReportExpiry || null,
      engineer_report_photo_url: input.engineerReportPhotoUrl || null,
      last_winter_inspection: input.lastWinterInspection || null,
      //
      notes: input.notes || null,
      is_active: input.isActive
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating truck:', error)
    throw error
  }

  // שיוך נהג אם נבחר
  if (input.driverId) {
    await supabase
      .from('driver_truck_assignments')
      .insert({
        driver_id: input.driverId,
        truck_id: truck.id,
        is_current: true,
        assigned_at: new Date().toISOString()
      })
  }

  return truck
}

// ==================== עריכת משאית ====================

interface UpdateTruckInput {
  truckId: string
  plateNumber?: string
  truckType?: string
  manufacturer?: string
  model?: string
  year?: number
  color?: string
  vehicleCapacity?: number
  maxWeightKg?: number
  permittedWeightKg?: number
  upperPlatformWeightKg?: number
  lowerPlatformWeightKg?: number
  licenseExpiry?: string
  insuranceExpiry?: string
  // שדות חדשים
  licensePhotoUrl?: string
  tachographExpiry?: string
  tachographPhotoUrl?: string
  engineerReportExpiry?: string
  engineerReportPhotoUrl?: string
  lastWinterInspection?: string
  //
  notes?: string
  isActive?: boolean
  driverId?: string | null
}

export async function updateTruck(input: UpdateTruckInput) {
  const { error } = await supabase
    .from('tow_trucks')
    .update({
      plate_number: input.plateNumber,
      truck_type: input.truckType,
      manufacturer: input.manufacturer,
      model: input.model,
      year: input.year,
      color: input.color,
      vehicle_capacity: input.vehicleCapacity,
      max_weight_kg: input.maxWeightKg,
      permitted_weight_kg: input.permittedWeightKg,
      upper_platform_weight_kg: input.upperPlatformWeightKg,
      lower_platform_weight_kg: input.lowerPlatformWeightKg,
      license_expiry: input.licenseExpiry || null,
      insurance_expiry: input.insuranceExpiry || null,
      // שדות חדשים
      license_photo_url: input.licensePhotoUrl,
      tachograph_expiry: input.tachographExpiry || null,
      tachograph_photo_url: input.tachographPhotoUrl,
      engineer_report_expiry: input.engineerReportExpiry || null,
      engineer_report_photo_url: input.engineerReportPhotoUrl,
      last_winter_inspection: input.lastWinterInspection || null,
      //
      notes: input.notes,
      is_active: input.isActive
    })
    .eq('id', input.truckId)

  if (error) {
    console.error('Error updating truck:', error)
    throw error
  }

  // עדכון שיוך נהג
  // קודם מבטלים שיוך נוכחי
  await supabase
    .from('driver_truck_assignments')
    .update({ 
      is_current: false, 
      unassigned_at: new Date().toISOString() 
    })
    .eq('truck_id', input.truckId)
    .eq('is_current', true)

  // אם יש נהג חדש - יוצרים שיוך
  if (input.driverId) {
    await supabase
      .from('driver_truck_assignments')
      .insert({
        driver_id: input.driverId,
        truck_id: input.truckId,
        is_current: true,
        assigned_at: new Date().toISOString()
      })
  }

  return true
}

// ==================== עדכון בדיקת חורף ====================

export async function updateWinterInspection(truckId: string, date: string) {
  const { error } = await supabase
    .from('tow_trucks')
    .update({ last_winter_inspection: date })
    .eq('id', truckId)

  if (error) {
    console.error('Error updating winter inspection:', error)
    throw error
  }

  return true
}

// ==================== מחיקת משאית ====================

export async function deleteTruck(truckId: string) {
  // ביטול שיוכי נהגים
  await supabase
    .from('driver_truck_assignments')
    .delete()
    .eq('truck_id', truckId)

  const { error } = await supabase
    .from('tow_trucks')
    .delete()
    .eq('id', truckId)

  if (error) {
    console.error('Error deleting truck:', error)
    throw error
  }

  return true
}

// ==================== בדיקת כפילויות ====================

export async function checkTruckDuplicate(
  companyId: string,
  plateNumber: string,
  excludeTruckId?: string
): Promise<boolean> {
  let query = supabase
    .from('tow_trucks')
    .select('id')
    .eq('company_id', companyId)
    .eq('plate_number', plateNumber)

  if (excludeTruckId) {
    query = query.neq('id', excludeTruckId)
  }

  const { data } = await query.maybeSingle()
  return !!data
}