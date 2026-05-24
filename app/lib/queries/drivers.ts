import { supabase } from '../supabase'
import { Driver, User, TowTruck, DriverWithDetails, DriverStatus } from '../types'
import { syncDriverTruckAssignments } from './driver-truck-assignments'

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

  // מיפוי שיוכים (מספר גררים לכל נהג)
  const assignmentsByDriver: Record<string, TowTruck[]> = {}
  assignments?.forEach((a) => {
    if (a.truck) {
      if (!assignmentsByDriver[a.driver_id]) {
        assignmentsByDriver[a.driver_id] = []
      }
      assignmentsByDriver[a.driver_id].push(a.truck as unknown as TowTruck)
    }
  })

  // חיבור הכל יחד
  return drivers.map((driver) => ({
    ...driver,
    license_categories: driver.license_categories ?? [],
    license_permits: driver.license_permits ?? [],
    user: driver.user as User,
    current_trucks: assignmentsByDriver[driver.id] || [],
    today_tows_count: countByDriver[driver.id] || 0,
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
  licenseCategories: string[]
  licensePermits: string[]
  /** @deprecated legacy single category; synced from first category when saving */
  licenseType?: string
  licenseExpiry: string
  yearsExperience?: number
  work_hours_start?: string | null
  work_hours_end?: string | null
  notes?: string
  initialStatus: DriverStatus
  truckIds?: string[]
}

export async function createDriver(input: CreateDriverInput) {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch('/api/drivers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      companyId: input.companyId,
      email: input.email,
      phone: input.phone,
      fullName: input.fullName,
      idNumber: input.idNumber,
      address: input.address,
      licenseNumber: input.licenseNumber,
      licenseCategories: input.licenseCategories,
      licensePermits: input.licensePermits,
      licenseType: input.licenseType,
      licenseExpiry: input.licenseExpiry,
      yearsExperience: input.yearsExperience,
      work_hours_start: input.work_hours_start,
      work_hours_end: input.work_hours_end,
      notes: input.notes,
      initialStatus: input.initialStatus,
      truckIds: input.truckIds,
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
  licenseCategories?: string[]
  licensePermits?: string[]
  /** @deprecated legacy single category */
  licenseType?: string
  licenseExpiry?: string
  yearsExperience?: number
  work_hours_start?: string | null
  work_hours_end?: string | null
  notes?: string
  /** When provided, syncs current truck assignments to this list (empty = none). */
  truckIds?: string[]
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
  const driverUpdate: Record<string, unknown> = {
    license_number: input.licenseNumber,
    license_expiry: input.licenseExpiry,
    years_experience: input.yearsExperience,
    work_hours_start: input.work_hours_start,
    work_hours_end: input.work_hours_end,
    notes: input.notes,
  }
  if (input.licenseCategories !== undefined) {
    driverUpdate.license_categories = input.licenseCategories
    driverUpdate.license_type =
      input.licenseCategories[0] ?? input.licenseType ?? null
  } else if (input.licenseType !== undefined) {
    driverUpdate.license_type = input.licenseType
  }
  if (input.licensePermits !== undefined) {
    driverUpdate.license_permits = input.licensePermits
  }

  const { error: driverError } = await supabase
    .from('drivers')
    .update(driverUpdate)
    .eq('id', input.driverId)

  if (driverError) {
    console.error('Error updating driver:', driverError)
    throw driverError
  }

  // 3. עדכון שיוכי גרר (אם הועבר מערך)
  if (input.truckIds !== undefined) {
    await syncDriverTruckAssignments(input.driverId, input.truckIds)
  }

  return true
}

// ==================== מחיקת נהג ====================

export async function deleteDriver(driverId: string, _userId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`/api/drivers/${driverId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
    },
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to delete driver')
  }

  return true
}

// ==================== בדיקת כפילויות ====================

export async function checkDuplicates(
  companyId: string,
  phone: string,
  idNumber?: string,
  licenseNumber?: string,
  excludeUserId?: string,
  excludeDriverId?: string
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
    let licenseQuery = supabase
      .from('drivers')
      .select('id, user:users!user_id(full_name)')
      .eq('license_number', licenseNumber)
      .eq('company_id', companyId)

    if (excludeDriverId) {
      licenseQuery = licenseQuery.neq('id', excludeDriverId)
    }

    const { data: licenseMatch } = await licenseQuery.maybeSingle()

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

// שליפת נהגים זמינים
// שליפת נהגים זמינים
export async function getAvailableDrivers(companyId: string) {
  const { data, error } = await supabase
    .from('drivers')
    .select(`
      id,
      status,
      user_id
    `)
    .eq('company_id', companyId)

  if (error) {
    console.error('Error fetching available drivers:', error)
    return []
  }

  // שליפת פרטי משתמשים בנפרד
  if (data && data.length > 0) {
    const userIds = data.map(d => d.user_id)
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, phone')
      .in('id', userIds)

    return data.map(driver => ({
      ...driver,
      user: users?.find(u => u.id === driver.user_id) || null
    }))
  }

  return data || []
}