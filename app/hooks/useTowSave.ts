import { useRouter } from 'next/navigation'
import { createCustomer, type CustomerListItem } from '@/app/lib/queries/customers'
import {
  CUSTOM_TOW_EDIT_WIPE_BLOCKED_MESSAGE,
  isCustomTowEditWipeBlocked,
  prepareTowData,
} from '../lib/utils/tow-save-handler'
import {
  createTow,
  createStorageFollowUpTow,
  updateTow,
  updateTowStatus,
  updateStorageFollowUpTow,
  type EditTowSnapshot,
} from '../lib/queries/tows'
import {
  reserveVehicleForTow,
  unreserveVehicleFromTow,
  getVehiclesReservedForTow,
} from '../lib/queries/storage'
import { logManualActionItem } from '../lib/queries/manual-action-items'
import { AddressData } from '../lib/google-maps'
import { findPickupRouteStop, findDropoffRouteStop, type RouteStop } from './useTowForm'
import { DistanceResult, PriceItem, TowType } from '../components/tow-forms/sections'
import { CustomerWithPricing, LocationSurcharge, ServiceSurcharge, TimeSurcharge } from '../lib/queries/price-lists'
import { VehicleLookupResult, VehicleType } from '../lib/types'
import { SelectedService } from '../components/tow-forms/shared'
import type { ManualSurcharge } from '../lib/utils/manual-surcharge'
import { RoutePoint } from '../components/tow-forms/routes'
import { insertDriverTruckAssignments, driverHasCurrentAssignment } from '../lib/queries/driver-truck-assignments'
import { syncTowToLegacyCalendar } from '../lib/integrations/legacy-calendar/client-sync'
import { markCustomerTowRequestConverted } from '../lib/queries/customer-tow-requests'
import { serializeDefects } from '../lib/constants/defects'
import {
  formatPriceRecalcConfirmMessage,
  pricesMateriallyDiffer,
} from '../lib/utils/price-change-confirm'
import {
  MISSING_ROUTE_ADDRESSES_MESSAGE,
  MISSING_STORAGE_DESTINATION_MESSAGE,
  MISSING_STORAGE_PLATE_MESSAGE,
  REQUIRED_TRUCK_TYPE_MESSAGE,
  STORAGE_FOLLOW_UP_LIVE_BLOCK_MESSAGE,
} from '../lib/utils/tow-save-blocking'

const STORAGE_FOLLOW_UP_CANCELLED_ON_EDIT = 'בוטל מעריכת גרירת אב'

function deriveStorageFollowUpCondition(
  storageVehicleCondition: 'operational' | 'faulty' | undefined,
  selectedDefects: string[] | undefined
): { isWorking: boolean; towReason: string | null } {
  const isFaulty =
    storageVehicleCondition === 'faulty' || (selectedDefects?.length ?? 0) > 0
  const serialized = selectedDefects?.length
    ? serializeDefects(selectedDefects)
    : ''
  return {
    isWorking: !isFaulty,
    towReason: serialized
      ? serialized
      : isFaulty
        ? 'תקול'
        : null,
  }
}

