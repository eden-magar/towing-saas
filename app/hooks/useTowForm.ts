import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../lib/AuthContext'
import { getTowWithPoints } from '../lib/queries/tows'
import { getCustomers, CustomerWithDetails } from '../lib/queries/customers'
import { getDrivers } from '../lib/queries/drivers'
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
import { getCustomerStoredVehicles, StoredVehicleWithCustomer } from '../lib/queries/storage'
import { loadGoogleMaps, calculateDistance, AddressData } from '../lib/google-maps'
import { TowType, PriceItem, DistanceResult } from '../components/tow-forms/sections'
import { SelectedService } from '../components/tow-forms/shared'
import { RoutePoint } from '../components/tow-forms/routes'
import { useTowPricing } from './useTowPricing'
import { useTowSave } from './useTowSave'

interface RouteStop {
  id: string
  address: AddressData
  contactName: string
  contactPhone: string
  notes: string
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
  
  // Data from database
  const [customers, setCustomers] = useState<CustomerWithDetails[]>([])
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [trucks, setTrucks] = useState<TruckWithDetails[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [preSelectedDriverId, setPreSelectedDriverId] = useState<string | null>(null)
  
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
  
  // Price selection
  const [priceMode, setPriceMode] = useState<'recommended' | 'fixed' | 'customer' | 'custom'>('recommended')
  const [selectedPriceItem, setSelectedPriceItem] = useState<PriceItem | null>(null)
  const [customPrice, setCustomPrice] = useState<string>('')
  const [customPriceIncludesVat, setCustomPriceIncludesVat] = useState(true)

  const [customerOrderNumber, setCustomerOrderNumber] = useState('')
  
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
  const [customRouteData, setCustomRouteData] = useState<{ totalDistanceKm: number; vehicles: { type: string; isWorking: boolean }[] }>({ totalDistanceKm: 0, vehicles: [] })

  // Reset when tow type changes
  useEffect(() => {
    if (towType && !isEditMode.current) {
      resetForm(true)
    }
  }, [towType])

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
        const vehicles = await getCustomerStoredVehicles(companyId, selectedCustomerId)
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
  const [truckTypeError, setTruckTypeError] = useState(false)
  const truckTypeSectionRef = useRef<HTMLDivElement>(null!)
  const isEditMode = useRef(!!editTowId)

  // Storage
  const [customerStoredVehicles, setCustomerStoredVehicles] = useState<StoredVehicleWithCustomer[]>([])
  const [selectedStoredVehicleId, setSelectedStoredVehicleId] = useState<string | null>(null)
  const [dropoffToStorage, setDropoffToStorage] = useState(false)
  const [storageLoading, setStorageLoading] = useState(false)

  // Exchange specific state
  const [workingVehicleSource, setWorkingVehicleSource] = useState<'storage' | 'address'>('storage')
  const [selectedWorkingVehicleId, setSelectedWorkingVehicleId] = useState<string | null>(null)
  const [workingVehiclePlate, setWorkingVehiclePlate] = useState('')
  const [workingVehicleData, setWorkingVehicleData] = useState<VehicleLookupResult | null>(null)
  const [workingVehicleType, setWorkingVehicleType] = useState<VehicleType | ''>('')
  const [workingVehicleCode, setWorkingVehicleCode] = useState('')
  const [workingVehicleAddress, setWorkingVehicleAddress] = useState<AddressData>({ address: '' })
  const [workingVehicleContact, setWorkingVehicleContact] = useState('')
  const [workingVehicleContactPhone, setWorkingVehicleContactPhone] = useState('')
  
  const [exchangeAddress, setExchangeAddress] = useState<AddressData>({ address: '' })
  const [exchangeContactName, setExchangeContactName] = useState('')
  const [exchangeContactPhone, setExchangeContactPhone] = useState('')
  
  const [defectiveVehiclePlate, setDefectiveVehiclePlate] = useState('')
  const [defectiveVehicleData, setDefectiveVehicleData] = useState<VehicleLookupResult | null>(null)
  const [defectiveVehicleType, setDefectiveVehicleType] = useState<VehicleType | ''>('')
  const [defectiveVehicleCode, setDefectiveVehicleCode] = useState('')
  const [defectiveDestination, setDefectiveDestination] = useState<'storage' | 'address'>('storage')
  const [defectiveDestinationAddress, setDefectiveDestinationAddress] = useState<AddressData>({ address: '' })
  const [defectiveDestinationContact, setDefectiveDestinationContact] = useState('')
  const [defectiveDestinationContactPhone, setDefectiveDestinationContactPhone] = useState('')
  
  const [stopsBeforeExchange, setStopsBeforeExchange] = useState<RouteStop[]>([])
  const [stopsAfterExchange, setStopsAfterExchange] = useState<RouteStop[]>([])
  
  const [exchangeTotalDistance, setExchangeTotalDistance] = useState<DistanceResult | null>(null)
  const [exchangeDistanceLoading, setExchangeDistanceLoading] = useState(false)

  // Single tow - Addresses
  const [pickupAddress, setPickupAddress] = useState<AddressData>({ address: '' })
  const [dropoffAddress, setDropoffAddress] = useState<AddressData>({ address: '' })
  
  // Distance
  const [distance, setDistance] = useState<DistanceResult | null>(null)
  const [distanceLoading, setDistanceLoading] = useState(false)
  
  // Start from base
  const [startFromBase, setStartFromBase] = useState(false)
  const [baseToPickupDistance, setBaseToPickupDistance] = useState<DistanceResult | null>(null)
  const [baseToPickupLoading, setBaseToPickupLoading] = useState(false)
  
  // Contacts
  const [pickupContactName, setPickupContactName] = useState('')
  const [pickupContactPhone, setPickupContactPhone] = useState('')
  const [dropoffContactName, setDropoffContactName] = useState('')
  const [dropoffContactPhone, setDropoffContactPhone] = useState('')
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

  // Calculate distance
  useEffect(() => {
    if (!pickupAddress.address || !dropoffAddress.address) {
      setDistance(null)
      return
    }
    const calc = async () => {
      setDistanceLoading(true)
      console.log('Calculating distance:', {
        pickup: pickupAddress,
        dropoff: dropoffAddress
      })
      try {
        const result = await calculateDistance(pickupAddress, dropoffAddress)
        console.log('Distance result:', result)

        setDistance(result)
      } catch (err) {
        console.error('Distance calculation error:', err)
        setDistance(null)
      } finally {
        setDistanceLoading(false)
      }
    }
    const timeout = setTimeout(calc, 500)
    return () => clearTimeout(timeout)
  }, [pickupAddress.address, pickupAddress.lat, dropoffAddress.address, dropoffAddress.lat])

  // Calculate base to pickup distance
  useEffect(() => {
    if (!startFromBase || !pickupAddress.address || !basePriceList?.base_lat || !basePriceList?.base_lng) {
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
        const result = await calculateDistance(baseAddress, pickupAddress)
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
  }, [startFromBase, pickupAddress.address, pickupAddress.lat, basePriceList?.base_lat, basePriceList?.base_lng])

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

  // Load existing tow for editing
  useEffect(() => {
    if (!editTowId || !companyId) return
    const loadTowForEdit = async () => {
      try {
        const tow = await getTowWithPoints(editTowId)
        if (!tow) return
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
        // Type
        const towTypeMap: Record<string, TowType> = {
          'simple': 'single',
          'with_base': 'single',
          'transfer': 'custom',
          'multi_vehicle': 'custom',
        }
        setTowType(towTypeMap[tow.tow_type] || 'single')
        // Notes
        setNotes(tow.notes || '')
        // Price
        setCustomPrice(String(tow.final_price ?? 0))
        setPriceMode('custom')
        setCustomerOrderNumber(tow.customer_order_number || '')
        // Payment
        setPaymentMethod((tow as any).payment_method || 'cash')
        setInvoiceName((tow as any).invoice_name || '')
        // Required truck types
        if (tow.required_truck_types) {
          setRequiredTruckTypes(tow.required_truck_types as string[])
        }
        // Single tow - vehicle
        const firstVehicle = tow.points
          ?.flatMap((p: any) => p.vehicles || [])
          ?.find((pv: any) => pv.vehicle)?.vehicle
        if (firstVehicle) {
          console.log('firstVehicle:', firstVehicle)
          setVehiclePlate(firstVehicle.plate_number || '')
          setVehicleCode((firstVehicle as any).vehicle_code || '')
          setVehicleType((firstVehicle as any).vehicle_type || '')
          setSelectedDefects((firstVehicle as any).defects || [])
        }
        // Points / addresses
        if (tow.points && tow.points.length > 0) {
          const pickup = tow.points.find((p: any) => p.point_type === 'pickup')
          const dropoff = tow.points.find((p: any) => p.point_type === 'dropoff')
          if (pickup) {
            setPickupAddress({ 
              address: pickup.address || '',
              lat: pickup.lat ? Number(pickup.lat) : undefined,
              lng: pickup.lng ? Number(pickup.lng) : undefined
            })
            setPickupContactName(pickup.contact_name || '')
            setPickupContactPhone(pickup.contact_phone || '')
          }
          if (dropoff) {
            setDropoffAddress({ 
              address: dropoff.address || '',
              lat: dropoff.lat ? Number(dropoff.lat) : undefined,
              lng: dropoff.lng ? Number(dropoff.lng) : undefined
            })
            setDropoffContactName(dropoff.contact_name || '')
            setDropoffContactPhone(dropoff.contact_phone || '')
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
          }))
          setRoutePoints(points)
        }
      } catch (err) {
        console.error('Error loading tow for edit:', err)
      }
    }
    loadTowForEdit()
  }, [editTowId, companyId])

