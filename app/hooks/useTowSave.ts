import { useRouter } from 'next/navigation'
import { createCustomer, type CustomerListItem } from '@/app/lib/queries/customers'
import { prepareTowData } from '../lib/utils/tow-save-handler'
import {
  createTow,
  createStorageFollowUpTow,
  updateTow,
  saveTowChangeLogs,
  type EditTowSnapshot,
} from '../lib/queries/tows'
import {
  reserveVehicleForTow,
  unreserveVehicleFromTow,
  getVehiclesReservedForTow,
} from '../lib/queries/storage'
import { AddressData } from '../lib/google-maps'
import type { RouteStop } from './useTowForm'
import { DistanceResult, PriceItem, TowType } from '../components/tow-forms/sections'
import { CustomerWithPricing, LocationSurcharge, ServiceSurcharge, TimeSurcharge } from '../lib/queries/price-lists'
import { VehicleLookupResult, VehicleType } from '../lib/types'
import { SelectedService } from '../components/tow-forms/shared'
import { RoutePoint } from '../components/tow-forms/routes'
import { supabase } from '../lib/supabase'
import { insertDriverTruckAssignments } from '../lib/queries/driver-truck-assignments'

interface UseTowSaveParams {
  companyId: string | null
  user: { id: string } | null
  editTowId?: string
  /** Values loaded at edit open — avoids re-fetching the tow on save. */
  editTowSnapshot?: EditTowSnapshot | null
  towType: TowType
  // Validation refs/state
  requiredTruckTypes: string[]
  setTruckTypeError: (v: boolean) => void
  truckTypeSectionRef: React.RefObject<HTMLDivElement>
  dropoffToStorage: boolean
  hasStorageFollowUp?: boolean
  followUpAddress?: AddressData
  followUpContactName?: string
  followUpContactPhone?: string
  storageVehicleCondition?: 'operational' | 'faulty'
  vehiclePlate: string
  // Save state
  setSaving: (v: boolean) => void
  /** Optional: pass from parent for debug logging (e.g. current saving flag). */
  saving?: boolean
  setError: (v: string) => void
  // Customer
  customers: CustomerListItem[]
  selectedCustomerId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string
  customerAddress: string
  customerOrderNumber: string
  department: string
  orderedBy: string
  towDate: string
  towTime: string
  towEndDate: string
  towEndTime: string
  // Vehicle
  vehicleCode?: string
  vehicleType: VehicleType | ''
  vehicleData: VehicleLookupResult | null
  selectedDefects: string[]
  manualManufacturer?: string
  manualColor?: string
  manualWeight?: string
  workingManualWeight?: string
  defectiveManualWeight?: string
  weightBrackets?: { min_kg: number; max_kg: number | null; base_price: number; sort_order: number }[]
  // Route - single
  routeStops: RouteStop[]
  distance: DistanceResult | null
  startFromBase: boolean
  baseToPickupDistance: DistanceResult | null
  // Route - custom
  routePoints: RoutePoint[]
  customRouteData: { totalDistanceKm: number; vehicles: { type: string; isWorking: boolean }[] }
  // Pricing
  priceMode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  finalPrice: number
  vatPercent?: number
  manualAdjustmentPercent?: string
  manualAdjustmentType?: 'discount' | 'markup'
  basePriceList: any
  selectedCustomerPricing: CustomerWithPricing | null
  activeTimeSurchargesList: TimeSurcharge[]
  selectedLocationSurcharges: string[]
  locationSurchargesData: LocationSurcharge[]
  selectedServices: SelectedService[]
  serviceSurchargesData: ServiceSurcharge[]
  notes: string
  paymentMethod: 'cash' | 'credit' | 'invoice'
  invoiceName: string
  // Driver
  preSelectedDriverId: string | null
  preSelectedTruckId?: string | null
  secondDriverId?: string | null
  secondDriverScheduledAt?: string | null
  // Exchange specific
  workingVehiclePlate?: string
  workingVehicleCode?: string
  workingVehicleData?: any
  workingVehicleType?: string
  workingSelectedServices?: SelectedService[]
  defectiveSelectedServices?: SelectedService[]
  defectiveVehicleType?: VehicleType | ''
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
  /** Full route chain km for exchange (working → … → exchange → … → defective); used for save breakdown. */
  exchangeTotalDistance?: DistanceResult | null
  // Storage
  selectedStoredVehicleId: string | null
  workingVehicleSource?: 'storage' | 'address'
  selectedWorkingVehicleId?: string | null
  workingVehicleDestinationIsStorage?: boolean
  defectiveDestination?: 'storage' | 'address'
  defectiveManualManufacturer?: string
  defectiveManualColor?: string
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
    saving,
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
    workingManualWeight,
    defectiveManualWeight,
    weightBrackets,
    routeStops,
    distance,
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
    workingVehicleSourceAddress,
    workingVehicleDestinationAddress,
    workingVehicleContactName,
    workingVehicleContactPhone,
    defectiveVehiclePlate,
    defectiveVehicleCode,
    defectiveVehicleData,
    exchangePointAddress,
    exchangeContactName,
    exchangeContactPhone,
    workingDestinationContactName,
    workingDestinationContactPhone,
    defectiveDestinationAddress,
    defectiveDestinationContactName,
    defectiveDestinationContactPhone,
    exchangeTotalDistance,
    selectedStoredVehicleId,
    workingVehicleSource,
    selectedWorkingVehicleId,
    workingVehicleDestinationIsStorage,
    defectiveDestination,
    defectiveManualManufacturer,
    defectiveManualColor,
    setSavedTowId,
    setShowAssignNowModal,
  } = params

  const handleSave = async () => {
  if (!companyId || !user) {
    return
  }
  if (towType !== 'single' && towType !== 'custom' && towType !== 'exchange') {
    return
  }

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
    
    const originalTow = editTowId ? editTowSnapshot ?? null : null

    const isBusinessCustomer =
      !!finalCustomerId &&
      customers.some(
        (c) => c.id === finalCustomerId && c.customer_type === 'business'
      )

    const towData = prepareTowData({
      companyId,
      userId: user.id,
      towType,
      customerOrderNumber,
      customerId: finalCustomerId,
      customerName,
      customerPhone,
      department,
      orderedBy,
      isBusinessCustomer,
      towDate,
      towTime,
      towEndDate,
      towEndTime,
      preSelectedDriverId,
      preSelectedTruckId,
      secondDriverId,
      secondDriverScheduledAt,
      // Single tow
      vehiclePlate,
      vehicleCode,
      vehicleType,
      vehicleData,
      selectedDefects,
      requiredTruckTypes,
      manualManufacturer,
      manualColor,
      manualWeight,
      workingManualWeight,
      defectiveManualWeight,
      weightBrackets,
      routeStops:
        towType === 'single'
          ? routeStops.map((s) => ({
              role: s.role,
              stopSubtype: s.stopSubtype,
              address: s.address,
              contactName: s.contactName,
              contactPhone: s.contactPhone,
              notes: s.notes,
              orderNotes: s.orderNotes,
            }))
          : undefined,
      distance:
        towType === 'custom'
          ? { distanceKm: customRouteData.totalDistanceKm, durationMinutes: 0 }
          : towType === 'exchange'
            ? exchangeTotalDistance ?? null
            : distance,
      startFromBase,
      baseToPickupDistance,
      // Custom tow
      routePoints,
      customRouteData,
      // Pricing
      priceMode,
      finalPrice,
      vatPercent,
      manualAdjustmentPercent: (() => {
        const adj = parseFloat(manualAdjustmentPercent ?? '') || 0
        return manualAdjustmentType === 'discount' ? -adj : adj
      })(),
      basePriceList,
      selectedCustomerPricing,
      activeTimeSurcharges: activeTimeSurchargesList,
      selectedLocationSurcharges,
      locationSurchargesData,
      selectedServices:
        towType === 'exchange'
          ? [...(workingSelectedServices ?? []), ...(defectiveSelectedServices ?? [])]
          : selectedServices,
      serviceSurchargesData,
      // Additional
      notes,
      paymentMethod: paymentMethod || undefined,
      invoiceName: invoiceName || undefined,
      dropoffToStorage,
      selectedStoredVehicleId,
      workingVehiclePlate: towType === 'exchange' ? workingVehiclePlate : undefined,
      workingVehicleCode: towType === 'exchange' ? workingVehicleCode : undefined,
      workingVehicleData: towType === 'exchange' ? workingVehicleData : undefined,
      workingVehicleType: towType === 'exchange' ? workingVehicleType : undefined,
      defectiveVehicleType: towType === 'exchange' ? defectiveVehicleType || undefined : undefined,
      workingVehicleSourceAddress: towType === 'exchange' ? workingVehicleSourceAddress : undefined,
      workingVehicleDestinationAddress: towType === 'exchange' ? workingVehicleDestinationAddress : undefined,
      workingVehicleContactName: towType === 'exchange' ? workingVehicleContactName : undefined,
      workingVehicleContactPhone: towType === 'exchange' ? workingVehicleContactPhone : undefined,
      defectiveVehiclePlate: towType === 'exchange' ? defectiveVehiclePlate : undefined,
      defectiveVehicleCode: towType === 'exchange' ? defectiveVehicleCode : undefined,
      defectiveVehicleData: towType === 'exchange' ? defectiveVehicleData : undefined,
      exchangePointAddress: towType === 'exchange' ? exchangePointAddress : undefined,
      exchangeContactName: towType === 'exchange' ? exchangeContactName : undefined,
      exchangeContactPhone: towType === 'exchange' ? exchangeContactPhone : undefined,
      workingDestinationContactName: towType === 'exchange' ? workingDestinationContactName : undefined,
      workingDestinationContactPhone: towType === 'exchange' ? workingDestinationContactPhone : undefined,
      defectiveDestinationAddress: towType === 'exchange' ? defectiveDestinationAddress : undefined,
      defectiveDestinationContactName: towType === 'exchange' ? defectiveDestinationContactName : undefined,
      defectiveDestinationContactPhone: towType === 'exchange' ? defectiveDestinationContactPhone : undefined,
      workingVehicleSource: towType === 'exchange' ? workingVehicleSource : undefined,
      workingVehicleDestinationIsStorage:
        towType === 'exchange' ? workingVehicleDestinationIsStorage : undefined,
      defectiveDestination: towType === 'exchange' ? defectiveDestination : undefined,
      workingSelectedServices: towType === 'exchange' ? workingSelectedServices : undefined,
      defectiveSelectedServices: towType === 'exchange' ? defectiveSelectedServices : undefined,
      existingPriceBreakdown: originalTow?.price_breakdown ?? null,
    })

    if (editTowId) {
    try {
      const currentReservations = await getVehiclesReservedForTow(editTowId)
      const desiredIds = new Set<string>()
      if (towType === 'single' && selectedStoredVehicleId) {
        desiredIds.add(selectedStoredVehicleId)
      }
      if (
        towType === 'exchange' &&
        workingVehicleSource === 'storage' &&
        selectedWorkingVehicleId
      ) {
        desiredIds.add(selectedWorkingVehicleId)
      }
      for (const v of currentReservations) {
        if (!desiredIds.has(v.id)) {
          await unreserveVehicleFromTow({ storedVehicleId: v.id })
        }
      }
      for (const id of desiredIds) {
        if (!currentReservations.some((r) => r.id === id)) {
          await reserveVehicleForTow({ storedVehicleId: id, towId: editTowId })
        }
      }
    } catch (err) {
      console.error('[useTowSave] sync storage reservations failed:', err)
    }

    // שמירת לוג שינויים
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
    
    await updateTow({ ...towData, towId: editTowId, priceMode })
    router.push(`/dashboard/tows/${editTowId}`)
    } else {
      const result = await createTow(towData)

      if (preSelectedDriverId && preSelectedTruckId) {
        try {
          const { data: existing } = await supabase
            .from('driver_truck_assignments')
            .select('id')
            .eq('driver_id', preSelectedDriverId)
            .eq('is_current', true)
            .limit(1)

          if (!existing || existing.length === 0) {
            await insertDriverTruckAssignments(preSelectedDriverId, [preSelectedTruckId])
          }
        } catch (err) {
          console.error('Failed to create permanent driver-truck assignment:', err)
        }
      }

      const shouldCreateFollowUp =
        hasStorageFollowUp &&
        !editTowId &&
        followUpAddress?.address?.trim() &&
        basePriceList?.base_address &&
        ((towType === 'single' && dropoffToStorage) ||
          (towType === 'exchange' && defectiveDestination === 'storage'))

      if (shouldCreateFollowUp && followUpAddress) {
        const followUpPlate =
          towType === 'single' ? vehiclePlate : (defectiveVehiclePlate ?? '')
        const followUpVehicleData =
          towType === 'single' ? vehicleData : (defectiveVehicleData ?? null)
        const followUpVehicleType =
          towType === 'single' ? vehicleType : (defectiveVehicleType ?? '')
        const followUpVehicleCode =
          towType === 'single' ? vehicleCode : defectiveVehicleCode
        const followUpManufacturer =
          towType === 'single'
            ? vehicleData?.data?.manufacturer || manualManufacturer || null
            : defectiveVehicleData?.data?.manufacturer ||
              defectiveManualManufacturer ||
              null
        const followUpModel =
          towType === 'single'
            ? vehicleData?.data?.model || null
            : defectiveVehicleData?.data?.model || null
        const followUpYear =
          towType === 'single'
            ? vehicleData?.data?.year ?? null
            : defectiveVehicleData?.data?.year ?? null
        const followUpColor =
          towType === 'single'
            ? vehicleData?.data?.color || manualColor || null
            : defectiveVehicleData?.data?.color || defectiveManualColor || null

        try {
          await createStorageFollowUpTow({
            parentTowId: result.id,
            companyId,
            createdBy: user.id,
            customerId: finalCustomerId ?? null,
            vehiclePlate: followUpPlate,
            vehicleData: followUpVehicleData,
            vehicleType: followUpVehicleType,
            vehicleCode: followUpVehicleCode || null,
            vehicleManufacturer: followUpManufacturer,
            vehicleModel: followUpModel,
            vehicleYear: followUpYear,
            vehicleColor: followUpColor,
            pickupAddress: basePriceList.base_address,
            pickupLat: basePriceList.base_lat ?? null,
            pickupLng: basePriceList.base_lng ?? null,
            dropoffAddress: followUpAddress.address.trim(),
            dropoffLat: followUpAddress.lat ?? null,
            dropoffLng: followUpAddress.lng ?? null,
            dropoffContactName: followUpContactName?.trim() || '',
            dropoffContactPhone: followUpContactPhone?.trim() || '',
            requiredTruckTypes,
          })
          console.log('[useTowSave] follow-up storage tow created')
        } catch (followUpError) {
          console.error('[useTowSave] failed to create follow-up tow:', followUpError)
        }
      }

      try {
        if (towType === 'single' && selectedStoredVehicleId) {
          await reserveVehicleForTow({
            storedVehicleId: selectedStoredVehicleId,
            towId: result.id,
          })
        }
        if (
          towType === 'exchange' &&
          workingVehicleSource === 'storage' &&
          selectedWorkingVehicleId
        ) {
          await reserveVehicleForTow({
            storedVehicleId: selectedWorkingVehicleId,
            towId: result.id,
          })
        }
      } catch (err) {
        console.error('[useTowSave] reserve storage failed:', err)
      }

      const createdStatus =
        (towData as { status?: string; driverId?: string }).status ??
        (towData.driverId ? 'assigned' : 'pending')
      if (createdStatus !== 'quote') {
        void (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            if (!token) return
            const res = await fetch('/api/integrations/legacy-calendar/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ tow_id: result.id }),
            })
            if (!res.ok) {
              console.warn('[legacy-calendar-sync] sync request failed', res.status)
            }
          } catch (err) {
            console.warn('[legacy-calendar-sync] sync request failed', err)
          }
        })()
      }

      setSavedTowId(result.id)
      if (!preSelectedDriverId) {
        setShowAssignNowModal(true)
      } else {
        router.push('/dashboard')
      }
    }
    } catch (error) {
      console.error('Save error:', error)
      setError(error instanceof Error ? error.message : JSON.stringify(error))
    } finally {
      setSaving(false)
    }
    }

  return { handleSave }
}
