import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../lib/AuthContext'
import { getTowWithPoints, type EditTowSnapshot, type PriceBreakdown } from '../lib/queries/tows'
import { getCustomersLite, CustomerListItem } from '../lib/queries/customers'
import { getDrivers } from '../lib/queries/drivers'
import { getCompanySettings } from '../lib/queries/settings'
import { getTrucks } from '../lib/queries/trucks'
import { 
  getBasePriceList, 
  getCustomerIdsWithPersonalPricing, 
  getFixedPriceItems, 
  getTimeSurcharges, 
  getLocationSurcharges, 
  getServiceSurcharges, 
  getWeightBrackets,
  CustomerWithPricing, 
  FixedPriceItem, 
  TimeSurcharge, 
  LocationSurcharge, 
  ServiceSurcharge,
  WeightBracket,
} from '../lib/queries/price-lists'
import { DriverWithDetails, TruckWithDetails, VehicleType, VehicleLookupResult } from '../lib/types'
import {
  getCustomerStoredVehiclesForDisplay,
  getStoredVehicleById,
  getVehiclesReservedForTow,
  searchStoredVehicle,
  StoredVehicleWithCustomer,
} from '../lib/queries/storage'
import { loadGoogleMaps, calculateDistance, AddressData } from '../lib/google-maps'
import { extractBasePrices, resolveVehicleBasePrice } from '../lib/utils/price-calculator'
import { buildExchangePriceAffectingSignature, buildSinglePriceAffectingSignature } from '../lib/utils/tow-save-handler'
import { normalizePlate } from '../lib/utils/plate-number'
import {
  STORAGE_OTHER_CUSTOMER_MESSAGE,
  STORAGE_TAKE_OUT_CANCELLED_MESSAGE,
  storedVehicleToCondition,
  type StoredPlateResolveResult,
  type StoredVehicleHydrationSlot,
} from '../lib/utils/storage-vehicle'
import { TowType, PriceItem, DistanceResult } from '../components/tow-forms/sections'
import { SelectedService } from '../components/tow-forms/shared'
import {
  type ManualSurcharge,
  extractManualSurcharges,
} from '../lib/utils/manual-surcharge'
import {
  extractTowLevelServices,
  excludeTowLevelServices,
} from '../lib/utils/tow-service-surcharge'
import { RoutePoint, type VehicleOnTruck } from '../components/tow-forms/routes'
import {
  buildRoutePointsFromExchangeState,
  type ExchangeFormState,
} from '../lib/utils/exchange-to-route-points'
import { useTowPricing } from './useTowPricing'
import { useTowSave } from './useTowSave'

interface ExchangeRouteStop {
  id: string
  address: AddressData
  contactName: string
  contactPhone: string
  notes: string
}

export type RouteRole = 'pickup' | 'dropoff' | 'stop'

export interface RouteStop {
  id: string
  role: RouteRole
  stopSubtype?: 'key' | 'customer_pickup' | 'customer_dropoff' | 'other'
  address: AddressData
  contactName?: string
  contactPhone?: string
  notes?: string
  orderNotes?: string
}

export function createDefaultRouteStops(): RouteStop[] {
  return [
    { id: crypto.randomUUID(), role: 'pickup', address: { address: '' } },
    { id: crypto.randomUUID(), role: 'dropoff', address: { address: '' } },
  ]
}

export function findPickupRouteStop(stops: RouteStop[]): RouteStop | undefined {
  return stops.find((s) => s.role === 'pickup')
}

export function findDropoffRouteStop(stops: RouteStop[]): RouteStop | undefined {
  for (let i = stops.length - 1; i >= 0; i--) {
    if (stops[i].role === 'dropoff') return stops[i]
  }
  return undefined
}

function routeStopsDistanceSignatureFromStops(stops: RouteStop[]): string {
  return JSON.stringify(
    stops.map((stop) => [stop.address.address, stop.address.lat, stop.address.lng])
  )
}

function routeStopsDistanceSignatureFromPoints(
  points: Array<{ address?: string | null; lat?: unknown; lng?: unknown }>
): string {
  return JSON.stringify(
    points.map((p) => [
      p.address || '',
      p.lat != null && p.lat !== '' ? Number(p.lat) : undefined,
      p.lng != null && p.lng !== '' ? Number(p.lng) : undefined,
    ])
  )
}

/** Saved breakdown stores { id, label, percent, amount } — join id → catalog day_type. */
function inferIsHolidayFromSavedBreakdown(
  breakdown: PriceBreakdown | null | undefined,
  catalogs: TimeSurcharge[][]
): boolean {
  const applied = (breakdown?.time_surcharges ?? []).filter((row) => (row.amount ?? 0) > 0)
  if (applied.length === 0) return false

  const byId = new Map<string, TimeSurcharge>()
  for (const catalog of catalogs) {
    for (const entry of catalog) {
      if (entry.id) byId.set(entry.id, entry)
    }
  }
  if (byId.size === 0) return false

  return applied.some((row) => byId.get(row.id)?.day_type === 'holiday')
}

const TOW_VEHICLE_REGISTRY_LABELS: Record<string, string> = {
  private: 'רכב פרטי',
  motorcycle: 'דו גלגלי',
  heavy: 'רכב כבד',
  machinery: 'צמ"ה',
}

type TowVehicleEditRow = {
  id?: string
  plate_number?: string | null
  manufacturer?: string | null
  model?: string | null
  year?: number | null
  vehicle_type?: string | null
  color?: string | null
  is_working?: boolean | null
  tow_reason?: string | null
  vehicle_code?: string | null
  registry_source?: string | null
  drive_type?: string | null
  fuel_type?: string | null
  total_weight?: number | null
  curb_weight_kg?: number | null
  gear_type?: string | null
  drive_technology?: string | null
  self_weight_ton?: number | null
  total_weight_ton?: number | null
  machinery_type?: string | null
  chassis?: string | null
  import_type?: string | null
}

function normalizeRegistrySource(
  raw: string | null | undefined
): VehicleLookupResult['source'] {
  const valid = ['private', 'motorcycle', 'heavy', 'machinery', 'personal_import'] as const
  if (raw && (valid as readonly string[]).includes(raw)) {
    return raw as VehicleLookupResult['source']
  }
  return null
}

function isManualCommercialVehicle(v: TowVehicleEditRow): boolean {
  if (v.registry_source) return false
  if (v.vehicle_type === 'van') return true
  if (!v.vehicle_type && v.total_weight != null && Number(v.total_weight) > 0) {
    return true
  }
  return false
}

type ExchangeVehicleHydrationTargets = {
  setVehicleType: (t: VehicleType | '') => void
  setVehicleData: (d: VehicleLookupResult | null) => void
  setVehicleNotFound: (v: boolean) => void
  setManualManufacturer: (s: string) => void
  setManualColor: (s: string) => void
  setManualWeight: (s: string) => void
  setManualChassis?: (s: string) => void
}

/** Mirror single-tow edit hydration for one exchange side (working or defective). */
function hydrateExchangeVehicleFromTowRow(
  row: TowVehicleEditRow | undefined,
  targets: ExchangeVehicleHydrationTargets
) {
  if (!row?.plate_number) return

  if (isManualCommercialVehicle(row)) {
    targets.setVehicleType('van' as VehicleType)
    targets.setVehicleData(null)
    targets.setVehicleNotFound(true)
    targets.setManualManufacturer(row.manufacturer || '')
    targets.setManualColor(row.color || '')
    targets.setManualWeight(
      row.total_weight != null ? String(row.total_weight) : ''
    )
    targets.setManualChassis?.(row.chassis || '')
    return
  }

  const savedType = (row.vehicle_type || '') as VehicleType | ''
  targets.setVehicleType(savedType)

  const lookupResult = buildVehicleLookupResultFromTowVehicle(row)
  if (lookupResult) {
    targets.setVehicleData(lookupResult)
    targets.setVehicleNotFound(false)
    if (!savedType && lookupResult.source) {
      targets.setVehicleType(lookupResult.source)
    }
    targets.setManualManufacturer('')
    targets.setManualColor('')
    targets.setManualWeight('')
    targets.setManualChassis?.('')
    return
  }

  targets.setVehicleData(null)
  targets.setVehicleNotFound(true)
  targets.setManualManufacturer(row.manufacturer || '')
  targets.setManualColor(row.color || '')
  targets.setManualWeight(
    row.total_weight != null ? String(row.total_weight) : ''
  )
  targets.setManualChassis?.(row.chassis || '')
}

function exchangeRouteDistanceSignatureFromAddresses(
  working: AddressData,
  workingDest: AddressData,
  exchange: AddressData,
  defective: AddressData,
  layout: 'four_point' | 'hub' | null
): string {
  const part = (a: AddressData) => `${a.address}|${a.lat ?? ''}|${a.lng ?? ''}`
  return [part(working), part(workingDest), part(exchange), part(defective), layout ?? ''].join(
    ';;'
  )
}

function commercialTypeUsesWeightBrackets(type: string): boolean {
  return type === 'van'
}

function buildExchangeDistanceWaypoints(
  layout: 'four_point' | 'hub' | null,
  editMode: boolean,
  working: AddressData,
  workingDest: AddressData,
  exchange: AddressData,
  defective: AddressData,
  stopsBefore: ExchangeRouteStop[],
  stopsAfter: ExchangeRouteStop[]
): AddressData[] {
  const workingDestDistinct =
    !!workingDest.address.trim() && workingDest.address !== exchange.address

  if (editMode && layout === 'four_point' && workingDestDistinct) {
    return [
      working,
      ...stopsBefore.map((s) => s.address),
      workingDest,
      exchange,
      ...stopsAfter.map((s) => s.address),
      defective,
    ]
  }

  if (editMode && layout === 'hub') {
    const chain: AddressData[] = [
      working,
      ...stopsBefore.map((s) => s.address),
      exchange,
      ...stopsAfter.map((s) => s.address),
      defective,
    ]
    if (workingDestDistinct) {
      chain.push(workingDest)
    }
    return chain
  }

  return [
    working,
    ...stopsBefore.map((s) => s.address),
    exchange,
    ...stopsAfter.map((s) => s.address),
    defective,
  ]
}

function buildVehicleLookupResultFromTowVehicle(
  v: TowVehicleEditRow
): VehicleLookupResult | null {
  const registrySource = normalizeRegistrySource(v.registry_source)
  if (!registrySource) return null

  const hasStoredDetails = !!(
    v.manufacturer ||
    v.model ||
    v.year ||
    v.color ||
    v.drive_type ||
    v.fuel_type ||
    v.total_weight ||
    v.gear_type ||
    v.drive_technology ||
    v.self_weight_ton != null ||
    v.total_weight_ton != null ||
    v.curb_weight_kg != null ||
    v.machinery_type ||
    v.chassis ||
    v.import_type
  )
  if (!hasStoredDetails) return null

  const source = registrySource

  return {
    found: true,
    source,
    sourceLabel: TOW_VEHICLE_REGISTRY_LABELS[source] || 'רכב פרטי',
    data: {
      plateNumber: v.plate_number || '',
      manufacturer: v.manufacturer || null,
      model: v.model || null,
      year: v.year ?? null,
      color: v.color || null,
      fuelType: v.fuel_type || null,
      totalWeight: v.total_weight ?? null,
      vehicleType: null,
      driveType: v.drive_type || null,
      driveTechnology: v.drive_technology || null,
      gearType: v.gear_type || null,
      chassis: v.chassis || null,
      importType: v.import_type || null,
      curbWeightKg: v.curb_weight_kg ?? null,
      machineryType: v.machinery_type || null,
      selfWeight: v.self_weight_ton ?? null,
      totalWeightTon: v.total_weight_ton ?? null,
    },
  }
}

function resolveFullTowVehicleRow(
  towVehicles: TowVehicleEditRow[] | undefined,
  vehicleId: string | undefined,
  plateNumber: string | undefined
): TowVehicleEditRow | undefined {
  const rows = towVehicles ?? []
  if (vehicleId) {
    const byId = rows.find((v) => v.id === vehicleId)
    if (byId) return byId
  }
  const plate = plateNumber?.trim()
  if (!plate) return undefined
  const normalized = normalizePlate(plate)
  return rows.find((v) => normalizePlate(v.plate_number || '') === normalized)
}

