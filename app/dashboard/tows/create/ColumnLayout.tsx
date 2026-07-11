'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  LayoutList,
  Truck,
  ArrowLeftRight,
  Route,
  Calendar,
  Package,
  Loader2,
  MapPin,
  Home,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Navigation,
  User,
  AlertTriangle,
  Check,
} from 'lucide-react'
import { useTowForm } from '../../../hooks/useTowForm'
import { useQuoteGate } from '../../../hooks/useQuoteGate'
import { useContactsSave } from '../../../hooks/useContactsSave'
import { useCustomerOrderers } from '../../../hooks/useCustomerOrderers'
import { shouldOfferSaveCustomerOrderer } from '../../../lib/utils/customer-orderer-save-ui'
import { DriverCalendarPicker } from '../../../components/DriverCalendarPicker'
import { PhoneInput } from '../../../components/ui/PhoneInput'
import { ContactNameAutocomplete } from '../../../components/customer-contacts/ContactNameAutocomplete'
import { SaveCustomerContactPill } from '../../../components/customer-contacts/SaveCustomerContactPill'
import {
  CreateCustomerSection,
  type CreateCustomerTab,
} from '../../../components/tow-forms/sections/CreateCustomerSection'
import { SectionPricing } from '../../../components/tow-wizard/sections/SectionPricing'
import { SectionQuoteGate } from '../../../components/tow-wizard/sections/SectionQuoteGate'
import {
  PinDropModal,
  VehicleLookup,
  DefectSelector,
  ServiceSurchargeSelector,
  TowTruckTypeSelector,
  LocationSurchargeSelector,
} from '../../../components/tow-forms/shared'
import { isPickableStoredVehicle } from '../../../lib/queries/storage'
import { TimeInStoragePill } from '../../../components/storage/TimeInStoragePill'
import {
  AddressInput,
  type AddressData,
} from '../../../components/tow-forms/routes/AddressInput'
import { mergePriceLists, resolveDeadheadRate } from '../../../lib/utils/price-calculator'
import { getTruckTypeLabel } from '../../../lib/utils/truck-type-labels'

type Form = ReturnType<typeof useTowForm>

const contactInputClass =
  'w-full px-3 h-9 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gt-brand/15 focus:border-gt-brand bg-white'

type TowEntryKind = 'single' | 'exchange' | 'custom' | 'events'

const towEntryOptions: Array<{
  value: TowEntryKind
  label: string
  sub: string
  icon: typeof Truck
}> = [
  { value: 'single', label: 'גרירה פשוטה', sub: 'A→B', icon: Truck },
  { value: 'exchange', label: 'תקין ↔ תקול', sub: '3 שלבים', icon: ArrowLeftRight },
  { value: 'custom', label: 'מסלול מותאם', sub: 'נקודות חופשיות', icon: Route },
  { value: 'events', label: 'אירועים מיוחדים', sub: 'פינוי רכבים מאירוע', icon: Calendar },
]

/**
 * Alternative 4-column desktop layout for fresh single-tow creation.
 * Additive/opt-in — consumes the same useTowForm instance as the linear form
 * so switching between layouts preserves all entered data.
 */