  const loadData = async () => {
    if (!companyId) return
    try {
      const [customersData, driversData, trucksData, basePriceData, fixedPricesData, customersPricingData, timeSurchargesRes, locationSurchargesRes, serviceSurchargesRes] = await Promise.all([
        getCustomers(companyId),
        getDrivers(companyId),
        getTrucks(companyId),
        getBasePriceList(companyId),
        getFixedPriceItems(companyId),
        getCustomersWithPricing(companyId),
        getTimeSurcharges(companyId),
        getLocationSurcharges(companyId),
        getServiceSurcharges(companyId)
      ])
      setCustomers(customersData)
      setDrivers(driversData)
      setTrucks(trucksData)
      setBasePriceList(basePriceData)
      setFixedPriceItems(fixedPricesData)
      setCustomersWithPricing(customersPricingData)
      setTimeSurchargesData(timeSurchargesRes)
      setLocationSurchargesData(locationSurchargesRes)
      setServiceSurchargesData(serviceSurchargesRes)
    } catch (err) {
      console.error('Error loading data:', err)
    }
  }

  // Debug: log loaded data
  useEffect(() => {
    console.log('Price data loaded:', {
      fixedPriceItems,
      customersWithPricing,
      selectedCustomerPricing,
      timeSurchargesData,
      locationSurchargesData,
      serviceSurchargesData
    })
  }, [fixedPriceItems, customersWithPricing, selectedCustomerPricing])

