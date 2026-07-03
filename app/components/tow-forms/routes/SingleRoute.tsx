'use client'

import { VehicleLookup, DefectSelector, StartFromBase, TowTruckTypeSelector, ServiceSurchargeSelector, LocationSurchargeSelector, SelectedService } from '../shared'
import { Loader2, Navigation, Package, Car, MapPin, Home, Plus, X, ChevronUp, ChevronDown } from 'lucide-react'
import { AddressInput, AddressData } from './AddressInput'
import { VehicleType, VehicleLookupResult } from '../../../lib/types'
import { LocationSurcharge, ServiceSurcharge, TimeSurcharge } from '../../../lib/queries/price-lists'
import { type ManualSurcharge } from '../../../lib/utils/manual-surcharge'
import { type RouteStop } from '../../../hooks/useTowForm'
import {
  isPickableStoredVehicle,
  StoredVehicleWithCustomer,
} from '../../../lib/queries/storage'
import { FormCard } from '../../ui'

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
}: SingleRouteProps) {
  const toggleLocationSurcharge = (id: string) => {
    if (selectedLocationSurcharges.includes(id)) {
      onLocationSurchargesChange(selectedLocationSurcharges.filter(i => i !== id))
    } else {
      onLocationSurchargesChange([...selectedLocationSurcharges, id])
    }
  }

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
                    ? 'px-3 min-h-[44px] bg-white border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors text-sm flex items-center gap-2'
                    : 'px-3 py-2 bg-white border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors text-sm flex items-center gap-2'
                }
              >
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
        isMobile={isMobile}
      />

      {isMobile ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <DefectSelector
              selectedDefects={selectedDefects}
              onChange={onDefectsChange}
              isMobile
            />
            <div
              ref={truckTypeSectionRef}
              className={truckTypeError ? 'rounded-xl ring-2 ring-red-500 ring-offset-2' : ''}
            >
              <TowTruckTypeSelector
                selectedTypes={requiredTruckTypes}
                onChange={onRequiredTruckTypesChange}
                isMobile
              />
            </div>
          </div>
          {truckTypeError && (
            <p className="text-red-500 text-sm mt-2 font-medium">⚠️ יש לבחור סוג גרר נדרש</p>
          )}
        </>
      ) : (
        <>
          <DefectSelector
            selectedDefects={selectedDefects}
            onChange={onDefectsChange}
            isMobile={isMobile}
          />

          {/* שירותים נוספים - לפני סוג גרר */}
          <ServiceSurchargeSelector
            services={serviceSurchargesData}
            selectedServices={selectedServices}
            onChange={onSelectedServicesChange}
            isMobile={isMobile}
          />

          <div
            ref={truckTypeSectionRef}
            className={`rounded-xl transition-all ${truckTypeError ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
          >
            <TowTruckTypeSelector
              selectedTypes={requiredTruckTypes}
              onChange={onRequiredTruckTypesChange}
              isMobile={isMobile}
            />
            {truckTypeError && (
              <p className="text-red-500 text-sm mt-2 font-medium">⚠️ יש לבחור סוג גרר נדרש</p>
            )}
          </div>
        </>
      )}
    </>
  )

  const renderRouteFields = () => (
    <>
       {/* כתובות */}
      {isMobile ? (
        <div className="space-y-2">
          {/* מוצא - בלוק מקובץ */}
          <div className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <MapPin size={16} className="text-emerald-500 shrink-0" />
                מוצא <span className="text-red-500">*</span>
              </span>
              {basePriceList?.base_address && (
                <button
                  type="button"
                  onClick={() => onStartFromBaseChange(!startFromBase)}
                  aria-pressed={startFromBase}
                  className={
                    startFromBase
                      ? 'shrink-0 inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full border border-blue-300 bg-blue-50 text-blue-700 text-xs font-medium transition-colors'
                      : 'shrink-0 inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-xs font-medium transition-colors'
                  }
                >
                  <Home size={16} />
                  מהבסיס
                </button>
              )}
            </div>
            <AddressInput
              hideLabel
              value={pickupAddress}
              onChange={onPickupAddressChange}
              placeholder="הזן כתובת איסוף..."
              required
              onPinDropClick={() => onPinDropClick('pickup')}
              isMobile
            />
          </div>
          {routeStops
            .map((stop, index) => ({ stop, index }))
            .filter(({ stop }) => stop.role === 'stop')
            .map(({ stop, index: stopIndex }) => {
              const fullIndex = routeStops.findIndex((s) => s.id === stop.id)
              return (
                <div key={stop.id} className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                      <MapPin size={16} className="text-blue-500 shrink-0" />
                      עצירה {stopIndex + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveStopUp(stop.id)}
                        disabled={fullIndex <= 0}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
                        aria-label="הזז למעלה"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStopDown(stop.id)}
                        disabled={fullIndex < 0 || fullIndex >= routeStops.length - 1}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
                        aria-label="הזז למטה"
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStop(stop.id)}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-red-500"
                        aria-label="הסר עצירה"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <AddressInput
                    hideLabel
                    value={stop.address}
                    onChange={(addr: AddressData) => updateStop(stop.id, { address: addr })}
                    placeholder="הזן כתובת עצירה..."
                    onPinDropClick={() => onPinDropClick(`routestop:${stop.id}`)}
                    isMobile
                  />
                </div>
              )
            })}
          {/* הוסף נקודת עצירה - קישור משני, ממוקם לפני היעד (עצירות נוספות באמצע המסלול) */}
          <div className="border-t border-gray-100 pt-2 mt-1">
            <button
              type="button"
              onClick={addStop}
              className="inline-flex items-center gap-1 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:underline underline-offset-2 transition-colors"
            >
              <Plus size={14} className="shrink-0" />
              הוסף נקודת עצירה
            </button>
          </div>
          {/* יעד - בלוק מקובץ */}
          <div className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <MapPin size={16} className="text-red-500 shrink-0" />
                יעד <span className="text-red-500">*</span>
              </span>
              {onDropoffToStorageChange && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !dropoffToStorage
                    onDropoffToStorageChange(next)
                    if (next && storageAddress) {
                      onDropoffAddressChange({
                        address: storageAddress,
                        isPinDropped: false
                      })
                    }
                  }}
                  aria-pressed={dropoffToStorage}
                  className={
                    dropoffToStorage
                      ? 'shrink-0 inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full border border-purple-300 bg-purple-50 text-purple-700 text-xs font-medium transition-colors'
                      : 'shrink-0 inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-xs font-medium transition-colors'
                  }
                >
                  <Package size={16} />
                  לאחסנה
                </button>
              )}
            </div>
            <AddressInput
              hideLabel
              value={dropoffAddress}
              onChange={onDropoffAddressChange}
              placeholder="הזן כתובת יעד..."
              required
              onPinDropClick={() => onPinDropClick('dropoff')}
              isMobile
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full flex-shrink-0 mt-9"></div>
            <div className="flex-1">
              <AddressInput
                label="מוצא"
                value={pickupAddress}
                onChange={onPickupAddressChange}
                placeholder="הזן כתובת איסוף..."
                required
                onPinDropClick={() => onPinDropClick('pickup')}
                isMobile={isMobile}
              />
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0 mt-9"></div>
            <div className="flex-1">
              <AddressInput
                label="יעד"
                value={dropoffAddress}
                onChange={onDropoffAddressChange}
                placeholder="הזן כתובת יעד..."
                required
                onPinDropClick={() => onPinDropClick('dropoff')}
                isMobile={isMobile}
              />
            </div>
          </div>
        </div>
      )}

      {/* צ'קבוקסים - אחסנה + יציאה מהבסיס (דסקטופ בלבד; במובייל הומרו לכפתורים ליד הכתובות) */}
      {!isMobile && (
        <div className="grid grid-cols-2 gap-2">
          {/* יעד לאחסנה */}
          {onDropoffToStorageChange && (
            <label className="flex items-center gap-2 cursor-pointer bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors p-2">
              <input
                type="checkbox"
                checked={dropoffToStorage}
                onChange={(e) => {
                  onDropoffToStorageChange(e.target.checked)
                  if (e.target.checked && storageAddress) {
                    onDropoffAddressChange({
                      address: storageAddress,
                      isPinDropped: false
                    })
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <Package size={16} className="text-purple-600" />
              <span className="text-xs font-medium text-gray-700">לאחסנה</span>
            </label>
          )}

          {/* יציאה מהבסיס */}
          {basePriceList?.base_address && (
            <label className="flex items-center gap-2 cursor-pointer bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors p-2">
              <input
                type="checkbox"
                checked={startFromBase}
                onChange={(e) => onStartFromBaseChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-base">🏠</span>
              <span className="text-xs font-medium text-gray-700">מהבסיס</span>
            </label>
          )}
        </div>
      )}

      {/* תצוגת מרחק */}
      {(distanceLoading || baseToPickupLoading) && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">מחשב מרחק...</span>
          </div>
        </div>
      )}

      {!distanceLoading && !baseToPickupLoading && totalDistance && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <Navigation size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-sm text-blue-800">
            <span className="font-bold">{totalDistance.distanceKm}</span> ק״מ
            <span className="mx-2">•</span>
            <span className="font-bold">{totalDistance.durationMinutes}</span> דק׳
          </span>
        </div>
      )}

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
      {/* מובייל: אריחים - שירותים + מיקום */}
      {isMobile && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">תוספות למסלול</p>
          <div className="grid grid-cols-2 gap-2">
            <ServiceSurchargeSelector
              services={serviceSurchargesData}
              selectedServices={selectedServices}
              onChange={onSelectedServicesChange}
              manualSurcharges={manualSurcharges}
              onManualSurchargesChange={onManualSurchargesChange}
              isMobile
            />
            <LocationSurchargeSelector
              locationSurcharges={locationSurchargesData}
              selectedLocationSurcharges={selectedLocationSurcharges}
              onChange={onLocationSurchargesChange}
              isMobile
            />
          </div>
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

      {/* דסקטופ - תוספות מיקום */}
      {locationSurchargesData.filter(l => l.is_active).length > 0 && (
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-gray-700 mb-2">📍 תוספות מיקום:</p>
          <div className="flex flex-wrap gap-2">
            {locationSurchargesData.filter(l => l.is_active).map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleLocationSurcharge(s.id)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  selectedLocationSurcharges.includes(s.id)
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.label} (+{s.surcharge_percent}%)
              </button>
            ))}
          </div>
        </div>
      )}
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