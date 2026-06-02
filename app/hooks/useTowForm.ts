import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../lib/AuthContext'
import { getTowWithPoints, type EditTowSnapshot } from '../lib/queries/tows'
import { getCustomersLite, CustomerListItem } from '../lib/queries/customers'
import { getDrivers } from '../lib/queries/drivers'
import { getCompanySettings } from '../lib/queries/settings'
import { getTrucks } from '../lib/queries/trucks'
import { 
  getBasePriceList, 
  getCustomersWithPricing, 
  getFixedPriceItems, 
  getTimeSurcharges, 
  getLocationSurcharges, 
  getServiceSurcharges, 
  CustomerWithPricing, 
  FixedPriceItem, 
  TimeSurcharge, 
  LocationSurcharge, 
  ServiceSurcharge 
} from '../lib/queries/price-lists'
import { DriverWithDetails, TruckWithDetails, VehicleType, VehicleLookupResult } from '../lib/types'
import {
  getCustomerStoredVehiclesForDisplay,
  getStoredVehicleById,
  getVehiclesReservedForTow,
  StoredVehicleWithCustomer,
} from '../lib/queries/storage'
import { loadGoogleMaps, calculateDistance, AddressData } from '../lib/google-maps'
import { extractBasePrices } from '../lib/utils/price-calculator'
import { TowType, PriceItem, DistanceResult } from '../components/tow-forms/sections'
import { SelectedService } from '../components/tow-forms/shared'
import { RoutePoint } from '../components/tow-forms/routes'
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

type CustomRouteData = {
  totalDistanceKm: number
  vehicles: { type: string; isWorking: boolean }[]
  services: SelectedService[]
}