export function ColumnLayout({
  form,
  onExitColumnLayout,
  persistContactsRef,
}: {
  form: Form
  onExitColumnLayout: () => void
  /** Wired to create/page.tsx beforeSaveTow so contact-save pills persist on save. */
  persistContactsRef?: React.MutableRefObject<() => Promise<void>>
}) {
  const router = useRouter()
  const [customerTab, setCustomerTab] = useState<CreateCustomerTab>('existing')
  const [customerSearch, setCustomerSearch] = useState('')
  const [saveOrdererToCustomer, setSaveOrdererToCustomer] = useState(false)
  const [entryKind, setEntryKind] = useState<TowEntryKind | null>(
    form.towType || null,
  )
  const [showDriverPicker, setShowDriverPicker] = useState(false)
  const [pendingPickerDriverId, setPendingPickerDriverId] = useState<string | null>(null)
  const [pendingPickerDate, setPendingPickerDate] = useState<string | null>(null)
  const [pendingPickerTime, setPendingPickerTime] = useState<string | null>(null)
  const [pendingPickerTruckId, setPendingPickerTruckId] = useState<string | null>(null)

  const contactsSave = useContactsSave(form)
  const quoteGate = useQuoteGate(form, {
    persistTowCustomerContacts: contactsSave.persistTowCustomerContacts,
  })

  useEffect(() => {
    if (persistContactsRef) {
      persistContactsRef.current = contactsSave.persistTowCustomerContacts
    }
  }, [persistContactsRef, contactsSave.persistTowCustomerContacts])

  const handleTowTypeSelect = (kind: TowEntryKind) => {
    setEntryKind(kind)
    if (kind === 'events') {
      form.selectTowType('')
    } else {
      form.selectTowType(kind)
    }
  }

  const handlePinDropConfirm = (data: AddressData) => {
    const field = form.pinDropModal.field
    if (field === 'pickup') {
      form.setPickupAddress(data)
    } else if (field === 'dropoff') {
      form.setDropoffAddress(data)
    } else {
      form.handlePinDropConfirm(data)
    }
  }

  const handleNowClick = () => {
    const now = new Date()
    form.setTowDate(now.toISOString().split('T')[0])
    form.setTowTime(now.toTimeString().slice(0, 5))
    form.setIsToday(true)
  }

  const isBusinessCustomer =
    customerTab === 'existing' &&
    !!form.selectedCustomerId &&
    form.customers.find((c) => c.id === form.selectedCustomerId)?.customer_type ===
      'business'

  const { savedOrderers, orderersLoading } = useCustomerOrderers(
    form.companyId,
    isBusinessCustomer ? form.selectedCustomerId : null,
  )

  const showSaveOrdererOption = shouldOfferSaveCustomerOrderer(
    isBusinessCustomer,
    form.selectedCustomerId,
    form.department,
    form.orderedBy,
    savedOrderers,
  )

  useEffect(() => {
    setSaveOrdererToCustomer(false)
  }, [form.selectedCustomerId])

  useEffect(() => {
    if (!showSaveOrdererOption) {
      setSaveOrdererToCustomer(false)
    }
  }, [showSaveOrdererOption])

  useEffect(() => {
    if (
      form.towType === 'single' ||
      form.towType === 'exchange' ||
      form.towType === 'custom'
    ) {
      setEntryKind(form.towType)
    }
  }, [form.towType])

  // Deadhead (נסיעת סרק) rate hint from the active/merged price list.
  const activeDeadheadRate = resolveDeadheadRate(
    mergePriceLists(
      form.basePriceList,
      form.selectedCustomerPricing?.price_list ?? null,
    ),
  )
  const storageAddress = form.basePriceList?.base_address || ''
  const totalDistance =
    form.startFromBase && form.baseToPickupDistance && form.distance
      ? {
          distanceKm:
            form.distance.distanceKm + form.baseToPickupDistance.distanceKm,
          durationMinutes:
            form.distance.durationMinutes +
            form.baseToPickupDistance.durationMinutes,
        }
      : form.distance

  const getDriverTrucks = (driverId: string) =>
    form.trucks.filter((t) =>
      (t.assigned_drivers ?? []).some((d) => d.id === driverId),
    )

  const closeDriverPicker = () => {
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

  return (
    <div
      className="min-h-full bg-gt-canvas -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8"
      dir="rtl"
    >
      {form.error && (
        <div className="fixed top-4 left-4 right-4 z-50 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {form.error}
        </div>
      )}

      <header className="bg-white border-b border-gray-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => form.router.push('/dashboard/tows')}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                aria-label="חזרה לרשימת הגרירות"
              >
                <ArrowRight size={20} />
              </button>
              <div>
                <h1 className="font-bold text-gray-800 text-base sm:text-lg">
                  גרירה חדשה
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">
                  טופס רוחבי — מילוי פרטי הגרירה
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onExitColumnLayout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors"
            >
              <LayoutList className="w-3.5 h-3.5" />
              טופס רגיל
            </button>
          </div>
        </div>
      </header>

      <div className="py-4 sm:py-6">
        <div className="grid grid-cols-1 gap-4 items-start lg:grid-cols-12">
          {/* Column 1 — פרטי לקוח ומחיר (customer stacked above price + quote gate) */}
          <div className="lg:col-span-3 space-y-3">
            <CreateCustomerSection
              narrowColumn
              customers={form.customers}
              customersLoading={form.customersLoading}
              customerIdsWithPersonalPricing={form.customerIdsWithPersonalPricing}
              selectedCustomerPricing={form.selectedCustomerPricing}
              selectedCustomerId={form.selectedCustomerId}
              customerTab={customerTab}
              onCustomerTabChange={setCustomerTab}
              customerSearch={customerSearch}
              onCustomerSearchChange={setCustomerSearch}
              customerName={form.customerName}
              customerPhone={form.customerPhone}
              onCustomerNameChange={form.setCustomerName}
              onCustomerPhoneChange={form.setCustomerPhone}
              onCustomerSelect={form.handleCustomerSelect}
              customerStoredVehicles={form.customerStoredVehicles}
              towDate={form.towDate}
              towTime={form.towTime}
              towEndDate={form.towEndDate}
              towEndTime={form.towEndTime}
              onTowDateChange={form.setTowDate}
              onTowTimeChange={form.setTowTime}
              onTowEndDateChange={form.setTowEndDate}
              onTowEndTimeChange={form.setTowEndTime}
              onNowClick={handleNowClick}
              customerOrderNumber={form.customerOrderNumber}
              onCustomerOrderNumberChange={form.setCustomerOrderNumber}
              isBusinessCustomer={isBusinessCustomer}
              department={form.department}
              onDepartmentChange={form.setDepartment}
              orderedBy={form.orderedBy}
              onOrderedByChange={form.setOrderedBy}
              savedOrderers={savedOrderers}
              orderersLoading={orderersLoading}
              showSaveOrdererPill={showSaveOrdererOption}
              saveOrdererToCustomer={saveOrdererToCustomer}
              onSaveOrdererToggle={() => setSaveOrdererToCustomer((v) => !v)}
              onOrdererSelected={() => setSaveOrdererToCustomer(false)}
            />

            {form.towType === 'single' ? (
              <>
                <SectionPricing form={form} compact />
                {!quoteGate.isEditingClosedTow && (
                  <SectionQuoteGate form={form} quoteGate={quoteGate} compact />
                )}
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-sm text-gt-text-tertiary">
                {!form.towType
                  ? 'בחר סוג גרירה כדי לראות מחיר'
                  : 'מחיר ואישור זמינים לגרירה פשוטה בלבד'}
              </div>
            )}
          </div>

          {/* Column 2 — סוג גרירה ורכב */}
          <div className="lg:col-span-6">
            <h2 className="text-sm font-semibold text-gt-text-secondary mb-2">
              סוג גרירה ורכב
            </h2>
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
                <div className="grid grid-cols-4 gap-2">
                  {towEntryOptions.map((option) => {
                    const Icon = option.icon
                    const isActive = entryKind === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleTowTypeSelect(option.value)}
                        className={
                          isActive
                            ? 'group flex items-center gap-2 rounded-lg border border-gt-brand bg-gt-brand-subtle px-2.5 min-h-[36px] text-right transition-all duration-150'
                            : 'group flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 min-h-[36px] text-right transition-all duration-150 hover:border-gt-border-strong hover:bg-gt-surface-hover'
                        }
                      >
                        <div
                          className={
                            isActive
                              ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gt-brand text-white'
                              : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gt-surface-subtle text-gt-text-secondary group-hover:text-gt-text-primary'
                          }
                        >
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1 leading-tight">
                          <div
                            className={
                              isActive
                                ? 'truncate text-sm font-semibold text-gt-brand-text'
                                : 'truncate text-sm font-semibold text-gt-text-primary'
                            }
                          >
                            {option.label}
                          </div>
                          <div
                            className={
                              isActive
                                ? 'truncate text-xs text-gt-brand-text opacity-70'
                                : 'truncate text-xs text-gt-text-tertiary'
                            }
                          >
                            {option.sub}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {form.towType === 'single' && (
                <div className="grid grid-cols-2 gap-3 items-start">
                  {/* Sub-column A — פרטי רכב */}
                  <div>
                    <h3 className="text-sm font-semibold text-gt-text-secondary mb-2">
                      פרטי רכב
                    </h3>
                    <div className="space-y-3">
                      {/* Group: רכב (storage picker + plate lookup + found card) */}
                      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-3">
                        {form.storageLoading && (
                          <div className="flex items-center gap-2 text-gt-text-tertiary text-sm">
                            <Loader2 size={16} className="animate-spin" />
                            בודק רכבים באחסנה...
                          </div>
                        )}
                        {form.customerStoredVehicles.length > 0 &&
                          !form.selectedStoredVehicleId &&
                          !form.storageLoading && (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-purple-700 mb-2">
                                <Package size={16} />
                                <span className="text-sm font-medium">
                                  ללקוח זה יש {form.customerStoredVehicles.length} רכבים באחסנה
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {form.customerStoredVehicles
                                  .filter(isPickableStoredVehicle)
                                  .map((vehicle) => (
                                    <button
                                      key={vehicle.id}
                                      type="button"
                                      onClick={() => form.handleSelectStoredVehicle(vehicle)}
                                      className="px-3 min-h-[36px] bg-white border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors text-sm flex flex-col items-start gap-1"
                                    >
                                      <span className="flex items-center gap-2 flex-wrap">
                                        <Package size={14} className="text-purple-500" />
                                        <span className="font-medium text-gray-800">
                                          {vehicle.plate_number}
                                        </span>
                                        {(vehicle as { vehicle_condition?: string }).vehicle_condition ===
                                          'faulty' && (
                                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                            תקול
                                          </span>
                                        )}
                                        {(vehicle as { vehicle_code?: string }).vehicle_code && (
                                          <span className="text-xs text-blue-600">
                                            #{(vehicle as { vehicle_code?: string }).vehicle_code}
                                          </span>
                                        )}
                                        {vehicle.vehicle_data && (
                                          <span className="text-xs text-gray-500">
                                            {vehicle.vehicle_data.manufacturer} {vehicle.vehicle_data.model}
                                          </span>
                                        )}
                                      </span>
                                      <TimeInStoragePill lastStoredAt={vehicle.last_stored_at} />
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        {form.selectedStoredVehicleId && (
                          <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-purple-700 min-w-0">
                                <Package size={16} className="shrink-0" />
                                <span className="text-sm font-medium truncate">
                                  🚗 {form.vehiclePlate} {form.vehicleData?.data?.manufacturer}{' '}
                                  {form.vehicleData?.data?.model} - ישוחרר בשמירת הגרירה
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={form.handleClearStoredVehicle}
                                className="text-purple-600 hover:text-purple-800 text-xs underline shrink-0"
                              >
                                בחר רכב אחר
                              </button>
                            </div>
                          </div>
                        )}
                        <VehicleLookup
                          narrowColumn
                          manualEntryStyle="button"
                          manualEntryPlacement="afterSummary"
                          plateNumber={form.vehiclePlate}
                          onPlateChange={form.setVehiclePlate}
                          vehicleData={form.vehicleData}
                          onVehicleDataChange={form.setVehicleData}
                          vehicleType={form.vehicleType}
                          onVehicleTypeChange={form.setVehicleType}
                          vehicleCode={form.vehicleCode}
                          onVehicleCodeChange={form.setVehicleCode}
                          vehicleLookupNotFound={form.vehicleLookupNotFound}
                          onVehicleLookupNotFoundChange={form.setVehicleLookupNotFound}
                          manualManufacturer={form.manualManufacturer}
                          onManualManufacturerChange={form.setManualManufacturer}
                          manualColor={form.manualColor}
                          onManualColorChange={form.setManualColor}
                          manualWeight={form.manualWeight}
                          onManualWeightChange={form.setManualWeight}
                          manualChassis={form.manualChassis}
                          onManualChassisChange={form.setManualChassis}
                        />
                      </div>

                      {/* תקלות / שירותים / סוג גרר — compact trigger row */}
                      <div
                        ref={form.truckTypeSectionRef}
                        className={
                          form.truckTypeError
                            ? 'bg-white border border-gray-200 rounded-lg shadow-sm p-3 ring-2 ring-red-500 ring-offset-2'
                            : 'bg-white border border-gray-200 rounded-lg shadow-sm p-3'
                        }
                      >
                        <div className="grid grid-cols-3 gap-2">
                          <DefectSelector
                            variant="triggerOnly"
                            triggerLabel="תקלות"
                            selectedDefects={form.selectedDefects}
                            onChange={form.setSelectedDefects}
                          />
                          <ServiceSurchargeSelector
                            variant="triggerOnly"
                            triggerLabel="שירותים"
                            label="שירותים נוספים"
                            services={form.serviceSurchargesData}
                            selectedServices={form.selectedServices}
                            onChange={form.setSelectedServices}
                            manualSurcharges={form.manualSurcharges}
                            onManualSurchargesChange={form.setManualSurcharges}
                          />
                          <TowTruckTypeSelector
                            variant="triggerOnly"
                            triggerLabel="סוג גרר"
                            selectedTypes={form.requiredTruckTypes}
                            onChange={form.setRequiredTruckTypes}
                          />
                        </div>
                        {form.truckTypeError && (
                          <p className="text-red-500 text-sm mt-2 font-medium">
                            ⚠️ יש לבחור סוג גרר נדרש
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Sub-column B — מסלול */}
                  <div>
                    <h3 className="text-sm font-semibold text-gt-text-secondary mb-2">
                      מסלול
                    </h3>
                    <div className="space-y-3">
                      {/* Route points (pickup / stops / dropoff) — unified reorderable list */}
                      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
                        <div className="space-y-2">
                          {(() => {
                            const intermediateStopCount = form.routeStops.filter(
                              (s) => s.role === 'stop',
                            ).length
                            const showReorderArrows = intermediateStopCount > 0
                            return form.routeStops.map((stop, index) => {
                            const stopOrdinal =
                              stop.role === 'stop'
                                ? form.routeStops
                                    .slice(0, index + 1)
                                    .filter((s) => s.role === 'stop').length
                                : 0
                            const prevStop =
                              index > 0 ? form.routeStops[index - 1] : null
                            const nextStop =
                              index < form.routeStops.length - 1
                                ? form.routeStops[index + 1]
                                : null
                            const canMoveUp =
                              showReorderArrows &&
                              index > 0 &&
                              !(
                                stop.role === 'dropoff' && prevStop?.role === 'pickup'
                              )
                            const canMoveDown =
                              showReorderArrows &&
                              index < form.routeStops.length - 1 &&
                              !(stop.role === 'pickup' && nextStop?.role === 'dropoff')
                            return (
                              <div
                                key={stop.id}
                                className="bg-white border border-gray-200 rounded-lg p-3 space-y-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                                    <MapPin
                                      size={16}
                                      className={
                                        stop.role === 'pickup'
                                          ? 'text-emerald-500 shrink-0'
                                          : stop.role === 'dropoff'
                                            ? 'text-red-500 shrink-0'
                                            : 'text-blue-500 shrink-0'
                                      }
                                    />
                                    {stop.role === 'pickup' && (
                                      <>
                                        מוצא <span className="text-red-500">*</span>
                                      </>
                                    )}
                                    {stop.role === 'dropoff' && (
                                      <>
                                        יעד <span className="text-red-500">*</span>
                                      </>
                                    )}
                                    {stop.role === 'stop' && <>עצירה {stopOrdinal}</>}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {stop.role === 'pickup' &&
                                      form.basePriceList?.base_address && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            form.setStartFromBase(!form.startFromBase)
                                          }
                                          aria-pressed={form.startFromBase}
                                          className={
                                            form.startFromBase
                                              ? 'inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full border border-blue-300 bg-blue-50 text-blue-700 text-xs font-medium transition-colors'
                                              : 'inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-xs font-medium transition-colors'
                                          }
                                        >
                                          <Home size={14} />
                                          מהבסיס
                                        </button>
                                      )}
                                    {stop.role === 'dropoff' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = !form.dropoffToStorage
                                            form.setDropoffToStorage(next)
                                            if (next && storageAddress) {
                                              form.setDropoffAddress({
                                                address: storageAddress,
                                                isPinDropped: false,
                                              })
                                            }
                                          }}
                                          aria-pressed={form.dropoffToStorage}
                                          className={
                                            form.dropoffToStorage
                                              ? 'inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full border border-purple-300 bg-purple-50 text-purple-700 text-xs font-medium transition-colors'
                                              : 'inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-xs font-medium transition-colors'
                                          }
                                        >
                                          <Package size={14} />
                                          לאחסנה
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            form.setChargeDeadheadReturn(
                                              !form.chargeDeadheadReturn,
                                            )
                                          }
                                          aria-pressed={form.chargeDeadheadReturn}
                                          className={
                                            form.chargeDeadheadReturn
                                              ? 'inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full border border-teal-300 bg-teal-50 text-teal-700 text-xs font-medium transition-colors'
                                              : 'inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-xs font-medium transition-colors'
                                          }
                                        >
                                          נסיעת סרק
                                        </button>
                                      </>
                                    )}
                                    {showReorderArrows && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => form.moveStopUp(stop.id)}
                                          disabled={!canMoveUp}
                                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
                                          aria-label="הזז למעלה"
                                        >
                                          <ChevronUp size={16} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => form.moveStopDown(stop.id)}
                                          disabled={!canMoveDown}
                                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
                                          aria-label="הזז למטה"
                                        >
                                          <ChevronDown size={16} />
                                        </button>
                                      </>
                                    )}
                                    {stop.role === 'stop' && (
                                      <button
                                        type="button"
                                        onClick={() => form.removeStop(stop.id)}
                                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-red-500"
                                        aria-label="הסר עצירה"
                                      >
                                        <X size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {stop.role === 'pickup' && (
                                  <AddressInput
                                    hideLabel
                                    value={form.pickupAddress}
                                    onChange={form.setPickupAddress}
                                    placeholder="הזן כתובת איסוף..."
                                    required
                                    onPinDropClick={() =>
                                      form.setPinDropModal({ isOpen: true, field: 'pickup' })
                                    }
                                    isMobile={false}
                                    narrowColumn
                                  />
                                )}
                                {stop.role === 'dropoff' && (
                                  <AddressInput
                                    hideLabel
                                    value={form.dropoffAddress}
                                    onChange={form.setDropoffAddress}
                                    placeholder="הזן כתובת יעד..."
                                    required
                                    onPinDropClick={() =>
                                      form.setPinDropModal({ isOpen: true, field: 'dropoff' })
                                    }
                                    isMobile={false}
                                    narrowColumn
                                  />
                                )}
                                {stop.role === 'stop' && (
                                  <AddressInput
                                    hideLabel
                                    value={stop.address}
                                    onChange={(addr: AddressData) =>
                                      form.updateStop(stop.id, { address: addr })
                                    }
                                    placeholder="הזן כתובת עצירה..."
                                    onPinDropClick={() =>
                                      form.setPinDropModal({
                                        isOpen: true,
                                        field: `routestop:${stop.id}`,
                                      })
                                    }
                                    isMobile={false}
                                    narrowColumn
                                  />
                                )}
                              </div>
                            )
                          })
                          })()}
                          <div className="border-t border-gray-100 pt-2 mt-1">
                            <button
                              type="button"
                              onClick={form.addStop}
                              className="inline-flex items-center gap-1 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:underline underline-offset-2 transition-colors"
                            >
                              <Plus size={14} className="shrink-0" />
                              הוסף נקודת עצירה
                            </button>
                          </div>
                        </div>

                        {/* Deadhead hint */}
                        {form.chargeDeadheadReturn && form.dropoffToBaseLoading && (
                          <p className="text-xs text-gray-400 mt-2">
                            מחשב מרחק חזרה לאחסנה...
                          </p>
                        )}
                        {form.chargeDeadheadReturn &&
                          !form.dropoffToBaseLoading &&
                          form.dropoffToBaseDistance?.distanceKm != null && (
                            <p className="text-xs text-gray-400 mt-2">
                              מרחק חזרה לאחסנה:{' '}
                              {form.dropoffToBaseDistance.distanceKm.toFixed(1)} ק״מ
                            </p>
                          )}
                        {form.chargeDeadheadReturn && activeDeadheadRate <= 0 && (
                          <p className="text-xs text-amber-600 mt-2">
                            לא הוגדר מחיר לק״מ סרק במחירון
                          </p>
                        )}

                        {/* Distance */}
                        {(form.distanceLoading || form.baseToPickupLoading) && (
                          <div className="mt-2 flex items-center gap-2 text-gray-500">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-sm">מחשב מרחק...</span>
                          </div>
                        )}
                        {!form.distanceLoading &&
                          !form.baseToPickupLoading &&
                          totalDistance && (
                            <div className="mt-2 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <Navigation
                                size={16}
                                className="text-blue-600 flex-shrink-0"
                              />
                              <span className="text-sm text-blue-800">
                                <span className="font-bold">{totalDistance.distanceKm}</span>{' '}
                                ק״מ
                                <span className="mx-2">•</span>
                                <span className="font-bold">
                                  {totalDistance.durationMinutes}
                                </span>{' '}
                                דק׳
                              </span>
                            </div>
                          )}
                      </div>

                      {/* Location surcharges */}
                      {form.locationSurchargesData.filter((l) => l.is_active).length >
                        0 && (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
                          <LocationSurchargeSelector
                            locationSurcharges={form.locationSurchargesData}
                            selectedLocationSurcharges={form.selectedLocationSurcharges}
                            onChange={form.setSelectedLocationSurcharges}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {form.towType === 'exchange' && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-sm text-gt-text-tertiary">
                  תקין↔תקול — בבנייה
                </div>
              )}

              {entryKind === 'custom' && form.towType === 'custom' && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-sm text-gt-text-tertiary">
                  מסלול מותאם — בבנייה
                </div>
              )}

              {entryKind === 'events' && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-sm text-gt-text-tertiary">
                  אירועים מיוחדים — בבנייה
                </div>
              )}
            </div>
          </div>

          {/* Column 3 — גרר, אנשי קשר ותשלום (locked until quote approval) */}
          <div
            className="lg:col-span-3"
            style={{
              opacity: quoteGate.lockedOpacity,
              pointerEvents:
                quoteGate.lockedPointer as React.CSSProperties['pointerEvents'],
            }}
          >
            <h2 className="text-sm font-semibold text-gt-text-secondary mb-2">
              גרר, אנשי קשר ותשלום
            </h2>

            {form.towType === 'single' && quoteGate.quoteApproved ? (
              <div className="space-y-3">
                {/* Driver picker */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
                  <h3 className="text-sm font-semibold text-gt-text-secondary mb-2">
                    גרר ונהג
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mb-2">
                    הנהג ישובץ לאחר שמירת הגרירה
                  </p>
                  <button
                    type="button"
                    onClick={openDriverPicker}
                    className="w-full px-3 h-9 bg-gt-brand text-white rounded-lg text-sm font-medium hover:bg-gt-brand-hover transition-colors"
                  >
                    פתח יומן לבחירת נהג ↗
                  </button>
                  {form.preSelectedDriverId && (() => {
                    const selectedDriver = form.drivers.find(
                      (d) => d.id === form.preSelectedDriverId,
                    )
                    const selectedTruck = form.preSelectedTruckId
                      ? form.trucks.find((t) => t.id === form.preSelectedTruckId)
                      : null
                    return selectedDriver ? (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-800">
                          נהג מיועד: {selectedDriver.user?.full_name || 'נהג'}
                        </p>
                        {selectedTruck && (
                          <p className="text-sm text-blue-700 mt-0.5">
                            משאית: {getTruckTypeLabel(selectedTruck.truck_type)} —{' '}
                            {selectedTruck.plate_number}
                          </p>
                        )}
                        <p className="text-xs text-blue-600">
                          {form.towDate} · {form.towTime}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            form.setPreSelectedDriverId(null)
                            form.setPreSelectedTruckId(null)
                          }}
                          className="text-xs text-red-500 mt-1 hover:underline"
                        >
                          הסר שיבוץ
                        </button>
                      </div>
                    ) : null
                  })()}
                </div>

                {/* Contacts */}
                <div className="space-y-2">
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                        <MapPin size={16} className="text-emerald-500 shrink-0" />
                        איש קשר במוצא
                      </span>
                      {!form.selectedCustomerId && (
                        <button
                          type="button"
                          onClick={() => form.copyFromCustomer('pickup')}
                          className="shrink-0 px-2.5 min-h-[36px] text-xs font-medium rounded-lg border border-gray-200 bg-gray-50 text-gt-brand-text hover:bg-gt-brand-subtle"
                        >
                          כמו לקוח 👤
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-[2] min-w-0">
                        <label className="block text-xs text-gray-500 font-medium mb-1">שם</label>
                        <ContactNameAutocomplete
                          value={form.pickupContactName}
                          onChange={form.setPickupContactName}
                          onSelectContact={(contact) => {
                            form.setPickupContactName(contact.name)
                            form.setPickupContactPhone(contact.phone ?? '')
                            contactsSave.setSavePickupContactToCustomer(false)
                          }}
                          contacts={contactsSave.savedContacts}
                          loading={contactsSave.contactsLoading}
                          disabled={form.saving}
                          placeholder="שם איש קשר"
                          className={contactInputClass}
                        />
                      </div>
                      <div className="flex-[3] min-w-0">
                        <label className="block text-xs text-gray-500 font-medium mb-1">טלפון</label>
                        <PhoneInput
                          value={form.pickupContactPhone}
                          onChange={form.setPickupContactPhone}
                          placeholder="טלפון"
                          className={contactInputClass}
                        />
                      </div>
                    </div>
                    <SaveCustomerContactPill
                      className="px-2.5 py-1"
                      visible={contactsSave.showSavePickupContactOption}
                      active={contactsSave.savePickupContactToCustomer}
                      onToggle={() =>
                        contactsSave.setSavePickupContactToCustomer((prev) => !prev)
                      }
                      disabled={form.saving}
                    />
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                        <MapPin size={16} className="text-red-500 shrink-0" />
                        איש קשר ביעד
                      </span>
                      {!form.selectedCustomerId && (
                        <button
                          type="button"
                          onClick={() => form.copyFromCustomer('dropoff')}
                          className="shrink-0 px-2.5 min-h-[36px] text-xs font-medium rounded-lg border border-gray-200 bg-gray-50 text-gt-brand-text hover:bg-gt-brand-subtle"
                        >
                          כמו לקוח 👤
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-[2] min-w-0">
                        <label className="block text-xs text-gray-500 font-medium mb-1">שם</label>
                        <ContactNameAutocomplete
                          value={form.dropoffContactName}
                          onChange={form.setDropoffContactName}
                          onSelectContact={(contact) => {
                            form.setDropoffContactName(contact.name)
                            form.setDropoffContactPhone(contact.phone ?? '')
                            contactsSave.setSaveDropoffContactToCustomer(false)
                          }}
                          contacts={contactsSave.savedContacts}
                          loading={contactsSave.contactsLoading}
                          disabled={form.saving}
                          placeholder="שם איש קשר"
                          className={contactInputClass}
                        />
                      </div>
                      <div className="flex-[3] min-w-0">
                        <label className="block text-xs text-gray-500 font-medium mb-1">טלפון</label>
                        <PhoneInput
                          value={form.dropoffContactPhone}
                          onChange={form.setDropoffContactPhone}
                          placeholder="טלפון"
                          className={contactInputClass}
                        />
                      </div>
                    </div>
                    <SaveCustomerContactPill
                      className="px-2.5 py-1"
                      visible={contactsSave.showSaveDropoffContactOption}
                      active={contactsSave.saveDropoffContactToCustomer}
                      onToggle={() =>
                        contactsSave.setSaveDropoffContactToCustomer((prev) => !prev)
                      }
                      disabled={form.saving}
                    />
                  </div>

                  <div className="border-t border-gray-200 pt-3 mt-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      הערות
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => form.setNotes(e.target.value)}
                      rows={2}
                      placeholder="הערות"
                      className="w-full px-3 h-9 min-h-[72px] py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gt-brand/15 focus:border-gt-brand resize-none bg-white"
                    />
                  </div>
                </div>

                {/* Payment + save */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-3">
                  <h3 className="text-sm font-semibold text-gt-text-secondary">
                    תשלום ושמירה
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { value: 'cash' as const, label: 'מזומן' },
                        { value: 'credit' as const, label: 'אשראי' },
                        { value: 'invoice' as const, label: 'חשבונית' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => form.setPaymentMethod(opt.value)}
                        className={`px-3 min-h-[36px] rounded-lg text-sm ${
                          form.paymentMethod === opt.value
                            ? 'bg-gt-brand text-white'
                            : 'bg-white text-gray-700 border border-gray-200 font-medium'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {form.paymentMethod === 'invoice' && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.invoiceName}
                        onChange={(e) => form.setInvoiceName(e.target.value)}
                        placeholder="שם לחשבונית"
                        className="flex-1 min-w-0 px-3 h-9 border border-gray-200 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => form.setInvoiceName(form.customerName)}
                        className="shrink-0 px-2.5 min-h-[36px] text-xs font-medium rounded-lg border border-gray-200 bg-gray-50 text-gt-brand-text hover:bg-gt-brand-subtle"
                      >
                        כמו לקוח
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={form.handleSave}
                    disabled={form.saving}
                    className="w-full h-9 bg-gt-brand text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-gt-brand-hover disabled:opacity-60"
                  >
                    {form.saving ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        שומר...
                      </>
                    ) : (
                      'שמור גרירה'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-sm text-gt-text-tertiary">
                {!form.towType
                  ? 'בחר סוג גרירה כדי להמשיך'
                  : !quoteGate.quoteApproved
                    ? 'יש לאשר הצעת מחיר כדי להמשיך'
                    : 'זמין לגרירה פשוטה בלבד'}
              </div>
            )}
          </div>
        </div>
      </div>

      <PinDropModal
        isOpen={form.pinDropModal.isOpen}
        onClose={() => form.setPinDropModal({ isOpen: false, field: null })}
        onConfirm={handlePinDropConfirm}
        initialAddress={
          form.pinDropModal.field?.startsWith('routestop:')
            ? form.routeStops.find(
                (s) => `routestop:${s.id}` === form.pinDropModal.field,
              )?.address
            : form.pinDropModal.field === 'pickup'
              ? form.pickupAddress
              : form.pinDropModal.field === 'dropoff'
                ? form.dropoffAddress
                : undefined
        }
        title={
          form.pinDropModal.field?.startsWith('routestop:')
            ? 'בחר מיקום עצירה'
            : form.pinDropModal.field === 'pickup'
              ? 'בחר מיקום מוצא'
              : form.pinDropModal.field === 'dropoff'
                ? 'בחר מיקום יעד'
                : 'בחר מיקום'
        }
      />

      {showDriverPicker && !pendingPickerDriverId && (
        <DriverCalendarPicker
          companyId={form.companyId || ''}
          drivers={form.drivers}
          requiredTruckTypes={form.requiredTruckTypes}
          initialDate={form.towDate as string}
          initialTime={form.towTime}
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
            : form.trucks.filter((t) => t.is_active)
        return (
          <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
            <div className="bg-white w-full lg:max-w-2xl lg:rounded-2xl lg:mx-4 overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
                <h2 className="font-bold text-lg">בחירת משאית</h2>
                <button
                  type="button"
                  onClick={closeDriverPicker}
                  className="p-2 hover:bg-white/20 rounded-lg"
                >
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
                          {
                            form.drivers.find((d) => d.id === pendingPickerDriverId)
                              ?.user?.full_name
                          }
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
                        onChange={(e) =>
                          setPendingPickerTruckId(e.target.value || null)
                        }
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
                    form.setPreSelectedDriverId(pendingPickerDriverId)
                    form.setPreSelectedTruckId(pendingPickerTruckId)
                    form.setTowDate(pendingPickerDate!)
                    form.setTowTime(pendingPickerTime!)
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

      {form.showAssignNowModal && (
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
                מחיר:{' '}
                <span className="font-bold">₪{form.finalPrice.toFixed(2)}</span>
              </p>
              <p className="text-gray-600">האם לשבץ נהג עכשיו?</p>
            </div>
            <div className="flex gap-3 p-5 bg-gray-50 border-t border-gray-300">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 font-medium"
              >
                אחר כך
              </button>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/tows/${form.savedTowId}`)}
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
