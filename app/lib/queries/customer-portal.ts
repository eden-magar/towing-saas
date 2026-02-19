import { supabase } from '../supabase'
import type {
  CustomerUser,
  CustomerUserWithDetails,
  CustomerPortalTow,
  CustomerPortalTowDetail,
} from '../types'

// שליפת פרטי הלקוח לפי user_id (דרך customer_users)
export async function getCustomerForUser(userId: string) {
  const { data, error } = await supabase
    .from('customer_users')
    .select(`
      id,
      role,
      is_active,
      customer:customers (
        id,
        name,
        customer_type,
        phone,
        email,
        portal_settings
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error || !data || !data.customer) return null
  return {
    customerId: (data.customer as any).id,
    customerName: (data.customer as any).name,
    customerType: (data.customer as any).customer_type,
    customerUserRole: data.role,
    portalSettings: (data.customer as any).portal_settings || {},
  }
}

// שליפת כל הגרירות של הלקוח
export async function getCustomerTows(
  customerId: string,
  filters?: { status?: string; from?: string; to?: string }
): Promise<CustomerPortalTow[]> {
  let query = supabase
    .from('tows')
    .select(`
      id,
      order_number,
      status,
      tow_type,
      scheduled_at,
      created_at,
      started_at,
      completed_at,
      driver:drivers (
        user:users (
          full_name,
          phone
        )
      ),
      vehicles:tow_vehicles (
        plate_number,
        manufacturer,
        model,
        color
      ),
      points:tow_points (
        id,
        point_order,
        point_type,
        address,
        status,
        arrived_at,
        completed_at
      )
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }
  if (filters?.from) {
    query = query.gte('created_at', filters.from)
  }
  if (filters?.to) {
    query = query.lte('created_at', filters.to)
  }

  const { data, error } = await query

  if (error || !data) return []

  return data.map((tow: any) => ({
    ...tow,
    driver: tow.driver?.user
      ? { full_name: tow.driver.user.full_name, phone: tow.driver.user.phone }
      : null,
    points: (tow.points || []).sort((a: any, b: any) => a.point_order - b.point_order),
  }))
}

// שליפת גרירה בודדת עם כל הפרטים
export async function getCustomerTowDetail(
  towId: string,
  customerId: string
): Promise<CustomerPortalTowDetail | null> {
  const { data, error } = await supabase
    .from('tows')
    .select(`
      id,
      order_number,
      status,
      tow_type,
      scheduled_at,
      created_at,
      started_at,
      completed_at,
      notes,
      driver:drivers (
        user:users (
          full_name,
          phone
        )
      ),
      vehicles:tow_vehicles (
        plate_number,
        manufacturer,
        model,
        color
      ),
      points:tow_points (
        id,
        point_order,
        point_type,
        address,
        status,
        arrived_at,
        completed_at,
        contact_name,
        contact_phone,
        recipient_name,
        recipient_phone,
        notes
      ),
      images:tow_images (
        id,
        image_url,
        image_type,
        tow_point_id,
        tow_vehicle_id,
        created_at
      )
    `)
    .eq('id', towId)
    .eq('customer_id', customerId)
    .single()

  if (error || !data) return null

  const tow = data as any

  return {
    ...tow,
    driver: tow.driver?.user
      ? { full_name: tow.driver.user.full_name, phone: tow.driver.user.phone }
      : null,
    points: (tow.points || []).sort((a: any, b: any) => a.point_order - b.point_order),
    images: tow.images || [],
  }
}

// שליפת משתמשי הלקוח (לניהול)
export async function getCustomerUsers(customerId: string): Promise<CustomerUserWithDetails[]> {
  const { data, error } = await supabase
    .from('customer_users')
    .select(`
      id,
      customer_id,
      user_id,
      role,
      is_active,
      created_at,
      updated_at,
      user:users (
        full_name,
        email,
        phone
      )
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data as any
}

// סטטיסטיקות לדשבורד לקוח
export async function getCustomerStats(customerId: string) {
  const { data: tows, error } = await supabase
    .from('tows')
    .select('status')
    .eq('customer_id', customerId)

  if (error || !tows) return { total: 0, active: 0, completed: 0, pending: 0 }

  return {
    total: tows.length,
    active: tows.filter(t => t.status === 'in_progress').length,
    completed: tows.filter(t => t.status === 'completed').length,
    pending: tows.filter(t => ['pending', 'assigned'].includes(t.status)).length,
  }
}

// יצירת משתמש לקוח (מצד חברת הגרירה)
export async function createCustomerUser(
  email: string,
  fullName: string,
  phone: string | null,
  customerId: string,
  role: 'admin' | 'manager' | 'viewer' = 'viewer'
) {
  // 1. צור user ב-auth דרך API route
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/customer-users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ email, fullName, phone, customerId, role }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'שגיאה ביצירת המשתמש')
  }

  return await res.json()
}

// עדכון תפקיד משתמש לקוח
export async function updateCustomerUserRole(
  customerUserId: string,
  role: 'admin' | 'manager' | 'viewer'
) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch('/api/customer-users', {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ customerUserId, role })
  })
  if (!res.ok) throw new Error('שגיאה בעדכון תפקיד')
}

// השבתת/הפעלת משתמש לקוח
export async function toggleCustomerUserActive(customerUserId: string, isActive: boolean) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch('/api/customer-users', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ customerUserId, is_active: isActive })
  })
  if (!res.ok) throw new Error('שגיאה בעדכון סטטוס')
}

// מחיקת משתמש לקוח
export async function deleteCustomerUser(customerUserId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/customer-users', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ customerUserId }),
  })

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'שגיאה במחיקת המשתמש')
  }
}