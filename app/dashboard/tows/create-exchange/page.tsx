'use client'

/// <reference types="google.maps" />
declare global {
  interface Window {
    google: typeof google
  }
}

import { Suspense, useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  Check,
  Car,
  Truck,
  Loader2,
  X,
  User,
  AlertTriangle,
} from 'lucide-react'
import { useTowForm } from '../../../hooks/useTowForm'
import { useAuth } from '../../../lib/AuthContext'
import {
  canApproveQuote,
  canEditClosedTow,
  isClosedTowStatus,
} from '../../../lib/utils/can-edit-closed-tow'
import { AddressInput } from '../../../components/tow-forms/routes/AddressInput'
import { yardFromBasePriceList } from '../../../lib/utils/storage-yard-match'
import {
  PinDropModal,
  ServiceSurchargeSelector,
} from '../../../components/tow-forms/shared'
import { DriverCalendarPicker } from '../../../components/DriverCalendarPicker'
import { CreateCustomerSection } from '../../../components/tow-forms/sections/CreateCustomerSection'
import { StorageTakeOutConfirmModal } from '../../../components/tow-forms/StorageTakeOutConfirmModal'
import { FormCard, FormSubcard, Input } from '../../../components/ui'
import { PhoneInput } from '../../../components/ui/PhoneInput'
import { lookupVehicle } from '../../../lib/vehicle-lookup'
import { normalizePlate } from '../../../lib/utils/plate-number'
import { shouldTriggerPlateLookupOnBlur } from '../../../lib/utils/plate-lookup-blur'
import {
  DEFECT_OPTIONS,
  defectOptionClassName,
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
import { TimeInStoragePill } from '../../../components/storage/TimeInStoragePill'
import { prepareTowData } from '../../../lib/utils/tow-save-handler'
import { CustomerContactFields } from '../../../components/customer-contacts/CustomerContactFields'
import { useCustomerContacts } from '../../../hooks/useCustomerContacts'
import { useCustomerOrderers } from '../../../hooks/useCustomerOrderers'
import { insertPendingCustomerContacts } from '../../../lib/queries/customer-contacts'
import { insertPendingCustomerOrderers } from '../../../lib/queries/customer-orderers'
import { shouldOfferSaveCustomerContact } from '../../../lib/utils/customer-contact-save-ui'
import { shouldOfferSaveCustomerOrderer } from '../../../lib/utils/customer-orderer-save-ui'
import type { AddressData } from '../../../lib/google-maps'
import type { TimeSurcharge, LocationSurcharge } from '../../../lib/queries/price-lists'
import type { VehicleLookupResult, VehicleType } from '../../../lib/types'

function CreateExchangeTowForm({
  editTowId,
  dateParam,
  timeParam,
}: {
  editTowId?: string
  dateParam: string | null
  timeParam: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const persistCustomerContactsRef = useRef<() => Promise<void>>(async () => {})
  const persistCustomerOrderersRef = useRef<() => Promise<void>>(async () => {})
  const form = useTowForm(editTowId, {
    beforeSaveTow: async () => {
      await persistCustomerContactsRef.current()
      await persistCustomerOrderersRef.current()
    },
  })

  const {
    companyId,
    showAssignNowModal,
    savedTowId,
    saving,
    setSaving,
    error,
    setError,
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
    towDate,
    setTowDate,
    towTime,
    setTowTime,
    towEndDate,
    setTowEndDate,
    towEndTime,
    setTowEndTime,
    setIsToday,
    towType,
    setTowType,
    distance,
    routePoints,
    customRouteData,
    requiredTruckTypes,
    setRequiredTruckTypes,
    truckTypeError,
    setTruckTypeError,
    truckTypeSectionRef,
    manualManufacturer,
    manualColor,
    manualWeight,
    customerStoredVehicles,
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
    startFromBase,
    setStartFromBase,
    baseToPickupDistance,
    customerOrderNumber,
    setCustomerOrderNumber,
    customerOrderNumberFromStorage,
    department,
    setDepartment,
    orderedBy,
    setOrderedBy,
    orderNumber,
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
    handlePinDropConfirm,
    finalPrice,
    priceResult,
    manualAdjustmentPercent,
    setManualAdjustmentPercent,
    manualAdjustmentType,
    setManualAdjustmentType,
    handleCustomerSelect,
    handleSelectWorkingVehicle,
    handleDefectiveVehiclePlateInputChange,
    tryResolveStoredPlateForSlot,
    storageTakeOutPrompt,
    confirmStorageTakeOut,
    cancelStorageTakeOut,
    copyFromCustomer,
    handleSave,
    vehiclePlate,
    vehicleCode,
    vehicleType,
    vehicleData,
    selectedServices,
    dropoffToStorage,
    selectedStoredVehicleId,
  } = form

  const [customerTab, setCustomerTab] = useState<'existing' | 'casual'>('existing')
  const [customerSearch, setCustomerSearch] = useState('')

  const usesCompanyTimeFallback =
    priceMode === 'recommended_customer' &&
    !!selectedCustomerPricing &&
    (selectedCustomerPricing?.customer_time_surcharges?.length ?? 0) === 0

  const [quoteApproved, setQuoteApproved] = useState(false)
  const [quoteDeclined, setQuoteDeclined] = useState(false)
  const [quoteSavedId, setQuoteSavedId] = useState<string | null>(null)
  const [approvingQuote, setApprovingQuote] = useState(false)
  const [showDriverPicker, setShowDriverPicker] = useState(false)
  const [pendingPickerDriverId, setPendingPickerDriverId] = useState<string | null>(null)
  const [pendingPickerDate, setPendingPickerDate] = useState<string | null>(null)
  const [pendingPickerTime, setPendingPickerTime] = useState<string | null>(null)
  const [pendingPickerTruckId, setPendingPickerTruckId] = useState<string | null>(null)
  const truckPickerFromUrlAppliedRef = useRef(false)
  const openedTruckPickerFromUrlRef = useRef(false)
  const [plateStorageWarning, setPlateStorageWarning] = useState<string | null>(null)
  const [showDefectsExchangeModal, setShowDefectsExchangeModal] = useState(false)
  const [showWorkingServicesModal, setShowWorkingServicesModal] = useState(false)
  const [showDefectiveServicesModal, setShowDefectiveServicesModal] = useState(false)
  const [showWorkingStorageModal, setShowWorkingStorageModal] = useState(false)
  const [otherDefectText, setOtherDefectText] = useState('')
  const [saveWorkingSourceContactToCustomer, setSaveWorkingSourceContactToCustomer] =
    useState(false)
  const [saveWorkingDestinationContactToCustomer, setSaveWorkingDestinationContactToCustomer] =
    useState(false)
  const [saveExchangePickupContactToCustomer, setSaveExchangePickupContactToCustomer] =
    useState(false)
  const [saveDefectiveDestinationContactToCustomer, setSaveDefectiveDestinationContactToCustomer] =
    useState(false)
  const [saveOrdererToCustomer, setSaveOrdererToCustomer] = useState(false)

  const { savedContacts, contactsLoading } = useCustomerContacts(
    companyId,
    selectedCustomerId
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

  useEffect(() => {
    setSaveWorkingSourceContactToCustomer(false)
    setSaveWorkingDestinationContactToCustomer(false)
    setSaveExchangePickupContactToCustomer(false)
    setSaveDefectiveDestinationContactToCustomer(false)
    setSaveOrdererToCustomer(false)
  }, [selectedCustomerId])

  useEffect(() => {
    if (!showSaveWorkingSourceContactOption) setSaveWorkingSourceContactToCustomer(false)
  }, [showSaveWorkingSourceContactOption])

  useEffect(() => {
    if (!showSaveWorkingDestinationContactOption) setSaveWorkingDestinationContactToCustomer(false)
  }, [showSaveWorkingDestinationContactOption])

  useEffect(() => {
    if (!showSaveExchangePickupContactOption) setSaveExchangePickupContactToCustomer(false)
  }, [showSaveExchangePickupContactOption])

  useEffect(() => {
    if (!showSaveDefectiveDestinationContactOption) setSaveDefectiveDestinationContactToCustomer(false)
  }, [showSaveDefectiveDestinationContactOption])

  const persistExchangeCustomerContacts = useCallback(async () => {
    if (!companyId || !selectedCustomerId) return

    const pending: { name: string; phone: string | null }[] = []

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

    if (pending.length === 0) return
    await insertPendingCustomerContacts(companyId, selectedCustomerId, pending)
  }, [
    companyId,
    selectedCustomerId,
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
  ])

  useEffect(() => {
    persistCustomerContactsRef.current = persistExchangeCustomerContacts
  }, [persistExchangeCustomerContacts])

  const isBusinessCustomer =
    customerTab === 'existing' &&
    !!selectedCustomerId &&
    customers.find((c) => c.id === selectedCustomerId)?.customer_type === 'business'

  const { savedOrderers, orderersLoading } = useCustomerOrderers(
    companyId,
    isBusinessCustomer ? selectedCustomerId : null
  )

  const showSaveOrdererOption = shouldOfferSaveCustomerOrderer(
    isBusinessCustomer,
    selectedCustomerId,
    department,
    orderedBy,
    savedOrderers
  )

  useEffect(() => {
    if (!showSaveOrdererOption) {
      setSaveOrdererToCustomer(false)
    }
  }, [showSaveOrdererOption])

  const persistExchangeCustomerOrderers = useCallback(async () => {
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
    persistCustomerOrderersRef.current = persistExchangeCustomerOrderers
  }, [persistExchangeCustomerOrderers])

  useEffect(() => {
    if (!editTowId) setTowType('exchange')
  }, [editTowId, setTowType])

  useEffect(() => {
    if (editTowId) return
    if (dateParam) setTowDate(dateParam)
    if (timeParam) setTowTime(timeParam)
  }, [editTowId, dateParam, timeParam, setTowDate, setTowTime])

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
    const driverTrucks = trucks.filter((t) =>
      (t.assigned_drivers ?? []).some((d) => d.id === driverFromUrl)
    )
    setPendingPickerDriverId(driverFromUrl)
    setPendingPickerDate(dateFromUrl || towDate || '')
    setPendingPickerTime(timeFromUrl || towTime || '')
    setPendingPickerTruckId(driverTrucks.length === 1 ? driverTrucks[0].id : null)
    setShowDriverPicker(true)
    truckPickerFromUrlAppliedRef.current = true
    openedTruckPickerFromUrlRef.current = true
  }, [
    searchParams,
    trucks,
    drivers,
    editTowId,
    towDate,
    towTime,
    setPreSelectedDriverId,
    setPreSelectedTruckId,
  ])

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

  const getDriverTrucks = (driverId: string) =>
    trucks.filter((t) => (t.assigned_drivers ?? []).some((d) => d.id === driverId))

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

  const handleNowClick = () => {
    const now = new Date()
    setTowDate(now.toISOString().split('T')[0])
    setTowTime(now.toTimeString().slice(0, 5))
    setIsToday(true)
  }

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
    else handlePinDropConfirm(data)
  }

  const [workingLookupLoading, setWorkingLookupLoading] = useState(false)
  const [defectiveLookupLoading, setDefectiveLookupLoading] = useState(false)

  const handleWorkingVehicleLookup = useCallback(
    async (plate?: string) => {
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
    },
    [
      workingVehiclePlate,
      workingVehicleCode,
      tryResolveStoredPlateForSlot,
      setWorkingVehicleCode,
    ]
  )

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
    setSaving(true)
    setError('')
    try {
      await persistExchangeCustomerContacts()

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
        selectedDefects: [],
        requiredTruckTypes,
        routeStops: undefined,
        distance: exchangeTotalDistance ?? null,
        startFromBase,
        baseToPickupDistance,
        routePoints,
        customRouteData,
        priceMode,
        finalPrice,
        manualAdjustmentPercent: (() => {
          const adj = parseFloat(manualAdjustmentPercent ?? '') || 0
          return manualAdjustmentType === 'discount' ? -adj : adj
        })(),
        basePriceList,
        selectedCustomerPricing,
        activeTimeSurcharges: activeTimeSurchargesList,
        selectedLocationSurcharges,
        locationSurchargesData,
        selectedServices: [
          ...(workingSelectedServices ?? []),
          ...(defectiveSelectedServices ?? []),
        ],
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
        defectiveVehicleType: towType === 'exchange' ? defectiveVehicleType || undefined : undefined,
        workingVehicleSourceAddress: towType === 'exchange' ? workingVehicleAddress : undefined,
        workingVehicleDestinationAddress:
          towType === 'exchange' ? workingVehicleDestinationAddress : undefined,
        workingVehicleContactName: towType === 'exchange' ? workingVehicleContact : undefined,
        workingVehicleContactPhone: towType === 'exchange' ? workingVehicleContactPhone : undefined,
        defectiveVehiclePlate: towType === 'exchange' ? defectiveVehiclePlate : undefined,
        defectiveVehicleCode: towType === 'exchange' ? defectiveVehicleCode : undefined,
        defectiveVehicleData: towType === 'exchange' ? defectiveVehicleData : undefined,
        exchangePointAddress: towType === 'exchange' ? exchangeAddress : undefined,
        exchangeContactName: towType === 'exchange' ? exchangeContactName : undefined,
        exchangeContactPhone: towType === 'exchange' ? exchangeContactPhone : undefined,
        workingDestinationContactName:
          towType === 'exchange' ? workingDestinationContact : undefined,
        workingDestinationContactPhone:
          towType === 'exchange' ? workingDestinationContactPhone : undefined,
        defectiveDestinationAddress:
          towType === 'exchange' ? defectiveDestinationAddress : undefined,
        defectiveDestinationContactName:
          towType === 'exchange' ? defectiveDestinationContact : undefined,
        defectiveDestinationContactPhone:
          towType === 'exchange' ? defectiveDestinationContactPhone : undefined,
        workingVehicleSource: towType === 'exchange' ? workingVehicleSource : undefined,
        workingVehicleDestinationIsStorage:
          towType === 'exchange' ? workingVehicleDestinationIsStorage : undefined,
        defectiveDestination: towType === 'exchange' ? defectiveDestination : undefined,
        workingSelectedServices: towType === 'exchange' ? workingSelectedServices : undefined,
        defectiveSelectedServices: towType === 'exchange' ? defectiveSelectedServices : undefined,
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
        manualManufacturer,
        manualColor,
        manualWeight,
        workingManualManufacturer,
        workingManualColor,
        workingManualWeight,
        workingManualChassis,
        defectiveManualManufacturer,
        defectiveManualColor,
        defectiveManualWeight,
        defectiveManualChassis,
        existingTowVehicles: editTowId ? editExistingVehicles : undefined,
        existingTowPoints: editTowId ? editExistingPoints : undefined,
      })
      let quoteTowId = editTowId
      if (editTowId) {
        await updateTow({ ...towData, towId: editTowId, status: 'quote', priceMode })
        setQuoteSavedId(editTowId)
        try {
          const currentReservations = await getVehiclesReservedForTow(editTowId)
          const desiredIds = new Set<string>()
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
      router.push('/dashboard')
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
    towEndDate,
    towEndTime,
    vehiclePlate,
    vehicleCode,
    vehicleType,
    vehicleData,
    defectiveVehiclePlate,
    defectiveVehicleData,
    defectiveVehicleType,
    defectiveVehicleCode,
    exchangeAddress,
    defectiveDestinationAddress,
    exchangeTotalDistance,
    startFromBase,
    baseToPickupDistance,
    routePoints,
    customRouteData,
    priceMode,
    finalPrice,
    manualAdjustmentPercent,
    manualAdjustmentType,
    basePriceList,
    selectedCustomerPricing,
    activeTimeSurchargesList,
    selectedLocationSurcharges,
    locationSurchargesData,
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
    workingVehiclePlate,
    workingVehicleData,
    workingVehicleType,
    workingVehicleAddress,
    workingVehicleDestinationAddress,
    workingVehicleContact,
    workingVehicleContactPhone,
    workingDestinationContact,
    workingDestinationContactPhone,
    exchangeContactName,
    exchangeContactPhone,
    defectiveDestinationContact,
    defectiveDestinationContactPhone,
    defectiveDestination,
    manualManufacturer,
    manualColor,
    manualWeight,
    editTowId,
    editTowSnapshot,
    stopsBeforeExchange,
    stopsAfterExchange,
    getExchangeEditPriceBaselineSignature,
    getExchangeRouteLayout,
    timeSurchargesData,
    isHoliday,
    hasManualTimeSurchargeOverride,
    router,
    setSaving,
    setError,
    setTruckTypeError,
    truckTypeSectionRef,
    setQuoteSavedId,
    persistExchangeCustomerContacts,
    loadedTowStatus,
  ])

  const storageAddress = basePriceList?.base_address || ''
  const storageYard = yardFromBasePriceList(basePriceList)
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
        fieldKey: 'create-exchange-working-origin',
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
        fieldKey: 'create-exchange-working-dest',
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
        fieldKey: 'create-exchange-defective-dest',
      }
    : null

  const TRUCK_OPTIONS = [
    { value: 'wheel_lift_cradle', label: 'משקפיים' },
    { value: 'flatbed', label: 'רמסע' },
    { value: 'carrier', label: 'מובילית' },
  ] as const

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

  const showForm = towType === 'exchange'

  return (
    <div className="min-h-screen bg-gt-canvas -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8" dir="rtl">
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error}
        </div>
      )}

      <header className="bg-white border-b border-gray-300 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/tows"
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <ArrowRight size={20} />
              </Link>
              <div>
                <h1 className="font-bold text-gray-800 text-base sm:text-lg">
                  {editTowId ? 'עריכת גרירת תקין ↔ תקול' : 'גרירת תקין ↔ תקול'}
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">
                  {editTowId ? 'עדכון פרטי הגרירה' : 'מילוי פרטי הגרירה'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 sm:py-6 flex flex-col items-center gap-6">
        <div className="w-[680px] max-w-full">
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
          />

          {showForm && (
            <FormCard
              icon={Car}
              title="רכב ומסלול"
              description="פרטי הרכבים, תקלות, גרר ונקודות מסלול"
            >
              <div className="space-y-4">
                    {showDefectsExchangeModal && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-[480px]">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-base">בחר תקלות</h3>
                            <button
                              type="button"
                              onClick={() => setShowDefectsExchangeModal(false)}
                              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="p-4 grid grid-cols-3 gap-3">
                            {DEFECT_OPTIONS.map((defect) => {
                              const Icon = defect.icon
                              const selected = selectedDefects.includes(defect.value)
                              return (
                              <button
                                key={defect.value}
                                type="button"
                                onClick={() => {
                                  setSelectedDefects((prev) =>
                                    prev.includes(defect.value)
                                      ? prev.filter((d) => d !== defect.value)
                                      : [...prev, defect.value]
                                  )
                                }}
                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm transition-colors ${defectOptionClassName(selected, defect.highlight, 'grid')}`}
                              >
                                <Icon className="h-6 w-6 shrink-0" aria-hidden />
                                <span className="text-xs font-medium text-center leading-tight">{defect.label}</span>
                              </button>
                              )
                            })}
                          </div>
                          {selectedDefects.includes('אחר') && (
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
                                setSelectedDefects((prev) => {
                                  if (!prev.includes('אחר')) return prev
                                  const trimmed = otherDefectText.trim()
                                  if (!trimmed) return prev
                                  return [...prev.filter((v) => v !== 'אחר'), trimmed]
                                })
                                setShowDefectsExchangeModal(false)
                              }}
                              className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium text-sm"
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
                            <button type="button" onClick={() => setShowWorkingServicesModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                          </div>
                          <div className="p-4">
                            <ServiceSurchargeSelector
                              services={serviceSurchargesData}
                              selectedServices={workingSelectedServices}
                              onChange={setWorkingSelectedServices}
                            />
                          </div>
                          <div className="px-4 pb-4">
                            <button type="button" onClick={() => setShowWorkingServicesModal(false)} className="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium">אישור</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {showDefectiveServicesModal && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-base">שירותים נוספים — תקול</h3>
                            <button type="button" onClick={() => setShowDefectiveServicesModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
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
                              </div>
                          {workingVehicleData?.found && workingVehicleData.data && (
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                <span className="text-xs font-medium text-green-700">נמצא במאגר הרשמי</span>
                                {workingVehicleData.sourceLabel && (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                                    {workingVehicleData.sourceLabel}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl content-start">
                                {[
                                  { label: 'יצרן', value: workingVehicleData.data.manufacturer },
                                  { label: 'דגם', value: workingVehicleData.data.model },
                                  { label: 'שנה', value: workingVehicleData.data.year != null ? String(workingVehicleData.data.year) : null },
                                  { label: 'צבע', value: workingVehicleData.data.color },
                                  { label: 'הנעה', value: workingVehicleData.data.driveType },
                                  { label: 'גיר', value: workingVehicleData.data.gearType },
                                  { label: 'משקל', value: workingVehicleData.data.totalWeight != null ? `${workingVehicleData.data.totalWeight} ק״ג` : null },
                                  { label: 'משקל עצמי', value: workingVehicleData.source === 'heavy' && workingVehicleData.data.curbWeightKg != null && workingVehicleData.data.curbWeightKg > 0 ? `${workingVehicleData.data.curbWeightKg} ק״ג` : null },
                                ].filter((f): f is { label: string; value: string } => Boolean(f.value)).map((f) => (
                                  <span key={f.label}
                                    className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                                    <span className="text-gray-400">{f.label}: </span>{f.value}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="min-h-0">
                            {workingVehicleNotFound && (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                                <p className="text-sm text-amber-700 font-medium">הרכב לא נמצא במאגר — יש למלא ידנית</p>
                                <div className="grid grid-cols-2 gap-3">
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
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">משקל (ק"ג)</label>
                                    <Input type="number" value={workingManualWeight}
                                      onChange={(e) => setWorkingManualWeight(e.target.value)}
                                      placeholder="אופציונלי" />
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
                              {defectiveVehicleData?.found && defectiveVehicleData.data && (
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                    <span className="text-xs font-medium text-green-700">נמצא במאגר הרשמי</span>
                                    {defectiveVehicleData.sourceLabel && (
                                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                                        {defectiveVehicleData.sourceLabel}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl content-start">
                                    {[
                                      { label: 'יצרן', value: defectiveVehicleData.data.manufacturer },
                                      { label: 'דגם', value: defectiveVehicleData.data.model },
                                      { label: 'שנה', value: defectiveVehicleData.data.year != null ? String(defectiveVehicleData.data.year) : null },
                                      { label: 'צבע', value: defectiveVehicleData.data.color },
                                      { label: 'הנעה', value: defectiveVehicleData.data.driveType },
                                      { label: 'גיר', value: defectiveVehicleData.data.gearType },
                                      { label: 'משקל', value: defectiveVehicleData.data.totalWeight != null ? `${defectiveVehicleData.data.totalWeight} ק״ג` : null },
                                      { label: 'משקל עצמי', value: defectiveVehicleData.source === 'heavy' && defectiveVehicleData.data.curbWeightKg != null && defectiveVehicleData.data.curbWeightKg > 0 ? `${defectiveVehicleData.data.curbWeightKg} ק״ג` : null },
                                    ].filter((f): f is { label: string; value: string } => Boolean(f.value)).map((f) => (
                                      <span key={f.label}
                                        className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                                        <span className="text-gray-400">{f.label}: </span>{f.value}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="min-h-0">
                                {defectiveVehicleNotFound && (
                                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                                    <p className="text-sm text-amber-700 font-medium">הרכב לא נמצא במאגר — יש למלא ידנית</p>
                                    <div className="grid grid-cols-2 gap-3">
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
                                        <label className="block text-xs text-gray-600 mb-1">משקל (ק"ג)</label>
                                        <Input type="number" value={defectiveManualWeight}
                                          onChange={(e) => setDefectiveManualWeight(e.target.value)}
                                          placeholder="אופציונלי" />
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
                                  onClick={() => setShowDefectsExchangeModal(true)}
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
                                {defectiveDestination === 'storage' && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={hasStorageFollowUp}
                                      onClick={() => {
                                        const next = !hasStorageFollowUp
                                        setHasStorageFollowUp(next)
                                        if (!next) {
                                          setFollowUpAddress({ address: '' })
                                          setFollowUpContactName('')
                                          setFollowUpContactPhone('')
                                          setInheritCustomerOrderNumber(false)
                                        }
                                      }}
                                      className="flex w-full items-start justify-between gap-3 py-2 text-right cursor-pointer"
                                    >
                                      <span
                                        aria-hidden
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-all duration-200 ${
                                          hasStorageFollowUp ? 'bg-[#33d4ff] justify-end' : 'bg-gray-200 justify-start'
                                        }`}
                                      >
                                        <span className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200" />
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-gray-800">יש המשך לגרירה?</div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                          צרי גרירה נוספת מהחניון אל יעד חדש
                                        </div>
                                      </div>
                                    </button>

                                    {hasStorageFollowUp && (
                                      <div className="mt-3 space-y-2 bg-cyan-50/30 rounded-lg p-3 border border-cyan-100">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            יעד ההמשך
                                          </label>
                                          <AddressInput
                                            value={followUpAddress}
                                            onChange={(d: AddressData) => setFollowUpAddress(d)}
                                            placeholder="כתובת היעד של הגרירה הבאה"
                                            onPinDropClick={() => handlePinDropOpen('followUp')}
                                          />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                              שם איש קשר ביעד
                                            </label>
                                            <input
                                              type="text"
                                              value={followUpContactName}
                                              onChange={(e) => setFollowUpContactName(e.target.value)}
                                              placeholder="שם"
                                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                              טלפון איש קשר
                                            </label>
                                            <PhoneInput
                                              value={followUpContactPhone}
                                              onChange={(phone) => setFollowUpContactPhone(phone)}
                                              placeholder="050-1234567"
                                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                                            />
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          role="switch"
                                          aria-checked={inheritCustomerOrderNumber}
                                          onClick={() => setInheritCustomerOrderNumber((prev) => !prev)}
                                          className="flex w-full items-start justify-between gap-3 py-2 text-right cursor-pointer"
                                        >
                                          <span
                                            aria-hidden
                                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-all duration-200 ${
                                              inheritCustomerOrderNumber ? 'bg-[#33d4ff] justify-end' : 'bg-gray-200 justify-start'
                                            }`}
                                          >
                                            <span className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200" />
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-gray-800">שמור מס׳ הזמנת לקוח לגרירת ההמשך</div>
                                          </div>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </FormSubcard>
                    </div>

                    <FormSubcard title="תוספות זמן">
                      <TimeSurchargesSection
                        timeSurchargesData={timeSurchargesData}
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
              </div>
            </FormCard>
          )}

          {showForm && (
            <section className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden mb-6">
              <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-300">
                <h2 className="font-bold text-gray-800 text-sm sm:text-base">
                  מחיר
                </h2>
              </div>
              <div className="p-4 sm:p-5 space-y-4">
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
                        ? 'bg-blue-500 text-white'
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
                          ? 'bg-blue-500 text-white'
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
                      priceMode === 'fixed' ? 'bg-blue-500 text-white' : 'bg-gray-100'
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
                        ? 'bg-blue-500 text-white'
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
                          .map((item, idx) => (
                            <p key={idx} className={item.bold ? 'font-bold text-base text-gray-900' : 'text-gray-500'}>
                              {item.label}: ₪{item.amount.toFixed(2)}
                            </p>
                          ))}
                        {usesCompanyTimeFallback &&
                          priceResult.breakdown.some(
                            (item) => item.type === 'time' && item.amount !== 0
                          ) && (
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
                        <p className="font-bold">סה״כ: ₪{finalPrice.toFixed(2)}</p>
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
            </section>
          )}

          {showForm && !isEditingClosedTow && (
            <section className="bg-amber-50 rounded-2xl border-2 border-amber-300 shadow-sm overflow-hidden mb-6">
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
                      {getTowTypeLabel('exchange')} • {(exchangeTotalDistance?.distanceKm ?? 0).toFixed(1)} ק״מ
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

          <div
            style={{
              opacity: lockedOpacity,
              pointerEvents: lockedPointer as React.CSSProperties['pointerEvents'],
            }}
          >
            {showForm && quoteApproved && (
<section className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden mb-6">
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

            {showForm && quoteApproved && (
              <section className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden mb-6">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-300">
                  <h2 className="font-bold text-gray-800 text-sm sm:text-base">אנשי קשר</h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
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
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="הערות"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                  />
                </div>
              </section>
            )}

            {showForm && quoteApproved && (
<section className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden mb-6">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-300">
                  <h2 className="font-bold text-gray-800 text-sm sm:text-base">
                    תשלום ושמירה
                  </h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash' as any)}
                      className={`px-4 py-2 rounded-xl text-sm ${
                        paymentMethod === 'cash'
                          ? 'bg-blue-500 text-white'
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
                          ? 'bg-blue-500 text-white'
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
                          ? 'bg-blue-500 text-white'
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
                  <div className="p-4 bg-gray-50 rounded-xl text-sm">
                    <p className="font-medium mb-1">{customerName}</p>
                    <p className="text-gray-500 mb-1">{customerPhone}</p>
                    <p className="text-gray-500 mb-1">
                      {towDate} {towTime}
                    </p>
                    <p className="text-gray-500 mb-1">
                      {vehiclePlate || defectiveVehiclePlate} —{' '}
                      {vehicleData?.data?.model ||
                        defectiveVehicleData?.data?.model ||
                        ''}
                    </p>
                    <p className="font-bold mt-2">₪{finalPrice}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : null}
                    שמור גרירה
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>

        {showForm && (
          <aside className="hidden lg:block w-[200px] flex-shrink-0 sticky top-24 self-start">
            <div className="bg-white rounded-xl border border-gray-300 p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">מחיר</p>
              <p className="text-xl font-bold">₪{finalPrice}</p>
              <p className="text-sm text-gray-600 mt-2">{customerName}</p>
              <p className="text-xs text-gray-500">
                {towDate} {towTime}
              </p>
              <p className="text-xs text-gray-500 mt-1">{getTowTypeLabel('exchange')}</p>
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
          pinDropModal.field === 'exchange' ? exchangeAddress
          : pinDropModal.field === 'workingVehicle' ? workingVehicleAddress
          : pinDropModal.field === 'workingDestination' ? workingVehicleDestinationAddress
          : pinDropModal.field === 'defectiveDestination' ? defectiveDestinationAddress
          : pinDropModal.field === 'followUp' ? followUpAddress
          : undefined
        }
        title="בחר מיקום"
      />

      {showWorkingStorageModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-base">בחר רכב תקין מאחסנה</h3>
              <button type="button" onClick={() => setShowWorkingStorageModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
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
                    const storageAddress = basePriceList?.base_address || ''
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
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">
        תוספות זמן ומועד
      </p>
      <p className="text-xs text-gray-500 mb-2">
        מופעלת תוספת אחת בלבד — הגבוהה מביניהן
      </p>
      <div className="flex flex-wrap gap-2">
        {nonHolidaySurcharges.map((s) => {
          const active = isActive(s)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSurcharge(s)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                active
                  ? 'bg-amber-500 text-white'
                  : 'border border-gray-300 text-gray-500'
              }`}
            >
              {s.label} ({s.surcharge_percent}%)
            </button>
          )
        })}
        {holidaySurcharge && (
          <button
            type="button"
            onClick={() => setIsHoliday(!isHoliday)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              isHoliday ? 'bg-amber-500 text-white' : 'border border-gray-300 text-gray-500'
            }`}
          >
            חג ({holidaySurcharge.surcharge_percent}%)
          </button>
        )}
      </div>
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
                isSelected ? 'bg-blue-500 text-white' : 'border border-gray-300'
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

export default function CreateExchangeTowPage() {
  const searchParams = useSearchParams()
  const editTowId = searchParams.get('edit') || undefined
  const dateParam = searchParams.get('date')
  const timeParam = searchParams.get('time')

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-500">טוען...</div>
        </div>
      }
    >
      <CreateExchangeTowForm
        editTowId={editTowId}
        dateParam={dateParam}
        timeParam={timeParam}
      />
    </Suspense>
  )
}
