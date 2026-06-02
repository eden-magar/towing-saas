import type { TowWithDetails, TowPointWithDetails, PriceBreakdown } from '../../queries/tows'
import type {
  LegacyPayload,
  LegacyPayloadDefective,
  LegacyPayloadExchangeNew,
  LegacyAddress,
  LegacyContact,
  LegacyVehicle,
  LegacyDefectiveCar,
  LegacySecondDefectiveCar,
  LegacyWorkingCar,
  LegacyDefectivePickup,
  LegacyPricingFields,
  LegacyPaymentType,
  LegacyPriceBredown,
  LegacyRouteStop,
  LegacyRoutePoint,
} from './types'
import { getTruckTypeLabel } from '../../utils/truck-type-labels'

// ---------------------------------------------------------------------------
// Input shape (extends getTowWithPoints result + optional joins)
// ---------------------------------------------------------------------------

/** Extra columns on tow_vehicles not declared on TowVehicle in queries/tows.ts */
type TowVehicleRow = TowWithDetails['vehicles'][number] & {
  vehicle_code?: string | null
  fuel_type?: string | null
  drive_type?: string | null
  gear_type?: string | null
  drive_technology?: string | null
  total_weight?: number | null
  registry_source?: string | null
}

/**
 * SaaS tow row as returned by {@link getTowWithPoints}, plus optional joins
 * for company name and creator email (not always loaded by default).
 */
export type TowForLegacyMapping = TowWithDetails & {
  vehicles: TowVehicleRow[]
  company?: { name: string } | null
  creator?: { email: string } | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_ADDRESS: LegacyAddress = {
  address: '',
  physicalAddress: '',
  isGoogleAddress: false,
  originalText: '',
  hasChanged: false,
}

function sortVehicles(vehicles: TowVehicleRow[]): TowVehicleRow[] {
  return [...vehicles].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
}

function sortPoints(points: TowPointWithDetails[]): TowPointWithDetails[] {
  return [...points].sort((a, b) => a.point_order - b.point_order)
}

function formatExecutionDate(scheduledAt: string | null): string {
  const d = scheduledAt ? new Date(scheduledAt) : new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d)
  const year = parts.find(p => p.type === 'year')?.value || ''
  const month = parts.find(p => p.type === 'month')?.value || ''
  const day = parts.find(p => p.type === 'day')?.value || ''
  return `${year}-${month}-${day}`
}

function formatExecutionTime(scheduledAt: string | null): string {
  const d = scheduledAt ? new Date(scheduledAt) : new Date()
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d)
  const hour = parts.find(p => p.type === 'hour')?.value || '00'
  const minute = parts.find(p => p.type === 'minute')?.value || '00'
  return `${hour}:${minute}`
}

function pointToAddress(point: TowPointWithDetails | undefined): LegacyAddress {
  if (!point) return { ...EMPTY_ADDRESS }
  const text = point.address ?? ''
  if (point.lat != null && point.lng != null) {
    return {
      address: text,
      physicalAddress: text,
      isGoogleAddress: true,
      isPinDropped: true,
      lat: point.lat,
      lng: point.lng,
    }
  }
  return {
    address: text,
    physicalAddress: text,
    isGoogleAddress: false,
    originalText: '',
    hasChanged: false,
  }
}

function storagePrefixForPoint(point: TowPointWithDetails | undefined): string {
  if (!point?.is_storage) return ''
  if (point.point_type === 'pickup') return '🚨 איסוף מאחסנה 🚨\n'
  if (point.point_type === 'dropoff') return '🚨 הורדה לאחסנה 🚨\n'
  return ''
}

function pointToAddressForCalendar(point: TowPointWithDetails | undefined): LegacyAddress {
  const base = pointToAddress(point)
  const prefix = storagePrefixForPoint(point)
  if (!prefix) return base
  const address = prefix + (base.address || '')
  const physicalAddress = prefix + (base.physicalAddress || base.address || '')
  return { ...base, address, physicalAddress }
}

function buildTowSelection(tow: TowForLegacyMapping): string {
  const truckPart = (tow.required_truck_types ?? [])
    .map(getTruckTypeLabel)
    .filter(Boolean)
    .join(', ')
  const hasDollyService = (tow.price_breakdown?.service_surcharges ?? []).some(
    (s) => s.label === 'דולי'
  )
  if (hasDollyService && truckPart) return `${truckPart} + דולי`
  if (hasDollyService) return 'דולי'
  return truckPart
}

