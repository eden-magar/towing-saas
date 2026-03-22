import { PriceBreakdown } from '../queries/tows'
import { CustomerWithPricing, TimeSurcharge, LocationSurcharge, ServiceSurcharge } from '../queries/price-lists'
import { RoutePoint, VehicleOnTruck } from '../../components/tow-forms/routes/RouteBuilder'
import { SelectedService } from '../../components/tow-forms/shared'
import { calculateTowPrice, extractBasePrices } from './price-calculator'
import { VehicleType } from '../types'

// ==================== Types ====================

export interface AddressData {
  address: string
  placeId?: string
  lat?: number
  lng?: number
  isPinDropped?: boolean
}

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
  
  // Date/Time
  towDate: string
  towTime: string
  
  // Driver (pre-selected)
  preSelectedDriverId: string | null
  
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
  pickupAddress?: AddressData
  dropoffAddress?: AddressData
  distance?: DistanceResult | null
  startFromBase?: boolean
  baseToPickupDistance?: DistanceResult | null
  
  // Custom Tow Data
  routePoints?: RoutePoint[]
  customRouteData?: { totalDistanceKm: number; vehicles: { type: string; isWorking: boolean }[] }
  
  // Pricing
  priceMode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  finalPrice: number
  vatPercent?: number
  basePriceList: any
  selectedCustomerPricing: CustomerWithPricing | null
  
  // Surcharges (for single tow)
  activeTimeSurcharges?: TimeSurcharge[]
  selectedLocationSurcharges?: string[]
  locationSurchargesData?: LocationSurcharge[]
  selectedServices?: SelectedService[]
  serviceSurchargesData?: ServiceSurcharge[]
  
  // Additional
  notes?: string
  pickupContactName?: string
  pickupContactPhone?: string
  dropoffContactName?: string
  dropoffContactPhone?: string

  paymentMethod?: string
  invoiceName?: string
  dropoffToStorage?: boolean
  existingPriceBreakdown?: PriceBreakdown | null
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
  defectiveDestinationAddress?: AddressData
  defectiveDestinationContactName?: string
  defectiveDestinationContactPhone?: string
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
  // רכבים בנקודה - מכיל את ה-index של הרכב ב-vehicles array
  vehicleIndices: number[]
  // האם זו נקודה לאחסנה
  dropToStorage?: boolean
}

// Output ל-createTow
export interface PreparedTowData {
  companyId: string
  createdBy: string
  customerOrderNumber?: string
  customerId?: string
  driverId?: string
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
  defectiveDestinationAddress?: AddressData
  defectiveDestinationContactName?: string
  defectiveDestinationContactPhone?: string
  linkedTowId?: string
  // NEW: נקודות גרירה
  points: PreparedTowPoint[]
}

// ==================== Helper Functions ====================

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
    plateNumber: v.plateNumber,
    manufacturer: v.vehicleData?.manufacturer,
    model: v.vehicleData?.model,
    year: v.vehicleData?.year ? Number(v.vehicleData.year) : undefined,
    vehicleType: mapVehicleType(v.vehicleCode),
    color: v.vehicleData?.color,
    isWorking: v.isWorking,
    towReason: v.isWorking ? undefined : 'לא נוסע',
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
          dropToStorage: rp.dropToStorage
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
        vehicleIndices: pickupVehicleIndices
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
        vehicleIndices
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
        dropToStorage: rp.dropToStorage
      })
    }
  }
  
  return points
}

/**
 * NEW: יצירת נקודות גרירה לגרירה פשוטה (single)
 */
