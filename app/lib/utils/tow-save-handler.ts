import { PriceBreakdown } from '../queries/tows'
import {
  CustomerWithPricing,
  TimeSurcharge,
  LocationSurcharge,
  ServiceSurcharge,
  getActiveTimeSurcharges,
} from '../queries/price-lists'
import { RoutePoint, VehicleOnTruck } from '../../components/tow-forms/routes/RouteBuilder'
import { SelectedService } from '../../components/tow-forms/shared'
import { calculateTowPrice, extractBasePrices, mergePriceLists, priceListForTowCalc, resolveDeadheadRate, resolveVehicleBasePrice } from './price-calculator'
import { VehicleType, VehicleLookupResult } from '../types'
import { normalizePlate } from './plate-number'
import { serializeDefects } from '../constants/defects'
import {
  assignExistingPointIds,
  assignExistingVehicleIds,
} from './tow-reconcile-match'
import type { AddressData } from '../google-maps'
import {
  type ManualSurcharge,
  manualSurchargesToBreakdown,
  manualSurchargesToCalcInput,
  sanitizeManualSurcharges,
} from './manual-surcharge'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function roundKm1(n: number): number {
  return Math.round(n * 10) / 10
}

// ==================== Types ====================

export interface DistanceResult {
  distanceKm: number
  durationMinutes: number
}

// Input מהטופס
export interface SaveTowInput {
  // Company & User
  companyId: string
  userId: string
  customerOrderNumber?: string
  
  // Tow Type
  towType: 'single' | 'custom' | 'exchange'
  
  // Customer
  customerId: string | null
  customerName: string
  customerPhone: string
  department?: string | null
  orderedBy?: string | null
  /** When false, department/orderedBy are not persisted (saved as null). */
  isBusinessCustomer?: boolean

  // Date/Time
  towDate: string
  towTime: string
  towEndDate?: string
  towEndTime?: string
  
  // Driver (pre-selected)
  preSelectedDriverId: string | null
  preSelectedTruckId?: string | null
  secondDriverId?: string | null
  secondDriverScheduledAt?: string | null
  
  // Single Tow Data
  vehiclePlate?: string
  vehicleCode?: string
  vehicleType?: string
  vehicleData?: any
  selectedDefects?: string[]
  requiredTruckTypes?: string[]
  manualManufacturer?: string
  manualColor?: string
  manualWeight?: string
  manualChassis?: string
  workingManualManufacturer?: string
  workingManualColor?: string
  workingManualWeight?: string
  workingManualChassis?: string
  defectiveManualManufacturer?: string
  defectiveManualColor?: string
  defectiveManualWeight?: string
  defectiveManualChassis?: string
  weightBrackets?: { min_kg: number; max_kg: number | null; base_price: number; sort_order: number }[]
  /** Regular tow: ordered route list (pickup / stop / dropoff in list order) */
  routeStops?: {
    id?: string
    role: 'pickup' | 'dropoff' | 'stop'
    stopSubtype?: 'key' | 'customer_pickup' | 'customer_dropoff' | 'other'
    address: AddressData
    contactName?: string
    contactPhone?: string
    notes?: string
    orderNotes?: string
  }[]
  /** Loaded on edit — used to preserve stable vehicle/point row IDs when the form has no per-field id */
  existingTowVehicles?: { id: string; plateNumber: string; orderIndex: number }[]
  existingTowPoints?: { id: string; pointOrder: number; pointType: string }[]
  distance?: DistanceResult | null
  startFromBase?: boolean
  baseToPickupDistance?: DistanceResult | null
  /** Deadhead (נסיעת סרק) return leg: charge toggle + last dropoff → base distance. */
  chargeDeadheadReturn?: boolean
  dropoffToBaseDistance?: DistanceResult | null
  
  // Custom Tow Data
  routePoints?: RoutePoint[]
  customRouteData?: {
    totalDistanceKm: number
    vehicles: { type: string; isWorking: boolean }[]
    services?: SelectedService[]
  }
  
  // Pricing
  priceMode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  finalPrice: number
  selectedPriceItem?: { id: string; label: string; price: number } | null
  customPrice?: string
  customPriceIncludesVat?: boolean
  vatPercent?: number
  manualAdjustmentPercent?: number
  basePriceList: any
  selectedCustomerPricing: CustomerWithPricing | null
  
  // Surcharges (for single tow)
  activeTimeSurcharges?: TimeSurcharge[]
  timeSurchargesData?: TimeSurcharge[]
  isHoliday?: boolean
  hasManualTimeSurchargeOverride?: boolean
  selectedLocationSurcharges?: string[]
  locationSurchargesData?: LocationSurcharge[]
  selectedServices?: SelectedService[]
  /** Exchange: separate lists so service_surcharges can store vehicle_role */
  workingSelectedServices?: SelectedService[]
  defectiveSelectedServices?: SelectedService[]
  /** Whole-tow catalog selections (exchange/custom) — stored flagged is_tow_level. */
  towServiceSurcharges?: SelectedService[]
  serviceSurchargesData?: ServiceSurcharge[]
  /** Manual (ad-hoc) add-on lines — order-only, not from the catalog. */
  manualSurcharges?: ManualSurcharge[]
  
  // Additional
  notes?: string

  paymentMethod?: string
  invoiceName?: string
  dropoffToStorage?: boolean
  selectedStoredVehicleId?: string | null
  existingPriceBreakdown?: PriceBreakdown | null
  // Exchange specific
  workingVehiclePlate?: string
  workingVehicleCode?: string
  workingVehicleData?: any
  workingVehicleType?: string
  defectiveVehicleType?: string
  workingVehicleSourceAddress?: AddressData
  workingVehicleDestinationAddress?: AddressData
  workingVehicleContactName?: string
  workingVehicleContactPhone?: string
  defectiveVehiclePlate?: string
  defectiveVehicleCode?: string
  defectiveVehicleData?: any
  exchangePointAddress?: AddressData
  exchangeContactName?: string
  exchangeContactPhone?: string
  workingDestinationContactName?: string
  workingDestinationContactPhone?: string
  defectiveDestinationAddress?: AddressData
  defectiveDestinationContactName?: string
  defectiveDestinationContactPhone?: string
  workingVehicleSource?: 'storage' | 'address'
  workingVehicleDestinationIsStorage?: boolean
  defectiveDestination?: 'storage' | 'address'
  linkedTowId?: string
  /** Exchange edit: baseline signature captured at hydration — unchanged inputs keep saved price */
  exchangeEditPriceBaselineSignature?: string | null
  exchangeEditOriginalFinalPrice?: number | null
  /** Single-tow edit: baseline signature captured at hydration — unchanged inputs keep saved price */
  singleEditPriceBaselineSignature?: string | null
  singleEditOriginalFinalPrice?: number | null
  exchangeRouteLayout?: 'four_point' | 'hub' | null
  stopsBeforeExchange?: { address: AddressData }[]
  stopsAfterExchange?: { address: AddressData }[]
}

export type ExchangePriceAffectingFields = {
  exchangeRouteLayout?: 'four_point' | 'hub' | null
  workingVehicleSourceAddress?: AddressData
  workingVehicleDestinationAddress?: AddressData
  exchangePointAddress?: AddressData
  defectiveDestinationAddress?: AddressData
  stopsBeforeExchange?: { address: AddressData }[]
  stopsAfterExchange?: { address: AddressData }[]
  chargeDeadheadReturn?: boolean
  deadheadKm?: number
  workingVehicleType?: string
  defectiveVehicleType?: string
  workingManualWeight?: string
  defectiveManualWeight?: string
  priceMode: string
  selectedLocationSurcharges?: string[]
  workingSelectedServices?: SelectedService[]
  defectiveSelectedServices?: SelectedService[]
  towServiceSurcharges?: SelectedService[]
  activeTimeSurchargeIds?: string[]
  timeSurchargesData?: TimeSurcharge[]
  selectedCustomerPricing?: CustomerWithPricing | null
  isHoliday?: boolean
  hasManualTimeSurchargeOverride?: boolean
  manualAdjustmentPercent?: number
  manualSurcharges?: ManualSurcharge[]
  towDate?: string
  towTime?: string
  selectedPriceItemId?: string | null
}

function selectedPriceItemBreakdownFields(
  input: Pick<SaveTowInput, 'priceMode' | 'selectedPriceItem'>
): {
  selected_price_item_id: string | null
  selected_price_item_source: 'fixed' | 'customer' | null
} {
  if (input.priceMode === 'fixed') {
    return {
      selected_price_item_id: input.selectedPriceItem?.id ?? null,
      selected_price_item_source: 'fixed',
    }
  }
  if (input.priceMode === 'customer') {
    return {
      selected_price_item_id: input.selectedPriceItem?.id ?? null,
      selected_price_item_source: 'customer',
    }
  }
  return {
    selected_price_item_id: null,
    selected_price_item_source: null,
  }
}

function exchangeTimeSurchargeIds(fields: ExchangePriceAffectingFields): string {
  if (fields.hasManualTimeSurchargeOverride) {
    return [...(fields.activeTimeSurchargeIds ?? [])].sort().join(',')
  }
  const surchargeSource =
    fields.priceMode === 'recommended_customer' &&
    (fields.selectedCustomerPricing?.customer_time_surcharges?.length ?? 0) > 0
      ? fields.selectedCustomerPricing!.customer_time_surcharges!
      : fields.timeSurchargesData
  if (fields.towDate && fields.towTime && surchargeSource?.length) {
    return getActiveTimeSurcharges(
      surchargeSource,
      fields.towTime,
      fields.towDate,
      fields.isHoliday ?? false
    )
      .map((s) => s.id)
      .sort()
      .join(',')
  }
  return ''
}

