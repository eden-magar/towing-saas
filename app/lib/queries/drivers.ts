import { supabase } from '../supabase'
import { Driver, User, TowTruck, DriverWithDetails, DriverStatus } from '../types'

// ==================== שליפת נהגים ====================

export async function getDrivers(companyId: string): Promise<DriverWithDetails[]> {
  // שליפת נהגים עם פרטי המשתמש
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select(`
      *,
      user:users!user_id (
        id,
        email,
        phone,
        full_name,
        id_number,
        address,
        is_active
      )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching drivers:', error)
    throw error
  }

  if (!drivers) return []

  // שליפת שיוכי גררים נוכחיים
  const { data: assignments } = await supabase
    .from('driver_truck_assignments')
    .select(`
      driver_id,
      truck:tow_trucks (*)
    `)
    .eq('is_current', true)
    .in('driver_id', drivers.map(d => d.id))

  // שליפת ספירת גרירות היום
  const today = new Date().toISOString().split('T')[0]
  const { data: towCounts } = await supabase
    .from('tows')
    .select('driver_id')
    .eq('company_id', companyId)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)

  // מיפוי ספירות
  const countByDriver: Record<string, number> = {}
  towCounts?.forEach(tow => {
    if (tow.driver_id) {
      countByDriver[tow.driver_id] = (countByDriver[tow.driver_id] || 0) + 1
    }
  })

  // מיפוי שיוכים
  const assignmentByDriver: Record<string, TowTruck> = {}
  assignments?.forEach(a => {
    if (a.truck) {
      assignmentByDriver[a.driver_id] = a.truck as unknown as TowTruck
    }
  })

  // חיבור הכל יחד
  return drivers.map(driver => ({
    ...driver,
    user: driver.user as User,
    current_truck: assignmentByDriver[driver.id] || null,
    today_tows_count: countByDriver[driver.id] || 0
  }))
}

// ==================== הוספת נהג ====================

interface CreateDriverInput {
  companyId: string
  email: string
  phone: string
  fullName: string
  idNumber?: string
  address?: string
  licenseNumber: string
  licenseType: string
  licenseExpiry: string
  yearsExperience?: number
  notes?: string
  initialStatus: DriverStatus
  truckId?: string
}

export async function createDriver(input: CreateDriverInput) {
  const response = await fetch('/api/drivers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      companyId: input.companyId,
      email: input.email,
      phone: input.phone,
      fullName: input.fullName,
      idNumber: input.idNumber,
      address: input.address,
      licenseNumber: input.licenseNumber,
      licenseType: input.licenseType,
      licenseExpiry: input.licenseExpiry,
      yearsExperience: input.yearsExperience,
      notes: input.notes,
      initialStatus: input.initialStatus,
      truckId: input.truckId
    })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create driver')
  }

  return data
}

// ==================== עריכת נהג ====================

interface UpdateDriverInput {
  driverId: string
  userId: string
  phone?: string
  fullName?: string
  idNumber?: string
  address?: string
  email?: string
  licenseNumber?: string
  licenseType?: string
  licenseExpiry?: string
  yearsExperience?: number
  notes?: string
  truckId?: string | null
}

export async function updateDriver(input: UpdateDriverInput) {
  // 1. עדכון משתמש
  const { error: userError } = await supabase
    .from('users')
    .update({
      phone: input.phone,
      full_name: input.fullName,
      id_number: input.idNumber,
      address: input.address,
      email: input.email
    })
    .eq('id', input.userId)

  if (userError) {
    console.error('Error updating user:', userError)
    throw userError
  }

  // 2. עדכון נהג
  const { error: driverError } = await supabase
    .from('drivers')
    .update({
      license_number: input.licenseNumber,
      license_type: input.licenseType,
      license_expiry: input.licenseExpiry,
      years_experience: input.yearsExperience,
      notes: input.notes
    })
    .eq('id', input.driverId)

  if (driverError) {
    console.error('Error updating driver:', driverError)
    throw driverError
  }

  // 3. עדכון שיוך גרר
  // קודם מבטלים שיוך נוכחי
  await supabase
    .from('driver_truck_assignments')
    .update({ 
      is_current: false, 
      unassigned_at: new Date().toISOString() 
    })
    .eq('driver_id', input.driverId)
    .eq('is_current', true)

  // אם יש גרר חדש - יוצרים שיוך
  if (input.truckId) {
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

// ==================== מחיקת נהג ====================

export async function deleteDriver(driverId: string, userId: string) {
  // 1. ביטול שיוכי גררים
  await supabase
    .from('driver_truck_assignments')
    .delete()
    .eq('driver_id', driverId)

  // 2. מחיקת נהג
  const { error: driverError } = await supabase
    .from('drivers')
    .delete()
    .eq('id', driverId)

  if (driverError) {
    console.error('Error deleting driver:', driverError)
    throw driverError
  }

  // 3. מחיקת משתמש
  const { error: userError } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)

  if (userError) {
    console.error('Error deleting user:', userError)
    throw userError
  }

  return true
}

// ==================== בדיקת כפילויות ====================

export async function checkDuplicates(
  companyId: string,
  phone: string,
  idNumber?: string,
  licenseNumber?: string,
  excludeUserId?: string
): Promise<{ field: string; driverName: string } | null> {
  
  // בדיקת טלפון
  let phoneQuery = supabase
    .from('users')
    .select('id, full_name')
    .eq('phone', phone)
    .eq('company_id', companyId)
  
  if (excludeUserId) {
    phoneQuery = phoneQuery.neq('id', excludeUserId)
  }
  
  const { data: phoneMatch } = await phoneQuery.maybeSingle()
  if (phoneMatch) {
    return { field: 'טלפון', driverName: phoneMatch.full_name }
  }

  // בדיקת ת.ז.
  if (idNumber) {
    let idQuery = supabase
      .from('users')
      .select('id, full_name')
      .eq('id_number', idNumber)
      .eq('company_id', companyId)
    
    if (excludeUserId) {
      idQuery = idQuery.neq('id', excludeUserId)
    }
    
    const { data: idMatch } = await idQuery.maybeSingle()
    if (idMatch) {
      return { field: 'תעודת זהות', driverName: idMatch.full_name }
    }
  }

    // בדיקת רישיון
  if (licenseNumber) {
    const { data: licenseMatch } = await supabase
      .from('drivers')
      .select('id, user:users!user_id(full_name)')
      .eq('license_number', licenseNumber)
      .eq('company_id', companyId)
      .maybeSingle()
    
    if (licenseMatch?.user) {
      const user = licenseMatch.user as unknown as { full_name: string }
      return { field: 'מספר רישיון', driverName: user.full_name }
    }
  }

  return null
}

// ==================== עדכון סטטוס ====================

export async function updateDriverStatus(driverId: string, status: DriverStatus) {
  const { error } = await supabase
    .from('drivers')
    .update({ status })
    .eq('id', driverId)

  if (error) {
    console.error('Error updating driver status:', error)
    throw error
  }

  return true
}