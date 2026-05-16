'use client'

/// <reference types="google.maps" />
declare global {
  interface Window {
    google: typeof google
  }
}

import { Suspense, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getDayTows } from '../../../lib/queries/calendar'
import { TowWithDetails } from '../../../lib/queries/tows'
import {
  ArrowRight,
  Check,
  Truck,
  MapPin,
  Plus,
  Minus,
  Calendar,
  Loader2,
} from 'lucide-react'
import { useTowForm } from '../../../hooks/useTowForm'
import { AddressInput } from '../../../components/tow-forms/routes/AddressInput'
import {
  PinDropModal,
  VehicleLookup,
  ServiceSurchargeSelector,
} from '../../../components/tow-forms/shared'
import { DriverCalendarPicker } from '../../../components/DriverCalendarPicker'
import { RouteBuilder } from '../../../components/tow-forms/routes/RouteBuilder'
import { CreateCustomerSection } from '../../../components/tow-forms/sections/CreateCustomerSection'
import { lookupVehicle } from '../../../lib/vehicle-lookup'
import { normalizePlate } from '../../../lib/utils/plate-number'
import { createCustomer } from '../../../lib/queries/customers'
import { createTow } from '../../../lib/queries/tows'
import { addVehicleToStorage, releaseVehicleFromStorage, searchStoredVehicle } from '../../../lib/queries/storage'
import { prepareTowData } from '../../../lib/utils/tow-save-handler'
import type { AddressData } from '../../../lib/google-maps'
import type { SelectedService } from '../../../components/tow-forms/shared'
import type { RoutePoint } from '../../../components/tow-forms/routes/RouteBuilder'
import { getActiveTimeSurcharges } from '../../../lib/queries/price-lists'
import type { TimeSurcharge, LocationSurcharge, ServiceSurcharge } from '../../../lib/queries/price-lists'
import type { StoredVehicleWithCustomer } from '../../../lib/queries/storage'
import type { VehicleLookupResult, VehicleType } from '../../../lib/types'

// ==================== Create Tow Form ====================