function contactFromPoint(point: TowPointWithDetails | undefined): LegacyContact {
  return {
    name: point?.contact_name ?? '',
    phone: point?.contact_phone ?? '',
  }
}

function findPickupPoint(points: TowPointWithDetails[]): TowPointWithDetails | undefined {
  if (points.length === 0) return undefined
  return points.find((p) => p.point_type === 'pickup') ?? points[0]
}

function findDropoffPoint(points: TowPointWithDetails[]): TowPointWithDetails | undefined {
  if (points.length === 0) return undefined
  return points.find((p) => p.point_type === 'dropoff') ?? points[points.length - 1]
}

function pointsLinkedToVehicle(
  points: TowPointWithDetails[],
  vehicleId: string
): TowPointWithDetails[] {
  return points.filter((p) =>
    (p.vehicles ?? []).some((pv) => pv.vehicle?.id === vehicleId)
  )
}

function pointHalves(points: TowPointWithDetails[]): {
  first: TowPointWithDetails[]
  second: TowPointWithDetails[]
} {
  const sorted = sortPoints(points)
  const mid = Math.ceil(sorted.length / 2)
  return { first: sorted.slice(0, mid), second: sorted.slice(mid) }
}

function pickupAndDropoffFromSubset(subset: TowPointWithDetails[]): {
  pickup: TowPointWithDetails | undefined
  dropoff: TowPointWithDetails | undefined
} {
  const sorted = sortPoints(subset)
  return {
    pickup: findPickupPoint(sorted),
    dropoff: findDropoffPoint(sorted),
  }
}

function mapPaymentMethod(method: string | null | undefined): LegacyPaymentType {
  if (method === 'credit' || method === 'invoice' || method === 'cash') {
    return method
  }
  return 'cash'
}

function sumAmounts(items: { amount: number }[] | undefined): number {
  return (items ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0)
}

function mapLegacyVehicle(v: TowVehicleRow | undefined): LegacyVehicle {
  if (!v) {
    return {
      carNumber: '',
      carType: '',
      carCode: '',
      color: '',
      gear: '',
      machineryType: '',
      selfWeight: '',
      totalWeightTon: '',
      fuelType: '',
      driveType: '',
      gearType: '',
    }
  }
  return {
    carNumber: v.plate_number ?? '',
    carType: `${v.manufacturer ?? ''} ${v.model ?? ''}`.trim(),
    carCode: v.vehicle_code ?? '',
    color: v.color ?? '',
    gear: v.gear_type ?? '',
    machineryType: '',
    selfWeight: '',
    totalWeightTon: String(v.total_weight ?? ''),
    fuelType: v.fuel_type ?? '',
    driveType: v.drive_type ?? '',
    gearType: v.gear_type ?? '',
  }
}

/** Legacy hidden-field JSON: `{ type: 'private' | 'motorcycle' | 'heavy' | 'machinery' }` */
function legacyDataSourceJson(registrySource: string | null | undefined): string {
  const type = registrySource?.trim()
  if (!type) return ''
  return JSON.stringify({ type })
}

function buildPriceBredown(
  tow: TowForLegacyMapping,
  totalPrice: number
): LegacyPriceBredown {
  const mode = tow.price_mode ?? 'recommended'
  // Legacy manual path when user picked fixed/custom price mode
  if (mode === 'custom' || mode === 'fixed') {
    return { totalPrice, isManual: true }
  }

  const b: PriceBreakdown | null = tow.price_breakdown
  return {
    vehicleBasePrice: b?.base_price ?? 0,
    vehicleDescription: 'גרירת רכב',
    travelDistance: b?.distance_km ?? 0,
    travelPrice: b?.distance_price ?? 0,
    workFees: sumAmounts(b?.service_surcharges),
    timeSurcharge: sumAmounts(b?.time_surcharges),
    areaSurcharge: sumAmounts(b?.location_surcharges),
    totalPrice: b?.total ?? totalPrice,
    totalBeforeVAT: b?.subtotal ?? 0,
    vatAmount: b?.vat_amount ?? 0,
    vatPercentage: 18,
  }
}