function timeSurchargesForPriceCalc(
  input: Pick<SaveTowInput, 'priceMode' | 'selectedCustomerPricing' | 'timeSurchargesData'>
): TimeSurcharge[] {
  if (
    input.priceMode === 'recommended_customer' &&
    (input.selectedCustomerPricing?.customer_time_surcharges?.length ?? 0) > 0
  ) {
    return input.selectedCustomerPricing!.customer_time_surcharges!
  }
  return input.timeSurchargesData || []
}

function exchangeAddressPart(a?: AddressData): string {
  if (!a?.address?.trim()) return ''
  return `${a.address}|${a.lat ?? ''}|${a.lng ?? ''}`
}

function exchangeStopsSignature(stops?: { address: AddressData }[]): string {
  return (stops ?? []).map((s) => exchangeAddressPart(s.address)).join('>')
}

function exchangeServicesSignature(services?: SelectedService[]): string {
  return JSON.stringify(
    (services ?? [])
      .map((s) => ({ id: s.id, q: s.quantity ?? null, m: s.manualPrice ?? null }))
      .sort((a, b) => a.id.localeCompare(b.id))
  )
}

function manualSurchargesSignature(list?: ManualSurcharge[]): string {
  return JSON.stringify(
    sanitizeManualSurcharges(list)
      .map((m) => ({ id: m.id, label: m.label, amount: m.amount }))
      .sort((a, b) => a.id.localeCompare(b.id))
  )
}

/** Persist unsigned manual adjustment fields from signed save input (discount = negative). */
function manualAdjustmentBreakdownFields(input: SaveTowInput): {
  manual_adjustment_percent: number | null
  manual_adjustment_type: 'discount' | 'markup' | null
} {
  const signed = input.manualAdjustmentPercent ?? 0
  if (signed === 0) {
    return { manual_adjustment_percent: null, manual_adjustment_type: null }
  }
  if (signed > 0) {
    return { manual_adjustment_percent: signed, manual_adjustment_type: 'markup' }
  }
  return { manual_adjustment_percent: Math.abs(signed), manual_adjustment_type: 'discount' }
}

/** Never persist a negative tow total (defense in depth vs discount float/round bugs). */
function clampNonNegativePrice(value: number | undefined | null): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined
  return Math.max(0, value)
}

/** Stable signature of exchange inputs that affect recommended/custom price calculation. */
export function buildExchangePriceAffectingSignature(
  fields: ExchangePriceAffectingFields
): string {
  return JSON.stringify({
    layout: fields.exchangeRouteLayout ?? '',
    working: exchangeAddressPart(fields.workingVehicleSourceAddress),
    workingDest: exchangeAddressPart(fields.workingVehicleDestinationAddress),
    exchange: exchangeAddressPart(fields.exchangePointAddress),
    defective: exchangeAddressPart(fields.defectiveDestinationAddress),
    stopsBefore: exchangeStopsSignature(fields.stopsBeforeExchange),
    stopsAfter: exchangeStopsSignature(fields.stopsAfterExchange),
    deadhead: fields.chargeDeadheadReturn ? (fields.deadheadKm ?? 0) : 0,
    workingType: fields.workingVehicleType ?? '',
    defectiveType: fields.defectiveVehicleType ?? '',
    workingWeight: fields.workingManualWeight ?? '',
    defectiveWeight: fields.defectiveManualWeight ?? '',
    priceMode: fields.priceMode,
    location: [...(fields.selectedLocationSurcharges ?? [])].sort().join(','),
    workingSvc: exchangeServicesSignature(fields.workingSelectedServices),
    defectiveSvc: exchangeServicesSignature(fields.defectiveSelectedServices),
    towSvc: exchangeServicesSignature(fields.towServiceSurcharges),
    manualSvc: manualSurchargesSignature(fields.manualSurcharges),
    timeIds: exchangeTimeSurchargeIds(fields),
    towDate: fields.towDate ?? '',
    towTime: fields.towTime ?? '',
    manualAdj: fields.manualAdjustmentPercent ?? 0,
    selectedPriceItemId: fields.selectedPriceItemId ?? '',
  })
}

export function exchangePriceSignatureFromSaveInput(input: SaveTowInput): string {
  return buildExchangePriceAffectingSignature({
    exchangeRouteLayout: input.exchangeRouteLayout,
    workingVehicleSourceAddress: input.workingVehicleSourceAddress,
    workingVehicleDestinationAddress: input.workingVehicleDestinationAddress,
    exchangePointAddress: input.exchangePointAddress,
    defectiveDestinationAddress: input.defectiveDestinationAddress,
    stopsBeforeExchange: input.stopsBeforeExchange,
    stopsAfterExchange: input.stopsAfterExchange,
    chargeDeadheadReturn: input.chargeDeadheadReturn,
    deadheadKm: input.chargeDeadheadReturn ? (input.dropoffToBaseDistance?.distanceKm ?? 0) : 0,
    workingVehicleType: input.workingVehicleType,
    defectiveVehicleType: input.defectiveVehicleType,
    workingManualWeight: input.workingManualWeight,
    defectiveManualWeight: input.defectiveManualWeight,
    priceMode: input.priceMode,
    selectedLocationSurcharges: input.selectedLocationSurcharges,
    workingSelectedServices: input.workingSelectedServices,
    defectiveSelectedServices: input.defectiveSelectedServices,
    towServiceSurcharges: input.towServiceSurcharges,
    activeTimeSurchargeIds: (input.activeTimeSurcharges ?? []).map((s) => s.id),
    timeSurchargesData: input.timeSurchargesData,
    selectedCustomerPricing: input.selectedCustomerPricing,
    isHoliday: input.isHoliday,
    hasManualTimeSurchargeOverride: input.hasManualTimeSurchargeOverride,
    manualAdjustmentPercent: input.manualAdjustmentPercent,
    manualSurcharges: input.manualSurcharges,
    towDate: input.towDate,
    towTime: input.towTime,
    selectedPriceItemId: input.selectedPriceItem?.id ?? null,
  })
}

export type SinglePriceAffectingFields = {
  routeStops?: SaveTowInput['routeStops']
  startFromBase?: boolean
  chargeDeadheadReturn?: boolean
  deadheadKm?: number
  vehicleType?: string
  manualWeight?: string
  priceMode: string
  customerId?: string | null
  discountPercent?: number
  selectedLocationSurcharges?: string[]
  selectedServices?: SelectedService[]
  activeTimeSurchargeIds?: string[]
  timeSurchargesData?: TimeSurcharge[]
  selectedCustomerPricing?: CustomerWithPricing | null
  isHoliday?: boolean
  hasManualTimeSurchargeOverride?: boolean
  manualAdjustmentPercent?: number
  manualSurcharges?: ManualSurcharge[]
  towDate?: string
  towTime?: string
  customPrice?: number
  customPriceIncludesVat?: boolean
  selectedPriceItemId?: string | null
}

function singleRouteStopsSignature(routeStops?: SaveTowInput['routeStops']): string {
  return JSON.stringify(
    (routeStops ?? []).map((stop) => [
      stop.address.address,
      stop.address.lat,
      stop.address.lng,
    ])
  )
}

/** Stable signature of single-tow inputs that affect recommended/custom price calculation. */
export function buildSinglePriceAffectingSignature(fields: SinglePriceAffectingFields): string {
  return JSON.stringify({
    route: singleRouteStopsSignature(fields.routeStops),
    startFromBase: fields.startFromBase ?? false,
    deadhead: fields.chargeDeadheadReturn ? (fields.deadheadKm ?? 0) : 0,
    vehicleType: fields.vehicleType ?? '',
    manualWeight: fields.manualWeight ?? '',
    priceMode: fields.priceMode,
    customerId: fields.customerId ?? '',
    discountPercent: fields.discountPercent ?? 0,
    location: [...(fields.selectedLocationSurcharges ?? [])].sort().join(','),
    services: exchangeServicesSignature(fields.selectedServices),
    manualSvc: manualSurchargesSignature(fields.manualSurcharges),
    timeIds: exchangeTimeSurchargeIds({
      priceMode: fields.priceMode,
      activeTimeSurchargeIds: fields.activeTimeSurchargeIds,
      timeSurchargesData: fields.timeSurchargesData,
      selectedCustomerPricing: fields.selectedCustomerPricing,
      isHoliday: fields.isHoliday,
      hasManualTimeSurchargeOverride: fields.hasManualTimeSurchargeOverride,
      towDate: fields.towDate,
      towTime: fields.towTime,
    }),
    towDate: fields.towDate ?? '',
    towTime: fields.towTime ?? '',
    isHoliday: fields.isHoliday ?? false,
    hasManualTimeSurchargeOverride: fields.hasManualTimeSurchargeOverride ?? false,
    manualAdj: fields.manualAdjustmentPercent ?? 0,
    customPrice: fields.customPrice ?? 0,
    customPriceIncludesVat: fields.customPriceIncludesVat ?? true,
    selectedPriceItemId: fields.selectedPriceItemId ?? '',
  })
}