interface UseTowSaveParams {
  companyId: string | null
  user: { id: string } | null
  editTowId?: string
  /** Values loaded at edit open — avoids re-fetching the tow on save. */
  editTowSnapshot?: EditTowSnapshot | null
  editExistingVehicles?: { id: string; plateNumber: string; orderIndex: number }[]
  editExistingPoints?: { id: string; pointOrder: number; pointType: string }[]
  towType: TowType
  // Validation refs/state
  requiredTruckTypes: string[]
  setTruckTypeError: (v: boolean) => void
  truckTypeSectionRef: React.RefObject<HTMLDivElement>
  dropoffToStorage: boolean
  hasStorageFollowUp?: boolean
  inheritCustomerOrderNumber?: boolean
  followUpAddress?: AddressData
  followUpContactName?: string
  followUpContactPhone?: string
  followUpChildTowId?: string | null
  followUpChildStatus?: string | null
  editFollowUpExistingPoints?: { id: string; pointOrder: number; pointType: string }[]
  editFollowUpExistingVehicles?: { id: string; plateNumber: string; orderIndex: number }[]
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
  manualChassis?: string
  workingManualManufacturer?: string
  workingManualColor?: string
  workingManualWeight?: string
  workingManualChassis?: string
  defectiveManualManufacturer?: string
  defectiveManualColor?: string
  defectiveManualWeight?: string
  defectiveManualChassis?: string
  weightBrackets?: { min_kg: number; max_kg: number | null; base_price: number; sort_order: number }[]
  // Route - single
  routeStops: RouteStop[]
  distance: DistanceResult | null
  startFromBase: boolean
  baseToPickupDistance: DistanceResult | null
  chargeDeadheadReturn: boolean
  dropoffToBaseDistance: DistanceResult | null
  // Route - custom
  routePoints: RoutePoint[]
  customRouteData: { totalDistanceKm: number; vehicles: { type: string; isWorking: boolean }[] }
  // Pricing
  priceMode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  finalPrice: number
  selectedPriceItem?: { id: string; label: string; price: number } | null
  customPrice?: string
  customPriceIncludesVat?: boolean
  vatPercent?: number
  manualAdjustmentPercent?: string
  manualAdjustmentType?: 'discount' | 'markup'
  basePriceList: any
  selectedCustomerPricing: CustomerWithPricing | null
  activeTimeSurchargesList: TimeSurcharge[]
  selectedLocationSurcharges: string[]
  locationSurchargesData: LocationSurcharge[]
  selectedServices: SelectedService[]
  towServiceSurcharges?: SelectedService[]
  manualSurcharges?: ManualSurcharge[]
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
  /** When false (default collapsed hub UI), force working dest = exchange so save stays hub. */
  exchangePointSplit?: boolean
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
  stopsBeforeExchange?: { id: string; address: AddressData; contactName: string; contactPhone: string; notes: string }[]
  stopsAfterExchange?: { id: string; address: AddressData; contactName: string; contactPhone: string; notes: string }[]
  timeSurchargesData?: import('../lib/queries/price-lists').TimeSurcharge[]
  isHoliday?: boolean
  hasManualTimeSurchargeOverride?: boolean
  getExchangeEditPriceBaselineSignature?: () => string | null
  getSingleEditPriceBaselineSignature?: () => string | null
  getExchangeRouteLayout?: () => 'four_point' | 'hub' | null
  // Post-save
  setSavedTowId: (id: string) => void
  setShowAssignNowModal: (v: boolean) => void
  /** Runs after validation passes, before persisting the tow. */
  beforeSaveTow?: () => Promise<void>
  /**
   * Edit only: when prepareTowData produces a different final price than the stored tow,
   * ask the dispatcher to confirm before writing. Return true to save with the new price.
   */
  confirmPriceChange?: (oldPrice: number, newPrice: number) => Promise<boolean>
  /** When set, mark the portal request converted after a successful create. */
  fromRequestId?: string
  setSaveWarning?: (msg: string) => void
  /** Flush buffered storage-yard confirm audit logs after createTow. Never blocks save. */
  flushStorageYardConfirmLogs?: (towId: string) => Promise<void>
}

