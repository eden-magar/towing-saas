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
  X,
  MapPin,
  Plus,
  Minus,
  User,
  Calendar,
  Loader2,
} from 'lucide-react'
import { useTowForm } from '../../../hooks/useTowForm'
import { AddressInput } from '../../../components/tow-forms/routes/AddressInput'
import { PinDropModal, VehicleLookup, ServiceSurchargeSelector } from '../../../components/tow-forms/shared'
import { DriverSchedulePicker } from '../../../components/DriverSchedulePicker'
import { RouteBuilder } from '../../../components/tow-forms/routes/RouteBuilder'
import { lookupVehicle } from '../../../lib/vehicle-lookup'
import { createCustomer } from '../../../lib/queries/customers'
import { createTow, updateTowStatus } from '../../../lib/queries/tows'
import { addVehicleToStorage, releaseVehicleFromStorage } from '../../../lib/queries/storage'
import { prepareTowData } from '../../../lib/utils/tow-save-handler'
import type { AddressData } from '../../../lib/google-maps'
import type { SelectedService } from '../../../components/tow-forms/shared'
import type { RoutePoint } from '../../../components/tow-forms/routes/RouteBuilder'
import { getActiveTimeSurcharges } from '../../../lib/queries/price-lists'
import type { TimeSurcharge, LocationSurcharge, ServiceSurcharge } from '../../../lib/queries/price-lists'
import type { StoredVehicleWithCustomer } from '../../../lib/queries/storage'
import type { VehicleLookupResult } from '../../../lib/types'

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
    customerStoredVehicles,
    selectedStoredVehicleId,
    setSelectedStoredVehicleId,
    dropoffToStorage,
    setDropoffToStorage,
    workingVehicleSource,
    setWorkingVehicleSource,
    selectedWorkingVehicleId,
    workingVehiclePlate,
    setWorkingVehiclePlate,
    workingVehicleData,
    setWorkingVehicleData,
    workingVehicleType,
    setWorkingVehicleType,
    workingVehicleAddress,
    setWorkingVehicleAddress,
    exchangeAddress,
    setExchangeAddress,
    exchangeTotalDistance,
    exchangeContactName,
    setExchangeContactName,
    exchangeContactPhone,
    setExchangeContactPhone,
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
  const [pickerDate, setPickerDate] = useState<Date>(new Date())
  const [pickerTime, setPickerTime] = useState<string>('')
  const [pendingDriverId, setPendingDriverId] = useState<string | null>(null)
  const [calendarTows, setCalendarTows] = useState<TowWithDetails[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)


  const DRIVER_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4']

  // URL params
  useEffect(() => {
    if (dateParam) setTowDate(dateParam)
    if (timeParam) setTowTime(timeParam)
    if (driverParam) setPreSelectedDriverId(driverParam)
  }, [dateParam, timeParam, driverParam])

  // Sync pickerTime with towTime when modal opens
  useEffect(() => {
    if (showDriverPicker) {
      setPickerTime(towTime || '')
      setPickerDate(
        towDate
          ? new Date((towDate as string) + 'T12:00:00')
          : new Date()
      )
      setPendingDriverId(null)
    }
  }, [showDriverPicker, towDate, towTime])

  useEffect(() => {
    if (showDriverPicker) {
      loadCalendarTows(pickerDate)
    }
  }, [showDriverPicker, pickerDate])

  // Filter customers by search
  const filteredCustomers = customers.filter(
    (c) =>
      !customerSearch ||
      c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.includes(customerSearch) ||
      (c as { id_number?: string }).id_number?.includes(customerSearch)
  )

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
    if (pinDropModal.field === 'exchange') {
      setExchangeAddress(data)
    } else {
      handlePinDropConfirm(data)
    }
  }

  // Vehicle lookup for single
  const handleVehicleLookup = useCallback(async () => {
    if (vehiclePlate.replace(/[^0-9]/g, '').length < 5) return
    setDefectiveLookupLoading(true)
    try {
      const result = await lookupVehicle(vehiclePlate)
      if (result.found && result.data) {
        setVehicleData(result)
        setVehicleType(result.source || 'private')
      } else {
        setVehicleData(null)
        setVehicleType('')
      }
    } catch {
      setVehicleData(null)
    } finally {
      setDefectiveLookupLoading(false)
    }
  }, [vehiclePlate])

  // Vehicle lookup for defective (exchange)
  const handleDefectiveLookup = useCallback(async () => {
    if (defectiveVehiclePlate.replace(/[^0-9]/g, '').length < 5) return
    setDefectiveLookupLoading(true)
    try {
      const result = await lookupVehicle(defectiveVehiclePlate)
      if (result.found && result.data) {
        setDefectiveVehicleData(result)
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

  const loadCalendarTows = useCallback(async (date: Date) => {
    if (!companyId) return
    setCalendarLoading(true)
    try {
      const dateStr = date.toISOString().split('T')[0]
      const tows = await getDayTows(companyId, date)
      setCalendarTows(tows)
    } catch (e) {
      console.error(e)
    } finally {
      setCalendarLoading(false)
    }
  }, [companyId])

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
        defectiveDestinationAddress: towType === 'exchange' ? defectiveDestinationAddress : undefined,
        defectiveDestinationContactName: towType === 'exchange' ? defectiveDestinationContact : undefined,
        defectiveDestinationContactPhone: towType === 'exchange' ? defectiveDestinationContactPhone : undefined,
      })
      const result = await createTow(towData)
      await updateTowStatus(result.id, 'quote')
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
              }
            : undefined,
          towId: result.id,
          performedBy: user.id,
          notes: 'נכנס מגרירה',
          vehicleCondition: 'operational',
        })
      }
      setQuoteSavedId(result.id)
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

  const lockedOpacity = quoteApproved ? 1 : 0.35
  const lockedPointer = quoteApproved ? 'auto' : 'none'

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error}
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
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

      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 flex gap-6">
        <div className="flex-1 min-w-0">
          {/* Section 1 — לקוח */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">
                לקוח
              </h2>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setCustomerTab('existing')}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium ${
                    customerTab === 'existing'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  לקוח קיים
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerTab('casual')}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium ${
                    customerTab === 'casual'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  לקוח מזדמן
                </button>
              </div>

              {customerTab === 'existing' ? (
                <>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="חיפוש לפי שם, טלפון, ת.ז."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm mb-4"
                  />
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filteredCustomers.slice(0, 10).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          handleCustomerSelect(
                            c.id,
                            c.name || '',
                            c.phone || ''
                          )
                        }
                        className={`w-full p-3 rounded-xl border text-right ${
                          selectedCustomerId === c.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-gray-800">{c.name}</div>
                        <div className="text-sm text-gray-500">{c.phone}</div>
                        <div className="flex gap-1 mt-1">
                          {customersWithPricing.some(
                            (cp) => cp.customer_id === c.id
                          ) && (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                              מחירון אישי
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedCustomerId && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                      <p className="font-medium text-gray-800">{customerName}</p>
                      <p className="text-sm text-gray-500">{customerPhone}</p>
                    </div>
                  )}
                  {customerStoredVehicles.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-2">רכבים באחסנה</p>
                    <div className="flex flex-wrap gap-2">
                      {customerStoredVehicles.map((v) => (
                        <div
                          key={v.id}
                          className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 flex items-center gap-1"
                        >
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            v.vehicle_condition === 'operational' ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span>{v.plate_number} — {v.vehicle_data?.model || ''}</span>
                          <span className="text-xs text-gray-400 mr-1">
                            {v.vehicle_condition === 'operational' ? 'תקין' : 'תקול'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">בחירת רכב תתאפשר לאחר בחירת סוג גרירה</p>
                  </div>
                )}
                </>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="שם הלקוח *"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="טלפון"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Section 2 — תזמון */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">
                תזמון
              </h2>
            </div>
            <div className="p-4 sm:p-5 flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">תאריך</label>
                <input
                  type="date"
                  value={towDate}
                  onChange={(e) => setTowDate(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">שעה</label>
                <input
                  type="time"
                  value={towTime}
                  onChange={(e) => setTowTime(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleNowClick}
                className="px-4 py-2.5 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-xl text-sm font-medium hover:bg-cyan-100"
              >
                עכשיו
              </button>
            </div>
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-wrap gap-4">
              {editTowId && orderNumber && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">מספר הזמנה</label>
                  <div className="px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600 font-mono">
                    #{orderNumber}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">מספר הזמנה של הלקוח</label>
                <input
                  type="text"
                  value={customerOrderNumber}
                  onChange={(e) => setCustomerOrderNumber(e.target.value)}
                  placeholder="אופציונלי"
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                />
              </div>
            </div>
          </section>

          {/* Section 3 — סוג גרירה */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">
                סוג גרירה
              </h2>
            </div>
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => handleTowTypeSelect('single')}
                className={`p-4 rounded-xl border-2 text-right transition-all ${
                  towType === 'single'
                    ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-800">גרירה פשוטה</p>
                <p className="text-xs text-gray-500 mt-1">A→B, כולל מ/לאחסנה</p>
              </button>
              <button
                type="button"
                onClick={() => handleTowTypeSelect('exchange')}
                className={`p-4 rounded-xl border-2 text-right transition-all ${
                  towType === 'exchange'
                    ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-800">תקין ↔ תקול</p>
                <p className="text-xs text-gray-500 mt-1">3 שלבים</p>
              </button>
              <button
                type="button"
                onClick={() => handleTowTypeSelect('custom')}
                className={`p-4 rounded-xl border-2 text-right transition-all ${
                  towType === 'custom'
                    ? 'ring-2 ring-purple-500 border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-800">מסלול מותאם</p>
                <p className="text-xs text-gray-500 mt-1">נקודות חופשיות</p>
              </button>
            </div>
          </section>

          {/* Section 4 — רכב ומסלול */}
          {towType && (
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
              <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="font-bold text-gray-800 text-sm sm:text-base">
                  רכב ומסלול
                </h2>
              </div>
              <div className="p-4 sm:p-5 space-y-6">
                {towType === 'single' && (
                  <>
                    <div ref={truckTypeSectionRef}>
                      {vehicleData === null ? (
                        <p className="text-sm text-gray-400">
                          סוג הגרר יופיע לאחר בדיקת רישוי
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            סוג גרר נדרש
                          </p>
                          <div className="flex gap-2">
                            {TRUCK_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  const current = requiredTruckTypes.filter(t => t !== opt.value)
                                  if (requiredTruckTypes.includes(opt.value)) {
                                    setRequiredTruckTypes(current)
                                  } else {
                                    setRequiredTruckTypes([...current, opt.value])
                                  }
                                }}
                                className={`px-4 py-2 rounded-xl text-sm ${
                                  requiredTruckTypes.includes(opt.value)
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        מספר רכב
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={vehiclePlate}
                          onChange={(e) => setVehiclePlate(e.target.value)}
                          onBlur={async (e) => {
                            const val = e.target.value.trim()
                            if (val && val.replace(/[^0-9]/g, '').length >= 5) {
                              handleVehicleLookup()
                            }
                          }}
                          placeholder="1234567"
                          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono tracking-widest"
                        />
                        <button
                          type="button"
                          onClick={handleVehicleLookup}
                          disabled={
                            vehiclePlate.replace(/[^0-9]/g, '').length < 5 ||
                            defectiveLookupLoading
                          }
                          className="px-4 py-2.5 bg-cyan-500 text-white rounded-xl text-sm"
                        >
                          {defectiveLookupLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            'בדיקת רישוי'
                          )}
                        </button>
                      </div>
                    </div>
                    {vehicleData?.found && vehicleData.data && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">יצרן:</span>{' '}
                          {vehicleData.data.manufacturer}
                        </div>
                        <div>
                          <span className="text-gray-500">דגם:</span>{' '}
                          {vehicleData.data.model}
                        </div>
                        <div>
                          <span className="text-gray-500">שנה:</span>{' '}
                          {vehicleData.data.year}
                        </div>
                        <div>
                          <span className="text-gray-500">צבע:</span>{' '}
                          {vehicleData.data.color}
                        </div>
                        <div>
                          <span className="text-gray-500">סוג רכב:</span>{' '}
                          {vehicleData.data.vehicleType || '-'}
                        </div>
                        <div>
                          <span className="text-gray-500">הנעה:</span>{' '}
                          {vehicleData.data.driveType || '-'}
                        </div>
                        <div>
                          <span className="text-gray-500">גיר:</span>{' '}
                          {vehicleData.data.gearType || '-'}
                        </div>
                        <div>
                          <span className="text-gray-500">משקל:</span>{' '}
                          {vehicleData.data.totalWeight
                            ? `${vehicleData.data.totalWeight} ק״ג`
                            : '-'}
                        </div>
                      </div>
                    )}
                    {vehicleData?.data?.driveType?.includes?.('קדמית') && (
                      <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded-lg">
                        מומלץ: רמסע (רכב עם הנעה קדמית)
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (startFromBase) {
                            setStartFromBase(false)
                            setPickupAddress({ address: '' })
                            return
                          }
                          if (!selectedCustomerId) {
                            alert('יש לבחור לקוח תחילה')
                            return
                          }
                          if (customerStoredVehicles.length === 0) {
                            alert('ללקוח זה אין רכבים באחסנה')
                            return
                          }
                          setStartFromBase(true)
                          if (storageAddress)
                            setPickupAddress({
                              address: storageAddress,
                              lat: basePriceList?.base_lat,
                              lng: basePriceList?.base_lng,
                            })
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                          startFromBase
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        איסוף מאחסנה
                      </button>
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
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                          dropoffToStorage
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        הורדה לאחסנה
                      </button>
                    </div>
                    {startFromBase && customerStoredVehicles.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <p className="text-xs text-gray-500 mb-2">בחר רכב מהאחסנה:</p>
                        <div className="flex flex-wrap gap-2">
                          {customerStoredVehicles.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() =>
                                selectedStoredVehicleId === v.id
                                  ? handleClearStoredVehicle()
                                  : handleSelectStoredVehicle(v)
                              }
                              className={`px-3 py-1.5 rounded-lg text-sm border ${
                                selectedStoredVehicleId === v.id
                                  ? 'border-blue-500 bg-blue-100 text-blue-700'
                                  : 'border-gray-200 bg-white'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full inline-block ml-1 ${
                                v.vehicle_condition === 'operational' ? 'bg-green-500' : 'bg-red-500'
                              }`} />
                              {v.plate_number} — {v.vehicle_data?.model || ''}
                              <span className="mr-1 text-xs text-gray-400">
                                {v.vehicle_condition === 'operational' ? 'תקין' : 'תקול'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <AddressInput
                      value={pickupAddress}
                      onChange={(d: AddressData) => setPickupAddress(d)}
                      label="כתובת איסוף"
                      onPinDropClick={() => handlePinDropOpen('pickup')}
                    />
                    <AddressInput
                      value={dropoffAddress}
                      onChange={(d: AddressData) => setDropoffAddress(d)}
                      label="כתובת הורדה"
                      onPinDropClick={() => handlePinDropOpen('dropoff')}
                    />
                    {distanceLoading ? (
                      <p className="text-sm text-gray-500">מחשב מרחק...</p>
                    ) : (
                      <p className="text-sm font-medium">
                        מרחק כולל: {totalDistanceKm.toFixed(1)} ק״מ
                      </p>
                    )}
                    <TimeSurchargesSection
                      timeSurchargesData={timeSurchargesData}
                      towDate={towDate}
                      towTime={towTime}
                      isHoliday={isHoliday}
                      setIsHoliday={setIsHoliday}
                      activeTimeSurchargesList={activeTimeSurchargesList}
                      setActiveTimeSurchargesList={setActiveTimeSurchargesList}
                    />
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
                  </>
                )}

                {towType === 'exchange' && (
                  <>
                    {/* א — הרכב התקין */}
                    <div>
                      <p className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                        <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">א</span>
                        הרכב התקין — מאיפה אוספים?
                      </p>
                      <div className="flex gap-2 mb-3">
                        <button type="button"
                          onClick={() => setWorkingVehicleSource('storage')}
                          className={`px-3 py-1.5 rounded-lg text-sm ${workingVehicleSource === 'storage' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                          מהאחסנה
                        </button>
                        <button type="button"
                          onClick={() => setWorkingVehicleSource('address')}
                          className={`px-3 py-1.5 rounded-lg text-sm ${workingVehicleSource === 'address' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                          מכתובת
                        </button>
                      </div>

                      {workingVehicleSource === 'storage' && (
                        <>
                          {!selectedCustomerId && (
                            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-2">יש לבחור לקוח תחילה</p>
                          )}
                          {selectedCustomerId && customerStoredVehicles.filter(v => v.vehicle_condition === 'operational').length === 0 && (
                            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2">ללקוח זה אין רכבים תקינים באחסנה</p>
                          )}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {customerStoredVehicles.filter(v => v.vehicle_condition === 'operational').map((v) => (
                              <button key={v.id} type="button"
                                onClick={() => selectedWorkingVehicleId === v.id ? handleClearWorkingVehicle() : handleSelectWorkingVehicle(v)}
                                className={`px-3 py-1.5 rounded-lg text-sm border ${selectedWorkingVehicleId === v.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'}`}>
                                <span className="w-2 h-2 rounded-full inline-block ml-1 bg-green-500" />
                                {v.plate_number} — {v.vehicle_data?.model || ''}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {workingVehicleSource === 'address' && (
                        <div className="mb-3">
                          <AddressInput
                            value={workingVehicleAddress}
                            onChange={(d: AddressData) => setWorkingVehicleAddress(d)}
                            label="כתובת מוצא התקין"
                            onPinDropClick={() => handlePinDropOpen('workingVehicle')}
                          />
                          <div className="flex gap-2 mt-2">
                            <input type="text"
                              value={workingVehiclePlate}
                              onChange={(e) => setWorkingVehiclePlate(e.target.value)}
                              onBlur={() => { if (workingVehiclePlate.replace(/[^0-9]/g, '').length >= 5) handleWorkingLookup() }}
                              placeholder="מספר רכב תקין"
                              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono" />
                            <button type="button" onClick={handleWorkingLookup}
                              disabled={workingVehiclePlate.replace(/[^0-9]/g, '').length < 5 || workingLookupLoading}
                              className="px-4 py-2 bg-cyan-500 text-white rounded-xl text-sm disabled:opacity-50">
                              בדיקה
                            </button>
                          </div>
                          {workingVehicleData?.found && (
                            <div className="grid grid-cols-4 gap-2 p-3 bg-gray-50 rounded-xl mt-2 text-xs">
                              <div><span className="text-gray-400 block">יצרן</span><span className="font-medium">{workingVehicleData.data?.manufacturer}</span></div>
                              <div><span className="text-gray-400 block">דגם</span><span className="font-medium">{workingVehicleData.data?.model}</span></div>
                              <div><span className="text-gray-400 block">שנה</span><span className="font-medium">{workingVehicleData.data?.year}</span></div>
                              <div><span className="text-gray-400 block">צבע</span><span className="font-medium">{workingVehicleData.data?.color}</span></div>
                              <div><span className="text-gray-400 block">סוג</span><span className="font-medium">{workingVehicleData.data?.vehicleType}</span></div>
                              <div><span className="text-gray-400 block">הנעה</span><span className="font-medium">{workingVehicleData.data?.driveType}</span></div>
                              <div><span className="text-gray-400 block">גיר</span><span className="font-medium">{workingVehicleData.data?.gearType}</span></div>
                              <div><span className="text-gray-400 block">משקל</span><span className="font-medium">{workingVehicleData.data?.totalWeight} ק"ג</span></div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* סוג גרר לתקין — אחרי בדיקת רישוי */}
                      {(workingVehicleData?.found || workingVehicleSource === 'storage') && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">סוג גרר לרכב התקין</p>
                          <div className="flex gap-2">
                            {TRUCK_OPTIONS.map((opt) => (
                              <button key={opt.value} type="button"
                                onClick={() => {
                                  const current = requiredTruckTypes.filter(t => t !== opt.value)
                                  if (requiredTruckTypes.includes(opt.value)) {
                                    setRequiredTruckTypes(current)
                                  } else {
                                    setRequiredTruckTypes([...current, opt.value])
                                  }
                                }}
                                className={`px-4 py-2 rounded-xl text-sm ${requiredTruckTypes.includes(opt.value) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* יעד התקין */}
                      <div className="mb-3">
                        <AddressInput
                          value={workingVehicleDestinationAddress}
                          onChange={(d: AddressData) => setWorkingVehicleDestinationAddress(d)}
                          label="יעד התקין (נקודת ההחלפה)"
                          onPinDropClick={() => handlePinDropOpen('workingDestination')}
                        />
                      </div>

                      {/* איש קשר במוצא */}
                      <div className="grid grid-cols-2 gap-2 mb-1">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">איש קשר במוצא</label>
                          <input type="text" value={workingVehicleContact}
                            onChange={(e) => setWorkingVehicleContact(e.target.value)}
                            placeholder="שם..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">טלפון</label>
                          <input type="text" value={workingVehicleContactPhone}
                            onChange={(e) => setWorkingVehicleContactPhone(e.target.value)}
                            placeholder="05X-..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
                        </div>
                      </div>
                    </div>

                    {/* ב — הרכב התקול */}
                    <div>
                      <p className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                        <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">ב</span>
                        הרכב התקול
                      </p>

                      <div className="flex gap-2 mb-2">
                        <input type="text"
                          value={defectiveVehiclePlate}
                          onChange={(e) => setDefectiveVehiclePlate(e.target.value)}
                          onBlur={async (e) => {
                            const val = e.target.value.trim()
                            if (val && val.replace(/[^0-9]/g, '').length >= 5) handleDefectiveLookup()
                          }}
                          placeholder="מספר רכב תקול"
                          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono" />
                        <button type="button" onClick={handleDefectiveLookup}
                          disabled={defectiveVehiclePlate.replace(/[^0-9]/g, '').length < 5 || defectiveLookupLoading}
                          className="px-4 py-2 bg-cyan-500 text-white rounded-xl text-sm disabled:opacity-50">
                          בדיקה
                        </button>
                      </div>

                      {defectiveVehicleData?.found && (
                        <div className="grid grid-cols-4 gap-2 p-3 bg-gray-50 rounded-xl mb-3 text-xs">
                          <div><span className="text-gray-400 block">יצרן</span><span className="font-medium">{defectiveVehicleData.data?.manufacturer}</span></div>
                          <div><span className="text-gray-400 block">דגם</span><span className="font-medium">{defectiveVehicleData.data?.model}</span></div>
                          <div><span className="text-gray-400 block">שנה</span><span className="font-medium">{defectiveVehicleData.data?.year}</span></div>
                          <div><span className="text-gray-400 block">צבע</span><span className="font-medium">{defectiveVehicleData.data?.color}</span></div>
                          <div><span className="text-gray-400 block">סוג</span><span className="font-medium">{defectiveVehicleData.data?.vehicleType}</span></div>
                          <div><span className="text-gray-400 block">הנעה</span><span className="font-medium">{defectiveVehicleData.data?.driveType}</span></div>
                          <div><span className="text-gray-400 block">גיר</span><span className="font-medium">{defectiveVehicleData.data?.gearType}</span></div>
                          <div><span className="text-gray-400 block">משקל</span><span className="font-medium">{defectiveVehicleData.data?.totalWeight} ק"ג</span></div>
                        </div>
                      )}

                      {/* מיקום התקול */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-500">מיקום הרכב התקול</label>
                          {workingVehicleDestinationAddress.address && (
                            <button type="button"
                              onClick={() => setExchangeAddress(workingVehicleDestinationAddress)}
                              className="text-xs text-blue-500 hover:text-blue-700">
                              זהה ליעד התקין
                            </button>
                          )}
                        </div>
                        <AddressInput
                          value={exchangeAddress}
                          onChange={(d: AddressData) => setExchangeAddress(d)}
                          label=""
                          onPinDropClick={() => handlePinDropOpen('exchange')}
                        />
                      </div>

                      {/* איש קשר בנקודת החלפה */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">איש קשר בנקודת החלפה</label>
                          <input type="text" value={exchangeContactName}
                            onChange={(e) => setExchangeContactName(e.target.value)}
                            placeholder="שם..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">טלפון</label>
                          <input type="text" value={exchangeContactPhone}
                            onChange={(e) => setExchangeContactPhone(e.target.value)}
                            placeholder="05X-..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
                        </div>
                      </div>

                      {/* לאן הולך התקול */}
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">לאן הולך הרכב התקול?</p>
                        <div className="flex gap-2 mb-2">
                          <button type="button"
                            onClick={() => {
                              setDefectiveDestination('storage')
                              if (storageAddress) setDefectiveDestinationAddress({ address: storageAddress, lat: basePriceList?.base_lat, lng: basePriceList?.base_lng })
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm ${defectiveDestination === 'storage' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                            לאחסנה
                          </button>
                          <button type="button"
                            onClick={() => setDefectiveDestination('address')}
                            className={`px-3 py-1.5 rounded-lg text-sm ${defectiveDestination === 'address' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                            לכתובת
                          </button>
                        </div>
                        {defectiveDestination === 'address' && (
                          <AddressInput
                            value={defectiveDestinationAddress}
                            onChange={(d: AddressData) => setDefectiveDestinationAddress(d)}
                            label="כתובת יעד"
                            onPinDropClick={() => handlePinDropOpen('defectiveDestination')}
                          />
                        )}
                      </div>

                      {/* סוג גרר לתקול */}
                      {defectiveVehicleData?.found && (
                        <div className="mb-3" ref={truckTypeSectionRef}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-700">סוג גרר לרכב התקול</p>
                            {requiredTruckTypes.length > 0 && (
                              <button type="button"
                                onClick={() => setRequiredTruckTypes([...new Set([...requiredTruckTypes, requiredTruckTypes[0]])])}
                                className="text-xs text-blue-500">
                                זהה לתקין
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {TRUCK_OPTIONS.map((opt) => (
                              <button key={opt.value} type="button"
                                onClick={() => {
                                  const current = requiredTruckTypes.filter(t => t !== opt.value)
                                  if (requiredTruckTypes.includes(opt.value)) {
                                    setRequiredTruckTypes(current)
                                  } else {
                                    setRequiredTruckTypes([...current, opt.value])
                                  }
                                }}
                                className={`px-4 py-2 rounded-xl text-sm ${requiredTruckTypes.includes(opt.value) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* איש קשר ביעד התקול */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">איש קשר ביעד התקול</label>
                          <input type="text" value={defectiveDestinationContact}
                            onChange={(e) => setDefectiveDestinationContact(e.target.value)}
                            placeholder="שם..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">טלפון</label>
                          <input type="text" value={defectiveDestinationContactPhone}
                            onChange={(e) => setDefectiveDestinationContactPhone(e.target.value)}
                            placeholder="05X-..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
                        </div>
                      </div>

                      {/* נהג נוסף — אופציונלי */}
                      <div className="border border-dashed border-gray-200 rounded-xl p-3">
                        <p className="text-sm text-gray-500 mb-2">נהג נוסף לרכב התקול (אופציונלי)</p>
                        <p className="text-xs text-gray-400">ניתן לשבץ נהג נוסף לאחר שמירת הגרירה</p>
                      </div>
                    </div>

                    <TimeSurchargesSection
                      timeSurchargesData={timeSurchargesData}
                      towDate={towDate}
                      towTime={towTime}
                      isHoliday={isHoliday}
                      setIsHoliday={setIsHoliday}
                      activeTimeSurchargesList={activeTimeSurchargesList}
                      setActiveTimeSurchargesList={setActiveTimeSurchargesList}
                    />
                    <LocationSurchargesSection
                      locationSurchargesData={locationSurchargesData}
                      selectedLocationSurcharges={selectedLocationSurcharges}
                      setSelectedLocationSurcharges={setSelectedLocationSurcharges}
                    />
                    <ServiceSurchargeSelector
                      services={serviceSurchargesData}
                      selectedServices={selectedServices}
                      onChange={setSelectedServices}
                    />
                  </>
                )}

                {towType === 'custom' && (
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
                )}
              </div>
            </section>
          )}

          {/* Section 5 — מחיר */}
          {towType && (
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
              <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
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
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
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
                      className="px-4 py-2.5 border border-gray-200 rounded-xl w-32"
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
                  priceMode === 'recommended_customer') && (
                  <div className="text-sm space-y-1">
                    <p>בסיס + מרחק + תוספות</p>
                    <p>לפני מע״מ: ₪{Math.round(finalPrice / 1.18)}</p>
                    <p>מע״מ 18%: ₪{Math.round((finalPrice / 1.18) * 0.18)}</p>
                    <p className="font-bold">סה״כ: ₪{finalPrice}</p>
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
                      {towType} • {totalDistanceKm.toFixed(1)} ק״מ
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
              <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
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
              <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 text-sm sm:text-base">
                    אנשי קשר
                  </h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium">איש קשר במוצא</label>
                      <button
                        type="button"
                        onClick={() => copyFromCustomer('pickup')}
                        className="text-xs text-cyan-600"
                      >
                        כמו לקוח 👤
                      </button>
                    </div>
                    <input
                      type="text"
                      value={pickupContactName}
                      onChange={(e) => setPickupContactName(e.target.value)}
                      placeholder="שם"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm mb-2"
                    />
                    <input
                      type="tel"
                      value={pickupContactPhone}
                      onChange={(e) => setPickupContactPhone(e.target.value)}
                      placeholder="טלפון"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium">
                        איש קשר ביעד
                      </label>
                      <button
                        type="button"
                        onClick={() => copyFromCustomer('dropoff')}
                        className="text-xs text-cyan-600"
                      >
                        כמו לקוח 👤
                      </button>
                    </div>
                    <input
                      type="text"
                      value={dropoffContactName}
                      onChange={(e) => setDropoffContactName(e.target.value)}
                      placeholder="שם"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm mb-2"
                    />
                    <input
                      type="tel"
                      value={dropoffContactPhone}
                      onChange={(e) => setDropoffContactPhone(e.target.value)}
                      placeholder="טלפון"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                    />
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="הערות"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
              </section>
            )}

            {/* Section 9 — תשלום ושמירה */}
            {towType && quoteApproved && (
              <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
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
                          : 'bg-gray-100'
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
                          : 'bg-gray-100'
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
                          : 'bg-gray-100'
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
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setInvoiceName(customerName)}
                        className="px-3 py-2 bg-cyan-50 text-cyan-700 rounded-xl text-sm"
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
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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
          pinDropModal.field === 'pickup'
            ? pickupAddress
            : pinDropModal.field === 'dropoff'
              ? dropoffAddress
              : pinDropModal.field === 'exchange'
                ? exchangeAddress
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

        {showDriverPicker && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">

      {/* כותרת + ניווט תאריך */}
      <div className="flex items-center justify-between p-4 border-b">
        <button
          type="button"
          onClick={() => {
            const d = new Date(pickerDate)
            d.setDate(d.getDate() - 1)
            setPickerDate(d)
          }}
          className="p-2 hover:bg-gray-100 rounded-lg text-lg"
        >→</button>
        <span className="font-medium text-sm">
          {pickerDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={() => {
            const d = new Date(pickerDate)
            d.setDate(d.getDate() + 1)
            setPickerDate(d)
          }}
          className="p-2 hover:bg-gray-100 rounded-lg text-lg"
        >←</button>
      </div>

      {/* גריד */}
      <div className="overflow-auto flex-1 p-2">
        {calendarLoading ? (
          <div className="text-center text-gray-400 py-8">טוען...</div>
        ) : (
          <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="sticky top-0 bg-gray-50 z-10">
              <th className="text-right px-1.5 py-1.5 text-gray-400 font-medium border-b border-gray-100 w-8"></th>
              {drivers.map((d, i) => {
                const color = DRIVER_COLORS[i % DRIVER_COLORS.length]
                return (
                  <th key={d.id} className="text-center px-1 py-1.5 font-medium border-b border-gray-100 border-l border-l-gray-100 text-xs" style={{ color }}>
                    {d.user?.full_name?.split(' ')[0] || 'נהג'}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 24 }, (_, i) => i).map(hour => (
              <tr key={hour} className="border-b border-gray-200">
                <td className="px-1 py-1 text-gray-500 border-l border-gray-200 text-xs font-medium">{hour}:00</td>
                {drivers.map((driver, driverIdx) => {
                  const color = DRIVER_COLORS[driverIdx % DRIVER_COLORS.length]
                  const cellTows = calendarTows.filter(t =>
                    t.driver_id === driver.id &&
                    new Date(t.scheduled_at ?? '').getHours() === hour
                  )
                  const isRelevant = requiredTruckTypes.length === 0 ||
                    (driver as unknown as { trucks?: { truck_type: string }[] }).trucks?.some(
                      (t: { truck_type: string }) => requiredTruckTypes.includes(t.truck_type)
                    )
                  const isSelected = pendingDriverId === driver.id &&
                    pickerTime === `${hour.toString().padStart(2, '0')}:00`
                  return (
                    <td
                      key={driver.id}
                      className={`px-0.5 py-0.5 border-l border-gray-200 min-h-6 cursor-pointer transition-colors
                        ${!isRelevant ? 'bg-gray-50' : ''}
                        ${isSelected ? 'ring-2 ring-inset ring-blue-400 bg-blue-50' : ''}
                      `}
                      onClick={() => {
                        setPendingDriverId(driver.id)
                        setPickerTime(`${hour.toString().padStart(2, '0')}:00`)
                      }}
                    >
                      {cellTows.map(t => (
                        <div
                          key={t.id}
                          className="rounded px-1 py-0.5 mb-0.5 truncate text-xs font-medium"
                          style={{
                            background: color + '25',
                            color: color,
                            border: `1px solid ${color}40`,
                          }}
                        >
                          {t.order_number?.slice(-4) || t.id.slice(0, 4)}
                        </div>
                      ))}
                      {cellTows.length === 0 && (
                        <button
                          type="button"
                          className="w-full h-5 border border-dashed border-gray-100 rounded text-gray-200 opacity-0 hover:opacity-100 hover:border-gray-300 hover:text-gray-300 flex items-center justify-center text-xs transition-opacity"
                        >
                          +
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {/* שעה + אישור */}
      <div className="p-4 border-t flex items-center gap-4 justify-between flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">שעת תחילת גרירה</label>
          <input
            type="time"
            value={pickerTime}
            onChange={e => setPickerTime(e.target.value)}
            className="border rounded-lg px-2 py-1 text-sm"
          />
        </div>
        {pendingDriverId && (
          <div className="text-sm text-blue-700 font-medium">
            {drivers.find(d => d.id === pendingDriverId)?.user?.full_name || 'נהג נבחר'}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowDriverPicker(false)}
            className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            ביטול
          </button>
          <button
            type="button"
            disabled={!pendingDriverId || !pickerTime}
            onClick={() => {
              if (!pendingDriverId || !pickerTime) return
              setPreSelectedDriverId(pendingDriverId)
              const dateStr =
                pickerDate.getFullYear() + '-' +
                (pickerDate.getMonth() + 1).toString().padStart(2, '0') + '-' +
                pickerDate.getDate().toString().padStart(2, '0')
              setTowDate(dateStr)
              setTowTime(pickerTime)
              setShowDriverPicker(false)
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm disabled:opacity-40"
          >
            אשר שיבוץ
          </button>
        </div>
      </div>

    </div>
  </div>
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
            <div className="flex gap-3 p-5 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => router.push('/dashboard/tows')}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 font-medium"
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
}: {
  timeSurchargesData: TimeSurcharge[]
  towDate: string
  towTime: string
  isHoliday: boolean
  setIsHoliday: (v: boolean) => void
  activeTimeSurchargesList: TimeSurcharge[]
  setActiveTimeSurchargesList: (v: TimeSurcharge[]) => void
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
