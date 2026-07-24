import { supabase } from '../supabase'
import type {
  CustomerUser,
  CustomerUserRole,
  CustomerUserWithDetails,
  CustomerPortalTow,
  CustomerPortalTowDetail,
} from '../types'
import type { StoredVehicle } from './storage'
import { resolvePortalVisibilityFlag } from '../utils/portal-visibility'
import { canExportPortalTows, canSeePortalPrice } from '../utils/portal-roles'
import { withSignedTowImageUrls } from './tow-images-storage'
import { getPortalMembershipRole } from './customer-portal-contacts'

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
  | 'vehicle_code'
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
export const CUSTOMER_PORTAL_TOW_PAGE_SIZE = 8

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
  cancellation_reason,
  cancellation_customer_note,
  visibility_overrides,
  show_photos_override,
  show_price_override,
  show_driver_info_override,
  show_driver_phone_override,
  show_status_history_override,
  show_vehicles_override,
  show_notes_override,
  vehicles:tow_vehicles (
    plate_number,
    manufacturer,
    model,
    color,
    is_working
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

/** List-shaped select + final_price for export. Omits notes / cancellation free-text. */
const CUSTOMER_TOW_EXPORT_SELECT = `
  id,
  order_number,
  customer_order_number,
  status,
  tow_type,
  scheduled_at,
  created_at,
  started_at,
  completed_at,
  final_price,
  visibility_overrides,
  show_photos_override,
  show_price_override,
  show_driver_info_override,
  show_driver_phone_override,
  show_status_history_override,
  show_vehicles_override,
  show_notes_override,
  vehicles:tow_vehicles (
    plate_number,
    manufacturer,
    model,
    color,
    is_working
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

export type CustomerTowDateField = 'created_at' | 'scheduled_at'

export type GetCustomerTowsOptions = {
  /** Single status (list page). `cancelled` expands to cancelled + cancelled_charged. */
  status?: string
  /** Multi-status filter (export). When set, takes precedence over `status`. */
  statuses?: string[]
  from?: string
  to?: string
  /**
   * Which timestamp `from`/`to` apply to.
   * Default `created_at` — preserves existing callers.
   */
  dateField?: CustomerTowDateField
  /** Restrict to these tow IDs (portal search: IDs come from search_customer_tow_ids). */
  ids?: string[]
  limit?: number
  offset?: number
}

export type CustomerPortalTowExportRow = CustomerPortalTow & {
  final_price: number | null
  show_price_override?: boolean | null
  show_photos_override?: boolean | null
  show_driver_phone_override?: boolean | null
  show_status_history_override?: boolean | null
  show_vehicles_override?: boolean | null
  show_notes_override?: boolean | null
}

const EXPORT_PAGE_SIZE = 100

function applyCustomerTowFilters<
  Q extends {
    eq: (column: string, value: string) => Q
    in: (column: string, values: string[]) => Q
    gte: (column: string, value: string) => Q
    lte: (column: string, value: string) => Q
  },
>(query: Q, options: GetCustomerTowsOptions): Q {
  let next = query

  if (options.ids) {
    next = next.in('id', options.ids)
  }

  if (options.statuses && options.statuses.length > 0) {
    next = next.in('status', options.statuses)
  } else if (options.status && options.status !== 'all') {
    if (options.status === 'cancelled') {
      next = next.in('status', ['cancelled', 'cancelled_charged'])
    } else {
      next = next.eq('status', options.status)
    }
  }

  const dateField: CustomerTowDateField = options.dateField ?? 'created_at'
  if (options.from) {
    next = next.gte(dateField, options.from)
  }
  if (options.to) {
    next = next.lte(dateField, options.to)
  }

  return next
}

type PortalDriverContact = { full_name: string; phone: string | null }

async function fetchPortalSettingsForCustomer(
  customerId: string
): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('customers')
    .select('portal_settings')
    .eq('id', customerId)
    .single()

  if (error || !data) return {}
  return (data.portal_settings as Record<string, boolean>) || {}
}

/** SECURITY DEFINER RPC: driver name+phone for caller's own tows only (flag-gated in SQL). */
async function fetchMyTowDriverContacts(
  towIds: string[]
): Promise<Map<string, PortalDriverContact>> {
  const byTowId = new Map<string, PortalDriverContact>()
  if (towIds.length === 0) return byTowId

  const { data, error } = await supabase.rpc('get_my_tow_driver_contacts', {
    p_tow_ids: towIds,
  })

  if (error) {
    console.error('Error fetching portal tow driver contacts:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    return byTowId
  }

  for (const row of data ?? []) {
    const towId = row?.tow_id as string | undefined
    if (!towId) continue
    const fullName = typeof row?.full_name === 'string' ? row.full_name.trim() : ''
    const phone =
      typeof row?.phone === 'string' && row.phone.trim() ? row.phone.trim() : null
    if (!fullName && !phone) continue
    byTowId.set(towId, {
      full_name: fullName,
      phone,
    })
  }

  return byTowId
}

function mapCustomerPortalTow(
  tow: any,
  driverByTowId?: Map<string, PortalDriverContact>
): CustomerPortalTow {
  const driver = driverByTowId?.get(tow.id) ?? null
  return {
    ...tow,
    driver,
    points: [...(tow.points || [])].sort(
      (a: { point_order: number }, b: { point_order: number }) => a.point_order - b.point_order
    ),
  }
}

/** Strip fields the portal customer is not allowed to see (server-side). */
function applyPortalVisibilityStripToListTow(
  tow: CustomerPortalTow,
  portalSettings: Record<string, boolean>
): CustomerPortalTow {
  let next: CustomerPortalTow = { ...tow }

  if (!resolvePortalVisibilityFlag('show_vehicles', portalSettings, tow)) {
    next = { ...next, vehicles: [] }
  }

  if (!resolvePortalVisibilityFlag('show_status_history', portalSettings, tow)) {
    next = {
      ...next,
      started_at: null,
      completed_at: null,
      points: next.points.map((p) => ({
        ...p,
        arrived_at: null,
        completed_at: null,
      })),
    }
  }

  // Defense in depth if RPC predates visibility migration.
  const showDriverInfo = resolvePortalVisibilityFlag(
    'show_driver_info',
    portalSettings,
    tow
  )
  const showDriverPhone = resolvePortalVisibilityFlag(
    'show_driver_phone',
    portalSettings,
    tow
  )
  if (next.driver) {
    if (!showDriverInfo && !showDriverPhone) {
      next = { ...next, driver: null }
    } else {
      const driver = {
        full_name: showDriverInfo ? next.driver.full_name : '',
        phone: showDriverPhone ? next.driver.phone : null,
      }
      next = {
        ...next,
        driver: driver.full_name || driver.phone ? driver : null,
      }
    }
  }

  return next
}

async function applyPortalVisibilityStripToDetail(
  detail: CustomerPortalTowDetail,
  portalSettings: Record<string, boolean>,
  role: CustomerUserRole | null
): Promise<CustomerPortalTowDetail> {
  const listStripped = applyPortalVisibilityStripToListTow(detail, portalSettings)

  let next: CustomerPortalTowDetail = {
    ...detail,
    ...listStripped,
    driver_id: detail.driver_id,
    points: detail.points.map((p) => {
      const strippedPoint = listStripped.points.find((sp) => sp.id === p.id)
      return {
        ...p,
        arrived_at: strippedPoint ? strippedPoint.arrived_at : p.arrived_at,
        completed_at: strippedPoint ? strippedPoint.completed_at : p.completed_at,
      }
    }),
  }

  // Price: show_price AND role admin|accountant — strip in the query layer so the
  // value never reaches the browser for manager/viewer (or when the flag is off).
  const maySeePrice =
    canSeePortalPrice(role) &&
    resolvePortalVisibilityFlag('show_price', portalSettings, detail)
  if (!maySeePrice) {
    next = { ...next, final_price: null }
  }

  if (!resolvePortalVisibilityFlag('show_notes', portalSettings, detail)) {
    next = {
      ...next,
      notes: null,
      points: next.points.map((p) => ({ ...p, notes: null })),
    }
  }

  if (!resolvePortalVisibilityFlag('show_photos', portalSettings, detail)) {
    next = { ...next, images: [] }
  } else {
    next = { ...next, images: await withSignedTowImageUrls(next.images) }
  }

  return next
}

export type CustomerTowsPage = {
  tows: CustomerPortalTow[]
  hasMore: boolean
  /** Exact total matching the current filters (for classic pagination UI). */
  total: number
}

export async function getCustomerTows(
  customerId: string,
  options: GetCustomerTowsOptions = {}
): Promise<CustomerTowsPage> {
  const limit = options.limit ?? CUSTOMER_PORTAL_TOW_PAGE_SIZE
  const offset = options.offset ?? 0

  let query = supabase
    .from('tows')
    .select(CUSTOMER_TOW_LIST_SELECT, { count: 'exact' })
    .eq('customer_id', customerId)
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  query = applyCustomerTowFilters(query, options)

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching customer tows:', error)
    return { tows: [], hasMore: false, total: 0 }
  }

  const rows = data ?? []
  const portalSettings = await fetchPortalSettingsForCustomer(customerId)
  const driverByTowId = await fetchMyTowDriverContacts(rows.map((t: { id: string }) => t.id))
  const tows = rows.map((tow) =>
    applyPortalVisibilityStripToListTow(
      mapCustomerPortalTow(tow, driverByTowId),
      portalSettings
    )
  )
  const total = count ?? offset + tows.length
  const hasMore = count != null ? offset + tows.length < count : tows.length === limit

  return { tows, hasMore, total }
}

export type CustomerTowSearchPage = {
  tows: CustomerPortalTow[]
  /** Exact total after status filter over the matched set (for pagination). */
  total: number
  /** True when the search matched more rows than the RPC cap returned. */
  capped: boolean
}

/**
 * Portal search across ALL of the customer's tows (not just the loaded page).
 * Step 1 — search_customer_tow_ids RPC returns matching tow IDs scoped to the
 * caller's own customer (resolved server-side from auth.uid()) plus the full
 * DISTINCT match count. Step 2 — fetch those IDs through the existing list path
 * so columns, customer scoping and the visibility strip stay identical to the
 * normal list. The status filter and pagination combine over the matched set.
 */
export async function searchCustomerTows(
  customerId: string,
  options: { query: string; status?: string; limit?: number; offset?: number }
): Promise<CustomerTowSearchPage> {
  const limit = options.limit ?? CUSTOMER_PORTAL_TOW_PAGE_SIZE
  const offset = options.offset ?? 0
  const query = options.query.trim()

  if (query.length < 2) {
    return { tows: [], total: 0, capped: false }
  }

  const { data, error } = await supabase.rpc('search_customer_tow_ids', {
    p_query: query,
  })

  if (error) {
    console.error('Error searching customer tows:', error)
    return { tows: [], total: 0, capped: false }
  }

  const rows = (data ?? []) as Array<{ tow_id: string; total_matches: number | string }>
  const ids = rows.map((r) => r.tow_id)
  const totalMatches = rows.length > 0 ? Number(rows[0].total_matches) : 0
  const capped = totalMatches > ids.length

  if (ids.length === 0) {
    return { tows: [], total: 0, capped: false }
  }

  const { tows, total } = await getCustomerTows(customerId, {
    ids,
    status: options.status,
    limit,
    offset,
  })

  return { tows, total, capped }
}

/** Exact matching count only — no row payload. */
export async function countCustomerTows(
  customerId: string,
  options: Omit<GetCustomerTowsOptions, 'limit' | 'offset'> = {}
): Promise<number> {
  if (options.statuses && options.statuses.length === 0) {
    return 0
  }

  let query = supabase
    .from('tows')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)

  query = applyCustomerTowFilters(query, options)

  const { count, error } = await query

  if (error) {
    console.error('Error counting customer tows:', error)
    return 0
  }

  return count ?? 0
}

/**
 * All matching tows for portal Excel export.
 * Pages via range/limit; does not strip vehicles (needed for plates/vehicle columns).
 * Does not attach driver contacts (never exported).
 * Role-gated: admin | accountant only (UI hide is not sufficient).
 */
export async function fetchAllCustomerTowsForExport(
  customerId: string,
  options: Omit<GetCustomerTowsOptions, 'limit' | 'offset'> = {}
): Promise<{ tows: CustomerPortalTowExportRow[]; portalSettings: Record<string, boolean> }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('אין הרשאה לייצוא')
  }
  const role = await getPortalMembershipRole(user.id, customerId)
  if (!canExportPortalTows(role)) {
    throw new Error('אין הרשאה לייצוא')
  }

  if (options.statuses && options.statuses.length === 0) {
    return { tows: [], portalSettings: {} }
  }

  const portalSettings = await fetchPortalSettingsForCustomer(customerId)
  const all: CustomerPortalTowExportRow[] = []
  let offset = 0

  for (;;) {
    let query = supabase
      .from('tows')
      .select(CUSTOMER_TOW_EXPORT_SELECT)
      .eq('customer_id', customerId)
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    query = applyCustomerTowFilters(query, options)

    const { data, error } = await query.range(offset, offset + EXPORT_PAGE_SIZE - 1)

    if (error) {
      console.error('Error fetching customer tows for export:', error)
      throw error
    }

    const rows = data ?? []
    for (const tow of rows) {
      const mapped = mapCustomerPortalTow(tow) as CustomerPortalTowExportRow
      mapped.final_price =
        typeof tow.final_price === 'number' ? tow.final_price : tow.final_price ?? null
      all.push(mapped)
    }

    if (rows.length < EXPORT_PAGE_SIZE) break
    offset += EXPORT_PAGE_SIZE
  }

  return { tows: all, portalSettings }
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
      customer_order_number,
      driver_id,
      status,
      tow_type,
      scheduled_at,
      created_at,
      started_at,
      completed_at,
      cancellation_reason,
      cancellation_customer_note,
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
      vehicles:tow_vehicles (
        plate_number,
        manufacturer,
        model,
        color,
        is_working
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
  const portalSettings = await fetchPortalSettingsForCustomer(customerId)
  const driverByTowId = await fetchMyTowDriverContacts([towId])

  const detail: CustomerPortalTowDetail = {
    ...mapCustomerPortalTow(tow, driverByTowId),
    driver_id: tow.driver_id ?? null,
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
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const role = user ? await getPortalMembershipRole(user.id, customerId) : null

  return applyPortalVisibilityStripToDetail(detail, portalSettings, role)
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
  role: CustomerUserRole = 'viewer'
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
  role: CustomerUserRole
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