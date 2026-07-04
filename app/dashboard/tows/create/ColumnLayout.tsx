'use client'

import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { useTowForm } from '../../../hooks/useTowForm'
import { useQuoteGate } from '../../../hooks/useQuoteGate'
import { useCustomerOrderers } from '../../../hooks/useCustomerOrderers'
import { shouldOfferSaveCustomerOrderer } from '../../../lib/utils/customer-orderer-save-ui'
import {
  CreateCustomerSection,
  type CreateCustomerTab,
} from '../../../components/tow-forms/sections/CreateCustomerSection'
import {
  PinDropModal,
  VehicleLookup,
  DefectSelector,
  ServiceSurchargeSelector,
  TowTruckTypeSelector,
  LocationSurchargeSelector,
} from '../../../components/tow-forms/shared'
import { isPickableStoredVehicle } from '../../../lib/queries/storage'
import {
  AddressInput,
  type AddressData,
} from '../../../components/tow-forms/routes/AddressInput'
import type { TimeSurcharge } from '../../../lib/queries/price-lists'
import { mergePriceLists, resolveDeadheadRate } from '../../../lib/utils/price-calculator'
import {
  getActiveTimeSurchargeSummary,
  getTimeSurchargeLabel,
} from '../../../lib/utils/time-surcharge-summary'

type Form = ReturnType<typeof useTowForm>

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
 * Editable time-surcharge block for the narrow route column. Mirrors the
 * collapsed-summary + "שנה סוג תוספת" expand pattern used by the linear form's
 * TimeSurchargesSection and the mobile SectionPricing, using the same shared
 * summary utils so behavior stays consistent.
 */