function buildPricingFields(tow: TowForLegacyMapping): LegacyPricingFields {
  const totalPrice = tow.final_price ?? 0
  const breakdown = tow.price_breakdown
  const isOutskirts = (breakdown?.location_surcharges ?? []).length > 0
  const isFromGarage = tow.start_from_base ?? false
  const discountEnabled =
    (breakdown?.discount_percent ?? 0) > 0 || (breakdown?.discount_amount ?? 0) > 0
  const mode = tow.price_mode ?? 'recommended'
  const finalTier = mode === 'custom' || mode === 'fixed' ? 'manual' : 'regular'

  // payment.price must be absent when totalPrice === 0 (legacy JSON.stringify omits undefined)
  const payment: LegacyPricingFields['payment'] = {
    paymentType: mapPaymentMethod(tow.payment_method),
  }
  if (totalPrice > 0) {
    payment.price = totalPrice
  }

  return {
    pricing: {
      outskirts: isOutskirts,
      selectedTier: 'regular',
      autoRecommendedTier: 'regular',
      finalTier,
      finalPrice: totalPrice,
      discountEnabled,
      displayed: { regular: null, plus25: null, plus50: null },
      discountApplied: discountEnabled,
      fromGarage: isFromGarage,
    },
    totalPrice,
    isOutskirts,
    isFromGarage,
    payment,
    distanceData: null,
    // Apps Script reads this exact key spelling
    priceBredown: buildPriceBredown(tow, totalPrice),
  }
}

function buildLegacyStops(points: TowPointWithDetails[] | undefined): LegacyRouteStop[] {
  return sortPoints(points ?? [])
    .filter((p) => p.point_type === 'stop')
    .map((point) => ({
      order: point.point_order,
      address: pointToAddressForCalendar(point),
      subtype: point.stop_subtype ?? '',
      notes: point.order_notes ?? '',
      contactName: point.contact_name ?? '',
      contactPhone: point.contact_phone ?? '',
    }))
}

function buildLegacyRoutePoints(
  points: TowPointWithDetails[] | undefined
): LegacyRoutePoint[] {
  return sortPoints(points ?? []).map((point) => ({
    order: point.point_order,
    pointType: point.point_type,
    address: pointToAddressForCalendar(point),
    subtype: point.stop_subtype ?? '',
    notes: point.order_notes ?? '',
    contactName: point.contact_name ?? '',
    contactPhone: point.contact_phone ?? '',
  }))
}

function buildSharedBase(tow: TowForLegacyMapping, towSelection: string) {
  return {
    orderNumber: tow.customer_order_number || tow.order_number || '',
    executionDate: formatExecutionDate(tow.scheduled_at),
    executionTime: formatExecutionTime(tow.scheduled_at),
    towSelection,
    notes: tow.notes ?? '',
    submittedBy: '',
    clientName: tow.customer?.name ?? '',
    clientPhone: '',
    // Quotes are not "approved" in legacy terms; everything else is treated as approved
    priceApproved: tow.status !== 'quote',
    invoiceName: tow.invoice_name ?? '',
    company: tow.company?.name ?? '',
    department: tow.department ?? '',
    orderedBy: tow.ordered_by ?? '',
    stops: buildLegacyStops(tow.points),
    routePoints: buildLegacyRoutePoints(tow.points),
  }
}

// ---------------------------------------------------------------------------
// Defective branch
// ---------------------------------------------------------------------------

function mapDefectivePayload(tow: TowForLegacyMapping): LegacyPayloadDefective {
  const vehicles = sortVehicles(tow.vehicles ?? [])
  const hasSecondCar = vehicles.length >= 2
  const towSelection = buildTowSelection(tow)
  const points = sortPoints(tow.points ?? [])

  const pickupPoint = findPickupPoint(points)
  const dropoffPoint = findDropoffPoint(points)
  const sourceAddr = pointToAddressForCalendar(pickupPoint)
  const destAddr = pointToAddressForCalendar(dropoffPoint)

  const primary = vehicles[0]
  const defectiveCar: LegacyDefectiveCar = {
    ...mapLegacyVehicle(primary),
    defectDetails: primary?.tow_reason ?? '',
    towSelection,
    source: sourceAddr,
    destination: destAddr,
    primaryContact: contactFromPoint(pickupPoint),
    destinationContact: contactFromPoint(dropoffPoint),
  }

  const payload: LegacyPayloadDefective = {
    ...buildSharedBase(tow, towSelection),
    ...buildPricingFields(tow),
    towingType: 'defective',
    location: sourceAddr.physicalAddress,
    defectiveCar,
    hasSecondCar,
    dataSource_defective: legacyDataSourceJson(primary?.registry_source),
  }

  if (hasSecondCar) {
    const second = vehicles[1]
    const secondCar: LegacySecondDefectiveCar = {
      ...mapLegacyVehicle(second),
      defectDetails: second?.tow_reason ?? '',
      shareSource: false,
      shareDestination: false,
    }
    // Optional: points linked only to the second vehicle
    const secondPoints = second?.id ? pointsLinkedToVehicle(points, second.id) : []
    if (secondPoints.length > 0) {
      const { pickup, dropoff } = pickupAndDropoffFromSubset(secondPoints)
      secondCar.source = pointToAddressForCalendar(pickup)
      secondCar.destination = pointToAddressForCalendar(dropoff)
      secondCar.primaryContact = contactFromPoint(pickup)
      secondCar.destinationContact = contactFromPoint(dropoff)
    }
    payload.secondDefectiveCar = secondCar
    payload.dataSource_defective2 = legacyDataSourceJson(second?.registry_source)
  }

  return payload
}