export function createSingleTowPoints(input: SaveTowInput): PreparedTowPoint[] {
  const points: PreparedTowPoint[] = []
  
  // נקודת איסוף
  if (input.pickupAddress?.address) {
    points.push({
      point_order: 0,
      point_type: 'pickup',
      address: input.pickupAddress.address,
      lat: input.pickupAddress.lat || null,
      lng: input.pickupAddress.lng || null,
      contact_name: input.pickupContactName || null,
      contact_phone: input.pickupContactPhone || null,
      notes: null,
      vehicleIndices: [0] // הרכב היחיד
    })
  }
  
  // נקודת פריקה
  if (input.dropoffAddress?.address) {
    points.push({
      point_order: 1,
      point_type: 'dropoff',
      address: input.dropoffAddress.address,
      lat: input.dropoffAddress.lat || null,
      lng: input.dropoffAddress.lng || null,
      contact_name: input.dropoffContactName || null,
      contact_phone: input.dropoffContactPhone || null,
      notes: null,
      vehicleIndices: [0] // הרכב היחיד
    })
  }
  
  return points
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

  const result = calculateTowPrice({
    priceList: {
      base_prices: extractBasePrices(activePriceList),
      price_per_km: activePriceList?.price_per_km ?? 12,
      minimum_price: activePriceList?.minimum_price ?? 250
    },
    vehicleType: (input.vehicleType as VehicleType) || 'private',
    distanceKm,
    timeSurcharges: input.activeTimeSurcharges || [],
    towDate: input.towDate || '',
    towTime: input.towTime || '',
    isHoliday: false,
    activeTimeSurchargeIds: (input.activeTimeSurcharges || []).map(s => s.id),
    locationSurcharges,
    serviceSurcharges,
    priceMode: 'recommended',
    discountPercent: input.selectedCustomerPricing?.discount_percent ?? 0,
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
 */
export function buildCustomTowPriceBreakdown(
  input: SaveTowInput, 
  routePoints: RoutePoint[]
): PriceBreakdown & { vehicle_count: number; route_points: RoutePoint[] } {
  const activePriceList = (input.priceMode === 'recommended_customer' && input.selectedCustomerPricing?.price_list)
    ? input.selectedCustomerPricing.price_list
    : input.basePriceList
  const vehicles = input.customRouteData?.vehicles || []
  const totalDistanceKm = input.customRouteData?.totalDistanceKm || 0
  const pricePerKm = activePriceList?.price_per_km || 12
  
  // חישוב מחיר בסיס לכל הרכבים
  let totalBasePrice = 0
  const vehicleTypeMap: Record<string, string> = {
    'private': 'base_price_private',
    'motorcycle': 'base_price_motorcycle',
    'heavy': 'base_price_heavy',
    'machinery': 'base_price_machinery'
  }
  
  vehicles.forEach(v => {
    const priceField = vehicleTypeMap[v.type] || 'base_price_private'
    totalBasePrice += activePriceList?.[priceField] || 180
  })
  
  const distancePrice = Math.round(totalDistanceKm * pricePerKm)
  const subtotal = totalBasePrice + distancePrice
  
  // תוספות זמן (פשוט יותר לגרירה מותאמת)
  const timeSurchargesBreakdown = (input.activeTimeSurcharges || []).map(s => ({
    id: s.id,
    label: s.label,
    percent: s.surcharge_percent,
    amount: Math.round(subtotal * s.surcharge_percent / 100)
  }))
  const timeAmount = timeSurchargesBreakdown.reduce((sum, s) => Math.max(sum, s.amount), 0)
  
  const beforeDiscount = subtotal + timeAmount
  const discountPercent = input.selectedCustomerPricing?.discount_percent || 0
  const discountAmount = Math.round(beforeDiscount * discountPercent / 100)
  const beforeVat = beforeDiscount - discountAmount
  const vatAmount = Math.round(beforeVat * 0.18)
  const total = beforeVat + vatAmount

  return {
    base_price: totalBasePrice,
    vehicle_type: 'mixed',
    vehicle_count: vehicles.length,
    distance_km: totalDistanceKm,
    distance_price: distancePrice,
    time_surcharges: timeSurchargesBreakdown,
    location_surcharges: [],
    service_surcharges: [],
    subtotal: beforeDiscount,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    vat_amount: vatAmount,
    total: total,
    route_points: routePoints
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
      plateNumber: input.vehiclePlate || '',
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
    }]

    const legs: PreparedTowData['legs'] = [{
      legType: 'pickup',
      fromAddress: input.pickupAddress?.address,
      toAddress: input.dropoffAddress?.address,
      fromLat: input.pickupAddress?.lat,
      fromLng: input.pickupAddress?.lng,
      toLat: input.dropoffAddress?.lat,
      toLng: input.dropoffAddress?.lng
    }]

    // NEW: יצירת נקודות גרירה
    const points = createSingleTowPoints(input)

    return {
      companyId: input.companyId,
      createdBy: input.userId,
      customerOrderNumber: input.customerOrderNumber,
      customerId: input.customerId || undefined,
      driverId: input.preSelectedDriverId || undefined,
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
          service_surcharges: buildServiceSurchargesBreakdown(input)
        }
      : null)
  : buildSingleTowPriceBreakdown(input)
    const vehicles = collectVehiclesFromRoutePoints(input.routePoints)
    const legs = convertRoutePointsToLegs(input.routePoints)
    
    // NEW: יצירת נקודות גרירה
    const points = convertRoutePointsToTowPoints(input.routePoints, vehicles)

    return {
      companyId: input.companyId,
      createdBy: input.userId,
      customerOrderNumber: input.customerOrderNumber,
      customerId: input.customerId || undefined,
      driverId: input.preSelectedDriverId || undefined,
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
  const priceBreakdown = input.priceMode === 'custom'
    ? (input.existingPriceBreakdown ?? null)
    : buildSingleTowPriceBreakdown(input)

  const vehicles: PreparedTowData['vehicles'] = []

  // רכב תקין
  if (input.workingVehiclePlate) {
    vehicles.push({
      plateNumber: input.workingVehiclePlate,
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
      driveTechnology: input.workingVehicleData?.data?.driveTechnology
    })
  }

  // רכב תקול
  if (input.defectiveVehiclePlate) {
    vehicles.push({
      plateNumber: input.defectiveVehiclePlate,
      vehicleType: mapVehicleType(input.vehicleType || ''),
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
      driveTechnology: input.defectiveVehicleData?.data?.driveTechnology
    })
  }

  const workingIdx = vehicles.findIndex(v => v.isWorking)
  const defectiveIdx = vehicles.findIndex(v => !v.isWorking)

  const points: PreparedTowPoint[] = []

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
      vehicleIndices: workingIdx >= 0 ? [workingIdx] : []
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
      ]
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
      vehicleIndices: defectiveIdx >= 0 ? [defectiveIdx] : []
    })
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
    customerId: input.customerId || undefined,
    driverId: input.preSelectedDriverId || undefined,
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