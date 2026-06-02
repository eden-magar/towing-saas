/**
 * TypeScript mirror of the JSON payload sent to CALENDAR_URL by the legacy
 * towing form (grr_golan_clean_safe). Field names and shapes match collectFormData()
 * and its helpers; do not rename keys consumed by Apps Script.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type LegacyTowingType = 'defective' | 'exchange'

export type LegacyPaymentType = 'cash' | 'credit' | 'invoice'

export type LegacyAddressPinDrop = {
  address: string
  physicalAddress: string
  isGoogleAddress: boolean
  isPinDropped: true
  lat: number
  lng: number
}

export type LegacyAddressStandard = {
  address: string
  physicalAddress: string
  isGoogleAddress: boolean
  originalText: string
  hasChanged: boolean
}

export type LegacyAddress = LegacyAddressPinDrop | LegacyAddressStandard

export type LegacyContact = {
  name: string
  phone: string
}

export type LegacyVehicle = {
  carNumber: string
  carType: string
  carCode: string
  color: string
  gear: string
  machineryType: string
  selfWeight: string
  totalWeightTon: string
  fuelType: string
  driveType: string
  gearType: string
}

// ---------------------------------------------------------------------------
// Pricing (collectPricingData + collectPricingAndPaymentData)
// ---------------------------------------------------------------------------

export type LegacyPricingDisplayed = {
  regular: number | null
  plus25: number | null
  plus50: number | null
}

/** Inner `pricing` object; `discountApplied` / `fromGarage` are set after build. */
export type LegacyPricing = {
  outskirts: boolean
  selectedTier: string
  autoRecommendedTier: string
  finalTier: string
  finalPrice: number | null
  discountEnabled: boolean
  displayed: LegacyPricingDisplayed
  discountApplied: boolean
  fromGarage: boolean
}

export type LegacyCreditCard = {
  number: string
  expiry: string
  cvv: string
  holderPhone: string
}

export type LegacyPayment = {
  paymentType: LegacyPaymentType
  /** Omitted from JSON when totalPrice === 0 */
  price?: number
  idNumber?: string
  creditCard?: LegacyCreditCard
}

export type LegacyDistanceSegment = {
  from: string
  to: string
  distance: number
}

export type LegacyDistanceData = {
  success: boolean
  distanceKm: number
  distanceText: string
  duration: string
  durationValue: number
  segments: LegacyDistanceSegment[]
}

export type LegacyPriceBredownManual = {
  totalPrice: number
  isManual: true
}

export type LegacyPriceBredownAuto = {
  vehicleBasePrice: number
  vehicleDescription: string
  travelDistance: number
  travelPrice: number
  workFees: number
  timeSurcharge: number
  areaSurcharge: number
  totalPrice: number
  totalBeforeVAT: number
  vatAmount: number
  vatPercentage: number
}

export type LegacyPriceBredown = LegacyPriceBredownManual | LegacyPriceBredownAuto

/** Pricing tail merged onto every payload branch. */
export type LegacyPricingFields = {
  pricing: LegacyPricing
  totalPrice: number
  isOutskirts: boolean
  isFromGarage: boolean
  payment: LegacyPayment
  distanceData?: LegacyDistanceData | null
  /** Typo preserved for Apps Script compatibility. */
  priceBredown?: LegacyPriceBredown
}

// ---------------------------------------------------------------------------
// Base fields (collectBaseFormData)
// ---------------------------------------------------------------------------

export type LegacyRouteStop = {
  order: number
  address: LegacyAddress
  subtype: string
  notes: string
  contactName: string
  contactPhone: string
}

export type LegacyRoutePoint = {
  order: number
  pointType: string
  address: LegacyAddress
  subtype: string
  notes: string
  contactName: string
  contactPhone: string
}

export type LegacyBaseFields = {
  orderNumber: string
  executionDate: string
  executionTime: string
  towSelection: string
  notes: string
  submittedBy: string
  clientName: string
  clientPhone: string
  priceApproved: boolean
  invoiceName: string
  company: string
  department: string
  orderedBy: string
  stops: LegacyRouteStop[]
  routePoints: LegacyRoutePoint[]
}

// ---------------------------------------------------------------------------
// Defective branch (collectDefectiveData)
// ---------------------------------------------------------------------------

export type LegacyDefectiveCar = LegacyVehicle & {
  defectDetails: string
  towSelection: string
  source: LegacyAddress
  destination: LegacyAddress
  primaryContact: LegacyContact
  destinationContact: LegacyContact
}

export type LegacySecondDefectiveCar = LegacyVehicle & {
  /** Free-text textarea on second car (not tag list). */
  defectDetails: string
  shareSource: boolean
  shareDestination: boolean
  source?: LegacyAddress
  destination?: LegacyAddress
  primaryContact?: LegacyContact
  destinationContact?: LegacyContact
}

export type LegacyPayloadDefective = LegacyBaseFields &
  LegacyPricingFields & {
    towingType: 'defective'
    location: string
    defectiveCar: LegacyDefectiveCar
    hasSecondCar: boolean
    dataSource_defective: string
    secondDefectiveCar?: LegacySecondDefectiveCar
    dataSource_defective2?: string
  }

// ---------------------------------------------------------------------------
// Exchange — new form (collectWorkingDefectiveData)
// ---------------------------------------------------------------------------

export type LegacyWorkingCar = LegacyVehicle & {
  towSelection: string
  source: LegacyAddress
  destination: LegacyAddress
  sourceContact: LegacyContact
  destContact: LegacyContact
}

export type LegacyDefectivePickup = LegacyVehicle & {
  defectDetails: string
  towSelection: string
  source: LegacyAddress
  destination: LegacyAddress
  sourceContact: LegacyContact
  destContact: LegacyContact
}

export type LegacyPayloadExchangeNew = LegacyBaseFields &
  LegacyPricingFields & {
    towingType: 'exchange'
    isNewWorkingDefective: true
    location: string
    workingCar: LegacyWorkingCar
    defectivePickup: LegacyDefectivePickup
    /** Input `.value` string, not coerced to number. */
    manualPrice: string
    dataSource_working: string
    dataSource_defective2: string
  }

// ---------------------------------------------------------------------------
// Exchange — old form (collectOldExchangeData; backward compatibility)
// ---------------------------------------------------------------------------

export type LegacyDefectivePickupOld = LegacyVehicle & {
  defectDetails: string
  destination: LegacyAddress
  garageContact: LegacyContact
}

export type LegacyPayloadExchangeOld = LegacyBaseFields &
  LegacyPricingFields & {
    towingType: 'exchange'
    location: string
    workingCar: LegacyWorkingCar
    defectivePickup: LegacyDefectivePickupOld
    dataSource_working: string
    dataSource_exchangeDefective: string
  }

export type LegacyPayloadExchange = LegacyPayloadExchangeNew | LegacyPayloadExchangeOld

// ---------------------------------------------------------------------------
// Top-level payload union
// ---------------------------------------------------------------------------

export type LegacyPayload = LegacyPayloadDefective | LegacyPayloadExchange