function NarrowTimeSurcharges({
  timeSurchargesData,
  isHoliday,
  setIsHoliday,
  activeTimeSurchargesList,
  setActiveTimeSurchargesList,
  setHasManualTimeSurchargeOverride,
}: {
  timeSurchargesData: TimeSurcharge[]
  isHoliday: boolean
  setIsHoliday: (v: boolean) => void
  activeTimeSurchargesList: TimeSurcharge[]
  setActiveTimeSurchargesList: (v: TimeSurcharge[]) => void
  setHasManualTimeSurchargeOverride: (v: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const holidaySurcharge = timeSurchargesData.find(
    (s) => s.day_type === 'holiday' && s.is_active,
  )
  const nonHolidaySurcharges = timeSurchargesData.filter(
    (s) => s.is_active && s.day_type !== 'holiday',
  )
  const isActive = (s: TimeSurcharge) =>
    activeTimeSurchargesList.some((a) => a.id === s.id)
  const toggleSurcharge = (s: TimeSurcharge) => {
    if (isActive(s)) {
      setActiveTimeSurchargesList(activeTimeSurchargesList.filter((a) => a.id !== s.id))
    } else {
      setActiveTimeSurchargesList([...activeTimeSurchargesList, s])
    }
    setHasManualTimeSurchargeOverride(true)
  }
  const topActive = getActiveTimeSurchargeSummary(
    timeSurchargesData,
    activeTimeSurchargesList,
    isHoliday,
  )

  if (nonHolidaySurcharges.length === 0 && !holidaySurcharge) return null

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
                  {getTimeSurchargeLabel(s)} ({s.surcharge_percent}%)
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

/**
 * Alternative 4-column desktop layout for fresh single-tow creation.
 * Additive/opt-in — consumes the same useTowForm instance as the linear form
 * so switching between layouts preserves all entered data.
 */
export function ColumnLayout({
  form,
  onExitColumnLayout,
}: {
  form: Form
  onExitColumnLayout: () => void
}) {
  const [customerTab, setCustomerTab] = useState<CreateCustomerTab>('existing')
  const [customerSearch, setCustomerSearch] = useState('')
  const [saveOrdererToCustomer, setSaveOrdererToCustomer] = useState(false)
  const [entryKind, setEntryKind] = useState<TowEntryKind | null>(
    form.towType || null,
  )

  const quoteGate = useQuoteGate(form)

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

  return (
    <div
      className="min-h-screen bg-gt-canvas -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8"
      dir="rtl"
    >
      {form.error && (
        <div className="fixed top-4 left-4 right-4 z-50 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {form.error}
        </div>
      )}

      <header className="bg-white border-b border-gray-300 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
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

      <div className="px-4 py-4 sm:py-6">
        <div className="grid grid-cols-1 gap-4 items-start lg:grid-cols-12">
          {/* Column 1 — פרטי לקוח ומחיר (customer stacked above price + quote gate) */}
          <div className="lg:col-span-3 space-y-4">
            <div>
            <h2 className="text-xs font-semibold text-gt-text-secondary mb-2">
              פרטי לקוח
            </h2>
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
            </div>

            {/* מחיר ואישור — price breakdown + quote-approval gate */}
            <div>
              <h2 className="text-xs font-semibold text-gt-text-secondary mb-2">
                מחיר ואישור
              </h2>
              <div className="bg-white border border-gt-border rounded-xl shadow-sm p-4 text-sm text-gt-text-tertiary">
                בבנייה — בקרוב
              </div>
            </div>
          </div>

          {/* Column 2 — סוג גרירה ורכב */}
          <div className="lg:col-span-6">
            <h2 className="text-xs font-semibold text-gt-text-secondary mb-2">
              סוג גרירה ורכב
            </h2>
            <div className="space-y-4">
              <div className="bg-white border border-gt-border rounded-xl shadow-sm p-2">
                <div className="grid grid-cols-4 gap-1.5">
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
                            ? 'group flex items-center gap-2 rounded-lg border border-gt-brand bg-gt-brand-subtle px-2.5 py-2 text-right transition-all duration-150'
                            : 'group flex items-center gap-2 rounded-lg border border-gt-border bg-white px-2.5 py-2 text-right transition-all duration-150 hover:border-gt-border-strong hover:bg-gt-surface-hover'
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
                                ? 'truncate text-[13px] font-semibold text-gt-brand-text'
                                : 'truncate text-[13px] font-semibold text-gt-text-primary'
                            }
                          >
                            {option.label}
                          </div>
                          <div
                            className={
                              isActive
                                ? 'truncate text-[10px] text-gt-brand-text opacity-70'
                                : 'truncate text-[10px] text-gt-text-tertiary'
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
                    <h3 className="text-xs font-semibold text-gt-text-secondary mb-2">
                      פרטי רכב
                    </h3>
                    <div className="space-y-3">
                      {/* Group: רכב (storage picker + plate lookup + found card) */}
                      <div className="bg-white border border-gt-border rounded-xl shadow-sm p-3 space-y-3">
                        {form.storageLoading && (
                          <div className="flex items-center gap-2 text-gt-text-tertiary text-sm">
                            <Loader2 size={16} className="animate-spin" />
                            בודק רכבים באחסנה...
                          </div>
                        )}
                        {form.customerStoredVehicles.length > 0 &&
                          !form.selectedStoredVehicleId &&
                          !form.storageLoading && (
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
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
                                      className="px-3 py-2 bg-white border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors text-sm flex items-center gap-2"
                                    >
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
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        {form.selectedStoredVehicleId && (
                          <div className="bg-purple-100 border border-purple-300 rounded-xl p-3">
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
                            ? 'bg-white border border-gt-border rounded-xl shadow-sm p-3 ring-2 ring-red-500 ring-offset-2'
                            : 'bg-white border border-gt-border rounded-xl shadow-sm p-3'
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
                    <h3 className="text-xs font-semibold text-gt-text-secondary mb-2">
                      מסלול
                    </h3>
                    <div className="space-y-3">
                      {/* Route points (pickup / stops / dropoff) — unified reorderable list */}
                      <div className="bg-white border border-gt-border rounded-xl shadow-sm p-3">
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
                                className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-1.5"
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
                                              ? 'inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-full border border-blue-300 bg-blue-50 text-blue-700 text-xs font-medium transition-colors'
                                              : 'inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-xs font-medium transition-colors'
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
                                              ? 'inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-full border border-purple-300 bg-purple-50 text-purple-700 text-xs font-medium transition-colors'
                                              : 'inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-xs font-medium transition-colors'
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
                                              ? 'inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-full border border-teal-300 bg-teal-50 text-teal-700 text-xs font-medium transition-colors'
                                              : 'inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-xs font-medium transition-colors'
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
                                          className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
                                          aria-label="הזז למעלה"
                                        >
                                          <ChevronUp size={16} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => form.moveStopDown(stop.id)}
                                          disabled={!canMoveDown}
                                          className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
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
                                        className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-red-500"
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
                                    isMobile
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
                                    isMobile
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
                                    isMobile
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
                            <div className="mt-2 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
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

                      {/* Time surcharge (editable) */}
                      <div className="bg-white border border-gt-border rounded-xl shadow-sm p-3">
                        <h4 className="text-xs font-semibold text-gt-text-secondary mb-2">
                          תוספת זמן
                        </h4>
                        <NarrowTimeSurcharges
                          timeSurchargesData={form.timeSurchargesData}
                          isHoliday={form.isHoliday}
                          setIsHoliday={form.setIsHoliday}
                          activeTimeSurchargesList={form.activeTimeSurchargesList}
                          setActiveTimeSurchargesList={form.setActiveTimeSurchargesList}
                          setHasManualTimeSurchargeOverride={
                            form.setHasManualTimeSurchargeOverride
                          }
                        />
                      </div>

                      {/* Location surcharges */}
                      {form.locationSurchargesData.filter((l) => l.is_active).length >
                        0 && (
                        <div className="bg-white border border-gt-border rounded-xl shadow-sm p-3">
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
                <div className="bg-white border border-gt-border rounded-xl shadow-sm p-4 text-sm text-gt-text-tertiary">
                  תקין↔תקול — בבנייה
                </div>
              )}

              {entryKind === 'custom' && form.towType === 'custom' && (
                <div className="bg-white border border-gt-border rounded-xl shadow-sm p-4 text-sm text-gt-text-tertiary">
                  מסלול מותאם — בבנייה
                </div>
              )}

              {entryKind === 'events' && (
                <div className="bg-white border border-gt-border rounded-xl shadow-sm p-4 text-sm text-gt-text-tertiary">
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
            <h2 className="text-xs font-semibold text-gt-text-secondary mb-2">
              גרר, אנשי קשר ותשלום
            </h2>
            <div className="bg-white border border-gt-border rounded-xl shadow-sm p-4 text-sm text-gt-text-tertiary">
              בבנייה — בקרוב
            </div>
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
    </div>
  )
}
