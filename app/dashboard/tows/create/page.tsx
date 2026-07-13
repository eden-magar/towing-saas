'use client'

/// <reference types="google.maps" />
declare global {
  interface Window {
    google: typeof google
  }
}

import { Suspense, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getDayTows } from '../../../lib/queries/calendar'
import { TowWithDetails } from '../../../lib/queries/tows'
import {
  ArrowRight,
  ArrowLeftRight,
  Check,
  Car,
  Truck,
  Route,
  MapPinned,
  MapPin,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  Calendar,
  Loader2,
  Info,
  X,
  User,
  AlertTriangle,
  PenLine,
  Coins,
  Wallet,
  LayoutGrid,
} from 'lucide-react'
import {
  useTowForm,
  findDropoffRouteStop,
  findPickupRouteStop,
  type RouteRole,
  type RouteStop,
} from '../../../hooks/useTowForm'
import { AddressInput } from '../../../components/tow-forms/routes/AddressInput'
import { yardFromBasePriceList } from '../../../lib/utils/storage-yard-match'
import {
  PinDropModal,
  VehicleLookup,
  ServiceSurchargeSelector,
  ManualSurchargeSection,
  VehicleCoreLookupChips,
} from '../../../components/tow-forms/shared'
import { DriverCalendarPicker } from '../../../components/DriverCalendarPicker'
import { RouteBuilder } from '../../../components/tow-forms/routes/RouteBuilder'
import { StorageFollowUpSection } from '../../../components/tow-forms/StorageFollowUpSection'
import { StorageTakeOutConfirmModal } from '../../../components/tow-forms/StorageTakeOutConfirmModal'
import { CreateCustomerSection } from '../../../components/tow-forms/sections/CreateCustomerSection'
import {
  FromRequestFieldLegend,
  addressInputStatusClass,
  inputWrapperStatusClass,
  withRequestFieldClass,
} from '../../../components/tow-forms/shared/RequestFieldTag'
import { TowCreateWizard } from '../../../components/tow-wizard/TowCreateWizard'
import { ColumnLayout } from './ColumnLayout'
import { FormCard, FormSubcard, Input } from '../../../components/ui'
import { PhoneInput } from '../../../components/ui/PhoneInput'
import { lookupVehicle } from '../../../lib/vehicle-lookup'
import { normalizePlate } from '../../../lib/utils/plate-number'
import { shouldTriggerPlateLookupOnBlur } from '../../../lib/utils/plate-lookup-blur'
import {
  buildCalendarViewSnapshotForScheduledDate,
  persistCalendarViewForReturn,
} from '../../../lib/utils/calendar-view-session'
import { mergePriceLists, resolveDeadheadRate } from '../../../lib/utils/price-calculator'
import {
  getActiveTimeSurchargeSummary,
  getTimeSurchargeLabel,
} from '../../../lib/utils/time-surcharge-summary'
import {
  DEFECT_OPTIONS,
  OTHER_DEFECT_VALUE,
  applyOtherText,
  defectOptionClassName,
  extractOtherText,
  hydrateDefectsFromTowReason,
  isOtherSelected,
  serializeDefects,
} from '../../../lib/constants/defects'
import { getTowTypeLabel } from '../../../lib/utils/tow-type-labels'
import { getTruckTypeLabel } from '../../../lib/utils/truck-type-labels'
import { createCustomer } from '../../../lib/queries/customers'
import { approveTowQuote, createTow, updateTow } from '../../../lib/queries/tows'
import {
  reserveVehicleForTow,
  unreserveVehicleFromTow,
  getVehiclesReservedForTow,
  isPickableStoredVehicle,
} from '../../../lib/queries/storage'
import {
  CUSTOM_TOW_EDIT_WIPE_BLOCKED_MESSAGE,
  isCustomTowEditWipeBlocked,
  prepareTowData,
} from '../../../lib/utils/tow-save-handler'
import type { AddressData } from '../../../lib/google-maps'
import type { SelectedService } from '../../../components/tow-forms/shared'
import type { RoutePoint } from '../../../components/tow-forms/routes/RouteBuilder'
import { getActiveTimeSurcharges } from '../../../lib/queries/price-lists'
import type { TimeSurcharge, LocationSurcharge, ServiceSurcharge } from '../../../lib/queries/price-lists'
import type { StoredVehicleWithCustomer } from '../../../lib/queries/storage'
import { TimeInStoragePill } from '../../../components/storage/TimeInStoragePill'
import { StorageVehiclePickerModal } from '../../../components/storage/StorageVehiclePickerModal'
import type { VehicleLookupResult, VehicleType } from '../../../lib/types'
import { useAuth } from '../../../lib/AuthContext'
import {
  canApproveQuote,
  canEditClosedTow,
  isClosedTowStatus,
} from '../../../lib/utils/can-edit-closed-tow'
import { EventTowSection } from '../../../components/event-forms/EventTowSection'
import { ContactNameAutocomplete } from '../../../components/customer-contacts/ContactNameAutocomplete'
import { SaveCustomerContactPill } from '../../../components/customer-contacts/SaveCustomerContactPill'
import {
  SaveCustomerAddressControl,
  type CustomerAddressPendingDraft,
} from '../../../components/customer-addresses/SaveCustomerAddressControl'
import { FlashNotice, useFlashNotice } from '../../../components/ui/FlashNotice'
import { CustomerContactFields } from '../../../components/customer-contacts/CustomerContactFields'
import { useCustomerContacts } from '../../../hooks/useCustomerContacts'
import { useCustomerAddresses } from '../../../hooks/useCustomerAddresses'
import { useCustomerOrderers } from '../../../hooks/useCustomerOrderers'
import {
  findMatchingCustomerContact,
  insertPendingCustomerContacts,
} from '../../../lib/queries/customer-contacts'
import {
  insertPendingCustomerAddresses,
  pendingAddressFromFields,
} from '../../../lib/queries/customer-addresses'
import { insertPendingCustomerOrderers } from '../../../lib/queries/customer-orderers'
import { shouldOfferSaveCustomerContact } from '../../../lib/utils/customer-contact-save-ui'
import { shouldOfferSaveCustomerAddress } from '../../../lib/utils/customer-address-save-ui'
import { shouldOfferSaveCustomerOrderer } from '../../../lib/utils/customer-orderer-save-ui'

type TowEntryKind = 'single' | 'exchange' | 'custom' | 'events' | null

function VehicleRegistryStatusBanner({
  status,
}: {
  status?: VehicleLookupResult['registryStatus']
}) {
  if (status === 'cancelled') {
    return (
      <div className="mb-2 rounded-xl border border-red-200 bg-red-50 p-3">
        <p className="text-sm font-medium text-red-700">
          ⚠ הרכב מבוטל סופית במאגרי משרד התחבורה ואינו כשיר לנסיעה
        </p>
      </div>
    )
  }
  if (status === 'inactive') {
    return (
      <div className="mb-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
        <p className="text-sm font-medium text-yellow-800">
          ⚠ הרכב אינו מופיע כרכב פעיל במאגר — ייתכן שהושבת או שרישויו לא חודש
        </p>
      </div>
    )
  }
  return null
}

// ==================== Create Tow Form ====================

