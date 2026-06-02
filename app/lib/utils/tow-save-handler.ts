import { PriceBreakdown } from '../queries/tows'
import { CustomerWithPricing, TimeSurcharge, LocationSurcharge, ServiceSurcharge } from '../queries/price-lists'
import { RoutePoint, VehicleOnTruck } from '../../components/tow-forms/routes/RouteBuilder'
import { SelectedService } from '../../components/tow-forms/shared'
import { calculateTowPrice, extractBasePrices } from './price-calculator'
import { VehicleType } from '../types'
import { normalizePlate } from './plate-number'
import type { AddressData } from '../google-maps'

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
  /** Regular tow: ordered route list (pickup / stop / dropoff in list order) */
  routeStops?: {
    role: 'pickup' | 'dropoff' | 'stop'
    stopSubtype?: 'key' | 'customer_pickup' | 'customer_dropoff' | 'other'
    address: AddressData
    contactName?: string
    contactPhone?: string
    notes?: string
    orderNotes?: string
  }[]
  distance?: DistanceResult | null
  startFromBase?: boolean
  baseToPickupDistance?: DistanceResult | null
  
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
  vatPercent?: number
  manualAdjustmentPercent?: number
  basePriceList: any
  selectedCustomerPricing: CustomerWithPricing | null
  
  // Surcharges (for single tow)
  activeTimeSurcharges?: TimeSurcharge[]
  selectedLocationSurcharges?: string[]
  locationSurchargesData?: LocationSurcharge[]
  selectedServices?: SelectedService[]
  /** Exchange: separate lists so service_surcharges can store vehicle_role */
  workingSelectedServices?: SelectedService[]
  defectiveSelectedServices?: SelectedService[]
  serviceSurchargesData?: ServiceSurcharge[]
  
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
}

// ==================== NEW: TowPoint Types ====================