function parseTowReasonDefects(towReason: string | null | undefined): string[] {
  if (!towReason?.trim()) return []
  return towReason
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function vehicleDataFromTowVehicleRow(row: TowVehicleEditRow) {
  return {
    manufacturer: row.manufacturer || undefined,
    model: row.model || undefined,
    year: row.year != null ? String(row.year) : undefined,
    color: row.color || undefined,
    gearType: row.gear_type || undefined,
    driveType: row.drive_type || undefined,
    totalWeight: row.total_weight != null ? String(row.total_weight) : undefined,
    curbWeightKg: row.curb_weight_kg != null ? String(row.curb_weight_kg) : undefined,
    fuelType: row.fuel_type || undefined,
    chassis: row.chassis || undefined,
    importType: row.import_type || undefined,
    machineryType: row.machinery_type || undefined,
    selfWeight: row.self_weight_ton != null ? String(row.self_weight_ton) : undefined,
    totalWeightTon: row.total_weight_ton != null ? String(row.total_weight_ton) : undefined,
  }
}

/** Edit-mode custom route: merge tow.vehicles full row so save round-trips DB columns. */
function hydrateRouteVehicleFromTowRows(
  nestedVehicle: TowVehicleEditRow,
  fullRow: TowVehicleEditRow | undefined,
  vehicleId: string
): VehicleOnTruck {
  const row: TowVehicleEditRow = fullRow ? { ...nestedVehicle, ...fullRow } : nestedVehicle
  const plateNumber = row.plate_number || ''
  const isWorking = row.is_working !== false
  const defects = parseTowReasonDefects(row.tow_reason)
  const vehicleData = vehicleDataFromTowVehicleRow(row)

  const base: VehicleOnTruck = {
    id: vehicleId,
    plateNumber,
    isWorking,
    defects,
    vehicleCode: row.vehicle_code || '',
    registrySource: row.registry_source ?? null,
  }

  if (isManualCommercialVehicle(row)) {
    return {
      ...base,
      vehicleType: 'van',
      vehicleNotFound: true,
      manualManufacturer: row.manufacturer || '',
      manualColor: row.color || '',
      manualWeight: row.total_weight != null ? String(row.total_weight) : '',
      vehicleData,
    }
  }

  const savedType = (row.vehicle_type || '') as VehicleType | ''
  const lookupResult = buildVehicleLookupResultFromTowVehicle(row)

  if (lookupResult) {
    return {
      ...base,
      isFound: true,
      vehicleNotFound: false,
      vehicleType: savedType || (lookupResult.source as string) || undefined,
      vehicleData,
    }
  }

  return {
    ...base,
    vehicleType: savedType || undefined,
    vehicleNotFound: true,
    manualManufacturer: row.manufacturer || '',
    manualColor: row.color || '',
    manualWeight: row.total_weight != null ? String(row.total_weight) : '',
    vehicleData,
  }
}

type CustomRouteData = {
  totalDistanceKm: number
  vehicles: { type: string; isWorking: boolean }[]
  services: SelectedService[]
}

export function useTowForm(
  editTowId?: string,
  options?: { beforeSaveTow?: () => Promise<void>; duplicateFromTowId?: string }
) {
  const beforeSaveTowRef = useRef(options?.beforeSaveTow)
  beforeSaveTowRef.current = options?.beforeSaveTow
  const duplicateFromTowId = options?.duplicateFromTowId
  const isDuplicateLoad = !!duplicateFromTowId && !editTowId
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, companyId, loading: authLoading } = useAuth()
  
  // UI State
  const [showAssignNowModal, setShowAssignNowModal] = useState(false)
  const [savedTowId, setSavedTowId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dataLoading, setDataLoading] = useState(true)
  const [customersLoading, setCustomersLoading] = useState(true)
  
  // Data from database
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [trucks, setTrucks] = useState<TruckWithDetails[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [preSelectedDriverId, setPreSelectedDriverId] = useState<string | null>(null)
  const [preSelectedTruckId, setPreSelectedTruckId] = useState<string | null>(null)
  const [secondDriverId, setSecondDriverId] = useState<string | null>(null)
  const [secondDriverScheduledAt, setSecondDriverScheduledAt] = useState<string | null>(null)
  
  // Price list
  const [basePriceList, setBasePriceList] = useState<any>(null)
  const [weightBrackets, setWeightBrackets] = useState<WeightBracket[]>([])
  const [fixedPriceItems, setFixedPriceItems] = useState<FixedPriceItem[]>([])
  const [customerIdsWithPersonalPricing, setCustomerIdsWithPersonalPricing] = useState<string[]>([])
  const [selectedCustomerPricing, setSelectedCustomerPricing] = useState<CustomerWithPricing | null>(null)
  
  // Surcharges from database
  const [timeSurchargesData, setTimeSurchargesData] = useState<TimeSurcharge[]>([])
  const [locationSurchargesData, setLocationSurchargesData] = useState<LocationSurcharge[]>([])
  const [serviceSurchargesData, setServiceSurchargesData] = useState<ServiceSurcharge[]>([])
  
  // Selected surcharges
  const [selectedLocationSurcharges, setSelectedLocationSurcharges] = useState<string[]>([])
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])
  // Whole-tow catalog selections (exchange/custom) — parallel to manualSurcharges at tow level.
  const [towServiceSurcharges, setTowServiceSurcharges] = useState<SelectedService[]>([])
  // Manual (ad-hoc) add-on lines — order-only, not from the catalog.
  const [manualSurcharges, setManualSurcharges] = useState<ManualSurcharge[]>([])
  const [isHoliday, setIsHoliday] = useState(false)
  const [activeTimeSurchargesList, setActiveTimeSurchargesList] = useState<TimeSurcharge[]>([])
  const [hasManualTimeSurchargeOverride, setHasManualTimeSurchargeOverride] = useState(false)
  
  // Price selection
  const [priceMode, setPriceMode] = useState<'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'>('recommended')
  const [selectedPriceItem, setSelectedPriceItem] = useState<PriceItem | null>(null)
  const [customPrice, setCustomPrice] = useState<string>('')
  const [customPriceIncludesVat, setCustomPriceIncludesVat] = useState(true)
  const [vatPercent, setVatPercent] = useState<number>(0.18)
  const vatPercentRef = useRef(vatPercent)
  const [manualAdjustmentPercent, setManualAdjustmentPercent] = useState<string>('')
  const [manualAdjustmentType, setManualAdjustmentType] = useState<'discount' | 'markup'>('discount')

  const [customerOrderNumber, setCustomerOrderNumber] = useState('')
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [department, setDepartment] = useState('')
  const [orderedBy, setOrderedBy] = useState('')
  
  // Customer info
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  
  // Date/Time
  const [towDate, setTowDate] = useState('')
  const [towTime, setTowTime] = useState('')
  const [towEndDate, setTowEndDate] = useState('')
  const [towEndTime, setTowEndTime] = useState('')
  const [isToday, setIsToday] = useState(true)
  
  // Tow type
  const [towType, setTowType] = useState<TowType>('')
  // Route Builder state
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  /** Bumped on exchange→custom conversion so RouteBuilder remounts with seeded points. */
  const [routeSeedVersion, setRouteSeedVersion] = useState(0)
  const [customRouteData, setCustomRouteData] = useState<CustomRouteData>({
    totalDistanceKm: 0,
    vehicles: [],
    services: []
  })

  const emptyCustomRouteData = (): CustomRouteData => ({
    totalDistanceKm: 0,
    vehicles: [],
    services: [],
  })

  // Reset route points when the user changes customer (not hydration's first assignment on edit).
  useEffect(() => {
    if (!selectedCustomerId) return
    if (editTowId && prevSelectedCustomerIdRef.current === null) {
      prevSelectedCustomerIdRef.current = selectedCustomerId
      return
    }
    if (prevSelectedCustomerIdRef.current === selectedCustomerId) return
    prevSelectedCustomerIdRef.current = selectedCustomerId
    setRoutePoints([])
  }, [selectedCustomerId, editTowId])

  // Load customer's stored vehicles when customer changes
  useEffect(() => {
    const loadStoredVehicles = async () => {
      if (!companyId || !selectedCustomerId) {
        setCustomerStoredVehicles([])
        setSelectedStoredVehicleId(null)
        return
      }
      
      setStorageLoading(true)
      try {
        const vehicles = await getCustomerStoredVehiclesForDisplay(
          companyId,
          selectedCustomerId
        )
        setCustomerStoredVehicles(vehicles)
      } catch (err) {
        console.error('Error loading stored vehicles:', err)
        setCustomerStoredVehicles([])
      } finally {
        setStorageLoading(false)
      }
    }
    
    loadStoredVehicles()
  }, [companyId, selectedCustomerId])
  
  // Single tow - Vehicle
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [vehicleCode, setVehicleCode] = useState('')
  const [vehicleData, setVehicleData] = useState<VehicleLookupResult | null>(null)
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('')
  const [vehicleLookupNotFound, setVehicleLookupNotFound] = useState(false)
  const [selectedDefects, setSelectedDefects] = useState<string[]>([])
  const [requiredTruckTypes, setRequiredTruckTypes] = useState<string[]>([])
  const [manualManufacturer, setManualManufacturer] = useState('')
  const [manualColor, setManualColor] = useState('')
  const [manualWeight, setManualWeight] = useState('')
  const [manualChassis, setManualChassis] = useState('')
  const [truckTypeError, setTruckTypeError] = useState(false)
  const truckTypeSectionRef = useRef<HTMLDivElement>(null!)
  const isEditMode = useRef(!!editTowId)
  const prevSelectedCustomerIdRef = useRef<string | null>(null)
  const editRouteBaselineRef = useRef<string | null>(null)
  const loadedEditPriceModeRef = useRef<string | null>(null)
  const editSeededDistanceRef = useRef<number | null>(null)
  const editSeededDeadheadRef = useRef<number | null>(null)
  const editSeededExchangeBaseRef = useRef<number | null>(null)
  const editExchangeRouteLayoutRef = useRef<'four_point' | 'hub' | null>(null)
  const editExchangeRouteBaselineRef = useRef<string | null>(null)
  const editExchangePriceBaselineRef = useRef<string | null>(null)
  const editExchangePriceBaselineCapturedRef = useRef(false)
  const editSinglePriceBaselineRef = useRef<string | null>(null)
  const editSinglePriceBaselineCapturedRef = useRef(false)
  const editIsHolidayHydratedRef = useRef(false)
  const [editIsHolidayHydrationSettled, setEditIsHolidayHydrationSettled] = useState(false)
  const [editManualAdjustmentHydrationSettled, setEditManualAdjustmentHydrationSettled] =
    useState(false)
  const [editCustomerPricingHydrationSettled, setEditCustomerPricingHydrationSettled] =
    useState(false)
  const editCustomerPricingHydratedRef = useRef(false)
  const editSelectedPriceItemHydratedRef = useRef(false)
  const [fixedPriceItemsHydrationSettled, setFixedPriceItemsHydrationSettled] = useState(false)
  const [editSelectedPriceItemHydrationSettled, setEditSelectedPriceItemHydrationSettled] =
    useState(false)
  const [editHydrationSettled, setEditHydrationSettled] = useState(false)
  const previousTowTypeRef = useRef<TowType>('')
  const storagePrefillAppliedRef = useRef(false)
  const urlDateTimeInitializedRef = useRef(false)
  const lastUrlDateParamRef = useRef<string | null>(null)
  const lastUrlTimeParamRef = useRef<string | null>(null)
  const deferStorageBaseAddressRef = useRef(false)
  const deferStorageExchangeAddressRef = useRef(false)
  const deferStorageWorkingAddressRef = useRef(false)
  const [pendingStoragePrefill, setPendingStoragePrefill] =
    useState<StoredVehicleWithCustomer | null>(null)
  const [loadedTowStatus, setLoadedTowStatus] = useState<string | null>(null)
  const [editTowSnapshot, setEditTowSnapshot] = useState<EditTowSnapshot | null>(null)
  const [editExistingVehicles, setEditExistingVehicles] = useState<
    { id: string; plateNumber: string; orderIndex: number }[]
  >([])
  const [editExistingPoints, setEditExistingPoints] = useState<
    { id: string; pointOrder: number; pointType: string }[]
  >([])

  // Storage
  const [customerStoredVehicles, setCustomerStoredVehicles] = useState<StoredVehicleWithCustomer[]>([])
  const [selectedStoredVehicleId, setSelectedStoredVehicleId] = useState<string | null>(null)
  const [dropoffToStorage, setDropoffToStorage] = useState(false)
  const [hasStorageFollowUp, setHasStorageFollowUp] = useState(false)
  const [inheritCustomerOrderNumber, setInheritCustomerOrderNumber] = useState(false)
  const [followUpAddress, setFollowUpAddress] = useState<AddressData>({ address: '' })
  const [followUpContactName, setFollowUpContactName] = useState('')
  const [followUpContactPhone, setFollowUpContactPhone] = useState('')
  const [storageVehicleCondition, setStorageVehicleCondition] = useState<'operational' | 'faulty'>('operational')
  const [storageLoading, setStorageLoading] = useState(false)
  const storageTakeOutResolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const [storageTakeOutPrompt, setStorageTakeOutPrompt] = useState<{
    plate: string
    stored: StoredVehicleWithCustomer
    slot: StoredVehicleHydrationSlot
  } | null>(null)

  // Exchange specific state
  const [workingVehicleSource, setWorkingVehicleSource] = useState<'storage' | 'address'>('address')
  const [selectedWorkingVehicleId, setSelectedWorkingVehicleId] = useState<string | null>(null)
  const [workingVehiclePlate, setWorkingVehiclePlate] = useState('')
  const [workingVehicleData, setWorkingVehicleData] = useState<VehicleLookupResult | null>(null)
  const [workingVehicleType, setWorkingVehicleType] = useState<VehicleType | ''>('')
  const [workingVehicleCode, setWorkingVehicleCode] = useState('')
  const [workingVehicleAddress, setWorkingVehicleAddress] = useState<AddressData>({ address: '' })
  const [workingVehicleContact, setWorkingVehicleContact] = useState('')
  const [workingVehicleContactPhone, setWorkingVehicleContactPhone] = useState('')
  
  const [exchangeAddress, setExchangeAddress] = useState<AddressData>({ address: '' })
  const [workingVehicleDestinationAddress, setWorkingVehicleDestinationAddress] = useState<AddressData>({ address: '' })
  const [exchangeContactName, setExchangeContactName] = useState('')
  const [exchangeContactPhone, setExchangeContactPhone] = useState('')
  const [workingDestinationContact, setWorkingDestinationContact] = useState('')
  const [workingDestinationContactPhone, setWorkingDestinationContactPhone] = useState('')
  
  const [defectiveVehiclePlate, setDefectiveVehiclePlate] = useState('')
  const [defectiveVehicleData, setDefectiveVehicleData] = useState<VehicleLookupResult | null>(null)
  const [defectiveVehicleType, setDefectiveVehicleType] = useState<VehicleType | ''>('')
  const [defectiveVehicleCode, setDefectiveVehicleCode] = useState('')
  const [defectiveDestination, setDefectiveDestination] = useState<'storage' | 'address'>('address')
  const [defectiveDestinationAddress, setDefectiveDestinationAddress] = useState<AddressData>({ address: '' })
  const [defectiveDestinationContact, setDefectiveDestinationContact] = useState('')
  const [defectiveDestinationContactPhone, setDefectiveDestinationContactPhone] = useState('')
  
  const [stopsBeforeExchange, setStopsBeforeExchange] = useState<ExchangeRouteStop[]>([])
  const [stopsAfterExchange, setStopsAfterExchange] = useState<ExchangeRouteStop[]>([])
  
  const [exchangeTotalDistance, setExchangeTotalDistance] = useState<DistanceResult | null>(null)
  const [exchangeDistanceLoading, setExchangeDistanceLoading] = useState(false)

  const [hasSecondTruck, setHasSecondTruck] = useState(false)
  const [defectiveTruckTypes, setDefectiveTruckTypes] = useState<string[]>([])
  const [workingVehicleDestinationIsStorage, setWorkingVehicleDestinationIsStorage] = useState(false)
  const [workingVehicleNotFound, setWorkingVehicleNotFound] = useState(false)
  const [workingManualManufacturer, setWorkingManualManufacturer] = useState('')
  const [workingManualColor, setWorkingManualColor] = useState('')
  const [workingManualWeight, setWorkingManualWeight] = useState('')
  const [defectiveVehicleNotFound, setDefectiveVehicleNotFound] = useState(false)
  const [defectiveManualManufacturer, setDefectiveManualManufacturer] = useState('')
  const [defectiveManualColor, setDefectiveManualColor] = useState('')
  const [defectiveManualWeight, setDefectiveManualWeight] = useState('')
  const [defectiveFaultDescription, setDefectiveFaultDescription] = useState('')
  const [workingSelectedServices, setWorkingSelectedServices] = useState<SelectedService[]>([])
  const [defectiveSelectedServices, setDefectiveSelectedServices] = useState<SelectedService[]>([])

  // Single tow - unified route list
  const [routeStops, setRouteStops] = useState<RouteStop[]>(createDefaultRouteStops)

  // Distance
  const [distance, setDistance] = useState<DistanceResult | null>(null)
  const [distanceLoading, setDistanceLoading] = useState(false)
  
  // Start from base
  const [startFromBase, setStartFromBase] = useState(false)
  const [baseToPickupDistance, setBaseToPickupDistance] = useState<DistanceResult | null>(null)
  const [baseToPickupLoading, setBaseToPickupLoading] = useState(false)

  // Deadhead return (נסיעת סרק): last dropoff → base, priced separately
  const [chargeDeadheadReturn, setChargeDeadheadReturn] = useState(false)
  const [dropoffToBaseDistance, setDropoffToBaseDistance] = useState<DistanceResult | null>(null)
  const [dropoffToBaseLoading, setDropoffToBaseLoading] = useState(false)
  
  const [notes, setNotes] = useState('')
  
  // Payment
  const [invoiceName, setInvoiceName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'invoice'>('cash')
  const [creditCardNumber, setCreditCardNumber] = useState('')
  const [creditCardExpiry, setCreditCardExpiry] = useState('')
  const [creditCardCvv, setCreditCardCvv] = useState('')
  const [creditCardId, setCreditCardId] = useState('')
  
  // Pin drop modal
  const [pinDropModal, setPinDropModal] = useState<{ isOpen: boolean; field: string | null }>({ isOpen: false, field: null })
  const [pinDropResult, setPinDropResult] = useState<{ pointId: string; data: AddressData } | null>(null)


  // ==================== Effects ====================
  
  // Load Google Maps
  useEffect(() => { loadGoogleMaps() }, [])

  useEffect(() => {
    vatPercentRef.current = vatPercent
  }, [vatPercent])

  useEffect(() => {
    editRouteBaselineRef.current = null
    loadedEditPriceModeRef.current = null
    editSeededDistanceRef.current = null
    editSeededDeadheadRef.current = null
    editSeededExchangeBaseRef.current = null
    editExchangeRouteLayoutRef.current = null
    editExchangeRouteBaselineRef.current = null
    editExchangePriceBaselineRef.current = null
    editExchangePriceBaselineCapturedRef.current = false
    editSinglePriceBaselineRef.current = null
    editSinglePriceBaselineCapturedRef.current = false
    editIsHolidayHydratedRef.current = false
    editCustomerPricingHydratedRef.current = false
    editSelectedPriceItemHydratedRef.current = false
    setEditIsHolidayHydrationSettled(false)
    setEditManualAdjustmentHydrationSettled(false)
    setEditCustomerPricingHydrationSettled(false)
    setEditSelectedPriceItemHydrationSettled(false)
    setIsHoliday(false)
    setEditHydrationSettled(false)
  }, [editTowId])

  const routeStopsDistanceSignature = routeStopsDistanceSignatureFromStops(routeStops)

  // Calculate distance as ordered multi-leg route chain
  useEffect(() => {
    const waypoints: AddressData[] = routeStops
      .filter((stop) => stop.address.address.trim())
      .map((stop) => stop.address)

    const signatureAtStart = routeStopsDistanceSignature
    const preserveSeededOnFailure = () =>
      !!(
        editTowId &&
        editSeededDistanceRef.current != null &&
        editRouteBaselineRef.current &&
        signatureAtStart === editRouteBaselineRef.current
      )

    if (waypoints.length < 2) {
      if (!preserveSeededOnFailure()) setDistance(null)
      return
    }
    let cancelled = false
    const calc = async () => {
      setDistanceLoading(true)
      try {
        await loadGoogleMaps()
        if (cancelled) return

        let totalKm = 0
        let totalMinutes = 0

        for (let i = 0; i < waypoints.length - 1; i++) {
          const result = await calculateDistance(waypoints[i], waypoints[i + 1])
          if (cancelled) return
          if (!result) {
            if (!preserveSeededOnFailure()) setDistance(null)
            return
          }
          totalKm += result.distanceKm
          totalMinutes += result.durationMinutes
        }

        if (!cancelled) {
          editSeededDistanceRef.current = null
          setDistance({ distanceKm: Math.round(totalKm * 10) / 10, durationMinutes: totalMinutes })
        }
      } catch (err) {
        console.error('Distance calculation error:', err)
        if (!cancelled && !preserveSeededOnFailure()) setDistance(null)
      } finally {
        if (!cancelled) setDistanceLoading(false)
      }
    }
    const timeout = setTimeout(calc, 500)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [routeStopsDistanceSignature])

  // After edit hydration settles, only user route edits switch to live recommended pricing
  useEffect(() => {
    if (!editTowId || towType !== 'single' || !editHydrationSettled) return
    if (!editRouteBaselineRef.current) return

    const loadedMode = loadedEditPriceModeRef.current
    if (
      loadedMode === 'custom' ||
      loadedMode === 'fixed' ||
      loadedMode === 'customer'
    ) {
      return
    }
    if (priceMode !== 'recommended' && priceMode !== 'recommended_customer') {
      return
    }

    if (routeStopsDistanceSignature !== editRouteBaselineRef.current) {
      editSeededDistanceRef.current = null
      setPriceMode((prev) => {
        if (prev === 'recommended' || prev === 'recommended_customer') {
          return prev
        }
        if (loadedEditPriceModeRef.current === 'recommended_customer') {
          return 'recommended_customer'
        }
        return 'recommended'
      })
      editRouteBaselineRef.current = routeStopsDistanceSignature
    }
  }, [editTowId, towType, editHydrationSettled, routeStopsDistanceSignature, priceMode])

  // Edit-only: restore isHoliday from saved breakdown (catalog id → day_type === 'holiday')
  useEffect(() => {
    if (!editTowId) return
    if (editIsHolidayHydratedRef.current) return
    const breakdown = editTowSnapshot?.price_breakdown
    if (!breakdown) {
      editIsHolidayHydratedRef.current = true
      setEditIsHolidayHydrationSettled(true)
      return
    }

    if (timeSurchargesData.length === 0) return

    const needsCustomerPricing =
      !!selectedCustomerId &&
      (priceMode === 'recommended_customer' || priceMode === 'recommended')
    if (needsCustomerPricing && !selectedCustomerPricing) return

    const customerCatalog =
      priceMode === 'recommended_customer' &&
      (selectedCustomerPricing?.customer_time_surcharges?.length ?? 0) > 0
        ? selectedCustomerPricing!.customer_time_surcharges!
        : []

    if (inferIsHolidayFromSavedBreakdown(breakdown, [timeSurchargesData, customerCatalog])) {
      setIsHoliday(true)
    }
    editIsHolidayHydratedRef.current = true
    setEditIsHolidayHydrationSettled(true)
  }, [
    editTowId,
    editTowSnapshot,
    timeSurchargesData,
    selectedCustomerPricing,
    selectedCustomerId,
    priceMode,
  ])

  // Edit-only: wait for async customer pricing before baseline capture (recommended + recommended_customer)
  useEffect(() => {
    if (!editTowId) return
    if (editCustomerPricingHydratedRef.current) return
    if (!selectedCustomerId) {
      editCustomerPricingHydratedRef.current = true
      setEditCustomerPricingHydrationSettled(true)
      return
    }
    if (!selectedCustomerPricing) return
    editCustomerPricingHydratedRef.current = true
    setEditCustomerPricingHydrationSettled(true)
  }, [editTowId, selectedCustomerId, selectedCustomerPricing])

  // Edit-only: restore fixed/customer catalog price item after pricing lists are available
  useEffect(() => {
    if (!editTowId || !editHydrationSettled) return
    if (editSelectedPriceItemHydratedRef.current) return

    const source = editTowSnapshot?.price_breakdown?.selected_price_item_source
    const itemId = editTowSnapshot?.price_breakdown?.selected_price_item_id

    if (source !== 'fixed' && source !== 'customer') {
      editSelectedPriceItemHydratedRef.current = true
      setEditSelectedPriceItemHydrationSettled(true)
      return
    }

    if (source === 'customer' && !editCustomerPricingHydrationSettled) return
    if (source === 'fixed' && !fixedPriceItemsHydrationSettled) return

    if (!itemId) {
      editSelectedPriceItemHydratedRef.current = true
      setEditSelectedPriceItemHydrationSettled(true)
      return
    }

    let item: PriceItem | null = null
    if (source === 'fixed') {
      const found = fixedPriceItems.find((i) => i.id === itemId)
      if (found) {
        item = { id: found.id, label: found.label, price: found.price }
      }
    } else {
      const found = selectedCustomerPricing?.price_items?.find((i) => i.id === itemId)
      if (found) {
        item = { id: found.id, label: found.label, price: found.price }
      }
    }

    if (!item) {
      item = {
        id: itemId,
        label: '(פריט לא זמין)',
        price: editTowSnapshot?.final_price ?? 0,
      }
    }

    setSelectedPriceItem(item)
    editSelectedPriceItemHydratedRef.current = true
    setEditSelectedPriceItemHydrationSettled(true)
  }, [
    editTowId,
    editHydrationSettled,
    editTowSnapshot,
    editCustomerPricingHydrationSettled,
    fixedPriceItemsHydrationSettled,
    fixedPriceItems,
    selectedCustomerPricing,
  ])

  // Capture exchange edit price-affecting baseline once after hydration settles
  useEffect(() => {
    if (!editTowId || towType !== 'exchange' || !editHydrationSettled) return
    if (!editManualAdjustmentHydrationSettled) return
    if (!editCustomerPricingHydrationSettled) return
    if (!editSelectedPriceItemHydrationSettled) return
    if (editExchangePriceBaselineCapturedRef.current) return
    if (!towDate || !towTime) return

    const manualAdj = parseFloat(manualAdjustmentPercent ?? '') || 0
    editExchangePriceBaselineRef.current = buildExchangePriceAffectingSignature({
      exchangeRouteLayout: editExchangeRouteLayoutRef.current,
      workingVehicleSourceAddress: workingVehicleAddress,
      workingVehicleDestinationAddress,
      exchangePointAddress: exchangeAddress,
      defectiveDestinationAddress,
      stopsBeforeExchange,
      stopsAfterExchange,
      workingVehicleType: workingVehicleType || undefined,
      defectiveVehicleType: defectiveVehicleType || undefined,
      workingManualWeight,
      defectiveManualWeight,
      priceMode,
      selectedLocationSurcharges,
      workingSelectedServices,
      defectiveSelectedServices,
      towServiceSurcharges,
      activeTimeSurchargeIds: activeTimeSurchargesList.map((s) => s.id),
      timeSurchargesData,
      isHoliday,
      hasManualTimeSurchargeOverride,
      manualAdjustmentPercent:
        manualAdjustmentType === 'discount' ? -manualAdj : manualAdj,
      manualSurcharges,
      towDate,
      towTime,
      selectedPriceItemId: selectedPriceItem?.id ?? null,
    })
    editExchangePriceBaselineCapturedRef.current = true
  }, [
    editTowId,
    towType,
    editHydrationSettled,
    editManualAdjustmentHydrationSettled,
    editCustomerPricingHydrationSettled,
    editSelectedPriceItemHydrationSettled,
    towDate,
    towTime,
    workingVehicleAddress,
    workingVehicleDestinationAddress,
    exchangeAddress,
    defectiveDestinationAddress,
    stopsBeforeExchange,
    stopsAfterExchange,
    workingVehicleType,
    defectiveVehicleType,
    workingManualWeight,
    defectiveManualWeight,
    priceMode,
    selectedLocationSurcharges,
    workingSelectedServices,
    defectiveSelectedServices,
    towServiceSurcharges,
    activeTimeSurchargesList,
    timeSurchargesData,
    isHoliday,
    hasManualTimeSurchargeOverride,
    manualAdjustmentPercent,
    manualAdjustmentType,
    manualSurcharges,
    selectedPriceItem,
  ])

  // Capture single-tow edit price-affecting baseline once after hydration + isHoliday restore
  useEffect(() => {
    if (!editTowId || towType !== 'single' || !editHydrationSettled) return
    if (!editManualAdjustmentHydrationSettled) return
    if (!editCustomerPricingHydrationSettled) return
    if (!editSelectedPriceItemHydrationSettled) return
    if (editSinglePriceBaselineCapturedRef.current) return
    if (!editIsHolidayHydrationSettled) return
    if (!towDate || !towTime) return
    if (!editRouteBaselineRef.current) return
    if (routeStopsDistanceSignature !== editRouteBaselineRef.current) return

    const manualAdj = parseFloat(manualAdjustmentPercent ?? '') || 0
    editSinglePriceBaselineRef.current = buildSinglePriceAffectingSignature({
      routeStops: routeStops.map((s) => ({
        id: s.id,
        role: s.role,
        stopSubtype: s.stopSubtype,
        address: s.address,
        contactName: s.contactName,
        contactPhone: s.contactPhone,
        notes: s.notes,
        orderNotes: s.orderNotes,
      })),
      startFromBase,
      vehicleType: vehicleType || undefined,
      manualWeight,
      priceMode,
      customerId: selectedCustomerId,
      discountPercent:
        editTowSnapshot?.price_breakdown?.discount_percent ??
        selectedCustomerPricing?.discount_percent ??
        0,
      selectedLocationSurcharges,
      selectedServices,
      activeTimeSurchargeIds: activeTimeSurchargesList.map((s) => s.id),
      timeSurchargesData,
      selectedCustomerPricing,
      isHoliday,
      hasManualTimeSurchargeOverride,
      manualAdjustmentPercent:
        manualAdjustmentType === 'discount' ? -manualAdj : manualAdj,
      manualSurcharges,
      towDate,
      towTime,
      customPrice: parseFloat(customPrice ?? '') || 0,
      customPriceIncludesVat,
      selectedPriceItemId: selectedPriceItem?.id ?? null,
    })
    editSinglePriceBaselineCapturedRef.current = true
  }, [
    editTowId,
    towType,
    editHydrationSettled,
    editManualAdjustmentHydrationSettled,
    editCustomerPricingHydrationSettled,
    editSelectedPriceItemHydrationSettled,
    editIsHolidayHydrationSettled,
    editTowSnapshot,
    towDate,
    towTime,
    routeStops,
    routeStopsDistanceSignature,
    startFromBase,
    vehicleType,
    manualWeight,
    priceMode,
    selectedCustomerId,
    selectedCustomerPricing,
    selectedLocationSurcharges,
    selectedServices,
    activeTimeSurchargesList,
    timeSurchargesData,
    isHoliday,
    hasManualTimeSurchargeOverride,
    manualAdjustmentPercent,
    manualAdjustmentType,
    manualSurcharges,
    customPrice,
    customPriceIncludesVat,
    selectedPriceItem,
  ])

  // Calculate base to pickup distance
  useEffect(() => {
    const pickup = findPickupRouteStop(routeStops)
    if (!startFromBase || !pickup?.address.address || !basePriceList?.base_lat || !basePriceList?.base_lng) {
      setBaseToPickupDistance(null)
      return
    }
    let cancelled = false
    const calcBaseDistance = async () => {
      setBaseToPickupLoading(true)
      try {
        await loadGoogleMaps()
        if (cancelled) return
        const baseAddress: AddressData = {
          address: basePriceList.base_address || '',
          lat: basePriceList.base_lat,
          lng: basePriceList.base_lng
        }
        const result = await calculateDistance(baseAddress, pickup.address)
        if (!cancelled) setBaseToPickupDistance(result)
      } catch (err) {
        console.error('Base distance calculation error:', err)
        if (!cancelled) setBaseToPickupDistance(null)
      } finally {
        if (!cancelled) setBaseToPickupLoading(false)
      }
    }
    const timeout = setTimeout(calcBaseDistance, 500)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [startFromBase, routeStops, basePriceList?.base_lat, basePriceList?.base_lng])


  // Calculate exchange total distance
  useEffect(() => {
    if (!workingVehicleAddress.address || !exchangeAddress.address || !defectiveDestinationAddress.address) {
      if (
        !(
          editTowId &&
          editSeededDistanceRef.current != null &&
          editExchangeRouteBaselineRef.current
        )
      ) {
        setExchangeTotalDistance(null)
      }
      return
    }

    const signatureAtStart = exchangeRouteDistanceSignatureFromAddresses(
      workingVehicleAddress,
      workingVehicleDestinationAddress,
      exchangeAddress,
      defectiveDestinationAddress,
      editTowId ? editExchangeRouteLayoutRef.current : null
    )
    const preserveSeededOnFailure = () =>
      !!(
        editTowId &&
        editSeededDistanceRef.current != null &&
        editExchangeRouteBaselineRef.current &&
        signatureAtStart === editExchangeRouteBaselineRef.current
      )

    const calcExchangeDistance = async () => {
      setExchangeDistanceLoading(true)
      try {
        await loadGoogleMaps()
        const waypoints = buildExchangeDistanceWaypoints(
          editTowId ? editExchangeRouteLayoutRef.current : null,
          !!editTowId,
          workingVehicleAddress,
          workingVehicleDestinationAddress,
          exchangeAddress,
          defectiveDestinationAddress,
          stopsBeforeExchange,
          stopsAfterExchange
        )
        let totalKm = 0
        let totalMinutes = 0
        for (let i = 0; i < waypoints.length - 1; i++) {
          const result = await calculateDistance(waypoints[i], waypoints[i + 1])
          if (!result) {
            if (!preserveSeededOnFailure()) setExchangeTotalDistance(null)
            return
          }
          totalKm += result.distanceKm
          totalMinutes += result.durationMinutes
        }
        editSeededDistanceRef.current = null
        setExchangeTotalDistance({
          distanceKm: Math.round(totalKm * 10) / 10,
          durationMinutes: totalMinutes,
        })
      } catch (err) {
        console.error('Exchange distance calculation error:', err)
        if (!preserveSeededOnFailure()) setExchangeTotalDistance(null)
      } finally {
        setExchangeDistanceLoading(false)
      }
    }
    const timeout = setTimeout(calcExchangeDistance, 500)
    return () => clearTimeout(timeout)
  }, [
    editTowId,
    workingVehicleAddress.address,
    workingVehicleAddress.lat,
    workingVehicleAddress.lng,
    workingVehicleDestinationAddress.address,
    workingVehicleDestinationAddress.lat,
    workingVehicleDestinationAddress.lng,
    exchangeAddress.address,
    exchangeAddress.lat,
    exchangeAddress.lng,
    defectiveDestinationAddress.address,
    defectiveDestinationAddress.lat,
    defectiveDestinationAddress.lng,
    stopsBeforeExchange,
    stopsAfterExchange,
  ])

  // Calculate last dropoff → base distance (deadhead / נסיעת סרק).
  // Mirrors the base-to-pickup effect, but in reverse: final dropoff back to base.
  useEffect(() => {
    const preserveSeededDeadhead = () =>
      !!(editTowId && editSeededDeadheadRef.current != null)

    if (!chargeDeadheadReturn || !basePriceList?.base_lat || !basePriceList?.base_lng) {
      if (!preserveSeededDeadhead()) setDropoffToBaseDistance(null)
      return
    }

    // Resolve the final dropoff for the active flow.
    let lastDropoff: AddressData | undefined
    if (towType === 'exchange') {
      const waypoints = buildExchangeDistanceWaypoints(
        editTowId ? editExchangeRouteLayoutRef.current : null,
        !!editTowId,
        workingVehicleAddress,
        workingVehicleDestinationAddress,
        exchangeAddress,
        defectiveDestinationAddress,
        stopsBeforeExchange,
        stopsAfterExchange
      )
      lastDropoff = waypoints[waypoints.length - 1]
    } else if (towType === 'custom') {
      // TODO(deadhead): custom routes compute distance in RouteBuilder; wire last point → base later.
      if (!preserveSeededDeadhead()) setDropoffToBaseDistance(null)
      return
    } else {
      lastDropoff = findDropoffRouteStop(routeStops)?.address
    }

    if (!lastDropoff?.address) {
      if (!preserveSeededDeadhead()) setDropoffToBaseDistance(null)
      return
    }

    let cancelled = false
    const calcDeadheadDistance = async () => {
      setDropoffToBaseLoading(true)
      try {
        await loadGoogleMaps()
        if (cancelled) return
        const baseAddress: AddressData = {
          address: basePriceList.base_address || '',
          lat: basePriceList.base_lat,
          lng: basePriceList.base_lng,
        }
        const result = await calculateDistance(lastDropoff!, baseAddress)
        if (!cancelled) {
          editSeededDeadheadRef.current = null
          setDropoffToBaseDistance(result)
        }
      } catch (err) {
        console.error('Deadhead distance calculation error:', err)
        if (!cancelled && !preserveSeededDeadhead()) setDropoffToBaseDistance(null)
      } finally {
        if (!cancelled) setDropoffToBaseLoading(false)
      }
    }
    const timeout = setTimeout(calcDeadheadDistance, 500)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [
    chargeDeadheadReturn,
    towType,
    routeStops,
    basePriceList?.base_lat,
    basePriceList?.base_lng,
    basePriceList?.base_address,
    editTowId,
    workingVehicleAddress.address,
    workingVehicleAddress.lat,
    workingVehicleAddress.lng,
    workingVehicleDestinationAddress.address,
    workingVehicleDestinationAddress.lat,
    workingVehicleDestinationAddress.lng,
    exchangeAddress.address,
    exchangeAddress.lat,
    exchangeAddress.lng,
    defectiveDestinationAddress.address,
    defectiveDestinationAddress.lat,
    defectiveDestinationAddress.lng,
    stopsBeforeExchange,
    stopsAfterExchange,
  ])
  // Read URL params or set defaults once on create (never clobber user-picked date/time)
  useEffect(() => {
    if (editTowId) return

    const dateParam = searchParams.get('date')
    const timeParam = searchParams.get('time')
    const driverParam = searchParams.get('driver')

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format

    if (dateParam) {
      if (!urlDateTimeInitializedRef.current || dateParam !== lastUrlDateParamRef.current) {
        setTowDate(dateParam)
        setIsToday(dateParam === today)
        lastUrlDateParamRef.current = dateParam
      }
    } else if (!urlDateTimeInitializedRef.current) {
      setTowDate(today)
      setIsToday(true)
      lastUrlDateParamRef.current = null
    }

    if (timeParam) {
      if (!urlDateTimeInitializedRef.current || timeParam !== lastUrlTimeParamRef.current) {
        setTowTime(timeParam)
        lastUrlTimeParamRef.current = timeParam
      }
    } else if (!urlDateTimeInitializedRef.current) {
      setTowTime(currentTime)
      lastUrlTimeParamRef.current = null
    }

    if (driverParam) setPreSelectedDriverId(driverParam)

    urlDateTimeInitializedRef.current = true
  }, [searchParams, editTowId])

  // Load data
  useEffect(() => {
    if (authLoading) return
    if (!companyId) return
    loadData()
  }, [companyId, authLoading])

  // Load stored vehicle for storage → tow deep link (customer only until towType chosen)
  useEffect(() => {
    if (editTowId || isEditMode.current) return

    const storedVehicleId = searchParams.get('storedVehicle')
    if (!storedVehicleId || !companyId) return

    let cancelled = false

    const loadStoredVehicleForPrefill = async () => {
      try {
        const vehicle = await getStoredVehicleById(companyId, storedVehicleId)
        if (cancelled) return
        if (!vehicle) {
          console.error(
            '[storage prefill] stored vehicle not found:',
            storedVehicleId
          )
          return
        }
        if (vehicle.current_status !== 'stored') {
          console.error(
            '[storage prefill] vehicle is not in stored status:',
            vehicle.current_status
          )
          return
        }
        setPendingStoragePrefill(vehicle)
        if (vehicle.customer_id) {
          const customerJoin = (vehicle as { customer?: { phone?: string | null } })
            .customer
          handleCustomerSelect(
            vehicle.customer_id,
            vehicle.customer_name || '',
            customerJoin?.phone || ''
          )
        }
      } catch (err) {
        console.error('[storage prefill] failed to load stored vehicle:', err)
      }
    }

    loadStoredVehicleForPrefill()
    return () => {
      cancelled = true
    }
  }, [companyId, editTowId, searchParams])

  // Defer yard/base address until basePriceList loads
  useEffect(() => {
    if (!basePriceList?.base_address) return
    if (
      !deferStorageBaseAddressRef.current &&
      !deferStorageExchangeAddressRef.current &&
      !deferStorageWorkingAddressRef.current
    ) {
      return
    }
    const baseAddr: AddressData = {
      address: basePriceList.base_address,
      lat: basePriceList.base_lat,
      lng: basePriceList.base_lng,
    }
    if (deferStorageBaseAddressRef.current) {
      setRouteStops((prev) => {
        const pickupId = findPickupRouteStop(prev)?.id
        if (!pickupId) return prev
        return prev.map((s) => (s.id === pickupId ? { ...s, address: baseAddr } : s))
      })
      deferStorageBaseAddressRef.current = false
    }
    if (deferStorageWorkingAddressRef.current) {
      setWorkingVehicleAddress(baseAddr)
      deferStorageWorkingAddressRef.current = false
    }
    if (deferStorageExchangeAddressRef.current) {
      setExchangeAddress(baseAddr)
      deferStorageExchangeAddressRef.current = false
    }
  }, [basePriceList])

  // Load existing tow for editing or duplicating (duplicate keeps editTowId falsy)
  useEffect(() => {
    const sourceTowId = editTowId ?? duplicateFromTowId
    if (!sourceTowId || !companyId) return
    const loadTowForEdit = async () => {
      if (editTowId) {
        setEditHydrationSettled(false)
        editRouteBaselineRef.current = null
        editSeededDistanceRef.current = null
        editSeededDeadheadRef.current = null
        editSeededExchangeBaseRef.current = null
        editExchangePriceBaselineRef.current = null
        editExchangePriceBaselineCapturedRef.current = false
        editSinglePriceBaselineRef.current = null
        editSinglePriceBaselineCapturedRef.current = false
        editIsHolidayHydratedRef.current = false
        setEditIsHolidayHydrationSettled(false)
        setEditManualAdjustmentHydrationSettled(false)
        setEditCustomerPricingHydrationSettled(false)
        editCustomerPricingHydratedRef.current = false
      }
      try {
        const tow = await getTowWithPoints(sourceTowId)
        if (!tow) return
        if (editTowId) {
          setLoadedTowStatus(tow.status)
          setEditExistingVehicles(
            (tow.vehicles ?? []).map((v, i) => ({
              id: v.id,
              plateNumber: v.plate_number,
              orderIndex: v.order_index ?? i,
            }))
          )
          setEditExistingPoints(
            (tow.points ?? []).map((p) => ({
              id: p.id,
              pointOrder: p.point_order,
              pointType: p.point_type,
            }))
          )
          setEditTowSnapshot({
            final_price: tow.final_price,
            payment_method: tow.payment_method,
            notes: tow.notes,
            scheduled_at: tow.scheduled_at,
            price_breakdown: tow.price_breakdown,
          })
        }
        // Customer
        setSelectedCustomerId(tow.customer_id)
        setCustomerName(tow.customer?.name || '')
        setCustomerPhone(tow.customer?.phone || '')
        setCustomerEmail(tow.customer?.email || '')
        setCustomerAddress(tow.customer?.address || '')
        // Date/Time
        if (editTowId) {
          if (tow.scheduled_at) {
            const d = new Date(tow.scheduled_at)
            const hydratedDate = d.toISOString().split('T')[0]
            setTowDate(hydratedDate)
            setTowTime(d.toTimeString().slice(0, 5))
          }
          if (tow.scheduled_end_at) {
            const end = new Date(tow.scheduled_end_at)
            setTowEndDate(end.toISOString().split('T')[0])
            setTowEndTime(end.toTimeString().slice(0, 5))
          } else {
            setTowEndDate('')
            setTowEndTime('')
          }
        }
        if (editTowId) {
          if (tow.driver_id) {
            setPreSelectedDriverId(tow.driver_id)
          }
          if (tow.truck_id) {
            setPreSelectedTruckId(tow.truck_id)
          }
        }
        // Type
        const towTypeMap: Record<string, TowType> = {
          'simple': 'single',
          'with_base': 'single',
          'transfer': 'custom',
          'multi_vehicle': 'custom',
          'exchange': 'exchange',
        }
        setTowType(towTypeMap[tow.tow_type] || 'single')
        // Notes
        setNotes(tow.notes || '')
        // Price mode (duplicate: recompute amount at new datetime; edit: also preserve custom total)
        if (editTowId) {
          const storedRawAmount = tow.price_breakdown?.custom_price_amount
          if (storedRawAmount != null) {
            setCustomPrice(String(storedRawAmount))
          } else {
            const includesVat = tow.price_breakdown?.custom_price_includes_vat ?? true
            const savedFinalPrice = tow.final_price ?? 0
            const fallbackAmount = includesVat
              ? savedFinalPrice
              : savedFinalPrice / (1 + vatPercentRef.current)
            setCustomPrice(String(fallbackAmount))
          }
          setCustomPriceIncludesVat(tow.price_breakdown?.custom_price_includes_vat ?? true)
          loadedEditPriceModeRef.current = tow.price_mode || 'custom'
        }
        const loadedMode = String(tow.price_mode || 'custom')
        if (loadedMode === 'recommended_customer') {
          setPriceMode('recommended_customer')
        } else if (loadedMode === 'recommended') {
          setPriceMode('recommended')
        } else if (loadedMode === 'fixed') {
          setPriceMode('fixed')
        } else if (loadedMode === 'customer') {
          setPriceMode('customer')
        } else {
          setPriceMode('custom')
        }
        setCustomerOrderNumber(tow.customer_order_number || '')
        if (editTowId) {
          setOrderNumber(tow.order_number || null)
        }
        setDepartment(tow.department || '')
        setOrderedBy(tow.ordered_by || '')
        // Payment
        setPaymentMethod((tow as any).payment_method || 'cash')
        setInvoiceName((tow as any).invoice_name || '')
        setStartFromBase(tow.start_from_base || false)
        setDropoffToStorage(tow.dropoff_to_storage || false)
        // Required truck types
        if (tow.required_truck_types) {
          setRequiredTruckTypes(tow.required_truck_types as string[])
        }
        // Selected services from price breakdown (ad-hoc manual lines are handled separately so
        // they are not mistaken for catalog selections and dropped on re-save).
        if (tow.price_breakdown?.service_surcharges?.length) {
          const catalogLines = excludeTowLevelServices(
            tow.price_breakdown.service_surcharges.filter(
              (s: { is_ad_hoc?: boolean }) => s.is_ad_hoc !== true
            )
          )
          setSelectedServices(
            catalogLines.map((s: { id: string; price: number; units?: number; amount: number }) => ({
              id: s.id,
              quantity: s.units,
              manualPrice: s.units === undefined && s.amount !== s.price ? s.amount : undefined
            }))
          )
          setTowServiceSurcharges(extractTowLevelServices(tow.price_breakdown.service_surcharges))
          setManualSurcharges(extractManualSurcharges(tow.price_breakdown.service_surcharges))
        } else {
          setSelectedServices([])
          setTowServiceSurcharges([])
          setManualSurcharges([])
        }

        // Selected location surcharges from price breakdown
        setSelectedLocationSurcharges(
          (tow.price_breakdown?.location_surcharges ?? []).map((s: { id: string }) => s.id)
        )

        if (tow.tow_type === 'exchange') {
          const vehicles = tow.vehicles ?? []
          const working = vehicles.find((v: any) => v.is_working === true)
          const defective = vehicles.find((v: any) => v.is_working === false)

          setWorkingVehiclePlate(working?.plate_number ?? '')
          setWorkingVehicleCode((working as any)?.vehicle_code ?? '')
          setDefectiveVehiclePlate(defective?.plate_number ?? '')
          setDefectiveVehicleCode((defective as any)?.vehicle_code ?? '')
          setSelectedDefects((defective?.tow_reason ?? '').split(', ').filter(Boolean))
          setDefectiveFaultDescription(defective?.tow_reason ?? '')

          if (editTowId || isDuplicateLoad) {
            hydrateExchangeVehicleFromTowRow(working as TowVehicleEditRow | undefined, {
              setVehicleType: setWorkingVehicleType,
              setVehicleData: setWorkingVehicleData,
              setVehicleNotFound: setWorkingVehicleNotFound,
              setManualManufacturer: setWorkingManualManufacturer,
              setManualColor: setWorkingManualColor,
              setManualWeight: setWorkingManualWeight,
            })
            hydrateExchangeVehicleFromTowRow(defective as TowVehicleEditRow | undefined, {
              setVehicleType: setDefectiveVehicleType,
              setVehicleData: setDefectiveVehicleData,
              setVehicleNotFound: setDefectiveVehicleNotFound,
              setManualManufacturer: setDefectiveManualManufacturer,
              setManualColor: setDefectiveManualColor,
              setManualWeight: setDefectiveManualWeight,
            })
          } else {
            setWorkingVehicleType((working?.vehicle_type as VehicleType) ?? '')
            setDefectiveVehicleType((defective?.vehicle_type as VehicleType) ?? '')
          }

          const sortedPoints = [...(tow.points ?? [])].sort(
            (a: any, b: any) => a.point_order - b.point_order
          )
          const pointToAddressData = (p: any): AddressData => ({
            address: p.address || '',
            lat: p.lat ? Number(p.lat) : undefined,
            lng: p.lng ? Number(p.lng) : undefined,
          })
          const linksOnlyWorking = (p: any) => {
            const vehs = (p.vehicles ?? []).map((pv: any) => pv.vehicle).filter(Boolean)
            return vehs.length > 0 && vehs.every((v: any) => v.is_working === true)
          }
          const linksDefective = (p: any) => {
            const vehs = (p.vehicles ?? []).map((pv: any) => pv.vehicle).filter(Boolean)
            return vehs.length > 0 && vehs.every((v: any) => v.is_working === false)
          }

          const hasExchangeHub = sortedPoints.some((p: any) => p.point_type === 'exchange')
          let exchangeRouteLayout: 'four_point' | 'hub' = 'hub'
          let sigWorking: AddressData = { address: '' }
          let sigWorkingDest: AddressData = { address: '' }
          let sigExchange: AddressData = { address: '' }
          let sigDefective: AddressData = { address: '' }

          if (hasExchangeHub) {
            exchangeRouteLayout = 'hub'
            const workingSource = sortedPoints.find(
              (p: any) => p.point_type === 'pickup' && linksOnlyWorking(p)
            )
            const exchangeHub = sortedPoints.find((p: any) => p.point_type === 'exchange')
            const defectiveDest = sortedPoints.find(
              (p: any) => p.point_type === 'dropoff' && linksDefective(p)
            )
            const workingDest = sortedPoints.find(
              (p: any) => p.point_type === 'dropoff' && linksOnlyWorking(p)
            )

            if (workingSource) {
              sigWorking = pointToAddressData(workingSource)
              setWorkingVehicleAddress(sigWorking)
              setWorkingVehicleContact(workingSource.contact_name || '')
              setWorkingVehicleContactPhone(workingSource.contact_phone || '')
              if (workingSource.is_storage) {
                setWorkingVehicleSource('storage')
              }
            }
            if (exchangeHub) {
              sigExchange = pointToAddressData(exchangeHub)
              setExchangeAddress(sigExchange)
              setExchangeContactName(exchangeHub.contact_name || '')
              setExchangeContactPhone(exchangeHub.contact_phone || '')
            }
            if (defectiveDest) {
              sigDefective = pointToAddressData(defectiveDest)
              setDefectiveDestinationAddress(sigDefective)
              setDefectiveDestinationContact(defectiveDest.contact_name || '')
              setDefectiveDestinationContactPhone(defectiveDest.contact_phone || '')
            }
            if (workingDest) {
              sigWorkingDest = pointToAddressData(workingDest)
              setWorkingVehicleDestinationAddress(sigWorkingDest)
              setWorkingDestinationContact(workingDest.contact_name || '')
              setWorkingDestinationContactPhone(workingDest.contact_phone || '')
              if (workingDest.is_storage) {
                setWorkingVehicleDestinationIsStorage(true)
              }
            }
            if (defectiveDest?.is_storage) {
              setDefectiveDestination('storage')
            }
          } else if (sortedPoints.length === 4) {
            exchangeRouteLayout = 'four_point'
            const [p0, p1, p2, p3] = sortedPoints
            sigWorking = pointToAddressData(p0)
            sigWorkingDest = pointToAddressData(p1)
            sigExchange = pointToAddressData(p2)
            sigDefective = pointToAddressData(p3)
            setWorkingVehicleAddress(sigWorking)
            setWorkingVehicleContact(p0.contact_name || '')
            setWorkingVehicleContactPhone(p0.contact_phone || '')
            setWorkingVehicleDestinationAddress(sigWorkingDest)
            setWorkingDestinationContact(p1.contact_name || '')
            setWorkingDestinationContactPhone(p1.contact_phone || '')
            setExchangeAddress(sigExchange)
            setExchangeContactName(p2.contact_name || '')
            setExchangeContactPhone(p2.contact_phone || '')
            setDefectiveDestinationAddress(sigDefective)
            setDefectiveDestinationContact(p3.contact_name || '')
            setDefectiveDestinationContactPhone(p3.contact_phone || '')
            if (p0.is_storage) {
              setWorkingVehicleSource('storage')
            }
            if (p1.is_storage) {
              setWorkingVehicleDestinationIsStorage(true)
            }
            if (p3.is_storage) {
              setDefectiveDestination('storage')
            }
          }

          if (editTowId) {
            editExchangeRouteLayoutRef.current = exchangeRouteLayout
            editExchangeRouteBaselineRef.current = exchangeRouteDistanceSignatureFromAddresses(
              sigWorking,
              sigWorkingDest,
              sigExchange,
              sigDefective,
              exchangeRouteLayout
            )
            if (
              loadedMode === 'recommended' ||
              loadedMode === 'recommended_customer'
            ) {
              const savedKm = Number(tow.price_breakdown?.distance_km ?? 0)
              if (savedKm > 0) {
                editSeededDistanceRef.current = savedKm
                setExchangeTotalDistance({ distanceKm: savedKm, durationMinutes: 0 })
              }
              const savedBase = Number(tow.price_breakdown?.base_price ?? 0)
              if (savedBase > 0) {
                editSeededExchangeBaseRef.current = savedBase
              }
            }
          }

          const mapExchangeService = (s: {
            id: string
            price: number
            units?: number
            amount: number
            vehicle_role?: string
          }) => ({
            id: s.id,
            quantity: s.units,
            manualPrice: s.units === undefined && s.amount !== s.price ? s.amount : undefined,
          })
          const serviceSurcharges = (tow.price_breakdown?.service_surcharges ?? []).filter(
            (s: { is_ad_hoc?: boolean }) => s.is_ad_hoc !== true
          )
          setWorkingSelectedServices(
            serviceSurcharges
              .filter((s: any) => s.vehicle_role === 'working')
              .map(mapExchangeService)
          )
          setDefectiveSelectedServices(
            serviceSurcharges
              .filter((s: any) => s.vehicle_role === 'defective')
              .map(mapExchangeService)
          )
          setSelectedServices([])
          // Ad-hoc lines carry no vehicle_role; keep them as order-level manual add-ons.
          setManualSurcharges(extractManualSurcharges(tow.price_breakdown?.service_surcharges))
        } else {
          // Single tow - vehicle (tow_vehicles row wins over point junction for full columns)
          const vehicleFromPoints = tow.points
            ?.flatMap((p: any) => p.vehicles || [])
            ?.find((pv: any) => pv.vehicle)?.vehicle as TowVehicleEditRow | undefined
          const vehicleFromTow = [...(tow.vehicles ?? [])].sort(
            (a: { order_index?: number | null }, b: { order_index?: number | null }) =>
              (a.order_index ?? 0) - (b.order_index ?? 0)
          )[0] as TowVehicleEditRow | undefined
          const firstVehicle: TowVehicleEditRow | undefined =
            vehicleFromTow || vehicleFromPoints
              ? { ...vehicleFromPoints, ...vehicleFromTow }
              : undefined

          if (firstVehicle?.plate_number) {
            setVehiclePlate(firstVehicle.plate_number || '')
            setVehicleCode(firstVehicle.vehicle_code || '')

            setSelectedDefects(
              (firstVehicle.tow_reason || '')
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            )

            if (isManualCommercialVehicle(firstVehicle)) {
              setVehicleType('van' as VehicleType)
              setVehicleData(null)
              setVehicleLookupNotFound(true)
              setManualManufacturer(firstVehicle.manufacturer || '')
              setManualColor(firstVehicle.color || '')
              setManualWeight(
                firstVehicle.total_weight != null
                  ? String(firstVehicle.total_weight)
                  : ''
              )
              setManualChassis(firstVehicle.chassis || '')
            } else {
              const savedType = (firstVehicle.vehicle_type || '') as VehicleType | ''
              setVehicleType(savedType)

              const lookupResult = buildVehicleLookupResultFromTowVehicle(firstVehicle)
              if (lookupResult) {
                setVehicleData(lookupResult)
                setVehicleLookupNotFound(false)
                if (!savedType && lookupResult.source) {
                  setVehicleType(lookupResult.source)
                }
                setManualManufacturer('')
                setManualColor('')
                setManualWeight('')
                setManualChassis('')
              } else {
                setVehicleData(null)
                setVehicleLookupNotFound(true)
                setManualManufacturer(firstVehicle.manufacturer || '')
                setManualColor(firstVehicle.color || '')
                setManualWeight(
                  firstVehicle.total_weight != null
                    ? String(firstVehicle.total_weight)
                    : ''
                )
                setManualChassis(firstVehicle.chassis || '')
              }
            }
          }
          // Points / addresses → unified route list
          if (tow.points && tow.points.length > 0) {
            const sortedSinglePoints = [...tow.points].sort(
              (a: { point_order: number }, b: { point_order: number }) =>
                a.point_order - b.point_order
            )
            const validSubtypes = [
              'key',
              'customer_pickup',
              'customer_dropoff',
              'other',
            ] as const
            const normalizeStopSubtype = (subtype: unknown): (typeof validSubtypes)[number] => {
              if (subtype === 'customer') return 'customer_pickup'
              if (subtype === 'general') return 'other'
              if (typeof subtype === 'string' && validSubtypes.includes(subtype as (typeof validSubtypes)[number])) {
                return subtype as (typeof validSubtypes)[number]
              }
              return 'other'
            }
            const roleFromPointType = (t: string): RouteRole => {
              if (t === 'pickup') return 'pickup'
              if (t === 'dropoff') return 'dropoff'
              return 'stop'
            }
            const hydratedStops: RouteStop[] = sortedSinglePoints.map((p: any) => ({
              id: isDuplicateLoad ? crypto.randomUUID() : (p.id || crypto.randomUUID()),
              role: roleFromPointType(p.point_type),
              stopSubtype:
                p.point_type === 'stop'
                  ? normalizeStopSubtype(p.stop_subtype)
                  : undefined,
              address: {
                address: p.address || '',
                lat: p.lat ? Number(p.lat) : undefined,
                lng: p.lng ? Number(p.lng) : undefined,
              },
              contactName: p.contact_name || '',
              contactPhone: p.contact_phone || '',
              notes: p.notes || '',
              orderNotes: p.order_notes || '',
            }))
            if (!hydratedStops.some((s) => s.role === 'dropoff')) {
              const legs = tow.legs ?? []
              const legWithDestination =
                legs.find((l: { leg_type: string; to_address?: string | null }) =>
                  l.leg_type === 'delivery' && l.to_address?.trim()
                ) ??
                legs.find((l: { leg_type: string; to_address?: string | null }) =>
                  l.leg_type === 'pickup' && l.to_address?.trim()
                )
              const legToAddress = legWithDestination?.to_address?.trim() || ''
              hydratedStops.push({
                id: crypto.randomUUID(),
                role: 'dropoff',
                address: { address: legToAddress },
              })
            }
            setRouteStops(hydratedStops)
            if (editTowId) {
              editRouteBaselineRef.current =
                routeStopsDistanceSignatureFromPoints(sortedSinglePoints)
            }
            const dropoffPoint = sortedSinglePoints.find(
              (p: { point_type: string }) => p.point_type === 'dropoff'
            )
            if (dropoffPoint?.is_storage) {
              setDropoffToStorage(true)
            }
          }

          // Bootstrap distance for recommended edit until Maps recalc completes
          if (
            editTowId &&
            (tow.tow_type === 'simple' || tow.tow_type === 'with_base') &&
            (loadedMode === 'recommended' || loadedMode === 'recommended_customer') &&
            !tow.start_from_base
          ) {
            const savedKm = Number(tow.price_breakdown?.distance_km ?? 0)
            if (savedKm > 0) {
              editSeededDistanceRef.current = savedKm
              setDistance({ distanceKm: savedKm, durationMinutes: 0 })
            }
          }
        }
        // Custom tow - route points (step 2; duplicate gets fresh ids only)

        if (tow.tow_type === 'multi_vehicle' && tow.points) {
          const towVehicleRows = (tow.vehicles ?? []) as TowVehicleEditRow[]
          const points: RoutePoint[] = tow.points.map((p: any) => ({
            id: isDuplicateLoad ? crypto.randomUUID() : p.id,
            type: p.point_type === 'pickup' ? 'stop' : 'stop',
            isStopOnly: false,
            address: p.address || '',
            addressData: { lat: p.lat ? Number(p.lat) : undefined, lng: p.lng ? Number(p.lng) : undefined },
            contactName: p.contact_name || '',
            contactPhone: p.contact_phone || '',
            notes: p.notes || '',
            vehiclesToPickup: (p.vehicles || [])
              .filter((pv: any) => pv.action === 'pickup' && pv.vehicle)
              .map((pv: any) => {
                const vehicleId = isDuplicateLoad ? crypto.randomUUID() : pv.vehicle.id
                if (editTowId) {
                  const fullRow = resolveFullTowVehicleRow(
                    towVehicleRows,
                    pv.vehicle.id,
                    pv.vehicle.plate_number
                  )
                  return hydrateRouteVehicleFromTowRows(pv.vehicle, fullRow, vehicleId)
                }
                return {
                  id: vehicleId,
                  plateNumber: pv.vehicle.plate_number || '',
                  isWorking: pv.vehicle.is_working !== false,
                  defects: [],
                  vehicleCode: '',
                  vehicleData: {
                    manufacturer: pv.vehicle.manufacturer,
                    model: pv.vehicle.model,
                    color: pv.vehicle.color,
                  },
                }
              }),
            vehiclesToDropoff: isDuplicateLoad
              ? []
              : (p.vehicles || [])
                  .filter((pv: any) => pv.action === 'dropoff')
                  .map((pv: any) => pv.vehicle?.id || ''),
            services: [],
          }))
          setRoutePoints(points)
        }

        if (editTowId) {
          const reserved = await getVehiclesReservedForTow(editTowId)
          if (reserved.length > 0) {
            const rv = reserved[0]
            const effectiveType = towTypeMap[tow.tow_type] || 'single'
            if (effectiveType === 'single') {
              setSelectedStoredVehicleId(rv.id)
            } else if (effectiveType === 'exchange') {
              setSelectedWorkingVehicleId(rv.id)
              setWorkingVehicleSource('storage')
            }
          }

          setManualAdjustmentPercent(
            String(tow.price_breakdown?.manual_adjustment_percent ?? '')
          )
          setManualAdjustmentType(tow.price_breakdown?.manual_adjustment_type ?? 'discount')
          setEditManualAdjustmentHydrationSettled(true)

          const savedDeadheadKm = Number(tow.price_breakdown?.deadhead_km ?? 0)
          if (savedDeadheadKm > 0) {
            setChargeDeadheadReturn(true)
            editSeededDeadheadRef.current = savedDeadheadKm
            setDropoffToBaseDistance({ distanceKm: savedDeadheadKm, durationMinutes: 0 })
          }

          setEditHydrationSettled(true)
        }

        if (isDuplicateLoad) {
          const now = new Date()
          const today = now.toISOString().split('T')[0]
          const currentTime = now.toTimeString().slice(0, 5)
          setTowDate(today)
          setTowTime(currentTime)
          setTowEndDate('')
          setTowEndTime('')
          setIsToday(true)
          setOrderNumber(null)
          setCustomerOrderNumber('')
          setCustomPrice('')
          setPreSelectedDriverId(null)
          setPreSelectedTruckId(null)
          setSelectedStoredVehicleId(null)
          setSelectedWorkingVehicleId(null)
        }
      } catch (err) {
        console.error('Error loading tow for edit:', err)
      }
    }
    loadTowForEdit()
  }, [editTowId, duplicateFromTowId, companyId, isDuplicateLoad])

  const loadData = async () => {
    if (!companyId) return
    setCustomersLoading(true)
    try {
      const customersPromise = getCustomersLite(companyId)
        .then((customersData) => {
          setCustomers(customersData)
        })
        .catch((err) => {
          console.error('Error loading customers:', err)
          setError('שגיאה בטעינת רשימת הלקוחות, נסה לרענן')
        })
        .finally(() => {
          setCustomersLoading(false)
        })

      // Populate surcharges as soon as each query resolves — not blocked on customer pricing load
      getTimeSurcharges(companyId)
        .then((value) => setTimeSurchargesData(value))
        .catch((err) => console.error('Error loading timeSurcharges:', err))
      getLocationSurcharges(companyId)
        .then((value) => setLocationSurchargesData(value))
        .catch((err) => console.error('Error loading locationSurcharges:', err))
      getServiceSurcharges(companyId)
        .then((value) => setServiceSurchargesData(value))
        .catch((err) => console.error('Error loading serviceSurcharges:', err))
      getDrivers(companyId)
        .then((v) => setDrivers(v))
        .catch((err) => console.error('Error loading drivers:', err))
      getTrucks(companyId)
        .then((v) => setTrucks(v))
        .catch((err) => console.error('Error loading trucks:', err))

      const results = await Promise.allSettled([
        getBasePriceList(companyId),
        getWeightBrackets(companyId),
        getFixedPriceItems(companyId),
        getCustomerIdsWithPersonalPricing(companyId),
        getCompanySettings(companyId),
      ])

      const [
        basePriceListResult,
        weightBracketsResult,
        fixedPriceItemsResult,
        customerIdsWithPersonalPricingResult,
        companySettingsResult,
      ] = results

      await customersPromise

      if (basePriceListResult.status === 'fulfilled') {
        setBasePriceList(basePriceListResult.value)
      } else {
        console.error('Error loading basePriceList:', basePriceListResult.reason)
      }

      if (weightBracketsResult.status === 'fulfilled') {
        setWeightBrackets(weightBracketsResult.value)
      } else {
        console.error('Error loading weightBrackets:', weightBracketsResult.reason)
      }

      if (fixedPriceItemsResult.status === 'fulfilled') {
        setFixedPriceItems(fixedPriceItemsResult.value)
      } else {
        console.error('Error loading fixedPriceItems:', fixedPriceItemsResult.reason)
      }
      setFixedPriceItemsHydrationSettled(true)

      if (customerIdsWithPersonalPricingResult.status === 'fulfilled') {
        setCustomerIdsWithPersonalPricing(customerIdsWithPersonalPricingResult.value)
      } else {
        console.error(
          'Error loading customerIdsWithPersonalPricing:',
          customerIdsWithPersonalPricingResult.reason
        )
      }

      if (companySettingsResult.status === 'fulfilled') {
        const companySettingsData = companySettingsResult.value
        if (companySettingsData?.default_vat_percent) {
          setVatPercent(companySettingsData.default_vat_percent / 100)
        }
      } else {
        console.error('Error loading companySettings:', companySettingsResult.reason)
      }
    } finally {
      setDataLoading(false)
    }
  }

  const parseWeight = (m?: string) => {
    const n = m ? Number(m) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const basePriceOverride = useMemo(() => {
    const flat = extractBasePrices(basePriceList)
    if (towType === 'exchange') {
      const seededBase =
        editTowId && editSeededExchangeBaseRef.current != null
          ? editSeededExchangeBaseRef.current
          : undefined

      if (!workingVehicleType || !defectiveVehicleType) {
        return seededBase
      }

      const workingWeight =
        parseWeight(workingManualWeight) ??
        (workingVehicleData?.data?.totalWeight != null &&
        Number(workingVehicleData.data.totalWeight) > 0
          ? Number(workingVehicleData.data.totalWeight)
          : null)
      const defectiveWeight =
        parseWeight(defectiveManualWeight) ??
        (defectiveVehicleData?.data?.totalWeight != null &&
        Number(defectiveVehicleData.data.totalWeight) > 0
          ? Number(defectiveVehicleData.data.totalWeight)
          : null)

      const workingType = workingVehicleType as string
      const defectiveType = defectiveVehicleType as string
      const needsBrackets =
        commercialTypeUsesWeightBrackets(workingType) ||
        commercialTypeUsesWeightBrackets(defectiveType)

      if (editTowId && !editHydrationSettled) {
        return seededBase
      }

      if (commercialTypeUsesWeightBrackets(workingType) && !workingWeight) {
        return editTowId ? seededBase : undefined
      }
      if (commercialTypeUsesWeightBrackets(defectiveType) && !defectiveWeight) {
        return editTowId ? seededBase : undefined
      }

      if (needsBrackets && weightBrackets.length === 0) {
        return editTowId ? seededBase : undefined
      }

      const sum =
        resolveVehicleBasePrice(workingType, workingWeight, weightBrackets, flat) +
        resolveVehicleBasePrice(defectiveType, defectiveWeight, weightBrackets, flat)

      if (sum > 0) {
        if (editTowId) editSeededExchangeBaseRef.current = null
        return sum
      }

      return editTowId ? seededBase : undefined
    }
    if ((vehicleType as string) === 'van') {
      const w = parseWeight(manualWeight)
      if (!w) return undefined
      return resolveVehicleBasePrice('van', w, weightBrackets, flat)
    }
    return undefined
  }, [
    towType,
    editTowId,
    editHydrationSettled,
    vehicleType,
    manualWeight,
    workingVehicleType,
    defectiveVehicleType,
    workingManualWeight,
    defectiveManualWeight,
    workingVehicleData,
    defectiveVehicleData,
    basePriceList,
    weightBrackets,
  ])

  // ==================== Price Calculations ====================
  const { recommendedPrice, finalPrice, priceResult } = useTowPricing({
    towType,
    vehicleType: towType === 'exchange'
      ? (workingVehicleType || defectiveVehicleType ? (defectiveVehicleType || 'private') : '')
      : vehicleType,
    basePriceOverride,
    distance: towType === 'exchange' ? exchangeTotalDistance : distance,
    startFromBase,
    baseToPickupDistance,
    chargeDeadheadReturn,
    dropoffToBaseDistance,
    basePriceList,
    activeTimeSurchargesList,
    selectedLocationSurcharges,
    locationSurchargesData,
    selectedServices: towType === 'exchange'
      ? [...workingSelectedServices, ...defectiveSelectedServices]
      : selectedServices,
    towServiceSurcharges,
    manualSurcharges,
    serviceSurchargesData,
    selectedCustomerPricing,
    customRouteData,
    priceMode,
    selectedPriceItem,
    customPrice,
    selectedCustomerId,
    companyId,
    setSelectedCustomerPricing,
    setPriceMode,
    setSelectedPriceItem,
    setCustomPrice,
    towDate,
    towTime,
    timeSurchargesData,
    isHoliday,
    setActiveTimeSurchargesList,
    isEditMode: !!editTowId,
    customPriceIncludesVat,
    setLocationSurchargesData,
    setServiceSurchargesData,
    setSelectedLocationSurcharges,
    setSelectedServices,
    companyLocationSurchargesData: locationSurchargesData,
    companyServiceSurchargesData: serviceSurchargesData,
    vatPercent,
    manualAdjustmentPercent,
    manualAdjustmentType,
    hasManualTimeSurchargeOverride,
    setHasManualTimeSurchargeOverride,
  })

  // ==================== Handlers ====================
  
  const handleCustomerSelect = (customerId: string | null, name: string, phone: string) => {
    setSelectedCustomerId(customerId)
    setCustomerName(name)
    setCustomerPhone(phone)
    if (!customerId) {
      setDepartment('')
      setOrderedBy('')
    }
  }

  const buildStoredVehicleLookupResult = (
    vehicle: StoredVehicleWithCustomer
  ): VehicleLookupResult | null => {
    if (!vehicle.vehicle_data) return null
    return {
      found: true,
      source:
        (vehicle.vehicle_data?.source as VehicleLookupResult['source']) ||
        'private',
      sourceLabel: vehicle.vehicle_data?.sourceLabel || 'רכב פרטי',
      data: {
        plateNumber: vehicle.plate_number,
        manufacturer: vehicle.vehicle_data.manufacturer || null,
        model: vehicle.vehicle_data.model || null,
        year: vehicle.vehicle_data.year
          ? parseInt(vehicle.vehicle_data.year, 10)
          : null,
        color: vehicle.vehicle_data.color || null,
        fuelType: null,
        totalWeight: vehicle.vehicle_data.totalWeight
          ? parseInt(vehicle.vehicle_data.totalWeight, 10)
          : null,
        vehicleType: null,
        driveType: vehicle.vehicle_data.driveType || null,
        driveTechnology: null,
        gearType: vehicle.vehicle_data.gearType || null,
        chassis: (vehicle.vehicle_data as { chassis?: string }).chassis || null,
        importType: null,
        curbWeightKg:
          (vehicle.vehicle_data as { curbWeightKg?: string | number }).curbWeightKg != null
            ? Number((vehicle.vehicle_data as { curbWeightKg?: string | number }).curbWeightKg)
            : null,
        machineryType: null,
        selfWeight: null,
        totalWeightTon: null,
      },
    }
  }

  const applyBaseAddressFromPriceList = (
    onAddress: (addr: AddressData) => void,
    deferFlag: { current: boolean }
  ) => {
    if (basePriceList?.base_address) {
      onAddress({
        address: basePriceList.base_address,
        lat: basePriceList.base_lat,
        lng: basePriceList.base_lng,
      })
    } else {
      deferFlag.current = true
    }
  }

  const hydrateStoredVehicleIntoSlot = (
    vehicle: StoredVehicleWithCustomer,
    slot: StoredVehicleHydrationSlot
  ) => {
    const vehicleResult = buildStoredVehicleLookupResult(vehicle)
    const { isFaulty, defects } = storedVehicleToCondition(vehicle)

    if (slot === 'single') {
      setSelectedStoredVehicleId(vehicle.id)
      setStorageVehicleCondition(vehicle.vehicle_condition)
      setVehiclePlate(vehicle.plate_number)
      setVehicleCode(vehicle.vehicle_code || '')
      if (vehicleResult) {
        setVehicleData(vehicleResult)
        setVehicleType('private')
      } else {
        setVehicleData(null)
        setVehicleType('')
      }
      setVehicleLookupNotFound(false)
      setSelectedDefects(isFaulty ? defects : [])
      return
    }

    if (slot === 'exchange-working') {
      setSelectedWorkingVehicleId(vehicle.id)
      setWorkingVehicleSource('storage')
      setWorkingVehiclePlate(vehicle.plate_number)
      setWorkingVehicleCode(vehicle.vehicle_code || '')
      if (vehicleResult) {
        setWorkingVehicleData(vehicleResult)
        setWorkingVehicleType('private')
      } else {
        setWorkingVehicleData(null)
        setWorkingVehicleType('')
      }
      setWorkingVehicleNotFound(false)
      setSelectedDefects([])
      applyBaseAddressFromPriceList(
        setWorkingVehicleAddress,
        deferStorageWorkingAddressRef
      )
      return
    }

    setDefectiveVehiclePlate(vehicle.plate_number)
    setDefectiveVehicleCode(vehicle.vehicle_code || '')
    if (vehicleResult) {
      setDefectiveVehicleData(vehicleResult)
      setDefectiveVehicleType('private')
    } else {
      setDefectiveVehicleData(null)
      setDefectiveVehicleType('')
    }
    setDefectiveVehicleNotFound(false)
    setSelectedDefects(isFaulty ? defects : [])
  }

  const applySingleStoragePickupFromBase = () => {
    if (!basePriceList?.base_address) return
    setRouteStops((prev) => {
      const pickupId = findPickupRouteStop(prev)?.id
      if (!pickupId) return prev
      return prev.map((s) =>
        s.id === pickupId
          ? {
              ...s,
              address: {
                address: basePriceList.base_address!,
                lat: basePriceList.base_lat,
                lng: basePriceList.base_lng,
              },
            }
          : s
      )
    })
    setStartFromBase(true)
  }

  const completeStorageTakeOut = (
    stored: StoredVehicleWithCustomer,
    slot: StoredVehicleHydrationSlot
  ) => {
    hydrateStoredVehicleIntoSlot(stored, slot)
    if (slot === 'single') {
      applySingleStoragePickupFromBase()
    } else if (slot === 'exchange-working') {
      setStartFromBase(true)
    }
  }

  const waitForStorageTakeOutConfirm = (
    plate: string,
    stored: StoredVehicleWithCustomer,
    slot: StoredVehicleHydrationSlot
  ) =>
    new Promise<boolean>((resolve) => {
      storageTakeOutResolverRef.current = resolve
      setStorageTakeOutPrompt({ plate, stored, slot })
    })

  const confirmStorageTakeOut = () => {
    const prompt = storageTakeOutPrompt
    if (!prompt) return
    completeStorageTakeOut(prompt.stored, prompt.slot)
    storageTakeOutResolverRef.current?.(true)
    storageTakeOutResolverRef.current = null
    setStorageTakeOutPrompt(null)
  }

  const cancelStorageTakeOut = () => {
    storageTakeOutResolverRef.current?.(false)
    storageTakeOutResolverRef.current = null
    setStorageTakeOutPrompt(null)
  }

  const tryResolveStoredPlateForSlot = useCallback(
    async (
      plate: string,
      slot: StoredVehicleHydrationSlot
    ): Promise<StoredPlateResolveResult> => {
      if (!companyId) return { status: 'not-in-storage' }

      const stored = await searchStoredVehicle(companyId, plate)
      if (!stored) return { status: 'not-in-storage' }

      const isSameCustomer = stored.customer_id === selectedCustomerId
      if (!isSameCustomer) {
        return { status: 'blocked', message: STORAGE_OTHER_CUSTOMER_MESSAGE }
      }

      const confirmed = await waitForStorageTakeOutConfirm(plate, stored, slot)
      if (!confirmed) {
        return { status: 'blocked', message: STORAGE_TAKE_OUT_CANCELLED_MESSAGE }
      }
      return { status: 'hydrated' }
    },
    [companyId, selectedCustomerId]
  )

  // Exchange helpers
  const handleSelectWorkingVehicle = (vehicle: StoredVehicleWithCustomer) => {
    hydrateStoredVehicleIntoSlot(vehicle, 'exchange-working')
    setStartFromBase(true)
  }

  const handleClearWorkingVehicle = () => {
    setSelectedWorkingVehicleId(null)
  }

  const applyStoragePrefill = (
    vehicle: StoredVehicleWithCustomer,
    type: 'single' | 'exchange' | 'custom'
  ) => {
    setSelectedStoredVehicleId(vehicle.id)
    setStorageVehicleCondition(vehicle.vehicle_condition)
    setStartFromBase(true)

    applyBaseAddressFromPriceList(
      (addr) => {
        setRouteStops((prev) => {
          const pickupId = findPickupRouteStop(prev)?.id
          if (!pickupId) return prev
          return prev.map((s) => (s.id === pickupId ? { ...s, address: addr } : s))
        })
      },
      deferStorageBaseAddressRef
    )

    if (type === 'single') {
      hydrateStoredVehicleIntoSlot(vehicle, 'single')
      return
    }

    if (type === 'exchange') {
      if (vehicle.vehicle_condition === 'operational') {
        hydrateStoredVehicleIntoSlot(vehicle, 'exchange-working')
      } else {
        hydrateStoredVehicleIntoSlot(vehicle, 'exchange-defective')
        applyBaseAddressFromPriceList(
          setExchangeAddress,
          deferStorageExchangeAddressRef
        )
      }
      return
    }

    if (type === 'custom') {
      console.info(
        '[storage prefill] custom route: customer and storage link set; add route points manually'
      )
    }
  }

  const handleSelectStoredVehicle = (vehicle: StoredVehicleWithCustomer) => {
    hydrateStoredVehicleIntoSlot(vehicle, 'single')
  }

  const handleVehiclePlateInputChange = (plate: string) => {
    const normalized = normalizePlate(plate)
    setVehiclePlate(normalized)
    setVehicleLookupNotFound(false)
    if (normalized.replace(/[^0-9]/g, '').length === 0) {
      setSelectedDefects([])
      setSelectedStoredVehicleId(null)
      setVehicleCode('')
      setStorageVehicleCondition('operational')
      setVehicleData(null)
      setVehicleType('')
    }
  }

  const handleDefectiveVehiclePlateInputChange = (plate: string) => {
    const normalized = normalizePlate(plate)
    setDefectiveVehiclePlate(normalized)
    setDefectiveVehicleNotFound(false)
    if (normalized.replace(/[^0-9]/g, '').length === 0) {
      setSelectedDefects([])
      setDefectiveVehicleData(null)
      setDefectiveVehicleType('')
      setDefectiveVehicleCode('')
    }
  }

  const handleClearStoredVehicle = () => {
    setSelectedStoredVehicleId(null)
    setVehiclePlate('')
    setVehicleCode('')
    setVehicleData(null)
    setVehicleType('')
    setSelectedDefects([])
    setStorageVehicleCondition('operational')
    setRouteStops((prev) => {
      const pickupId = findPickupRouteStop(prev)?.id
      if (!pickupId) return prev
      return prev.map((s) =>
        s.id === pickupId ? { ...s, address: { address: '' } } : s
      )
    })
    setStartFromBase(false)
  }

  const handlePinDropConfirm = (data: AddressData) => {
    const field = pinDropModal.field
    if (field?.startsWith('routestop:')) {
      const stopId = field.slice('routestop:'.length)
      updateStop(stopId, { address: data })
    } else if (field) {
      setPinDropResult({ pointId: field, data })
    }
  }

  const addStop = () => {
    setRouteStops((prev) => {
      let dropoffIndex = -1
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'dropoff') {
          dropoffIndex = i
          break
        }
      }
      const insertAt = dropoffIndex >= 0 ? dropoffIndex : prev.length
      const newStop: RouteStop = {
        id: crypto.randomUUID(),
        role: 'stop',
        stopSubtype: 'other',
        address: { address: '' },
      }
      const next = [...prev]
      next.splice(insertAt, 0, newStop)
      return next
    })
  }

  const removeStop = (id: string) => {
    setRouteStops((prev) => {
      const target = prev.find((s) => s.id === id)
      if (!target || target.role !== 'stop') return prev
      return prev.filter((s) => s.id !== id)
    })
  }

  const moveStopUp = (id: string) => {
    setRouteStops((prev) => {
      const index = prev.findIndex((s) => s.id === id)
      if (index <= 0) return prev
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  const moveStopDown = (id: string) => {
    setRouteStops((prev) => {
      const index = prev.findIndex((s) => s.id === id)
      if (index < 0 || index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  const updateStop = (id: string, patch: Partial<Omit<RouteStop, 'id'>>) => {
    setRouteStops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    )
  }

  const resetTypeSpecificFields = (previousType: 'single' | 'exchange' | 'custom') => {
    if (previousType === 'single') {
      setRouteStops(createDefaultRouteStops())
      setDistance(null)
      setDropoffToStorage(false)
      setHasStorageFollowUp(false)
      setInheritCustomerOrderNumber(false)
      setFollowUpAddress({ address: '' })
      setFollowUpContactName('')
      setFollowUpContactPhone('')
      setSelectedDefects([])
      setVehiclePlate('')
      setVehicleCode('')
      setVehicleData(null)
      setVehicleType('')
      return
    }

    if (previousType === 'exchange') {
      setWorkingVehicleSource('address')
      setSelectedWorkingVehicleId(null)
      setWorkingVehiclePlate('')
      setWorkingVehicleData(null)
      setWorkingVehicleType('')
      setWorkingVehicleCode('')
      setWorkingVehicleAddress({ address: '' })
      setWorkingVehicleContact('')
      setWorkingVehicleContactPhone('')
      setExchangeAddress({ address: '' })
      setWorkingVehicleDestinationAddress({ address: '' })
      setExchangeContactName('')
      setExchangeContactPhone('')
      setWorkingDestinationContact('')
      setWorkingDestinationContactPhone('')
      setDefectiveVehiclePlate('')
      setDefectiveVehicleData(null)
      setDefectiveVehicleType('')
      setDefectiveVehicleCode('')
      setDefectiveDestination('address')
      setDefectiveDestinationAddress({ address: '' })
      setDefectiveDestinationContact('')
      setDefectiveDestinationContactPhone('')
      setStopsBeforeExchange([])
      setStopsAfterExchange([])
      setExchangeTotalDistance(null)
      setExchangeDistanceLoading(false)
      setHasSecondTruck(false)
      setDefectiveTruckTypes([])
      setWorkingVehicleDestinationIsStorage(false)
      setWorkingVehicleNotFound(false)
      setWorkingManualManufacturer('')
      setWorkingManualColor('')
      setWorkingManualWeight('')
      setDefectiveVehicleNotFound(false)
      setDefectiveManualManufacturer('')
      setDefectiveManualColor('')
      setDefectiveManualWeight('')
      setDefectiveFaultDescription('')
      setWorkingSelectedServices([])
      setDefectiveSelectedServices([])
      setTowServiceSurcharges([])
      setHasStorageFollowUp(false)
      setInheritCustomerOrderNumber(false)
      setFollowUpAddress({ address: '' })
      setFollowUpContactName('')
      setFollowUpContactPhone('')
      return
    }

    if (previousType === 'custom') {
      setRoutePoints([])
      setCustomRouteData(emptyCustomRouteData())
    }
  }

  type SingleToExchangeSnapshot = {
    isDefective: boolean
    pickupAddress: AddressData
    pickupContactName: string
    pickupContactPhone: string
    vehiclePlate: string
    vehicleData: VehicleLookupResult | null
    vehicleType: VehicleType | ''
    vehicleCode: string
    dropoffAddress: AddressData
    dropoffContactName: string
    dropoffContactPhone: string
  }

  type ExchangeToSingleSnapshot = {
    workingVehicleAddress: AddressData
    workingVehicleContact: string
    workingVehicleContactPhone: string
    workingVehiclePlate: string
    workingVehicleData: VehicleLookupResult | null
    workingVehicleType: VehicleType | ''
    workingVehicleCode: string
    workingVehicleDestinationAddress: AddressData
    workingDestinationContact: string
    workingDestinationContactPhone: string
  }

  const copyFieldsBetweenTypes = (
    from: 'single' | 'exchange',
    to: 'single' | 'exchange',
    captured: SingleToExchangeSnapshot | ExchangeToSingleSnapshot,
  ) => {
    if (from === 'single' && to === 'exchange') {
      const s = captured as SingleToExchangeSnapshot
      if (s.pickupAddress?.address) setWorkingVehicleAddress(s.pickupAddress)
      if (s.pickupContactName.trim()) setWorkingVehicleContact(s.pickupContactName)
      if (s.pickupContactPhone.trim()) setWorkingVehicleContactPhone(s.pickupContactPhone)

      if (s.isDefective) {
        if (s.vehiclePlate.trim()) setDefectiveVehiclePlate(s.vehiclePlate)
        if (s.vehicleData != null) setDefectiveVehicleData(s.vehicleData)
        if (s.vehicleType) setDefectiveVehicleType(s.vehicleType)
        if (s.vehicleCode.trim()) setDefectiveVehicleCode(s.vehicleCode)
        if (s.dropoffAddress?.address) setDefectiveDestinationAddress(s.dropoffAddress)
        if (s.dropoffContactName.trim()) setDefectiveDestinationContact(s.dropoffContactName)
        if (s.dropoffContactPhone.trim()) setDefectiveDestinationContactPhone(s.dropoffContactPhone)
      } else {
        if (s.vehiclePlate.trim()) setWorkingVehiclePlate(s.vehiclePlate)
        if (s.vehicleData != null) setWorkingVehicleData(s.vehicleData)
        if (s.vehicleType) setWorkingVehicleType(s.vehicleType)
        if (s.vehicleCode.trim()) setWorkingVehicleCode(s.vehicleCode)
        if (s.dropoffAddress?.address) setWorkingVehicleDestinationAddress(s.dropoffAddress)
        if (s.dropoffContactName.trim()) setWorkingDestinationContact(s.dropoffContactName)
        if (s.dropoffContactPhone.trim()) setWorkingDestinationContactPhone(s.dropoffContactPhone)
      }
      return
    }

    if (from === 'exchange' && to === 'single') {
      const e = captured as ExchangeToSingleSnapshot
      const pickupId = crypto.randomUUID()
      const dropoffId = crypto.randomUUID()
      setRouteStops([
        {
          id: pickupId,
          role: 'pickup',
          address: e.workingVehicleAddress?.address
            ? e.workingVehicleAddress
            : { address: '' },
          contactName: e.workingVehicleContact,
          contactPhone: e.workingVehicleContactPhone,
        },
        {
          id: dropoffId,
          role: 'dropoff',
          address: e.workingVehicleDestinationAddress?.address
            ? e.workingVehicleDestinationAddress
            : { address: '' },
          contactName: e.workingDestinationContact,
          contactPhone: e.workingDestinationContactPhone,
        },
      ])
      if (e.workingVehiclePlate.trim()) setVehiclePlate(e.workingVehiclePlate)
      if (e.workingVehicleData != null) setVehicleData(e.workingVehicleData)
      if (e.workingVehicleType) setVehicleType(e.workingVehicleType)
      if (e.workingVehicleCode.trim()) setVehicleCode(e.workingVehicleCode)
    }
  }

  const resolveWorkingVehicleAddressForConversion = (): AddressData => {
    if (workingVehicleAddress?.address?.trim()) {
      return workingVehicleAddress
    }
    if (
      workingVehicleSource === 'storage' &&
      basePriceList?.base_address?.trim()
    ) {
      return {
        address: basePriceList.base_address,
        lat: basePriceList.base_lat,
        lng: basePriceList.base_lng,
      }
    }
    return workingVehicleAddress
  }

  const captureExchangeFormState = (): ExchangeFormState => ({
    workingVehicleSource,
    selectedWorkingVehicleId,
    workingVehiclePlate,
    workingVehicleCode,
    workingVehicleData,
    workingVehicleType,
    workingVehicleAddress: resolveWorkingVehicleAddressForConversion(),
    workingVehicleContact,
    workingVehicleContactPhone,
    workingManualManufacturer,
    workingManualColor,
    workingManualWeight,
    workingVehicleNotFound,
    workingVehicleDestinationAddress,
    workingDestinationContact,
    workingDestinationContactPhone,
    workingVehicleDestinationIsStorage,
    exchangeAddress,
    exchangeContactName,
    exchangeContactPhone,
    defectiveVehiclePlate,
    defectiveVehicleCode,
    defectiveVehicleData,
    defectiveVehicleType,
    defectiveManualManufacturer,
    defectiveManualColor,
    defectiveManualWeight,
    defectiveVehicleNotFound,
    defectiveDestination,
    defectiveDestinationAddress,
    defectiveDestinationContact,
    defectiveDestinationContactPhone,
    selectedDefects,
    defectiveFaultDescription,
  })

  /** Create flow: seed custom route from exchange before towType switches to custom. */
  const applyExchangeToCustomConversion = () => {
    const mapped = buildRoutePointsFromExchangeState(captureExchangeFormState())
    flushSync(() => {
      setRoutePoints(mapped.routePoints)
      setCustomRouteData({
        totalDistanceKm: 0,
        vehicles: mapped.vehicles,
        services: [],
      })
      setRouteSeedVersion((v) => v + 1)
    })
    resetTypeSpecificFields('exchange')
  }

  /** Prefer over raw setTowType on create when switching types (exchange→custom runs synchronously). */
  const selectTowType = (to: TowType) => {
    if (!isEditMode.current && towType === 'exchange' && to === 'custom') {
      applyExchangeToCustomConversion()
      setTowType(to)
      return
    }
    setTowType(to)
  }

  const handleTowTypeChange = (
    from: 'single' | 'exchange' | 'custom',
    to: TowType,
  ) => {
    if (from === 'single' && to === 'exchange') {
      const pickup = findPickupRouteStop(routeStops)
      const dropoff = findDropoffRouteStop(routeStops)
      const captured: SingleToExchangeSnapshot = {
        isDefective: selectedDefects.length > 0,
        pickupAddress: pickup?.address ?? { address: '' },
        pickupContactName: pickup?.contactName ?? '',
        pickupContactPhone: pickup?.contactPhone ?? '',
        vehiclePlate,
        vehicleData,
        vehicleType,
        vehicleCode,
        dropoffAddress: dropoff?.address ?? { address: '' },
        dropoffContactName: dropoff?.contactName ?? '',
        dropoffContactPhone: dropoff?.contactPhone ?? '',
      }
      resetTypeSpecificFields('single')
      copyFieldsBetweenTypes('single', 'exchange', captured)
      return
    }

    if (from === 'exchange' && to === 'single') {
      const captured: ExchangeToSingleSnapshot = {
        workingVehicleAddress,
        workingVehicleContact,
        workingVehicleContactPhone,
        workingVehiclePlate,
        workingVehicleData,
        workingVehicleType,
        workingVehicleCode,
        workingVehicleDestinationAddress,
        workingDestinationContact,
        workingDestinationContactPhone,
      }
      resetTypeSpecificFields('exchange')
      copyFieldsBetweenTypes('exchange', 'single', captured)
      return
    }

    if (from === 'exchange' && to === 'custom') {
      // Mapping + exchange reset run synchronously in selectTowType before towType updates.
      return
    }

    resetTypeSpecificFields(from)
  }

  // Clear only the previous tow type's fields when switching types (preserve shared fields)
  useEffect(() => {
    if (isEditMode.current) {
      previousTowTypeRef.current = towType
      return
    }

    const previous = previousTowTypeRef.current
    if (
      (previous === 'single' || previous === 'exchange' || previous === 'custom') &&
      previous !== towType
    ) {
      handleTowTypeChange(previous, towType)
    }

    previousTowTypeRef.current = towType
  }, [towType])

  // Apply storage deep-link pre-fill after user selects tow type
  useEffect(() => {
    if (editTowId || isEditMode.current) return
    if (!pendingStoragePrefill || !towType || storagePrefillAppliedRef.current) {
      return
    }
    if (towType !== 'single' && towType !== 'exchange' && towType !== 'custom') {
      return
    }

    applyStoragePrefill(pendingStoragePrefill, towType)
    storagePrefillAppliedRef.current = true
    setPendingStoragePrefill(null)
  }, [towType, pendingStoragePrefill, basePriceList])

  // Reset form function
  const resetForm = (keepCustomer: boolean = false) => {
    // Reset route points
    setRoutePoints([])
    // Reset price
    setPriceMode('recommended')
    setSelectedPriceItem(null)
    setCustomPrice('')
    // Reset vehicle data
    setVehiclePlate('')
    setVehicleCode('')
    setVehicleData(null)
    setVehicleType('')
    setVehicleLookupNotFound(false)
    setSelectedDefects([])
    setRouteStops(createDefaultRouteStops())
    setDistance(null)
    setNotes('')
    // Reset surcharges
    setSelectedLocationSurcharges([])
    setSelectedServices([])
    setTowServiceSurcharges([])
    setManualSurcharges([])
    setStartFromBase(false)
    setChargeDeadheadReturn(false)
    setDropoffToBaseDistance(null)
    setSelectedStoredVehicleId(null)
    setDropoffToStorage(false)
    setPreSelectedTruckId(null)
    
    if (!keepCustomer) {
      setSelectedCustomerId(null)
      setCustomerName('')
      setCustomerPhone('')
      setDepartment('')
      setOrderedBy('')
    }
  }

  const copyFromCustomer = (
    target:
      | 'pickup'
      | 'dropoff'
      | 'exchange_pickup'
      | 'working_source'
      | 'working_destination'
      | 'defective_destination',
  ) => {
    if (target === 'pickup') {
      setRouteStops((prev) =>
        prev.map((s) =>
          s.role === 'pickup'
            ? { ...s, contactName: customerName, contactPhone: customerPhone }
            : s
        )
      )
    } else if (target === 'dropoff') {
      setRouteStops((prev) =>
        prev.map((s) =>
          s.role === 'dropoff'
            ? { ...s, contactName: customerName, contactPhone: customerPhone }
            : s
        )
      )
    } else if (target === 'exchange_pickup') {
      setExchangeContactName(customerName)
      setExchangeContactPhone(customerPhone)
    } else if (target === 'working_source') {
      setWorkingVehicleContact(customerName)
      setWorkingVehicleContactPhone(customerPhone)
    } else if (target === 'working_destination') {
      setWorkingDestinationContact(customerName)
      setWorkingDestinationContactPhone(customerPhone)
    } else if (target === 'defective_destination') {
      setDefectiveDestinationContact(customerName)
      setDefectiveDestinationContactPhone(customerPhone)
    }
  }

  const { handleSave } = useTowSave({
    companyId,
    user,
    editTowId,
    editTowSnapshot,
    editExistingVehicles: editTowId ? editExistingVehicles : undefined,
    editExistingPoints: editTowId ? editExistingPoints : undefined,
    towType,
    requiredTruckTypes,
    setTruckTypeError,
    truckTypeSectionRef,
    dropoffToStorage,
    hasStorageFollowUp,
    inheritCustomerOrderNumber,
    followUpAddress,
    followUpContactName,
    followUpContactPhone,
    storageVehicleCondition,
    vehiclePlate,
    setSaving,
    setError,
    customers,
    selectedCustomerId,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    customerOrderNumber,
    department,
    orderedBy,
    towDate,
    towTime,
    towEndDate,
    towEndTime,
    vehicleCode,
    vehicleType,
    vehicleData,
    selectedDefects,
    manualManufacturer,
    manualColor,
    manualWeight,
    manualChassis,
    workingManualManufacturer,
    workingManualColor,
    workingManualWeight,
    routeStops,
    distance,
    exchangeTotalDistance,
    startFromBase,
    baseToPickupDistance,
    chargeDeadheadReturn,
    dropoffToBaseDistance,
    routePoints,
    customRouteData,
    priceMode,
    finalPrice,
    selectedPriceItem,
    customPrice,
    customPriceIncludesVat,
    vatPercent,
    manualAdjustmentPercent,
    manualAdjustmentType,
    basePriceList,
    weightBrackets,
    selectedCustomerPricing,
    activeTimeSurchargesList,
    selectedLocationSurcharges,
    locationSurchargesData,
    selectedServices,
    towServiceSurcharges,
    manualSurcharges,
    serviceSurchargesData,
    notes,
    paymentMethod,
    invoiceName,
    preSelectedDriverId,
    preSelectedTruckId,
    secondDriverId,
    secondDriverScheduledAt,
    workingVehiclePlate,
    workingVehicleCode,
    workingVehicleData,
    workingVehicleType,
    workingSelectedServices,
    defectiveSelectedServices,
    defectiveVehicleType,
    workingVehicleSourceAddress: workingVehicleAddress,
    workingVehicleDestinationAddress,
    workingVehicleContactName: workingVehicleContact,
    workingVehicleContactPhone,
    defectiveVehiclePlate,
    defectiveVehicleCode,
    defectiveVehicleData,
    exchangePointAddress: exchangeAddress,
    exchangeContactName,
    exchangeContactPhone,
    workingDestinationContactName: workingDestinationContact,
    workingDestinationContactPhone,
    defectiveDestinationAddress: defectiveDestinationAddress,
    defectiveDestinationContactName: defectiveDestinationContact,
    defectiveDestinationContactPhone,
    selectedStoredVehicleId,
    workingVehicleSource,
    selectedWorkingVehicleId,
    workingVehicleDestinationIsStorage,
    defectiveDestination,
    defectiveManualManufacturer,
    defectiveManualColor,
    defectiveManualWeight,
    stopsBeforeExchange,
    stopsAfterExchange,
    timeSurchargesData,
    isHoliday,
    hasManualTimeSurchargeOverride,
    getExchangeEditPriceBaselineSignature: () => editExchangePriceBaselineRef.current,
    getSingleEditPriceBaselineSignature: () => editSinglePriceBaselineRef.current,
    getExchangeRouteLayout: () => editExchangeRouteLayoutRef.current,
    setSavedTowId,
    setShowAssignNowModal,
    beforeSaveTow: () => beforeSaveTowRef.current?.() ?? Promise.resolve(),
  })

  return {
    // Auth/routing
    router,
    user,
    companyId,
    // UI State
    showAssignNowModal, setShowAssignNowModal,
    savedTowId, setSavedTowId,
    saving, setSaving,
    error, setError,
    dataLoading,
    customersLoading,
    // Data
    customers,
    drivers,
    trucks,
    selectedCustomerId, setSelectedCustomerId,
    preSelectedDriverId, setPreSelectedDriverId,
    preSelectedTruckId, setPreSelectedTruckId,
    secondDriverId, setSecondDriverId,
    secondDriverScheduledAt, setSecondDriverScheduledAt,
    // Price list
    basePriceList,
    fixedPriceItems,
    customerIdsWithPersonalPricing,
    selectedCustomerPricing,
    setSelectedCustomerPricing,
    // Surcharges
    timeSurchargesData,
    locationSurchargesData,
    serviceSurchargesData,
    selectedLocationSurcharges, setSelectedLocationSurcharges,
    selectedServices, setSelectedServices,
    towServiceSurcharges, setTowServiceSurcharges,
    manualSurcharges, setManualSurcharges,
    isHoliday, setIsHoliday,
    activeTimeSurchargesList, setActiveTimeSurchargesList,
    hasManualTimeSurchargeOverride, setHasManualTimeSurchargeOverride,
    // Price selection
    priceMode, setPriceMode,
    selectedPriceItem, setSelectedPriceItem,
    customPrice, setCustomPrice,
    customPriceIncludesVat, setCustomPriceIncludesVat,
    // Customer
    customerOrderNumber, setCustomerOrderNumber,
    orderNumber,
    isDuplicateLoad,
    duplicateFromTowId,
    loadedTowStatus,
    setLoadedTowStatus,
    editExistingVehicles,
    editExistingPoints,
    editTowSnapshot,
    department, setDepartment,
    orderedBy, setOrderedBy,
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail,
    customerAddress, setCustomerAddress,
    // Date/Time
    towDate, setTowDate,
    towTime, setTowTime,
    towEndDate, setTowEndDate,
    towEndTime, setTowEndTime,
    isToday, setIsToday,
    // Tow type
    towType, setTowType, selectTowType,
    pendingStoragePrefill,
    routePoints, setRoutePoints,
    routeSeedVersion,
    customRouteData, setCustomRouteData,
    // Vehicle
    vehiclePlate, setVehiclePlate,
    vehicleCode, setVehicleCode,
    vehicleData, setVehicleData,
    vehicleType, setVehicleType,
    vehicleLookupNotFound, setVehicleLookupNotFound,
    selectedDefects, setSelectedDefects,
    requiredTruckTypes, setRequiredTruckTypes,
    truckTypeError, setTruckTypeError,
    truckTypeSectionRef,
    manualManufacturer, setManualManufacturer,
    manualColor, setManualColor,
    manualWeight, setManualWeight,
    manualChassis, setManualChassis,
    // Storage
    customerStoredVehicles,
    selectedStoredVehicleId, setSelectedStoredVehicleId,
    dropoffToStorage, setDropoffToStorage,
    hasStorageFollowUp, setHasStorageFollowUp,
    inheritCustomerOrderNumber, setInheritCustomerOrderNumber,
    followUpAddress, setFollowUpAddress,
    followUpContactName, setFollowUpContactName,
    followUpContactPhone, setFollowUpContactPhone,
    storageVehicleCondition, setStorageVehicleCondition,
    storageLoading,
    // Exchange
    workingVehicleSource, setWorkingVehicleSource,
    selectedWorkingVehicleId, setSelectedWorkingVehicleId,
    workingVehiclePlate, setWorkingVehiclePlate,
    workingVehicleData, setWorkingVehicleData,
    workingVehicleType, setWorkingVehicleType,
    workingVehicleCode, setWorkingVehicleCode,
    workingVehicleAddress, setWorkingVehicleAddress,
    workingVehicleContact, setWorkingVehicleContact,
    workingVehicleContactPhone, setWorkingVehicleContactPhone,
    exchangeAddress, setExchangeAddress,
    workingVehicleDestinationAddress, setWorkingVehicleDestinationAddress,
    exchangeContactName, setExchangeContactName,
    exchangeContactPhone, setExchangeContactPhone,
    workingDestinationContact, setWorkingDestinationContact,
    workingDestinationContactPhone, setWorkingDestinationContactPhone,
    defectiveVehiclePlate, setDefectiveVehiclePlate,
    defectiveVehicleData, setDefectiveVehicleData,
    defectiveVehicleType, setDefectiveVehicleType,
    defectiveVehicleCode, setDefectiveVehicleCode,
    defectiveDestination, setDefectiveDestination,
    defectiveDestinationAddress, setDefectiveDestinationAddress,
    defectiveDestinationContact, setDefectiveDestinationContact,
    defectiveDestinationContactPhone, setDefectiveDestinationContactPhone,
    stopsBeforeExchange, setStopsBeforeExchange,
    stopsAfterExchange, setStopsAfterExchange,
    getExchangeEditPriceBaselineSignature: () => editExchangePriceBaselineRef.current,
    getSingleEditPriceBaselineSignature: () => editSinglePriceBaselineRef.current,
    getExchangeRouteLayout: () => editExchangeRouteLayoutRef.current,
    exchangeTotalDistance, setExchangeTotalDistance,
    exchangeDistanceLoading, setExchangeDistanceLoading,
    hasSecondTruck, setHasSecondTruck,
    defectiveTruckTypes, setDefectiveTruckTypes,
    workingVehicleDestinationIsStorage, setWorkingVehicleDestinationIsStorage,
    workingVehicleNotFound, setWorkingVehicleNotFound,
    workingManualManufacturer, setWorkingManualManufacturer,
    workingManualColor, setWorkingManualColor,
    workingManualWeight, setWorkingManualWeight,
    defectiveVehicleNotFound, setDefectiveVehicleNotFound,
    defectiveManualManufacturer, setDefectiveManualManufacturer,
    defectiveManualColor, setDefectiveManualColor,
    defectiveManualWeight, setDefectiveManualWeight,
    defectiveFaultDescription, setDefectiveFaultDescription,
    workingSelectedServices, setWorkingSelectedServices,
    defectiveSelectedServices, setDefectiveSelectedServices,
    // Addresses — unified route list
    routeStops,
    setRouteStops,
    addStop,
    removeStop,
    moveStopUp,
    moveStopDown,
    updateStop,
    /** @deprecated Used by app/dashboard/tows/new only */
    pickupAddress: findPickupRouteStop(routeStops)?.address ?? { address: '' },
    setPickupAddress: (addr: AddressData) => {
      setRouteStops((prev) => {
        const pickupId = findPickupRouteStop(prev)?.id
        if (!pickupId) return prev
        return prev.map((s) => (s.id === pickupId ? { ...s, address: addr } : s))
      })
    },
    dropoffAddress: findDropoffRouteStop(routeStops)?.address ?? { address: '' },
    setDropoffAddress: (addr: AddressData) => {
      setRouteStops((prev) => {
        const dropoffId = findDropoffRouteStop(prev)?.id
        if (!dropoffId) return prev
        return prev.map((s) => (s.id === dropoffId ? { ...s, address: addr } : s))
      })
    },
    pickupContactName: findPickupRouteStop(routeStops)?.contactName ?? '',
    setPickupContactName: (name: string) => {
      setRouteStops((prev) =>
        prev.map((s) => (s.role === 'pickup' ? { ...s, contactName: name } : s))
      )
    },
    pickupContactPhone: findPickupRouteStop(routeStops)?.contactPhone ?? '',
    setPickupContactPhone: (phone: string) => {
      setRouteStops((prev) =>
        prev.map((s) => (s.role === 'pickup' ? { ...s, contactPhone: phone } : s))
      )
    },
    dropoffContactName: findDropoffRouteStop(routeStops)?.contactName ?? '',
    setDropoffContactName: (name: string) => {
      setRouteStops((prev) =>
        prev.map((s) => (s.role === 'dropoff' ? { ...s, contactName: name } : s))
      )
    },
    dropoffContactPhone: findDropoffRouteStop(routeStops)?.contactPhone ?? '',
    setDropoffContactPhone: (phone: string) => {
      setRouteStops((prev) =>
        prev.map((s) => (s.role === 'dropoff' ? { ...s, contactPhone: phone } : s))
      )
    },
    distance,
    distanceLoading,
    startFromBase, setStartFromBase,
    baseToPickupDistance,
    baseToPickupLoading,
    chargeDeadheadReturn, setChargeDeadheadReturn,
    dropoffToBaseDistance,
    dropoffToBaseLoading,
    // Contacts
    notes, setNotes,
    // Payment
    invoiceName, setInvoiceName,
    paymentMethod, setPaymentMethod,
    creditCardNumber, setCreditCardNumber,
    creditCardExpiry, setCreditCardExpiry,
    creditCardCvv, setCreditCardCvv,
    creditCardId, setCreditCardId,
    // Pin drop
    pinDropModal, setPinDropModal,
    pinDropResult, setPinDropResult,
    // Computed
    recommendedPrice,
    finalPrice,
    priceResult,
    vatPercent,
    manualAdjustmentPercent, setManualAdjustmentPercent,
    manualAdjustmentType, setManualAdjustmentType,
    // Handlers
    handleCustomerSelect,
    handleSelectWorkingVehicle,
    handleClearWorkingVehicle,
    handleSelectStoredVehicle,
    handleClearStoredVehicle,
    handleVehiclePlateInputChange,
    handleDefectiveVehiclePlateInputChange,
    tryResolveStoredPlateForSlot,
    storageTakeOutPrompt,
    confirmStorageTakeOut,
    cancelStorageTakeOut,
    handlePinDropConfirm,
    resetForm,
    copyFromCustomer,
    handleSave,
  }
}