export function useTowSave(params: UseTowSaveParams) {
  const router = useRouter()
  const {
    companyId,
    user,
    editTowId,
    editTowSnapshot,
    editExistingVehicles,
    editExistingPoints,
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
    followUpChildTowId,
    followUpChildStatus,
    editFollowUpExistingPoints,
    editFollowUpExistingVehicles,
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
    manualChassis,
    workingManualManufacturer,
    workingManualColor,
    workingManualWeight,
    workingManualChassis,
    defectiveManualManufacturer,
    defectiveManualColor,
    defectiveManualWeight,
    defectiveManualChassis,
    weightBrackets,
    routeStops,
    distance,
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
    workingVehicleSourceAddress,
    workingVehicleDestinationAddress,
    exchangePointSplit = false,
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
    stopsBeforeExchange,
    stopsAfterExchange,
    timeSurchargesData,
    isHoliday,
    hasManualTimeSurchargeOverride,
    getExchangeEditPriceBaselineSignature,
    getSingleEditPriceBaselineSignature,
    getExchangeRouteLayout,
    setSavedTowId,
    setShowAssignNowModal,
    beforeSaveTow,
    confirmPriceChange,
    fromRequestId,
    setSaveWarning,
    flushStorageYardConfirmLogs,
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
    setError(REQUIRED_TRUCK_TYPE_MESSAGE)
    truckTypeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  setTruckTypeError(false)

  // Validation - vehicle plate required for storage dropoff
  if (dropoffToStorage && !vehiclePlate) {
    setError(MISSING_STORAGE_PLATE_MESSAGE)
    return
  }

  // Exchange: storage chosen for defective dropoff requires a destination address
  if (
    towType === 'exchange' &&
    defectiveDestination === 'storage' &&
    !defectiveDestinationAddress?.address?.trim()
  ) {
    setError(MISSING_STORAGE_DESTINATION_MESSAGE)
    return
  }
  
  // Validation for single tow
  if (towType === 'single') {
    if (requiredTruckTypes.length === 0) {
      setError(REQUIRED_TRUCK_TYPE_MESSAGE)
      return
    }
    // Block saving a single tow with no usable pickup/dropoff address —
    // otherwise it persists with null tow_legs and zero tow_points.
    const pickupStop = findPickupRouteStop(routeStops)
    const dropoffStop = findDropoffRouteStop(routeStops)
    if (
      !pickupStop?.address?.address?.trim() ||
      !dropoffStop?.address?.address?.trim()
    ) {
      setError(MISSING_ROUTE_ADDRESSES_MESSAGE)
      return
    }
  }

  if (
    isCustomTowEditWipeBlocked({
      editTowId,
      towType,
      existingPointCount: editExistingPoints?.length ?? 0,
      routePointCount: routePoints.length,
    })
  ) {
    setError(CUSTOM_TOW_EDIT_WIPE_BLOCKED_MESSAGE)
    return
  }

  setSaving(true)
  setError('')
  
  try {
    await beforeSaveTow?.()

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
      manualChassis,
      workingManualManufacturer,
      workingManualColor,
      workingManualWeight,
      workingManualChassis,
      defectiveManualManufacturer,
      defectiveManualColor,
      defectiveManualWeight,
      defectiveManualChassis,
      weightBrackets,
      routeStops:
        towType === 'single'
          ? routeStops.map((s) => ({
              id: s.id,
              role: s.role,
              stopSubtype: s.stopSubtype,
              address: s.address,
              contactName: s.contactName,
              contactPhone: s.contactPhone,
              notes: s.notes,
              orderNotes: s.orderNotes,
            }))
          : undefined,
      existingTowVehicles: editExistingVehicles,
      existingTowPoints: editExistingPoints,
      distance:
        towType === 'custom'
          ? { distanceKm: customRouteData.totalDistanceKm, durationMinutes: 0 }
          : towType === 'exchange'
            ? exchangeTotalDistance ?? null
            : distance,
      startFromBase,
      baseToPickupDistance,
      chargeDeadheadReturn,
      dropoffToBaseDistance,
      // Custom tow
      routePoints,
      customRouteData,
      // Pricing
      priceMode,
      finalPrice,
      selectedPriceItem,
      customPrice,
      customPriceIncludesVat,
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
      towServiceSurcharges,
      manualSurcharges,
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
      workingVehicleDestinationAddress:
        towType === 'exchange'
          ? exchangePointSplit
            ? workingVehicleDestinationAddress
            : exchangePointAddress
          : undefined,
      workingVehicleContactName: towType === 'exchange' ? workingVehicleContactName : undefined,
      workingVehicleContactPhone: towType === 'exchange' ? workingVehicleContactPhone : undefined,
      defectiveVehiclePlate: towType === 'exchange' ? defectiveVehiclePlate : undefined,
      defectiveVehicleCode: towType === 'exchange' ? defectiveVehicleCode : undefined,
      defectiveVehicleData: towType === 'exchange' ? defectiveVehicleData : undefined,
      exchangePointAddress: towType === 'exchange' ? exchangePointAddress : undefined,
      exchangeContactName: towType === 'exchange' ? exchangeContactName : undefined,
      exchangeContactPhone: towType === 'exchange' ? exchangeContactPhone : undefined,
      workingDestinationContactName:
        towType === 'exchange' && exchangePointSplit
          ? workingDestinationContactName
          : undefined,
      workingDestinationContactPhone:
        towType === 'exchange' && exchangePointSplit
          ? workingDestinationContactPhone
          : undefined,
      defectiveDestinationAddress: towType === 'exchange' ? defectiveDestinationAddress : undefined,
      defectiveDestinationContactName: towType === 'exchange' ? defectiveDestinationContactName : undefined,
      defectiveDestinationContactPhone: towType === 'exchange' ? defectiveDestinationContactPhone : undefined,
      workingVehicleSource: towType === 'exchange' ? workingVehicleSource : undefined,
      workingVehicleDestinationIsStorage:
        towType === 'exchange' && exchangePointSplit
          ? workingVehicleDestinationIsStorage
          : undefined,
      defectiveDestination: towType === 'exchange' ? defectiveDestination : undefined,
      workingSelectedServices: towType === 'exchange' ? workingSelectedServices : undefined,
      defectiveSelectedServices: towType === 'exchange' ? defectiveSelectedServices : undefined,
      existingPriceBreakdown: originalTow?.price_breakdown ?? null,
      timeSurchargesData,
      isHoliday,
      hasManualTimeSurchargeOverride,
      stopsBeforeExchange: towType === 'exchange' ? stopsBeforeExchange : undefined,
      stopsAfterExchange: towType === 'exchange' ? stopsAfterExchange : undefined,
      exchangeRouteLayout:
        editTowId && towType === 'exchange'
          ? (getExchangeRouteLayout?.() ?? null)
          : undefined,
      exchangeEditPriceBaselineSignature:
        editTowId && towType === 'exchange'
          ? (getExchangeEditPriceBaselineSignature?.() ?? null)
          : undefined,
      exchangeEditOriginalFinalPrice:
        editTowId && towType === 'exchange'
          ? (originalTow?.final_price ?? null)
          : undefined,
      singleEditPriceBaselineSignature:
        editTowId && towType === 'single'
          ? (getSingleEditPriceBaselineSignature?.() ?? null)
          : undefined,
      singleEditOriginalFinalPrice:
        editTowId && towType === 'single'
          ? (originalTow?.final_price ?? null)
          : undefined,
    })

    if (editTowId && originalTow) {
      const oldPrice = Number(originalTow.final_price) || 0
      const newPrice = Number(towData.finalPrice) || 0
      if (pricesMateriallyDiffer(oldPrice, newPrice)) {
        setSaving(false)
        const accepted = confirmPriceChange
          ? await confirmPriceChange(oldPrice, newPrice)
          : window.confirm(
              `${formatPriceRecalcConfirmMessage(oldPrice, newPrice)}\n\nלשמור עם המחיר החדש?`,
            )
        if (!accepted) {
          return
        }
        setSaving(true)
      }
    }

    const isStorageEligible =
      (towType === 'single' && dropoffToStorage) ||
      (towType === 'exchange' && defectiveDestination === 'storage')

    const { isWorking: followUpIsWorking, towReason: followUpTowReason } =
      deriveStorageFollowUpCondition(storageVehicleCondition, selectedDefects)

    const followUpVehicleData =
      towType === 'single' ? vehicleData : (defectiveVehicleData ?? null)

    const runCreateStorageFollowUp = async (parentTowId: string) => {
      if (
        !hasStorageFollowUp ||
        !followUpAddress?.address?.trim() ||
        !basePriceList?.base_address ||
        !isStorageEligible
      ) {
        return
      }
      const followUpPlate =
        towType === 'single' ? vehiclePlate : (defectiveVehiclePlate ?? '')
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

      await createStorageFollowUpTow({
        parentTowId,
        companyId,
        createdBy: user.id,
        customerId: finalCustomerId ?? null,
        parentPriceMode: priceMode,
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
        customerOrderNumber: inheritCustomerOrderNumber ? (customerOrderNumber || null) : null,
        isWorking: followUpIsWorking,
        towReason: followUpTowReason,
        registrySource: followUpVehicleData?.source ?? null,
      })
    }

    if (editTowId) {
    const childExists = !!followUpChildTowId
    const childPending = followUpChildStatus === 'pending'

    if (childExists && !hasStorageFollowUp && !childPending) {
      setError(STORAGE_FOLLOW_UP_LIVE_BLOCK_MESSAGE)
      setSaving(false)
      return
    }

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
      const plateHint =
        (towType === 'single' && vehiclePlate?.trim()) ||
        (towType === 'exchange' && workingVehiclePlate?.trim()) ||
        null
      const orderLabel = customerOrderNumber?.trim() || editTowId
      const errMessage =
        err instanceof Error ? err.message : String(err ?? 'unknown')
      await logManualActionItem({
        type: 'reservation_sync_failed',
        severity: 'high',
        message: `עדכון שמירת רכב במלאי נכשל בעת עריכת גרירה ${orderLabel} — ייתכן שהשמירה שגויה, נדרשת בדיקה`,
        towId: editTowId,
        relatedEntity: plateHint || editTowId,
        details: { error: errMessage, source: 'useTowSave:edit' },
      })
    }

    // שמירת לוג שינויים — handled inside updateTow (covers all edit entry points)

    await updateTow({ ...towData, towId: editTowId, priceMode })

    try {
      if (childExists && !hasStorageFollowUp && childPending) {
        await updateTowStatus(
          followUpChildTowId!,
          'cancelled',
          STORAGE_FOLLOW_UP_CANCELLED_ON_EDIT
        )
      } else if (
        childExists &&
        hasStorageFollowUp &&
        childPending &&
        followUpAddress?.address?.trim() &&
        basePriceList?.base_address &&
        editFollowUpExistingVehicles?.length
      ) {
        const childVehicle = editFollowUpExistingVehicles[0]
        const followUpPlate =
          towType === 'single' ? vehiclePlate : (defectiveVehiclePlate ?? '')
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

        await updateStorageFollowUpTow({
          childTowId: followUpChildTowId!,
          pickupAddress: basePriceList.base_address,
          pickupLat: basePriceList.base_lat ?? null,
          pickupLng: basePriceList.base_lng ?? null,
          dropoffAddress: followUpAddress.address.trim(),
          dropoffLat: followUpAddress.lat ?? null,
          dropoffLng: followUpAddress.lng ?? null,
          dropoffContactName: followUpContactName?.trim() || '',
          dropoffContactPhone: followUpContactPhone?.trim() || '',
          customerOrderNumber: inheritCustomerOrderNumber
            ? customerOrderNumber || null
            : null,
          requiredTruckTypes,
          isWorking: followUpIsWorking,
          towReason: followUpTowReason,
          vehicle: {
            id: childVehicle.id,
            plateNumber: followUpPlate || childVehicle.plateNumber,
            vehicleCode:
              (towType === 'single' ? vehicleCode : defectiveVehicleCode) || null,
            vehicleType:
              (towType === 'single' ? vehicleType : defectiveVehicleType) || undefined,
            manufacturer: followUpManufacturer,
            model: followUpModel,
            year:
              followUpYear != null && followUpYear !== ''
                ? Number(followUpYear)
                : undefined,
            color: followUpColor,
            registrySource: followUpVehicleData?.source ?? null,
          },
          existingPointIds: editFollowUpExistingPoints ?? [],
        })
      } else if (!childExists && hasStorageFollowUp) {
        await runCreateStorageFollowUp(editTowId)
      }
    } catch (followUpError) {
      console.error('[useTowSave] storage follow-up sync failed:', followUpError)
      const detail =
        followUpError instanceof Error
          ? followUpError.message
          : 'סנכרון גרירת ההמשך נכשל'
      setSaveWarning?.(`הגרירה נשמרה, אך ${detail}`)
    }

    router.push(`/dashboard/tows/${editTowId}`)
    } else {
      const result = await createTow(towData)

      try {
        await flushStorageYardConfirmLogs?.(result.id)
      } catch (yardLogErr) {
        console.error('[useTowSave] flush storage yard confirm logs failed:', yardLogErr)
      }

      if (preSelectedDriverId && preSelectedTruckId) {
        try {
          // Only seed a permanent assignment if the driver has none yet.
          // insertDriverTruckAssignments is idempotent against the unique index,
          // so a concurrent seed is a benign no-op rather than a thrown error.
          if (!(await driverHasCurrentAssignment(preSelectedDriverId))) {
            await insertDriverTruckAssignments(preSelectedDriverId, [preSelectedTruckId])
          }
        } catch (err) {
          console.error('Failed to create permanent driver-truck assignment:', err)
        }
      }

      const shouldCreateFollowUp =
        hasStorageFollowUp &&
        followUpAddress?.address?.trim() &&
        basePriceList?.base_address &&
        isStorageEligible

      if (shouldCreateFollowUp && followUpAddress) {
        try {
          await runCreateStorageFollowUp(result.id)
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
        void syncTowToLegacyCalendar(result.id)
      }

      if (fromRequestId && companyId) {
        try {
          await markCustomerTowRequestConverted(companyId, fromRequestId, result.id)
        } catch (convertErr) {
          console.error('Failed to mark customer tow request as converted:', convertErr)
          setSaveWarning?.('הגרירה נוצרה, אך סימון הבקשה כטופלה נכשל — רענן ובדוק')
        }
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
