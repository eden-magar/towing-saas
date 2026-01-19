import { PriceBreakdown } from '../queries/tows'
import { CustomerWithPricing, TimeSurcharge, LocationSurcharge, ServiceSurcharge } from '../queries/price-lists'
import { RoutePoint, VehicleOnTruck } from '../../components/tow-forms/routes/RouteBuilder'
import { SelectedService } from '../../components/tow-forms/shared'

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
  
  // Tow Type
  towType: 'single' | 'custom'
  
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
  pickupAddress?: AddressData
  dropoffAddress?: AddressData
  distance?: DistanceResult | null
  startFromBase?: boolean
  baseToPickupDistance?: DistanceResult | null
  
  // Custom Tow Data
  routePoints?: RoutePoint[]
  customRouteData?: { totalDistanceKm: number; vehicles: { type: string; isWorking: boolean }[] }
  
  // Pricing
  priceMode: 'recommended' | 'fixed' | 'customer' | 'custom'
  finalPrice: number
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
}

// ==================== NEW: TowPoint Types ====================

export interface PreparedTowPoint {
  point_order: number
  point_type: 'pickup' | 'dropoff'
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
  customerId?: string
  driverId?: string
  towType: 'simple' | 'with_base' | 'transfer' | 'multi_vehicle'
  scheduledAt?: string
  notes?: string
  finalPrice?: number
  priceMode?: 'recommended' | 'fixed' | 'customer' | 'custom'
  priceBreakdown?: PriceBreakdown
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

/**
 * בניית פירוט מחיר לגרירה רגילה (single)
 */
export function buildSingleTowPriceBreakdown(input: SaveTowInput): PriceBreakdown {
  const vehicleTypeMap: Record<string, string> = {
    'private': 'base_price_private',
    'motorcycle': 'base_price_motorcycle',
    'heavy': 'base_price_heavy',
    'machinery': 'base_price_machinery'
  }
  
  const priceField = input.vehicleType ? vehicleTypeMap[input.vehicleType] : null
  const basePrice = priceField ? (input.basePriceList?.[priceField] || 0) : 0
  const pricePerKm = input.basePriceList?.price_per_km || 0
  
  const pickupToDropoffKm = input.distance?.distanceKm || 0
  const baseToPickupKm = (input.startFromBase && input.baseToPickupDistance?.distanceKm) || 0
  const distanceKm = pickupToDropoffKm + baseToPickupKm
  const distancePrice = Math.round(distanceKm * pricePerKm)
  
  const subtotal = basePrice + distancePrice
  
  // תוספות זמן
  const timeSurchargesBreakdown = (input.activeTimeSurcharges || []).map(s => ({
    id: s.id,
    label: s.label,
    percent: s.surcharge_percent,
    amount: Math.round(subtotal * s.surcharge_percent / 100)
  }))
  const timeAmount = timeSurchargesBreakdown.reduce((sum, s) => Math.max(sum, s.amount), 0)
  
  // תוספות מיקום
  const locationSurchargesBreakdown = (input.selectedLocationSurcharges || [])
    .map(id => input.locationSurchargesData?.find(l => l.id === id))
    .filter(Boolean)
    .map(s => ({
      id: s!.id,
      label: s!.label,
      percent: s!.surcharge_percent,
      amount: Math.round(subtotal * s!.surcharge_percent / 100)
    }))
  const locationAmount = locationSurchargesBreakdown.reduce((sum, s) => sum + s.amount, 0)
  
  // תוספות שירותים
  const serviceSurchargesBreakdown = (input.selectedServices || [])
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
      
      return {
        id: surcharge.id,
        label: surcharge.label,
        price: surcharge.price,
        units,
        amount
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null && s.amount > 0)
  const servicesTotal = serviceSurchargesBreakdown.reduce((sum, s) => sum + s.amount, 0)
  
  const beforeDiscount = subtotal + timeAmount + locationAmount + servicesTotal
  const discountPercent = input.selectedCustomerPricing?.discount_percent || 0
  const discountAmount = Math.round(beforeDiscount * discountPercent / 100)
  const beforeVat = beforeDiscount - discountAmount
  const vatAmount = Math.round(beforeVat * 0.18)
  const total = beforeVat + vatAmount

  return {
    base_price: basePrice,
    vehicle_type: input.vehicleType || '',
    distance_km: distanceKm,
    distance_price: distancePrice,
    time_surcharges: timeSurchargesBreakdown,
    location_surcharges: locationSurchargesBreakdown,
    service_surcharges: serviceSurchargesBreakdown,
    subtotal: beforeDiscount,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    vat_amount: vatAmount,
    total: total
  }
}

/**
 * בניית פירוט מחיר לגרירה מותאמת (custom)
 */
export function buildCustomTowPriceBreakdown(
  input: SaveTowInput, 
  routePoints: RoutePoint[]
): PriceBreakdown & { vehicle_count: number; route_points: RoutePoint[] } {
  const vehicles = input.customRouteData?.vehicles || []
  const totalDistanceKm = input.customRouteData?.totalDistanceKm || 0
  const pricePerKm = input.basePriceList?.price_per_km || 12
  
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
    totalBasePrice += input.basePriceList?.[priceField] || 180
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
    const priceBreakdown = buildSingleTowPriceBreakdown(input)
    
    const vehicles: PreparedTowData['vehicles'] = [{
      plateNumber: input.vehiclePlate || '',
      vehicleType: mapVehicleType(input.vehicleType || ''),
      manufacturer: input.vehicleData?.data?.manufacturer,
      model: input.vehicleData?.data?.model,
      year: input.vehicleData?.data?.year,
      color: input.vehicleData?.data?.color,
      isWorking: !(input.selectedDefects?.length),
      towReason: input.selectedDefects?.join(', ') || undefined,
      driveType: input.vehicleData?.data?.driveType,
      fuelType: input.vehicleData?.data?.fuelType,
      totalWeight: input.vehicleData?.data?.totalWeight,
      gearType: input.vehicleData?.data?.gearType,
      driveTechnology: input.vehicleData?.data?.driveTechnology
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
      points
    }
  }

  // גרירה מותאמת
  if (input.towType === 'custom' && input.routePoints) {
    const priceBreakdown = buildCustomTowPriceBreakdown(input, input.routePoints)
    const vehicles = collectVehiclesFromRoutePoints(input.routePoints)
    const legs = convertRoutePointsToLegs(input.routePoints)
    
    // NEW: יצירת נקודות גרירה
    const points = convertRoutePointsToTowPoints(input.routePoints, vehicles)

    return {
      companyId: input.companyId,
      createdBy: input.userId,
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
      points
    }
  }

  // Fallback - לא אמור לקרות
  throw new Error('Invalid tow type or missing route points')
}