export function useTowForm(editTowId?: string) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, companyId } = useAuth()
  
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
  const [fixedPriceItems, setFixedPriceItems] = useState<FixedPriceItem[]>([])
  const [customersWithPricing, setCustomersWithPricing] = useState<CustomerWithPricing[]>([])
  const [selectedCustomerPricing, setSelectedCustomerPricing] = useState<CustomerWithPricing | null>(null)
  
  // Surcharges from database
  const [timeSurchargesData, setTimeSurchargesData] = useState<TimeSurcharge[]>([])
  const [locationSurchargesData, setLocationSurchargesData] = useState<LocationSurcharge[]>([])
  const [serviceSurchargesData, setServiceSurchargesData] = useState<ServiceSurcharge[]>([])
  
  // Selected surcharges
  const [selectedLocationSurcharges, setSelectedLocationSurcharges] = useState<string[]>([])
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])
  const [isHoliday, setIsHoliday] = useState(false)
  const [activeTimeSurchargesList, setActiveTimeSurchargesList] = useState<TimeSurcharge[]>([])
  const [hasManualTimeSurchargeOverride, setHasManualTimeSurchargeOverride] = useState(false)
  
  // Price selection
  const [priceMode, setPriceMode] = useState<'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'>('recommended')
  const [selectedPriceItem, setSelectedPriceItem] = useState<PriceItem | null>(null)
  const [customPrice, setCustomPrice] = useState<string>('')
  const [customPriceIncludesVat, setCustomPriceIncludesVat] = useState(true)
  const [vatPercent, setVatPercent] = useState<number>(0.18)
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
  const [isToday, setIsToday] = useState(true)
  
  // Tow type
  const [towType, setTowType] = useState<TowType>('')
  // Route Builder state
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
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

  // Reset route points when customer changes
  useEffect(() => {
    setRoutePoints([])
  }, [selectedCustomerId])

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
  const [selectedDefects, setSelectedDefects] = useState<string[]>([])
  const [requiredTruckTypes, setRequiredTruckTypes] = useState<string[]>([])
  const [manualManufacturer, setManualManufacturer] = useState('')
  const [manualColor, setManualColor] = useState('')
  const [manualWeight, setManualWeight] = useState('')
  const [truckTypeError, setTruckTypeError] = useState(false)
  const truckTypeSectionRef = useRef<HTMLDivElement>(null!)
  const isEditMode = useRef(!!editTowId)
  const previousTowTypeRef = useRef<TowType>('')
  const storagePrefillAppliedRef = useRef(false)
  const deferStorageBaseAddressRef = useRef(false)
  const deferStorageExchangeAddressRef = useRef(false)
  const deferStorageWorkingAddressRef = useRef(false)
  const [pendingStoragePrefill, setPendingStoragePrefill] =
    useState<StoredVehicleWithCustomer | null>(null)
  const [loadedTowStatus, setLoadedTowStatus] = useState<string | null>(null)
  const [editTowSnapshot, setEditTowSnapshot] = useState<EditTowSnapshot | null>(null)

  // Storage
  const [customerStoredVehicles, setCustomerStoredVehicles] = useState<StoredVehicleWithCustomer[]>([])
  const [selectedStoredVehicleId, setSelectedStoredVehicleId] = useState<string | null>(null)
  const [dropoffToStorage, setDropoffToStorage] = useState(false)
  const [hasStorageFollowUp, setHasStorageFollowUp] = useState(false)
  const [followUpAddress, setFollowUpAddress] = useState<AddressData>({ address: '' })
  const [followUpContactName, setFollowUpContactName] = useState('')
  const [followUpContactPhone, setFollowUpContactPhone] = useState('')
  const [storageVehicleCondition, setStorageVehicleCondition] = useState<'operational' | 'faulty'>('operational')
  const [storageLoading, setStorageLoading] = useState(false)

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

  const routeStopsDistanceSignature = JSON.stringify(
    routeStops.map((stop) => [stop.address.address, stop.address.lat, stop.address.lng])
  )

  // Calculate distance as ordered multi-leg route chain
  useEffect(() => {
    const waypoints: AddressData[] = routeStops
      .filter((stop) => stop.address.address.trim())
      .map((stop) => stop.address)

    if (waypoints.length < 2) {
      setDistance(null)
      return
    }
    const calc = async () => {
      setDistanceLoading(true)
      try {
        let totalKm = 0
        let totalMinutes = 0

        for (let i = 0; i < waypoints.length - 1; i++) {
          const result = await calculateDistance(waypoints[i], waypoints[i + 1])
          if (!result) { setDistance(null); return }
          totalKm += result.distanceKm
          totalMinutes += result.durationMinutes
        }

        setDistance({ distanceKm: totalKm, durationMinutes: totalMinutes })
      } catch (err) {
        console.error('Distance calculation error:', err)
        setDistance(null)
      } finally {
        setDistanceLoading(false)
      }
    }
    const timeout = setTimeout(calc, 500)
    return () => clearTimeout(timeout)
  }, [routeStopsDistanceSignature])

  // Calculate base to pickup distance
  useEffect(() => {
    const pickup = findPickupRouteStop(routeStops)
    if (!startFromBase || !pickup?.address.address || !basePriceList?.base_lat || !basePriceList?.base_lng) {
      setBaseToPickupDistance(null)
      return
    }
    const calcBaseDistance = async () => {
      setBaseToPickupLoading(true)
      try {
        const baseAddress: AddressData = {
          address: basePriceList.base_address || '',
          lat: basePriceList.base_lat,
          lng: basePriceList.base_lng
        }
        const result = await calculateDistance(baseAddress, pickup.address)
        setBaseToPickupDistance(result)
      } catch (err) {
        console.error('Base distance calculation error:', err)
        setBaseToPickupDistance(null)
      } finally {
        setBaseToPickupLoading(false)
      }
    }
    const timeout = setTimeout(calcBaseDistance, 500)
    return () => clearTimeout(timeout)
  }, [startFromBase, routeStops, basePriceList?.base_lat, basePriceList?.base_lng])


  // Calculate exchange total distance
  useEffect(() => {
    if (!workingVehicleAddress.address || !exchangeAddress.address || !defectiveDestinationAddress.address) {
      setExchangeTotalDistance(null)
      return
    }
    const calcExchangeDistance = async () => {
      setExchangeDistanceLoading(true)
      try {
        // Build ordered waypoints
        const waypoints: AddressData[] = [
          workingVehicleAddress,
          ...stopsBeforeExchange.map(s => s.address),
          exchangeAddress,
          ...stopsAfterExchange.map(s => s.address),
          defectiveDestinationAddress,
        ]
        // Chain calculateDistance calls and sum results
        let totalKm = 0
        let totalMinutes = 0
        for (let i = 0; i < waypoints.length - 1; i++) {
          const result = await calculateDistance(waypoints[i], waypoints[i + 1])
          if (!result) { setExchangeTotalDistance(null); return }
          totalKm += result.distanceKm
          totalMinutes += result.durationMinutes
        }
        setExchangeTotalDistance({ distanceKm: totalKm, durationMinutes: totalMinutes })
      } catch (err) {
        console.error('Exchange distance calculation error:', err)
        setExchangeTotalDistance(null)
      } finally {
        setExchangeDistanceLoading(false)
      }
    }
    const timeout = setTimeout(calcExchangeDistance, 500)
    return () => clearTimeout(timeout)
  }, [
    workingVehicleAddress.address, workingVehicleAddress.lat, workingVehicleAddress.lng,
    exchangeAddress.address, exchangeAddress.lat, exchangeAddress.lng,
    defectiveDestinationAddress.address, defectiveDestinationAddress.lat, defectiveDestinationAddress.lng,
    stopsBeforeExchange,
    stopsAfterExchange,
  ])
  // Read URL params or set defaults to now
  useEffect(() => {
    const dateParam = searchParams.get('date')
    const timeParam = searchParams.get('time')
    const driverParam = searchParams.get('driver')
    
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format
    
    if (dateParam) {
      setTowDate(dateParam)
      setIsToday(dateParam === today)
    } else {
      // Default to today
      setTowDate(today)
      setIsToday(true)
    }
    
    if (timeParam) {
      setTowTime(timeParam)
    } else {
      // Default to current time
      setTowTime(currentTime)
    }
    
    if (driverParam) setPreSelectedDriverId(driverParam)
  }, [searchParams])

  // Load data
  useEffect(() => {
    if (companyId) loadData()
  }, [companyId])

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

  // Load existing tow for editing
  useEffect(() => {
    if (!editTowId || !companyId) return
    const loadTowForEdit = async () => {
      try {
        const tow = await getTowWithPoints(editTowId)
        if (!tow) return
        setLoadedTowStatus(tow.status)
        setEditTowSnapshot({
          final_price: tow.final_price,
          payment_method: tow.payment_method,
          notes: tow.notes,
          scheduled_at: tow.scheduled_at,
          price_breakdown: tow.price_breakdown,
        })
        // Customer
        setSelectedCustomerId(tow.customer_id)
        setCustomerName(tow.customer?.name || '')
        setCustomerPhone(tow.customer?.phone || '')
        setCustomerEmail(tow.customer?.email || '')
        setCustomerAddress(tow.customer?.address || '')
        // Date/Time
        if (tow.scheduled_at) {
          const d = new Date(tow.scheduled_at)
          setTowDate(d.toISOString().split('T')[0])
          setTowTime(d.toTimeString().slice(0, 5))
        }
        if (tow.driver_id) {
          setPreSelectedDriverId(tow.driver_id)
        }
        if (tow.truck_id) {
          setPreSelectedTruckId(tow.truck_id)
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
        // Price
        setCustomPrice(String(tow.final_price ?? 0))
        setPriceMode(tow.price_mode || 'custom')
        setCustomerOrderNumber(tow.customer_order_number || '')
        setOrderNumber(tow.order_number || null)
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
        // Selected services from price breakdown
        if (tow.price_breakdown?.service_surcharges?.length) {
          setSelectedServices(
            tow.price_breakdown.service_surcharges.map((s: { id: string; price: number; units?: number; amount: number }) => ({
              id: s.id,
              quantity: s.units,
              manualPrice: s.units === undefined && s.amount !== s.price ? s.amount : undefined
            }))
          )
        } else {
          setSelectedServices([])
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
          setWorkingVehicleType((working?.vehicle_type as VehicleType) ?? '')
          setDefectiveVehiclePlate(defective?.plate_number ?? '')
          setDefectiveVehicleCode((defective as any)?.vehicle_code ?? '')
          setDefectiveVehicleType((defective?.vehicle_type as VehicleType) ?? '')
          setSelectedDefects((defective?.tow_reason ?? '').split(', ').filter(Boolean))
          setDefectiveFaultDescription(defective?.tow_reason ?? '')

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

          if (hasExchangeHub) {
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
              setWorkingVehicleAddress(pointToAddressData(workingSource))
              setWorkingVehicleContact(workingSource.contact_name || '')
              setWorkingVehicleContactPhone(workingSource.contact_phone || '')
              if (workingSource.is_storage) {
                setWorkingVehicleSource('storage')
              }
            }
            if (exchangeHub) {
              setExchangeAddress(pointToAddressData(exchangeHub))
              setExchangeContactName(exchangeHub.contact_name || '')
              setExchangeContactPhone(exchangeHub.contact_phone || '')
            }
            if (defectiveDest) {
              setDefectiveDestinationAddress(pointToAddressData(defectiveDest))
              setDefectiveDestinationContact(defectiveDest.contact_name || '')
              setDefectiveDestinationContactPhone(defectiveDest.contact_phone || '')
            }
            if (workingDest) {
              setWorkingVehicleDestinationAddress(pointToAddressData(workingDest))
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
            const [p0, p1, p2, p3] = sortedPoints
            setWorkingVehicleAddress(pointToAddressData(p0))
            setWorkingVehicleContact(p0.contact_name || '')
            setWorkingVehicleContactPhone(p0.contact_phone || '')
            setWorkingVehicleDestinationAddress(pointToAddressData(p1))
            setWorkingDestinationContact(p1.contact_name || '')
            setWorkingDestinationContactPhone(p1.contact_phone || '')
            setExchangeAddress(pointToAddressData(p2))
            setExchangeContactName(p2.contact_name || '')
            setExchangeContactPhone(p2.contact_phone || '')
            setDefectiveDestinationAddress(pointToAddressData(p3))
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
          const serviceSurcharges = tow.price_breakdown?.service_surcharges ?? []
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
        } else {
          // Single tow - vehicle
          const firstVehicle = tow.points
            ?.flatMap((p: any) => p.vehicles || [])
            ?.find((pv: any) => pv.vehicle)?.vehicle
          if (firstVehicle) {
            setVehiclePlate(firstVehicle.plate_number || '')
            setVehicleCode('')
            setVehicleType((firstVehicle as any).vehicle_type || '')
            const defectsRaw = firstVehicle.tow_reason || ''
            setSelectedDefects(
              defectsRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
            )
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
            setRouteStops(
              sortedSinglePoints.map((p: any) => ({
                id: p.id || crypto.randomUUID(),
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
            )
            const dropoffPoint = sortedSinglePoints.find(
              (p: { point_type: string }) => p.point_type === 'dropoff'
            )
            if (dropoffPoint?.is_storage) {
              setDropoffToStorage(true)
            }
          }
        }
        // Custom tow - route points

        if (tow.tow_type === 'multi_vehicle' && tow.points) {
          const points: RoutePoint[] = tow.points.map((p: any) => ({
            id: p.id,
            type: p.point_type === 'pickup' ? 'stop' : 'stop',
            isStopOnly: false,
            address: p.address || '',
            addressData: { lat: p.lat ? Number(p.lat) : undefined, lng: p.lng ? Number(p.lng) : undefined },
            contactName: p.contact_name || '',
            contactPhone: p.contact_phone || '',
            notes: p.notes || '',
            vehiclesToPickup: (p.vehicles || [])
              .filter((pv: any) => pv.action === 'pickup' && pv.vehicle)
              .map((pv: any) => ({
                id: pv.vehicle.id,
                plateNumber: pv.vehicle.plate_number || '',
                isWorking: pv.vehicle.is_working !== false,
                defects: [],
                vehicleCode: '',
                vehicleData: {
                  manufacturer: pv.vehicle.manufacturer,
                  model: pv.vehicle.model,
                  color: pv.vehicle.color,
                }
              })),
            vehiclesToDropoff: (p.vehicles || [])
              .filter((pv: any) => pv.action === 'dropoff')
              .map((pv: any) => pv.vehicle?.id || ''),
            services: [],
          }))
          setRoutePoints(points)
        }

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
      } catch (err) {
        console.error('Error loading tow for edit:', err)
      }
    }
    loadTowForEdit()
  }, [editTowId, companyId])

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

      const results = await Promise.allSettled([
        getDrivers(companyId),
        getTrucks(companyId),
        getBasePriceList(companyId),
        getFixedPriceItems(companyId),
        getCustomersWithPricing(companyId),
        getTimeSurcharges(companyId),
        getLocationSurcharges(companyId),
        getServiceSurcharges(companyId),
        getCompanySettings(companyId),
      ])

      const [
        driversResult,
        trucksResult,
        basePriceListResult,
        fixedPriceItemsResult,
        customersWithPricingResult,
        timeSurchargesResult,
        locationSurchargesResult,
        serviceSurchargesResult,
        companySettingsResult,
      ] = results

      await customersPromise

      if (driversResult.status === 'fulfilled') {
        setDrivers(driversResult.value)
      } else {
        console.error('Error loading drivers:', driversResult.reason)
      }

      if (trucksResult.status === 'fulfilled') {
        setTrucks(trucksResult.value)
      } else {
        console.error('Error loading trucks:', trucksResult.reason)
      }

      if (basePriceListResult.status === 'fulfilled') {
        setBasePriceList(basePriceListResult.value)
      } else {
        console.error('Error loading basePriceList:', basePriceListResult.reason)
      }

      if (fixedPriceItemsResult.status === 'fulfilled') {
        setFixedPriceItems(fixedPriceItemsResult.value)
      } else {
        console.error('Error loading fixedPriceItems:', fixedPriceItemsResult.reason)
      }

      if (customersWithPricingResult.status === 'fulfilled') {
        setCustomersWithPricing(customersWithPricingResult.value)
      } else {
        console.error('Error loading customersWithPricing:', customersWithPricingResult.reason)
      }

      if (timeSurchargesResult.status === 'fulfilled') {
        setTimeSurchargesData(timeSurchargesResult.value)
      } else {
        console.error('Error loading timeSurcharges:', timeSurchargesResult.reason)
      }

      if (locationSurchargesResult.status === 'fulfilled') {
        setLocationSurchargesData(locationSurchargesResult.value)
      } else {
        console.error('Error loading locationSurcharges:', locationSurchargesResult.reason)
      }

      if (serviceSurchargesResult.status === 'fulfilled') {
        setServiceSurchargesData(serviceSurchargesResult.value)
      } else {
        console.error('Error loading serviceSurcharges:', serviceSurchargesResult.reason)
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

  // ==================== Price Calculations ====================
  const { recommendedPrice, finalPrice, priceResult } = useTowPricing({
    towType,
    vehicleType: towType === 'exchange'
      ? (workingVehicleType || defectiveVehicleType ? (workingVehicleType || 'private') : '')
      : vehicleType,
    basePriceOverride: towType === 'exchange' && basePriceList && workingVehicleType && defectiveVehicleType
      ? (extractBasePrices(basePriceList)[workingVehicleType as VehicleType] ?? 0) +
        (extractBasePrices(basePriceList)[defectiveVehicleType as VehicleType] ?? 0)
      : undefined,
    distance: towType === 'exchange' ? exchangeTotalDistance : distance,
    startFromBase,
    baseToPickupDistance,
    basePriceList,
    activeTimeSurchargesList,
    selectedLocationSurcharges,
    locationSurchargesData,
    selectedServices: towType === 'exchange'
      ? [...workingSelectedServices, ...defectiveSelectedServices]
      : selectedServices,
    serviceSurchargesData,
    selectedCustomerPricing,
    customRouteData,
    priceMode,
    selectedPriceItem,
    customPrice,
    selectedCustomerId,
    customersWithPricing,
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

  // Exchange helpers
  const handleSelectWorkingVehicle = (vehicle: StoredVehicleWithCustomer) => {
    setSelectedWorkingVehicleId(vehicle.id)
  }

  const handleClearWorkingVehicle = () => {
    setSelectedWorkingVehicleId(null)
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

    const vehicleResult = buildStoredVehicleLookupResult(vehicle)

    if (type === 'single') {
      setVehiclePlate(vehicle.plate_number)
      setVehicleCode(vehicle.vehicle_code || '')
      if (vehicleResult) {
        setVehicleData(vehicleResult)
        setVehicleType('private')
      }
      if (
        vehicle.vehicle_condition === 'faulty' &&
        vehicle.defects &&
        vehicle.defects.length > 0
      ) {
        setSelectedDefects(vehicle.defects)
      }
      return
    }

    if (type === 'exchange') {
      if (vehicle.vehicle_condition === 'operational') {
        setSelectedWorkingVehicleId(vehicle.id)
        setWorkingVehicleSource('storage')
        setWorkingVehiclePlate(vehicle.plate_number)
        setWorkingVehicleCode(vehicle.vehicle_code || '')
        if (vehicleResult) {
          setWorkingVehicleData(vehicleResult)
          setWorkingVehicleType('private')
        }
        applyBaseAddressFromPriceList(
          setWorkingVehicleAddress,
          deferStorageWorkingAddressRef
        )
      } else {
        setDefectiveVehiclePlate(vehicle.plate_number)
        setDefectiveVehicleCode(vehicle.vehicle_code || '')
        if (vehicleResult) {
          setDefectiveVehicleData(vehicleResult)
          setDefectiveVehicleType('private')
        }
        if (vehicle.defects && vehicle.defects.length > 0) {
          setSelectedDefects(vehicle.defects)
        }
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
    setSelectedStoredVehicleId(vehicle.id)
    setVehiclePlate(vehicle.plate_number)

    const vehicleResult = buildStoredVehicleLookupResult(vehicle)
    if (vehicleResult) {
      setVehicleData(vehicleResult)
      setVehicleType('private')
    }
  }

  const handleClearStoredVehicle = () => {
    setSelectedStoredVehicleId(null)
    setVehiclePlate('')
    setVehicleData(null)
    setVehicleType('')
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
      setHasStorageFollowUp(false)
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
    setSelectedDefects([])
    setRouteStops(createDefaultRouteStops())
    setDistance(null)
    setNotes('')
    // Reset surcharges
    setSelectedLocationSurcharges([])
    setSelectedServices([])
    setStartFromBase(false)
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
    towType,
    requiredTruckTypes,
    setTruckTypeError,
    truckTypeSectionRef,
    dropoffToStorage,
    hasStorageFollowUp,
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
    vehicleCode,
    vehicleType,
    vehicleData,
    selectedDefects,
    manualManufacturer,
    manualColor,
    manualWeight,
    routeStops,
    distance,
    exchangeTotalDistance,
    startFromBase,
    baseToPickupDistance,
    routePoints,
    customRouteData,
    priceMode,
    finalPrice,
    vatPercent,
    manualAdjustmentPercent,
    manualAdjustmentType,
    basePriceList,
    selectedCustomerPricing,
    activeTimeSurchargesList,
    selectedLocationSurcharges,
    locationSurchargesData,
    selectedServices,
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
    setSavedTowId,
    setShowAssignNowModal,
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
    customersWithPricing,
    selectedCustomerPricing, setSelectedCustomerPricing,
    // Surcharges
    timeSurchargesData,
    locationSurchargesData,
    serviceSurchargesData,
    selectedLocationSurcharges, setSelectedLocationSurcharges,
    selectedServices, setSelectedServices,
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
    loadedTowStatus,
    department, setDepartment,
    orderedBy, setOrderedBy,
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail,
    customerAddress, setCustomerAddress,
    // Date/Time
    towDate, setTowDate,
    towTime, setTowTime,
    isToday, setIsToday,
    // Tow type
    towType, setTowType,
    pendingStoragePrefill,
    routePoints, setRoutePoints,
    customRouteData, setCustomRouteData,
    // Vehicle
    vehiclePlate, setVehiclePlate,
    vehicleCode, setVehicleCode,
    vehicleData, setVehicleData,
    vehicleType, setVehicleType,
    selectedDefects, setSelectedDefects,
    requiredTruckTypes, setRequiredTruckTypes,
    truckTypeError, setTruckTypeError,
    truckTypeSectionRef,
    manualManufacturer, setManualManufacturer,
    manualColor, setManualColor,
    manualWeight, setManualWeight,
    // Storage
    customerStoredVehicles,
    selectedStoredVehicleId, setSelectedStoredVehicleId,
    dropoffToStorage, setDropoffToStorage,
    hasStorageFollowUp, setHasStorageFollowUp,
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
    handlePinDropConfirm,
    resetForm,
    copyFromCustomer,
    handleSave,
  }
}
