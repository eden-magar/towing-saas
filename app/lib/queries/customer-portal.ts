import { supabase } from '../supabase'
import type {
  CustomerUser,
  CustomerUserWithDetails,
  CustomerPortalTow,
  CustomerPortalTowDetail,
} from '../types'
import type { StoredVehicle } from './storage'

/** Narrow portal-facing shape from get_my_stored_vehicles (no notes / internal fields). */
export type CustomerPortalStoredVehicle = Pick<
  StoredVehicle,
  | 'id'
  | 'plate_number'
  | 'vehicle_data'
  | 'vehicle_condition'
  | 'defects'
  | 'location'
  | 'last_stored_at'
> & {
  current_status: 'stored' | 'reserved_for_tow'
}

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

  const rawCustomer = data.customer as
    | {
        id: string
        name: string
        customer_type: string
        portal_settings?: Record<string, boolean>
      }
    | {
        id: string
        name: string
        customer_type: string
        portal_settings?: Record<string, boolean>
      }[]
  const customer = Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer
  if (!customer) return null

  const { data: companyIdData, error: companyIdError } = await supabase.rpc(
    'get_my_company_id_for_customer'
  )
  const companyId = companyIdError ? null : ((companyIdData as string | null) ?? null)

  return {
    customerId: customer.id,
    companyId,
    customerName: customer.name,
    customerType: customer.customer_type,
    customerUserRole: data.role,
    portalSettings: customer.portal_settings || {},
  }
}

export type CompanyBaseAddressForCustomer = {
  address: string
  lat: number | null
  lng: number | null
}

/** Yard/base address for portal storage auto-fill (מאחסנה/לאחסנה). No pricing data. */
export async function getCompanyBaseAddressForCustomer(): Promise<CompanyBaseAddressForCustomer | null> {
  const { data, error } = await supabase.rpc('get_company_base_address_for_customer')

  if (error) {
    console.error('Error fetching company base address for customer:', error)
    return null
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object' || !('base_address' in row)) {
    return null
  }

  const address = typeof row.base_address === 'string' ? row.base_address.trim() : ''
  if (!address) {
    return null
  }

  return {
    address,
    lat: row.base_lat != null ? Number(row.base_lat) : null,
    lng: row.base_lng != null ? Number(row.base_lng) : null,
  }
}

/** Caller's own vehicles in storage (stored + reserved). Identity scoped server-side. */
export async function getMyStoredVehicles(): Promise<CustomerPortalStoredVehicle[]> {
  const { data, error } = await supabase.rpc('get_my_stored_vehicles')

  if (error) {
    console.error('Error fetching customer stored vehicles:', error)
    throw error
  }

  return (data ?? []) as CustomerPortalStoredVehicle[]
}

// שליפת גרירות לקוח (עמוד / pagination)
export const CUSTOMER_PORTAL_TOW_PAGE_SIZE = 50

const CUSTOMER_TOW_LIST_SELECT = `
  id,
  order_number,
  customer_order_number,
  status,
  tow_type,
  scheduled_at,
  created_at,
  started_at,
  completed_at,
  visibility_overrides,
  show_driver_info_override,
  driver:drivers!tows_driver_id_fkey (
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
    stop_subtype,
    address,
    status,
    arrived_at,
    completed_at
  )
`

function mapCustomerPortalTow(tow: any): CustomerPortalTow {
  const driverRow = Array.isArray(tow.driver) ? tow.driver[0] : tow.driver
  const userRow = Array.isArray(driverRow?.user) ? driverRow.user[0] : driverRow?.user
  return {
    ...tow,
    driver: userRow
      ? { full_name: userRow.full_name, phone: userRow.phone }
      : null,
    points: [...(tow.points || [])].sort(
      (a: { point_order: number }, b: { point_order: number }) => a.point_order - b.point_order
    ),
  }
}

export type CustomerTowsPage = {
  tows: CustomerPortalTow[]
  hasMore: boolean
}

export async function getCustomerTows(
  customerId: string,
  options?: {
    status?: string
    from?: string
    to?: string
    limit?: number
    offset?: number
  }
): Promise<CustomerTowsPage> {
  const limit = options?.limit ?? CUSTOMER_PORTAL_TOW_PAGE_SIZE
  const offset = options?.offset ?? 0

  let query = supabase
    .from('tows')
    .select(CUSTOMER_TOW_LIST_SELECT, { count: 'exact' })
    .eq('customer_id', customerId)
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }
  if (options?.from) {
    query = query.gte('created_at', options.from)
  }
  if (options?.to) {
    query = query.lte('created_at', options.to)
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching customer tows:', error)
    return { tows: [], hasMore: false }
  }

  const tows = (data ?? []).map(mapCustomerPortalTow)
  const hasMore =
    count != null ? offset + tows.length < count : tows.length === limit

  return { tows, hasMore }
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
      visibility_overrides,
      show_photos_override,
      show_price_override,
      show_driver_info_override,
      show_driver_phone_override,
      show_status_history_override,
      show_vehicles_override,
      show_notes_override,
      final_price,
      driver:drivers!tows_driver_id_fkey (
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
        stop_subtype,
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
    ...mapCustomerPortalTow(tow),
    notes: tow.notes,
    visibility_overrides: tow.visibility_overrides,
    show_photos_override: tow.show_photos_override,
    show_price_override: tow.show_price_override,
    show_driver_info_override: tow.show_driver_info_override,
    show_driver_phone_override: tow.show_driver_phone_override,
    show_status_history_override: tow.show_status_history_override,
    show_vehicles_override: tow.show_vehicles_override,
    show_notes_override: tow.show_notes_override,
    final_price: tow.final_price,
    points: (tow.points || []).sort((a: { point_order: number }, b: { point_order: number }) => a.point_order - b.point_order),
    images: tow.images || [],
  } as CustomerPortalTowDetail
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