function CreateTowForm({
  editTowId,
  duplicateFromId,
  duplicateFromEventId,
  fromRequestId,
  dateParam,
  timeParam,
  driverParam,
}: {
  editTowId?: string
  duplicateFromId?: string
  duplicateFromEventId?: string
  fromRequestId?: string
  dateParam: string | null
  timeParam: string | null
  driverParam: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const storedVehicleParam = searchParams.get('storedVehicle')
  const persistCustomerContactsRef = useRef<() => Promise<void>>(async () => {})
  const persistCustomerAddressesRef = useRef<() => Promise<number>>(async () => 0)
  const persistCustomerOrderersRef = useRef<() => Promise<void>>(async () => {})
  const form = useTowForm(editTowId, {
    beforeSaveTow: async () => {
      await persistCustomerContactsRef.current()
      await persistCustomerAddressesRef.current()
      await persistCustomerOrderersRef.current()
    },
    duplicateFromTowId: duplicateFromId,
    fromRequestId,
  })

  const {
    router: _router,
    companyId,
    showAssignNowModal,
    savedTowId,
    saving,
    setSaving,
    error,
    setError,
    saveWarning,
    customers,
    customersLoading,
    drivers,
    customerIdsWithPersonalPricing,
    selectedCustomerPricing,
    selectedCustomerId,
    preSelectedDriverId,
    setPreSelectedDriverId,
    preSelectedTruckId,
    setPreSelectedTruckId,
    trucks,
    basePriceList,
    fixedPriceItems,
    setSelectedCustomerPricing,
    locationSurchargesData,
    serviceSurchargesData,
    selectedLocationSurcharges,
    setSelectedLocationSurcharges,
    selectedServices,
    setSelectedServices,
    towServiceSurcharges,
    setTowServiceSurcharges,
    manualSurcharges,
    setManualSurcharges,
    isHoliday,
    setIsHoliday,
    activeTimeSurchargesList,
    setActiveTimeSurchargesList,
    hasManualTimeSurchargeOverride,
    setHasManualTimeSurchargeOverride,
    timeSurchargesData,
    priceMode,
    setPriceMode,
    selectedPriceItem,
    setSelectedPriceItem,
    customPrice,
    setCustomPrice,
    customPriceIncludesVat,
    setCustomPriceIncludesVat,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    setCustomerEmail,
    setCustomerAddress,
    towDate,
    setTowDate,
    towTime,
    setTowTime,
    towEndDate,
    setTowEndDate,
    towEndTime,
    setTowEndTime,
    isToday,
    setIsToday,
    towType,
    selectTowType,
    routePoints,
    setRoutePoints,
    routeSeedVersion,
    customRouteData,
    setCustomRouteData,
    vehiclePlate,
    setVehiclePlate,
    vehicleCode,
    setVehicleCode,
    vehicleData,
    setVehicleData,
    vehicleType,
    setVehicleType,
    vehicleLookupNotFound,
    setVehicleLookupNotFound,
    requiredTruckTypes,
    setRequiredTruckTypes,
    truckTypeError,
    setTruckTypeError,
    truckTypeSectionRef,
    manualManufacturer,
    setManualManufacturer,
    manualColor,
    setManualColor,
    manualWeight,
    setManualWeight,
    manualChassis,
    setManualChassis,
    customerStoredVehicles,
    selectedStoredVehicleId,
    setSelectedStoredVehicleId,
    dropoffToStorage,
    setDropoffToStorage,
    hasStorageFollowUp,
    setHasStorageFollowUp,
    inheritCustomerOrderNumber,
    setInheritCustomerOrderNumber,
    followUpAddress,
    setFollowUpAddress,
    followUpContactName,
    setFollowUpContactName,
    followUpContactPhone,
    setFollowUpContactPhone,
    followUpChildTowId,
    followUpChildStatus,
    storageVehicleCondition,
    setStorageVehicleCondition,
    workingVehicleSource,
    setWorkingVehicleSource,
    selectedWorkingVehicleId,
    setSelectedWorkingVehicleId,
    workingVehiclePlate,
    setWorkingVehiclePlate,
    workingVehicleData,
    setWorkingVehicleData,
    workingVehicleType,
    setWorkingVehicleType,
    workingVehicleCode,
    setWorkingVehicleCode,
    workingVehicleNotFound,
    setWorkingVehicleNotFound,
    workingManualManufacturer,
    setWorkingManualManufacturer,
    workingManualColor,
    setWorkingManualColor,
    workingManualWeight,
    setWorkingManualWeight,
    workingManualChassis,
    setWorkingManualChassis,
    workingVehicleDestinationIsStorage,
    setWorkingVehicleDestinationIsStorage,
    workingSelectedServices,
    setWorkingSelectedServices,
    workingVehicleAddress,
    setWorkingVehicleAddress,
    exchangeAddress,
    setExchangeAddress,
    exchangeTotalDistance,
    exchangeContactName,
    setExchangeContactName,
    exchangeContactPhone,
    setExchangeContactPhone,
    workingDestinationContact,
    setWorkingDestinationContact,
    workingDestinationContactPhone,
    setWorkingDestinationContactPhone,
    workingVehicleContact,
    setWorkingVehicleContact,
    workingVehicleContactPhone,
    setWorkingVehicleContactPhone,
    workingVehicleDestinationAddress,
    setWorkingVehicleDestinationAddress,
    defectiveDestinationContact,
    setDefectiveDestinationContact,
    defectiveDestinationContactPhone,
    setDefectiveDestinationContactPhone,
    defectiveVehiclePlate,
    setDefectiveVehiclePlate,
    defectiveVehicleData,
    setDefectiveVehicleData,
    defectiveVehicleType,
    setDefectiveVehicleType,
    defectiveVehicleCode,
    setDefectiveVehicleCode,
    defectiveVehicleNotFound,
    setDefectiveVehicleNotFound,
    defectiveManualManufacturer,
    setDefectiveManualManufacturer,
    defectiveManualColor,
    setDefectiveManualColor,
    defectiveManualWeight,
    setDefectiveManualWeight,
    defectiveManualChassis,
    setDefectiveManualChassis,
    defectiveFaultDescription,
    setDefectiveFaultDescription,
    hasSecondTruck,
    setHasSecondTruck,
    defectiveTruckTypes,
    setDefectiveTruckTypes,
    defectiveSelectedServices,
    setDefectiveSelectedServices,
    defectiveDestination,
    setDefectiveDestination,
    defectiveDestinationAddress,
    setDefectiveDestinationAddress,
    routeStops,
    addStop,
    removeStop,
    moveStopUp,
    moveStopDown,
    updateStop,
    distance,
    distanceLoading,
    startFromBase,
    setStartFromBase,
    baseToPickupDistance,
    baseToPickupLoading,
    chargeDeadheadReturn,
    setChargeDeadheadReturn,
    dropoffToBaseDistance,
    dropoffToBaseLoading,
    customerOrderNumber,
    setCustomerOrderNumber,
    customerOrderNumberFromStorage,
    department,
    setDepartment,
    orderedBy,
    setOrderedBy,
    orderNumber,
    isDuplicateLoad,
    isFromRequestLoad,
    fromRequestOtherDefectText,
    getRequestFieldStatus,
    loadedTowStatus,
    setLoadedTowStatus,
    editExistingVehicles,
    editExistingPoints,
    editTowSnapshot,
    stopsBeforeExchange,
    stopsAfterExchange,
    getExchangeEditPriceBaselineSignature,
    getExchangeRouteLayout,
    notes,
    setNotes,
    selectedDefects,
    setSelectedDefects,
    invoiceName,
    setInvoiceName,
    paymentMethod,
    setPaymentMethod,
    pinDropModal,
    setPinDropModal,
    pinDropResult,
    setPinDropResult,
    recommendedPrice,
    finalPrice,
    priceResult,
    vatPercent,
    manualAdjustmentPercent, setManualAdjustmentPercent,
    manualAdjustmentType, setManualAdjustmentType,
    handleCustomerSelect,
    handleSelectStoredVehicle,
    handleClearStoredVehicle,
    handleVehiclePlateInputChange,
    handleDefectiveVehiclePlateInputChange,
    tryResolveStoredPlateForSlot,
    storageTakeOutPrompt,
    confirmStorageTakeOut,
    cancelStorageTakeOut,
    handleSelectWorkingVehicle,
    handleClearWorkingVehicle,
    handlePinDropConfirm,
    copyFromCustomer,
    resetForm,
    handleSave,
    setSavedTowId,
    setShowAssignNowModal,
  } = form

  // Local state for new form
  const [customerTab, setCustomerTab] = useState<'existing' | 'casual'>('existing')
  const [customerSearch, setCustomerSearch] = useState('')

  // זיהוי מובייל — mirror of app/dashboard/calendar/page.tsx isMobile pattern.
  // Defaults to false so SSR/first paint render the desktop path (no hydration mismatch).
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const isBusinessCustomer =
    customerTab === 'existing' &&
    !!selectedCustomerId &&
    customers.find((c) => c.id === selectedCustomerId)?.customer_type === 'business'

  const displayTimeSurcharges =
    priceMode === 'recommended_customer' &&
    (selectedCustomerPricing?.customer_time_surcharges?.length ?? 0) > 0
      ? selectedCustomerPricing!.customer_time_surcharges!
      : timeSurchargesData

  const usesCompanyTimeFallback =
    priceMode === 'recommended_customer' &&
    !!selectedCustomerPricing &&
    (selectedCustomerPricing?.customer_time_surcharges?.length ?? 0) === 0

  const [entryKind, setEntryKind] = useState<TowEntryKind>(null)
  const [useColumnLayout, setUseColumnLayout] = useState(false)
  const isDuplicateEventLoad = Boolean(duplicateFromEventId)

  const handleHydrateCustomerFromEvent = useCallback(
    (customer: {
      id: string | null
      name: string
      phone: string
      email?: string
      address?: string
    }) => {
      handleCustomerSelect(customer.id, customer.name, customer.phone)
      setCustomerEmail(customer.email ?? '')
      setCustomerAddress(customer.address ?? '')
    },
    [handleCustomerSelect, setCustomerEmail, setCustomerAddress]
  )

  useEffect(() => {
    if (!duplicateFromEventId) return
    setEntryKind('events')
    const now = new Date()
    setTowDate(now.toISOString().split('T')[0])
    setTowTime(now.toTimeString().slice(0, 5))
    setTowEndTime('')
    setIsToday(true)
  }, [
    duplicateFromEventId,
    setTowDate,
    setTowTime,
    setTowEndTime,
    setIsToday,
  ])
  const [quoteApproved, setQuoteApproved] = useState(false)
  const [quoteDeclined, setQuoteDeclined] = useState(false)
  const [quoteSavedId, setQuoteSavedId] = useState<string | null>(null)
  const [approvingQuote, setApprovingQuote] = useState(false)
  const [defectiveLookupLoading, setDefectiveLookupLoading] = useState(false)
  const [workingLookupLoading, setWorkingLookupLoading] = useState(false)
  const [showDriverPicker, setShowDriverPicker] = useState(false)
  const [pendingPickerDriverId, setPendingPickerDriverId] = useState<string | null>(null)
  const [pendingPickerDate, setPendingPickerDate] = useState<string | null>(null)
  const [pendingPickerTime, setPendingPickerTime] = useState<string | null>(null)
  const [pendingPickerTruckId, setPendingPickerTruckId] = useState<string | null>(null)
  const [savePickupContactToCustomer, setSavePickupContactToCustomer] = useState(false)
  const [saveDropoffContactToCustomer, setSaveDropoffContactToCustomer] = useState(false)
  const [saveWorkingSourceContactToCustomer, setSaveWorkingSourceContactToCustomer] =
    useState(false)
  const [saveWorkingDestinationContactToCustomer, setSaveWorkingDestinationContactToCustomer] =
    useState(false)
  const [saveExchangePickupContactToCustomer, setSaveExchangePickupContactToCustomer] =
    useState(false)
  const [saveDefectiveDestinationContactToCustomer, setSaveDefectiveDestinationContactToCustomer] =
    useState(false)
  const [saveCustomPointContacts, setSaveCustomPointContacts] = useState<Record<string, boolean>>(
    {}
  )

  const [pendingPickupAddress, setPendingPickupAddress] =
    useState<CustomerAddressPendingDraft | null>(null)
  const [pendingDropoffAddress, setPendingDropoffAddress] =
    useState<CustomerAddressPendingDraft | null>(null)
  const [pendingStopAddresses, setPendingStopAddresses] = useState<
    Record<string, CustomerAddressPendingDraft>
  >({})
  const [pendingWorkingSourceAddress, setPendingWorkingSourceAddress] =
    useState<CustomerAddressPendingDraft | null>(null)
  const [pendingWorkingDestinationAddress, setPendingWorkingDestinationAddress] =
    useState<CustomerAddressPendingDraft | null>(null)
  const [pendingExchangePickupAddress, setPendingExchangePickupAddress] =
    useState<CustomerAddressPendingDraft | null>(null)
  const [pendingDefectiveDestinationAddress, setPendingDefectiveDestinationAddress] =
    useState<CustomerAddressPendingDraft | null>(null)
  const [pendingFollowUpAddress, setPendingFollowUpAddress] =
    useState<CustomerAddressPendingDraft | null>(null)
  const [pendingCustomPointAddresses, setPendingCustomPointAddresses] = useState<
    Record<string, CustomerAddressPendingDraft>
  >({})
  const setPendingStopAddress = useCallback(
    (stopId: string, draft: CustomerAddressPendingDraft | null) => {
      setPendingStopAddresses((prev) => {
        if (!draft) {
          const { [stopId]: _removed, ...rest } = prev
          return rest
        }
        return { ...prev, [stopId]: draft }
      })
    },
    []
  )
  const setPendingCustomPointAddress = useCallback(
    (pointId: string, draft: CustomerAddressPendingDraft | null) => {
      setPendingCustomPointAddresses((prev) => {
        if (!draft) {
          const { [pointId]: _removed, ...rest } = prev
          return rest
        }
        return { ...prev, [pointId]: draft }
      })
    },
    []
  )
  const { notice: addressNotice, setNotice: setAddressNotice } = useFlashNotice()

  const { savedContacts, contactsLoading } = useCustomerContacts(
    companyId,
    selectedCustomerId
  )

  const { savedAddresses, addressesLoading } = useCustomerAddresses(
    companyId,
    selectedCustomerId
  )

  const { savedOrderers, orderersLoading } = useCustomerOrderers(
    companyId,
    isBusinessCustomer ? selectedCustomerId : null
  )

  const [saveOrdererToCustomer, setSaveOrdererToCustomer] = useState(false)

  const showSaveOrdererOption = shouldOfferSaveCustomerOrderer(
    isBusinessCustomer,
    selectedCustomerId,
    department,
    orderedBy,
    savedOrderers
  )

  const pickupStop = useMemo(() => findPickupRouteStop(routeStops), [routeStops])
  const dropoffStop = useMemo(() => findDropoffRouteStop(routeStops), [routeStops])
  const pickupContactName = pickupStop?.contactName ?? ''
  const pickupContactPhone = pickupStop?.contactPhone ?? ''
  const dropoffContactName = dropoffStop?.contactName ?? ''
  const dropoffContactPhone = dropoffStop?.contactPhone ?? ''

  const vehiclePlateStatus = getRequestFieldStatus('vehiclePlate', vehiclePlate)
  const manualManufacturerStatus = getRequestFieldStatus('manualManufacturer', manualManufacturer)
  const manualColorStatus = getRequestFieldStatus('manualColor', manualColor)
  const vehicleTypeStatus = getRequestFieldStatus('vehicleType', vehicleType)
  const defectsStatus = getRequestFieldStatus('selectedDefects', selectedDefects)
  const notesStatus = getRequestFieldStatus('notes', notes)
  const pickupContactNameStatus = getRequestFieldStatus('pickupContactName', pickupContactName)
  const pickupContactPhoneStatus = getRequestFieldStatus('pickupContactPhone', pickupContactPhone)
  const dropoffContactNameStatus = getRequestFieldStatus('dropoffContactName', dropoffContactName)
  const dropoffContactPhoneStatus = getRequestFieldStatus('dropoffContactPhone', dropoffContactPhone)

  const showSavePickupContactOption = Boolean(
    selectedCustomerId &&
      pickupContactName.trim() &&
      !findMatchingCustomerContact(
        pickupContactName,
        pickupContactPhone,
        savedContacts
      )
  )

  const showSaveDropoffContactOption = shouldOfferSaveCustomerContact(
    selectedCustomerId,
    dropoffContactName,
    dropoffContactPhone,
    savedContacts
  )

  const showSaveWorkingSourceContactOption = shouldOfferSaveCustomerContact(
    selectedCustomerId,
    workingVehicleContact,
    workingVehicleContactPhone,
    savedContacts
  )

  const showSaveWorkingDestinationContactOption = shouldOfferSaveCustomerContact(
    selectedCustomerId,
    workingDestinationContact,
    workingDestinationContactPhone,
    savedContacts
  )

  const showSaveExchangePickupContactOption = shouldOfferSaveCustomerContact(
    selectedCustomerId,
    exchangeContactName,
    exchangeContactPhone,
    savedContacts
  )

  const showSaveDefectiveDestinationContactOption = shouldOfferSaveCustomerContact(
    selectedCustomerId,
    defectiveDestinationContact,
    defectiveDestinationContactPhone,
    savedContacts
  )

  const pickupAddressText = pickupStop?.address?.address ?? ''
  const dropoffAddressText = dropoffStop?.address?.address ?? ''

  const showSavePickupAddressOption = shouldOfferSaveCustomerAddress(
    selectedCustomerId,
    pickupAddressText,
    savedAddresses
  )
  const showSaveDropoffAddressOption = shouldOfferSaveCustomerAddress(
    selectedCustomerId,
    dropoffAddressText,
    savedAddresses
  )

  const showSaveWorkingSourceAddressOption = shouldOfferSaveCustomerAddress(
    selectedCustomerId,
    workingVehicleAddress?.address ?? '',
    savedAddresses
  )
  const showSaveWorkingDestinationAddressOption = shouldOfferSaveCustomerAddress(
    selectedCustomerId,
    workingVehicleDestinationAddress?.address ?? '',
    savedAddresses
  )
  const showSaveExchangePickupAddressOption = shouldOfferSaveCustomerAddress(
    selectedCustomerId,
    exchangeAddress?.address ?? '',
    savedAddresses
  )
  const showSaveDefectiveDestinationAddressOption = shouldOfferSaveCustomerAddress(
    selectedCustomerId,
    defectiveDestinationAddress?.address ?? '',
    savedAddresses
  )
  const showSaveFollowUpAddressOption = shouldOfferSaveCustomerAddress(
    selectedCustomerId,
    followUpAddress?.address ?? '',
    savedAddresses
  )

  useEffect(() => {
    setSavePickupContactToCustomer(false)
    setSaveDropoffContactToCustomer(false)
    setSaveWorkingSourceContactToCustomer(false)
    setSaveWorkingDestinationContactToCustomer(false)
    setSaveExchangePickupContactToCustomer(false)
    setSaveDefectiveDestinationContactToCustomer(false)
    setSaveCustomPointContacts({})
    setSaveOrdererToCustomer(false)
    setPendingPickupAddress(null)
    setPendingDropoffAddress(null)
    setPendingStopAddresses({})
    setPendingWorkingSourceAddress(null)
    setPendingWorkingDestinationAddress(null)
    setPendingExchangePickupAddress(null)
    setPendingDefectiveDestinationAddress(null)
    setPendingFollowUpAddress(null)
    setPendingCustomPointAddresses({})
  }, [selectedCustomerId])

  useEffect(() => {
    if (!showSaveOrdererOption) {
      setSaveOrdererToCustomer(false)
    }
  }, [showSaveOrdererOption])

  useEffect(() => {
    if (!showSavePickupContactOption) {
      setSavePickupContactToCustomer(false)
    }
  }, [showSavePickupContactOption])

  useEffect(() => {
    if (!showSaveDropoffContactOption) {
      setSaveDropoffContactToCustomer(false)
    }
  }, [showSaveDropoffContactOption])

  useEffect(() => {
    if (!showSaveWorkingSourceContactOption) {
      setSaveWorkingSourceContactToCustomer(false)
    }
  }, [showSaveWorkingSourceContactOption])

  useEffect(() => {
    if (!showSaveWorkingDestinationContactOption) {
      setSaveWorkingDestinationContactToCustomer(false)
    }
  }, [showSaveWorkingDestinationContactOption])

  useEffect(() => {
    if (!showSaveExchangePickupContactOption) {
      setSaveExchangePickupContactToCustomer(false)
    }
  }, [showSaveExchangePickupContactOption])

  useEffect(() => {
    if (!showSaveDefectiveDestinationContactOption) {
      setSaveDefectiveDestinationContactToCustomer(false)
    }
  }, [showSaveDefectiveDestinationContactOption])

  useEffect(() => {
    if (!showSavePickupAddressOption) setPendingPickupAddress(null)
  }, [showSavePickupAddressOption])

  useEffect(() => {
    if (!showSaveDropoffAddressOption) setPendingDropoffAddress(null)
  }, [showSaveDropoffAddressOption])

  useEffect(() => {
    if (!showSaveWorkingSourceAddressOption) setPendingWorkingSourceAddress(null)
  }, [showSaveWorkingSourceAddressOption])

  useEffect(() => {
    if (!showSaveWorkingDestinationAddressOption) setPendingWorkingDestinationAddress(null)
  }, [showSaveWorkingDestinationAddressOption])

  useEffect(() => {
    if (!showSaveExchangePickupAddressOption) setPendingExchangePickupAddress(null)
  }, [showSaveExchangePickupAddressOption])

  useEffect(() => {
    if (!showSaveDefectiveDestinationAddressOption) setPendingDefectiveDestinationAddress(null)
  }, [showSaveDefectiveDestinationAddressOption])

  useEffect(() => {
    if (!showSaveFollowUpAddressOption) setPendingFollowUpAddress(null)
  }, [showSaveFollowUpAddressOption])

  const toggleCustomPointSaveContact = useCallback((pointId: string) => {
    setSaveCustomPointContacts((prev) => ({
      ...prev,
      [pointId]: !prev[pointId],
    }))
  }, [])

  const clearCustomPointSaveContact = useCallback((pointId: string) => {
    setSaveCustomPointContacts((prev) => ({
      ...prev,
      [pointId]: false,
    }))
  }, [])

  const persistTowCustomerContacts = useCallback(async () => {
    if (!companyId || !selectedCustomerId) return

    const pending: { name: string; phone: string | null }[] = []

    if (towType === 'single') {
      if (savePickupContactToCustomer && pickupContactName.trim()) {
        pending.push({
          name: pickupContactName.trim(),
          phone: pickupContactPhone.trim() || null,
        })
      }
      if (saveDropoffContactToCustomer && dropoffContactName.trim()) {
        pending.push({
          name: dropoffContactName.trim(),
          phone: dropoffContactPhone.trim() || null,
        })
      }
    }

    if (towType === 'exchange') {
      if (saveWorkingSourceContactToCustomer && workingVehicleContact.trim()) {
        pending.push({
          name: workingVehicleContact.trim(),
          phone: workingVehicleContactPhone.trim() || null,
        })
      }
      if (saveWorkingDestinationContactToCustomer && workingDestinationContact.trim()) {
        pending.push({
          name: workingDestinationContact.trim(),
          phone: workingDestinationContactPhone.trim() || null,
        })
      }
      if (saveExchangePickupContactToCustomer && exchangeContactName.trim()) {
        pending.push({
          name: exchangeContactName.trim(),
          phone: exchangeContactPhone.trim() || null,
        })
      }
      if (saveDefectiveDestinationContactToCustomer && defectiveDestinationContact.trim()) {
        pending.push({
          name: defectiveDestinationContact.trim(),
          phone: defectiveDestinationContactPhone.trim() || null,
        })
      }
    }

    if (towType === 'custom') {
      for (const point of routePoints) {
        if (point.type === 'base') continue
        if (saveCustomPointContacts[point.id] && point.contactName.trim()) {
          pending.push({
            name: point.contactName.trim(),
            phone: point.contactPhone.trim() || null,
          })
        }
      }
    }

    if (pending.length === 0) return
    await insertPendingCustomerContacts(companyId, selectedCustomerId, pending)
  }, [
    companyId,
    selectedCustomerId,
    towType,
    savePickupContactToCustomer,
    saveDropoffContactToCustomer,
    pickupContactName,
    pickupContactPhone,
    dropoffContactName,
    dropoffContactPhone,
    saveWorkingSourceContactToCustomer,
    saveWorkingDestinationContactToCustomer,
    saveExchangePickupContactToCustomer,
    saveDefectiveDestinationContactToCustomer,
    workingVehicleContact,
    workingVehicleContactPhone,
    workingDestinationContact,
    workingDestinationContactPhone,
    exchangeContactName,
    exchangeContactPhone,
    defectiveDestinationContact,
    defectiveDestinationContactPhone,
    routePoints,
    saveCustomPointContacts,
  ])

  useEffect(() => {
    persistCustomerContactsRef.current = persistTowCustomerContacts
  }, [persistTowCustomerContacts])

  const persistTowCustomerAddresses = useCallback(async () => {
    if (!companyId || !selectedCustomerId) return 0

    const pending = [] as NonNullable<ReturnType<typeof pendingAddressFromFields>>[]

    if (towType === 'single') {
      if (pendingPickupAddress && pickupStop) {
        const item = pendingAddressFromFields(
          pendingPickupAddress.label,
          pickupStop.address?.address ?? '',
          {
            placeId: pickupStop.address?.placeId,
            lat: pickupStop.address?.lat,
            lng: pickupStop.address?.lng,
            notes: pendingPickupAddress.notes || null,
          }
        )
        if (item) pending.push(item)
      }
      if (pendingDropoffAddress && dropoffStop) {
        const item = pendingAddressFromFields(
          pendingDropoffAddress.label,
          dropoffStop.address?.address ?? '',
          {
            placeId: dropoffStop.address?.placeId,
            lat: dropoffStop.address?.lat,
            lng: dropoffStop.address?.lng,
            notes: pendingDropoffAddress.notes || null,
          }
        )
        if (item) pending.push(item)
      }
      for (const stop of routeStops) {
        if (stop.role !== 'stop') continue
        const draft = pendingStopAddresses[stop.id]
        if (!draft) continue
        const item = pendingAddressFromFields(
          draft.label,
          stop.address?.address ?? '',
          {
            placeId: stop.address?.placeId,
            lat: stop.address?.lat,
            lng: stop.address?.lng,
            notes: draft.notes || null,
          }
        )
        if (item) pending.push(item)
      }
      if (pendingFollowUpAddress) {
        const item = pendingAddressFromFields(
          pendingFollowUpAddress.label,
          followUpAddress?.address ?? '',
          {
            placeId: followUpAddress?.placeId,
            lat: followUpAddress?.lat,
            lng: followUpAddress?.lng,
            notes: pendingFollowUpAddress.notes || null,
          }
        )
        if (item) pending.push(item)
      }
    }

    if (towType === 'exchange') {
      if (pendingWorkingSourceAddress) {
        const item = pendingAddressFromFields(
          pendingWorkingSourceAddress.label,
          workingVehicleAddress?.address ?? '',
          {
            placeId: workingVehicleAddress?.placeId,
            lat: workingVehicleAddress?.lat,
            lng: workingVehicleAddress?.lng,
            notes: pendingWorkingSourceAddress.notes || null,
          }
        )
        if (item) pending.push(item)
      }
      if (pendingWorkingDestinationAddress) {
        const item = pendingAddressFromFields(
          pendingWorkingDestinationAddress.label,
          workingVehicleDestinationAddress?.address ?? '',
          {
            placeId: workingVehicleDestinationAddress?.placeId,
            lat: workingVehicleDestinationAddress?.lat,
            lng: workingVehicleDestinationAddress?.lng,
            notes: pendingWorkingDestinationAddress.notes || null,
          }
        )
        if (item) pending.push(item)
      }
      if (pendingExchangePickupAddress) {
        const item = pendingAddressFromFields(
          pendingExchangePickupAddress.label,
          exchangeAddress?.address ?? '',
          {
            placeId: exchangeAddress?.placeId,
            lat: exchangeAddress?.lat,
            lng: exchangeAddress?.lng,
            notes: pendingExchangePickupAddress.notes || null,
          }
        )
        if (item) pending.push(item)
      }
      if (pendingDefectiveDestinationAddress) {
        const item = pendingAddressFromFields(
          pendingDefectiveDestinationAddress.label,
          defectiveDestinationAddress?.address ?? '',
          {
            placeId: defectiveDestinationAddress?.placeId,
            lat: defectiveDestinationAddress?.lat,
            lng: defectiveDestinationAddress?.lng,
            notes: pendingDefectiveDestinationAddress.notes || null,
          }
        )
        if (item) pending.push(item)
      }
      if (pendingFollowUpAddress) {
        const item = pendingAddressFromFields(
          pendingFollowUpAddress.label,
          followUpAddress?.address ?? '',
          {
            placeId: followUpAddress?.placeId,
            lat: followUpAddress?.lat,
            lng: followUpAddress?.lng,
            notes: pendingFollowUpAddress.notes || null,
          }
        )
        if (item) pending.push(item)
      }
    }

    if (towType === 'custom') {
      for (const point of routePoints) {
        if (point.type === 'base') continue
        const draft = pendingCustomPointAddresses[point.id]
        if (!draft) continue
        const item = pendingAddressFromFields(
          draft.label,
          point.address ?? '',
          {
            placeId: point.addressData?.placeId,
            lat: point.addressData?.lat,
            lng: point.addressData?.lng,
            notes: draft.notes || null,
          }
        )
        if (item) pending.push(item)
      }
    }

    if (pending.length === 0) return 0
    await insertPendingCustomerAddresses(companyId, selectedCustomerId, pending)
    return pending.length
  }, [
    companyId,
    selectedCustomerId,
    towType,
    pendingPickupAddress,
    pendingDropoffAddress,
    pickupStop,
    dropoffStop,
    routeStops,
    pendingStopAddresses,
    pendingWorkingSourceAddress,
    pendingWorkingDestinationAddress,
    pendingExchangePickupAddress,
    pendingDefectiveDestinationAddress,
    pendingFollowUpAddress,
    workingVehicleAddress,
    workingVehicleDestinationAddress,
    exchangeAddress,
    defectiveDestinationAddress,
    followUpAddress,
    routePoints,
    pendingCustomPointAddresses,
  ])

  const lastPersistedAddressCountRef = useRef(0)

  useEffect(() => {
    persistCustomerAddressesRef.current = async () => {
      const count = await persistTowCustomerAddresses()
      lastPersistedAddressCountRef.current = count
      return count
    }
  }, [persistTowCustomerAddresses])

  useEffect(() => {
    if (!showAssignNowModal) return
    const count = lastPersistedAddressCountRef.current
    if (count > 0) {
      setAddressNotice(count === 1 ? 'הכתובת נשמרה ללקוח' : 'הכתובות נשמרו ללקוח')
    }
  }, [showAssignNowModal, setAddressNotice])

  const persistTowCustomerOrderers = useCallback(async () => {
    if (!companyId || !selectedCustomerId || !isBusinessCustomer) return
    if (!saveOrdererToCustomer || !orderedBy.trim()) return

    await insertPendingCustomerOrderers(companyId, selectedCustomerId, [
      {
        department: department || null,
        name: orderedBy.trim(),
      },
    ])
  }, [
    companyId,
    selectedCustomerId,
    isBusinessCustomer,
    saveOrdererToCustomer,
    department,
    orderedBy,
  ])

  useEffect(() => {
    persistCustomerOrderersRef.current = persistTowCustomerOrderers
  }, [persistTowCustomerOrderers])

  const getDriverTrucks = (driverId: string) =>
    trucks.filter((t) => (t.assigned_drivers ?? []).some((d) => d.id === driverId))

  const truckPickerFromUrlAppliedRef = useRef(false)
  const openedTruckPickerFromUrlRef = useRef(false)

  const closeDriverPicker = () => {
    if (openedTruckPickerFromUrlRef.current) {
      setPreSelectedDriverId(null)
      setPreSelectedTruckId(null)
      openedTruckPickerFromUrlRef.current = false
    }
    setShowDriverPicker(false)
    setPendingPickerDriverId(null)
    setPendingPickerDate(null)
    setPendingPickerTime(null)
    setPendingPickerTruckId(null)
  }

  const openDriverPicker = () => {
    setPendingPickerDriverId(null)
    setPendingPickerDate(null)
    setPendingPickerTime(null)
    setPendingPickerTruckId(null)
    setShowDriverPicker(true)
  }
  const [plateStorageWarning, setPlateStorageWarning] = useState<string | null>(null)
  const [showTruckModal, setShowTruckModal] = useState(false)
  const [showDefectsModal, setShowDefectsModal] = useState(false)
  const [showDefectsExchangeModal, setShowDefectsExchangeModal] = useState(false)
  const [showWorkingServicesModal, setShowWorkingServicesModal] = useState(false)
  const [showDefectiveServicesModal, setShowDefectiveServicesModal] = useState(false)
  const [showStorageModal, setShowStorageModal] = useState(false)
  const [showWorkingStorageModal, setShowWorkingStorageModal] = useState(false)
  const [otherDefectText, setOtherDefectText] = useState('')
  useEffect(() => {
    if (!fromRequestOtherDefectText) return
    setOtherDefectText(fromRequestOtherDefectText)
  }, [fromRequestOtherDefectText])
  const [stopContactModalId, setStopContactModalId] = useState<string | null>(null)
  const [stopContactDraft, setStopContactDraft] = useState({ name: '', phone: '' })
  const [expandedStopNotesIds, setExpandedStopNotesIds] = useState<Set<string>>(
    () => new Set()
  )

  const routeRoleLabel = (role: RouteRole) => {
    if (role === 'pickup') return 'מוצא'
    if (role === 'dropoff') return 'יעד'
    return 'נקודת עצירה'
  }

  const hasIntermediateStops = routeStops.some((s) => s.role === 'stop')

  const openStopContactModal = (stop: RouteStop) => {
    setStopContactModalId(stop.id)
    setStopContactDraft({
      name: stop.contactName ?? '',
      phone: stop.contactPhone ?? '',
    })
  }

  const saveStopContactModal = () => {
    if (stopContactModalId) {
      updateStop(stopContactModalId, {
        contactName: stopContactDraft.name,
        contactPhone: stopContactDraft.phone,
      })
    }
    setStopContactModalId(null)
  }

  const STOP_SUBTYPE_OPTIONS: Array<{
    value: 'key' | 'customer_pickup' | 'customer_dropoff' | 'other'
    label: string
  }> = [
    { value: 'key', label: 'מפתח' },
    { value: 'customer_pickup', label: 'איסוף לקוח' },
    { value: 'customer_dropoff', label: 'הורדת לקוח' },
    { value: 'other', label: 'אחר' },
  ]

  const getRouteStopHeadingLabel = (stop: RouteStop) => {
    if (stop.role === 'pickup') return 'מוצא'
    if (stop.role === 'dropoff') return 'יעד'
    const stopIndex = routeStops.findIndex((s) => s.id === stop.id)
    const stopOrdinal = routeStops
      .slice(0, stopIndex + 1)
      .filter((s) => s.role === 'stop').length
    return `עצירה ${stopOrdinal}`
  }

  const isStopNotesExpanded = (stop: RouteStop) =>
    !!(stop.orderNotes?.trim()) || expandedStopNotesIds.has(stop.id)

  const renderRouteStopFields = (stop: RouteStop) => {
    const dropoffRow = findDropoffRouteStop(routeStops)
    const isLastDropoff = stop.role === 'dropoff' && stop.id === dropoffRow?.id
    const routeAddressStatus =
      stop.role === 'pickup'
        ? getRequestFieldStatus('pickupAddress', stop.address?.address ?? '')
        : stop.role === 'dropoff'
          ? getRequestFieldStatus('dropoffAddress', stop.address?.address ?? '')
          : null

    return (
      <div className="space-y-3 w-full">
        <div className="flex items-center justify-between gap-2 min-h-[1.25rem]">
          <span className="text-xs font-semibold text-gt-text-secondary">
            {getRouteStopHeadingLabel(stop)}
          </span>
          {stop.role === 'stop' && (
            <button
              type="button"
              onClick={() => removeStop(stop.id)}
              className={
                isMobile
                  ? 'p-2.5 text-gt-text-tertiary hover:text-red-500 shrink-0'
                  : 'p-1 text-gt-text-tertiary hover:text-red-500 shrink-0'
              }
              aria-label="הסר נקודת עצירה"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <AddressInput
          value={stop.address}
          onChange={(d: AddressData) => updateStop(stop.id, { address: d })}
          label={routeRoleLabel(stop.role)}
          hideLabel
          onPinDropClick={() => handlePinDropOpen(`routestop:${stop.id}`)}
          className={addressInputStatusClass(
            '[&_input]:h-10 [&_input]:border-gt-border [&_input]:focus:border-gt-brand [&_input]:focus:ring-[3px] [&_input]:focus:ring-gt-brand/15 [&_button]:h-10 [&_button]:border-gt-border [&_button]:px-3',
            routeAddressStatus,
          )}
          storageYardConfirm={
            stop.role === 'pickup'
              ? pickupYardConfirm
              : isLastDropoff
                ? dropoffYardConfirm
                : null
          }
        />
        {stop.role === 'pickup' && (
          <SaveCustomerAddressControl
            visible={showSavePickupAddressOption}
            address={stop.address?.address ?? ''}
            pending={pendingPickupAddress}
            onConfirm={setPendingPickupAddress}
            onClear={() => setPendingPickupAddress(null)}
            disabled={saving}
          />
        )}
        {stop.role === 'dropoff' && (
          <SaveCustomerAddressControl
            visible={showSaveDropoffAddressOption}
            address={stop.address?.address ?? ''}
            pending={pendingDropoffAddress}
            onConfirm={setPendingDropoffAddress}
            onClear={() => setPendingDropoffAddress(null)}
            disabled={saving}
          />
        )}
        {stop.role === 'stop' && (
          <SaveCustomerAddressControl
            visible={shouldOfferSaveCustomerAddress(
              selectedCustomerId,
              stop.address?.address ?? '',
              savedAddresses
            )}
            address={stop.address?.address ?? ''}
            pending={pendingStopAddresses[stop.id] ?? null}
            onConfirm={(draft) => setPendingStopAddress(stop.id, draft)}
            onClear={() => setPendingStopAddress(stop.id, null)}
            disabled={saving}
          />
        )}

        {stop.role === 'stop' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {STOP_SUBTYPE_OPTIONS.map((option) => {
                const selected = (stop.stopSubtype ?? 'other') === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateStop(stop.id, { stopSubtype: option.value })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? 'bg-gt-brand text-white border-gt-brand'
                        : 'bg-white text-gt-text-secondary border-gt-border hover:border-gt-brand'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            {(stop.stopSubtype ?? 'other') === 'other' && (
              <input
                type="text"
                value={stop.notes ?? ''}
                onChange={(e) => updateStop(stop.id, { notes: e.target.value })}
                placeholder="פרטים נוספים"
                className="w-full max-w-xs h-10 px-3 border border-gt-border rounded-xl text-sm focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15"
              />
            )}
            {isStopNotesExpanded(stop) ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gt-text-tertiary">
                  הערות לעצירה
                </label>
                <textarea
                  value={stop.orderNotes ?? ''}
                  onChange={(e) => updateStop(stop.id, { orderNotes: e.target.value })}
                  placeholder="מידע לנהג לגבי העצירה"
                  rows={2}
                  className="w-full px-3 py-2 border border-gt-border rounded-xl text-sm focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15 resize-none"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setExpandedStopNotesIds((prev) => {
                    const next = new Set(prev)
                    next.add(stop.id)
                    return next
                  })
                }
                className="text-xs text-gt-text-tertiary hover:text-gt-text-secondary"
              >
                + הערות לעצירה
              </button>
            )}
          </div>
        )}

        {stop.role === 'pickup' && (
          <button
            type="button"
            onClick={() => setStartFromBase(!startFromBase)}
            className={`inline-flex px-3 py-1.5 rounded-lg text-sm border font-medium ${
              startFromBase
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gt-border-subtle bg-gt-surface-subtle text-gt-text-tertiary'
            }`}
          >
            יציאה מהחניון
          </button>
        )}

        {isLastDropoff && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-start gap-2">
              <button
                type="button"
                onClick={() => {
                  if (dropoffToStorage) {
                    setDropoffToStorage(false)
                    updateStop(stop.id, { address: { address: '' } })
                    setHasStorageFollowUp(false)
                    setFollowUpAddress({ address: '' })
                    setFollowUpContactName('')
                    setFollowUpContactPhone('')
                    return
                  }
                  setDropoffToStorage(true)
                  if (storageAddress) {
                    updateStop(stop.id, {
                      address: {
                        address: storageAddress,
                        lat: basePriceList?.base_lat,
                        lng: basePriceList?.base_lng,
                      },
                    })
                  }
                }}
                className={`inline-flex px-3 py-1.5 rounded-lg text-sm border font-medium ${
                  dropoffToStorage
                    ? 'border-purple-300 bg-purple-50 text-purple-700'
                    : 'border-gt-border-subtle bg-gt-surface-subtle text-gt-text-tertiary'
                }`}
              >
                הורדה לאחסנה
              </button>
              {renderDeadheadToggle('pill')}
            </div>
            {dropoffToStorage && (
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-sm text-gray-600">מצב הרכב:</span>
                <button
                  type="button"
                  onClick={() => setStorageVehicleCondition('operational')}
                  className={`px-3 py-1.5 rounded-lg text-sm ${storageVehicleCondition === 'operational' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  תקין
                </button>
                <button
                  type="button"
                  onClick={() => setStorageVehicleCondition('faulty')}
                  className={`px-3 py-1.5 rounded-lg text-sm ${storageVehicleCondition === 'faulty' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  תקול
                </button>
              </div>
            )}
            <StorageFollowUpSection
              editTowId={editTowId}
              storageEligible={dropoffToStorage}
              hasStorageFollowUp={hasStorageFollowUp}
              setHasStorageFollowUp={setHasStorageFollowUp}
              followUpAddress={followUpAddress}
              setFollowUpAddress={setFollowUpAddress}
              followUpContactName={followUpContactName}
              setFollowUpContactName={setFollowUpContactName}
              followUpContactPhone={followUpContactPhone}
              setFollowUpContactPhone={setFollowUpContactPhone}
              inheritCustomerOrderNumber={inheritCustomerOrderNumber}
              setInheritCustomerOrderNumber={setInheritCustomerOrderNumber}
              followUpChildTowId={followUpChildTowId}
              followUpChildStatus={followUpChildStatus}
              onPinDropOpen={() => handlePinDropOpen('followUp')}
              variant="compact"
              showSaveAddressOption={showSaveFollowUpAddressOption}
              pendingAddress={pendingFollowUpAddress}
              onConfirmPendingAddress={setPendingFollowUpAddress}
              onClearPendingAddress={() => setPendingFollowUpAddress(null)}
              saveAddressDisabled={saving}
            />
          </div>
        )}

        {stop.role === 'stop' && (
          <button
            type="button"
            onClick={() => openStopContactModal(stop)}
            className="text-xs border border-gt-border bg-white text-gt-text-secondary hover:border-gt-brand px-2.5 py-1 rounded-lg font-medium"
          >
            {stop.contactName?.trim() ? stop.contactName : 'הוסף איש קשר'}
          </button>
        )}
      </div>
    )
  }

  // URL params (date/time only — driver goes through truck step when ?driver= is present)
  useEffect(() => {
    if (editTowId) return
    if (dateParam) {
      setTowDate(dateParam)
    }
    if (timeParam) setTowTime(timeParam)
  }, [editTowId, dateParam, timeParam])

  useEffect(() => {
    if (truckPickerFromUrlAppliedRef.current) return
    if (editTowId) return

    const driverFromUrl = searchParams.get('driver')
    if (!driverFromUrl) return

    if (!trucks.length && !drivers.length) return

    const dateFromUrl = searchParams.get('date')
    const timeFromUrl = searchParams.get('time')

    setPreSelectedDriverId(null)
    setPreSelectedTruckId(null)

    const driverTrucks = getDriverTrucks(driverFromUrl)
    setPendingPickerDriverId(driverFromUrl)
    setPendingPickerDate(dateFromUrl || towDate || '')
    setPendingPickerTime(timeFromUrl || towTime || '')
    setPendingPickerTruckId(driverTrucks.length === 1 ? driverTrucks[0].id : null)
    setShowDriverPicker(true)
    truckPickerFromUrlAppliedRef.current = true
    openedTruckPickerFromUrlRef.current = true
  }, [searchParams, trucks, drivers, editTowId, towDate, towTime])

  useEffect(() => {
    if (loadedTowStatus !== null && loadedTowStatus !== 'quote') {
      setQuoteApproved(true)
    }
  }, [loadedTowStatus])

  useEffect(() => {
    if (
      editTowId &&
      isClosedTowStatus(loadedTowStatus) &&
      !canEditClosedTow(user?.role)
    ) {
      router.push(`/dashboard/tows/${editTowId}`)
    }
  }, [loadedTowStatus, editTowId, router, user?.role])

  const isEditingClosedTow =
    !!editTowId && isClosedTowStatus(loadedTowStatus)

  const storagePickupEditLocked =
    !!editTowId &&
    (loadedTowStatus === 'in_progress' || loadedTowStatus === 'completed') &&
    !(isEditingClosedTow && canEditClosedTow(user?.role))

  const handleNowClick = () => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    setTowDate(today)
    setTowTime(now.toTimeString().slice(0, 5))
    setIsToday(true)
  }

  const handleEntryKindSelect = (kind: Exclude<TowEntryKind, null>) => {
    setEntryKind(kind)
    if (kind === 'events') {
      selectTowType('')
    } else {
      selectTowType(kind)
    }
  }

  useEffect(() => {
    if (towType === 'single' || towType === 'exchange' || towType === 'custom') {
      setEntryKind(towType)
    }
  }, [towType])

  const handlePinDropOpen = (field: string) => {
    setPinDropModal({ isOpen: true, field })
  }

  const handlePinDropConfirmWrapped = (data: AddressData) => {
    const field = pinDropModal.field
    if (field === 'exchange') setExchangeAddress(data)
    else if (field === 'workingVehicle') setWorkingVehicleAddress(data)
    else if (field === 'workingDestination') setWorkingVehicleDestinationAddress(data)
    else if (field === 'defectiveDestination') setDefectiveDestinationAddress(data)
    else if (field === 'followUp') setFollowUpAddress(data)
    else if (field?.startsWith('routestop:')) {
      const stopId = field.slice('routestop:'.length)
      updateStop(stopId, { address: data })
    } else handlePinDropConfirm(data)
  }

  // Vehicle lookup for single
  const handleVehicleLookup = useCallback(async () => {
    if (vehiclePlate.replace(/[^0-9]/g, '').length < 5) return
    setDefectiveLookupLoading(true)
    try {
      const storedResult = await tryResolveStoredPlateForSlot(
        vehiclePlate,
        'single'
      )
      if (storedResult.status === 'blocked') {
        setPlateStorageWarning(storedResult.message)
        setVehicleData(null)
        setVehicleLookupNotFound(false)
        return
      }
      if (storedResult.status === 'hydrated') {
        setPlateStorageWarning(null)
        return
      }
      setPlateStorageWarning(null)
      const result = await lookupVehicle(vehiclePlate)
      if (result.found && result.data) {
        setVehicleData(result)
        setVehicleType(result.source || 'private')
        setVehicleLookupNotFound(false)
        const cachedCode = result.vehicleCode?.trim()
        if (cachedCode && !vehicleCode.trim()) setVehicleCode(cachedCode)
      } else {
        setVehicleData(null)
        setVehicleType('')
        setVehicleLookupNotFound(true)
        setManualManufacturer('')
        setManualColor('')
        setManualWeight('')
        setManualChassis('')
      }
    } catch {
      setVehicleData(null)
    } finally {
      setDefectiveLookupLoading(false)
    }
  }, [vehiclePlate, vehicleCode, tryResolveStoredPlateForSlot, setVehicleCode])

  const handleWorkingVehicleLookup = useCallback(async (plate?: string) => {
    const resolvedPlate = plate ?? workingVehiclePlate
    if (resolvedPlate.replace(/[^0-9]/g, '').length < 5) return
    setWorkingLookupLoading(true)
    try {
      const storedResult = await tryResolveStoredPlateForSlot(
        resolvedPlate,
        'exchange-working'
      )
      if (storedResult.status === 'blocked') {
        setPlateStorageWarning(storedResult.message)
        setWorkingVehicleData(null)
        setWorkingVehicleNotFound(false)
        return
      }
      if (storedResult.status === 'hydrated') {
        setPlateStorageWarning(null)
        return
      }
      setPlateStorageWarning(null)
      const result = await lookupVehicle(resolvedPlate)
      if (result.found && result.data) {
        setWorkingVehicleData(result)
        setWorkingVehicleType(result.source || 'private')
        setWorkingVehicleNotFound(false)
        const cachedCode = result.vehicleCode?.trim()
        if (cachedCode && !workingVehicleCode.trim()) {
          setWorkingVehicleCode(cachedCode)
        }
      } else {
        setWorkingVehicleData(null)
        setWorkingVehicleType('')
        setWorkingVehicleNotFound(true)
      }
    } catch {
      setWorkingVehicleData(null)
    } finally {
      setWorkingLookupLoading(false)
    }
  }, [
    workingVehiclePlate,
    workingVehicleCode,
    tryResolveStoredPlateForSlot,
    setWorkingVehicleCode,
  ])

  // Vehicle lookup for defective (exchange)
  const handleDefectiveLookup = useCallback(async () => {
    if (defectiveVehiclePlate.replace(/[^0-9]/g, '').length < 5) return
    setDefectiveLookupLoading(true)
    try {
      const storedResult = await tryResolveStoredPlateForSlot(
        defectiveVehiclePlate,
        'exchange-defective'
      )
      if (storedResult.status === 'blocked') {
        setPlateStorageWarning(storedResult.message)
        setDefectiveVehicleData(null)
        setDefectiveVehicleNotFound(false)
        return
      }
      if (storedResult.status === 'hydrated') {
        setPlateStorageWarning(null)
        return
      }
      setPlateStorageWarning(null)
      const result = await lookupVehicle(defectiveVehiclePlate)
      if (result.found && result.data) {
        setDefectiveVehicleData(result)
        setDefectiveVehicleType(result.source || 'private')
        setDefectiveVehicleNotFound(false)
        const cachedCode = result.vehicleCode?.trim()
        if (cachedCode && !defectiveVehicleCode.trim()) {
          setDefectiveVehicleCode(cachedCode)
        }
      } else {
        setDefectiveVehicleData(null)
        setDefectiveVehicleType('')
        setDefectiveVehicleNotFound(true)
      }
    } catch {
      setDefectiveVehicleData(null)
    } finally {
      setDefectiveLookupLoading(false)
    }
  }, [
    defectiveVehiclePlate,
    defectiveVehicleCode,
    tryResolveStoredPlateForSlot,
    setDefectiveVehicleCode,
  ])

  // Vehicle lookup for working (exchange)
  const handleWorkingLookup = useCallback(async () => {
    if (workingVehiclePlate.replace(/[^0-9]/g, '').length < 5) return
    setWorkingLookupLoading(true)
    try {
      const result = await lookupVehicle(workingVehiclePlate)
      if (result.found && result.data) {
        setWorkingVehicleData(result)
        setWorkingVehicleType(result.source || 'private')
        const cachedCode = result.vehicleCode?.trim()
        if (cachedCode && !workingVehicleCode.trim()) {
          setWorkingVehicleCode(cachedCode)
        }
      } else {
        setWorkingVehicleData(null)
      }
    } catch {
      setWorkingVehicleData(null)
    } finally {
      setWorkingLookupLoading(false)
    }
  }, [workingVehiclePlate, workingVehicleCode, setWorkingVehicleCode])

  // Custom save for quote declined
  const handleSaveAsQuote = useCallback(async () => {
    if (editTowId && isClosedTowStatus(loadedTowStatus)) return
    if (!companyId || !user || !towType) return
    if (requiredTruckTypes.length === 0) {
      setTruckTypeError(true)
      setError('יש לבחור סוג גרר נדרש')
      truckTypeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setTruckTypeError(false)
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
      await persistTowCustomerContacts()
      const savedAddressCount = await persistTowCustomerAddresses()

      let finalCustomerId = selectedCustomerId
      if (!selectedCustomerId && customerName.trim()) {
        const result = await createCustomer({
          companyId,
          customerType: 'private',
          name: customerName.trim(),
          phone: customerPhone.trim() || undefined,
          paymentTerms: 'immediate',
        })
        finalCustomerId = result.id
      }
      const plate = vehiclePlate
      const vData = vehicleData
      const vType = vehicleType

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
        towEndDate,
        towEndTime,
        preSelectedDriverId: null,
        vehiclePlate: plate,
        vehicleCode,
        vehicleType: vType,
        vehicleData: vData,
        selectedDefects,
        requiredTruckTypes,
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
        existingTowVehicles: editTowId ? editExistingVehicles : undefined,
        existingTowPoints: editTowId ? editExistingPoints : undefined,
        distance:
          towType === 'custom'
            ? { distanceKm: customRouteData.totalDistanceKm, durationMinutes: 0 }
            : towType === 'exchange'
              ? exchangeTotalDistance ?? null
              : distance,
        startFromBase,
        baseToPickupDistance,
        routePoints,
        customRouteData,
        priceMode,
        finalPrice,
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
        notes,
        paymentMethod: paymentMethod || undefined,
        invoiceName: invoiceName || undefined,
        dropoffToStorage,
        selectedStoredVehicleId,
        workingVehiclePlate: towType === 'exchange' ? workingVehiclePlate : undefined,
        workingVehicleCode: towType === 'exchange' ? workingVehicleCode : undefined,
        workingVehicleData: towType === 'exchange' ? workingVehicleData : undefined,
        workingVehicleType: towType === 'exchange' ? workingVehicleType : undefined,
        defectiveVehicleType:
          towType === 'exchange' ? defectiveVehicleType || undefined : undefined,
        workingVehicleSourceAddress: towType === 'exchange' ? workingVehicleAddress : undefined,
        workingVehicleDestinationAddress: towType === 'exchange' ? workingVehicleDestinationAddress : undefined,
        workingVehicleContactName: towType === 'exchange' ? workingVehicleContact : undefined,
        workingVehicleContactPhone: towType === 'exchange' ? workingVehicleContactPhone : undefined,
        defectiveVehiclePlate: towType === 'exchange' ? defectiveVehiclePlate : undefined,
        defectiveVehicleCode: towType === 'exchange' ? defectiveVehicleCode : undefined,
        defectiveVehicleData: towType === 'exchange' ? defectiveVehicleData : undefined,
        exchangePointAddress: towType === 'exchange' ? exchangeAddress : undefined,
        exchangeContactName: towType === 'exchange' ? exchangeContactName : undefined,
        exchangeContactPhone: towType === 'exchange' ? exchangeContactPhone : undefined,
        workingDestinationContactName: towType === 'exchange' ? workingDestinationContact : undefined,
        workingDestinationContactPhone: towType === 'exchange' ? workingDestinationContactPhone : undefined,
        defectiveDestinationAddress: towType === 'exchange' ? defectiveDestinationAddress : undefined,
        defectiveDestinationContactName: towType === 'exchange' ? defectiveDestinationContact : undefined,
        defectiveDestinationContactPhone: towType === 'exchange' ? defectiveDestinationContactPhone : undefined,
        workingVehicleSource: towType === 'exchange' ? workingVehicleSource : undefined,
        workingVehicleDestinationIsStorage:
          towType === 'exchange' ? workingVehicleDestinationIsStorage : undefined,
        defectiveDestination: towType === 'exchange' ? defectiveDestination : undefined,
        workingSelectedServices:
          towType === 'exchange' ? workingSelectedServices : undefined,
        defectiveSelectedServices:
          towType === 'exchange' ? defectiveSelectedServices : undefined,
        manualManufacturer,
        manualColor,
        manualWeight,
        manualChassis,
        workingManualManufacturer: towType === 'exchange' ? workingManualManufacturer : undefined,
        workingManualColor: towType === 'exchange' ? workingManualColor : undefined,
        workingManualWeight: towType === 'exchange' ? workingManualWeight : undefined,
        workingManualChassis: towType === 'exchange' ? workingManualChassis : undefined,
        defectiveManualManufacturer: towType === 'exchange' ? defectiveManualManufacturer : undefined,
        defectiveManualColor: towType === 'exchange' ? defectiveManualColor : undefined,
        defectiveManualWeight: towType === 'exchange' ? defectiveManualWeight : undefined,
        defectiveManualChassis: towType === 'exchange' ? defectiveManualChassis : undefined,
        ...(editTowId && towType === 'exchange'
          ? {
              existingPriceBreakdown: editTowSnapshot?.price_breakdown ?? null,
              timeSurchargesData,
              isHoliday,
              hasManualTimeSurchargeOverride,
              stopsBeforeExchange,
              stopsAfterExchange,
              exchangeRouteLayout: getExchangeRouteLayout?.() ?? null,
              exchangeEditPriceBaselineSignature:
                getExchangeEditPriceBaselineSignature?.() ?? null,
              exchangeEditOriginalFinalPrice: editTowSnapshot?.final_price ?? null,
            }
          : {}),
      })
      let quoteTowId = editTowId
      if (editTowId) {
        await updateTow({ ...towData, towId: editTowId, status: 'quote', priceMode })
        setQuoteSavedId(editTowId)
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
          console.error('[handleSaveAsQuote] sync storage reservations failed:', err)
        }
      } else {
        const quoteResult = await createTow({ ...towData, status: 'quote' as const })
        quoteTowId = quoteResult.id
        if (quoteTowId) {
          try {
            if (towType === 'single' && selectedStoredVehicleId) {
              await reserveVehicleForTow({
                storedVehicleId: selectedStoredVehicleId,
                towId: quoteTowId,
              })
            }
            if (
              towType === 'exchange' &&
              workingVehicleSource === 'storage' &&
              selectedWorkingVehicleId
            ) {
              await reserveVehicleForTow({
                storedVehicleId: selectedWorkingVehicleId,
                towId: quoteTowId,
              })
            }
          } catch (err) {
            console.error('[handleSaveAsQuote] reserve storage failed:', err)
          }
        }
      }
      if (savedAddressCount > 0) {
        setAddressNotice(
          savedAddressCount === 1 ? 'הכתובת נשמרה ללקוח' : 'הכתובות נשמרו ללקוח'
        )
        setTimeout(() => router.push('/dashboard'), 400)
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      console.error(err)
      setError('שגיאה בשמירת ההצעה')
    } finally {
      setSaving(false)
    }
  }, [
    companyId,
    user,
    towType,
    requiredTruckTypes,
    selectedCustomerId,
    customerName,
    customerPhone,
    towDate,
    towTime,
    vehiclePlate,
    vehicleCode,
    vehicleType,
    vehicleData,
    selectedDefects,
    defectiveVehiclePlate,
    defectiveVehicleData,
    defectiveVehicleType,
    routeStops,
    exchangeAddress,
    defectiveDestinationAddress,
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
    workingSelectedServices,
    defectiveSelectedServices,
    serviceSurchargesData,
    notes,
    paymentMethod,
    invoiceName,
    dropoffToStorage,
    selectedStoredVehicleId,
    workingVehicleSource,
    selectedWorkingVehicleId,
    workingVehicleCode,
    defectiveDestination,
    defectiveVehicleCode,
    editTowId,
    editTowSnapshot,
    stopsBeforeExchange,
    stopsAfterExchange,
    getExchangeEditPriceBaselineSignature,
    getExchangeRouteLayout,
    timeSurchargesData,
    isHoliday,
    hasManualTimeSurchargeOverride,
    priceMode,
    loadedTowStatus,
    persistTowCustomerContacts,
    persistTowCustomerAddresses,
    setAddressNotice,
  ])

  const totalDistanceKm =
    towType === 'custom'
      ? customRouteData.totalDistanceKm
      : (distance?.distanceKm ?? 0) +
        (startFromBase && baseToPickupDistance ? baseToPickupDistance.distanceKm : 0)

  const storageAddress = basePriceList?.base_address || ''
  const storageYard = yardFromBasePriceList(basePriceList)
  const pickupYardConfirm = storageYard
    ? {
        role: 'pickup' as const,
        yard: storageYard,
        alreadyFlagged: startFromBase,
        onConfirm: () => setStartFromBase(true),
        fieldKey: 'create-pickup',
      }
    : null
  const dropoffYardConfirm = storageYard
    ? {
        role: 'dropoff' as const,
        yard: storageYard,
        alreadyFlagged: dropoffToStorage,
        onConfirm: () => {
          setDropoffToStorage(true)
          if (storageAddress) {
            const drop = routeStops.find((s) => s.role === 'dropoff')
            if (drop) {
              updateStop(drop.id, {
                address: {
                  address: storageAddress,
                  lat: basePriceList?.base_lat,
                  lng: basePriceList?.base_lng,
                },
              })
            }
          }
        },
        fieldKey: 'create-dropoff',
      }
    : null
  const workingPickupYardConfirm = storageYard
    ? {
        role: 'pickup' as const,
        yard: storageYard,
        alreadyFlagged:
          workingVehicleSource === 'storage' || startFromBase,
        onConfirm: () => {
          setWorkingVehicleSource('storage')
          setStartFromBase(true)
        },
        fieldKey: 'create-working-origin',
      }
    : null
  const workingDropoffYardConfirm = storageYard
    ? {
        role: 'dropoff' as const,
        yard: storageYard,
        alreadyFlagged: workingVehicleDestinationIsStorage,
        onConfirm: () => {
          setWorkingVehicleDestinationIsStorage(true)
          if (storageAddress) {
            setWorkingVehicleDestinationAddress({
              address: storageAddress,
              lat: basePriceList?.base_lat,
              lng: basePriceList?.base_lng,
            })
          }
        },
        fieldKey: 'create-working-dest',
      }
    : null
  const defectiveDropoffYardConfirm = storageYard
    ? {
        role: 'dropoff' as const,
        yard: storageYard,
        alreadyFlagged: defectiveDestination === 'storage',
        onConfirm: () => {
          setDefectiveDestination('storage')
          if (storageAddress) {
            setDefectiveDestinationAddress({
              address: storageAddress,
              lat: basePriceList?.base_lat,
              lng: basePriceList?.base_lng,
            })
          }
        },
        fieldKey: 'create-defective-dest',
      }
    : null

  // Deadhead (נסיעת סרק): resolve the rate from the active (merged) price list for the hint.
  const activeDeadheadRate = resolveDeadheadRate(
    priceMode === 'recommended_customer'
      ? mergePriceLists(basePriceList, selectedCustomerPricing?.price_list ?? null)
      : basePriceList
  )

  // Single + exchange only; custom intentionally excluded.
  // Rendered beside the "הורדה לאחסנה"/"שמור באחסנה" control so the two storage controls read as a pair.
  const renderDeadheadToggle = (variant: 'pill' | 'compact' = 'pill') => {
    if (towType !== 'single' && towType !== 'exchange') return null
    const buttonClass =
      variant === 'compact'
        ? `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border w-fit font-medium transition-colors ${
            chargeDeadheadReturn
              ? 'border-teal-300 bg-teal-50 text-teal-700'
              : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-teal-300 hover:text-teal-600'
          }`
        : `inline-flex px-3 py-1.5 rounded-lg text-sm border font-medium ${
            chargeDeadheadReturn
              ? 'border-teal-300 bg-teal-50 text-teal-700'
              : 'border-gray-200 bg-gray-50 text-gray-500'
          }`
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setChargeDeadheadReturn(!chargeDeadheadReturn)}
          className={buttonClass}
        >
          חייב נסיעת סרק
        </button>
        {chargeDeadheadReturn && dropoffToBaseLoading && (
          <p className="text-xs text-gray-400">מחשב מרחק חזרה לאחסנה...</p>
        )}
        {chargeDeadheadReturn &&
          !dropoffToBaseLoading &&
          dropoffToBaseDistance?.distanceKm != null && (
            <p className="text-xs text-gray-400">
              מרחק חזרה לאחסנה: {dropoffToBaseDistance.distanceKm.toFixed(1)} ק״מ
            </p>
          )}
        {chargeDeadheadReturn && activeDeadheadRate <= 0 && (
          <p className="text-xs text-amber-600">לא הוגדר מחיר לק״מ סרק במחירון</p>
        )}
      </div>
    )
  }

  const TRUCK_OPTIONS = [
    { value: 'wheel_lift_cradle', label: 'משקפיים' },
    { value: 'flatbed', label: 'רמסע' },
    { value: 'carrier', label: 'מובילית' },
  ] as const

  const openDefectsModal = () => {
    const normalized = hydrateDefectsFromTowReason(serializeDefects(selectedDefects))
    setSelectedDefects(normalized)
    setOtherDefectText(extractOtherText(normalized))
    setShowDefectsModal(true)
  }

  const lockedOpacity = quoteApproved ? 1 : 0.35
  const lockedPointer = quoteApproved ? 'auto' : 'none'

  const handleQuoteApproveClick = useCallback(async () => {
    if (editTowId && loadedTowStatus === 'quote') {
      if (!canApproveQuote(user?.role)) {
        setError('אין הרשאה לאשר הצעות מחיר')
        return
      }
      setApprovingQuote(true)
      setError('')
      try {
        const result = await approveTowQuote(editTowId)
        if (!result.approved) {
          setError(
            result.reason === 'not_quote'
              ? 'ההצעה כבר אושרה או שאינה בהצעת מחיר'
              : 'הגרירה לא נמצאה'
          )
          return
        }
        setLoadedTowStatus(result.newStatus)
      } catch (err) {
        console.error('[handleQuoteApproveClick] approve failed:', err)
        setError('שגיאה באישור ההצעה')
        return
      } finally {
        setApprovingQuote(false)
      }
    }
    setQuoteApproved(true)
  }, [editTowId, loadedTowStatus, user?.role, setError, setLoadedTowStatus])

  const handleBackToCalendar = useCallback(() => {
    if (editTowId && editTowSnapshot?.scheduled_at) {
      const scheduled = new Date(editTowSnapshot.scheduled_at)
      if (!Number.isNaN(scheduled.getTime())) {
        persistCalendarViewForReturn(
          buildCalendarViewSnapshotForScheduledDate(scheduled)
        )
      }
    }
    router.push('/dashboard/calendar')
  }, [editTowId, editTowSnapshot?.scheduled_at, router])

  const towEntryOptions: Array<{
    value: Exclude<TowEntryKind, null>
    label: string
    sub: string
    icon: typeof Truck
  }> = [
    { value: 'single', label: 'גרירה פשוטה', sub: 'A→B', icon: Truck },
    { value: 'exchange', label: 'תקין ↔ תקול', sub: '3 שלבים', icon: ArrowLeftRight },
    { value: 'custom', label: 'מסלול מותאם', sub: 'נקודות חופשיות', icon: Route },
    { value: 'events', label: 'אירועים מיוחדים', sub: 'פינוי רכבים מאירוע', icon: Calendar },
  ]

  // Alternative 4-column layout is opt-in and only for fresh single-tow create.
  // Edit / duplicate / storage deep-links always use the existing linear form.
  const isFreshCreate =
    !editTowId &&
    !duplicateFromId &&
    !duplicateFromEventId &&
    !storedVehicleParam &&
    !fromRequestId

  if (useColumnLayout && isFreshCreate) {
    return (
      <ColumnLayout
        form={form}
        onExitColumnLayout={() => setUseColumnLayout(false)}
        persistContactsRef={persistCustomerContactsRef}
        persistAddressesRef={persistCustomerAddressesRef}
      />
    )
  }

  return (
    <div className="min-h-full bg-gt-canvas -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8" dir="rtl">
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error}
        </div>
      )}
      {saveWarning && (
        <div className="fixed top-4 left-4 right-4 z-50 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl">
          {saveWarning}
        </div>
      )}

      <FlashNotice message={addressNotice} />

      <header className="bg-white border-b border-gray-300">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/tows"
                className={isMobile ? 'p-2.5 text-gray-500 hover:bg-gray-100 rounded-lg' : 'p-2 text-gray-500 hover:bg-gray-100 rounded-lg'}
              >
                <ArrowRight size={20} />
              </Link>
              <button
                type="button"
                onClick={handleBackToCalendar}
                className={isMobile ? 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors' : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors'}
              >
                <Calendar className="w-3.5 h-3.5" />
                חזרה ליומן
              </button>
              <div>
                <h1 className="font-bold text-gray-800 text-base sm:text-lg">
                  {editTowId
                    ? 'עריכת גרירה'
                    : isDuplicateEventLoad
                      ? 'שכפול אירוע'
                      : isDuplicateLoad
                        ? 'שכפול גרירה'
                        : isFromRequestLoad
                          ? 'בקשת לקוח'
                          : 'גרירה חדשה'}
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">
                  {editTowId
                    ? 'עדכון פרטי הגרירה'
                    : isDuplicateEventLoad
                      ? 'אירוע חדש על בסיס אירוע קיים — בדוק ועדכן לפני שמירה'
                      : isDuplicateLoad
                        ? 'גרירה חדשה על בסיס גרירה קיימת — בדוק ועדכן לפני שמירה'
                        : isFromRequestLoad
                          ? 'גרירה חדשה מבקשת לקוח — השלם פרטים חסרים לפני שמירה'
                          : 'מילוי פרטי הגרירה'}
                </p>
              </div>
            </div>
            {isFreshCreate && !isMobile && (
              <button
                type="button"
                onClick={() => setUseColumnLayout(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                טופס רוחבי
              </button>
            )}
          </div>
        </div>
      </header>

      {isFromRequestLoad && (
        <div className="max-w-5xl mx-auto pt-3">
          <FromRequestFieldLegend />
        </div>
      )}

      <div className="py-4 sm:py-6 flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
        <div className="w-[680px] max-w-full">
          {/* Section 1 — לקוח */}
          <CreateCustomerSection
            customers={customers}
            customersLoading={customersLoading}
            customerIdsWithPersonalPricing={customerIdsWithPersonalPricing}
            selectedCustomerPricing={selectedCustomerPricing}
            selectedCustomerId={selectedCustomerId}
            customerTab={customerTab}
            onCustomerTabChange={setCustomerTab}
            customerSearch={customerSearch}
            onCustomerSearchChange={setCustomerSearch}
            customerName={customerName}
            customerPhone={customerPhone}
            onCustomerNameChange={setCustomerName}
            onCustomerPhoneChange={setCustomerPhone}
            onCustomerSelect={handleCustomerSelect}
            customerStoredVehicles={customerStoredVehicles}
            towDate={towDate}
            towTime={towTime}
            towEndDate={towEndDate}
            towEndTime={towEndTime}
            onTowDateChange={setTowDate}
            onTowTimeChange={setTowTime}
            onTowEndDateChange={setTowEndDate}
            onTowEndTimeChange={setTowEndTime}
            onNowClick={handleNowClick}
            customerOrderNumber={customerOrderNumber}
            onCustomerOrderNumberChange={setCustomerOrderNumber}
            customerOrderNumberFromStorage={customerOrderNumberFromStorage}
            isBusinessCustomer={isBusinessCustomer}
            department={department}
            onDepartmentChange={setDepartment}
            orderedBy={orderedBy}
            onOrderedByChange={setOrderedBy}
            savedOrderers={savedOrderers}
            orderersLoading={orderersLoading}
            showSaveOrdererPill={showSaveOrdererOption}
            saveOrdererToCustomer={saveOrdererToCustomer}
            onSaveOrdererToggle={() => setSaveOrdererToCustomer((v) => !v)}
            onOrdererSelected={() => setSaveOrdererToCustomer(false)}
            editTowId={editTowId}
            orderNumber={orderNumber}
            getRequestFieldStatus={getRequestFieldStatus}
          />

          {/* Section 2 — סוג גרירה */}
          <FormCard
            icon={MapPinned}
            title="סוג גרירה"
            description={entryKind ? undefined : 'בחר את אופי המשימה'}
          >
            {storedVehicleParam && !editTowId && !entryKind && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                <Info size={18} className="shrink-0 mt-0.5 text-cyan-600" />
                <p>
                  פותחת גרירה לרכב מהאחסנה — בחרי סוג גרירה כדי לראות את הפרטים
                  הממולאים אוטומטית
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {towEntryOptions.map((option) => {
                const Icon = option.icon
                const isActive = entryKind === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleEntryKindSelect(option.value)}
                    className={
                      isActive
                        ? 'relative p-3 rounded-lg border border-gt-brand bg-gt-brand-subtle ring-1 ring-gt-brand transition-all duration-150'
                        : 'relative p-3 rounded-lg border border-gt-border bg-white hover:border-gt-border-strong hover:bg-gt-surface-hover transition-all duration-150'
                    }
                  >
                    <div className={
                      isActive
                        ? 'w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center bg-white text-gt-brand'
                        : 'w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center bg-gt-surface-subtle text-gt-text-secondary'
                    }>
                      <Icon size={16} />
                    </div>
                    <div className={
                      isActive
                        ? 'text-sm font-semibold text-gt-brand-text'
                        : 'text-sm font-semibold text-gt-text-primary'
                    }>
                      {option.label}
                    </div>
                    <div className={
                      isActive
                        ? 'text-[11px] mt-0.5 text-gt-brand-text opacity-75'
                        : 'text-[11px] mt-0.5 text-gt-text-tertiary'
                    }>
                      {option.sub}
                    </div>
                  </button>
                )
              })}
            </div>
          </FormCard>

          {entryKind === 'events' && (
            <EventTowSection
              selectedCustomerId={selectedCustomerId}
              customerName={customerName}
              customerPhone={customerPhone}
              towDate={towDate}
              towTime={towTime}
              towEndTime={towEndTime}
              duplicateFromEventId={duplicateFromEventId}
              onHydrateCustomer={handleHydrateCustomerFromEvent}
            />
          )}

          {/* Section 4 — רכב ומסלול */}
          {towType && (
            <FormCard
              icon={Car}
              title="רכב ומסלול"
              description={towType ? undefined : 'פרטי הרכב, תקלות, גרר ונקודות מסלול'}
            >
              <div className="space-y-4">
                {towType === 'single' && (
                  <>
                    {/* Block 1 — פרטי רכב */}
                    <FormSubcard
                      title="פרטי רכב"
                      className={
                        vehicleData?.found && vehicleData.data
                          ? withRequestFieldClass('', vehiclePlateStatus)
                          : undefined
                      }
                    >
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              מספר רכב
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={vehiclePlate}
                                onChange={(e) => { handleVehiclePlateInputChange(e.target.value); setPlateStorageWarning(null) }}
                                onBlur={async (e) => {
                                  const val = e.target.value.trim()
                                  if (
                                    shouldTriggerPlateLookupOnBlur(val, {
                                      hasFoundData: vehicleData?.found,
                                      lookupAlreadyFailed: vehicleLookupNotFound,
                                    })
                                  ) {
                                    handleVehicleLookup()
                                  }
                                }}
                                placeholder="1234567"
                                className={withRequestFieldClass(
                                  'flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-mono tracking-widest',
                                  vehiclePlateStatus,
                                )}
                              />
                              <button
                                type="button"
                                onClick={handleVehicleLookup}
                                disabled={
                                  vehiclePlate.replace(/[^0-9]/g, '').length < 5 ||
                                  defectiveLookupLoading
                                }
                                className="px-4 py-2.5 bg-gt-brand text-white rounded-xl text-sm font-medium hover:bg-gt-brand-hover"
                              >
                                {defectiveLookupLoading ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  'בדיקת רישוי'
                                )}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPlateStorageWarning(null)
                                setVehicleData(null)
                                setVehicleLookupNotFound(true)
                                setVehicleType('')
                                setManualManufacturer('')
                                setManualColor('')
                                setManualWeight('')
                                setManualChassis('')
                              }}
                              className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                              הזן פרטי רכב ידנית
                            </button>
                            {plateStorageWarning && (
                              <p className="text-sm text-red-500 mt-1">{plateStorageWarning}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">קוד רכב</label>
                            <input type="text" value={vehicleCode}
                              onChange={(e) => setVehicleCode(e.target.value)}
                              placeholder="אופציונלי"
                              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                          </div>
                        </div>
                        {storagePickupEditLocked && (
                          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                            לא ניתן לשנות פרטי איסוף מאחסנה — הגרירה כבר התחילה
                          </p>
                        )}
                        <div className="flex justify-end">
                          {selectedCustomerId && customerStoredVehicles.length > 0 && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={storagePickupEditLocked}
                                onClick={() => setShowStorageModal(true)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                  selectedStoredVehicleId
                                    ? 'border-green-400 bg-green-50 text-green-700'
                                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                                }`}
                              >
                                🏪 {selectedStoredVehicleId
                                  ? `מאחסנה: ${customerStoredVehicles.find((v) => v.id === selectedStoredVehicleId)?.plate_number}`
                                  : 'בחר מאחסנה'}
                              </button>
                              {selectedStoredVehicleId && (
                                <button
                                  type="button"
                                  onClick={handleClearStoredVehicle}
                                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {vehicleData?.found && vehicleData.data && (
                          <div>
                            <VehicleRegistryStatusBanner status={vehicleData.registryStatus} />
                            {!vehicleData.registryStatus && (
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                              <span className="text-xs font-medium text-green-700">נמצא במאגר הרשמי</span>
                              {vehicleData.sourceLabel && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                                  {vehicleData.sourceLabel}
                                </span>
                              )}
                            </div>
                            )}
                            {vehicleData.registryStatus && vehicleData.sourceLabel && (
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                  {vehicleData.sourceLabel}
                                </span>
                              </div>
                            )}
                            <VehicleCoreLookupChips
                              source={vehicleData.source}
                              data={vehicleData.data}
                              vehicleType={vehicleType}
                            />
                          </div>
                        )}
                        {vehicleLookupNotFound && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                            <p className="text-sm text-amber-700 font-medium">הרכב לא נמצא במאגר — יש למלא ידנית</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">סוג רכב *</label>
                                <select
                                  value={vehicleType}
                                  onChange={(e) => setVehicleType(e.target.value as any)}
                                  className={withRequestFieldClass(
                                    'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm',
                                    vehicleTypeStatus,
                                  )}
                                >
                                  <option value="">בחר סוג רכב</option>
                                  <option value="private">פרטי</option>
                                  <option value="suv">ג&apos;יפ / SUV</option>
                                  <option value="truck">משאית</option>
                                  <option value="heavy">צמ&quot;ה</option>
                                  <option value="motorcycle">אופנוע</option>
                                  <option value="bus">אוטובוס / מיניבוס</option>
                                  <option value="van">רכב מסחרי</option>
                                  <option value="other">אחר</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">יצרן</label>
                                <input
                                  type="text"
                                  value={manualManufacturer}
                                  onChange={(e) => setManualManufacturer(e.target.value)}
                                  placeholder="למשל: טויוטה"
                                  className={withRequestFieldClass(
                                    'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm',
                                    manualManufacturerStatus,
                                  )}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">צבע</label>
                                <input
                                  type="text"
                                  value={manualColor}
                                  onChange={(e) => setManualColor(e.target.value)}
                                  placeholder="למשל: לבן"
                                  className={withRequestFieldClass(
                                    'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm',
                                    manualColorStatus,
                                  )}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">מספר שלדה</label>
                                <input
                                  type="text"
                                  value={manualChassis}
                                  onChange={(e) => setManualChassis(e.target.value)}
                                  placeholder="אופציונלי"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">
                                  {(vehicleType as string) === 'van' ? 'משקל (ק״ג) *' : 'משקל (ק"ג)'}
                                </label>
                                <input type="number" value={manualWeight}
                                  onChange={(e) => setManualWeight(e.target.value)}
                                  placeholder={(vehicleType as string) === 'van' ? 'חובה לרכב מסחרי' : 'אופציונלי'}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                                {(vehicleType as string) === 'van' && (!manualWeight || Number(manualWeight) === 0) && (
                                  <p className="text-sm text-red-500 mt-1">יש להזין משקל כדי לחשב מחיר לרכב מסחרי</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </FormSubcard>

                    {/* Block 2 — תקלות וגרר */}
                    <div ref={truckTypeSectionRef}>
                      <FormSubcard title="תקלות וגרר">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={openDefectsModal}
                            className={
                              defectsStatus
                                ? withRequestFieldClass(
                                    'w-full py-3 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors text-gray-700',
                                    defectsStatus,
                                  )
                                : `w-full py-3 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                                    selectedDefects.length > 0
                                      ? 'border-red-400 bg-red-50 text-red-700'
                                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                  }`
                            }
                          >
                            🔧 {selectedDefects.length > 0 ? `תקלות (${selectedDefects.length})` : 'בחר תקלות'}
                          </button>
                          {vehicleData === null && !vehicleLookupNotFound ? (
                            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 px-2 py-3 text-center text-sm text-gray-400">
                              סוג הגרר יופיע לאחר בדיקת רישוי
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowTruckModal(true)}
                              className={`w-full py-3 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                                requiredTruckTypes.length > 0
                                  ? 'border-gt-brand bg-gt-brand-subtle text-gt-brand-text'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              🚛{' '}
                              {requiredTruckTypes.length > 0
                                ? requiredTruckTypes
                                    .map((t) => TRUCK_OPTIONS.find((o) => o.value === t)?.label)
                                    .filter(Boolean)
                                    .join(', ')
                                : 'סוג גרר נדרש'}
                            </button>
                          )}
                        </div>
                        {vehicleData?.data?.driveType?.includes?.('קדמית') && (
                          <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded-lg mt-3">
                            מומלץ: רמסע (רכב עם הנעה קדמית)
                          </p>
                        )}
                      </FormSubcard>
                    </div>

                    {/* Block 3 — כתובות ומסלול */}
                    <FormSubcard title="כתובות ומסלול">
                      <div className="space-y-4">
                        {!hasIntermediateStops ? (
                          (() => {
                            const pickupRow = findPickupRouteStop(routeStops)
                            const dropoffRow = findDropoffRouteStop(routeStops)
                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {pickupRow && (
                                  <div key={pickupRow.id}>{renderRouteStopFields(pickupRow)}</div>
                                )}
                                {dropoffRow && (
                                  <div key={dropoffRow.id}>{renderRouteStopFields(dropoffRow)}</div>
                                )}
                              </div>
                            )
                          })()
                        ) : (
                          <div className="space-y-3">
                            {routeStops.map((stop, index) => (
                              <div
                                key={stop.id}
                                className="flex gap-3 items-start rounded-lg border border-gt-border-subtle bg-white p-3"
                              >
                                <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => moveStopUp(stop.id)}
                                    disabled={index === 0}
                                    className={`${isMobile ? 'w-10 h-10' : 'w-7 h-7'} inline-flex items-center justify-center rounded-lg border border-gt-border text-gt-text-secondary hover:text-gt-brand hover:border-gt-brand disabled:opacity-30 disabled:cursor-not-allowed`}
                                    aria-label="הזז למעלה"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <span className="text-[11px] font-semibold text-gt-text-tertiary tabular-nums">
                                    {index + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => moveStopDown(stop.id)}
                                    disabled={index === routeStops.length - 1}
                                    className={`${isMobile ? 'w-10 h-10' : 'w-7 h-7'} inline-flex items-center justify-center rounded-lg border border-gt-border text-gt-text-secondary hover:text-gt-brand hover:border-gt-brand disabled:opacity-30 disabled:cursor-not-allowed`}
                                    aria-label="הזז למטה"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="flex-1 min-w-0 max-w-md">
                                  {renderRouteStopFields(stop)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={addStop}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gt-brand text-gt-brand text-sm font-medium hover:bg-gt-brand-subtle transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          הוסף נקודת עצירה
                        </button>
                        {distanceLoading ? (
                          <p className="text-sm text-gray-500">מחשב מרחק...</p>
                        ) : (
                          <p className="text-sm font-medium">
                            מרחק כולל: {totalDistanceKm.toFixed(1)} ק״מ
                          </p>
                        )}
                        <div className="border-t border-gray-100 pt-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <LocationSurchargesSection
                              locationSurchargesData={locationSurchargesData}
                              selectedLocationSurcharges={selectedLocationSurcharges}
                              setSelectedLocationSurcharges={
                                setSelectedLocationSurcharges
                              }
                            />
                            <ServiceSurchargeSelector
                              services={serviceSurchargesData}
                              selectedServices={selectedServices}
                              onChange={setSelectedServices}
                            />
                          </div>
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <ManualSurchargeSection
                              manualSurcharges={manualSurcharges}
                              onChange={setManualSurcharges}
                            />
                          </div>
                        </div>
                      </div>
                    </FormSubcard>

                    {/* Block 4 — תוספות זמן */}
                    <FormSubcard title="תוספות זמן">
                      <TimeSurchargesSection
                        timeSurchargesData={displayTimeSurcharges}
                        towDate={towDate}
                        towTime={towTime}
                        isHoliday={isHoliday}
                        setIsHoliday={setIsHoliday}
                        activeTimeSurchargesList={activeTimeSurchargesList}
                        setActiveTimeSurchargesList={setActiveTimeSurchargesList}
                        setHasManualTimeSurchargeOverride={setHasManualTimeSurchargeOverride}
                      />
                    </FormSubcard>

                    {showDefectsModal && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className={isMobile ? 'bg-white rounded-2xl shadow-2xl w-full max-w-full' : 'bg-white rounded-2xl shadow-2xl w-[480px]'}>
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-base">בחר תקלות</h3>
                            <button
                              type="button"
                              onClick={() => setShowDefectsModal(false)}
                              className={`text-gray-400 hover:text-gray-600 text-xl leading-none${isMobile ? ' p-2 -m-2' : ''}`}
                            >
                              ✕
                            </button>
                          </div>
                          <div className="p-4 grid grid-cols-3 gap-3">
                            {DEFECT_OPTIONS.map((defect) => {
                              const Icon = defect.icon
                              const selected =
                                defect.value === OTHER_DEFECT_VALUE
                                  ? isOtherSelected(selectedDefects)
                                  : selectedDefects.includes(defect.value)
                              return (
                              <button
                                key={defect.value}
                                type="button"
                                onClick={() => {
                                  setSelectedDefects((prev) => {
                                    if (defect.value === OTHER_DEFECT_VALUE) {
                                      if (isOtherSelected(prev)) {
                                        setOtherDefectText('')
                                        return prev.filter(
                                          (d) =>
                                            d !== OTHER_DEFECT_VALUE &&
                                            !d.startsWith('אחר:')
                                        )
                                      }
                                      return [...prev, OTHER_DEFECT_VALUE]
                                    }
                                    return prev.includes(defect.value)
                                      ? prev.filter((d) => d !== defect.value)
                                      : [...prev, defect.value]
                                  })
                                }}
                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm transition-colors ${defectOptionClassName(selected, defect.highlight, 'grid')}`}
                              >
                                <Icon className="h-6 w-6 shrink-0" aria-hidden />
                                <span className="text-xs font-medium text-center leading-tight">{defect.label}</span>
                              </button>
                              )
                            })}
                          </div>
                          {isOtherSelected(selectedDefects) && (
                            <div className="mt-3 px-1">
                              <label className="block">תיאור התקלה:</label>
                              <input
                                type="text"
                                value={otherDefectText}
                                onChange={(e) => setOtherDefectText(e.target.value)}
                                placeholder="תאר את התקלה..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}
                          <div className="px-4 pb-4 pt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDefects((prev) =>
                                  isOtherSelected(prev)
                                    ? applyOtherText(prev, otherDefectText)
                                    : prev
                                )
                                setShowDefectsModal(false)
                              }}
                              className="flex-1 py-2.5 bg-gt-brand text-white rounded-xl font-medium text-sm"
                            >
                              אישור
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDefectsModal(false)}
                              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm"
                            >
                              ביטול
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {showTruckModal && (vehicleData !== null || vehicleLookupNotFound) && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-[320px]">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-base">סוג גרר נדרש</h3>
                            <button
                              type="button"
                              onClick={() => setShowTruckModal(false)}
                              className={`text-gray-400 hover:text-gray-600 text-xl leading-none${isMobile ? ' p-2 -m-2' : ''}`}
                            >
                              ✕
                            </button>
                          </div>
                          <div className="p-4 grid grid-cols-3 gap-2">
                            {TRUCK_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  const current = requiredTruckTypes.filter((t) => t !== opt.value)
                                  if (requiredTruckTypes.includes(opt.value)) setRequiredTruckTypes(current)
                                  else setRequiredTruckTypes([...current, opt.value])
                                }}
                                className={`py-4 px-2 rounded-xl border-2 text-sm font-semibold transition-colors relative ${
                                  requiredTruckTypes.includes(opt.value)
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {opt.label}
                                {requiredTruckTypes.includes(opt.value) && (
                                  <span className="absolute top-1 left-1 text-blue-500 text-xs">✓</span>
                                )}
                              </button>
                            ))}
                          </div>
                          <div className="px-4 pb-4 flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowTruckModal(false)}
                              className="flex-1 py-2.5 bg-gt-brand text-white rounded-xl font-medium text-sm"
                            >
                              אישור
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowTruckModal(false)}
                              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm"
                            >
                              ביטול
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <StorageVehiclePickerModal
                      isOpen={showStorageModal}
                      onClose={() => setShowStorageModal(false)}
                      vehicles={customerStoredVehicles}
                      onSelect={(v) => {
                        if (selectedStoredVehicleId === v.id) {
                          handleClearStoredVehicle()
                        } else {
                          handleSelectStoredVehicle(v)
                          if (storageAddress) {
                            const pickup = findPickupRouteStop(routeStops)
                            if (pickup) {
                              updateStop(pickup.id, {
                                address: {
                                  address: storageAddress,
                                  lat: basePriceList?.base_lat,
                                  lng: basePriceList?.base_lng,
                                },
                              })
                            }
                            setStartFromBase(true)
                          }
                        }
                      }}
                    />
                  </>
                )}

                {towType === 'exchange' && (
                  <>
                    {showDefectsExchangeModal && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className={isMobile ? 'bg-white rounded-2xl shadow-2xl w-full max-w-full' : 'bg-white rounded-2xl shadow-2xl w-[480px]'}>
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-base">בחר תקלות</h3>
                            <button
                              type="button"
                              onClick={() => setShowDefectsExchangeModal(false)}
                              className={`text-gray-400 hover:text-gray-600 text-xl leading-none${isMobile ? ' p-2 -m-2' : ''}`}
                            >
                              ✕
                            </button>
                          </div>
                          <div className="p-4 grid grid-cols-3 gap-3">
                            {DEFECT_OPTIONS.map((defect) => {
                              const Icon = defect.icon
                              const selected =
                                defect.value === OTHER_DEFECT_VALUE
                                  ? isOtherSelected(selectedDefects)
                                  : selectedDefects.includes(defect.value)
                              return (
                              <button
                                key={defect.value}
                                type="button"
                                onClick={() => {
                                  setSelectedDefects((prev) => {
                                    if (defect.value === OTHER_DEFECT_VALUE) {
                                      if (isOtherSelected(prev)) {
                                        setOtherDefectText('')
                                        return prev.filter(
                                          (d) =>
                                            d !== OTHER_DEFECT_VALUE &&
                                            !d.startsWith('אחר:')
                                        )
                                      }
                                      return [...prev, OTHER_DEFECT_VALUE]
                                    }
                                    return prev.includes(defect.value)
                                      ? prev.filter((d) => d !== defect.value)
                                      : [...prev, defect.value]
                                  })
                                }}
                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm transition-colors ${defectOptionClassName(selected, defect.highlight, 'grid')}`}
                              >
                                <Icon className="h-6 w-6 shrink-0" aria-hidden />
                                <span className="text-xs font-medium text-center leading-tight">{defect.label}</span>
                              </button>
                              )
                            })}
                          </div>
                          {isOtherSelected(selectedDefects) && (
                            <div className="mt-3 px-1">
                              <label className="block">תיאור התקלה:</label>
                              <input
                                type="text"
                                value={otherDefectText}
                                onChange={(e) => setOtherDefectText(e.target.value)}
                                placeholder="תאר את התקלה..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}
                          <div className="px-4 pb-4 pt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDefects((prev) =>
                                  isOtherSelected(prev)
                                    ? applyOtherText(prev, otherDefectText)
                                    : prev
                                )
                                setShowDefectsExchangeModal(false)
                              }}
                              className="flex-1 py-2.5 bg-gt-brand text-white rounded-xl font-medium text-sm"
                            >
                              אישור
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDefectsExchangeModal(false)}
                              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm"
                            >
                              ביטול
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {showWorkingServicesModal && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-base">שירותים נוספים — תקין</h3>
                            <button type="button" onClick={() => setShowWorkingServicesModal(false)} className={`text-gray-400 hover:text-gray-600 text-xl${isMobile ? ' p-2 -m-2' : ''}`}>✕</button>
                          </div>
                          <div className="p-4">
                            <ServiceSurchargeSelector
                              services={serviceSurchargesData}
                              selectedServices={workingSelectedServices}
                              onChange={setWorkingSelectedServices}
                            />
                          </div>
                          <div className="px-4 pb-4">
                            <button type="button" onClick={() => setShowWorkingServicesModal(false)} className="w-full py-2.5 bg-gt-brand text-white rounded-xl text-sm font-medium">אישור</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {showDefectiveServicesModal && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-base">שירותים נוספים — תקול</h3>
                            <button type="button" onClick={() => setShowDefectiveServicesModal(false)} className={`text-gray-400 hover:text-gray-600 text-xl${isMobile ? ' p-2 -m-2' : ''}`}>✕</button>
                          </div>
                          <div className="p-4">
                            <ServiceSurchargeSelector
                              services={serviceSurchargesData}
                              selectedServices={defectiveSelectedServices}
                              onChange={setDefectiveSelectedServices}
                            />
                          </div>
                          <div className="px-4 pb-4">
                            <button type="button" onClick={() => setShowDefectiveServicesModal(false)} className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium">אישור</button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                      <FormSubcard title="רכב תקין" className="mb-0">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-gt-text-secondary pb-1 border-b border-dashed border-gt-border-subtle">פרטי רכב</div>
                            <div className="space-y-3">
                              {storagePickupEditLocked && (
                                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  לא ניתן לשנות פרטי איסוף מאחסנה — הגרירה כבר התחילה
                                </p>
                              )}
                              <div className="flex justify-end flex-wrap gap-2">
                                {workingVehicleSource === 'storage' ? (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={storagePickupEditLocked}
                                      onClick={() => setShowWorkingStorageModal(true)}
                                      className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-gt-brand text-white border-gt-brand disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      🏪 מאחסנה: {workingVehiclePlate}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setWorkingVehicleSource('address')
                                        setSelectedWorkingVehicleId(null)
                                        setWorkingVehiclePlate('')
                                        setWorkingVehicleData(null)
                                        setWorkingVehicleAddress({ address: '' })
                                      }}
                                      className="text-blue-300 hover:text-red-500 text-sm px-1"
                                    >✕</button>
                                  </div>
                                ) : (
                                  selectedCustomerId && customerStoredVehicles.length > 0 && (
                                    <button
                                      type="button"
                                      disabled={storagePickupEditLocked}
                                      onClick={() => setShowWorkingStorageModal(true)}
                                      className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-white text-blue-600 border-blue-200 hover:border-blue-400 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      🏪 מאחסנה
                                    </button>
                                  )
                                )}
                              </div>
                              <div className="flex flex-col gap-2">
                                {plateStorageWarning && <p className="text-sm text-red-500">{plateStorageWarning}</p>}
                                <div className="grid grid-cols-[2fr_1fr] gap-2">
                                  <Input
                                    type="text"
                                    value={workingVehiclePlate}
                                    onChange={(e) => { setWorkingVehiclePlate(normalizePlate(e.target.value)); setWorkingVehicleNotFound(false); setPlateStorageWarning(null) }}
                                    onBlur={async (e) => {
                                      const val = e.target.value.trim()
                                      if (
                                        shouldTriggerPlateLookupOnBlur(val, {
                                          hasFoundData: workingVehicleData?.found,
                                          lookupAlreadyFailed: workingVehicleNotFound,
                                        })
                                      ) {
                                        handleWorkingVehicleLookup(val)
                                      }
                                    }}
                                    placeholder="לוחית תקין"
                                    className="font-mono tracking-widest"
                                    dir="ltr"
                                  />
                                  <Input
                                    type="text"
                                    value={workingVehicleCode}
                                    onChange={(e) => setWorkingVehicleCode(e.target.value)}
                                    placeholder="קוד רכב"
                                    className="text-xs"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPlateStorageWarning(null)
                                    setWorkingVehicleData(null)
                                    setWorkingVehicleNotFound(true)
                                    setWorkingVehicleType('')
                                    setWorkingManualManufacturer('')
                                    setWorkingManualColor('')
                                    setWorkingManualWeight('')
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors w-fit"
                                >
                                  <PenLine className="w-3.5 h-3.5" />
                                  הזן פרטי רכב ידנית
                                </button>
                              </div>
                          {workingVehicleData?.found && workingVehicleData.data && (
                            <div className="flex flex-col">
                              <VehicleRegistryStatusBanner status={workingVehicleData.registryStatus} />
                              {!workingVehicleData.registryStatus && (
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                <span className="text-xs font-medium text-green-700">נמצא במאגר הרשמי</span>
                                {workingVehicleData.sourceLabel && (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                                    {workingVehicleData.sourceLabel}
                                  </span>
                                )}
                              </div>
                              )}
                              {workingVehicleData.registryStatus && workingVehicleData.sourceLabel && (
                                <div className="flex items-center gap-1.5 mb-2">
                                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                    {workingVehicleData.sourceLabel}
                                  </span>
                                </div>
                              )}
                              <VehicleCoreLookupChips
                                source={workingVehicleData.source}
                                data={workingVehicleData.data}
                                vehicleType={workingVehicleType}
                                className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl content-start"
                              />
                            </div>
                          )}
                          <div className="min-h-0">
                            {workingVehicleNotFound && (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                                <p className="text-sm text-amber-700 font-medium">הרכב לא נמצא במאגר — יש למלא ידנית</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">סוג רכב *</label>
                                    <select value={workingVehicleType} onChange={(e) => setWorkingVehicleType(e.target.value as VehicleType)}
                                      className="w-full px-3 py-2 border border-gt-border-subtle rounded-xl text-sm">
                                      <option value="">בחר סוג רכב</option>
                                      <option value="private">פרטי</option>
                                      <option value="suv">ג'יפ / SUV</option>
                                      <option value="truck">משאית</option>
                                      <option value="heavy">צמ"ה</option>
                                      <option value="motorcycle">אופנוע</option>
                                      <option value="bus">אוטובוס</option>
                                      <option value="van">רכב מסחרי</option>
                                      <option value="other">אחר</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">יצרן</label>
                                    <Input type="text" value={workingManualManufacturer}
                                      onChange={(e) => setWorkingManualManufacturer(e.target.value)}
                                      placeholder="למשל: טויוטה" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">צבע</label>
                                    <Input type="text" value={workingManualColor}
                                      onChange={(e) => setWorkingManualColor(e.target.value)}
                                      placeholder="למשל: לבן" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">מספר שלדה</label>
                                    <Input type="text" value={workingManualChassis}
                                      onChange={(e) => setWorkingManualChassis(e.target.value)}
                                      placeholder="אופציונלי"
                                      className="font-mono" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                      {(workingVehicleType as string) === 'van' ? 'משקל (ק״ג) *' : 'משקל (ק"ג)'}
                                    </label>
                                    <Input type="number" value={workingManualWeight}
                                      onChange={(e) => setWorkingManualWeight(e.target.value)}
                                      placeholder={(workingVehicleType as string) === 'van' ? 'חובה לרכב מסחרי' : 'אופציונלי'} />
                                    {(workingVehicleType as string) === 'van' && (!workingManualWeight || Number(workingManualWeight) === 0) && (
                                      <p className="text-sm text-red-500 mt-1">יש להזין משקל כדי לחשב מחיר לרכב מסחרי</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-gt-text-secondary pb-1 border-b border-dashed border-gt-border-subtle">גרר נדרש</div>
                            {(workingVehicleData?.found || workingVehicleNotFound || workingVehicleSource === 'storage') && (
                              <div className="p-3 bg-gt-brand-subtle border border-gt-brand-subtle-border rounded-xl">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">סוג גרר נדרש *</p>
                                <div className="flex gap-2 flex-wrap">
                                  {TRUCK_OPTIONS.map((opt) => (
                                    <button key={opt.value} type="button"
                                      onClick={() => {
                                        const current = requiredTruckTypes.filter(t => t !== opt.value)
                                        if (requiredTruckTypes.includes(opt.value)) setRequiredTruckTypes(current)
                                        else setRequiredTruckTypes([...current, opt.value])
                                      }}
                                      className={`px-4 py-2 rounded-xl text-sm ${requiredTruckTypes.includes(opt.value) ? 'bg-gt-brand text-white' : 'bg-white text-gray-700 border-2 border-gt-border-subtle'}`}>
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-gt-text-secondary pb-1 border-b border-dashed border-gt-border-subtle">שירותים נוספים</div>
                            {serviceSurchargesData.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setShowWorkingServicesModal(true)}
                                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors w-full justify-center ${
                                    workingSelectedServices.length > 0
                                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                  }`}
                                >
                                  ⚙️ {workingSelectedServices.length > 0 ? `שירותים (${workingSelectedServices.length})` : 'שירותים נוספים'}
                                </button>
                            ) : null}
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-gt-text-secondary pb-1 border-b border-dashed border-gt-border-subtle">מסלול</div>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">מוצא הרכב התקין</label>
                                {workingVehicleSource === 'storage' ? (
                                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                                    <span>🏪 {workingVehicleAddress?.address || storageAddress || 'כתובת האחסנה'}</span>
                                    <button
                                      type="button"
                                      onClick={() => { setWorkingVehicleSource('address'); setSelectedWorkingVehicleId(null); setWorkingVehicleAddress({ address: '' }) }}
                                      className="mr-auto text-gray-400 hover:text-red-500"
                                    >✕</button>
                                  </div>
                                ) : (
                                  <AddressInput
                                    value={workingVehicleAddress}
                                    onChange={(d: AddressData) => setWorkingVehicleAddress(d)}
                                    label=""
                                    hideLabel
                                    onPinDropClick={() => handlePinDropOpen('workingVehicle')}
                                    storageYardConfirm={workingPickupYardConfirm}
                                  />
                                )}
                                {workingVehicleSource !== 'storage' && (
                                  <SaveCustomerAddressControl
                                    className="mt-1.5"
                                    visible={showSaveWorkingSourceAddressOption}
                                    address={workingVehicleAddress?.address ?? ''}
                                    pending={pendingWorkingSourceAddress}
                                    onConfirm={setPendingWorkingSourceAddress}
                                    onClear={() => setPendingWorkingSourceAddress(null)}
                                    disabled={saving}
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => setStartFromBase(!startFromBase)}
                                  className={`mt-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                                    startFromBase
                                      ? 'bg-gt-brand text-white border-gt-brand'
                                      : 'bg-white text-gray-600 border-gt-border-subtle hover:border-gt-border-strong'
                                  }`}
                                >
                                  יציאה מהחניון
                                </button>
                              </div>
                              <div className="border-t border-gray-100 pt-3">
                                <label className="block text-xs font-medium text-gray-500 mb-1">יעד הרכב התקין</label>
                                <AddressInput
                                  value={workingVehicleDestinationAddress}
                                  onChange={(d: AddressData) => setWorkingVehicleDestinationAddress(d)}
                                  label=""
                                  hideLabel
                                  onPinDropClick={() => handlePinDropOpen('workingDestination')}
                                  storageYardConfirm={workingDropoffYardConfirm}
                                />
                                <SaveCustomerAddressControl
                                  className="mt-1.5"
                                  visible={showSaveWorkingDestinationAddressOption}
                                  address={workingVehicleDestinationAddress?.address ?? ''}
                                  pending={pendingWorkingDestinationAddress}
                                  onConfirm={setPendingWorkingDestinationAddress}
                                  onClear={() => setPendingWorkingDestinationAddress(null)}
                                  disabled={saving}
                                />
                                {!workingVehicleDestinationIsStorage ? (
                                  <button
                                    type="button"
                                    onClick={() => { setWorkingVehicleDestinationIsStorage(true); if (storageAddress) setWorkingVehicleDestinationAddress({ address: storageAddress, lat: basePriceList?.base_lat, lng: basePriceList?.base_lng }) }}
                                    className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors w-fit"
                                  >
                                    <span>🏪</span> שמור באחסנה
                                  </button>
                                ) : (
                                  <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg w-fit">
                                    <span className="text-xs text-blue-600">🏪 לאחסנה</span>
                                    <button type="button" onClick={() => { setWorkingVehicleDestinationIsStorage(false); setWorkingVehicleDestinationAddress({ address: '' }) }} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </FormSubcard>

                      <FormSubcard title="רכב תקול" className="mb-0">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-gt-text-secondary pb-1 border-b border-dashed border-gt-border-subtle">פרטי רכב</div>
                            <div className="space-y-3">
                              <div className="grid grid-cols-[2fr_1fr] gap-2">
                                <Input
                                  type="text"
                                  value={defectiveVehiclePlate}
                                  onChange={(e) => { handleDefectiveVehiclePlateInputChange(e.target.value); setPlateStorageWarning(null) }}
                                  onBlur={async (e) => {
                                    const val = e.target.value.trim()
                                    if (
                                      shouldTriggerPlateLookupOnBlur(val, {
                                        hasFoundData: defectiveVehicleData?.found,
                                        lookupAlreadyFailed: defectiveVehicleNotFound,
                                      })
                                    ) {
                                      handleDefectiveLookup()
                                    }
                                  }}
                                  placeholder="לוחית תקול"
                                  className="font-mono tracking-widest"
                                  dir="ltr"
                                />
                                <Input
                                  type="text"
                                  value={defectiveVehicleCode}
                                  onChange={(e) => setDefectiveVehicleCode(e.target.value)}
                                  placeholder="קוד רכב"
                                  className="text-xs"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setPlateStorageWarning(null)
                                  setDefectiveVehicleData(null)
                                  setDefectiveVehicleNotFound(true)
                                  setDefectiveVehicleType('')
                                  setDefectiveManualManufacturer('')
                                  setDefectiveManualColor('')
                                  setDefectiveManualWeight('')
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors w-fit"
                              >
                                <PenLine className="w-3.5 h-3.5" />
                                הזן פרטי רכב ידנית
                              </button>
                              {defectiveVehicleData?.found && defectiveVehicleData.data && (
                                <div className="flex flex-col">
                                  <VehicleRegistryStatusBanner status={defectiveVehicleData.registryStatus} />
                                  {!defectiveVehicleData.registryStatus && (
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                    <span className="text-xs font-medium text-green-700">נמצא במאגר הרשמי</span>
                                    {defectiveVehicleData.sourceLabel && (
                                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                                        {defectiveVehicleData.sourceLabel}
                                      </span>
                                    )}
                                  </div>
                                  )}
                                  {defectiveVehicleData.registryStatus && defectiveVehicleData.sourceLabel && (
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                        {defectiveVehicleData.sourceLabel}
                                      </span>
                                    </div>
                                  )}
                                  <VehicleCoreLookupChips
                                    source={defectiveVehicleData.source}
                                    data={defectiveVehicleData.data}
                                    vehicleType={defectiveVehicleType}
                                    className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl content-start"
                                  />
                                </div>
                              )}
                              <div className="min-h-0">
                                {defectiveVehicleNotFound && (
                                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                                    <p className="text-sm text-amber-700 font-medium">הרכב לא נמצא במאגר — יש למלא ידנית</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">סוג רכב *</label>
                                        <select value={defectiveVehicleType} onChange={(e) => setDefectiveVehicleType(e.target.value as VehicleType)}
                                          className="w-full px-3 py-2 border border-gt-border-subtle rounded-xl text-sm">
                                          <option value="">בחר סוג רכב</option>
                                          <option value="private">פרטי</option>
                                          <option value="suv">ג'יפ / SUV</option>
                                          <option value="truck">משאית</option>
                                          <option value="heavy">צמ"ה</option>
                                          <option value="motorcycle">אופנוע</option>
                                          <option value="bus">אוטובוס</option>
                                          <option value="van">רכב מסחרי</option>
                                          <option value="other">אחר</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">יצרן</label>
                                        <Input type="text" value={defectiveManualManufacturer}
                                          onChange={(e) => setDefectiveManualManufacturer(e.target.value)}
                                          placeholder="למשל: טויוטה" />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">צבע</label>
                                        <Input type="text" value={defectiveManualColor}
                                          onChange={(e) => setDefectiveManualColor(e.target.value)}
                                          placeholder="למשל: לבן" />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">מספר שלדה</label>
                                        <Input type="text" value={defectiveManualChassis}
                                          onChange={(e) => setDefectiveManualChassis(e.target.value)}
                                          placeholder="אופציונלי"
                                          className="font-mono" />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">
                                          {(defectiveVehicleType as string) === 'van' ? 'משקל (ק״ג) *' : 'משקל (ק"ג)'}
                                        </label>
                                        <Input type="number" value={defectiveManualWeight}
                                          onChange={(e) => setDefectiveManualWeight(e.target.value)}
                                          placeholder={(defectiveVehicleType as string) === 'van' ? 'חובה לרכב מסחרי' : 'אופציונלי'} />
                                        {(defectiveVehicleType as string) === 'van' && (!defectiveManualWeight || Number(defectiveManualWeight) === 0) && (
                                          <p className="text-sm text-red-500 mt-1">יש להזין משקל כדי לחשב מחיר לרכב מסחרי</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div ref={truckTypeSectionRef} className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-gt-text-secondary pb-1 border-b border-dashed border-gt-border-subtle">תקלות וגרר</div>
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const normalized = hydrateDefectsFromTowReason(
                                      serializeDefects(selectedDefects)
                                    )
                                    setSelectedDefects(normalized)
                                    setOtherDefectText(extractOtherText(normalized))
                                    setShowDefectsExchangeModal(true)
                                  }}
                                  className={`flex-1 py-2 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                                    selectedDefects.length > 0
                                      ? 'border-red-300 bg-red-50 text-red-700'
                                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                  }`}
                                >
                                  🔧 {selectedDefects.length > 0 ? `תקלות (${selectedDefects.length})` : 'בחר תקלות'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setHasSecondTruck(!hasSecondTruck)}
                                  className={`flex-1 py-2 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                                    hasSecondTruck
                                      ? 'border-orange-300 bg-orange-50 text-orange-700'
                                      : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200'
                                  }`}
                                >
                                  {hasSecondTruck ? '✓ גרר נוסף' : '+ גרר נוסף'}
                                </button>
                              </div>
                              {hasSecondTruck && (
                                <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                                  <p className="text-xs font-medium text-gray-500 mb-2">סוג גרר לרכב התקול *</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {TRUCK_OPTIONS.map((opt) => (
                                      <button key={opt.value} type="button"
                                        onClick={() => {
                                          const current = defectiveTruckTypes.filter(t => t !== opt.value)
                                          if (defectiveTruckTypes.includes(opt.value)) setDefectiveTruckTypes(current)
                                          else setDefectiveTruckTypes([...current, opt.value])
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-sm ${defectiveTruckTypes.includes(opt.value) ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-gt-text-secondary pb-1 border-b border-dashed border-gt-border-subtle">שירותים נוספים</div>
                            {serviceSurchargesData.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setShowDefectiveServicesModal(true)}
                                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors w-full justify-center ${
                                    defectiveSelectedServices.length > 0
                                      ? 'border-orange-300 bg-orange-50 text-orange-700'
                                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                  }`}
                                >
                                  ⚙️ {defectiveSelectedServices.length > 0 ? `שירותים (${defectiveSelectedServices.length})` : 'שירותים נוספים'}
                                </button>
                            ) : null}
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-gt-text-secondary pb-1 border-b border-dashed border-gt-border-subtle">מסלול</div>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">מוצא הרכב התקול</label>
                                <AddressInput
                                  value={exchangeAddress}
                                  onChange={(d: AddressData) => setExchangeAddress(d)}
                                  label=""
                                  hideLabel
                                  onPinDropClick={() => handlePinDropOpen('exchange')}
                                />
                                <SaveCustomerAddressControl
                                  className="mt-1.5"
                                  visible={showSaveExchangePickupAddressOption}
                                  address={exchangeAddress?.address ?? ''}
                                  pending={pendingExchangePickupAddress}
                                  onConfirm={setPendingExchangePickupAddress}
                                  onClear={() => setPendingExchangePickupAddress(null)}
                                  disabled={saving}
                                />
                                <button
                                  type="button"
                                  onClick={() => setExchangeAddress(workingVehicleDestinationAddress)}
                                  disabled={!workingVehicleDestinationAddress?.address}
                                  className="mt-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-gt-brand-subtle-border bg-gt-brand-subtle text-gt-brand-text hover:bg-gt-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  זהה ליעד התקין
                                </button>
                              </div>
                              <div className="border-t border-gray-100 pt-3">
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">יעד הרכב התקול</label>
                                <AddressInput
                                  value={defectiveDestinationAddress}
                                  onChange={(d: AddressData) => setDefectiveDestinationAddress(d)}
                                  label=""
                                  hideLabel
                                  onPinDropClick={() => handlePinDropOpen('defectiveDestination')}
                                  storageYardConfirm={
                                    defectiveDestination === 'address'
                                      ? defectiveDropoffYardConfirm
                                      : null
                                  }
                                />
                                <SaveCustomerAddressControl
                                  className="mt-1.5"
                                  visible={showSaveDefectiveDestinationAddressOption}
                                  address={defectiveDestinationAddress?.address ?? ''}
                                  pending={pendingDefectiveDestinationAddress}
                                  onConfirm={setPendingDefectiveDestinationAddress}
                                  onClear={() => setPendingDefectiveDestinationAddress(null)}
                                  disabled={saving}
                                />
                                <div className="flex flex-wrap items-start gap-2">
                                {defectiveDestination !== 'storage' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDefectiveDestination('storage')
                                      if (storageAddress) setDefectiveDestinationAddress({ address: storageAddress, lat: basePriceList?.base_lat, lng: basePriceList?.base_lng })
                                    }}
                                    className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-orange-300 hover:text-orange-600 transition-colors w-fit"
                                  >
                                    <span>🏪</span> שמור באחסנה
                                  </button>
                                ) : (
                                  <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 border border-orange-200 rounded-lg w-fit">
                                    <span className="text-xs text-orange-600">🏪 לאחסנה</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDefectiveDestination('address')
                                        setDefectiveDestinationAddress({ address: '' })
                                        setHasStorageFollowUp(false)
                                        setFollowUpAddress({ address: '' })
                                        setFollowUpContactName('')
                                        setFollowUpContactPhone('')
                                      }}
                                      className="text-gray-400 hover:text-red-500 text-xs"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                                {renderDeadheadToggle('compact')}
                                </div>
                                <StorageFollowUpSection
                                  editTowId={editTowId}
                                  storageEligible={defectiveDestination === 'storage'}
                                  hasStorageFollowUp={hasStorageFollowUp}
                                  setHasStorageFollowUp={setHasStorageFollowUp}
                                  followUpAddress={followUpAddress}
                                  setFollowUpAddress={setFollowUpAddress}
                                  followUpContactName={followUpContactName}
                                  setFollowUpContactName={setFollowUpContactName}
                                  followUpContactPhone={followUpContactPhone}
                                  setFollowUpContactPhone={setFollowUpContactPhone}
                                  inheritCustomerOrderNumber={inheritCustomerOrderNumber}
                                  setInheritCustomerOrderNumber={setInheritCustomerOrderNumber}
                                  followUpChildTowId={followUpChildTowId}
                                  followUpChildStatus={followUpChildStatus}
                                  onPinDropOpen={() => handlePinDropOpen('followUp')}
                                  variant="labeled"
                                  showSaveAddressOption={showSaveFollowUpAddressOption}
                                  pendingAddress={pendingFollowUpAddress}
                                  onConfirmPendingAddress={setPendingFollowUpAddress}
                                  onClearPendingAddress={() => setPendingFollowUpAddress(null)}
                                  saveAddressDisabled={saving}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </FormSubcard>
                    </div>

                    <FormSubcard title="תוספות זמן">
                      <TimeSurchargesSection
                        timeSurchargesData={displayTimeSurcharges}
                        towDate={towDate}
                        towTime={towTime}
                        isHoliday={isHoliday}
                        setIsHoliday={setIsHoliday}
                        activeTimeSurchargesList={activeTimeSurchargesList}
                        setActiveTimeSurchargesList={setActiveTimeSurchargesList}
                        setHasManualTimeSurchargeOverride={setHasManualTimeSurchargeOverride}
                      />
                    </FormSubcard>

                    <FormSubcard title="תוספות מיקום">
                      <LocationSurchargesSection
                        locationSurchargesData={locationSurchargesData}
                        selectedLocationSurcharges={selectedLocationSurcharges}
                        setSelectedLocationSurcharges={setSelectedLocationSurcharges}
                      />
                    </FormSubcard>

                    <FormSubcard title="שירותים נוספים">
                      <ServiceSurchargeSelector
                        services={serviceSurchargesData}
                        selectedServices={towServiceSurcharges}
                        onChange={setTowServiceSurcharges}
                        label=" "
                      />
                    </FormSubcard>

                    <FormSubcard title="תוספות ידניות">
                      <ManualSurchargeSection
                        manualSurcharges={manualSurcharges}
                        onChange={setManualSurcharges}
                        label="תוספת ידנית"
                      />
                    </FormSubcard>
                  </>
                )}

                {towType === 'custom' && (
                  <>
                    <RouteBuilder
                      key={`custom-${routeSeedVersion}`}
                      isMobile={isMobile}
                      companyId={companyId || ''}
                      customerId={selectedCustomerId}
                      customerName={customerName}
                      customerPhone={customerPhone}
                      baseAddress={basePriceList?.base_address}
                      baseLat={basePriceList?.base_lat}
                      baseLng={basePriceList?.base_lng}
                      initialPoints={routePoints}
                      onPointsChange={setRoutePoints}
                      onPinDropClick={(id) =>
                        setPinDropModal({ isOpen: true, field: id })
                      }
                      onRouteDataChange={setCustomRouteData}
                      pinDropResult={pinDropResult}
                      onPinDropHandled={() => setPinDropResult(null)}
                      requiredTruckTypes={requiredTruckTypes}
                      onRequiredTruckTypesChange={setRequiredTruckTypes}
                      truckTypeSectionRef={truckTypeSectionRef}
                      truckTypeError={truckTypeError}
                      savedCustomerContacts={savedContacts}
                      customerContactsLoading={contactsLoading}
                      saveContactByPointId={saveCustomPointContacts}
                      onSaveContactToggle={toggleCustomPointSaveContact}
                      onContactSelected={clearCustomPointSaveContact}
                      savedCustomerAddresses={savedAddresses}
                      customerAddressesLoading={addressesLoading}
                      pendingAddressByPointId={pendingCustomPointAddresses}
                      onConfirmPendingAddress={setPendingCustomPointAddress}
                      onClearPendingAddress={(pointId) =>
                        setPendingCustomPointAddress(pointId, null)
                      }
                    />
                    <FormSubcard title="תוספות זמן">
                      <TimeSurchargesSection
                        timeSurchargesData={displayTimeSurcharges}
                        towDate={towDate}
                        towTime={towTime}
                        isHoliday={isHoliday}
                        setIsHoliday={setIsHoliday}
                        activeTimeSurchargesList={activeTimeSurchargesList}
                        setActiveTimeSurchargesList={setActiveTimeSurchargesList}
                        setHasManualTimeSurchargeOverride={setHasManualTimeSurchargeOverride}
                      />
                    </FormSubcard>
                    <FormSubcard title="תוספות מיקום">
                      <LocationSurchargesSection
                        locationSurchargesData={locationSurchargesData}
                        selectedLocationSurcharges={selectedLocationSurcharges}
                        setSelectedLocationSurcharges={setSelectedLocationSurcharges}
                      />
                    </FormSubcard>
                    <FormSubcard title="שירותים נוספים">
                      <ServiceSurchargeSelector
                        services={serviceSurchargesData}
                        selectedServices={towServiceSurcharges}
                        onChange={setTowServiceSurcharges}
                        label=" "
                      />
                    </FormSubcard>
                    <FormSubcard title="תוספות ידניות">
                      <ManualSurchargeSection
                        manualSurcharges={manualSurcharges}
                        onChange={setManualSurcharges}
                        label="תוספת ידנית"
                      />
                    </FormSubcard>
                  </>
                )}
              </div>
            </FormCard>
          )}

          {/* Section 5 — מחיר */}
          {towType && (
            <FormCard icon={Coins} title="מחיר">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPriceMode('recommended')
                      setSelectedPriceItem(null)
                      setCustomPrice('')
                    }}
                    className={`px-4 py-2 rounded-xl text-sm ${
                      priceMode === 'recommended'
                        ? 'bg-gt-brand text-white'
                        : 'bg-gray-100'
                    }`}
                  >
                    מומלץ
                  </button>
                  {selectedCustomerPricing && (
                    <button
                      type="button"
                      onClick={() => {
                        setPriceMode('recommended_customer')
                        setSelectedPriceItem(null)
                        setCustomPrice('')
                      }}
                      className={`px-4 py-2 rounded-xl text-sm ${
                        priceMode === 'recommended_customer'
                          ? 'bg-gt-brand text-white'
                          : 'bg-gray-100'
                      }`}
                    >
                      ללקוח
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPriceMode('fixed')
                      setCustomPrice('')
                    }}
                    className={`px-4 py-2 rounded-xl text-sm ${
                      priceMode === 'fixed' ? 'bg-gt-brand text-white' : 'bg-gray-100'
                    }`}
                  >
                    פריט קבוע
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPriceMode('custom')
                      setSelectedPriceItem(null)
                    }}
                    className={`px-4 py-2 rounded-xl text-sm ${
                      priceMode === 'custom'
                        ? 'bg-gt-brand text-white'
                        : 'bg-gray-100'
                    }`}
                  >
                    ידני
                  </button>
                </div>
                {priceMode === 'fixed' && (
                  <select
                    value={selectedPriceItem?.id || ''}
                    onChange={(e) => {
                      const item = fixedPriceItems.find(
                        (i) => i.id === e.target.value
                      )
                      setSelectedPriceItem(
                        item
                          ? {
                              id: item.id,
                              label: item.label,
                              price: item.price,
                            }
                          : null
                      )
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl"
                  >
                    <option value="">בחר פריט</option>
                    {fixedPriceItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label} — ₪{i.price}
                      </option>
                    ))}
                  </select>
                )}
                {priceMode === 'custom' && (
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="מחיר"
                      className="px-4 py-2.5 border border-gray-300 rounded-xl w-32"
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={customPriceIncludesVat}
                        onChange={(e) =>
                          setCustomPriceIncludesVat(e.target.checked)
                        }
                      />
                      כולל מע״מ
                    </label>
                  </div>
                )}
                {(priceMode === 'recommended' ||
                  priceMode === 'recommended_customer' ||
                  priceMode === 'fixed' ||
                  priceMode === 'custom') && (
                  <div className="text-sm space-y-1">
                    {priceResult ? (
                      <>
                        {priceResult.breakdown
                          .filter(item => item.amount !== 0)
                          .map((item, idx) => {
                            const label =
                              item.type === 'time' && priceResult.maxTimeSurchargePercent > 0
                                ? priceResult.maxTimeSurchargeLabel
                                  ? `תוספת ${priceResult.maxTimeSurchargeLabel} (${priceResult.maxTimeSurchargePercent}%)`
                                  : `תוספת זמן (${priceResult.maxTimeSurchargePercent}%)`
                                : item.label
                            return (
                              <p
                                key={idx}
                                className={
                                  item.bold
                                    ? 'text-2xl font-bold text-gray-900'
                                    : 'text-gray-500'
                                }
                              >
                                {label}: ₪{item.amount.toFixed(2)}
                              </p>
                            )
                          })}
                        {usesCompanyTimeFallback && priceResult.maxTimeSurchargePercent > 0 && (
                          <p className="text-xs text-amber-600">
                            תוספת השעה לפי תעריף החברה — ללקוח זה אין תוספת שעה מותאמת
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p>בסיס + מרחק + תוספות</p>
                        <p>לפני מע״מ: ₪{(finalPrice / 1.18).toFixed(2)}</p>
                        <p>מע״מ 18%: ₪{((finalPrice / 1.18) * 0.18).toFixed(2)}</p>
                        <p className="text-2xl font-bold text-gray-900">סה״כ: ₪{finalPrice.toFixed(2)}</p>
                      </>
                    )}
                    {/* הנחה / תוספת ידנית */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200 mt-2">
                      <button
                        type="button"
                        onClick={() => setManualAdjustmentType('discount')}
                        className={`px-2.5 py-1 rounded-lg text-xs ${
                          manualAdjustmentType === 'discount'
                            ? 'bg-red-500 text-white'
                            : 'bg-white text-gray-700 border border-gray-300'
                        }`}
                      >
                        הנחה
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualAdjustmentType('markup')}
                        className={`px-2.5 py-1 rounded-lg text-xs ${
                          manualAdjustmentType === 'markup'
                            ? 'bg-green-500 text-white'
                            : 'bg-white text-gray-700 border border-gray-300'
                        }`}
                      >
                        תוספת
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={manualAdjustmentPercent}
                        onChange={(e) => setManualAdjustmentPercent(e.target.value)}
                        placeholder="%"
                        className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center"
                      />
                      <span className="text-xs text-gray-500">אחוז</span>
                    </div>
                  </div>
                )}
              </div>
            </FormCard>
          )}

          {/* Section 6 — הצעת מחיר (GATE) */}
          {towType && !isEditingClosedTow && (
            <section className="bg-amber-50 rounded-xl border-2 border-amber-300 shadow-sm overflow-hidden mb-6">
              <div className="px-4 sm:px-5 py-4 sm:py-5">
                {quoteSavedId ? (
                  <div className="text-center">
                    <p className="font-medium text-amber-800 mb-2">
                      נשמר כהצעת מחיר — ניתן לחזור אליה מרשימת הגרירות
                    </p>
                    <Link
                      href={`/dashboard/tows/${quoteSavedId}`}
                      className="inline-block px-4 py-2 bg-amber-500 text-white rounded-xl"
                    >
                      צפה בהצעה
                    </Link>
                  </div>
                ) : quoteDeclined ? (
                  <div className="text-center">
                    <p className="font-medium text-amber-800 mb-4">
                      הצעת מחיר — אישור טלפוני
                    </p>
                    <button
                      type="button"
                      onClick={handleSaveAsQuote}
                      disabled={saving}
                      className="px-6 py-3 bg-amber-500 text-white rounded-xl font-medium"
                    >
                      {saving ? (
                        <Loader2 size={20} className="animate-spin inline" />
                      ) : (
                        'שמור כהצעה'
                      )}
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-bold text-amber-900 text-lg mb-2">
                      הצעת מחיר — אישור טלפוני
                    </h3>
                    <p className="text-3xl font-bold text-amber-900 mb-2">
                      ₪{finalPrice}
                    </p>
                    <p className="text-sm text-amber-800 mb-4">
                      {getTowTypeLabel(towType)} • {(towType === 'exchange' ? (exchangeTotalDistance?.distanceKm ?? 0) : totalDistanceKm).toFixed(1)} ק״מ
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setQuoteDeclined(true)}
                        className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium"
                      >
                        לא אישר — שמור כהצעה
                      </button>
                      <button
                        type="button"
                        onClick={handleQuoteApproveClick}
                        disabled={approvingQuote || saving}
                        className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {approvingQuote ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : (
                          <Check size={20} />
                        )}
                        הלקוח אישר ✓
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Sections 7–9 — LOCKED until quoteApproved */}
          <div
            style={{
              opacity: lockedOpacity,
              pointerEvents: lockedPointer as React.CSSProperties['pointerEvents'],
            }}
          >
            {/* Section 7 — גרר ונהג */}
            {towType && quoteApproved && (
              <section className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden mb-6">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-300">
                  <h2 className="font-bold text-gray-800 text-sm sm:text-base">
                    גרר ונהג
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  <p className="text-sm text-gray-500 mb-4">
                    הנהג ישובץ לאחר שמירת הגרירה
                  </p>
                  <button
                    type="button"
                    onClick={openDriverPicker}
                    className="px-4 py-2 bg-cyan-500 text-white rounded-xl text-sm"
                  >
                    פתח יומן לבחירת נהג ↗
                  </button>
                  {preSelectedDriverId && (() => {
                    const selectedDriver = drivers.find((d) => d.id === preSelectedDriverId)
                    const selectedTruck = preSelectedTruckId
                      ? trucks.find((t) => t.id === preSelectedTruckId)
                      : null
                    return selectedDriver ? (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-800">
                          נהג מיועד: {selectedDriver.user?.full_name || 'נהג'}
                        </p>
                        {selectedTruck && (
                          <p className="text-sm text-blue-700 mt-0.5">
                            משאית: {getTruckTypeLabel(selectedTruck.truck_type)} — {selectedTruck.plate_number}
                          </p>
                        )}
                        <p className="text-xs text-blue-600">
                          {towDate} · {towTime}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setPreSelectedDriverId(null)
                            setPreSelectedTruckId(null)
                          }}
                          className="text-xs text-red-500 mt-1"
                        >
                          הסר שיבוץ
                        </button>
                      </div>
                    ) : null
                  })()}
                </div>
              </section>
            )}

            {/* Section 8 — אנשי קשר */}
            {towType && quoteApproved && (
              <section className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden mb-6">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-300">
                  <h2 className="font-bold text-gray-800 text-sm sm:text-base">
                    אנשי קשר
                  </h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  {towType === 'exchange' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <CustomerContactFields
                        name={workingVehicleContact}
                        phone={workingVehicleContactPhone}
                        onNameChange={setWorkingVehicleContact}
                        onPhoneChange={setWorkingVehicleContactPhone}
                        savedContacts={savedContacts}
                        contactsLoading={contactsLoading}
                        disabled={saving}
                        showSavePill={showSaveWorkingSourceContactOption}
                        saveActive={saveWorkingSourceContactToCustomer}
                        onSaveToggle={() =>
                          setSaveWorkingSourceContactToCustomer((prev) => !prev)
                        }
                        onSelectContact={() => setSaveWorkingSourceContactToCustomer(false)}
                        header={
                          <div className="flex justify-between items-start mb-2 min-h-[32px]">
                            <label className="text-sm font-medium text-gray-700">איש קשר במוצא — רכב תקין</label>
                            <div className="flex gap-1.5 flex-wrap justify-end">
                              {!selectedCustomerId && (
                                <button type="button" onClick={() => copyFromCustomer('working_source')} className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100">כמו לקוח 👤</button>
                              )}
                            </div>
                          </div>
                        }
                      />

                      <CustomerContactFields
                        name={workingDestinationContact}
                        phone={workingDestinationContactPhone}
                        onNameChange={setWorkingDestinationContact}
                        onPhoneChange={setWorkingDestinationContactPhone}
                        savedContacts={savedContacts}
                        contactsLoading={contactsLoading}
                        disabled={saving}
                        showSavePill={showSaveWorkingDestinationContactOption}
                        saveActive={saveWorkingDestinationContactToCustomer}
                        onSaveToggle={() =>
                          setSaveWorkingDestinationContactToCustomer((prev) => !prev)
                        }
                        onSelectContact={() => setSaveWorkingDestinationContactToCustomer(false)}
                        header={
                          <div className="flex justify-between items-start mb-2 min-h-[32px]">
                            <label className="text-sm font-medium text-gray-700">איש קשר ביעד — רכב תקין</label>
                            <div className="flex gap-1.5 flex-wrap justify-end">
                              {!selectedCustomerId && (
                                <button type="button" onClick={() => copyFromCustomer('working_destination')} className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100">כמו לקוח 👤</button>
                              )}
                            </div>
                          </div>
                        }
                      />

                      <div>
                        <CustomerContactFields
                          name={exchangeContactName}
                          phone={exchangeContactPhone}
                          onNameChange={setExchangeContactName}
                          onPhoneChange={setExchangeContactPhone}
                          savedContacts={savedContacts}
                          contactsLoading={contactsLoading}
                          disabled={saving}
                          showSavePill={showSaveExchangePickupContactOption}
                          saveActive={saveExchangePickupContactToCustomer}
                          onSaveToggle={() =>
                            setSaveExchangePickupContactToCustomer((prev) => !prev)
                          }
                          onSelectContact={() => setSaveExchangePickupContactToCustomer(false)}
                          header={
                            <div className="flex justify-between items-start mb-2 min-h-[32px]">
                              <label className="text-sm font-medium text-gray-700">איש קשר במוצא — רכב תקול</label>
                              {!selectedCustomerId && (
                                <button
                                  type="button"
                                  onClick={() => copyFromCustomer('exchange_pickup')}
                                  className="text-xs px-2 py-1 rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700"
                                >
                                  כמו לקוח 👤
                                </button>
                              )}
                            </div>
                          }
                        />
                        {workingDestinationContact && (
                          <button
                            type="button"
                            onClick={() => {
                              setDefectiveDestinationContact(workingDestinationContact)
                              setDefectiveDestinationContactPhone(workingDestinationContactPhone)
                            }}
                            className="mt-1.5 text-xs text-cyan-600 hover:underline"
                          >
                            זהה ליעד תקין ↓
                          </button>
                        )}
                      </div>

                      <CustomerContactFields
                        name={defectiveDestinationContact}
                        phone={defectiveDestinationContactPhone}
                        onNameChange={setDefectiveDestinationContact}
                        onPhoneChange={setDefectiveDestinationContactPhone}
                        savedContacts={savedContacts}
                        contactsLoading={contactsLoading}
                        disabled={saving}
                        showSavePill={showSaveDefectiveDestinationContactOption}
                        saveActive={saveDefectiveDestinationContactToCustomer}
                        onSaveToggle={() =>
                          setSaveDefectiveDestinationContactToCustomer((prev) => !prev)
                        }
                        onSelectContact={() => setSaveDefectiveDestinationContactToCustomer(false)}
                        header={
                          <div className="flex justify-between items-start mb-2 min-h-[32px]">
                            <label className="text-sm font-medium text-gray-700">איש קשר ביעד — רכב תקול</label>
                            <div className="flex gap-1.5 flex-wrap justify-end">
                              {!selectedCustomerId && (
                                <button type="button" onClick={() => copyFromCustomer('defective_destination')} className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100">כמו לקוח 👤</button>
                              )}
                            </div>
                          </div>
                        }
                      />
                      </div>
                    </>
                  ) : towType === 'single' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium">איש קשר במוצא</label>
                          {!selectedCustomerId && (
                            <button
                              type="button"
                              onClick={() => copyFromCustomer('pickup')}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                            >
                              כמו לקוח 👤
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className={inputWrapperStatusClass('', pickupContactNameStatus)}>
                            <ContactNameAutocomplete
                              value={pickupContactName}
                              onChange={(name) => {
                                if (pickupStop) updateStop(pickupStop.id, { contactName: name })
                              }}
                              onSelectContact={(contact) => {
                                if (pickupStop) {
                                  updateStop(pickupStop.id, {
                                    contactName: contact.name,
                                    contactPhone: contact.phone ?? '',
                                  })
                                }
                                setSavePickupContactToCustomer(false)
                              }}
                              contacts={savedContacts}
                              loading={contactsLoading}
                              disabled={saving}
                              placeholder="שם"
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                            />
                          </div>
                          <div className={inputWrapperStatusClass('', pickupContactPhoneStatus)}>
                            <PhoneInput
                              value={pickupContactPhone}
                              onChange={(phone) => {
                                if (pickupStop) updateStop(pickupStop.id, { contactPhone: phone })
                              }}
                              placeholder="טלפון"
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                            />
                          </div>
                        </div>
                        <SaveCustomerContactPill
                          className="mt-2"
                          visible={showSavePickupContactOption}
                          active={savePickupContactToCustomer}
                          onToggle={() =>
                            setSavePickupContactToCustomer((prev) => !prev)
                          }
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium">איש קשר ביעד</label>
                          {!selectedCustomerId && (
                            <button
                              type="button"
                              onClick={() => copyFromCustomer('dropoff')}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                            >
                              כמו לקוח 👤
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className={inputWrapperStatusClass('', dropoffContactNameStatus)}>
                            <ContactNameAutocomplete
                              value={dropoffContactName}
                              onChange={(name) => {
                                if (dropoffStop) updateStop(dropoffStop.id, { contactName: name })
                              }}
                              onSelectContact={(contact) => {
                                if (dropoffStop) {
                                  updateStop(dropoffStop.id, {
                                    contactName: contact.name,
                                    contactPhone: contact.phone ?? '',
                                  })
                                }
                                setSaveDropoffContactToCustomer(false)
                              }}
                              contacts={savedContacts}
                              loading={contactsLoading}
                              disabled={saving}
                              placeholder="שם"
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                            />
                          </div>
                          <div className={inputWrapperStatusClass('', dropoffContactPhoneStatus)}>
                            <PhoneInput
                              value={dropoffContactPhone}
                              onChange={(phone) => {
                                if (dropoffStop) updateStop(dropoffStop.id, { contactPhone: phone })
                              }}
                              placeholder="טלפון"
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                            />
                          </div>
                        </div>
                        <SaveCustomerContactPill
                          className="mt-2"
                          visible={showSaveDropoffContactOption}
                          active={saveDropoffContactToCustomer}
                          onToggle={() =>
                            setSaveDropoffContactToCustomer((prev) => !prev)
                          }
                          disabled={saving}
                        />
                      </div>
                    </div>
                  ) : null}
                  <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="הערות"
                    className={withRequestFieldClass(
                      'w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm',
                      notesStatus,
                    )}
                  />
                </div>
              </section>
            )}

            {/* Section 9 — תשלום ושמירה */}
            {towType && quoteApproved && (
              <FormCard icon={Wallet} title="תשלום ושמירה">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash' as any)}
                      className={`px-4 py-2 rounded-xl text-sm ${
                        paymentMethod === 'cash'
                          ? 'bg-gt-brand text-white'
                          : 'bg-white text-gray-700 border border-gray-300 font-medium'
                      }`}
                    >
                      מזומן
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('credit' as any)}
                      className={`px-4 py-2 rounded-xl text-sm ${
                        paymentMethod === 'credit'
                          ? 'bg-gt-brand text-white'
                          : 'bg-white text-gray-700 border border-gray-300 font-medium'
                      }`}
                    >
                      אשראי
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('invoice' as any)}
                      className={`px-4 py-2 rounded-xl text-sm ${
                        paymentMethod === 'invoice'
                          ? 'bg-gt-brand text-white'
                          : 'bg-white text-gray-700 border border-gray-300 font-medium'
                      }`}
                    >
                      חשבונית
                    </button>
                  </div>
                  {paymentMethod === 'invoice' && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={invoiceName}
                        onChange={(e) => setInvoiceName(e.target.value)}
                        placeholder="שם לחשבונית"
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setInvoiceName(customerName)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                      >
                        כמו לקוח
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3 bg-gt-brand text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gt-brand-hover"
                  >
                    {saving ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : null}
                    שמור גרירה
                  </button>
                </div>
              </FormCard>
            )}
          </div>
        </div>

        {/* Side panel */}
        {towType && (
          <aside className="hidden lg:block w-[200px] flex-shrink-0 sticky top-4 self-start">
            <div className="bg-white rounded-xl border border-gray-300 p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">מחיר</p>
              <p className="text-2xl font-bold text-gray-900">₪{finalPrice}</p>
              <p className="text-sm text-gray-600 mt-2">{customerName}</p>
              <p className="text-xs text-gray-500">
                {towDate} {towTime}
              </p>
              <p className="text-xs text-gray-500 mt-1">{getTowTypeLabel(towType)}</p>
              <p className="text-xs mt-2">
                {quoteApproved
                  ? 'אושר ✓'
                  : quoteDeclined
                    ? 'הצעה פתוחה'
                    : 'ממתין לאישור'}
              </p>
            </div>
          </aside>
        )}
      </div>

      {stopContactModalId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-base">איש קשר בנקודת עצירה</h3>
              <button
                type="button"
                onClick={() => setStopContactModalId(null)}
                className={`text-gray-400 hover:text-gray-600 text-xl leading-none${isMobile ? ' p-2 -m-2' : ''}`}
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
                <input
                  type="text"
                  value={stopContactDraft.name}
                  onChange={(e) =>
                    setStopContactDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="שם איש קשר"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                <PhoneInput
                  value={stopContactDraft.phone}
                  onChange={(phone) =>
                    setStopContactDraft((d) => ({ ...d, phone }))
                  }
                  placeholder="050-1234567"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={saveStopContactModal}
                  className="flex-1 py-2.5 bg-[#33d4ff] text-white rounded-xl text-sm font-medium hover:bg-[#21b8e6]"
                >
                  שמור
                </button>
                <button
                  type="button"
                  onClick={() => setStopContactModalId(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <StorageTakeOutConfirmModal
        open={!!storageTakeOutPrompt}
        plateNumber={storageTakeOutPrompt?.plate}
        onConfirm={confirmStorageTakeOut}
        onCancel={cancelStorageTakeOut}
      />

      <PinDropModal
        isOpen={pinDropModal.isOpen}
        onClose={() => setPinDropModal({ isOpen: false, field: null })}
        onConfirm={handlePinDropConfirmWrapped}
        initialAddress={
          pinDropModal.field?.startsWith('routestop:')
            ? routeStops.find((s) => `routestop:${s.id}` === pinDropModal.field)?.address
            : pinDropModal.field === 'exchange' ? exchangeAddress
          : pinDropModal.field === 'workingVehicle' ? workingVehicleAddress
          : pinDropModal.field === 'workingDestination' ? workingVehicleDestinationAddress
          : pinDropModal.field === 'defectiveDestination' ? defectiveDestinationAddress
          : pinDropModal.field === 'followUp' ? followUpAddress
          : undefined
        }
        title={
          pinDropModal.field?.startsWith('routestop:')
            ? 'בחר מיקום'
            : pinDropModal.field === 'pickup'
              ? 'בחר מיקום מוצא'
              : pinDropModal.field === 'dropoff'
                ? 'בחר מיקום יעד'
                : 'בחר מיקום'
        }
      />

      {showWorkingStorageModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-base">בחר רכב תקין מאחסנה</h3>
              <button type="button" onClick={() => setShowWorkingStorageModal(false)} className={`text-gray-400 hover:text-gray-600 text-xl leading-none${isMobile ? ' p-2 -m-2' : ''}`}>✕</button>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {customerStoredVehicles
                .filter(isPickableStoredVehicle)
                .filter((v) => v.vehicle_condition === 'operational')
                .map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    handleSelectWorkingVehicle(v)
                    if (storageAddress) {
                      setWorkingVehicleAddress({
                        address: storageAddress,
                        lat: basePriceList?.base_lat,
                        lng: basePriceList?.base_lng,
                      })
                    }
                    setShowWorkingStorageModal(false)
                  }}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:border-gray-300 text-sm font-medium text-right flex flex-col items-stretch gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span>{v.plate_number}</span>
                      {v.vehicle_data?.model && <span className="text-gray-400 text-xs">— {v.vehicle_data.model}</span>}
                    </div>
                    <span className="text-xs text-gray-400">תקין</span>
                  </div>
                  <TimeInStoragePill lastStoredAt={v.last_stored_at} />
                </button>
              ))}
            </div>
            <div className="px-4 pb-4">
              <button type="button" onClick={() => setShowWorkingStorageModal(false)} className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">ביטול</button>
            </div>
          </div>
        </div>
      )}

        {showDriverPicker && !pendingPickerDriverId && (
          <DriverCalendarPicker
            companyId={companyId || ''}
            drivers={drivers}
            requiredTruckTypes={requiredTruckTypes}
            initialDate={towDate as string}
            initialTime={towTime}
            onConfirm={(driverId, date, time) => {
              const driverTrucks = getDriverTrucks(driverId)
              setPendingPickerDriverId(driverId)
              setPendingPickerDate(date)
              setPendingPickerTime(time)
              setPendingPickerTruckId(driverTrucks.length === 1 ? driverTrucks[0].id : null)
            }}
            onClose={closeDriverPicker}
          />
        )}

        {showDriverPicker && pendingPickerDriverId && (() => {
          const assignDriverTrucks = getDriverTrucks(pendingPickerDriverId)
          const assignTruckOptions =
            assignDriverTrucks.length > 0
              ? assignDriverTrucks
              : trucks.filter((t) => t.is_active)
          return (
            <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
              <div className="bg-white w-full lg:max-w-2xl lg:rounded-2xl lg:mx-4 overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
                  <h2 className="font-bold text-lg">בחירת משאית</h2>
                  <button type="button" onClick={closeDriverPicker} className="p-2 hover:bg-white/20 rounded-lg">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingPickerDriverId(null)
                        setPendingPickerTruckId(null)
                      }}
                      className="flex items-center gap-2 text-[#33d4ff] text-sm font-medium"
                    >
                      <ArrowRight size={18} />
                      חזור לרשימת נהגים
                    </button>

                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                          <User size={24} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">
                            {drivers.find((d) => d.id === pendingPickerDriverId)?.user?.full_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {pendingPickerDate} · {pendingPickerTime}
                          </p>
                        </div>
                      </div>
                    </div>

                    {assignDriverTrucks.length === 1 ? (
                      <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600 flex items-center gap-2">
                        <Truck size={16} className="text-gray-400" />
                        {`${getTruckTypeLabel(assignDriverTrucks[0].truck_type)} — ${assignDriverTrucks[0].plate_number}`}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          בחירת משאית
                        </label>
                        <select
                          value={pendingPickerTruckId || ''}
                          onChange={(e) => setPendingPickerTruckId(e.target.value || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        >
                          <option value="">בחרי משאית...</option>
                          {assignTruckOptions.map((truck) => (
                            <option key={truck.id} value={truck.id}>
                              {truck.plate_number}
                              {(truck.manufacturer || truck.model)
                                ? ` — ${[truck.manufacturer, truck.model].filter(Boolean).join(' ')}`
                                : ` — ${getTruckTypeLabel(truck.truck_type)}`}
                            </option>
                          ))}
                        </select>
                        {assignDriverTrucks.length === 0 && (
                          <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            לנהג זה אין משאית משויכת — בחרי משאית מהרשימה
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <button
                    type="button"
                    onClick={closeDriverPicker}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    disabled={!pendingPickerTruckId}
                    onClick={() => {
                      setPreSelectedDriverId(pendingPickerDriverId)
                      setPreSelectedTruckId(pendingPickerTruckId)
                      setTowDate(pendingPickerDate!)
                      setTowTime(pendingPickerTime!)
                      openedTruckPickerFromUrlRef.current = false
                      closeDriverPicker()
                    }}
                    className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    שבץ נהג
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

      {showAssignNowModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                הגרירה נשמרה בהצלחה!
              </h2>
              <p className="text-gray-500 mb-2">
                מחיר: <span className="font-bold">₪{finalPrice}</span>
              </p>
              <p className="text-gray-600">האם לשבץ נהג עכשיו?</p>
            </div>
            <div className="flex gap-3 p-5 bg-gray-50 border-t border-gray-300">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 font-medium"
              >
                אחר כך
              </button>
              <button
                onClick={() => router.push(`/dashboard/tows/${savedTowId}`)}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] font-medium flex items-center justify-center gap-2"
              >
                <Truck size={18} />
                שבץ נהג
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Helper Components (inline) ====================

function TimeSurchargesSection({
  timeSurchargesData,
  towDate,
  towTime,
  isHoliday,
  setIsHoliday,
  activeTimeSurchargesList,
  setActiveTimeSurchargesList,
  setHasManualTimeSurchargeOverride,
}: {
  timeSurchargesData: TimeSurcharge[]
  towDate: string
  towTime: string
  isHoliday: boolean
  setIsHoliday: (v: boolean) => void
  activeTimeSurchargesList: TimeSurcharge[]
  setActiveTimeSurchargesList: (v: TimeSurcharge[]) => void
  setHasManualTimeSurchargeOverride: (v: boolean) => void
}) {
  const holidaySurcharge = timeSurchargesData.find(
    (s) => s.day_type === 'holiday' && s.is_active
  )
  const isActive = (s: TimeSurcharge) =>
    activeTimeSurchargesList.some((a) => a.id === s.id)
  const toggleSurcharge = (s: TimeSurcharge) => {
    if (isActive(s)) {
      setActiveTimeSurchargesList(
        activeTimeSurchargesList.filter((a) => a.id !== s.id)
      )
    } else {
      setActiveTimeSurchargesList([...activeTimeSurchargesList, s])
    }
    setHasManualTimeSurchargeOverride(true)
  }
  const nonHolidaySurcharges = timeSurchargesData.filter(
    (s) => s.is_active && s.day_type !== 'holiday'
  )

  // Collapsed summary — only the highest active surcharge applies (shared with mobile).
  const topActive = getActiveTimeSurchargeSummary(
    timeSurchargesData,
    activeTimeSurchargesList,
    isHoliday
  )

  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      {!expanded ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-gray-500">
            {topActive ? (
              <>
                תוספת פעילה:{' '}
                <span className="text-gray-700 font-medium">
                  {topActive.label} ({topActive.percent}%)
                </span>
              </>
            ) : (
              'אין תוספת זמן פעילה'
            )}
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="shrink-0 text-sm font-medium text-gt-brand"
          >
            שנה סוג תוספת
          </button>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            מופעלת תוספת אחת בלבד — הגבוהה מביניהן
          </p>
          <div className="flex flex-wrap gap-2">
            {nonHolidaySurcharges.map((s) => {
              const active = isActive(s)
              const chipLabel = getTimeSurchargeLabel(s)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSurcharge(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200 font-medium'
                      : 'border border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                  }`}
                >
                  {chipLabel} ({s.surcharge_percent}%)
                </button>
              )
            })}
            {holidaySurcharge && (
              <button
                type="button"
                onClick={() => setIsHoliday(!isHoliday)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isHoliday
                    ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200 font-medium'
                    : 'border border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                }`}
              >
                חג ({holidaySurcharge.surcharge_percent}%)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function LocationSurchargesSection({
  locationSurchargesData,
  selectedLocationSurcharges,
  setSelectedLocationSurcharges,
}: {
  locationSurchargesData: LocationSurcharge[]
  selectedLocationSurcharges: string[]
  setSelectedLocationSurcharges: (v: string[]) => void
}) {
  const active = locationSurchargesData.filter((s) => s.is_active)
  if (active.length === 0) return null
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">
        תוספות מיקום
      </p>
      <div className="flex flex-wrap gap-2">
        {active.map((s) => {
          const isSelected = selectedLocationSurcharges.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (isSelected)
                  setSelectedLocationSurcharges(
                    selectedLocationSurcharges.filter((id) => id !== s.id)
                  )
                else
                  setSelectedLocationSurcharges([
                    ...selectedLocationSurcharges,
                    s.id,
                  ])
              }}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                isSelected ? 'bg-gt-brand text-white' : 'border border-gray-300'
              }`}
            >
              {s.label} ({s.surcharge_percent}%)
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ==================== Page Export ====================

export default function CreateTowPage() {
  const searchParams = useSearchParams()
  const editTowId = searchParams.get('edit') || undefined
  const duplicateFromId = searchParams.get('duplicate') || undefined
  const duplicateFromEventId = searchParams.get('duplicateEvent') || undefined
  const fromRequestId = searchParams.get('fromRequest') || undefined
  const dateParam = searchParams.get('date')
  const timeParam = searchParams.get('time')
  const driverParam = searchParams.get('driver')
  const storedVehicleParam = searchParams.get('storedVehicle')

  // Resolve viewport once on mount so neither the desktop form nor the mobile
  // wizard flashes on first paint. Locked after mount — a live resize listener
  // would remount the other tree (separate useTowForm) and wipe form state on
  // orientation change when crossing 640px.
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  useEffect(() => {
    setIsMobile(window.innerWidth < 640)
  }, [])

  // The wizard (Part 1) only handles a pure fresh create. Edit / duplicate /
  // stored-vehicle prefill flows keep the existing desktop form, even on mobile.
  const isFreshCreate =
    !editTowId &&
    !duplicateFromId &&
    !duplicateFromEventId &&
    !storedVehicleParam &&
    !fromRequestId

  if (isMobile === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gt-brand" />
      </div>
    )
  }

  if (isMobile && isFreshCreate) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-gray-500">טוען...</div>
          </div>
        }
      >
        <TowCreateWizard />
      </Suspense>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-500">טוען...</div>
        </div>
      }
    >
      <CreateTowForm
        editTowId={editTowId}
        duplicateFromId={duplicateFromId}
        duplicateFromEventId={duplicateFromEventId}
        fromRequestId={fromRequestId}
        dateParam={dateParam}
        timeParam={timeParam}
        driverParam={driverParam}
      />
    </Suspense>
  )
}
