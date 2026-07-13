'use client'

import { VehicleLookup, DefectSelector, TowTruckTypeSelector, SelectedService, SurchargesSection } from '../shared'
import { Loader2, Package, Car, MapPin, X, ChevronUp, ChevronDown } from 'lucide-react'
import { AddressInput, AddressData } from './AddressInput'
import {
  DropToStorageToggle,
  RouteAddStopButton,
  RouteAddressFieldLabel,
  RouteAddressesFooter,
  RouteOriginDestGrid,
} from './RouteAddressesSection'
import { VehicleType, VehicleLookupResult } from '../../../lib/types'
import { LocationSurcharge, ServiceSurcharge, TimeSurcharge } from '../../../lib/queries/price-lists'
import { type ManualSurcharge } from '../../../lib/utils/manual-surcharge'
import { type RouteStop } from '../../../hooks/useTowForm'
import {
  isPickableStoredVehicle,
  StoredVehicleWithCustomer,
} from '../../../lib/queries/storage'
import { TimeInStoragePill } from '../../storage/TimeInStoragePill'
import { FormCard } from '../../ui'
import { yardFromBasePriceList } from '../../../lib/utils/storage-yard-match'
import {
  SaveCustomerAddressControl,
  type CustomerAddressPendingDraft,
} from '../../customer-addresses/SaveCustomerAddressControl'
import { shouldOfferSaveCustomerAddress } from '../../../lib/utils/customer-address-save-ui'
import type { CustomerAddress } from '../../../lib/types'

interface DistanceResult {
  distanceKm: number
  durationMinutes: number
}

interface SingleRouteProps {
  // רכב
  vehiclePlate: string
  onVehiclePlateChange: (plate: string) => void
  vehicleData: VehicleLookupResult | null
  onVehicleDataChange: (data: VehicleLookupResult | null) => void
  vehicleType: VehicleType | ''
  onVehicleTypeChange: (type: VehicleType | '') => void
  vehicleCode: string
  onVehicleCodeChange: (code: string) => void
  vehicleLookupNotFound: boolean
  onVehicleLookupNotFoundChange: (val: boolean) => void
  manualManufacturer: string
  onManualManufacturerChange: (val: string) => void
  manualColor: string
  onManualColorChange: (val: string) => void
  manualWeight: string
  onManualWeightChange: (val: string) => void
  manualChassis: string
  onManualChassisChange: (val: string) => void
  selectedDefects: string[]
  onDefectsChange: (defects: string[]) => void
  
  // כתובות
  pickupAddress: AddressData
  onPickupAddressChange: (address: AddressData) => void
  dropoffAddress: AddressData
  onDropoffAddressChange: (address: AddressData) => void
  onPinDropClick: (field: string) => void
  routeStops: RouteStop[]
  addStop: () => void
  removeStop: (id: string) => void
  moveStopUp: (id: string) => void
  moveStopDown: (id: string) => void
  updateStop: (id: string, patch: Partial<Omit<RouteStop, 'id'>>) => void
  
  // מרחק
  distance: DistanceResult | null
  distanceLoading: boolean
  
  // יציאה מהבסיס
  basePriceList: Record<string, any> | null
  startFromBase: boolean
  onStartFromBaseChange: (checked: boolean) => void
  baseToPickupDistance: DistanceResult | null
  baseToPickupLoading: boolean
  
  // תוספות
  activeTimeSurcharges: TimeSurcharge[]
  isHoliday: boolean
  onIsHolidayChange: (isHoliday: boolean) => void
  locationSurchargesData: LocationSurcharge[]
  selectedLocationSurcharges: string[]
  onLocationSurchargesChange: (ids: string[]) => void
  manualSurcharges: ManualSurcharge[]
  onManualSurchargesChange: (lines: ManualSurcharge[]) => void
  serviceSurchargesData: ServiceSurcharge[]
  selectedServices: SelectedService[]
  onSelectedServicesChange: (services: SelectedService[]) => void

  // סוג גרר
  requiredTruckTypes: string[]
  onRequiredTruckTypesChange: (types: string[]) => void

