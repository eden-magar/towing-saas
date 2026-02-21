import { useRouter } from 'next/navigation'
import { createCustomer } from '@/app/lib/queries/customers'
import { prepareTowData } from '../lib/utils/tow-save-handler'
import { createTow, updateTow, getTowWithPoints, saveTowChangeLogs } from '../lib/queries/tows'
import { addVehicleToStorage, releaseVehicleFromStorage } from '../lib/queries/storage'
import { AddressData } from '../lib/google-maps'
import { DistanceResult, PriceItem, TowType } from '../components/tow-forms/sections'
import { CustomerWithPricing, LocationSurcharge, ServiceSurcharge, TimeSurcharge } from '../lib/queries/price-lists'
import { VehicleLookupResult, VehicleType } from '../lib/types'
import { SelectedService } from '../components/tow-forms/shared'
import { RoutePoint } from '../components/tow-forms/routes'

interface UseTowSaveParams {
  companyId: string | null
  user: { id: string } | null
  editTowId?: string
  towType: TowType
  // Validation refs/state
  requiredTruckTypes: string[]
  setTruckTypeError: (v: boolean) => void
  truckTypeSectionRef: React.RefObject<HTMLDivElement>
  dropoffToStorage: boolean
  vehiclePlate: string
  // Save state
  setSaving: (v: boolean) => void
  setError: (v: string) => void
  // Customer
  selectedCustomerId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string
  customerAddress: string
  customerOrderNumber: string
  towDate: string
  towTime: string
  // Vehicle
  vehicleCode: string
  vehicleType: VehicleType | ''
  vehicleData: VehicleLookupResult | null
  selectedDefects: string[]
  // Route - single
  pickupAddress: AddressData
  dropoffAddress: AddressData
  distance: DistanceResult | null
  startFromBase: boolean
  baseToPickupDistance: DistanceResult | null
  // Route - custom
  routePoints: RoutePoint[]
  customRouteData: { totalDistanceKm: number; vehicles: { type: string; isWorking: boolean }[] }
  // Pricing
  priceMode: 'recommended' | 'fixed' | 'customer' | 'custom'
  finalPrice: number
  basePriceList: any
  selectedCustomerPricing: CustomerWithPricing | null
  activeTimeSurchargesList: TimeSurcharge[]
  selectedLocationSurcharges: string[]
  locationSurchargesData: LocationSurcharge[]
  selectedServices: SelectedService[]
  serviceSurchargesData: ServiceSurcharge[]
  // Contacts
  pickupContactName: string
  pickupContactPhone: string
  dropoffContactName: string
  dropoffContactPhone: string
  notes: string
  paymentMethod: 'cash' | 'credit' | 'invoice'
  invoiceName: string
  // Driver
  preSelectedDriverId: string | null
  // Storage
  selectedStoredVehicleId: string | null
  // Post-save
  setSavedTowId: (id: string) => void
  setShowAssignNowModal: (v: boolean) => void
}