function CreateTowForm({
  editTowId,
  dateParam,
  timeParam,
  driverParam,
}: {
  editTowId?: string
  dateParam: string | null
  timeParam: string | null
  driverParam: string | null
}) {
  const router = useRouter()
  const form = useTowForm(editTowId)

  const {
    router: _router,
    companyId,
    showAssignNowModal,
    savedTowId,
    saving,
    setSaving,
    error,
    setError,
    customers,
    drivers,
    customersWithPricing,
    selectedCustomerId,
    preSelectedDriverId,
    setPreSelectedDriverId,
    basePriceList,
    fixedPriceItems,
    selectedCustomerPricing,
    setSelectedCustomerPricing,
    locationSurchargesData,
    serviceSurchargesData,
    selectedLocationSurcharges,
    setSelectedLocationSurcharges,
    selectedServices,
    setSelectedServices,
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
    isToday,
    setIsToday,
    towType,
    setTowType,
    routePoints,
    setRoutePoints,
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
    customerStoredVehicles,
    selectedStoredVehicleId,
    setSelectedStoredVehicleId,
    dropoffToStorage,
    setDropoffToStorage,
    storageVehicleCondition,
    setStorageVehicleCondition,
    workingVehicleSource,
    setWorkingVehicleSource,
    selectedWorkingVehicleId,
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
    pickupAddress,
    setPickupAddress,
    dropoffAddress,
    setDropoffAddress,
    distance,
    distanceLoading,
    startFromBase,
    setStartFromBase,
    baseToPickupDistance,
    baseToPickupLoading,
    pickupContactName,
    setPickupContactName,
    pickupContactPhone,
    setPickupContactPhone,
    dropoffContactName,
    setDropoffContactName,
    dropoffContactPhone,
    setDropoffContactPhone,
    customerOrderNumber,
    setCustomerOrderNumber,
    orderNumber,
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
    manualAdjustmentPercent, setManualAdjustmentPercent,
    manualAdjustmentType, setManualAdjustmentType,
    handleCustomerSelect,
    handleSelectStoredVehicle,
    handleClearStoredVehicle,
    handleSelectWorkingVehicle,
    handleClearWorkingVehicle,
    handlePinDropConfirm,
    copyFromCustomer,
    resetForm,
    handleSave,
    setSavedTowId,
    setShowAssignNowModal,
  } = form

  const { user } = form as { user?: { id: string } | null }

  // Local state for new form
  const [customerTab, setCustomerTab] = useState<'existing' | 'casual'>('existing')
  const [customerSearch, setCustomerSearch] = useState('')
  const [quoteApproved, setQuoteApproved] = useState(false)
  const [quoteDeclined, setQuoteDeclined] = useState(false)
  const [quoteSavedId, setQuoteSavedId] = useState<string | null>(null)
  const [defectiveLookupLoading, setDefectiveLookupLoading] = useState(false)
  const [workingLookupLoading, setWorkingLookupLoading] = useState(false)
  const [showDriverPicker, setShowDriverPicker] = useState(false)
  const [plateStorageWarning, setPlateStorageWarning] = useState<string | null>(null)
  const [vehicleNotFound, setVehicleNotFound] = useState(false)
  const [showTruckModal, setShowTruckModal] = useState(false)
  const [showDefectsModal, setShowDefectsModal] = useState(false)
  const [showDefectsExchangeModal, setShowDefectsExchangeModal] = useState(false)
  const [showWorkingServicesModal, setShowWorkingServicesModal] = useState(false)
  const [showDefectiveServicesModal, setShowDefectiveServicesModal] = useState(false)
  const [showStorageModal, setShowStorageModal] = useState(false)
  const [showWorkingStorageModal, setShowWorkingStorageModal] = useState(false)
  const [otherDefectText, setOtherDefectText] = useState('')

  // URL params
  useEffect(() => {
    if (dateParam) setTowDate(dateParam)
    if (timeParam) setTowTime(timeParam)
    if (driverParam) setPreSelectedDriverId(driverParam)
  }, [dateParam, timeParam, driverParam])

  const handleNowClick = () => {
    const now = new Date()
    setTowDate(now.toISOString().split('T')[0])
    setTowTime(now.toTimeString().slice(0, 5))
    setIsToday(true)
  }

  const handleTowTypeSelect = (type: 'single' | 'exchange' | 'custom') => {
    setTowType(type)
    resetForm(true)
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
    else handlePinDropConfirm(data)
  }

  // Vehicle lookup for single
  const handleVehicleLookup = useCallback(async () => {
    if (vehiclePlate.replace(/[^0-9]/g, '').length < 5) return
    setDefectiveLookupLoading(true)
    try {
      if (companyId) {
        const stored = await searchStoredVehicle(companyId, vehiclePlate)
        if (stored) {
          const isSameCustomer = stored.customer_id === selectedCustomerId
          if (isSameCustomer) {
            setPlateStorageWarning('הרכב נמצא באחסנה — יש לבחור "איסוף מאחסנה"')
          } else {
            setPlateStorageWarning('הרכב שייך ללקוח אחר באחסנה ולא ניתן לשבצו לגרירה זו')
          }
          setVehicleData(null)
          return
        } else {
          setPlateStorageWarning(null)
        }
      }
      const result = await lookupVehicle(vehiclePlate)
      if (result.found && result.data) {
        setVehicleData(result)
        setVehicleType(result.source || 'private')
        setVehicleNotFound(false)
      } else {
        setVehicleData(null)
        setVehicleType('')
        setVehicleNotFound(true)
        setManualManufacturer('')
        setManualColor('')
        setManualWeight('')
      }
    } catch {
      setVehicleData(null)
    } finally {
      setDefectiveLookupLoading(false)
    }
  }, [vehiclePlate, companyId, selectedCustomerId])

  // Vehicle lookup for defective (exchange)
  const handleDefectiveLookup = useCallback(async () => {
    if (defectiveVehiclePlate.replace(/[^0-9]/g, '').length < 5) return
    setDefectiveLookupLoading(true)
    try {
      const result = await lookupVehicle(defectiveVehiclePlate)
      if (result.found && result.data) {
        setDefectiveVehicleData(result)
        setDefectiveVehicleType(result.source || 'private')
      } else {
        setDefectiveVehicleData(null)
      }
    } catch {
      setDefectiveVehicleData(null)
    } finally {
      setDefectiveLookupLoading(false)
    }
  }, [defectiveVehiclePlate])

  // Vehicle lookup for working (exchange)
  const handleWorkingLookup = useCallback(async () => {
    if (workingVehiclePlate.replace(/[^0-9]/g, '').length < 5) return
    setWorkingLookupLoading(true)
    try {
      const result = await lookupVehicle(workingVehiclePlate)
      if (result.found && result.data) {
        setWorkingVehicleData(result)
        setWorkingVehicleType(result.source || 'private')
      } else {
        setWorkingVehicleData(null)
      }
    } catch {
      setWorkingVehicleData(null)
    } finally {
      setWorkingLookupLoading(false)
    }
  }, [workingVehiclePlate])

  // Custom save for quote declined
  const handleSaveAsQuote = useCallback(async () => {
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
      const pickupAddr = pickupAddress
      const dropoffAddr = dropoffAddress
      const dist = distance
      const plate = vehiclePlate
      const vData = vehicleData
      const vType = vehicleType

      const towData = prepareTowData({
        companyId,
        userId: user.id,
        towType,
        customerOrderNumber: '',
        customerId: finalCustomerId,
        customerName,
        customerPhone,
        towDate,
        towTime,
        preSelectedDriverId: null,
        vehiclePlate: plate,
        vehicleCode,
        vehicleType: vType,
        vehicleData: vData,
        selectedDefects: [],
        requiredTruckTypes,
        pickupAddress: pickupAddr,
        dropoffAddress: dropoffAddr,
        distance: dist,
        startFromBase,
        baseToPickupDistance,
        routePoints,
        customRouteData,
        priceMode,
        finalPrice,
        basePriceList,
        selectedCustomerPricing,
        activeTimeSurcharges: activeTimeSurchargesList,
        selectedLocationSurcharges,
        locationSurchargesData,
        selectedServices,
        serviceSurchargesData,
        notes,
        pickupContactName,
        pickupContactPhone,
        dropoffContactName,
        dropoffContactPhone,
        paymentMethod: paymentMethod || undefined,
        invoiceName: invoiceName || undefined,
        dropoffToStorage,
        workingVehiclePlate: towType === 'exchange' ? workingVehiclePlate : undefined,
        workingVehicleData: towType === 'exchange' ? workingVehicleData : undefined,
        workingVehicleType: towType === 'exchange' ? workingVehicleType : undefined,
        workingVehicleSourceAddress: towType === 'exchange' ? workingVehicleAddress : undefined,
        workingVehicleDestinationAddress: towType === 'exchange' ? workingVehicleDestinationAddress : undefined,
        workingVehicleContactName: towType === 'exchange' ? workingVehicleContact : undefined,
        workingVehicleContactPhone: towType === 'exchange' ? workingVehicleContactPhone : undefined,
        defectiveVehiclePlate: towType === 'exchange' ? defectiveVehiclePlate : undefined,
        defectiveVehicleData: towType === 'exchange' ? defectiveVehicleData : undefined,
        exchangePointAddress: towType === 'exchange' ? exchangeAddress : undefined,
        exchangeContactName: towType === 'exchange' ? exchangeContactName : undefined,
        exchangeContactPhone: towType === 'exchange' ? exchangeContactPhone : undefined,
        workingDestinationContactName: towType === 'exchange' ? workingDestinationContact : undefined,
        workingDestinationContactPhone: towType === 'exchange' ? workingDestinationContactPhone : undefined,
        defectiveDestinationAddress: towType === 'exchange' ? defectiveDestinationAddress : undefined,
        defectiveDestinationContactName: towType === 'exchange' ? defectiveDestinationContact : undefined,
        defectiveDestinationContactPhone: towType === 'exchange' ? defectiveDestinationContactPhone : undefined,
        manualManufacturer,
        manualColor,
        manualWeight,
      })
      const result = await createTow({ ...towData, status: 'quote' as const })
      if (selectedStoredVehicleId && companyId) {
        await releaseVehicleFromStorage({
          storedVehicleId: selectedStoredVehicleId,
          towId: result.id,
          performedBy: user.id,
          notes: 'שוחרר לגרירה',
        })
      }
      if (dropoffToStorage && companyId) {
        await addVehicleToStorage({
          companyId,
          customerId: selectedCustomerId || undefined,
          plateNumber: plate,
          vehicleData: vData?.data
            ? {
                manufacturer: vData.data.manufacturer || undefined,
                model: vData.data.model || undefined,
                year: vData.data.year?.toString(),
                color: vData.data.color || undefined,
                gearType: vData.data.gearType || undefined,
                driveType: vData.data.driveType || undefined,
                totalWeight: vData.data.totalWeight?.toString(),
                source: vData.source || undefined,
                sourceLabel: vData.sourceLabel || undefined,
              }
            : undefined,
          towId: result.id,
          performedBy: user.id,
          notes: 'נכנס מגרירה',
          vehicleCondition: 'operational',
        })
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
    vehiclePlate,
    vehicleCode,
    vehicleType,
    vehicleData,
    defectiveVehiclePlate,
    defectiveVehicleData,
    pickupAddress,
    dropoffAddress,
    exchangeAddress,
    defectiveDestinationAddress,
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
    notes,
    pickupContactName,
    pickupContactPhone,
    dropoffContactName,
    dropoffContactPhone,
    paymentMethod,
    invoiceName,
    dropoffToStorage,
    selectedStoredVehicleId,
  ])

  const totalDistanceKm =
    towType === 'custom'
      ? customRouteData.totalDistanceKm
      : (distance?.distanceKm ?? 0) +
        (startFromBase && baseToPickupDistance ? baseToPickupDistance.distanceKm : 0)

  const storageAddress = basePriceList?.base_address || ''

  const TRUCK_OPTIONS = [
    { value: 'wheel_lift_cradle', label: 'משקפיים' },
    { value: 'flatbed', label: 'רמסע' },
    { value: 'carrier', label: 'מובילית' },
  ] as const

  const DEFECT_OPTIONS = [
    { value: 'אין חשמל', label: 'אין חשמל', icon: '🔋' },
    { value: 'גיר', label: 'גיר', icon: '⚙️' },
    { value: 'גלגל עקום או שבור', label: 'גלגל עקום או שבור', icon: '⚙️' },
    { value: 'חניון תת קרקעי', label: 'חניון תת קרקעי', icon: '🏢' },
    { value: 'לא נדלק/לא מניע', label: 'לא נדלק/לא מניע', icon: '🔧' },
    { value: 'מוגבל מהירות', label: 'מוגבל מהירות', icon: '🚗' },
    { value: 'מניע/נדלק ונוסע', label: 'מניע/נדלק ונוסע', icon: '✓' },
    { value: 'נילת מים/שמן', label: 'נילת מים/שמן', icon: '💧' },
    { value: "פנצ'ר", label: "פנצ'ר", icon: '⚫' },
    { value: 'תאונה', label: 'תאונה', icon: '🚨' },
    { value: 'תקר', label: 'תקר', icon: '🚗' },
    { value: 'אחר', label: 'אחר', icon: '✏️' },
  ] as const

  const openDefectsModal = () => {
    const defectOptionValues = new Set<string>(DEFECT_OPTIONS.map((o) => o.value))
    const custom = selectedDefects.find((d) => !defectOptionValues.has(d))
    if (custom) {
      setOtherDefectText(custom)
      setSelectedDefects((prev) => {
        const without = prev.filter((x) => x !== custom)
        return without.includes('אחר') ? without : [...without, 'אחר']
      })
    }
    setShowDefectsModal(true)
  }

  const lockedOpacity = quoteApproved ? 1 : 0.35
  const lockedPointer = quoteApproved ? 'auto' : 'none'

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
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
                  גרירה חדשה
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">
                  מילוי פרטי הגרירה
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 sm:py-6 flex flex-col items-center gap-6">
        <div className="w-[680px] max-w-full">
          {/* Section 1 — לקוח */}
          <CreateCustomerSection
            customers={customers}
            customersWithPricing={customersWithPricing}
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
            onTowDateChange={setTowDate}
            onTowTimeChange={setTowTime}
            onNowClick={handleNowClick}
            customerOrderNumber={customerOrderNumber}
            onCustomerOrderNumberChange={setCustomerOrderNumber}
            editTowId={editTowId}
            orderNumber={orderNumber}
          />

          {/* Section 2 — סוג גרירה */}
          <section className="mb-6">
            <h2 className="font-bold text-gray-800 text-sm sm:text-base mb-3 px-1">
              סוג גרירה
            </h2>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
              {[
                { value: 'single' as const, label: 'גרירה פשוטה', sub: 'A→B' },
                { value: 'exchange' as const, label: 'תקין ↔ תקול', sub: '3 שלבים' },
                { value: 'custom' as const, label: 'מסלול מותאם', sub: 'נקודות חופשיות' },
              ].map((option, i) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleTowTypeSelect(option.value)}
                  className={`flex-1 py-2.5 px-2 text-center transition-colors
                    ${i > 0 ? 'border-r border-gray-200' : ''}
                    ${
                      towType === option.value
                        ? 'bg-[#33d4ff] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div
                    className={`text-xs mt-0.5 ${
                      towType === option.value ? 'text-white/80' : 'text-gray-400'
                    }`}
                  >
                    {option.sub}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Section 4 — רכב ומסלול */}
          {towType && (
            <section className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden mb-6">
              <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-300">
                <h2 className="font-bold text-gray-800 text-sm sm:text-base">
                  רכב ומסלול
                </h2>
              </div>
              <div className="p-4 sm:p-5 space-y-6">
                {towType === 'single' && (
                  <>
                    {/* Block 1 — פרטי רכב */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-700 text-sm">פרטי רכב</h3>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              מספר רכב
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={vehiclePlate}
                                onChange={(e) => { setVehiclePlate(normalizePlate(e.target.value)); setPlateStorageWarning(null); setVehicleNotFound(false) }}
                                onBlur={async (e) => {
                                  const val = e.target.value.trim()
                                  if (val && val.replace(/[^0-9]/g, '').length >= 5) {
                                    handleVehicleLookup()
                                  }
                                }}
                                placeholder="1234567"
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-mono tracking-widest"
                              />
                              <button
                                type="button"
                                onClick={handleVehicleLookup}
                                disabled={
                                  vehiclePlate.replace(/[^0-9]/g, '').length < 5 ||
                                  defectiveLookupLoading
                                }
                                className="px-4 py-2.5 bg-cyan-500 text-white rounded-xl text-sm font-medium hover:bg-cyan-600"
                              >
                                {defectiveLookupLoading ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  'בדיקת רישוי'
                                )}
                              </button>
                            </div>
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
                        <div className="flex justify-end">
                          {selectedCustomerId && customerStoredVehicles.length > 0 && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setShowStorageModal(true)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 border transition-colors ${
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
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                              <span className="text-xs font-medium text-green-700">נמצא במאגר הרשמי</span>
                              {vehicleData.sourceLabel && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                                  {vehicleData.sourceLabel}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50 rounded-xl">
                              {vehicleData.data.manufacturer && (
                                <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                                  <span className="text-gray-400">יצרן: </span>
                                  {vehicleData.data.manufacturer}
                                </span>
                              )}
                              {vehicleData.data.model && (
                                <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                                  <span className="text-gray-400">דגם: </span>
                                  {vehicleData.data.model}
                                </span>
                              )}
                              {vehicleData.data.year != null && (
                                <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                                  <span className="text-gray-400">שנה: </span>
                                  {vehicleData.data.year}
                                </span>
                              )}
                              {vehicleData.data.color && (
                                <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                                  <span className="text-gray-400">צבע: </span>
                                  {vehicleData.data.color}
                                </span>
                              )}
                              {vehicleData.data.driveType && (
                                <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                                  <span className="text-gray-400">הנעה: </span>
                                  {vehicleData.data.driveType}
                                </span>
                              )}
                              {vehicleData.data.gearType && (
                                <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                                  <span className="text-gray-400">גיר: </span>
                                  {vehicleData.data.gearType}
                                </span>
                              )}
                              {vehicleData.data.totalWeight != null && (
                                <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                                  <span className="text-gray-400">משקל: </span>
                                  {vehicleData.data.totalWeight} ק״ג
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {vehicleNotFound && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                            <p className="text-sm text-amber-700 font-medium">הרכב לא נמצא במאגר — יש למלא ידנית</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">סוג רכב *</label>
                                <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as any)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm">
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
                                <input type="text" value={manualManufacturer}
                                  onChange={(e) => setManualManufacturer(e.target.value)}
                                  placeholder="למשל: טויוטה"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">צבע</label>
                                <input type="text" value={manualColor}
                                  onChange={(e) => setManualColor(e.target.value)}
                                  placeholder="למשל: לבן"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">משקל (ק&quot;ג)</label>
                                <input type="number" value={manualWeight}
                                  onChange={(e) => setManualWeight(e.target.value)}
                                  placeholder="אופציונלי"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Block 2 — תקלות וגרר */}
                    <div ref={truckTypeSectionRef} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-700 text-sm">תקלות וגרר</h3>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={openDefectsModal}
                            className={`w-full py-3 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                              selectedDefects.length > 0
                                ? 'border-red-400 bg-red-50 text-red-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            🔧 {selectedDefects.length > 0 ? `תקלות (${selectedDefects.length})` : 'בחר תקלות'}
                          </button>
                          {vehicleData === null && !vehicleNotFound ? (
                            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 px-2 py-3 text-center text-sm text-gray-400">
                              סוג הגרר יופיע לאחר בדיקת רישוי
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowTruckModal(true)}
                              className={`w-full py-3 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                                requiredTruckTypes.length > 0
                                  ? 'border-blue-400 bg-blue-50 text-blue-700'
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
                      </div>
                    </div>

                    {/* Block 3 — כתובות ומסלול */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-700 text-sm">כתובות ומסלול</h3>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <label className="text-sm font-medium text-gray-700 block">כתובת מוצא</label>
                            </div>
                            <AddressInput
                              value={pickupAddress}
                              onChange={(d: AddressData) => setPickupAddress(d)}
                              label="כתובת מוצא"
                              hideLabel
                              onPinDropClick={() => handlePinDropOpen('pickup')}
                            />
                            <button
                              type="button"
                              onClick={() => setStartFromBase(!startFromBase)}
                              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm ${
                                startFromBase
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white text-gray-700 border border-gray-300 font-medium'
                              }`}
                            >
                              יציאה מהחניון
                            </button>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">כתובת הורדה</label>
                            <AddressInput
                              value={dropoffAddress}
                              onChange={(d: AddressData) => setDropoffAddress(d)}
                              label="כתובת הורדה"
                              hideLabel
                              onPinDropClick={() => handlePinDropOpen('dropoff')}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (dropoffToStorage) {
                                  setDropoffToStorage(false)
                                  setDropoffAddress({ address: '' })
                                  return
                                }
                                setDropoffToStorage(true)
                                if (storageAddress)
                                  setDropoffAddress({
                                    address: storageAddress,
                                    lat: basePriceList?.base_lat,
                                    lng: basePriceList?.base_lng,
                                  })
                              }}
                              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm ${
                                dropoffToStorage
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white text-gray-700 border border-gray-300 font-medium'
                              }`}
                            >
                              הורדה לאחסנה
                            </button>
                            {dropoffToStorage && (
                              <div className="flex gap-2 mt-2 items-center flex-wrap">
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
                          </div>
                        </div>
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
                        </div>
                      </div>
                    </div>

                    {/* Block 4 — תוספות זמן */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-700 text-sm">תוספות זמן</h3>
                      </div>
                      <div className="p-4">
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
                      </div>
                    </div>

                    {showDefectsModal && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-[480px]">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-base">בחר תקלות</h3>
                            <button
                              type="button"
                              onClick={() => setShowDefectsModal(false)}
                              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="p-4 grid grid-cols-3 gap-3">
                            {DEFECT_OPTIONS.map((defect) => (
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
                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm transition-colors ${
                                  selectedDefects.includes(defect.value)
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-300'
                                }`}
                              >
                                <span className="text-2xl">{defect.icon}</span>
                                <span className="text-xs font-medium text-center leading-tight">{defect.label}</span>
                              </button>
                            ))}
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
                                setShowDefectsModal(false)
                              }}
                              className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium text-sm"
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

                    {showTruckModal && (vehicleData !== null || vehicleNotFound) && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-[320px]">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-base">סוג גרר נדרש</h3>
                            <button
                              type="button"
                              onClick={() => setShowTruckModal(false)}
                              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
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
                              className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium text-sm"
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

                    {showStorageModal && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 text-base">בחר רכב מאחסנה</h3>
                            <button
                              type="button"
                              onClick={() => setShowStorageModal(false)}
                              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="p-4 flex flex-col gap-2">
                            {customerStoredVehicles.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  if (selectedStoredVehicleId === v.id) {
                                    handleClearStoredVehicle()
                                  } else {
                                    handleSelectStoredVehicle(v)
                                    if (storageAddress) {
                                      setPickupAddress({
                                        address: storageAddress,
                                        lat: basePriceList?.base_lat,
                                        lng: basePriceList?.base_lng,
                                      })
                                      setStartFromBase(true)
                                    }
                                  }
                                  setShowStorageModal(false)
                                }}
                                className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-medium text-right flex items-center justify-between transition-colors ${
                                  selectedStoredVehicleId === v.id
                                    ? 'border-green-500 bg-green-50 text-green-700'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-2.5 h-2.5 rounded-full ${
                                      v.vehicle_condition === 'operational' ? 'bg-green-500' : 'bg-red-500'
                                    }`}
                                  />
                                  <span>{v.plate_number}</span>
                                  {v.vehicle_data?.model && (
                                    <span className="text-gray-400 text-xs">— {v.vehicle_data.model}</span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400">
                                  {v.vehicle_condition === 'operational' ? 'תקין' : 'תקול'}
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="px-4 pb-4">
                            <button
                              type="button"
                              onClick={() => setShowStorageModal(false)}
                              className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm"
                            >
                              ביטול
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {towType === 'exchange' && (
                  <>
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
                            {DEFECT_OPTIONS.map((defect) => (
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
                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm transition-colors ${
                                  selectedDefects.includes(defect.value)
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-300'
                                }`}
                              >
                                <span className="text-2xl">{defect.icon}</span>
                                <span className="text-xs font-medium text-center leading-tight">{defect.label}</span>
                              </button>
                            ))}
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

                    {/* Exchange tow: shared row grid — תקין | תקול aligned */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch mb-4">
                      {/* Row 1: headers */}
                      <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between gap-2 flex-wrap min-h-[52px]">
                        <h3 className="font-bold text-blue-800 text-sm">רכב תקין</h3>
                        {workingVehicleSource === 'storage' ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowWorkingStorageModal(true)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-blue-500 text-white border-blue-500"
                            >
                              🏪 מאחסנה: {workingVehiclePlate}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setWorkingVehicleSource('address')
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
                              onClick={() => setShowWorkingStorageModal(true)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-white text-blue-600 border-blue-200 hover:border-blue-400 shrink-0"
                            >
                              🏪 מאחסנה
                            </button>
                          )
                        )}
                      </div>
                      <div className="px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl flex items-center min-h-[52px]">
                        <h3 className="font-bold text-orange-800 text-sm">רכב תקול</h3>
                      </div>

                      {/* Row 2: plate (warning only on תקין — spacer on תקול for alignment) */}
                      <div className="flex flex-col gap-2 min-h-[72px] justify-end">
                        {plateStorageWarning && <p className="text-sm text-red-500">{plateStorageWarning}</p>}
                        <input
                          type="text"
                          value={workingVehiclePlate}
                          onChange={(e) => { setWorkingVehiclePlate(e.target.value); setWorkingVehicleNotFound(false) }}
                          onBlur={async (e) => {
                            const val = e.target.value.trim()
                            if (val && val.replace(/[^0-9]/g, '').length >= 5) {
                              const stored = companyId ? await searchStoredVehicle(companyId, val) : null
                              if (stored) {
                                setWorkingVehicleNotFound(false)
                                setPlateStorageWarning('הרכב נמצא באחסנה — יש לבחור "איסוף מאחסנה"')
                              } else {
                                setPlateStorageWarning(null)
                                const result = await lookupVehicle(val)
                                if (result.found && result.data) {
                                  setWorkingVehicleData(result)
                                  setWorkingVehicleType(result.source || 'private')
                                  setWorkingVehicleNotFound(false)
                                } else {
                                  setWorkingVehicleData(null)
                                  setWorkingVehicleNotFound(true)
                                }
                              }
                            }
                          }}
                          placeholder="לוחית תקין"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] text-right font-mono tracking-widest"
                          dir="ltr"
                        />
                      </div>
                      <div className="flex flex-col gap-2 min-h-[72px] justify-end">
                        <div className="min-h-[22px]" aria-hidden />
                        <input
                          type="text"
                          value={defectiveVehiclePlate}
                          onChange={(e) => { setDefectiveVehiclePlate(normalizePlate(e.target.value)); setDefectiveVehicleNotFound(false) }}
                          onBlur={async (e) => {
                            const val = e.target.value.trim()
                            if (val && val.replace(/[^0-9]/g, '').length >= 5) {
                              const result = await lookupVehicle(val)
                              if (result.found && result.data) {
                                setDefectiveVehicleData(result)
                                setDefectiveVehicleType(result.source || 'private')
                                setDefectiveVehicleNotFound(false)
                              } else {
                                setDefectiveVehicleData(null)
                                setDefectiveVehicleNotFound(true)
                              }
                            }
                          }}
                          placeholder="לוחית תקול"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] text-right font-mono tracking-widest"
                          dir="ltr"
                        />
                      </div>

                      {/* Row 3: vehicle code */}
                      <div className="min-h-[40px] flex flex-col justify-center">
                        <input
                          type="text"
                          value={workingVehicleCode}
                          onChange={(e) => setWorkingVehicleCode(e.target.value)}
                          placeholder="קוד רכב תקין"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#33d4ff]/40"
                        />
                      </div>
                      <div className="min-h-[40px] flex flex-col justify-center">
                        <input
                          type="text"
                          value={defectiveVehicleCode}
                          onChange={(e) => setDefectiveVehicleCode(e.target.value)}
                          placeholder="קוד רכב תקול"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#33d4ff]/40"
                        />
                      </div>

                      {/* Row 4: vehicle info pills (matched min-height) */}
                      <div className="min-h-[4rem] flex flex-col">
                        <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl flex-1 content-start">
                          {workingVehicleData?.found && workingVehicleData.data && [
                            { label: 'יצרן', value: workingVehicleData.data.manufacturer },
                            { label: 'דגם', value: workingVehicleData.data.model },
                            { label: 'שנה', value: workingVehicleData.data.year != null ? String(workingVehicleData.data.year) : null },
                            { label: 'צבע', value: workingVehicleData.data.color },
                            { label: 'הנעה', value: workingVehicleData.data.driveType },
                            { label: 'גיר', value: workingVehicleData.data.gearType },
                            { label: 'משקל', value: workingVehicleData.data.totalWeight != null ? `${workingVehicleData.data.totalWeight} ק״ג` : null },
                          ].filter((f): f is { label: string; value: string } => Boolean(f.value)).map((f) => (
                            <span key={f.label}
                              className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                              <span className="text-gray-400">{f.label}: </span>{f.value}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="min-h-[4rem] flex flex-col">
                        <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl flex-1 content-start">
                          {defectiveVehicleData?.found && defectiveVehicleData.data && [
                            { label: 'יצרן', value: defectiveVehicleData.data.manufacturer },
                            { label: 'דגם', value: defectiveVehicleData.data.model },
                            { label: 'שנה', value: defectiveVehicleData.data.year != null ? String(defectiveVehicleData.data.year) : null },
                            { label: 'צבע', value: defectiveVehicleData.data.color },
                            { label: 'הנעה', value: defectiveVehicleData.data.driveType },
                            { label: 'גיר', value: defectiveVehicleData.data.gearType },
                            { label: 'משקל', value: defectiveVehicleData.data.totalWeight != null ? `${defectiveVehicleData.data.totalWeight} ק״ג` : null },
                          ].filter((f): f is { label: string; value: string } => Boolean(f.value)).map((f) => (
                            <span key={f.label}
                              className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                              <span className="text-gray-400">{f.label}: </span>{f.value}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Row 5: manual entry when not found */}
                      <div className="min-h-0">
                        {workingVehicleNotFound && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                            <p className="text-sm text-amber-700 font-medium">הרכב לא נמצא במאגר — יש למלא ידנית</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">סוג רכב *</label>
                                <select value={workingVehicleType} onChange={(e) => setWorkingVehicleType(e.target.value as VehicleType)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm">
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
                                <input type="text" value={workingManualManufacturer}
                                  onChange={(e) => setWorkingManualManufacturer(e.target.value)}
                                  placeholder="למשל: טויוטה"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">צבע</label>
                                <input type="text" value={workingManualColor}
                                  onChange={(e) => setWorkingManualColor(e.target.value)}
                                  placeholder="למשל: לבן"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">משקל (ק"ג)</label>
                                <input type="number" value={workingManualWeight}
                                  onChange={(e) => setWorkingManualWeight(e.target.value)}
                                  placeholder="אופציונלי"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="min-h-0">
                        {defectiveVehicleNotFound && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                            <p className="text-sm text-amber-700 font-medium">הרכב לא נמצא במאגר — יש למלא ידנית</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">סוג רכב *</label>
                                <select value={defectiveVehicleType} onChange={(e) => setDefectiveVehicleType(e.target.value as VehicleType)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm">
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
                                <input type="text" value={defectiveManualManufacturer}
                                  onChange={(e) => setDefectiveManualManufacturer(e.target.value)}
                                  placeholder="למשל: טויוטה"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">צבע</label>
                                <input type="text" value={defectiveManualColor}
                                  onChange={(e) => setDefectiveManualColor(e.target.value)}
                                  placeholder="למשל: לבן"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">משקל (ק"ג)</label>
                                <input type="number" value={defectiveManualWeight}
                                  onChange={(e) => setDefectiveManualWeight(e.target.value)}
                                  placeholder="אופציונלי"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Row 6: סוג גרר תקין | תקלות + גרר נוסף (+ סוג גרר לתקול) */}
                      <div className="flex flex-col gap-2 min-h-[4.5rem] justify-start">
                        {(workingVehicleData?.found || workingVehicleNotFound || workingVehicleSource === 'storage') ? (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">סוג גרר נדרש *</p>
                            <div className="flex gap-2 flex-wrap">
                              {TRUCK_OPTIONS.map((opt) => (
                                <button key={opt.value} type="button"
                                  onClick={() => {
                                    const current = requiredTruckTypes.filter(t => t !== opt.value)
                                    if (requiredTruckTypes.includes(opt.value)) setRequiredTruckTypes(current)
                                    else setRequiredTruckTypes([...current, opt.value])
                                  }}
                                  className={`px-4 py-2 rounded-xl text-sm ${requiredTruckTypes.includes(opt.value) ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 border-2 border-gray-200'}`}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="min-h-[4.5rem] rounded-xl border border-transparent" aria-hidden />
                        )}
                      </div>
                      <div className="flex flex-col gap-2 min-h-[4.5rem] justify-start">
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

                      {/* Row 7: שירותים נוספים */}
                      <div className="min-h-[48px] flex flex-col justify-center">
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
                        ) : (
                          <div className="min-h-[44px]" aria-hidden />
                        )}
                      </div>
                      <div className="min-h-[48px] flex flex-col justify-center">
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
                        ) : (
                          <div className="min-h-[44px]" aria-hidden />
                        )}
                      </div>

                      {/* כתובות: DOM order מוצא תקין → יעד תקין → מוצא תקול → יעד תקול */}
                      <div className="col-span-1 lg:col-span-2 border-t border-gray-100 pt-3">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div className="min-h-[120px] flex flex-col">
                              <label className="block text-xs font-medium text-gray-500 mb-1">מוצא הרכב התקין</label>
                              {workingVehicleSource === 'storage' ? (
                                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                                  <span>🏪 {workingVehicleAddress?.address || storageAddress || 'כתובת האחסנה'}</span>
                                  <button
                                    type="button"
                                    onClick={() => { setWorkingVehicleSource('address'); setWorkingVehicleAddress({ address: '' }) }}
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
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => setStartFromBase(!startFromBase)}
                                className={`mt-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                                  startFromBase
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                }`}
                              >
                                יציאה מהחניון
                              </button>
                            </div>
                            <div className="border-t border-gray-100 pt-3 min-h-[100px] flex flex-col">
                              <label className="block text-xs font-medium text-gray-500 mb-1">יעד הרכב התקין</label>
                              <AddressInput
                                value={workingVehicleDestinationAddress}
                                onChange={(d: AddressData) => setWorkingVehicleDestinationAddress(d)}
                                label=""
                                hideLabel
                                onPinDropClick={() => handlePinDropOpen('workingDestination')}
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
                          <div className="space-y-3">
                            <div className="min-h-[120px] flex flex-col">
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
                                className="mt-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                זהה ליעד התקין
                              </button>
                            </div>
                            <div className="border-t border-gray-100 pt-3 min-h-[100px] flex flex-col">
                              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">יעד הרכב התקול</label>
                              <AddressInput
                                value={defectiveDestinationAddress}
                                onChange={(d: AddressData) => setDefectiveDestinationAddress(d)}
                                label=""
                                hideLabel
                                onPinDropClick={() => handlePinDropOpen('defectiveDestination')}
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
                                  <button type="button" onClick={() => { setDefectiveDestination('address'); setDefectiveDestinationAddress({ address: '' }) }} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* תוספות זמן */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-700 text-sm">תוספות זמן</h3>
                      </div>
                      <div className="p-4">
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
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-3 mt-2">
                      <LocationSurchargesSection
                        locationSurchargesData={locationSurchargesData}
                        selectedLocationSurcharges={selectedLocationSurcharges}
                        setSelectedLocationSurcharges={setSelectedLocationSurcharges}
                      />
                    </div>
                  </>
                )}

                {towType === 'custom' && (
                  <>
                    <RouteBuilder
                      companyId={companyId || ''}
                      customerId={selectedCustomerId}
                      customerName={customerName}
                      customerPhone={customerPhone}
                      baseAddress={basePriceList?.base_address}
                      baseLat={basePriceList?.base_lat}
                      baseLng={basePriceList?.base_lng}
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
                    />
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-700 text-sm">תוספות זמן</h3>
                      </div>
                      <div className="p-4">
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
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-700 text-sm">תוספות מיקום</h3>
                      </div>
                      <div className="p-4">
                        <LocationSurchargesSection
                          locationSurchargesData={locationSurchargesData}
                          selectedLocationSurcharges={selectedLocationSurcharges}
                          setSelectedLocationSurcharges={setSelectedLocationSurcharges}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Section 5 — מחיר */}
          {towType && (
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
                              {item.label}: ₪{Math.round(item.amount)}
                            </p>
                          ))}
                      </>
                    ) : (
                      <>
                        <p>בסיס + מרחק + תוספות</p>
                        <p>לפני מע״מ: ₪{Math.round(finalPrice / 1.18)}</p>
                        <p>מע״מ 18%: ₪{Math.round((finalPrice / 1.18) * 0.18)}</p>
                        <p className="font-bold">סה״כ: ₪{finalPrice}</p>
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

          {/* Section 6 — הצעת מחיר (GATE) */}
          {towType && (
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
                      {towType} • {(towType === 'exchange' ? (exchangeTotalDistance?.distanceKm ?? 0) : totalDistanceKm).toFixed(1)} ק״מ
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
                        onClick={() => setQuoteApproved(true)}
                        className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                      >
                        <Check size={20} />
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
                    onClick={() => setShowDriverPicker(true)}
                    className="px-4 py-2 bg-cyan-500 text-white rounded-xl text-sm"
                  >
                    פתח יומן לבחירת נהג ↗
                  </button>
                  {preSelectedDriverId && (() => {
                    const selectedDriver = drivers.find((d) => d.id === preSelectedDriverId)
                    return selectedDriver ? (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-800">
                          נהג מיועד: {selectedDriver.user?.full_name || 'נהג'}
                        </p>
                        <p className="text-xs text-blue-600">
                          {towDate} · {towTime}
                        </p>
                        <button
                          type="button"
                          onClick={() => setPreSelectedDriverId(null)}
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
              <section className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden mb-6">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-300">
                  <h2 className="font-bold text-gray-800 text-sm sm:text-base">
                    אנשי קשר
                  </h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  {towType === 'exchange' ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                      {/* 1 — איש קשר במוצא תקין */}
                      <div>
                        <div className="flex justify-between items-start mb-2 min-h-[32px]">
                          <label className="text-sm font-medium text-gray-700">איש קשר במוצא — רכב תקין</label>
                          <div className="flex gap-1.5 flex-wrap justify-end">
                            <button type="button" onClick={() => copyFromCustomer('working_source')} className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100">כמו לקוח 👤</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={workingVehicleContact} onChange={(e) => setWorkingVehicleContact(e.target.value)} placeholder="שם" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm" />
                          <input type="tel" value={workingVehicleContactPhone} onChange={(e) => setWorkingVehicleContactPhone(e.target.value)} placeholder="טלפון" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm" />
                        </div>
                      </div>

                      {/* 2 — איש קשר ביעד תקין */}
                      <div>
                        <div className="flex justify-between items-start mb-2 min-h-[32px]">
                          <label className="text-sm font-medium text-gray-700">איש קשר ביעד — רכב תקין</label>
                          <div className="flex gap-1.5 flex-wrap justify-end">
                            <button type="button" onClick={() => copyFromCustomer('working_destination')} className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100">כמו לקוח 👤</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={workingDestinationContact} onChange={(e) => setWorkingDestinationContact(e.target.value)} placeholder="שם" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm" />
                          <input type="tel" value={workingDestinationContactPhone} onChange={(e) => setWorkingDestinationContactPhone(e.target.value)} placeholder="טלפון" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm" />
                        </div>
                      </div>

                      {/* 3 — איש קשר במוצא תקול */}
                      <div>
                        <div className="flex justify-between items-start mb-2 min-h-[32px]">
                          <label className="text-sm font-medium text-gray-700">איש קשר במוצא — רכב תקול</label>
                          <button
                            type="button"
                            onClick={() => copyFromCustomer('exchange_pickup')}
                            className="text-xs px-2 py-1 rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700"
                          >
                            כמו לקוח 👤
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={exchangeContactName} onChange={(e) => setExchangeContactName(e.target.value)} placeholder="שם" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm" />
                          <input type="tel" value={exchangeContactPhone} onChange={(e) => setExchangeContactPhone(e.target.value)} placeholder="טלפון" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm" />
                        </div>
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

                      {/* 4 — איש קשר ביעד תקול */}
                      <div>
                        <div className="flex justify-between items-start mb-2 min-h-[32px]">
                          <label className="text-sm font-medium text-gray-700">איש קשר ביעד — רכב תקול</label>
                          <div className="flex gap-1.5 flex-wrap justify-end">
                            <button type="button" onClick={() => copyFromCustomer('defective_destination')} className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100">כמו לקוח 👤</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={defectiveDestinationContact} onChange={(e) => setDefectiveDestinationContact(e.target.value)} placeholder="שם" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm" />
                          <input type="tel" value={defectiveDestinationContactPhone} onChange={(e) => setDefectiveDestinationContactPhone(e.target.value)} placeholder="טלפון" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm" />
                        </div>
                      </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium">איש קשר במוצא</label>
                          <button
                            type="button"
                            onClick={() => copyFromCustomer('pickup')}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                          >
                            כמו לקוח 👤
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={pickupContactName}
                            onChange={(e) => setPickupContactName(e.target.value)}
                            placeholder="שם"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                          />
                          <input
                            type="tel"
                            value={pickupContactPhone}
                            onChange={(e) => setPickupContactPhone(e.target.value)}
                            placeholder="טלפון"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium">
                            איש קשר ביעד
                          </label>
                          <button
                            type="button"
                            onClick={() => copyFromCustomer('dropoff')}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                          >
                            כמו לקוח 👤
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={dropoffContactName}
                            onChange={(e) => setDropoffContactName(e.target.value)}
                            placeholder="שם"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                          />
                          <input
                            type="tel"
                            value={dropoffContactPhone}
                            onChange={(e) => setDropoffContactPhone(e.target.value)}
                            placeholder="טלפון"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                          />
                        </div>
                      </div>
                      </div>
                    </>
                  )}
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

            {/* Section 9 — תשלום ושמירה */}
            {towType && quoteApproved && (
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

        {/* Side panel */}
        {towType && (
          <aside className="hidden lg:block w-[200px] flex-shrink-0 sticky top-24 self-start">
            <div className="bg-white rounded-xl border border-gray-300 p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">מחיר</p>
              <p className="text-xl font-bold">₪{finalPrice}</p>
              <p className="text-sm text-gray-600 mt-2">{customerName}</p>
              <p className="text-xs text-gray-500">
                {towDate} {towTime}
              </p>
              <p className="text-xs text-gray-500 mt-1">{towType}</p>
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

      <PinDropModal
        isOpen={pinDropModal.isOpen}
        onClose={() => setPinDropModal({ isOpen: false, field: null })}
        onConfirm={handlePinDropConfirmWrapped}
        initialAddress={
          pinDropModal.field === 'pickup' ? pickupAddress
          : pinDropModal.field === 'dropoff' ? dropoffAddress
          : pinDropModal.field === 'exchange' ? exchangeAddress
          : pinDropModal.field === 'workingVehicle' ? workingVehicleAddress
          : pinDropModal.field === 'workingDestination' ? workingVehicleDestinationAddress
          : pinDropModal.field === 'defectiveDestination' ? defectiveDestinationAddress
          : undefined
        }
        title={
          pinDropModal.field === 'pickup'
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
              <button type="button" onClick={() => setShowWorkingStorageModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {customerStoredVehicles.filter(v => v.vehicle_condition === 'operational').map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setWorkingVehicleSource('storage')
                    setWorkingVehiclePlate(v.plate_number)
                    if (v.vehicle_data) {
                      setWorkingVehicleData({
                        found: true,
                        source: (v.vehicle_data.source as VehicleLookupResult['source']) || 'private',
                        sourceLabel: v.vehicle_data.sourceLabel || 'רכב פרטי',
                        data: {
                          plateNumber: v.plate_number,
                          manufacturer: v.vehicle_data.manufacturer || null,
                          model: v.vehicle_data.model || null,
                          year: v.vehicle_data.year ? parseInt(v.vehicle_data.year) : null,
                          color: v.vehicle_data.color || null,
                          fuelType: null,
                          totalWeight: v.vehicle_data.totalWeight ? parseInt(v.vehicle_data.totalWeight) : null,
                          vehicleType: null,
                          driveType: v.vehicle_data.driveType || null,
                          driveTechnology: null,
                          gearType: v.vehicle_data.gearType || null,
                          machineryType: null,
                          selfWeight: null,
                          totalWeightTon: null
                        }
                      })
                    }
                    if (storageAddress) setWorkingVehicleAddress({ address: storageAddress, lat: basePriceList?.base_lat, lng: basePriceList?.base_lng })
                    setShowWorkingStorageModal(false)
                  }}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:border-gray-300 text-sm font-medium text-right flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span>{v.plate_number}</span>
                    {v.vehicle_data?.model && <span className="text-gray-400 text-xs">— {v.vehicle_data.model}</span>}
                  </div>
                  <span className="text-xs text-gray-400">תקין</span>
                </button>
              ))}
            </div>
            <div className="px-4 pb-4">
              <button type="button" onClick={() => setShowWorkingStorageModal(false)} className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">ביטול</button>
            </div>
          </div>
        </div>
      )}

        {showDriverPicker && (
          <DriverCalendarPicker
            companyId={companyId || ''}
            drivers={drivers}
            requiredTruckTypes={requiredTruckTypes}
            initialDate={towDate as string}
            initialTime={towTime}
            onConfirm={(driverId, date, time) => {
              setPreSelectedDriverId(driverId)
              setTowDate(date)
              setTowTime(time)
              setShowDriverPicker(false)
            }}
            onClose={() => setShowDriverPicker(false)}
          />
        )}

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

// ==================== Page Export ====================

export default function CreateTowPage() {
  const searchParams = useSearchParams()
  const editTowId = searchParams.get('edit') || undefined
  const dateParam = searchParams.get('date')
  const timeParam = searchParams.get('time')
  const driverParam = searchParams.get('driver')

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
        dateParam={dateParam}
        timeParam={timeParam}
        driverParam={driverParam}
      />
    </Suspense>
  )
}