  // אחסנה - חדש!
  customerStoredVehicles?: StoredVehicleWithCustomer[]
  selectedStoredVehicleId?: string | null
  onSelectStoredVehicle?: (vehicle: StoredVehicleWithCustomer) => void
  onClearStoredVehicle?: () => void
  storageLoading?: boolean
  dropoffToStorage?: boolean
  onDropoffToStorageChange?: (value: boolean) => void
  storageAddress?: string

  // Validation
  truckTypeSectionRef?: React.RefObject<HTMLDivElement | null>
  truckTypeError?: boolean
  isMobile?: boolean
  /** Forces single-column internal grids for narrow desktop columns (viewport sm: still applies otherwise). */
  narrowColumn?: boolean
  /**
   * Renders only a subset of the desktop content, without the numbered section
   * card chrome. Used by the column layout to split vehicle vs route into two
   * side-by-side sub-columns. Default 'both' preserves the existing desktop
   * (linear form) and mobile callers exactly.
   */
  renderSection?: 'vehicle' | 'route' | 'both'

  /** Phase 1.5 — save address control (optional; omit = no control). */
  selectedCustomerId?: string | null
  savedCustomerAddresses?: CustomerAddress[]
  pendingPickupAddress?: CustomerAddressPendingDraft | null
  onConfirmPendingPickupAddress?: (draft: CustomerAddressPendingDraft) => void
  onClearPendingPickupAddress?: () => void
  pendingDropoffAddress?: CustomerAddressPendingDraft | null
  onConfirmPendingDropoffAddress?: (draft: CustomerAddressPendingDraft) => void
  onClearPendingDropoffAddress?: () => void
  pendingStopAddresses?: Record<string, CustomerAddressPendingDraft>
  onConfirmPendingStopAddress?: (stopId: string, draft: CustomerAddressPendingDraft) => void
  onClearPendingStopAddress?: (stopId: string) => void
  saveAddressDisabled?: boolean
}

