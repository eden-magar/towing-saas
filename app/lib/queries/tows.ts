import { supabase } from '../supabase'
import {
  getVehiclesReservedForTow,
  unreserveVehicleFromTow,
} from './storage'
import { getCompanySettings } from './settings'
import { updatePointStatus } from './driver-tasks'
import { logManualActionItem } from './manual-action-items'
import type {
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
import type { TowPortalVisibilityOverrides } from '../utils/portal-visibility'
import { persistVehicleCodesToCache } from '../vehicle-lookup'
import { withSignedTowImageUrls } from './tow-images-storage'
import { calculateTowPrice, customerDiscountForPriceMode } from '../utils/price-calculator'
import {
  formatLogDateTime,
  getDriverDisplayName,
  hebrewTowStatusLabel,
  logTowAction,
  stringifyLogValue,
  type TowChangeEntry,
} from './tow-change-log'

export {
  getTowChangeLogs,
  logTowAction,
  resolveActingUserId,
  saveTowChangeLogs,
} from './tow-change-log'

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
    /** Taxable catalog/ad-hoc line; false/undefined means taxed inside the multiplier stack. */
    is_vat_exempt?: boolean
  }[]
  /**
   * VAT-exempt fixed ₪ lines — added after VAT, customer discount, and manual adjustment.
   * Not taxed and not discounted.
   */
  vat_exempt_surcharges?: {
    id: string
    label: string
    price: number
    units?: number
    amount: number
    is_ad_hoc?: boolean
    is_tow_level?: boolean
  }[]
  subtotal: number
  discount_percent: number
  discount_amount: number
  /** Order-level manual discount/markup % (unsigned); null when not applied. */
  manual_adjustment_percent?: number | null
  manual_adjustment_type?: 'discount' | 'markup' | null
  /** Custom priceMode only: whether final_price includes VAT. */
  custom_price_includes_vat?: boolean | null
  /** Custom priceMode only: raw value typed in the custom price input (pre- or post-VAT per flag). */
  custom_price_amount?: number | null
  /** fixed/customer priceMode: catalog item id chosen at save time. */
  selected_price_item_id?: string | null
  /** fixed/customer priceMode: which catalog the item came from. */
  selected_price_item_source?: 'fixed' | 'customer' | null
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
  show_photos_override: boolean | null
  show_price_override: boolean | null
  show_driver_info_override: boolean | null
  show_driver_phone_override: boolean | null
  show_status_history_override: boolean | null
  show_vehicles_override: boolean | null
  show_notes_override: boolean | null
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
    portal_settings?: Record<string, boolean> | null
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
    customer_type,
    portal_settings
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
    console.error('Error fetching tow:', {
      message: towRes.error.message,
      details: towRes.error.details,
      hint: towRes.error.hint,
      code: towRes.error.code,
    })
    throw towRes.error
  }

  if (!towRes.data) return null

  if (vehiclesRes.error) {
    console.error('Error fetching tow vehicles:', {
      message: vehiclesRes.error.message,
      details: vehiclesRes.error.details,
      hint: vehiclesRes.error.hint,
      code: vehiclesRes.error.code,
    })
    throw vehiclesRes.error
  }

  if (legsRes.error) {
    console.error('Error fetching tow legs:', {
      message: legsRes.error.message,
      details: legsRes.error.details,
      hint: legsRes.error.hint,
      code: legsRes.error.code,
    })
    throw legsRes.error
  }

  if (pointsRes.error) {
    console.error('Error fetching tow points:', {
      message: pointsRes.error.message,
      details: pointsRes.error.details,
      hint: pointsRes.error.hint,
      code: pointsRes.error.code,
    })
  }

  if (imagesRes.error) {
    console.error('Error fetching tow images:', {
      message: imagesRes.error.message,
      details: imagesRes.error.details,
      hint: imagesRes.error.hint,
      code: imagesRes.error.code,
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

  const rawImages = (!imagesRes.error ? imagesRes.data : null) ?? []
  const signedImages = await withSignedTowImageUrls(rawImages)

  const imagesByPointId: Record<string, TowPointImageRow[]> = {}
  for (const img of signedImages) {
    if (!img.tow_point_id) continue
    if (!imagesByPointId[img.tow_point_id]) {
      imagesByPointId[img.tow_point_id] = []
    }
    imagesByPointId[img.tow_point_id].push(img)
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
    images: signedImages,
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
    persistVehicleCodesToCache(input.vehicles)
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

  await logTowAction(towId, [
    {
      field_name: 'יצירת גרירה',
      old_value: null,
      new_value: hebrewTowStatusLabel(status),
    },
  ], input.createdBy)

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

  await logTowAction(towId, [
    {
      field_name: 'אישור הצעת מחיר',
      old_value: hebrewTowStatusLabel('quote'),
      new_value: hebrewTowStatusLabel(newStatus),
    },
  ])

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

  const { data: existing } = await supabase
    .from('tows')
    .select('status')
    .eq('id', towId)
    .maybeSingle()
  const previousStatus: string | null = existing?.status ?? null

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
  }

  if (previousStatus !== status) {
    const logs: TowChangeEntry[] = [
      {
        field_name: 'שינוי סטטוס',
        old_value: hebrewTowStatusLabel(previousStatus),
        new_value: hebrewTowStatusLabel(status),
      },
    ]
    if (status === 'cancelled_charged' && cancellationFee != null && cancellationFee > 0) {
      logs.push({
        field_name: 'דמי ביטול',
        old_value: null,
        new_value: String(cancellationFee),
      })
    }
    await logTowAction(towId, logs, changedBy)
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
    supabase.from('tows').select('id, status, order_number').eq('id', towId).single(),
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

  const towLabel = tow.order_number
    ? `הזמנה ${tow.order_number}`
    : `גרירה ${towId}`

  for (const point of storagePoints) {
    const result = await updatePointStatus(point.id, 'completed')
    if (result.storageOk && result.storageFailures.length === 0) continue

    const failures =
      result.storageFailures.length > 0
        ? result.storageFailures
        : ['unknown']

    for (const failure of failures) {
      const parsed = failure.trim().match(/^(.*?)\s+(add|release)$/i)
      const plate = parsed?.[1]?.trim() || null
      const isRelease = parsed?.[2]?.toLowerCase() === 'release'
      await logManualActionItem({
        type: isRelease ? 'storage_release_failed' : 'storage_add_failed',
        severity: 'high',
        message: isRelease
          ? `סגירה ידנית (${towLabel}): רכב ${plate ?? 'לא ידוע'} לא שוחרר מאחסנה למרות שנקודת האחסון הושלמה`
          : `סגירה ידנית (${towLabel}): רכב ${plate ?? 'לא ידוע'} לא נכנס לאחסנה למרות שנקודת האחסון הושלמה`,
        towId,
        relatedEntity: plate ?? point.id,
        details: {
          storageFailures: result.storageFailures,
          failure,
          pointId: point.id,
          source: 'manualCloseTow',
        },
      })
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

  const adminName = adminFullName.trim() || 'מנהל'
  const closedAtLabel = new Date(now).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  await logTowAction(
    towId,
    [
      {
        field_name: 'סגירה ידנית',
        old_value: hebrewTowStatusLabel(tow.status),
        new_value: `הגרירה נסגרה ידנית ע״י ${adminName} בתאריך ${closedAtLabel}`,
      },
    ],
    adminUserId
  )

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
    .select('scheduled_at, driver_id')
    .eq('id', towId)
    .single()

  const previousDriverId = existing?.driver_id ?? null
  const isRemove = driverId == null || (driverId as unknown) === ''

  const { error } = await supabase
    .from('tows')
    .update({
      driver_id: isRemove ? null : driverId,
      truck_id: truckId || null,
      status: 'assigned',
      scheduled_at: scheduledAt || existing?.scheduled_at || new Date().toISOString(),
    })
    .eq('id', towId)

  if (error) {
    console.error('Error assigning driver:', error)
    throw error
  }

  if (isRemove) {
    const oldName = await getDriverDisplayName(previousDriverId)
    await logTowAction(towId, [
      {
        field_name: 'הסרת נהג',
        old_value: oldName,
        new_value: null,
      },
    ])
  } else {
    const [oldName, newName] = await Promise.all([
      getDriverDisplayName(previousDriverId),
      getDriverDisplayName(driverId),
    ])
    await logTowAction(towId, [
      {
        field_name: 'שיבוץ נהג',
        old_value: oldName,
        new_value: newName ?? 'שובץ',
      },
    ])
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
  isWorking?: boolean
  towReason?: string | null
  registrySource?: string | null
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
        isWorking: input.isWorking ?? true,
        towReason: input.towReason ?? undefined,
        registrySource: input.registrySource ?? input.vehicleData?.source ?? null,
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

export const STORAGE_FOLLOW_UP_NOTES = 'גרירת המשך מאחסנה'

export function isStorageFollowUpTow(
  tow: Pick<TowWithDetails, 'notes'> & {
    points?: { point_type?: string | null; is_storage?: boolean | null }[] | null
  }
): boolean {
  if (tow.notes === STORAGE_FOLLOW_UP_NOTES) return true
  const pickup = (tow.points ?? []).find((p) => p.point_type === 'pickup')
  return pickup?.is_storage === true
}

/** Oldest storage follow-up child for a parent (simple tow linked via linked_tow_id). */
export async function findStorageFollowUpChild(
  parentTowId: string,
  companyId: string
): Promise<TowWithDetails | null> {
  const { data: candidates, error } = await supabase
    .from('tows')
    .select(
      `
      id,
      status,
      notes,
      customer_order_number,
      created_at,
      tow_points (
        point_type,
        is_storage
      )
    `
    )
    .eq('linked_tow_id', parentTowId)
    .eq('company_id', companyId)
    .eq('tow_type', 'simple')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching storage follow-up children:', error)
    throw error
  }

  const matches = (candidates ?? []).filter((row) => {
    if (row.notes === STORAGE_FOLLOW_UP_NOTES) return true
    const pickup = (row.tow_points ?? []).find(
      (p: { point_type?: string | null }) => p.point_type === 'pickup'
    )
    return pickup?.is_storage === true
  })

  if (matches.length > 1) {
    console.warn(
      '[findStorageFollowUpChild] Multiple storage follow-up children for parent',
      parentTowId,
      matches.map((m) => m.id)
    )
  }

  const childId = matches[0]?.id
  if (!childId) return null

  return getTowWithPoints(childId)
}

export interface UpdateStorageFollowUpInput {
  childTowId: string
  pickupAddress: string
  pickupLat: number | null
  pickupLng: number | null
  dropoffAddress: string
  dropoffLat: number | null
  dropoffLng: number | null
  dropoffContactName: string
  dropoffContactPhone: string
  customerOrderNumber?: string | null
  requiredTruckTypes: string[]
  isWorking: boolean
  towReason?: string | null
  vehicle: {
    id: string
    plateNumber: string
    vehicleCode?: string | null
    vehicleType?: string
    manufacturer?: string | null
    model?: string | null
    year?: number | null
    color?: string | null
    registrySource?: string | null
  }
  existingPointIds: { id: string; pointOrder: number; pointType: string }[]
}

/** Update an existing storage follow-up child tow (separate from parent updateTow). */
export async function updateStorageFollowUpTow(input: UpdateStorageFollowUpInput) {
  const pickup = input.pickupAddress.trim()
  const dropoff = input.dropoffAddress.trim()
  const pickupPointId = input.existingPointIds.find((p) => p.pointType === 'pickup')?.id
  const dropoffPointId = input.existingPointIds.find((p) => p.pointType === 'dropoff')?.id

  const points: PreparedTowPoint[] = [
    {
      id: pickupPointId,
      point_order: 0,
      point_type: 'pickup',
      address: pickup,
      lat: input.pickupLat,
      lng: input.pickupLng,
      contact_name: null,
      contact_phone: null,
      notes: null,
      vehicleIndices: [0],
      isStorage: true,
    },
    {
      id: dropoffPointId,
      point_order: 1,
      point_type: 'dropoff',
      address: dropoff,
      lat: input.dropoffLat,
      lng: input.dropoffLng,
      contact_name: input.dropoffContactName.trim() || null,
      contact_phone: input.dropoffContactPhone.trim() || null,
      notes: null,
      vehicleIndices: [0],
      isStorage: false,
    },
  ]

  return updateTow({
    towId: input.childTowId,
    customerOrderNumber: input.customerOrderNumber,
    requiredTruckTypes: input.requiredTruckTypes,
    vehicles: [
      {
        id: input.vehicle.id,
        plateNumber: normalizePlate(input.vehicle.plateNumber),
        vehicleCode: input.vehicle.vehicleCode || undefined,
        vehicleType: mapVehicleTypeForTow(input.vehicle.vehicleType) ?? 'private',
        manufacturer: input.vehicle.manufacturer || undefined,
        model: input.vehicle.model || undefined,
        year: input.vehicle.year ?? undefined,
        color: input.vehicle.color || undefined,
        isWorking: input.isWorking,
        towReason: input.towReason ?? undefined,
        registrySource: input.vehicle.registrySource ?? null,
      },
    ],
    legs: [
      {
        legType: 'pickup',
        fromAddress: pickup,
        toAddress: dropoff,
      },
    ],
    points,
  })
}

/**
 * Resolve defective-vehicle pickup + dropoff for a linked tow.
 * Layout-independent: prefers tow_point_vehicles links (is_working = false),
 * then hub `exchange` point, then four-point order 2/3.
 */
function resolveDefectiveLegPoints(
  points: TowPointWithDetails[] | undefined,
  defectiveVehicleId: string | undefined
): {
  pickup: TowPointWithDetails | undefined
  dropoff: TowPointWithDetails | undefined
} {
  const sorted = [...(points ?? [])].sort((a, b) => a.point_order - b.point_order)

  const linksDefective = (p: TowPointWithDetails) =>
    (p.vehicles ?? []).some((pv) => {
      const vehicle = pv.vehicle as (TowVehicle & { id?: string }) | null | undefined
      if (!vehicle) return false
      if (vehicle.is_working === false) return true
      return !!defectiveVehicleId && vehicle.id === defectiveVehicleId
    })

  const defectiveLinked = sorted.filter(linksDefective)
  if (defectiveLinked.length > 0) {
    const pickup =
      defectiveLinked.find(
        (p) => p.point_type === 'pickup' || p.point_type === 'exchange'
      ) ??
      defectiveLinked.find((p) =>
        (p.vehicles ?? []).some((pv) => {
          const action = String(pv.action)
          return action === 'pickup' || action === 'exchange'
        })
      )
    const dropoff = defectiveLinked.find((p) => p.point_type === 'dropoff')
    return { pickup, dropoff }
  }

  const hubExchange = sorted.find((p) => p.point_type === 'exchange')
  if (hubExchange) {
    const defectiveDropoffs = sorted.filter(
      (p) => p.point_type === 'dropoff' && linksDefective(p)
    )
    return {
      pickup: hubExchange,
      dropoff:
        defectiveDropoffs[0] ??
        sorted.filter((p) => p.point_type === 'dropoff').at(-1) ??
        sorted.find((p) => p.point_type === 'dropoff'),
    }
  }

  // Four-point without junction rows: pickup @ order 2, dropoff @ order 3
  if (sorted.length === 4) {
    return {
      pickup:
        sorted.find((p) => p.point_order === 2 && p.point_type === 'pickup') ??
        sorted[2],
      dropoff:
        sorted.find((p) => p.point_order === 3 && p.point_type === 'dropoff') ??
        sorted[3],
    }
  }

  return {
    pickup: sorted.find((p) => p.point_type === 'exchange'),
    dropoff: sorted.find((p) => p.point_type === 'dropoff'),
  }
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
  const { pickup: defectivePickupPoint, dropoff: dropoffPoint } =
    resolveDefectiveLegPoints(
      originalTow.points,
      defectiveVehicle?.id
    )

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
  if (defectivePickupPoint) {
    points.push({
      tow_id: towId,
      point_order: 0,
      point_type: 'pickup',
      address: defectivePickupPoint.address,
      lat: defectivePickupPoint.lat,
      lng: defectivePickupPoint.lng,
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

  await logTowAction(
    towId,
    [
      {
        field_name: 'יצירת גרירה',
        old_value: null,
        new_value: `גרירה מקושרת — ${hebrewTowStatusLabel(status)}`,
      },
    ],
    input.createdBy
  )

  return { id: towId }
}

// ==================== עדכון מחיר ====================

export async function updateTowPrice(towId: string, finalPrice: number) {
  const { data: existing } = await supabase
    .from('tows')
    .select('final_price')
    .eq('id', towId)
    .maybeSingle()

  const { error } = await supabase
    .from('tows')
    .update({ final_price: finalPrice })
    .eq('id', towId)

  if (error) {
    console.error('Error updating tow price:', error)
    throw error
  }

  await logTowAction(towId, [
    {
      field_name: 'מחיר סופי',
      old_value: existing?.final_price != null ? String(existing.final_price) : null,
      new_value: String(finalPrice),
    },
  ])

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
  portalVisibilityOverrides?: Partial<TowPortalVisibilityOverrides>
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
    .select(
      `
      status,
      customer_id,
      customer_order_number,
      department,
      ordered_by,
      notes,
      final_price,
      recommended_price,
      price_mode,
      price_breakdown,
      scheduled_at,
      scheduled_end_at,
      completed_at,
      payment_method,
      invoice_name,
      start_from_base,
      dropoff_to_storage,
      required_truck_types,
      visibility_overrides,
      show_photos_override,
      show_price_override,
      show_driver_info_override,
      show_driver_phone_override,
      show_status_history_override,
      show_vehicles_override,
      show_notes_override,
      second_driver_id,
      second_driver_scheduled_at,
      tow_type,
      driver_id,
      truck_id
    `
    )
    .eq('id', input.towId)
    .single()

  if (existingTowError) {
    console.error('Error fetching tow status for update:', existingTowError)
    throw existingTowError
  }

  const protectClosedProgress = isClosedTowStatus(existingTow?.status)

  const [existingVehiclesRes, existingPointsRes, existingLegsRes] = await Promise.all([
    input.vehicles
      ? supabase
          .from('tow_vehicles')
          .select('id, plate_number, manufacturer, model, color, is_working, tow_reason, order_index')
          .eq('tow_id', input.towId)
          .order('order_index', { ascending: true })
      : Promise.resolve({ data: null as any, error: null }),
    input.points
      ? supabase
          .from('tow_points')
          .select('id, point_order, point_type, address, contact_name, contact_phone, status')
          .eq('tow_id', input.towId)
          .order('point_order', { ascending: true })
      : Promise.resolve({ data: null as any, error: null }),
    input.legs && !protectClosedProgress
      ? supabase
          .from('tow_legs')
          .select('leg_type, leg_order, from_address, to_address')
          .eq('tow_id', input.towId)
          .order('leg_order', { ascending: true })
      : Promise.resolve({ data: null as any, error: null }),
  ])

  const changeLogs: TowChangeEntry[] = []
  const pushIfChanged = (
    fieldName: string,
    oldVal: string | null,
    newVal: string | null
  ) => {
    const o = oldVal ?? null
    const n = newVal ?? null
    if (o === n) return
    changeLogs.push({ field_name: fieldName, old_value: o, new_value: n })
  }

  const towUpdates: Record<string, any> = {}

  if (input.customerId !== undefined) {
    towUpdates.customer_id = input.customerId
    if ((existingTow?.customer_id ?? null) !== (input.customerId ?? null)) {
      const ids = [existingTow?.customer_id, input.customerId].filter(Boolean) as string[]
      let nameById = new Map<string, string>()
      if (ids.length > 0) {
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', ids)
        nameById = new Map((customers ?? []).map((c) => [c.id, c.name]))
      }
      pushIfChanged(
        'לקוח',
        existingTow?.customer_id
          ? nameById.get(existingTow.customer_id) ?? existingTow.customer_id
          : null,
        input.customerId ? nameById.get(input.customerId) ?? input.customerId : null
      )
    }
  }
  if (input.customerOrderNumber !== undefined) {
    towUpdates.customer_order_number = input.customerOrderNumber || null
    pushIfChanged(
      'מספר הזמנת לקוח',
      existingTow?.customer_order_number ?? null,
      input.customerOrderNumber || null
    )
  }
  if (input.department !== undefined) {
    towUpdates.department = input.department
    pushIfChanged('מחלקה', existingTow?.department ?? null, input.department ?? null)
  }
  if (input.ordered_by !== undefined) {
    towUpdates.ordered_by = input.ordered_by
    pushIfChanged('מזמין', existingTow?.ordered_by ?? null, input.ordered_by ?? null)
  }
  if (input.notes !== undefined) {
    towUpdates.notes = input.notes
    pushIfChanged('הערות', existingTow?.notes ?? null, input.notes ?? null)
  }
  if (input.finalPrice !== undefined) {
    towUpdates.final_price = input.finalPrice
    pushIfChanged(
      'מחיר סופי',
      existingTow?.final_price != null ? String(existingTow.final_price) : null,
      input.finalPrice != null ? String(input.finalPrice) : null
    )
  }
  if (input.recommendedPrice !== undefined) {
    towUpdates.recommended_price = input.recommendedPrice
    pushIfChanged(
      'מחיר מומלץ',
      existingTow?.recommended_price != null ? String(existingTow.recommended_price) : null,
      input.recommendedPrice != null ? String(input.recommendedPrice) : null
    )
  }
  if (input.priceBreakdown !== undefined) {
    towUpdates.price_breakdown = input.priceBreakdown
    const oldTotal =
      existingTow?.price_breakdown &&
      typeof (existingTow.price_breakdown as any).total === 'number'
        ? String((existingTow.price_breakdown as any).total)
        : stringifyLogValue(existingTow?.price_breakdown)
    const newTotal =
      input.priceBreakdown && typeof input.priceBreakdown.total === 'number'
        ? String(input.priceBreakdown.total)
        : stringifyLogValue(input.priceBreakdown)
    pushIfChanged('פירוט מחיר', oldTotal, newTotal)
  }
  if (input.priceMode !== undefined) {
    towUpdates.price_mode = input.priceMode
    pushIfChanged('מצב מחיר', existingTow?.price_mode ?? null, input.priceMode ?? null)
  }
  if (input.requiredTruckTypes !== undefined) {
    towUpdates.required_truck_types = input.requiredTruckTypes
    pushIfChanged(
      'סוגי גרר נדרשים',
      stringifyLogValue(existingTow?.required_truck_types),
      stringifyLogValue(input.requiredTruckTypes)
    )
  }
  if (input.scheduledAt !== undefined) {
    towUpdates.scheduled_at = input.scheduledAt
    pushIfChanged(
      'תאריך ושעה',
      formatLogDateTime(existingTow?.scheduled_at),
      formatLogDateTime(input.scheduledAt)
    )
  }
  if (input.scheduledEndAt !== undefined) {
    towUpdates.scheduled_end_at = input.scheduledEndAt
    pushIfChanged(
      'שעת סיום מתוכננת',
      formatLogDateTime(existingTow?.scheduled_end_at),
      formatLogDateTime(input.scheduledEndAt)
    )
  }
  if (input.completedAt !== undefined) {
    towUpdates.completed_at = input.completedAt
    pushIfChanged(
      'שעת סיום בפועל',
      formatLogDateTime(existingTow?.completed_at),
      formatLogDateTime(input.completedAt)
    )
  }
  if (input.paymentMethod !== undefined) {
    towUpdates.payment_method = input.paymentMethod
    pushIfChanged(
      'אמצעי תשלום',
      existingTow?.payment_method ?? null,
      input.paymentMethod ?? null
    )
  }
  if (input.invoiceName !== undefined) {
    towUpdates.invoice_name = input.invoiceName
    pushIfChanged('שם לחשבונית', existingTow?.invoice_name ?? null, input.invoiceName ?? null)
  }
  if (input.startFromBase !== undefined) {
    towUpdates.start_from_base = input.startFromBase
    pushIfChanged(
      'יציאה מבסיס',
      stringifyLogValue(existingTow?.start_from_base),
      stringifyLogValue(input.startFromBase)
    )
  }
  if (input.dropoffToStorage !== undefined) {
    towUpdates.dropoff_to_storage = input.dropoffToStorage
    pushIfChanged(
      'פריקה לאחסנה',
      stringifyLogValue(existingTow?.dropoff_to_storage),
      stringifyLogValue(input.dropoffToStorage)
    )
  }
  if (input.visibilityOverrides !== undefined) {
    towUpdates.visibility_overrides = input.visibilityOverrides
    pushIfChanged(
      'הגדרות תצוגה',
      stringifyLogValue(existingTow?.visibility_overrides),
      stringifyLogValue(input.visibilityOverrides)
    )
  }
  if (input.portalVisibilityOverrides) {
    for (const [column, value] of Object.entries(input.portalVisibilityOverrides)) {
      towUpdates[column] = value
      const prev = (existingTow as any)?.[column]
      if (prev !== value) {
        pushIfChanged(`תצוגת פורטל (${column})`, stringifyLogValue(prev), stringifyLogValue(value))
      }
    }
  }
  if (input.secondDriverId !== undefined) {
    towUpdates.second_driver_id = input.secondDriverId
    if ((existingTow?.second_driver_id ?? null) !== (input.secondDriverId ?? null)) {
      const [oldName, newName] = await Promise.all([
        getDriverDisplayName(existingTow?.second_driver_id),
        getDriverDisplayName(input.secondDriverId),
      ])
      pushIfChanged('נהג שני', oldName, newName)
    }
  }
  if (input.secondDriverScheduledAt !== undefined) {
    towUpdates.second_driver_scheduled_at = input.secondDriverScheduledAt
    pushIfChanged(
      'תזמון נהג שני',
      formatLogDateTime(existingTow?.second_driver_scheduled_at),
      formatLogDateTime(input.secondDriverScheduledAt)
    )
  }
  if (input.towType !== undefined) {
    towUpdates.tow_type = input.towType
    pushIfChanged('סוג גרירה', existingTow?.tow_type ?? null, input.towType ?? null)
  }
  if (input.driverId !== undefined) {
    towUpdates.driver_id = input.driverId
    if ((existingTow?.driver_id ?? null) !== (input.driverId ?? null)) {
      const [oldName, newName] = await Promise.all([
        getDriverDisplayName(existingTow?.driver_id),
        getDriverDisplayName(input.driverId),
      ])
      pushIfChanged('נהג', oldName, newName)
    }
  }
  if (input.truckId !== undefined) {
    towUpdates.truck_id = input.truckId
    pushIfChanged('גרר', existingTow?.truck_id ?? null, input.truckId ?? null)
  }
  if (input.status !== undefined) {
    towUpdates.status = input.status
    pushIfChanged(
      'שינוי סטטוס',
      hebrewTowStatusLabel(existingTow?.status),
      hebrewTowStatusLabel(input.status)
    )
  }

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
    pushIfChanged(
      'שינוי סטטוס',
      hebrewTowStatusLabel('pending'),
      hebrewTowStatusLabel('assigned')
    )
  }

  if (input.vehicles) {
    const prevPlates = (existingVehiclesRes.data ?? [])
      .map((v: { plate_number: string }) => v.plate_number)
      .filter(Boolean)
      .join(', ')
    const nextPlates = input.vehicles
      .map((v) => v.plateNumber)
      .filter(Boolean)
      .join(', ')
    pushIfChanged('רכבים', prevPlates || null, nextPlates || null)
  }

  if (input.legs && !protectClosedProgress) {
    const summarizeLegs = (
      rows: { leg_type?: string; from_address?: string | null; to_address?: string | null; legType?: string; fromAddress?: string; toAddress?: string }[]
    ) =>
      rows
        .map((l) => {
          const type = l.legType ?? l.leg_type ?? ''
          const from = l.fromAddress ?? l.from_address ?? ''
          const to = l.toAddress ?? l.to_address ?? ''
          return `${type}: ${from} → ${to}`
        })
        .join(' | ')
    pushIfChanged(
      'מסלול (רגליים)',
      summarizeLegs(existingLegsRes.data ?? []) || null,
      summarizeLegs(input.legs) || null
    )
  }

  if (input.points) {
    type PrevPointRow = {
      id: string
      point_order: number
      point_type: string
      address: string | null
      contact_name: string | null
      contact_phone: string | null
      status: string
    }
    const prevPoints = (existingPointsRes.data ?? []) as PrevPointRow[]
    const prevById = new Map(prevPoints.map((p) => [p.id, p]))
    const incomingIds = new Set(
      input.points.map((p) => p.id).filter((id): id is string => !!id)
    )

    for (const prev of prevPoints) {
      if (!incomingIds.has(prev.id)) {
        changeLogs.push({
          field_name: 'נקודה הוסרה',
          old_value: prev.address || `נקודה ${prev.point_order}`,
          new_value: null,
        })
      }
    }

    for (const point of input.points) {
      if (point.id && prevById.has(point.id)) {
        const prev = prevById.get(point.id)!
        if ((prev.address ?? null) !== (point.address ?? null)) {
          changeLogs.push({
            field_name: 'כתובת נקודה',
            old_value: prev.address,
            new_value: point.address ?? null,
          })
        }
        const prevContact = [prev.contact_name, prev.contact_phone].filter(Boolean).join(' / ')
        const nextContact = [point.contact_name, point.contact_phone].filter(Boolean).join(' / ')
        if (prevContact !== nextContact) {
          changeLogs.push({
            field_name: 'איש קשר בנקודה',
            old_value: prevContact || null,
            new_value: nextContact || null,
          })
        }
      } else {
        changeLogs.push({
          field_name: 'נקודה נוספה',
          old_value: null,
          new_value: point.address || `${point.point_type} #${point.point_order}`,
        })
      }
    }
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
      persistVehicleCodesToCache(input.vehicles)
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

  if (changeLogs.length > 0) {
    await logTowAction(input.towId, changeLogs)
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
  const tow = await getTow(towId)
  if (!tow || !tow.price_breakdown) return null

  const oldPrice = tow.final_price || 0
  const breakdown = tow.price_breakdown

  const { data: timeSurcharges } = await supabase
    .from('time_surcharges')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (!timeSurcharges) return null

  const newDate = newScheduledAt.toISOString().split('T')[0]
  const newTime = `${String(newScheduledAt.getHours()).padStart(2, '0')}:${String(newScheduledAt.getMinutes()).padStart(2, '0')}`

  const companySettings = await getCompanySettings(companyId)
  const vatRate = (companySettings?.default_vat_percent ?? 18) / 100

  const { data: priceList } = await supabase
    .from('price_lists')
    .select('*')
    .eq('company_id', companyId)
    .is('customer_company_id', null)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const locationSurcharges = (breakdown.location_surcharges || []).map((s) => ({
    id: s.id,
    label: s.label,
    percent: s.percent,
  }))
  const serviceSurcharges = [
    ...(breakdown.service_surcharges || []).map((s) => ({
      amount: s.amount,
      label: s.label,
    })),
    ...(breakdown.vat_exempt_surcharges || []).map((s) => ({
      amount: s.amount,
      label: s.label,
      vatExempt: true as const,
    })),
  ]

  const manualSigned =
    (breakdown.manual_adjustment_percent ?? 0) > 0
      ? breakdown.manual_adjustment_type === 'markup'
        ? breakdown.manual_adjustment_percent!
        : -(breakdown.manual_adjustment_percent!)
      : 0

  const result = calculateTowPrice({
    priceList: {
      base_prices: {
        private: priceList?.base_price_private ?? breakdown.base_price ?? 0,
        motorcycle: priceList?.base_price_motorcycle ?? 0,
        heavy: priceList?.base_price_heavy ?? 0,
        machinery: priceList?.base_price_machinery ?? 0,
        personal_import: priceList?.base_price_private ?? breakdown.base_price ?? 0,
      },
      price_per_km: priceList?.price_per_km ?? 12,
      minimum_price: priceList?.minimum_price ?? 0,
    },
    vehicleType: (breakdown.vehicle_type as any) || 'private',
    distanceKm: breakdown.distance_km || 0,
    deadheadKm: breakdown.deadhead_km || 0,
    deadheadRate:
      (breakdown.deadhead_km || 0) > 0 && (breakdown.deadhead_price || 0) > 0
        ? (breakdown.deadhead_price || 0) / (breakdown.deadhead_km || 1)
        : (priceList as any)?.price_per_km_deadhead ?? 0,
    basePriceOverride: breakdown.base_price,
    timeSurcharges: timeSurcharges as any,
    towDate: newDate,
    towTime: newTime,
    isHoliday: false,
    locationSurcharges,
    serviceSurcharges,
    priceMode: 'recommended',
    discountPercent: customerDiscountForPriceMode(
      tow.price_mode,
      breakdown.discount_percent || 0,
    ),
    manualAdjustmentPercent: manualSigned,
    vatPercent: vatRate,
  })

  const timeSurchargesBreakdown =
    result.maxTimeSurchargePercent > 0
      ? [
          {
            id: '',
            label: result.maxTimeSurchargeLabel || `תוספת זמן`,
            percent: result.maxTimeSurchargePercent,
            amount: result.timeSurchargeAmount,
          },
        ]
      : []

  const locationSurchargesBreakdown = result.locationSurchargeLines.map((line) => {
    const existing = (breakdown.location_surcharges || []).find(
      (s) => s.id === line.id || s.percent === line.percent,
    )
    return {
      id: line.id || existing?.id || '',
      label: line.label || existing?.label || `תוספת מיקום (${line.percent}%)`,
      percent: line.percent,
      amount: line.amount,
    }
  })

  const newBreakdown: PriceBreakdown = {
    ...breakdown,
    base_price: result.basePrice,
    distance_price: result.distancePrice,
    deadhead_km: result.deadheadKm,
    deadhead_price: result.deadheadPrice,
    time_surcharges: timeSurchargesBreakdown,
    location_surcharges: locationSurchargesBreakdown,
    subtotal: result.beforeVat,
    discount_amount: result.discountAmount,
    vat_amount: result.vatAmount,
    total: result.total,
  }

  return {
    oldPrice,
    newPrice: result.total,
    newBreakdown,
  }
}