  // ==================== Price Calculations ====================
  const { recommendedPrice, finalPrice } = useTowPricing({
    towType,
    vehicleType,
    distance,
    startFromBase,
    baseToPickupDistance,
    basePriceList,
    activeTimeSurchargesList,
    selectedLocationSurcharges,
    locationSurchargesData,
    selectedServices,
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
  })

  // ==================== Handlers ====================
  
  const handleCustomerSelect = (customerId: string | null, name: string, phone: string) => {
    setSelectedCustomerId(customerId)
    setCustomerName(name)
    setCustomerPhone(phone)
  }

  // Exchange helpers
  const handleSelectWorkingVehicle = (vehicle: StoredVehicleWithCustomer) => {
    setSelectedWorkingVehicleId(vehicle.id)
  }

  const handleClearWorkingVehicle = () => {
    setSelectedWorkingVehicleId(null)
  }

  const handleSelectStoredVehicle = (vehicle: StoredVehicleWithCustomer) => {
    setSelectedStoredVehicleId(vehicle.id)
    setVehiclePlate(vehicle.plate_number)
    
    if (vehicle.vehicle_data) {
    const vehicleResult: VehicleLookupResult = {
      found: true,
      source: 'private',
      sourceLabel: 'רכב פרטי',
      data: {
        plateNumber: vehicle.plate_number,
        manufacturer: vehicle.vehicle_data.manufacturer || null,
        model: vehicle.vehicle_data.model || null,
        year: vehicle.vehicle_data.year ? parseInt(vehicle.vehicle_data.year) : null,
        color: vehicle.vehicle_data.color || null,
        fuelType: null,
        totalWeight: vehicle.vehicle_data.totalWeight ? parseInt(vehicle.vehicle_data.totalWeight) : null,
        vehicleType: null,
        driveType: vehicle.vehicle_data.driveType || null,
        driveTechnology: null,
        gearType: vehicle.vehicle_data.gearType || null,
        machineryType: null,
        selfWeight: null,
        totalWeightTon: null
      }
    }
    setVehicleData(vehicleResult)
    setVehicleType('private')
  }
  }