export function singlePriceSignatureFromSaveInput(input: SaveTowInput): string {
  return buildSinglePriceAffectingSignature({
    routeStops: input.routeStops,
    startFromBase: input.startFromBase,
    chargeDeadheadReturn: input.chargeDeadheadReturn,
    deadheadKm: input.chargeDeadheadReturn ? (input.dropoffToBaseDistance?.distanceKm ?? 0) : 0,
    vehicleType: input.vehicleType,
    manualWeight: input.manualWeight,
    priceMode: input.priceMode,
    customerId: input.customerId,
    discountPercent: input.selectedCustomerPricing?.discount_percent ?? 0,
    selectedLocationSurcharges: input.selectedLocationSurcharges,
    selectedServices: input.selectedServices,
    activeTimeSurchargeIds: (input.activeTimeSurcharges ?? []).map((s) => s.id),
    timeSurchargesData: input.timeSurchargesData,
    selectedCustomerPricing: input.selectedCustomerPricing,
    isHoliday: input.isHoliday,
    hasManualTimeSurchargeOverride: input.hasManualTimeSurchargeOverride,
    manualAdjustmentPercent: input.manualAdjustmentPercent,
    manualSurcharges: input.manualSurcharges,
    towDate: input.towDate,
    towTime: input.towTime,
    customPrice: parseFloat(String(input.customPrice ?? '')) || 0,
    customPriceIncludesVat: input.customPriceIncludesVat ?? true,
    selectedPriceItemId: input.selectedPriceItem?.id ?? null,
  })
}

// ==================== NEW: TowPoint Types ====================

export interface PreparedTowPoint {
  /** Existing DB id when editing; omit for genuinely new points (insert generates id) */
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
  // רכבים בנקודה - מכיל את ה-index של הרכב ב-vehicles array
  vehicleIndices: number[]
  // האם זו נקודה לאחסנה
  dropToStorage?: boolean
  isStorage?: boolean
  stop_subtype?: 'key' | 'customer_pickup' | 'customer_dropoff' | 'other' | null
}

// Output ל-createTow
function businessTowCustomerFields(input: SaveTowInput): {
  department: string | null
  ordered_by: string | null
} {
  if (!input.isBusinessCustomer) {
    return { department: null, ordered_by: null }
  }
  return {
    department: input.department?.trim() || null,
    ordered_by: input.orderedBy?.trim() || null,
  }
}

export interface PreparedTowData {
  companyId: string
  createdBy: string
  customerOrderNumber?: string
  department?: string | null
  ordered_by?: string | null
  customerId?: string
  driverId?: string
  truckId?: string
  secondDriverId?: string
  secondDriverScheduledAt?: string
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
    /** רכב כבד — mishkal_azmi (kg); 0/חסר נשמר כ-undefined */
    curbWeightKg?: number
    gearType?: string
    driveTechnology?: string
    vehicleCode?: string
    registrySource?: string | null
    /** צמ"ה — mishkal_ton (tons) */
    selfWeightTon?: number
    /** צמ"ה — mishkal_kolel_ton (tons) */
    totalWeightTon?: number
    /** צמ"ה — sug_tzama_nm */
    machineryType?: string
    chassis?: string | null
    importType?: string | null
  }[]
  legs: {
    legType: 'empty_drive' | 'pickup' | 'delivery'
    fromAddress?: string
    toAddress?: string
    fromLat?: number
    fromLng?: number
    toLat?: number
    toLng?: number
  }[]
  paymentMethod?: string
  invoiceName?: string
  startFromBase?: boolean
  dropoffToStorage?: boolean
  // Exchange specific
  workingVehiclePlate?: string
  workingVehicleData?: any
  workingVehicleType?: string
  workingVehicleSourceAddress?: AddressData
  workingVehicleDestinationAddress?: AddressData
  workingVehicleContactName?: string
  workingVehicleContactPhone?: string
  defectiveVehiclePlate?: string
  defectiveVehicleData?: any
  exchangePointAddress?: AddressData
  exchangeContactName?: string
  exchangeContactPhone?: string
  workingDestinationContactName?: string
  workingDestinationContactPhone?: string
  defectiveDestinationAddress?: AddressData
  defectiveDestinationContactName?: string
  defectiveDestinationContactPhone?: string
  linkedTowId?: string
  // NEW: נקודות גרירה
  points: PreparedTowPoint[]
}

// ==================== Helper Functions ====================

function mapExistingVehiclesForMatch(
  existing?: SaveTowInput['existingTowVehicles']
) {
  return existing?.map((v) => ({
    id: v.id,
    plateNumber: v.plateNumber,
    orderIndex: v.orderIndex,
  }))
}

function mapExistingPointsForMatch(
  existing?: SaveTowInput['existingTowPoints']
) {
  return existing?.map((p) => ({
    id: p.id,
    point_order: p.pointOrder,
    point_type: p.pointType,
  }))
}

function aggregateRouteServices(services: SelectedService[] | undefined): SelectedService[] {
  if (!services?.length) return []
  const map = new Map<string, SelectedService>()
  for (const s of services) {
    const existing = map.get(s.id)
    if (!existing) {
      map.set(s.id, { ...s })
    } else {
      map.set(s.id, {
        id: s.id,
        quantity: (existing.quantity ?? 1) + (s.quantity ?? 1),
        manualPrice: existing.manualPrice ?? s.manualPrice,
      })
    }
  }
  return Array.from(map.values())
}

/** Values the UI or registry lookup can produce — must match public.vehicle_type enum */
const PERSISTED_VEHICLE_TYPES = [
  'private',
  'motorcycle',
  'heavy',
  'machinery',
  'van',
  'suv',
  'truck',
  'bus',
  'other',
] as const

export type PersistedVehicleType = (typeof PERSISTED_VEHICLE_TYPES)[number]

const REGISTRY_VEHICLE_SOURCES = ['private', 'motorcycle', 'heavy', 'machinery', 'personal_import'] as const

/**
 * Pass through a user-selected or registry-derived vehicle category for DB storage.
 * Does not affect pricing — unknown-to-pricing types are stored as-is for display.
 */
function mapVehicleType(vehicleCode?: string): PersistedVehicleType | undefined {
  if (!vehicleCode) return undefined
  if ((PERSISTED_VEHICLE_TYPES as readonly string[]).includes(vehicleCode)) {
    return vehicleCode as PersistedVehicleType
  }
  return undefined
}

function resolveRouteVehicleRegistrySource(v: VehicleOnTruck): string | null {
  if (v.registrySource) return v.registrySource
  if (v.isFound && v.vehicleData && v.vehicleType) {
    if ((REGISTRY_VEHICLE_SOURCES as readonly string[]).includes(v.vehicleType)) {
      return v.vehicleType
    }
  }
  return null
}

function parseOptionalTon(value: string | number | undefined): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Persist machinery ton fields only when source is machinery or ton data is present. */
function machineryPersistFields(args: {
  registrySource?: string | null
  machineryType?: string | null
  selfWeightTon?: number | null
  totalWeightTon?: number | null
}): Pick<
  PreparedTowData['vehicles'][number],
  'selfWeightTon' | 'totalWeightTon' | 'machineryType'
> {
  const { registrySource, machineryType, selfWeightTon, totalWeightTon } = args
  const isMachinery =
    registrySource === 'machinery' ||
    machineryType != null ||
    selfWeightTon != null ||
    totalWeightTon != null
  if (!isMachinery) return {}
  return {
    ...(selfWeightTon != null ? { selfWeightTon } : {}),
    ...(totalWeightTon != null ? { totalWeightTon } : {}),
    ...(machineryType ? { machineryType } : {}),
  }
}

function machineryFromLookupResult(
  registrySource: string | null | undefined,
  data: VehicleLookupResult['data'] | null | undefined
) {
  return machineryPersistFields({
    registrySource,
    machineryType: data?.machineryType,
    selfWeightTon: data?.selfWeight ?? null,
    totalWeightTon: data?.totalWeightTon ?? null,
  })
}

function machineryFromRouteVehicleData(
  registrySource: string | null | undefined,
  vehicleData: VehicleOnTruck['vehicleData']
) {
  return machineryPersistFields({
    registrySource,
    machineryType: vehicleData?.machineryType,
    selfWeightTon: parseOptionalTon(vehicleData?.selfWeight) ?? null,
    totalWeightTon: parseOptionalTon(vehicleData?.totalWeightTon) ?? null,
  })
}

/**
 * Persist curb weight (משקל עצמי) only for HEAVY vehicles, in kg.
 * 0 / missing / non-positive is treated as "not available" and not stored.
 */
function curbWeightPersist(
  registrySource: string | null | undefined,
  curbWeightKg: number | null | undefined
): { curbWeightKg?: number } {
  if (registrySource !== 'heavy') return {}
  if (curbWeightKg == null || !Number.isFinite(curbWeightKg) || curbWeightKg <= 0) return {}
  return { curbWeightKg }
}

/**
 * המרת נקודות מסלול (RoutePoints) לרגליים (Legs)
 * כל שתי נקודות עוקבות הופכות לרגל אחת
 */
export function convertRoutePointsToLegs(routePoints: RoutePoint[]): PreparedTowData['legs'] {
  const legs: PreparedTowData['legs'] = []
  
  for (let i = 0; i < routePoints.length - 1; i++) {
    const from = routePoints[i]
    const to = routePoints[i + 1]
    
    // קביעת סוג הרגל
    let legType: 'empty_drive' | 'pickup' | 'delivery' = 'pickup'
    
    if (from.type === 'base' && to.vehiclesToPickup.length > 0) {
      legType = 'empty_drive' // נסיעה ריקה מהבסיס לאיסוף
    } else if (to.vehiclesToDropoff.length > 0 || to.dropToStorage) {
      legType = 'delivery'
    } else if (to.vehiclesToPickup.length > 0) {
      legType = 'pickup'
    }
    
    legs.push({
      legType,
      fromAddress: from.address,
      toAddress: to.address,
      fromLat: from.addressData?.lat,
      fromLng: from.addressData?.lng,
      toLat: to.addressData?.lat,
      toLng: to.addressData?.lng
    })
  }
  
  return legs
}

