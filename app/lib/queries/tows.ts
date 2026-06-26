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
import {
  assignExistingPointIds,
  assignExistingVehicleIds,
} from '../utils/tow-reconcile-match'
import type { PersistedVehicleType } from '../utils/tow-save-handler'
import { isClosedTowStatus } from '../utils/can-edit-closed-tow'
import { persistableUuid } from '../utils/persistable-uuid'
import { syncTowToLegacyCalendar } from '../integrations/legacy-calendar/client-sync'

// ==================== טיפוסים ====================

export interface PriceBreakdown {
  base_price: number
  vehicle_type: string
  vehicle_count?: number      
  distance_km: number
  distance_price: number
  /** Deadhead (נסיעת סרק) return-leg km, priced at the separate price_per_km_deadhead rate. */
  deadhead_km?: number
  deadhead_price?: number
  time_surcharges: { id: string; label: string; percent: number; amount: number }[]
  location_surcharges: { id: string; label: string; percent: number; amount: number }[]
  service_surcharges: {
    id: string
    label: string
    price: number
    units?: number
    amount: number
    vehicle_role?: 'working' | 'defective'
    /** Manual ad-hoc line added directly on this order (not from the service_surcharges catalog). */
    is_ad_hoc?: boolean
    /** Catalog line chosen at the whole-tow level (exchange/custom), not per-leg or per-point. */
    is_tow_level?: boolean
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
  status: 'quote' | 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'cancelled_charged'
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
  cancellation_fee: number | null
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
  /** Row offset for pagination (load-more). Default: 0. Requires a non-null limit. */
  offset?: number
}

/** Max tow_id values per `.in(...)` to stay under URL/query limits on large pages. */
const TOW_ID_CHUNK_SIZE = 300

/**
 * Slim column set used by the tow LIST views (getTows / searchTowsByField).
 * The list renders plate/manufacturer/model + from→to route; it does not need
 * the full row. Use getTow / getTowWithPoints for the detail page (select '*').
 */
const TOW_LIST_SELECT = `
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
`

/**
 * Fetch tow child rows (vehicles/legs) for the list view, chunked by tow_id.
 * Slim column sets only — the tow LIST renders plate/manufacturer/model and
 * the from→to route; it does not need the full row. Use getTow / getTowWithPoints
 * for the detail page, which still select '*'.
 */
async function fetchTowChildrenChunked(
  table: 'tow_vehicles' | 'tow_legs',
  columns: string,
  orderColumn: string,
  towIds: string[]
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = []
  for (let i = 0; i < towIds.length; i += TOW_ID_CHUNK_SIZE) {
    const chunk = towIds.slice(i, i + TOW_ID_CHUNK_SIZE)
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in('tow_id', chunk)
      .order(orderColumn, { ascending: true })
    if (error) {
      console.error(`Error fetching ${table}:`, error)
      continue
    }
    if (data) results.push(...(data as unknown as Record<string, unknown>[]))
  }
  return results
}

/**
 * Given raw tow rows already selected with TOW_LIST_SELECT, fetch their
 * vehicles + legs (chunked, in parallel) and attach them in the slim list shape.
 * Shared by getTows and searchTowsByField so hydration logic lives in one place.
 */
async function hydrateTowListRows(
  tows: Record<string, unknown>[]
): Promise<TowWithDetails[]> {
  if (!tows || tows.length === 0) return []

  const towIds = tows.map(t => t.id as string)

  const [vehicles, legs] = await Promise.all([
    fetchTowChildrenChunked(
      'tow_vehicles',
      'tow_id, plate_number, manufacturer, model, order_index',
      'order_index',
      towIds
    ),
    fetchTowChildrenChunked(
      'tow_legs',
      'tow_id, leg_type, from_address, to_address, leg_order',
      'leg_order',
      towIds
    ),
  ])

  const vehiclesByTow: Record<string, TowVehicle[]> = {}
  vehicles.forEach(v => {
    const towId = v.tow_id as string
    if (!vehiclesByTow[towId]) vehiclesByTow[towId] = []
    vehiclesByTow[towId].push(v as unknown as TowVehicle)
  })

  const legsByTow: Record<string, TowLeg[]> = {}
  legs.forEach(l => {
    const towId = l.tow_id as string
    if (!legsByTow[towId]) legsByTow[towId] = []
    legsByTow[towId].push(l as unknown as TowLeg)
  })

  // Cast: TOW_LIST_SELECT drops heavy columns (price_breakdown, notes, etc.).
  // The tow list page (the only caller) doesn't access those. Future callers
  // needing them should use getTow / getTowWithPoints instead.
  return tows.map(tow => ({
    ...tow,
    customer: (tow as { customer: unknown }).customer as any,
    driver: (tow as { driver: unknown }).driver as any,
    truck: (tow as { truck: unknown }).truck as any,
    vehicles: vehiclesByTow[tow.id as string] || [],
    legs: legsByTow[tow.id as string] || [],
  })) as unknown as TowWithDetails[]
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
  const offsetValue = options.offset ?? 0

  let query = supabase
    .from('tows')
    .select(TOW_LIST_SELECT)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (sinceIso) {
    query = query.gte('created_at', sinceIso)
  }
  if (limitValue !== null) {
    // .range is inclusive; offset 0 + limit 100 → range(0, 99) ≡ .limit(100).
    query = query.range(offsetValue, offsetValue + limitValue - 1)
  }

  const { data: tows, error } = await query

  if (error) {
    console.error('Error fetching tows:', error)
    throw error
  }

  return hydrateTowListRows((tows ?? []) as unknown as Record<string, unknown>[])
}

// ==================== חיפוש לפי שדה בודד (רשימת גרירות) ====================

export type TowSearchField = 'order' | 'customer' | 'vehicle' | 'date' | 'driver' | 'address'

export interface SearchTowsByFieldResult {
  rows: TowWithDetails[]
  total: number
  /** True when id resolution hit SEARCH_BY_FIELD_ID_CAP — UI should hint to narrow. */
  capped: boolean
}

/** Max tow IDs we resolve before hydrating — guards against pathological terms. */
const SEARCH_BY_FIELD_ID_CAP = 1000

/** Address search needs at least this many chars before we hit the legs table. */
const ADDRESS_SEARCH_MIN_LENGTH = 2

/**
 * Build [startOfDay, startOfNextDay) ISO-UTC bounds for a calendar day in
 * Asia/Jerusalem from a yyyy-mm-dd string. We compute Israel's UTC offset for
 * that date via Intl (handles IDT/IST DST) and subtract it from the local
 * midnight to get the correct UTC instant. Avoids date-string substring compares.
 */
function israelDayRangeToUtc(ymd: string): { startISO: string; endISO: string } | null {
  const parts = ymd.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null
  const [year, month, day] = parts

  // Offset (minutes) of Asia/Jerusalem from UTC at local noon on that date.
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: 'numeric',
    hour12: false,
  })
  const israelHour = Number(fmt.format(noonUtc))
  // If Israel shows e.g. 15:00 when UTC is 12:00, offset is +3h.
  const offsetMinutes = (israelHour - 12) * 60

  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60_000
  const start = new Date(startUtcMs)
  const end = new Date(startUtcMs + 24 * 60 * 60 * 1000)
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}