  const handleClearStoredVehicle = () => {
    setSelectedStoredVehicleId(null)
    setVehiclePlate('')
    setVehicleData(null)
    setVehicleType('')
  }

  const handlePinDropConfirm = (data: AddressData) => {
    if (pinDropModal.field === 'pickup') setPickupAddress(data)
    else if (pinDropModal.field === 'dropoff') setDropoffAddress(data)
    else if (pinDropModal.field) {
      // For RouteBuilder points - send data to RouteBuilder
      setPinDropResult({ pointId: pinDropModal.field, data })
    }
  }

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
    // Reset addresses
    setPickupAddress({ address: '' })
    setDropoffAddress({ address: '' })
    setDistance(null)
    // Reset contacts
    setPickupContactName('')
    setPickupContactPhone('')
    setDropoffContactName('')
    setDropoffContactPhone('')
    setNotes('')
    // Reset surcharges
    setSelectedLocationSurcharges([])
    setSelectedServices([])
    setStartFromBase(false)
    setSelectedStoredVehicleId(null)
    setDropoffToStorage(false)
    
    if (!keepCustomer) {
      setSelectedCustomerId(null)
      setCustomerName('')
      setCustomerPhone('')
    }
  }

  const copyFromCustomer = (target: 'pickup' | 'dropoff') => {
    if (target === 'pickup') {
      setPickupContactName(customerName)
      setPickupContactPhone(customerPhone)
    } else {
      setDropoffContactName(customerName)
      setDropoffContactPhone(customerPhone)
    }
  }

  const { handleSave } = useTowSave({
    companyId,
    user,
    editTowId,
    towType,
    requiredTruckTypes,
    setTruckTypeError,
    truckTypeSectionRef,
    dropoffToStorage,
    vehiclePlate,
    setSaving,
    setError,
    selectedCustomerId,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    customerOrderNumber,
    towDate,
    towTime,
    vehicleCode,
    vehicleType,
    vehicleData,
    selectedDefects,
    pickupAddress,
    dropoffAddress,
    distance,
    startFromBase,
    baseToPickupDistance,
    routePoints,
    customRouteData,
    priceMode,
    finalPrice,
    basePriceList,
    selectedCustomerPricing,
    activeTimeSurchargesList,
    selectedLocationSurcharges,
    locationSurchargesData,
    selectedServices,
    serviceSurchargesData,
    pickupContactName,
    pickupContactPhone,
    dropoffContactName,
    dropoffContactPhone,
    notes,
    paymentMethod,
    invoiceName,
    preSelectedDriverId,
    selectedStoredVehicleId,
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
    // Data
    customers,
    drivers,
    trucks,
    selectedCustomerId, setSelectedCustomerId,
    preSelectedDriverId, setPreSelectedDriverId,
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
    activeTimeSurchargesList,
    // Price selection
    priceMode, setPriceMode,
    selectedPriceItem, setSelectedPriceItem,
    customPrice, setCustomPrice,
    customPriceIncludesVat, setCustomPriceIncludesVat,
    // Customer
    customerOrderNumber, setCustomerOrderNumber,
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
    // Storage
    customerStoredVehicles,
    selectedStoredVehicleId, setSelectedStoredVehicleId,
    dropoffToStorage, setDropoffToStorage,
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
    exchangeContactName, setExchangeContactName,
    exchangeContactPhone, setExchangeContactPhone,
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
    // Addresses
    pickupAddress, setPickupAddress,
    dropoffAddress, setDropoffAddress,
    distance,
    distanceLoading,
    startFromBase, setStartFromBase,
    baseToPickupDistance,
    baseToPickupLoading,
    // Contacts
    pickupContactName, setPickupContactName,
    pickupContactPhone, setPickupContactPhone,
    dropoffContactName, setDropoffContactName,
    dropoffContactPhone, setDropoffContactPhone,
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