// ---------------------------------------------------------------------------
// Exchange-new branch (SaaS tow_type === 'exchange' only)
// ---------------------------------------------------------------------------

function mapExchangeNewPayload(tow: TowForLegacyMapping): LegacyPayloadExchangeNew {
  const vehicles = sortVehicles(tow.vehicles ?? [])
  const towSelection = buildTowSelection(tow)
  const points = sortPoints(tow.points ?? [])

  const working =
    vehicles.find((v) => v.is_working === true) ?? vehicles[0]
  const defective =
    vehicles.find((v) => v.is_working === false) ??
    vehicles.find((v) => v !== working) ??
    vehicles[1]

  const { first, second } = pointHalves(points)

  const workingSubset =
    working?.id && pointsLinkedToVehicle(points, working.id).length > 0
      ? pointsLinkedToVehicle(points, working.id)
      : first
  const defectiveSubset =
    defective?.id && pointsLinkedToVehicle(points, defective.id).length > 0
      ? pointsLinkedToVehicle(points, defective.id)
      : second.length > 0
        ? second
        : points

  const workingStops = pickupAndDropoffFromSubset(workingSubset)
  const defectiveStops = pickupAndDropoffFromSubset(defectiveSubset)

  const workingSourceAddr = pointToAddressForCalendar(workingStops.pickup)
  const workingDestAddr = pointToAddressForCalendar(workingStops.dropoff)
  const defectiveSourceAddr = pointToAddressForCalendar(defectiveStops.pickup)
  const defectiveDestAddr = pointToAddressForCalendar(defectiveStops.dropoff)

  const workingCar: LegacyWorkingCar = {
    ...mapLegacyVehicle(working),
    towSelection,
    source: workingSourceAddr,
    destination: workingDestAddr,
    sourceContact: contactFromPoint(workingStops.pickup),
    destContact: contactFromPoint(workingStops.dropoff),
  }

  const defectivePickup: LegacyDefectivePickup = {
    ...mapLegacyVehicle(defective),
    defectDetails: defective?.tow_reason ?? '',
    towSelection,
    source: defectiveSourceAddr,
    destination: defectiveDestAddr,
    sourceContact: contactFromPoint(defectiveStops.pickup),
    destContact: contactFromPoint(defectiveStops.dropoff),
  }

  return {
    ...buildSharedBase(tow, towSelection),
    ...buildPricingFields(tow),
    towingType: 'exchange',
    isNewWorkingDefective: true,
    location: workingSourceAddr.physicalAddress,
    workingCar,
    defectivePickup,
    manualPrice: String(tow.final_price ?? ''),
    dataSource_working: legacyDataSourceJson(working?.registry_source),
    dataSource_defective2: legacyDataSourceJson(defective?.registry_source),
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Maps a SaaS tow (typically from {@link getTowWithPoints}) into the legacy
 * `collectFormData()` JSON shape for Google Apps Script.
 *
 * Branch selection:
 * - `tow_type === 'exchange'` → {@link LegacyPayloadExchangeNew} (`isNewWorkingDefective: true`)
 * - all other tow types → {@link LegacyPayloadDefective} (`towingType: 'defective'`)
 */
export function mapTowToLegacyPayload(tow: TowForLegacyMapping): LegacyPayload {
  if (tow.tow_type === 'exchange') {
    return mapExchangeNewPayload(tow)
  }
  return mapDefectivePayload(tow)
}