export interface PreparedTowPoint {
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
  notes?: string
  finalPrice?: number
  priceMode?: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  priceBreakdown?: PriceBreakdown | null
  requiredTruckTypes?: string[]
  vehicles: {
    plateNumber: string
    manufacturer?: string
    model?: string
    year?: number
    vehicleType?: 'motorcycle' | 'private' | 'heavy' | 'machinery'
    color?: string
    isWorking?: boolean
    towReason?: string
    notes?: string
    driveType?: string
    fuelType?: string
    totalWeight?: number
    gearType?: string
    driveTechnology?: string
    vehicleCode?: string
    registrySource?: string | null
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

/**
 * מיפוי סוג רכב מקוד לטיפוס DB
 */
function mapVehicleType(vehicleCode?: string): 'motorcycle' | 'private' | 'heavy' | 'machinery' | undefined {
  if (!vehicleCode) return undefined
  const validTypes = ['motorcycle', 'private', 'heavy', 'machinery']
  return validTypes.includes(vehicleCode) ? vehicleCode as any : undefined
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
  return Array.from(vehiclesMap.values()).map(v => ({
    plateNumber: normalizePlate(v.plateNumber),
    manufacturer: v.vehicleData?.manufacturer,
    model: v.vehicleData?.model,
    year: v.vehicleData?.year ? Number(v.vehicleData.year) : undefined,
    vehicleType: mapVehicleType(v.vehicleType ?? 'private') ?? 'private',
    vehicleCode: v.vehicleCode || undefined,
    color: v.vehicleData?.color,
    isWorking: v.isWorking,
    towReason: v.isWorking ? undefined : (v.defects?.filter(Boolean).join(', ') || 'לא נוסע'),
    registrySource: v.vehicleType ?? null,
    driveType: v.vehicleData?.driveType,
    fuelType: v.vehicleData?.fuelType,
    totalWeight: v.vehicleData?.totalWeight ? Number(v.vehicleData.totalWeight) : undefined,
    gearType: v.vehicleData?.gearType
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

    points.push({
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
    })
  }

  return points
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

function buildServiceSurchargesBreakdown(input: SaveTowInput): PriceBreakdown['service_surcharges'] {
  return (input.selectedServices || [])
    .map(selected => {
      const surcharge = input.serviceSurchargesData?.find(s => s.id === selected.id)
      if (!surcharge) return null
      let amount = 0
      let units: number | undefined = undefined
      if (surcharge.price_type === 'manual') {
        amount = selected.manualPrice || 0
      } else if (surcharge.price_type === 'per_unit') {
        units = selected.quantity || 1
        amount = surcharge.price * units
      } else {
        amount = surcharge.price
      }
      return { id: surcharge.id, label: surcharge.label, price: surcharge.price, units, amount }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null && s.amount > 0)
}

  function buildLocationSurchargesBreakdown(
    input: SaveTowInput,
    subtotalForLocation: number
  ): PriceBreakdown['location_surcharges'] {
    return (input.selectedLocationSurcharges || [])
      .map(id => input.locationSurchargesData?.find(l => l.id === id))
      .filter(Boolean)
      .map(s => ({
        id: s!.id,
        label: s!.label,
        percent: s!.surcharge_percent,
        amount: Math.round(subtotalForLocation * s!.surcharge_percent / 100)
      }))
  }

/**
 * בניית פירוט מחיר לגרירה רגילה (single)
 * Thin wrapper: calls calculateTowPrice and formats for DB storage.
 */
export function buildSingleTowPriceBreakdown(input: SaveTowInput): PriceBreakdown {
  const activePriceList = (input.priceMode === 'recommended_customer' && input.selectedCustomerPricing?.price_list)
    ? input.selectedCustomerPricing.price_list
    : input.basePriceList

  const pickupToDropoffKm = input.distance?.distanceKm || 0
  const baseToPickupKm = (input.startFromBase && input.baseToPickupDistance?.distanceKm) || 0
  const distanceKm = pickupToDropoffKm + baseToPickupKm

  const locationSurcharges = (input.selectedLocationSurcharges || [])
    .map(id => input.locationSurchargesData?.find(l => l.id === id))
    .filter(Boolean)
    .map(s => ({ percent: s!.surcharge_percent }))

  const serviceSurcharges = (input.selectedServices || [])
    .map(selected => {
      const s = input.serviceSurchargesData?.find(x => x.id === selected.id)
      if (!s) return { amount: 0 }
      if (s.price_type === 'manual') return { amount: selected.manualPrice || 0 }
      if (s.price_type === 'per_unit') return { amount: s.price * (selected.quantity || 1) }
      return { amount: s.price }
    })
    .filter(x => x.amount > 0)

  const exchangeBasePriceOverride =
    input.towType === 'exchange' && input.workingVehicleType && input.defectiveVehicleType
      ? (extractBasePrices(activePriceList)[input.workingVehicleType as VehicleType] ?? 0) +
        (extractBasePrices(activePriceList)[input.defectiveVehicleType as VehicleType] ?? 0)
      : undefined

  const result = calculateTowPrice({
    priceList: {
      base_prices: extractBasePrices(activePriceList),
      price_per_km: activePriceList?.price_per_km ?? 12,
      minimum_price: activePriceList?.minimum_price ?? 250
    },
    vehicleType: (input.vehicleType as VehicleType) || 'private',
    distanceKm,
    ...(exchangeBasePriceOverride !== undefined ? { basePriceOverride: exchangeBasePriceOverride } : {}),
    timeSurcharges: input.activeTimeSurcharges || [],
    towDate: input.towDate || '',
    towTime: input.towTime || '',
    isHoliday: false,
    activeTimeSurchargeIds: (input.activeTimeSurcharges || []).map(s => s.id),
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
          amount: Math.round(result.subtotal * result.maxTimeSurchargePercent / 100)
        }]
      })()
    : []

  const locationSurchargesBreakdown = (input.selectedLocationSurcharges || [])
    .map(id => input.locationSurchargesData?.find(l => l.id === id))
    .filter(Boolean)
    .map(s => ({
      id: s!.id,
      label: s!.label,
      percent: s!.surcharge_percent,
      amount: Math.round(result.subtotal * s!.surcharge_percent / 100)
    }))

  const serviceSurchargesBreakdown = (input.selectedServices || [])
    .map(selected => {
      const s = input.serviceSurchargesData?.find(x => x.id === selected.id)
      if (!s) return null
      let amount = 0
      let units: number | undefined
      if (s.price_type === 'manual') amount = selected.manualPrice || 0
      else if (s.price_type === 'per_unit') {
        units = selected.quantity || 1
        amount = s.price * units
      } else amount = s.price
      if (amount <= 0) return null
      return { id: s.id, label: s.label, price: s.price, units, amount }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  return {
    base_price: result.basePrice,
    vehicle_type: input.vehicleType || '',
    distance_km: distanceKm,
    distance_price: Math.round(result.distancePrice),
    time_surcharges: timeSurchargesBreakdown,
    location_surcharges: locationSurchargesBreakdown,
    service_surcharges: serviceSurchargesBreakdown,
    subtotal: result.beforeVat,
    discount_percent: input.selectedCustomerPricing?.discount_percent ?? 0,
    discount_amount: Math.round(result.discountAmount),
    vat_amount: Math.round(result.vatAmount),
    total: result.total
  }
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
    input.priceMode === 'recommended_customer' && input.selectedCustomerPricing?.price_list
      ? input.selectedCustomerPricing.price_list
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
    .map((s) => ({ percent: s!.surcharge_percent }))

  const serviceSurcharges = routeServices
    .map((selected) => {
      const s = input.serviceSurchargesData?.find((x) => x.id === selected.id)
      if (!s) return { amount: 0 }
      if (s.price_type === 'manual') return { amount: selected.manualPrice || 0 }
      if (s.price_type === 'per_unit') return { amount: s.price * (selected.quantity || 1) }
      return { amount: s.price }
    })
    .filter((x) => x.amount > 0)

  const result = calculateTowPrice({
    priceList: {
      base_prices: extractBasePrices(activePriceList),
      price_per_km: activePriceList?.price_per_km ?? 12,
      minimum_price: activePriceList?.minimum_price ?? 250,
    },
    vehicleType: 'private',
    distanceKm: totalDistanceKm,
    basePriceOverride: totalBasePrice,
    timeSurcharges: input.activeTimeSurcharges || [],
    towDate: input.towDate || '',
    towTime: input.towTime || '',
    isHoliday: false,
    activeTimeSurchargeIds: (input.activeTimeSurcharges || []).map((s) => s.id),
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
              amount: Math.round(result.subtotal * result.maxTimeSurchargePercent / 100),
            },
          ]
        })()
      : []

  const locationSurchargesBreakdown = (input.selectedLocationSurcharges || [])
    .map((id) => input.locationSurchargesData?.find((l) => l.id === id))
    .filter(Boolean)
    .map((s) => ({
      id: s!.id,
      label: s!.label,
      percent: s!.surcharge_percent,
      amount: Math.round(result.subtotal * s!.surcharge_percent / 100),
    }))

  const serviceSurchargesBreakdown = routeServices
    .map((selected) => {
      const s = input.serviceSurchargesData?.find((x) => x.id === selected.id)
      if (!s) return null
      let amount = 0
      let units: number | undefined
      if (s.price_type === 'manual') amount = selected.manualPrice || 0
      else if (s.price_type === 'per_unit') {
        units = selected.quantity || 1
        amount = s.price * units
      } else amount = s.price
      if (amount <= 0) return null
      return { id: s.id, label: s.label, price: s.price, units, amount }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  return {
    base_price: result.basePrice,
    vehicle_type: 'mixed',
    vehicle_count: vehicles.length,
    distance_km: totalDistanceKm,
    distance_price: Math.round(result.distancePrice),
    time_surcharges: timeSurchargesBreakdown,
    location_surcharges: locationSurchargesBreakdown,
    service_surcharges: serviceSurchargesBreakdown,
    subtotal: result.beforeVat,
    discount_percent: input.selectedCustomerPricing?.discount_percent ?? 0,
    discount_amount: Math.round(result.discountAmount),
    vat_amount: Math.round(result.vatAmount),
    total: result.total,
    route_points: routePoints,
  }
}

// ==================== Main Function ====================

/**
 * הפונקציה הראשית - מכינה את כל הנתונים לשמירה
 */
export function prepareTowData(input: SaveTowInput): PreparedTowData {
  const scheduledAt = input.towDate && input.towTime 
    ? new Date(`${input.towDate}T${input.towTime}:00`).toISOString() 
    : new Date().toISOString()
  const businessFields = businessTowCustomerFields(input)

  // גרירה רגילה
  if (input.towType === 'single') {
    const priceBreakdown = input.priceMode === 'custom'
  ? (input.existingPriceBreakdown
      ? {
          ...input.existingPriceBreakdown,
          location_surcharges: buildLocationSurchargesBreakdown(
            input,
            input.existingPriceBreakdown.base_price + input.existingPriceBreakdown.distance_price
          ),
          service_surcharges: buildServiceSurchargesBreakdown(input)
        }
      : null)
  : buildSingleTowPriceBreakdown(input)
    
    const vehicles: PreparedTowData['vehicles'] = [{
      plateNumber: normalizePlate(input.vehiclePlate || ''),
      vehicleType: mapVehicleType(input.vehicleType || ''),
      manufacturer: input.vehicleData?.data?.manufacturer || input.manualManufacturer,
      model: input.vehicleData?.data?.model,
      year: input.vehicleData?.data?.year,
      color: input.vehicleData?.data?.color || input.manualColor,
      isWorking: !(input.selectedDefects?.length),
      towReason: input.selectedDefects?.join(', ') || undefined,
      driveType: input.vehicleData?.data?.driveType,
      fuelType: input.vehicleData?.data?.fuelType,
      totalWeight: input.vehicleData?.data?.totalWeight || (input.manualWeight ? Number(input.manualWeight) : undefined),
      gearType: input.vehicleData?.data?.gearType,
      driveTechnology: input.vehicleData?.data?.driveTechnology,
      vehicleCode: input.vehicleCode || undefined,
      registrySource: input.vehicleData?.source ?? null,
    }]

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
      notes: input.notes || undefined,
      finalPrice: input.finalPrice || undefined,
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
              location_surcharges: buildLocationSurchargesBreakdown(
                input,
                input.existingPriceBreakdown.base_price + input.existingPriceBreakdown.distance_price
              ),
              service_surcharges: buildServiceSurchargesBreakdown({
                ...input,
                selectedServices: aggregateRouteServices(input.customRouteData?.services),
              }),
            }
          : null)
      : buildCustomTowPriceBreakdown(input, input.routePoints)
    const vehicles = collectVehiclesFromRoutePoints(input.routePoints)
    const legs = convertRoutePointsToLegs(input.routePoints)
    
    // NEW: יצירת נקודות גרירה
    const points = convertRoutePointsToTowPoints(input.routePoints, vehicles)

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
      notes: input.notes || undefined,
      finalPrice: input.finalPrice || undefined,
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
  let priceBreakdown: PriceBreakdown | null =
    input.priceMode === 'custom'
      ? (input.existingPriceBreakdown ?? null)
      : buildSingleTowPriceBreakdown(input)

  const useExchangeServiceRoles =
    input.workingSelectedServices !== undefined || input.defectiveSelectedServices !== undefined
  if (priceBreakdown && useExchangeServiceRoles) {
    priceBreakdown = {
      ...priceBreakdown,
      service_surcharges: buildExchangeServiceSurchargesBreakdown(
        input.workingSelectedServices ?? [],
        input.defectiveSelectedServices ?? [],
        input.serviceSurchargesData
      ),
    }
  }

  const vehicles: PreparedTowData['vehicles'] = []

  // רכב תקין
  if (input.workingVehiclePlate) {
    vehicles.push({
      plateNumber: normalizePlate(input.workingVehiclePlate),
      vehicleCode: input.workingVehicleCode || undefined,
      vehicleType: mapVehicleType(input.workingVehicleType || ''),
      manufacturer: input.workingVehicleData?.data?.manufacturer,
      model: input.workingVehicleData?.data?.model,
      year: input.workingVehicleData?.data?.year,
      color: input.workingVehicleData?.data?.color,
      isWorking: true,
      driveType: input.workingVehicleData?.data?.driveType,
      fuelType: input.workingVehicleData?.data?.fuelType,
      totalWeight: input.workingVehicleData?.data?.totalWeight,
      gearType: input.workingVehicleData?.data?.gearType,
      driveTechnology: input.workingVehicleData?.data?.driveTechnology,
      registrySource: input.workingVehicleData?.source ?? null,
    })
  }

  // רכב תקול
  if (input.defectiveVehiclePlate) {
    vehicles.push({
      plateNumber: normalizePlate(input.defectiveVehiclePlate),
      vehicleCode: input.defectiveVehicleCode || undefined,
      vehicleType: mapVehicleType(input.defectiveVehicleType || ''),
      manufacturer: input.defectiveVehicleData?.data?.manufacturer,
      model: input.defectiveVehicleData?.data?.model,
      year: input.defectiveVehicleData?.data?.year,
      color: input.defectiveVehicleData?.data?.color,
      isWorking: false,
      towReason: input.selectedDefects?.join(', ') || undefined,
      driveType: input.defectiveVehicleData?.data?.driveType,
      fuelType: input.defectiveVehicleData?.data?.fuelType,
      totalWeight: input.defectiveVehicleData?.data?.totalWeight,
      gearType: input.defectiveVehicleData?.data?.gearType,
      driveTechnology: input.defectiveVehicleData?.data?.driveTechnology,
      registrySource: input.defectiveVehicleData?.source ?? null,
    })
  }

  const workingIdx = vehicles.findIndex(v => v.isWorking)
  const defectiveIdx = vehicles.findIndex(v => !v.isWorking)

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
    notes: input.notes || undefined,
    finalPrice: input.finalPrice || undefined,
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

  // Fallback - לא אמור לקרות
  throw new Error('Invalid tow type or missing route points')
}