/**
 * איסוף כל הרכבים מכל נקודות המסלול
 */
export function collectVehiclesFromRoutePoints(routePoints: RoutePoint[]): PreparedTowData['vehicles'] {
  const vehiclesMap = new Map<string, VehicleOnTruck>()
  
  // עוברים על כל הנקודות ואוספים רכבים ייחודיים
  for (const point of routePoints) {
    for (const vehicle of point.vehiclesToPickup) {
      if (!vehiclesMap.has(vehicle.id)) {
        vehiclesMap.set(vehicle.id, vehicle)
      }
    }
  }
  
  // המרה לפורמט של createTow
  return Array.from(vehiclesMap.values()).map((v) => ({
    id: v.id,
    plateNumber: normalizePlate(v.plateNumber),
    manufacturer: v.vehicleData?.manufacturer || v.manualManufacturer || undefined,
    model: v.vehicleData?.model,
    year: v.vehicleData?.year ? Number(v.vehicleData.year) : undefined,
    vehicleType: mapVehicleType(v.vehicleType),
    vehicleCode: v.vehicleCode || undefined,
    color: v.vehicleData?.color || v.manualColor || undefined,
    isWorking: v.isWorking,
    towReason: v.isWorking
      ? undefined
      : serializeDefects(v.defects?.filter(Boolean) ?? []) || 'לא נוסע',
    registrySource: resolveRouteVehicleRegistrySource(v),
    driveType: v.vehicleData?.driveType,
    fuelType: v.vehicleData?.fuelType,
    totalWeight: v.vehicleData?.totalWeight
      ? Number(v.vehicleData.totalWeight)
      : v.manualWeight
        ? Number(v.manualWeight)
        : undefined,
    gearType: v.vehicleData?.gearType,
    chassis: v.vehicleData?.chassis || undefined,
    importType: v.vehicleData?.importType || undefined,
    ...machineryFromRouteVehicleData(resolveRouteVehicleRegistrySource(v), v.vehicleData),
    ...curbWeightPersist(
      resolveRouteVehicleRegistrySource(v),
      v.vehicleData?.curbWeightKg != null ? Number(v.vehicleData.curbWeightKg) : null
    ),
  }))
}

/**
 * NEW: המרת נקודות מסלול (RoutePoints) לנקודות גרירה (TowPoints)
 */
export function convertRoutePointsToTowPoints(
  routePoints: RoutePoint[], 
  allVehicles: PreparedTowData['vehicles']
): PreparedTowPoint[] {
  const points: PreparedTowPoint[] = []
  let pointOrder = 0
  
  // יצירת מפה של plateNumber -> index
  const vehicleIndexMap = new Map<string, number>()
  allVehicles.forEach((v, idx) => {
    vehicleIndexMap.set(v.plateNumber, idx)
  })
  
  // יצירת מפה של vehicle.id -> plateNumber (מ-RoutePoint)
  const vehicleIdToPlate = new Map<string, string>()
  for (const point of routePoints) {
    for (const v of point.vehiclesToPickup) {
      vehicleIdToPlate.set(v.id, v.plateNumber)
    }
  }
  
  for (const rp of routePoints) {
    // דילוג על נקודות בסיס בלבד (בלי רכבים)
    if (rp.type === 'base' && rp.vehiclesToPickup.length === 0 && rp.vehiclesToDropoff.length === 0) {
      continue
    }

    if (rp.isStopOnly) {
      points.push({
        id: rp.id,
        point_order: pointOrder++,
        point_type: 'stop',
        address: rp.address || null,
        lat: rp.addressData?.lat || null,
        lng: rp.addressData?.lng || null,
        contact_name: rp.contactName || null,
        contact_phone: rp.contactPhone || null,
        notes: rp.notes || null,
        vehicleIndices: [],
      })
      continue
    }
    
    // קביעת סוג הנקודה
    const hasPickup = rp.vehiclesToPickup.length > 0
    const hasDropoff = rp.vehiclesToDropoff.length > 0 || rp.dropToStorage
    
    // אם יש גם איסוף וגם פריקה באותה נקודה - יוצרים 2 נקודות
    if (hasPickup && hasDropoff) {
      // נקודת פריקה קודם (אם מורידים לפני שמעלים)
      const dropoffVehicleIndices = rp.vehiclesToDropoff
        .map(vId => {
          const plate = vehicleIdToPlate.get(vId)
          return plate ? vehicleIndexMap.get(plate) : undefined
        })
        .filter((idx): idx is number => idx !== undefined)
      
      if (dropoffVehicleIndices.length > 0) {
        points.push({
          point_order: pointOrder++,
          point_type: 'dropoff',
          address: rp.address || null,
          lat: rp.addressData?.lat || null,
          lng: rp.addressData?.lng || null,
          contact_name: rp.contactName || null,
          contact_phone: rp.contactPhone || null,
          notes: rp.notes || null,
          vehicleIndices: dropoffVehicleIndices,
          dropToStorage: rp.dropToStorage,
          isStorage: rp.dropToStorage === true,
        })
      }
      
      // נקודת איסוף
      const pickupVehicleIndices = rp.vehiclesToPickup
        .map(v => vehicleIndexMap.get(v.plateNumber))
        .filter((idx): idx is number => idx !== undefined)
      
      points.push({
        point_order: pointOrder++,
        point_type: 'pickup',
        address: rp.address || null,
        lat: rp.addressData?.lat || null,
        lng: rp.addressData?.lng || null,
        contact_name: rp.contactName || null,
        contact_phone: rp.contactPhone || null,
        notes: rp.notes || null,
        vehicleIndices: pickupVehicleIndices,
        isStorage:
          rp.type === 'storage' ||
          rp.vehiclesToPickup.some((v) => v.fromStorage === true),
      })
    }
    // רק איסוף
    else if (hasPickup) {
      const vehicleIndices = rp.vehiclesToPickup
        .map(v => vehicleIndexMap.get(v.plateNumber))
        .filter((idx): idx is number => idx !== undefined)
      
      points.push({
        id: rp.id,
        point_order: pointOrder++,
        point_type: 'pickup',
        address: rp.address || null,
        lat: rp.addressData?.lat || null,
        lng: rp.addressData?.lng || null,
        contact_name: rp.contactName || null,
        contact_phone: rp.contactPhone || null,
        notes: rp.notes || null,
        vehicleIndices,
        isStorage:
          rp.type === 'storage' ||
          rp.vehiclesToPickup.some((v) => v.fromStorage === true),
      })
    }
    // רק פריקה
    else if (hasDropoff) {
      const vehicleIndices = rp.vehiclesToDropoff
        .map(vId => {
          const plate = vehicleIdToPlate.get(vId)
          return plate ? vehicleIndexMap.get(plate) : undefined
        })
        .filter((idx): idx is number => idx !== undefined)
      
      points.push({
        id: rp.id,
        point_order: pointOrder++,
        point_type: 'dropoff',
        address: rp.address || null,
        lat: rp.addressData?.lat || null,
        lng: rp.addressData?.lng || null,
        contact_name: rp.contactName || null,
        contact_phone: rp.contactPhone || null,
        notes: rp.notes || null,
        vehicleIndices,
        dropToStorage: rp.dropToStorage,
        isStorage: rp.dropToStorage === true,
      })
    }
  }
  
  return points
}

/**
 * NEW: יצירת נקודות גרירה לגרירה פשוטה (single)
 */
function findPrimaryPickupDropoffForLegs(routeStops: NonNullable<SaveTowInput['routeStops']>) {
  const pickup = routeStops.find((s) => s.role === 'pickup')
  let dropoff: (typeof routeStops)[number] | undefined
  for (let i = routeStops.length - 1; i >= 0; i--) {
    if (routeStops[i].role === 'dropoff') {
      dropoff = routeStops[i]
      break
    }
  }
  return { pickup, dropoff }
}

export function createSingleTowPoints(input: SaveTowInput): PreparedTowPoint[] {
  const normalizeStopSubtype = (subtype: unknown): PreparedTowPoint['stop_subtype'] => {
    if (subtype === 'customer') return 'customer_pickup'
    if (subtype === 'general') return 'other'
    if (
      subtype === 'key' ||
      subtype === 'customer_pickup' ||
      subtype === 'customer_dropoff' ||
      subtype === 'other'
    ) {
      return subtype
    }
    return 'other'
  }

  const points: PreparedTowPoint[] = []
  let pointOrder = 0
  const rows = input.routeStops ?? []
  let seenPickup = false

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row.address?.address?.trim()) continue

    const isPickup = row.role === 'pickup'
    const isDropoff = row.role === 'dropoff'
    const isFirstPickup = isPickup && !seenPickup
    if (isPickup) seenPickup = true

    let dropoffIsLast = false
    if (isDropoff) {
      dropoffIsLast = true
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[j].role === 'dropoff' && rows[j].address?.address?.trim()) {
          dropoffIsLast = false
          break
        }
      }
    }

    const point: PreparedTowPoint = {
      id: row.id,
      point_order: pointOrder++,
      point_type: row.role,
      stop_subtype: row.role === 'stop' ? normalizeStopSubtype(row.stopSubtype) : null,
      address: row.address.address,
      lat: row.address.lat ?? null,
      lng: row.address.lng ?? null,
      contact_name: row.contactName?.trim() || null,
      contact_phone: row.contactPhone?.trim() || null,
      notes: row.notes?.trim() || null,
      order_notes: row.orderNotes?.trim() || null,
      vehicleIndices: isPickup || isDropoff ? [0] : [],
      isStorage: isFirstPickup
        ? !!input.selectedStoredVehicleId
        : isDropoff && dropoffIsLast
          ? input.dropoffToStorage === true
          : undefined,
    }
    points.push(point)
  }

  return assignExistingPointIds(
    points,
    mapExistingPointsForMatch(input.existingTowPoints)
  )
}