export function SingleRoute({
  // רכב
  vehiclePlate,
  onVehiclePlateChange,
  vehicleData,
  onVehicleDataChange,
  vehicleType,
  onVehicleTypeChange,
  vehicleCode,
  onVehicleCodeChange,
  vehicleLookupNotFound,
  onVehicleLookupNotFoundChange,
  manualManufacturer,
  onManualManufacturerChange,
  manualColor,
  onManualColorChange,
  manualWeight,
  onManualWeightChange,
  manualChassis,
  onManualChassisChange,
  selectedDefects,
  onDefectsChange,
  
  // כתובות
  pickupAddress,
  onPickupAddressChange,
  dropoffAddress,
  onDropoffAddressChange,
  onPinDropClick,
  routeStops,
  addStop,
  removeStop,
  moveStopUp,
  moveStopDown,
  updateStop,
  
  // מרחק
  distance,
  distanceLoading,
  
  // יציאה מהבסיס
  basePriceList,
  startFromBase,
  onStartFromBaseChange,
  baseToPickupDistance,
  baseToPickupLoading,
  
  // תוספות
  activeTimeSurcharges,
  isHoliday,
  onIsHolidayChange,
  locationSurchargesData,
  selectedLocationSurcharges,
  onLocationSurchargesChange,
  manualSurcharges,
  onManualSurchargesChange,
  serviceSurchargesData,
  selectedServices,
  onSelectedServicesChange,

  // סוג גרר
  requiredTruckTypes,
  onRequiredTruckTypesChange,

  // אחסנה - חדש!
  customerStoredVehicles = [],
  selectedStoredVehicleId = null,
  onSelectStoredVehicle,
  onClearStoredVehicle,
  storageLoading = false,
  dropoffToStorage = false,
  onDropoffToStorageChange,
  storageAddress = '',
  truckTypeSectionRef,
  truckTypeError = false,
  isMobile = false,
  narrowColumn = false,
  renderSection = 'both',
  selectedCustomerId = null,
  savedCustomerAddresses,
  pendingPickupAddress = null,
  onConfirmPendingPickupAddress,
  onClearPendingPickupAddress,
  pendingDropoffAddress = null,
  onConfirmPendingDropoffAddress,
  onClearPendingDropoffAddress,
  pendingStopAddresses = {},
  onConfirmPendingStopAddress,
  onClearPendingStopAddress,
  saveAddressDisabled = false,
}: SingleRouteProps) {
  const addressSaveEnabled = savedCustomerAddresses !== undefined
  const isNarrow = narrowColumn ?? false
  const isMobileSized = isMobile ?? false
  const storageYard = yardFromBasePriceList(basePriceList)
  const pickupYardConfirm = storageYard
    ? {
        role: 'pickup' as const,
        yard: storageYard,
        alreadyFlagged: startFromBase,
        onConfirm: () => onStartFromBaseChange(true),
        fieldKey: 'single-pickup',
      }
    : null
  const dropoffYardConfirm =
    storageYard && onDropoffToStorageChange
      ? {
          role: 'dropoff' as const,
          yard: storageYard,
          alreadyFlagged: dropoffToStorage,
          onConfirm: () => {
            onDropoffToStorageChange(true)
            if (storageAddress) {
              onDropoffAddressChange({
                address: storageAddress,
                lat: basePriceList?.base_lat ?? undefined,
                lng: basePriceList?.base_lng ?? undefined,
                isPinDropped: false,
              })
            }
          },
          fieldKey: 'single-dropoff',
        }
      : null

  // חישוב מרחק כולל להצגה
  const totalDistance = startFromBase && baseToPickupDistance && distance
    ? { 
        distanceKm: distance.distanceKm + baseToPickupDistance.distanceKm,
        durationMinutes: distance.durationMinutes + baseToPickupDistance.durationMinutes
      }
    : distance

  const renderVehicleFields = () => (
    <>
      {/* === אזור אחסנה - חדש! === */}

      {/* טוען רכבים מאחסנה */}
      {storageLoading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 size={16} className="animate-spin" />
          בודק רכבים באחסנה...
        </div>
      )}

      {/* הודעה על רכבים באחסנה */}
      {customerStoredVehicles.length > 0 && !selectedStoredVehicleId && !storageLoading && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-purple-700 mb-3">
            <Package size={18} />
            <span className="font-medium">ללקוח זה יש {customerStoredVehicles.length} רכבים באחסנה</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {customerStoredVehicles.filter(isPickableStoredVehicle).map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                onClick={() => onSelectStoredVehicle?.(vehicle)}
                className={
                  isMobile
                    ? 'px-3 min-h-[44px] bg-white border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors text-sm flex flex-col items-start gap-1'
                    : 'px-3 py-2 bg-white border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors text-sm flex flex-col items-start gap-1'
                }
              >
                <span className="flex items-center gap-2 flex-wrap">
                  <Package size={14} className="text-purple-500" />
                  <span className="font-medium text-gray-800">{vehicle.plate_number}</span>
                  {(vehicle as any).vehicle_condition === 'faulty' && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">תקול</span>
                  )}
                  {(vehicle as any).vehicle_code && (
                    <span className="text-xs text-blue-600">#{(vehicle as any).vehicle_code}</span>
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

      {/* הודעה שנבחר רכב מאחסנה */}
      {selectedStoredVehicleId && (
        <div className="bg-purple-100 border border-purple-300 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-purple-700">
              <Package size={18} />
              <span className="font-medium">
              🚗 {vehiclePlate} {vehicleData?.data?.manufacturer} {vehicleData?.data?.model} - ישוחרר בשמירת הגרירה
            </span>
            </div>
            <button
              type="button"
              onClick={onClearStoredVehicle}
              className="text-purple-600 hover:text-purple-800 text-sm underline"
            >
              בחר רכב אחר
            </button>
          </div>
        </div>
      )}

      {/* === סוף אזור אחסנה === */}

      <VehicleLookup
        plateNumber={vehiclePlate}
        onPlateChange={onVehiclePlateChange}
        vehicleData={vehicleData}
        onVehicleDataChange={onVehicleDataChange}
        vehicleType={vehicleType}
        onVehicleTypeChange={onVehicleTypeChange}
        vehicleCode={vehicleCode}
        onVehicleCodeChange={onVehicleCodeChange}
        vehicleLookupNotFound={vehicleLookupNotFound}
        onVehicleLookupNotFoundChange={onVehicleLookupNotFoundChange}
        manualManufacturer={manualManufacturer}
        onManualManufacturerChange={onManualManufacturerChange}
        manualColor={manualColor}
        onManualColorChange={onManualColorChange}
        manualWeight={manualWeight}
        onManualWeightChange={onManualWeightChange}
        manualChassis={manualChassis}
        onManualChassisChange={onManualChassisChange}
        isMobile={isMobileSized}
        narrowColumn={isNarrow}
        manualEntryStyle="button"
        manualEntryTrailing={
          <DefectSelector
            variant="triggerOnly"
            selectedDefects={selectedDefects}
            onChange={onDefectsChange}
          />
        }
        manualEntryEnd={
          <div
            ref={truckTypeSectionRef}
            className={
              truckTypeError
                ? 'shrink-0 rounded-xl ring-2 ring-red-500 ring-offset-1'
                : 'shrink-0'
            }
          >
            <TowTruckTypeSelector
              variant="triggerOnly"
              selectedTypes={requiredTruckTypes}
              onChange={onRequiredTruckTypesChange}
            />
          </div>
        }
      />
      {truckTypeError && (
        <p className="text-sm font-medium text-red-500">⚠️ יש לבחור סוג גרר נדרש</p>
      )}
    </>
  )

  const renderRouteFields = () => (
    <>
      {/* כתובות */}
      {isMobile ? (
        <div className="space-y-2">
          {routeStops.map((stop, index) => {
            const stopOrdinal =
              stop.role === 'stop'
                ? routeStops.slice(0, index + 1).filter((s) => s.role === 'stop').length
                : 0

            const saveAction =
              stop.role === 'pickup' &&
              addressSaveEnabled &&
              onConfirmPendingPickupAddress &&
              onClearPendingPickupAddress ? (
                <SaveCustomerAddressControl
                  visible={shouldOfferSaveCustomerAddress(
                    selectedCustomerId,
                    pickupAddress.address,
                    savedCustomerAddresses
                  )}
                  address={pickupAddress.address}
                  pending={pendingPickupAddress}
                  onConfirm={onConfirmPendingPickupAddress}
                  onClear={onClearPendingPickupAddress}
                  disabled={saveAddressDisabled}
                />
              ) : stop.role === 'dropoff' &&
                addressSaveEnabled &&
                onConfirmPendingDropoffAddress &&
                onClearPendingDropoffAddress ? (
                <SaveCustomerAddressControl
                  visible={shouldOfferSaveCustomerAddress(
                    selectedCustomerId,
                    dropoffAddress.address,
                    savedCustomerAddresses
                  )}
                  address={dropoffAddress.address}
                  pending={pendingDropoffAddress}
                  onConfirm={onConfirmPendingDropoffAddress}
                  onClear={onClearPendingDropoffAddress}
                  disabled={saveAddressDisabled}
                />
              ) : stop.role === 'stop' &&
                addressSaveEnabled &&
                onConfirmPendingStopAddress &&
                onClearPendingStopAddress ? (
                <SaveCustomerAddressControl
                  visible={shouldOfferSaveCustomerAddress(
                    selectedCustomerId,
                    stop.address?.address ?? '',
                    savedCustomerAddresses
                  )}
                  address={stop.address?.address ?? ''}
                  pending={pendingStopAddresses[stop.id] ?? null}
                  onConfirm={(draft) => onConfirmPendingStopAddress(stop.id, draft)}
                  onClear={() => onClearPendingStopAddress(stop.id)}
                  disabled={saveAddressDisabled}
                />
              ) : null

            return (
              <div key={stop.id} className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <RouteAddressFieldLabel
                    tone={
                      stop.role === 'pickup'
                        ? 'origin'
                        : stop.role === 'dropoff'
                          ? 'destination'
                          : 'stop'
                    }
                    required={stop.role === 'pickup' || stop.role === 'dropoff'}
                  >
                    {stop.role === 'pickup' && 'מוצא'}
                    {stop.role === 'dropoff' && 'יעד'}
                    {stop.role === 'stop' && <>עצירה {stopOrdinal}</>}
                  </RouteAddressFieldLabel>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveStopUp(stop.id)}
                      disabled={index === 0}
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
                      aria-label="הזז למעלה"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStopDown(stop.id)}
                      disabled={index === routeStops.length - 1}
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
                      aria-label="הזז למטה"
                    >
                      <ChevronDown size={16} />
                    </button>
                    {stop.role === 'stop' && (
                      <button
                        type="button"
                        onClick={() => removeStop(stop.id)}
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
                    value={pickupAddress}
                    onChange={onPickupAddressChange}
                    placeholder="הזן כתובת איסוף..."
                    required
                    onPinDropClick={() => onPinDropClick('pickup')}
                    extraActions={saveAction}
                    isMobile
                    storageYardConfirm={pickupYardConfirm}
                    savedAddresses={savedCustomerAddresses}
                  />
                )}
                {stop.role === 'dropoff' && (
                  <>
                    <AddressInput
                      hideLabel
                      value={dropoffAddress}
                      onChange={onDropoffAddressChange}
                      placeholder="הזן כתובת יעד..."
                      required
                      onPinDropClick={() => onPinDropClick('dropoff')}
                      extraActions={saveAction}
                      isMobile
                      storageYardConfirm={dropoffYardConfirm}
                      savedAddresses={savedCustomerAddresses}
                    />
                    {onDropoffToStorageChange && (
                      <DropToStorageToggle
                        active={dropoffToStorage}
                        onClick={() => {
                          const next = !dropoffToStorage
                          onDropoffToStorageChange(next)
                          if (next && storageAddress) {
                            onDropoffAddressChange({
                              address: storageAddress,
                              isPinDropped: false,
                            })
                          }
                        }}
                      />
                    )}
                  </>
                )}
                {stop.role === 'stop' && (
                  <AddressInput
                    hideLabel
                    value={stop.address}
                    onChange={(addr: AddressData) => updateStop(stop.id, { address: addr })}
                    placeholder="הזן כתובת עצירה..."
                    onPinDropClick={() => onPinDropClick(`routestop:${stop.id}`)}
                    extraActions={saveAction}
                    isMobile
                    savedAddresses={savedCustomerAddresses}
                  />
                )}
              </div>
            )
          })}
          <RouteAddStopButton onClick={addStop} />
        </div>
      ) : (
        <div className="space-y-3">
          <RouteOriginDestGrid
            stacked={isNarrow}
            onAddStop={addStop}
            origin={
              <div>
                <RouteAddressFieldLabel tone="origin" required>
                  מוצא
                </RouteAddressFieldLabel>
                <AddressInput
                  hideLabel
                  value={pickupAddress}
                  onChange={onPickupAddressChange}
                  placeholder="הזן כתובת איסוף..."
                  required
                  onPinDropClick={() => onPinDropClick('pickup')}
                  extraActions={
                    addressSaveEnabled &&
                    onConfirmPendingPickupAddress &&
                    onClearPendingPickupAddress ? (
                      <SaveCustomerAddressControl
                        visible={shouldOfferSaveCustomerAddress(
                          selectedCustomerId,
                          pickupAddress.address,
                          savedCustomerAddresses
                        )}
                        address={pickupAddress.address}
                        pending={pendingPickupAddress}
                        onConfirm={onConfirmPendingPickupAddress}
                        onClear={onClearPendingPickupAddress}
                        disabled={saveAddressDisabled}
                      />
                    ) : null
                  }
                  isMobile={isMobileSized}
                  savedAddresses={savedCustomerAddresses}
                  narrowColumn={isNarrow && !isMobileSized}
                  storageYardConfirm={pickupYardConfirm}
                />
              </div>
            }
            destination={
              <div>
                <RouteAddressFieldLabel tone="destination" required>
                  יעד
                </RouteAddressFieldLabel>
                <AddressInput
                  hideLabel
                  value={dropoffAddress}
                  onChange={onDropoffAddressChange}
                  placeholder="הזן כתובת יעד..."
                  required
                  onPinDropClick={() => onPinDropClick('dropoff')}
                  extraActions={
                    addressSaveEnabled &&
                    onConfirmPendingDropoffAddress &&
                    onClearPendingDropoffAddress ? (
                      <SaveCustomerAddressControl
                        visible={shouldOfferSaveCustomerAddress(
                          selectedCustomerId,
                          dropoffAddress.address,
                          savedCustomerAddresses
                        )}
                        address={dropoffAddress.address}
                        pending={pendingDropoffAddress}
                        onConfirm={onConfirmPendingDropoffAddress}
                        onClear={onClearPendingDropoffAddress}
                        disabled={saveAddressDisabled}
                      />
                    ) : null
                  }
                  isMobile={isMobileSized}
                  savedAddresses={savedCustomerAddresses}
                  narrowColumn={isNarrow && !isMobileSized}
                  storageYardConfirm={dropoffYardConfirm}
                />
              </div>
            }
            underDestination={
              onDropoffToStorageChange ? (
                <DropToStorageToggle
                  active={dropoffToStorage}
                  onClick={() => {
                    const next = !dropoffToStorage
                    onDropoffToStorageChange(next)
                    if (next && storageAddress) {
                      onDropoffAddressChange({
                        address: storageAddress,
                        isPinDropped: false,
                      })
                    }
                  }}
                />
              ) : null
            }
          />
        </div>
      )}

      <RouteAddressesFooter
        distance={
          distanceLoading || baseToPickupLoading ? (
            <span className="inline-flex items-center gap-2 text-gt-text-tertiary">
              <Loader2 size={14} className="animate-spin" />
              מחשב מרחק...
            </span>
          ) : totalDistance ? (
            <>
              מרחק {Number(totalDistance.distanceKm).toFixed(1)} ק״מ
              <span className="mx-1.5 text-gt-text-tertiary">•</span>
              {totalDistance.durationMinutes} דק׳
            </>
          ) : (
            <>מרחק 0.0 ק״מ</>
          )
        }
        surcharges={
          <SurchargesSection
            locationSurchargesData={locationSurchargesData}
            selectedLocationSurcharges={selectedLocationSurcharges}
            onLocationSurchargesChange={onLocationSurchargesChange}
            services={serviceSurchargesData}
            selectedServices={selectedServices}
            onSelectedServicesChange={onSelectedServicesChange}
            manualSurcharges={manualSurcharges}
            onManualSurchargesChange={onManualSurchargesChange}
          />
        }
        showStartFromBase={!!basePriceList?.base_address}
        startFromBase={startFromBase}
        onStartFromBaseChange={onStartFromBaseChange}
      />

      {/* תוספות זמן - אוטומטיות (דסקטופ בלבד; במובייל יוצגו בסעיף תוספות זמן/מחיר בעתיד) */}
      {!isMobile && activeTimeSurcharges.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
          <span className="text-xs text-orange-700">🕐</span>
          {activeTimeSurcharges.map(s => (
            <span key={s.id} className="px-2 py-0.5 bg-orange-500 text-white rounded-full text-xs">
              {s.label} (+{s.surcharge_percent}%)
            </span>
          ))}
        </div>
      )}

      {/* דסקטופ - כפתור חג */}
      <div className="hidden sm:flex items-center gap-3">
        <button
          type="button"
          onClick={() => onIsHolidayChange(!isHoliday)}
          className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
            isHoliday ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🎉 {isHoliday ? 'חג (פעיל)' : 'סמן כחג'}
        </button>
        {isHoliday && (
          <span className="text-xs text-red-600">תוספת חג תחושב אוטומטית</span>
        )}
      </div>
    </>
  )

  if (isMobile) {
    return (
      <>
        <FormCard icon={Car} title="פרטי רכב">
          <div className="space-y-4">{renderVehicleFields()}</div>
        </FormCard>
        <FormCard icon={MapPin} title="מסלול">
          <div className="space-y-3">{renderRouteFields()}</div>
        </FormCard>
      </>
    )
  }

  // Bare section rendering (no numbered card chrome) for the column layout split.
  if (renderSection === 'vehicle') {
    return <div className="space-y-4">{renderVehicleFields()}</div>
  }
  if (renderSection === 'route') {
    return <div className="space-y-4">{renderRouteFields()}</div>
  }

  return (
    <>
      {/* סעיף 3 - פרטי רכב */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
            <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">3</span>
            פרטי רכב
          </h2>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          {renderVehicleFields()}
        </div>
      </div>

      {/* סעיף 4 - מסלול */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
            <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">4</span>
            מסלול
          </h2>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          {renderRouteFields()}
        </div>
      </div>
    </>
  )
}