export function useTowSave(params: UseTowSaveParams) {
  const router = useRouter()
  const {
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
  } = params

  const handleSave = async () => {
  if (!companyId || !user) return
  if (towType !== 'single' && towType !== 'custom') return
  
  // Validation - truck type is required
  if (requiredTruckTypes.length === 0) {
    setTruckTypeError(true)
    setError('יש לבחור סוג גרר נדרש')
    truckTypeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  setTruckTypeError(false)

  // Validation - vehicle plate required for storage dropoff
  if (dropoffToStorage && !vehiclePlate) {
    setError('יש להזין מספר לוחית לרכב המיועד לאחסנה')
    return
  }
  
  // Validation for single tow
  if (towType === 'single') {
    if (requiredTruckTypes.length === 0) {
      setError('יש לבחור סוג גרר נדרש')
      return
    }
  }

  
  setSaving(true)
  setError('')
  
  try {
    // יצירת לקוח חדש אם צריך
    let finalCustomerId = selectedCustomerId
    if (!selectedCustomerId && customerName.trim()) {
      try {
        const result = await createCustomer({
          companyId,
          customerType: 'private',
          name: customerName.trim(),
          phone: customerPhone.trim() || undefined,
          email: customerEmail.trim() || undefined,
          address: customerAddress.trim() || undefined,
          paymentTerms: 'immediate',
        })
        finalCustomerId = result.id
      } catch (err) {
        console.error('Error creating customer:', err)
      }
    }
    
    const towData = prepareTowData({
      companyId,
      userId: user.id,
      towType,
      customerOrderNumber,
      customerId: finalCustomerId,
      customerName,
      customerPhone,
      towDate,
      towTime,
      preSelectedDriverId,
      // Single tow
      vehiclePlate,
      vehicleCode,
      vehicleType,
      vehicleData,
      selectedDefects,
      requiredTruckTypes,
      pickupAddress,
      dropoffAddress,
      distance,
      startFromBase,
      baseToPickupDistance,
      // Custom tow
      routePoints,
      customRouteData,
      // Pricing
      priceMode,
      finalPrice,
      basePriceList,
      selectedCustomerPricing,
      activeTimeSurcharges: activeTimeSurchargesList,
      selectedLocationSurcharges,
      locationSurchargesData,
      selectedServices,
      serviceSurchargesData,
      // Additional
      notes,
      pickupContactName,
      pickupContactPhone,
      dropoffContactName,
      dropoffContactPhone,
      paymentMethod: paymentMethod || undefined,
      invoiceName: invoiceName || undefined,
      dropoffToStorage,
    })

    if (editTowId) {
    console.log('updateTow data:', { ...towData, towId: editTowId, finalPrice: towData.finalPrice, priceMode: towData.priceMode })
    
    // שמירת לוג שינויים
    const originalTow = await getTowWithPoints(editTowId)
    if (originalTow && user) {
      const changes: { field_name: string; old_value: string | null; new_value: string | null }[] = []
      
      if (String(originalTow.final_price) !== String(towData.finalPrice)) {
        changes.push({ field_name: 'מחיר סופי', old_value: String(originalTow.final_price ?? ''), new_value: String(towData.finalPrice ?? '') })
      }
      if ((originalTow.payment_method ?? '') !== (towData.paymentMethod ?? '')) {
        changes.push({ field_name: 'אמצעי תשלום', old_value: originalTow.payment_method ?? null, new_value: towData.paymentMethod ?? null })
      }
      if ((originalTow.notes ?? '') !== (towData.notes ?? '')) {
        changes.push({ field_name: 'הערות', old_value: originalTow.notes ?? null, new_value: towData.notes ?? null })
      }
      const normalizeDate = (d: string | null) => d ? new Date(d).toISOString().slice(0, 16) : null
      if (normalizeDate(originalTow.scheduled_at) !== normalizeDate(towData.scheduledAt ?? null)) {
        const formatDate = (d: string | null) => d ? new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
        changes.push({ field_name: 'תאריך ושעה', old_value: formatDate(originalTow.scheduled_at), new_value: formatDate(towData.scheduledAt ?? null) })
      }
      if (changes.length > 0) {
        await saveTowChangeLogs(editTowId, user.id, changes)
      }
    }
    
    await updateTow({ ...towData, towId: editTowId })
    router.push(`/dashboard/tows/${editTowId}`)
    } else {
      const result = await createTow(towData)

      if (selectedStoredVehicleId && companyId) {
        await releaseVehicleFromStorage({
          storedVehicleId: selectedStoredVehicleId,
          towId: result.id,
          performedBy: user?.id,
          notes: 'שוחרר לגרירה'
        })
      }

      if (dropoffToStorage && companyId) {
        await addVehicleToStorage({
          companyId,
          customerId: selectedCustomerId || undefined,
          plateNumber: vehiclePlate,
          vehicleData: vehicleData?.data ? {
            manufacturer: vehicleData.data.manufacturer || undefined,
            model: vehicleData.data.model || undefined,
            year: vehicleData.data.year?.toString() || undefined,
            color: vehicleData.data.color || undefined,
            gearType: vehicleData.data.gearType || undefined,
            driveType: vehicleData.data.driveType || undefined,
            totalWeight: vehicleData.data.totalWeight?.toString() || undefined,
          } : undefined,
          location: undefined,
          towId: result.id,
          performedBy: user?.id,
          notes: 'נכנס מגרירה',
          vehicleCondition: selectedDefects.length > 0 ? 'faulty' : 'operational',
        })
      }

      setSavedTowId(result.id)
      if (!preSelectedDriverId) {
        setShowAssignNowModal(true)
      } else {
        router.push('/dashboard/calendar')
      }
    }
    } catch (err) {
      console.error('Error saving tow:', err)
      setError(editTowId ? 'שגיאה בעדכון הגרירה' : 'שגיאה ביצירת הגרירה')
    } finally {
      setSaving(false)
    }
    }

  return { handleSave }
}