function buildExchangeServiceSurchargesBreakdown(
  workingServices: SelectedService[],
  defectiveServices: SelectedService[],
  serviceSurchargesData: ServiceSurcharge[] | undefined
): PriceBreakdown['service_surcharges'] {
  const data = serviceSurchargesData ?? []
  const build = (services: SelectedService[], role: 'working' | 'defective') =>
    services
      .map((selected) => {
        const s = data.find((x) => x.id === selected.id)
        if (!s) return null
        let amount = 0
        let units: number | undefined
        if (s.price_type === 'manual') {
          amount = selected.manualPrice || 0
        } else if (s.price_type === 'per_unit') {
          units = selected.quantity || 1
          amount = s.price * units
        } else {
          amount = s.price
        }
        if (amount <= 0) return null
        return {
          id: s.id,
          label: s.label,
          price: s.price,
          units,
          amount,
          vehicle_role: role,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

  return [...build(workingServices, 'working'), ...build(defectiveServices, 'defective')]
}

function buildCatalogServiceCalcInput(
  selected: SelectedService[],
  serviceSurchargesData: ServiceSurcharge[] | undefined,
): { amount: number; label?: string; vatExempt?: boolean }[] {
  return selected
    .map((sel) => {
      const s = serviceSurchargesData?.find((x) => x.id === sel.id)
      if (!s) return { amount: 0 }
      const vatExempt = s.is_vat_exempt === true
      if (s.price_type === 'manual') {
        return {
          amount: sel.manualPrice || 0,
          label: s.label,
          ...(vatExempt ? { vatExempt: true as const } : {}),
        }
      }
      if (s.price_type === 'per_unit') {
        const qty = sel.quantity || 1
        return {
          amount: s.price * qty,
          label: `${s.label} (×${qty})`,
          ...(vatExempt ? { vatExempt: true as const } : {}),
        }
      }
      return {
        amount: s.price,
        label: s.label,
        ...(vatExempt ? { vatExempt: true as const } : {}),
      }
    })
    .filter((x) => x.amount > 0)
}

/** Catalog (service_surcharges table) selections as stored breakdown lines — no manual lines. */
function buildCatalogServiceBreakdown(
  selected: SelectedService[] | undefined,
  serviceSurchargesData: ServiceSurcharge[] | undefined,
): {
  id: string
  label: string
  price: number
  units?: number
  amount: number
  is_vat_exempt?: true
}[] {
  return (selected || [])
    .map((sel) => {
      const surcharge = serviceSurchargesData?.find((s) => s.id === sel.id)
      if (!surcharge) return null
      let amount = 0
      let units: number | undefined = undefined
      if (surcharge.price_type === 'manual') {
        amount = sel.manualPrice || 0
      } else if (surcharge.price_type === 'per_unit') {
        units = sel.quantity || 1
        amount = surcharge.price * units
      } else {
        amount = surcharge.price
      }
      return {
        id: surcharge.id,
        label: surcharge.label,
        price: surcharge.price,
        units,
        amount,
        ...(surcharge.is_vat_exempt ? { is_vat_exempt: true as const } : {}),
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null && s.amount > 0)
}

/** Whole-tow catalog selections as stored breakdown lines, flagged is_tow_level. */
function buildTowLevelServiceBreakdown(
  selected: SelectedService[] | undefined,
  serviceSurchargesData: ServiceSurcharge[] | undefined,
): PriceBreakdown['service_surcharges'] {
  return buildCatalogServiceBreakdown(selected, serviceSurchargesData).map((s) => ({
    ...s,
    is_tow_level: true as const,
  }))
}

function buildServiceSurchargesBreakdown(input: SaveTowInput): {
  taxable: PriceBreakdown['service_surcharges']
  exempt: NonNullable<PriceBreakdown['vat_exempt_surcharges']>
} {
  const all = [
    ...buildCatalogServiceBreakdown(input.selectedServices, input.serviceSurchargesData),
    ...buildTowLevelServiceBreakdown(input.towServiceSurcharges, input.serviceSurchargesData),
    ...manualSurchargesToBreakdown(input.manualSurcharges),
  ]
  const taxable: PriceBreakdown['service_surcharges'] = []
  const exempt: NonNullable<PriceBreakdown['vat_exempt_surcharges']> = []
  for (const line of all) {
    if (line.is_vat_exempt) {
      exempt.push({
        id: line.id,
        label: line.label,
        price: line.price,
        amount: line.amount,
        ...('units' in line && line.units != null ? { units: line.units } : {}),
        ...('is_ad_hoc' in line && line.is_ad_hoc ? { is_ad_hoc: true as const } : {}),
        ...('is_tow_level' in line && line.is_tow_level ? { is_tow_level: true as const } : {}),
      })
    } else {
      taxable.push(line)
    }
  }
  return { taxable, exempt }
}

  function buildLocationSurchargesBreakdown(
    input: SaveTowInput,
    locationLines: { id?: string; label: string; percent: number; amount: number }[]
  ): PriceBreakdown['location_surcharges'] {
    return locationLines.map((line) => {
      const fromInput = (input.selectedLocationSurcharges || [])
        .map((id) => input.locationSurchargesData?.find((l) => l.id === id))
        .find((s) => s && (s.id === line.id || s.surcharge_percent === line.percent))
      return {
        id: line.id || fromInput?.id || '',
        label: line.label || fromInput?.label || `תוספת מיקום (${line.percent}%)`,
        percent: line.percent,
        amount: round2(line.amount),
      }
    })
  }

/**
 * בניית פירוט מחיר לגרירה רגילה (single)
 * Thin wrapper: calls calculateTowPrice and formats for DB storage.
 */
export function buildSingleTowPriceBreakdown(input: SaveTowInput): PriceBreakdown {
  const activePriceList =
    input.priceMode === 'recommended_customer'
      ? mergePriceLists(input.basePriceList, input.selectedCustomerPricing?.price_list ?? null)
      : input.basePriceList

  const pickupToDropoffKm = input.distance?.distanceKm || 0
  const baseToPickupKm = (input.startFromBase && input.baseToPickupDistance?.distanceKm) || 0
  const distanceKm = pickupToDropoffKm + baseToPickupKm

  // Deadhead (נסיעת סרק): last dropoff → base, priced separately. Custom handled elsewhere (TODO).
  const deadheadKm = (input.chargeDeadheadReturn && input.dropoffToBaseDistance?.distanceKm) || 0
  const deadheadRate = resolveDeadheadRate(activePriceList)

  const locationSurcharges = (input.selectedLocationSurcharges || [])
    .map(id => input.locationSurchargesData?.find(l => l.id === id))
    .filter(Boolean)
    .map(s => ({
      percent: s!.surcharge_percent,
      label: s!.label,
      id: s!.id,
    }))

  const serviceSurcharges = [
    ...buildCatalogServiceCalcInput(input.selectedServices || [], input.serviceSurchargesData),
    ...buildCatalogServiceCalcInput(input.towServiceSurcharges || [], input.serviceSurchargesData),
    ...manualSurchargesToCalcInput(input.manualSurcharges),
  ]

  const flat = extractBasePrices(activePriceList)
  const brackets = input.weightBrackets ?? []
  const parseW = (m?: string) => { const n = m ? Number(m) : NaN; return Number.isFinite(n) && n > 0 ? n : null }
  let basePriceOverride: number | undefined
  if (input.towType === 'exchange' && input.workingVehicleType && input.defectiveVehicleType) {
    basePriceOverride =
      resolveVehicleBasePrice(input.workingVehicleType as string, parseW(input.workingManualWeight), brackets, flat) +
      resolveVehicleBasePrice(input.defectiveVehicleType as string, parseW(input.defectiveManualWeight), brackets, flat)
  } else if ((input.vehicleType as string) === 'van') {
    const w = parseW(input.manualWeight)
    if (w) basePriceOverride = resolveVehicleBasePrice('van', w, brackets, flat)
  }

  const timeSurchargesForCalc = timeSurchargesForPriceCalc(input)

  const kmRateVehicleType: VehicleType =
    input.towType === 'exchange' && input.defectiveVehicleType
      ? (input.defectiveVehicleType as VehicleType)
      : ((input.vehicleType as VehicleType) || 'private')

  const result = calculateTowPrice({
    priceList: priceListForTowCalc(activePriceList),
    vehicleType: kmRateVehicleType,
    distanceKm,
    deadheadKm,
    deadheadRate,
    ...(basePriceOverride !== undefined ? { basePriceOverride } : {}),
    timeSurcharges: timeSurchargesForCalc,
    towDate: input.towDate || '',
    towTime: input.towTime || '',
    isHoliday: input.isHoliday ?? false,
    activeTimeSurchargeIds: (input.activeTimeSurcharges || []).map(s => s.id),
    hasManualTimeSurchargeOverride: input.hasManualTimeSurchargeOverride,
    locationSurcharges,
    serviceSurcharges,
    priceMode: 'recommended',
    discountPercent: input.selectedCustomerPricing?.discount_percent ?? 0,
    manualAdjustmentPercent: input.manualAdjustmentPercent ?? 0,
    vatPercent: input.vatPercent ?? 0.18,
  })

  const timeSurchargesBreakdown = (input.activeTimeSurcharges || []).length > 0 && result.maxTimeSurchargePercent > 0
    ? (() => {
        const maxS = (input.activeTimeSurcharges || []).find(s => s.surcharge_percent === result.maxTimeSurchargePercent)
          || (input.activeTimeSurcharges || [])[0]
        return [{
          id: maxS?.id ?? '',
          label: result.maxTimeSurchargeLabel || (maxS?.label ?? ''),
          percent: result.maxTimeSurchargePercent,
          amount: round2(result.timeSurchargeAmount)
        }]
      })()
    : []

  const locationSurchargesBreakdown = buildLocationSurchargesBreakdown(
    input,
    result.locationSurchargeLines,
  )

  const { taxable: serviceSurchargesBreakdown, exempt: vatExemptBreakdown } =
    buildServiceSurchargesBreakdown(input)

  return {
    base_price: round2(result.basePrice),
    vehicle_type: input.vehicleType || '',
    distance_km: roundKm1(distanceKm),
    distance_price: round2(result.distancePrice),
    deadhead_km: roundKm1(result.deadheadKm),
    deadhead_price: round2(result.deadheadPrice),
    time_surcharges: timeSurchargesBreakdown.map((s) => ({ ...s, amount: round2(s.amount) })),
    location_surcharges: locationSurchargesBreakdown.map((s) => ({ ...s, amount: round2(s.amount) })),
    service_surcharges: serviceSurchargesBreakdown.map((s) => ({ ...s, amount: round2(s.amount) })),
    vat_exempt_surcharges: vatExemptBreakdown.map((s) => ({ ...s, amount: round2(s.amount) })),
    subtotal: round2(result.beforeVat),
    discount_percent: input.selectedCustomerPricing?.discount_percent ?? 0,
    discount_amount: round2(result.discountAmount),
    ...manualAdjustmentBreakdownFields(input),
    ...selectedPriceItemBreakdownFields(input),
    vat_amount: round2(result.vatAmount),
    total: round2(result.total),
  }
}

/** Single-tow save: always rebuild from live distance/surcharges; keep manual total when priceMode is custom. */
export function buildSingleTowPriceBreakdownForSave(input: SaveTowInput): PriceBreakdown | null {
  const fresh = buildSingleTowPriceBreakdown(input)
  if (input.priceMode === 'custom') {
    const manual = Number(input.finalPrice)
    const rawCustom = parseFloat(String(input.customPrice ?? ''))
    if (Number.isFinite(manual) && manual >= 0) {
      return {
        ...fresh,
        total: round2(manual),
        custom_price_includes_vat: input.customPriceIncludesVat ?? true,
        custom_price_amount: Number.isFinite(rawCustom) ? round2(rawCustom) : null,
        selected_price_item_id: null,
        selected_price_item_source: null,
      }
    }
  }
  return fresh
}

/**
 * בניית פירוט מחיר לגרירה מותאמת (custom)
 * Uses the same calculateTowPrice path as single tow: multi-vehicle base sum, route distance,
 * time/location/service surcharges, VAT from input.vatPercent, services from customRouteData.services.
 */
export function buildCustomTowPriceBreakdown(
  input: SaveTowInput,
  routePoints: RoutePoint[]
): PriceBreakdown & { vehicle_count: number; route_points: RoutePoint[] } {
  const activePriceList =
    input.priceMode === 'recommended_customer'
      ? mergePriceLists(input.basePriceList, input.selectedCustomerPricing?.price_list ?? null)
      : input.basePriceList

  const vehicles = input.customRouteData?.vehicles || []
  const totalDistanceKm = input.customRouteData?.totalDistanceKm ?? 0
  const basePrices = extractBasePrices(activePriceList)

  let totalBasePrice = 0
  vehicles.forEach((v) => {
    const vt = (v.type as VehicleType) || 'private'
    totalBasePrice += basePrices[vt] ?? basePrices.private
  })

  const routeServices = aggregateRouteServices(input.customRouteData?.services)

  const locationSurcharges = (input.selectedLocationSurcharges || [])
    .map((id) => input.locationSurchargesData?.find((l) => l.id === id))
    .filter(Boolean)
    .map((s) => ({
      percent: s!.surcharge_percent,
      label: s!.label,
      id: s!.id,
    }))

  const serviceSurcharges = [
    ...buildCatalogServiceCalcInput(routeServices, input.serviceSurchargesData),
    ...buildCatalogServiceCalcInput(input.towServiceSurcharges || [], input.serviceSurchargesData),
    ...manualSurchargesToCalcInput(input.manualSurcharges),
  ]

  const timeSurchargesForCalc = timeSurchargesForPriceCalc(input)

  // Custom multi-vehicle routes use global price_per_km only (per-type km does not apply).
  const result = calculateTowPrice({
    priceList: priceListForTowCalc(activePriceList, { globalKmOnly: true }),
    vehicleType: 'private',
    distanceKm: totalDistanceKm,
    basePriceOverride: totalBasePrice,
    timeSurcharges: timeSurchargesForCalc,
    towDate: input.towDate || '',
    towTime: input.towTime || '',
    isHoliday: input.isHoliday ?? false,
    activeTimeSurchargeIds: (input.activeTimeSurcharges || []).map((s) => s.id),
    hasManualTimeSurchargeOverride: input.hasManualTimeSurchargeOverride,
    locationSurcharges,
    serviceSurcharges,
    priceMode: 'recommended',
    discountPercent: input.selectedCustomerPricing?.discount_percent ?? 0,
    manualAdjustmentPercent: input.manualAdjustmentPercent ?? 0,
    vatPercent: input.vatPercent ?? 0.18,
  })

  const timeSurchargesBreakdown =
    (input.activeTimeSurcharges || []).length > 0 && result.maxTimeSurchargePercent > 0
      ? (() => {
          const maxS =
            (input.activeTimeSurcharges || []).find(
              (s) => s.surcharge_percent === result.maxTimeSurchargePercent
            ) || (input.activeTimeSurcharges || [])[0]
          return [
            {
              id: maxS?.id ?? '',
              label: result.maxTimeSurchargeLabel || maxS?.label || '',
              percent: result.maxTimeSurchargePercent,
              amount: round2(result.timeSurchargeAmount),
            },
          ]
        })()
      : []

  const locationSurchargesBreakdown = buildLocationSurchargesBreakdown(
    input,
    result.locationSurchargeLines,
  )

  const { taxable: serviceSurchargesBreakdown, exempt: vatExemptBreakdown } =
    buildServiceSurchargesBreakdown({
      ...input,
      selectedServices: routeServices,
    })

  return {
    base_price: round2(result.basePrice),
    vehicle_type: 'mixed',
    vehicle_count: vehicles.length,
    distance_km: roundKm1(totalDistanceKm),
    distance_price: round2(result.distancePrice),
    time_surcharges: timeSurchargesBreakdown.map((s) => ({ ...s, amount: round2(s.amount) })),
    location_surcharges: locationSurchargesBreakdown.map((s) => ({ ...s, amount: round2(s.amount) })),
    service_surcharges: serviceSurchargesBreakdown.map((s) => ({ ...s, amount: round2(s.amount) })),
    vat_exempt_surcharges: vatExemptBreakdown.map((s) => ({ ...s, amount: round2(s.amount) })),
    subtotal: round2(result.beforeVat),
    discount_percent: input.selectedCustomerPricing?.discount_percent ?? 0,
    discount_amount: round2(result.discountAmount),
    ...manualAdjustmentBreakdownFields(input),
    ...selectedPriceItemBreakdownFields(input),
    vat_amount: round2(result.vatAmount),
    total: round2(result.total),
    route_points: routePoints,
  }
}

export const CUSTOM_TOW_EDIT_WIPE_BLOCKED_MESSAGE =
  'השמירה נחסמה כדי למנוע אובדן נתונים. עריכת גרירה מותאמת אישית עדיין בתהליך תיקון.'

/** Edit-only: block save when hydrated route was wiped to [] but DB still has points. */
export function isCustomTowEditWipeBlocked(params: {
  editTowId?: string
  towType: string
  existingPointCount: number
  routePointCount: number
}): boolean {
  return (
    !!params.editTowId &&
    params.towType === 'custom' &&
    params.existingPointCount > 0 &&
    params.routePointCount === 0
  )
}

// ==================== Main Function ====================

/**
 * הפונקציה הראשית - מכינה את כל הנתונים לשמירה
 */
export function prepareTowData(input: SaveTowInput): PreparedTowData {
  const scheduledAt = input.towDate && input.towTime 
    ? new Date(`${input.towDate}T${input.towTime}:00`).toISOString() 
    : new Date().toISOString()
  const scheduledEndAt =
    input.towEndDate && input.towEndTime
      ? new Date(`${input.towEndDate}T${input.towEndTime}:00`).toISOString()
      : null
  const businessFields = businessTowCustomerFields(input)

  // גרירה רגילה
  if (input.towType === 'single') {
    const singlePriceInputsUnchanged =
      input.singleEditPriceBaselineSignature != null &&
      singlePriceSignatureFromSaveInput(input) === input.singleEditPriceBaselineSignature &&
      input.existingPriceBreakdown != null

    let priceBreakdown: PriceBreakdown | null
    let resolvedSingleFinalPrice: number | undefined

    if (singlePriceInputsUnchanged) {
      priceBreakdown = structuredClone(input.existingPriceBreakdown!)
      resolvedSingleFinalPrice =
        input.singleEditOriginalFinalPrice ??
        input.existingPriceBreakdown!.total ??
        input.finalPrice
    } else if (input.priceMode === 'custom') {
      priceBreakdown = buildSingleTowPriceBreakdownForSave(input)
      resolvedSingleFinalPrice = input.finalPrice
    } else {
      priceBreakdown = buildSingleTowPriceBreakdownForSave(input)
      resolvedSingleFinalPrice = input.finalPrice
    }
    
    const vehicles: PreparedTowData['vehicles'] = assignExistingVehicleIds(
      [{
      plateNumber: normalizePlate(input.vehiclePlate || ''),
      vehicleType: mapVehicleType(input.vehicleType || ''),
      manufacturer: input.vehicleData?.data?.manufacturer || input.manualManufacturer,
      model: input.vehicleData?.data?.model,
      year: input.vehicleData?.data?.year,
      color: input.vehicleData?.data?.color || input.manualColor,
      isWorking: !(input.selectedDefects?.length),
      towReason: input.selectedDefects?.length
        ? serializeDefects(input.selectedDefects)
        : undefined,
      driveType: input.vehicleData?.data?.driveType,
      fuelType: input.vehicleData?.data?.fuelType,
      totalWeight: input.vehicleData?.data?.totalWeight || (input.manualWeight ? Number(input.manualWeight) : undefined),
      gearType: input.vehicleData?.data?.gearType,
      driveTechnology: input.vehicleData?.data?.driveTechnology,
      vehicleCode: input.vehicleCode || undefined,
      registrySource: input.vehicleData?.source ?? null,
      chassis:
        input.vehicleData?.data?.chassis?.trim() ||
        input.manualChassis?.trim() ||
        undefined,
      importType: input.vehicleData?.data?.importType || undefined,
      ...machineryFromLookupResult(
        input.vehicleData?.source,
        input.vehicleData?.data
      ),
      ...curbWeightPersist(input.vehicleData?.source, input.vehicleData?.data?.curbWeightKg),
    }],
      mapExistingVehiclesForMatch(input.existingTowVehicles)
    )

    const { pickup: legPickup, dropoff: legDropoff } = findPrimaryPickupDropoffForLegs(
      input.routeStops ?? []
    )
    const legs: PreparedTowData['legs'] = [{
      legType: 'pickup',
      fromAddress: legPickup?.address?.address,
      toAddress: legDropoff?.address?.address,
      fromLat: legPickup?.address?.lat,
      fromLng: legPickup?.address?.lng,
      toLat: legDropoff?.address?.lat,
      toLng: legDropoff?.address?.lng
    }]

    // NEW: יצירת נקודות גרירה
    const points = createSingleTowPoints(input)

    return {
      companyId: input.companyId,
      createdBy: input.userId,
      customerOrderNumber: input.customerOrderNumber,
      ...businessFields,
      customerId: input.customerId || undefined,
      driverId: input.preSelectedDriverId || undefined,
      truckId: input.preSelectedTruckId || undefined,
      towType: 'simple',
      requiredTruckTypes: input.requiredTruckTypes || [],
      scheduledAt,
      scheduledEndAt,
      notes: input.notes || undefined,
      finalPrice: clampNonNegativePrice(
        resolvedSingleFinalPrice ?? (input.finalPrice || undefined)
      ),
      priceMode: input.priceMode,
      priceBreakdown,
      vehicles,
      legs,
      points,
      paymentMethod: input.paymentMethod || undefined,
      invoiceName: input.invoiceName || undefined,
      startFromBase: input.startFromBase || false,
      dropoffToStorage: input.dropoffToStorage || false
    }
  }

  // גרירה מותאמת
  if (input.towType === 'custom' && input.routePoints) {
    const priceBreakdown = input.priceMode === 'custom'
      ? (input.existingPriceBreakdown
          ? {
              ...input.existingPriceBreakdown,
              ...(() => {
                const built = buildServiceSurchargesBreakdown({
                  ...input,
                  selectedServices: aggregateRouteServices(input.customRouteData?.services),
                })
                return {
                  service_surcharges: built.taxable,
                  vat_exempt_surcharges: built.exempt,
                }
              })(),
            }
          : null)
      : buildCustomTowPriceBreakdown(input, input.routePoints)
    const vehicles = assignExistingVehicleIds(
      collectVehiclesFromRoutePoints(input.routePoints),
      mapExistingVehiclesForMatch(input.existingTowVehicles)
    )
    const legs = convertRoutePointsToLegs(input.routePoints)
    
    // NEW: יצירת נקודות גרירה
    const points = assignExistingPointIds(
      convertRoutePointsToTowPoints(input.routePoints, vehicles),
      mapExistingPointsForMatch(input.existingTowPoints)
    )

    return {
      companyId: input.companyId,
      createdBy: input.userId,
      customerOrderNumber: input.customerOrderNumber,
      ...businessFields,
      customerId: input.customerId || undefined,
      driverId: input.preSelectedDriverId || undefined,
      truckId: input.preSelectedTruckId || undefined,
      towType: 'multi_vehicle',
      requiredTruckTypes: input.requiredTruckTypes || [],
      scheduledAt,
      scheduledEndAt,
      notes: input.notes || undefined,
      finalPrice: clampNonNegativePrice(input.finalPrice || undefined),
      priceMode: input.priceMode,
      priceBreakdown,
      vehicles,
      legs,
      points,
      paymentMethod: input.paymentMethod || undefined,
      invoiceName: input.invoiceName || undefined,
      startFromBase: input.startFromBase || false,
      dropoffToStorage: input.dropoffToStorage || false
    }
  }

  // גרירת החלפה (exchange)
  if (input.towType === 'exchange') {
  const exchangePriceInputsUnchanged =
    input.exchangeEditPriceBaselineSignature != null &&
    exchangePriceSignatureFromSaveInput(input) === input.exchangeEditPriceBaselineSignature &&
    input.existingPriceBreakdown != null

  let priceBreakdown: PriceBreakdown | null
  let resolvedExchangeFinalPrice: number | undefined

  if (exchangePriceInputsUnchanged) {
    priceBreakdown = structuredClone(input.existingPriceBreakdown!)
    resolvedExchangeFinalPrice =
      input.exchangeEditOriginalFinalPrice ??
      input.existingPriceBreakdown!.total ??
      input.finalPrice
  } else if (input.priceMode === 'custom') {
    priceBreakdown = input.existingPriceBreakdown ?? null
    resolvedExchangeFinalPrice = input.finalPrice
  } else {
    priceBreakdown = buildSingleTowPriceBreakdown(input)
    resolvedExchangeFinalPrice = input.finalPrice
  }

  const useExchangeServiceRoles =
    input.workingSelectedServices !== undefined || input.defectiveSelectedServices !== undefined
  if (priceBreakdown && useExchangeServiceRoles && !exchangePriceInputsUnchanged) {
    priceBreakdown = {
      ...priceBreakdown,
      service_surcharges: [
        ...buildExchangeServiceSurchargesBreakdown(
          input.workingSelectedServices ?? [],
          input.defectiveSelectedServices ?? [],
          input.serviceSurchargesData
        ),
        ...buildTowLevelServiceBreakdown(input.towServiceSurcharges, input.serviceSurchargesData),
        ...manualSurchargesToBreakdown(input.manualSurcharges),
      ],
    }
  }

  const vehicles: PreparedTowData['vehicles'] = []

  // רכב תקין
  if (input.workingVehiclePlate) {
    vehicles.push({
      plateNumber: normalizePlate(input.workingVehiclePlate),
      vehicleCode: input.workingVehicleCode || undefined,
      vehicleType: mapVehicleType(input.workingVehicleType || ''),
      manufacturer:
        input.workingVehicleData?.data?.manufacturer || input.workingManualManufacturer || undefined,
      model: input.workingVehicleData?.data?.model,
      year: input.workingVehicleData?.data?.year,
      color: input.workingVehicleData?.data?.color || input.workingManualColor || undefined,
      isWorking: true,
      driveType: input.workingVehicleData?.data?.driveType,
      fuelType: input.workingVehicleData?.data?.fuelType,
      totalWeight: input.workingVehicleData?.data?.totalWeight ?? (input.workingManualWeight ? Number(input.workingManualWeight) : undefined),
      gearType: input.workingVehicleData?.data?.gearType,
      driveTechnology: input.workingVehicleData?.data?.driveTechnology,
      registrySource: input.workingVehicleData?.source ?? null,
      chassis:
        input.workingVehicleData?.data?.chassis ||
        input.workingManualChassis ||
        undefined,
      importType: input.workingVehicleData?.data?.importType || undefined,
      ...machineryFromLookupResult(
        input.workingVehicleData?.source,
        input.workingVehicleData?.data
      ),
      ...curbWeightPersist(
        input.workingVehicleData?.source,
        input.workingVehicleData?.data?.curbWeightKg
      ),
    })
  }

  // רכב תקול
  if (input.defectiveVehiclePlate) {
    vehicles.push({
      plateNumber: normalizePlate(input.defectiveVehiclePlate),
      vehicleCode: input.defectiveVehicleCode || undefined,
      vehicleType: mapVehicleType(input.defectiveVehicleType || ''),
      manufacturer:
        input.defectiveVehicleData?.data?.manufacturer ||
        input.defectiveManualManufacturer ||
        undefined,
      model: input.defectiveVehicleData?.data?.model,
      year: input.defectiveVehicleData?.data?.year,
      color:
        input.defectiveVehicleData?.data?.color || input.defectiveManualColor || undefined,
      isWorking: false,
      towReason: input.selectedDefects?.length
        ? serializeDefects(input.selectedDefects)
        : undefined,
      driveType: input.defectiveVehicleData?.data?.driveType,
      fuelType: input.defectiveVehicleData?.data?.fuelType,
      totalWeight: input.defectiveVehicleData?.data?.totalWeight ?? (input.defectiveManualWeight ? Number(input.defectiveManualWeight) : undefined),
      gearType: input.defectiveVehicleData?.data?.gearType,
      driveTechnology: input.defectiveVehicleData?.data?.driveTechnology,
      registrySource: input.defectiveVehicleData?.source ?? null,
      chassis:
        input.defectiveVehicleData?.data?.chassis ||
        input.defectiveManualChassis ||
        undefined,
      importType: input.defectiveVehicleData?.data?.importType || undefined,
      ...machineryFromLookupResult(
        input.defectiveVehicleData?.source,
        input.defectiveVehicleData?.data
      ),
      ...curbWeightPersist(
        input.defectiveVehicleData?.source,
        input.defectiveVehicleData?.data?.curbWeightKg
      ),
    })
  }

  const vehiclesWithIds = assignExistingVehicleIds(
    vehicles,
    mapExistingVehiclesForMatch(input.existingTowVehicles)
  )

  const workingIdx = vehiclesWithIds.findIndex(v => v.isWorking)
  const defectiveIdx = vehiclesWithIds.findIndex(v => !v.isWorking)

  const points: PreparedTowPoint[] = []

  const isFourPointFlow = !!(
    input.workingVehicleDestinationAddress?.address &&
    input.workingVehicleDestinationAddress.address !== input.exchangePointAddress?.address
  )

  if (isFourPointFlow) {
    // 4-point flow: pickup תקין → dropoff תקין → pickup תקול → dropoff תקול

    // Point 0: איסו�� תקין
    if (input.workingVehicleSourceAddress?.address) {
      points.push({
        point_order: 0,
        point_type: 'pickup',
        address: input.workingVehicleSourceAddress.address,
        lat: input.workingVehicleSourceAddress.lat || null,
        lng: input.workingVehicleSourceAddress.lng || null,
        contact_name: input.workingVehicleContactName || null,
        contact_phone: input.workingVehicleContactPhone || null,
        notes: null,
        vehicleIndices: workingIdx >= 0 ? [workingIdx] : [],
        isStorage: input.workingVehicleSource === 'storage',
      })
    }

    // Point 1: הורדת תקין
    if (input.workingVehicleDestinationAddress?.address) {
      points.push({
        point_order: 1,
        point_type: 'dropoff',
        address: input.workingVehicleDestinationAddress.address,
        lat: input.workingVehicleDestinationAddress.lat || null,
        lng: input.workingVehicleDestinationAddress.lng || null,
        contact_name: input.workingDestinationContactName || null,
        contact_phone: input.workingDestinationContactPhone || null,
        notes: null,
        vehicleIndices: workingIdx >= 0 ? [workingIdx] : [],
        isStorage: input.workingVehicleDestinationIsStorage === true,
      })
    }

    // Point 2: איסו�� תקול
    if (input.exchangePointAddress?.address) {
      points.push({
        point_order: 2,
        point_type: 'pickup',
        address: input.exchangePointAddress.address,
        lat: input.exchangePointAddress.lat || null,
        lng: input.exchangePointAddress.lng || null,
        contact_name: input.exchangeContactName || null,
        contact_phone: input.exchangeContactPhone || null,
        notes: null,
        vehicleIndices: defectiveIdx >= 0 ? [defectiveIdx] : [],
        isStorage: false,
      })
    }

    // Point 3: הורדת תקול
    if (input.defectiveDestinationAddress?.address) {
      points.push({
        point_order: 3,
        point_type: 'dropoff',
        address: input.defectiveDestinationAddress.address,
        lat: input.defectiveDestinationAddress.lat || null,
        lng: input.defectiveDestinationAddress.lng || null,
        contact_name: input.defectiveDestinationContactName || null,
        contact_phone: input.defectiveDestinationContactPhone || null,
        notes: null,
        vehicleIndices: defectiveIdx >= 0 ? [defectiveIdx] : [],
        isStorage: input.defectiveDestination === 'storage',
      })
    }
  } else {
    // נקודה 1 — איסוף התקין
    if (input.workingVehicleSourceAddress?.address) {
      points.push({
        point_order: 0,
        point_type: 'pickup',
        address: input.workingVehicleSourceAddress.address,
        lat: input.workingVehicleSourceAddress.lat || null,
        lng: input.workingVehicleSourceAddress.lng || null,
        contact_name: input.workingVehicleContactName || null,
        contact_phone: input.workingVehicleContactPhone || null,
        notes: null,
        vehicleIndices: workingIdx >= 0 ? [workingIdx] : [],
        isStorage: input.workingVehicleSource === 'storage',
      })
    }

    // נקודה 2 — נקודת החלפה
    if (input.exchangePointAddress?.address) {
      points.push({
        point_order: 1,
        point_type: 'exchange',
        address: input.exchangePointAddress.address,
        lat: input.exchangePointAddress.lat || null,
        lng: input.exchangePointAddress.lng || null,
        contact_name: input.exchangeContactName || null,
        contact_phone: input.exchangeContactPhone || null,
        notes: null,
        vehicleIndices: [
          ...(workingIdx >= 0 ? [workingIdx] : []),
          ...(defectiveIdx >= 0 ? [defectiveIdx] : [])
        ],
        isStorage: false,
      })
    }

    // נקודה 3 — יעד התקול
    if (input.defectiveDestinationAddress?.address) {
      points.push({
        point_order: 2,
        point_type: 'dropoff',
        address: input.defectiveDestinationAddress.address,
        lat: input.defectiveDestinationAddress.lat || null,
        lng: input.defectiveDestinationAddress.lng || null,
        contact_name: input.defectiveDestinationContactName || null,
        contact_phone: input.defectiveDestinationContactPhone || null,
        notes: null,
        vehicleIndices: defectiveIdx >= 0 ? [defectiveIdx] : [],
        isStorage: input.defectiveDestination === 'storage',
      })
    }

    // נקודה 4 — יעד רכב תקין
    if (
      input.workingVehicleDestinationAddress?.address &&
      input.workingVehicleDestinationAddress.address !== input.exchangePointAddress?.address
    ) {
      points.push({
        point_order: 3,
        point_type: 'dropoff',
        address: input.workingVehicleDestinationAddress.address,
        lat: input.workingVehicleDestinationAddress.lat || null,
        lng: input.workingVehicleDestinationAddress.lng || null,
        contact_name: input.workingDestinationContactName || null,
        contact_phone: input.workingDestinationContactPhone || null,
        notes: null,
        vehicleIndices: workingIdx >= 0 ? [workingIdx] : [],
        isStorage: input.workingVehicleDestinationIsStorage === true,
      })
    }
  }


  const legs: PreparedTowData['legs'] = [{
    legType: 'pickup',
    fromAddress: input.workingVehicleSourceAddress?.address,
    toAddress: input.exchangePointAddress?.address,
    fromLat: input.workingVehicleSourceAddress?.lat,
    fromLng: input.workingVehicleSourceAddress?.lng,
    toLat: input.exchangePointAddress?.lat,
    toLng: input.exchangePointAddress?.lng
  }, {
    legType: 'delivery',
    fromAddress: input.exchangePointAddress?.address,
    toAddress: input.defectiveDestinationAddress?.address,
    fromLat: input.exchangePointAddress?.lat,
    fromLng: input.exchangePointAddress?.lng,
    toLat: input.defectiveDestinationAddress?.lat,
    toLng: input.defectiveDestinationAddress?.lng
  }]

  const pointsWithIds = assignExistingPointIds(
    points,
    mapExistingPointsForMatch(input.existingTowPoints)
  )

  return {
    companyId: input.companyId,
    createdBy: input.userId,
    customerOrderNumber: input.customerOrderNumber,
    ...businessFields,
    customerId: input.customerId || undefined,
    driverId: input.preSelectedDriverId || undefined,
    truckId: input.preSelectedTruckId || undefined,
    secondDriverId: input.secondDriverId || undefined,
    secondDriverScheduledAt: input.secondDriverScheduledAt || undefined,
    towType: 'exchange',
    requiredTruckTypes: input.requiredTruckTypes || [],
    scheduledAt,
    scheduledEndAt,
    notes: input.notes || undefined,
    finalPrice: clampNonNegativePrice(
      resolvedExchangeFinalPrice != null
        ? resolvedExchangeFinalPrice
        : input.finalPrice || undefined
    ),
    priceMode: input.priceMode,
    priceBreakdown,
    vehicles: vehiclesWithIds,
    legs,
    points: pointsWithIds,
    paymentMethod: input.paymentMethod || undefined,
    invoiceName: input.invoiceName || undefined,
    startFromBase: input.startFromBase || false,
    dropoffToStorage: input.dropoffToStorage || false
  }
}

  // Fallback - לא אמור לקרות
  throw new Error('Invalid tow type or missing route points')
}