/**
 * Resolve the full set of matching tow IDs for a single search field, newest
 * first. Returns IDs only (cheap) so we can page hydration + report a total.
 */
async function resolveTowIdsByField(
  companyId: string,
  field: TowSearchField,
  value: string
): Promise<string[]> {
  const v = value.trim()
  if (!v) return []
  const pattern = `%${v}%`

  // order + date filter the tows table directly (already newest-first ordered).
  if (field === 'order') {
    const { data, error } = await supabase
      .from('tows')
      .select('id')
      .eq('company_id', companyId)
      .or(`order_number.ilike.${pattern},customer_order_number.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(SEARCH_BY_FIELD_ID_CAP)
    if (error) throw error
    return (data ?? []).map((r: { id: string }) => r.id)
  }

  if (field === 'date') {
    const range = israelDayRangeToUtc(v)
    if (!range) return []
    const { data, error } = await supabase
      .from('tows')
      .select('id')
      .eq('company_id', companyId)
      .gte('scheduled_at', range.startISO)
      .lt('scheduled_at', range.endISO)
      .order('created_at', { ascending: false })
      .limit(SEARCH_BY_FIELD_ID_CAP)
    if (error) throw error
    return (data ?? []).map((r: { id: string }) => r.id)
  }

  // customer + vehicle resolve foreign IDs first, then map to company tows
  // (ordered newest-first) so the result set is bounded and consistent.
  if (field === 'customer') {
    const { data: customers, error: cErr } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', pattern)
    if (cErr) throw cErr
    const customerIds = (customers ?? []).map((c: { id: string }) => c.id)
    if (customerIds.length === 0) return []
    const { data, error } = await supabase
      .from('tows')
      .select('id')
      .eq('company_id', companyId)
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false })
      .limit(SEARCH_BY_FIELD_ID_CAP)
    if (error) throw error
    return (data ?? []).map((r: { id: string }) => r.id)
  }

  if (field === 'vehicle') {
    const { data: vehicleRows, error: vErr } = await supabase
      .from('tow_vehicles')
      .select('tow_id')
      .ilike('plate_number', pattern)
    if (vErr) throw vErr
    const vehicleTowIds = [
      ...new Set((vehicleRows ?? []).map((r: { tow_id: string }) => r.tow_id)),
    ]
    if (vehicleTowIds.length === 0) return []
    const { data, error } = await supabase
      .from('tows')
      .select('id')
      .eq('company_id', companyId)
      .in('id', vehicleTowIds)
      .order('created_at', { ascending: false })
      .limit(SEARCH_BY_FIELD_ID_CAP)
    if (error) throw error
    return (data ?? []).map((r: { id: string }) => r.id)
  }

  // driver: users.full_name → drivers.user_id → tows (BOTH driver slots).
  if (field === 'driver') {
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('id')
      .ilike('full_name', pattern)
    if (uErr) throw uErr
    const userIds = (users ?? []).map((u: { id: string }) => u.id)
    if (userIds.length === 0) return []

    const { data: driverRows, error: dErr } = await supabase
      .from('drivers')
      .select('id')
      .in('user_id', userIds)
    if (dErr) throw dErr
    const driverIds = (driverRows ?? []).map((d: { id: string }) => d.id)
    if (driverIds.length === 0) return []

    // UUIDs contain no commas/parens, so they're safe inside an .or in-list.
    const inList = `(${driverIds.join(',')})`
    const { data, error } = await supabase
      .from('tows')
      .select('id')
      .eq('company_id', companyId)
      .or(`driver_id.in.${inList},second_driver_id.in.${inList}`)
      .order('created_at', { ascending: false })
      .limit(SEARCH_BY_FIELD_ID_CAP)
    if (error) throw error
    return (data ?? []).map((r: { id: string }) => r.id)
  }

  // address: tow_legs from/to (contains). Min-length guard + capped legs query
  // so a broad term ("ישראל") can't pull an unbounded tow_id set.
  if (field === 'address') {
    if (v.length < ADDRESS_SEARCH_MIN_LENGTH) return []
    const { data: legRows, error: lErr } = await supabase
      .from('tow_legs')
      .select('tow_id')
      .or(`from_address.ilike.${pattern},to_address.ilike.${pattern}`)
      .limit(SEARCH_BY_FIELD_ID_CAP)
    if (lErr) throw lErr
    const legTowIds = [
      ...new Set((legRows ?? []).map((r: { tow_id: string }) => r.tow_id)),
    ]
    if (legTowIds.length === 0) return []
    const { data, error } = await supabase
      .from('tows')
      .select('id')
      .eq('company_id', companyId)
      .in('id', legTowIds)
      .order('created_at', { ascending: false })
      .limit(SEARCH_BY_FIELD_ID_CAP)
    if (error) throw error
    return (data ?? []).map((r: { id: string }) => r.id)
  }

  return []
}

/**
 * Search tows by ONE explicit field across the company's entire history.
 * Resolves matching IDs (newest-first, capped), then hydrates a paginated
 * window with the same slim list shape as getTows. `total` is the full match
 * count so the UI can show "נמצאו N תוצאות".
 *
 * - order    → tows.order_number / customer_order_number (contains)
 * - customer → customers.name (contains) → tows.customer_id
 * - vehicle  → tow_vehicles.plate_number (contains) → tow_id
 * - date     → tows.scheduled_at within the Asia/Jerusalem calendar day
 * - driver   → users.full_name (contains) → drivers → tows (driver + second_driver)
 * - address  → tow_legs.from_address / to_address (contains, min 2 chars) → tow_id
 */
export async function searchTowsByField(
  companyId: string,
  field: TowSearchField,
  value: string,
  options: { limit?: number; offset?: number } = {}
): Promise<SearchTowsByFieldResult> {
  const limit = options.limit ?? 100
  const offset = options.offset ?? 0

  const allIds = await resolveTowIdsByField(companyId, field, value)
  const total = allIds.length
  const capped = total >= SEARCH_BY_FIELD_ID_CAP
  if (total === 0) return { rows: [], total: 0, capped: false }

  const pageIds = allIds.slice(offset, offset + limit)
  if (pageIds.length === 0) return { rows: [], total, capped }

  const { data: tows, error } = await supabase
    .from('tows')
    .select(TOW_LIST_SELECT)
    .in('id', pageIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching searched tows:', error)
    throw error
  }

  const rows = await hydrateTowListRows(
    (tows ?? []) as unknown as Record<string, unknown>[]
  )
  return { rows, total, capped }
}

export interface TowListStats {
  total: number
  pending: number
  assigned: number
  in_progress: number
  completed: number
}

async function countTowsByStatus(companyId: string, status?: string): Promise<number> {
  let query = supabase
    .from('tows')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  if (status) {
    query = query.eq('status', status)
  }

  const { count, error } = await query

  if (error) {
    console.error('Error counting tows:', error)
    throw error
  }

  return count ?? 0
}

/** Exact DB totals for tows list summary cards (all history, not limited by list fetch). */
export async function getTowListStats(companyId: string): Promise<TowListStats> {
  const [total, pending, assigned, in_progress, completed] = await Promise.all([
    countTowsByStatus(companyId),
    countTowsByStatus(companyId, 'pending'),
    countTowsByStatus(companyId, 'assigned'),
    countTowsByStatus(companyId, 'in_progress'),
    countTowsByStatus(companyId, 'completed'),
  ])

  return { total, pending, assigned, in_progress, completed }
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
  const [towRes, vehiclesRes, legsRes, pointsRes, imagesRes] = await Promise.all([
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
      )
    `)
      .eq('tow_id', towId)
      .order('point_order', { ascending: true }),
    supabase
      .from('tow_images')
      .select('id, image_url, image_type, tow_point_id, tow_vehicle_id, notes, created_at')
      .eq('tow_id', towId)
      .order('created_at', { ascending: true }),
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

  if (imagesRes.error) {
    console.error('Error fetching tow images:', {
      message: imagesRes.error.message,
      code: imagesRes.error.code,
      details: imagesRes.error.details,
      hint: imagesRes.error.hint,
    })
  }

  type TowPointImageRow = {
    id: string
    image_url: string
    image_type: string
    tow_point_id: string
    tow_vehicle_id: string | null
    notes: string | null
    created_at: string
  }

  const imagesByPointId: Record<string, TowPointImageRow[]> = {}
  if (!imagesRes.error) {
    for (const img of imagesRes.data ?? []) {
      if (!img.tow_point_id) continue
      if (!imagesByPointId[img.tow_point_id]) {
        imagesByPointId[img.tow_point_id] = []
      }
      imagesByPointId[img.tow_point_id].push(img)
    }
  }

  const points = (pointsRes.data ?? []).map((point) => ({
    ...point,
    images: imagesByPointId[point.id] ?? [],
  })) as TowPointWithDetails[]

  const tow = towRes.data

  return {
    ...tow,
    customer: tow.customer as any,
    driver: tow.driver as any,
    truck: tow.truck as any,
    vehicles: vehiclesRes.data || [],
    legs: legsRes.data || [],
    points,
  }
}

// ==================== יצירת גרירה ====================

// NEW: טייפ לנקודה מוכנה לשמירה
export interface PreparedTowPoint {
  id?: string
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
    id?: string
    plateNumber: string
    vehicleCode?: string
    manufacturer?: string
    model?: string
    year?: number
    vehicleType?: PersistedVehicleType
    color?: string
    isWorking?: boolean
    towReason?: string
    notes?: string
    driveType?: string
    fuelType?: string
    totalWeight?: number
    curbWeightKg?: number
    gearType?: string
    driveTechnology?: string
    registrySource?: string | null
    selfWeightTon?: number
    totalWeightTon?: number
    machineryType?: string
    chassis?: string | null
    importType?: string | null
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
  status?: 'quote' | 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'cancelled_charged'

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

  // Precompute IDs and bulk payloads (preserve ids from edit prep when provided)
  const vehicleIds = input.vehicles.map((v) => persistableUuid(v.id))
  const pointIds = (input.points || []).map((p) => persistableUuid(p.id))

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
    curb_weight_kg: v.curbWeightKg ?? null,
    gear_type: v.gearType || null,
    drive_technology: v.driveTechnology || null,
    vehicle_code: v.vehicleCode || null,
    registry_source: v.registrySource ?? null,
    self_weight_ton: v.selfWeightTon ?? null,
    total_weight_ton: v.totalWeightTon ?? null,
    machinery_type: v.machineryType ?? null,
    chassis: v.chassis ?? null,
    import_type: v.importType ?? null,
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

  // tow_vehicles must exist before tow_legs (FK on tow_vehicle_id) and before
  // tow_point_vehicles; legs and points can be inserted in parallel afterward.
  if (vehicleRows.length > 0) {
    const { error: vehiclesError } = await supabase.from('tow_vehicles').insert(vehicleRows)
    if (vehiclesError) {
      console.error('Error creating tow vehicle:', vehiclesError)
      await supabase.from('tows').delete().eq('id', towId)
      throw vehiclesError
    }
  }

  const [legsResult, pointsResult] = await Promise.all([
    legRows.length > 0
      ? supabase.from('tow_legs').insert(legRows)
      : Promise.resolve({ error: null } as { error: any }),
    pointRows.length > 0
      ? supabase.from('tow_points').insert(pointRows)
      : Promise.resolve({ error: null } as { error: any }),
  ])

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

export type ApproveTowQuoteResult =
  | { approved: true; newStatus: 'pending' | 'assigned' }
  | { approved: false; reason: 'not_quote' | 'not_found' }

/**
 * Promote a saved quote tow to pending/assigned and sync to legacy Google Calendar.
 * No-op when status is not 'quote'.
 */
export async function approveTowQuote(towId: string): Promise<ApproveTowQuoteResult> {
  const { data: existing, error: fetchError } = await supabase
    .from('tows')
    .select('status, driver_id')
    .eq('id', towId)
    .maybeSingle()

  if (fetchError) {
    console.error('Error fetching tow for quote approval:', fetchError)
    throw fetchError
  }

  if (!existing) {
    return { approved: false, reason: 'not_found' }
  }

  if (existing.status !== 'quote') {
    return { approved: false, reason: 'not_quote' }
  }

  const newStatus: 'pending' | 'assigned' = existing.driver_id ? 'assigned' : 'pending'

  const { data: updated, error: updateError } = await supabase
    .from('tows')
    .update({ status: newStatus })
    .eq('id', towId)
    .eq('status', 'quote')
    .select('id')
    .maybeSingle()

  if (updateError) {
    console.error('Error approving tow quote:', updateError)
    throw updateError
  }

  if (!updated) {
    return { approved: false, reason: 'not_quote' }
  }

  await syncTowToLegacyCalendar(towId)

  return { approved: true, newStatus }
}

export async function updateTowStatus(
  towId: string,
  status: 'quote' | 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'cancelled_charged',
  cancellationReason?: string,
  cancellationDetails?: string,
  cancellationFee?: number,
  changedBy?: string
) {
  const isTerminalCancel = status === 'cancelled' || status === 'cancelled_charged'
  let previousStatus: string | null = null

  if (isTerminalCancel) {
    const { data: existing } = await supabase
      .from('tows')
      .select('status')
      .eq('id', towId)
      .maybeSingle()
    previousStatus = existing?.status ?? null
  }

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
    updates.driver_id = null
    updates.truck_id = null
  } else if (status === 'cancelled_charged') {
    updates.cancelled_at = new Date().toISOString()
    if (cancellationFee != null && cancellationFee > 0) {
      updates.cancellation_fee = cancellationFee
    }
  }

  const { error } = await supabase
    .from('tows')
    .update(updates)
    .eq('id', towId)

  if (error) {
    console.error(
      'Error updating tow status:',
      error.message,
      error.code,
      error.details,
      error.hint
    )
    throw error
  }

  if (isTerminalCancel) {
    try {
      const reserved = await getVehiclesReservedForTow(towId)
      for (const v of reserved) {
        await unreserveVehicleFromTow({ storedVehicleId: v.id })
      }
    } catch (err) {
      console.error('[updateTowStatus] failed to unreserve vehicles:', err)
    }

    if (changedBy) {
      const logs: { field_name: string; old_value: string | null; new_value: string | null }[] = [
        {
          field_name: 'סטטוס',
          old_value: previousStatus,
          new_value: status,
        },
      ]
      if (status === 'cancelled_charged' && cancellationFee != null && cancellationFee > 0) {
        logs.push({
          field_name: 'דמי ביטול',
          old_value: null,
          new_value: String(cancellationFee),
        })
      }
      try {
        await saveTowChangeLogs(towId, changedBy, logs)
      } catch (err) {
        console.error('[updateTowStatus] failed to save change logs:', err)
      }
    }
  }

  return true
}

// ==================== סגירה ידנית (מנהל) ====================

export async function manualCloseTow(
  towId: string,
  adminUserId: string,
  endTimeIso: string | undefined,
  adminFullName: string
) {
  const [towRes, pointsRes] = await Promise.all([
    supabase.from('tows').select('id, status').eq('id', towId).single(),
    supabase
      .from('tow_points')
      .select('id, status, is_storage')
      .eq('tow_id', towId)
      .order('point_order', { ascending: true }),
  ])

  if (towRes.error) {
    console.error('Error fetching tow for manual close:', towRes.error)
    throw towRes.error
  }

  if (!towRes.data) {
    throw new Error('הגרירה לא נמצאה')
  }

  const tow = towRes.data

  if (tow.status !== 'assigned' && tow.status !== 'in_progress') {
    throw new Error('ניתן לסגור ידנית רק גרירות בשיבוץ או בביצוע')
  }

  if (pointsRes.error) {
    console.error('Error fetching tow points for manual close:', pointsRes.error)
    throw pointsRes.error
  }

  const points = pointsRes.data ?? []
  const incompletePoints = points.filter(
    (p) => p.status !== 'completed' && p.status !== 'skipped'
  )
  const nonStoragePoints = incompletePoints.filter((p) => !p.is_storage)
  const storagePoints = incompletePoints.filter((p) => p.is_storage)

  if (nonStoragePoints.length > 0) {
    const pointCompletedAt = new Date().toISOString()
    const { error: batchError } = await supabase
      .from('tow_points')
      .update({
        status: 'completed',
        completed_at: pointCompletedAt,
        updated_at: pointCompletedAt,
      })
      .in(
        'id',
        nonStoragePoints.map((p) => p.id)
      )

    if (batchError) {
      console.error('Error batch-completing tow points:', batchError)
      throw batchError
    }
  }

  for (const point of storagePoints) {
    await updatePointStatus(point.id, 'completed')
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

  const adminName = adminFullName.trim() || 'מנהל'
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

/** Light tow fetch for post-close sync — tow row + point statuses only. */
export async function getTowDetailLight(towId: string): Promise<{
  tow: NonNullable<Awaited<ReturnType<typeof getTowWithPoints>>>
  points: Pick<TowPointWithDetails, 'id' | 'status' | 'completed_at'>[]
} | null> {
  const [towRes, pointsRes] = await Promise.all([
    supabase.from('tows').select(TOW_WITH_RELATIONS_SELECT).eq('id', towId).single(),
    supabase
      .from('tow_points')
      .select('id, status, completed_at')
      .eq('tow_id', towId)
      .order('point_order', { ascending: true }),
  ])

  if (towRes.error) {
    console.error('Error fetching tow (light):', towRes.error)
    throw towRes.error
  }

  if (!towRes.data) return null

  if (pointsRes.error) {
    console.error('Error fetching tow points (light):', pointsRes.error)
    throw pointsRes.error
  }

  const towRow = towRes.data
  return {
    tow: {
      ...towRow,
      customer: towRow.customer as TowWithDetails['customer'],
      driver: towRow.driver as TowWithDetails['driver'],
      truck: towRow.truck as TowWithDetails['truck'],
      manually_closed_by_user: towRow.manually_closed_by_user as TowWithDetails['manually_closed_by_user'],
      vehicles: [],
      legs: [],
      points: [],
    },
    points: (pointsRes.data ?? []) as Pick<TowPointWithDetails, 'id' | 'status' | 'completed_at'>[],
  }
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
  if (vehicleType === 'personal_import') return 'private'
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
  customerOrderNumber?: string | null
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
    customerOrderNumber: input.customerOrderNumber ?? undefined,
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
    vehicleType?: PersistedVehicleType
    color?: string
    isWorking?: boolean
    towReason?: string
    notes?: string
    driveType?: string
    fuelType?: string
    totalWeight?: number
    curbWeightKg?: number
    gearType?: string
    driveTechnology?: string
    registrySource?: string | null
    selfWeightTon?: number
    totalWeightTon?: number
    machineryType?: string
    chassis?: string | null
    importType?: string | null
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
  status?: 'quote' | 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'cancelled_charged'

}

type UpdateTowVehicleInput = NonNullable<UpdateTowInput['vehicles']>[number]

function buildVehicleOfficeRow(v: UpdateTowVehicleInput, orderIndex: number) {
  return {
    plate_number: v.plateNumber,
    manufacturer: v.manufacturer || null,
    model: v.model || null,
    year: v.year || null,
    vehicle_type: v.vehicleType || null,
    color: v.color || null,
    is_working: v.isWorking ?? true,
    tow_reason: v.towReason || null,
    notes: v.notes || null,
    order_index: orderIndex,
    vehicle_code: v.vehicleCode || null,
    registry_source: v.registrySource ?? null,
    drive_type: v.driveType || null,
    fuel_type: v.fuelType || null,
    total_weight: v.totalWeight || null,
    curb_weight_kg: v.curbWeightKg ?? null,
    gear_type: v.gearType || null,
    drive_technology: v.driveTechnology || null,
    self_weight_ton: v.selfWeightTon ?? null,
    total_weight_ton: v.totalWeightTon ?? null,
    machinery_type: v.machineryType ?? null,
    chassis: v.chassis ?? null,
    import_type: v.importType ?? null,
  }
}

function buildPointOfficeRow(point: PreparedTowPoint, towId: string, forInsert: boolean) {
  const row: Record<string, unknown> = {
    tow_id: towId,
    point_order: point.point_order,
    point_type: point.point_type,
    address: point.address,
    lat: point.lat,
    lng: point.lng,
    contact_name: point.contact_name,
    contact_phone: point.contact_phone,
    order_notes: point.order_notes ?? null,
    is_storage: point.isStorage || false,
    stop_subtype: point.stop_subtype ?? null,
  }
  // Office notes on insert only — driver may write to `notes` during task flow
  if (forInsert) {
    row.notes = point.notes
  }
  return row
}

async function reconcileTowVehicles(
  towId: string,
  vehicles: UpdateTowVehicleInput[]
): Promise<string[]> {
  const { data: existing, error: fetchError } = await supabase
    .from('tow_vehicles')
    .select('id, plate_number, order_index')
    .eq('tow_id', towId)

  if (fetchError) throw fetchError

  const existingRows = existing ?? []
  const existingIds = new Set(existingRows.map((row) => row.id))

  const vehiclesResolved = assignExistingVehicleIds(
    vehicles,
    existingRows.map((row) => ({
      id: row.id,
      plateNumber: row.plate_number,
      orderIndex: row.order_index,
    }))
  )

  const incomingIds = new Set(
    vehiclesResolved.map((v) => v.id).filter((id): id is string => !!id)
  )

  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id))
  if (toDelete.length > 0) {
    const { error: junctionError } = await supabase
      .from('tow_point_vehicles')
      .delete()
      .in('tow_vehicle_id', toDelete)
    if (junctionError) throw junctionError
    const { error } = await supabase.from('tow_vehicles').delete().in('id', toDelete)
    if (error) throw error
  }

  const resolvedIds: string[] = []

  for (let i = 0; i < vehiclesResolved.length; i++) {
    const v = vehiclesResolved[i]
    const officeRow = buildVehicleOfficeRow(v, i)

    if (v.id && existingIds.has(v.id)) {
      const { error } = await supabase
        .from('tow_vehicles')
        .update(officeRow)
        .eq('id', v.id)
      if (error) throw error
      resolvedIds.push(v.id)
    } else {
      const newId = persistableUuid(v.id)
      const { error } = await supabase.from('tow_vehicles').insert({
        id: newId,
        tow_id: towId,
        ...officeRow,
      })
      if (error) throw error
      resolvedIds.push(newId)
    }
  }

  return resolvedIds
}

async function reconcileTowPoints(
  towId: string,
  points: PreparedTowPoint[],
  options?: { protectDriverProgress?: boolean }
): Promise<string[]> {
  const { data: existing, error: fetchError } = await supabase
    .from('tow_points')
    .select('id, point_order, point_type, status')
    .eq('tow_id', towId)

  if (fetchError) throw fetchError

  const existingRows = existing ?? []
  const existingIds = new Set(existingRows.map((row) => row.id))
  const existingById = new Map(existingRows.map((row) => [row.id, row]))

  const pointsResolved = assignExistingPointIds(points, existingRows)

  const incomingIds = new Set(
    pointsResolved.map((p) => p.id).filter((id): id is string => !!id)
  )

  let toDelete = [...existingIds].filter((id) => !incomingIds.has(id))
  if (options?.protectDriverProgress) {
    toDelete = toDelete.filter((id) => {
      const status = existingById.get(id)?.status
      return status !== 'completed' && status !== 'skipped'
    })
  }
  if (toDelete.length > 0) {
    const { error: junctionError } = await supabase
      .from('tow_point_vehicles')
      .delete()
      .in('tow_point_id', toDelete)
    if (junctionError) throw junctionError
    const { error } = await supabase.from('tow_points').delete().in('id', toDelete)
    if (error) throw error
  }

  const resolvedIds: string[] = []

  for (const point of pointsResolved) {
    if (point.id && existingIds.has(point.id)) {
      const officeRow = buildPointOfficeRow(point, towId, false)
      const { error } = await supabase
        .from('tow_points')
        .update(officeRow)
        .eq('id', point.id)
      if (error) throw error
      resolvedIds.push(point.id)
    } else {
      const newId = persistableUuid(point.id)
      const officeRow = buildPointOfficeRow(point, towId, true)
      const { error } = await supabase.from('tow_points').insert({
        id: newId,
        ...officeRow,
        status: 'pending',
      })
      if (error) throw error
      resolvedIds.push(newId)
    }
  }

  return resolvedIds
}

async function reconcileTowPointVehicles(
  points: PreparedTowPoint[],
  resolvedPointIds: string[],
  vehicleIdsByIndex: string[]
) {
  const pointIds = resolvedPointIds.filter(Boolean)
  if (pointIds.length === 0) return

  const desired = points.flatMap((point, pointIndex) => {
    const pointId = resolvedPointIds[pointIndex]
    if (!pointId) return []
    return (point.vehicleIndices || [])
      .map((vehicleIndex) => {
        const vehicleId = vehicleIdsByIndex[vehicleIndex]
        if (!vehicleId) return null
        return {
          tow_point_id: pointId,
          tow_vehicle_id: vehicleId,
          action: point.point_type,
        }
      })
      .filter(
        (row): row is { tow_point_id: string; tow_vehicle_id: string; action: PreparedTowPoint['point_type'] } =>
          row !== null
      )
  })

  const { data: existing, error: fetchError } = await supabase
    .from('tow_point_vehicles')
    .select('id, tow_point_id, tow_vehicle_id, action')
    .in('tow_point_id', pointIds)

  if (fetchError) throw fetchError

  const key = (row: { tow_point_id: string; tow_vehicle_id: string; action: string }) =>
    `${row.tow_point_id}:${row.tow_vehicle_id}:${row.action}`

  const desiredKeys = new Set(desired.map(key))
  const toDelete = (existing ?? [])
    .filter((row) => !desiredKeys.has(key(row)))
    .map((row) => row.id)

  if (toDelete.length > 0) {
    const { error } = await supabase.from('tow_point_vehicles').delete().in('id', toDelete)
    if (error) throw error
  }

  const existingKeys = new Set((existing ?? []).map(key))
  const toInsert = desired.filter((row) => !existingKeys.has(key(row)))

  if (toInsert.length > 0) {
    const { error } = await supabase.from('tow_point_vehicles').insert(toInsert)
    if (error) throw error
  }
}

export async function updateTow(input: UpdateTowInput) {
  const { data: existingTow, error: existingTowError } = await supabase
    .from('tows')
    .select('status')
    .eq('id', input.towId)
    .single()

  if (existingTowError) {
    console.error('Error fetching tow status for update:', existingTowError)
    throw existingTowError
  }

  const protectClosedProgress = isClosedTowStatus(existingTow?.status)

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

  // Assigning a driver to a still-pending tow must promote it to 'assigned',
  // otherwise it stays "ממתין לשיבוץ" and never reaches the driver app
  // (which only loads assigned/in_progress). Only pending → assigned; any other
  // status (in_progress/completed/cancelled/...) and unassignment are untouched.
  if (
    input.driverId &&
    input.status === undefined &&
    existingTow?.status === 'pending'
  ) {
    towUpdates.status = 'assigned'
  }

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

  let vehicleIdsByIndex: string[] = []

  if (input.vehicles) {
    try {
      vehicleIdsByIndex = await reconcileTowVehicles(input.towId, input.vehicles)
    } catch (vehicleError) {
      console.error('Error updating tow vehicle:', vehicleError)
      throw vehicleError
    }
  }

  // tow_legs: legacy display/fallback only — driver progress uses tow_points.
  // Keep delete+reinsert; legs are not read by the driver task flow by id.
  // Skip leg reset on closed tows so completed leg status is preserved.
  if (input.legs && !protectClosedProgress) {
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

  if (input.points) {
    if (vehicleIdsByIndex.length === 0) {
      const { data: vehicles } = await supabase
        .from('tow_vehicles')
        .select('id')
        .eq('tow_id', input.towId)
        .order('order_index', { ascending: true })
      vehicleIdsByIndex = vehicles?.map((v) => v.id) ?? []
    }

    try {
      const resolvedPointIds = await reconcileTowPoints(input.towId, input.points, {
        protectDriverProgress: protectClosedProgress,
      })
      await reconcileTowPointVehicles(
        input.points,
        resolvedPointIds,
        vehicleIdsByIndex
      )
    } catch (pointsError) {
      console.error('Error updating tow points:', pointsError)
      throw pointsError
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
