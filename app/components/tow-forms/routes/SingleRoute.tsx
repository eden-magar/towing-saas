'use client'


import { VehicleLookup, DefectSelector, StartFromBase, TowTruckTypeSelector, ServiceSurchargeSelector, SelectedService } from '../shared'
import { Loader2, Navigation, Package } from 'lucide-react'
import { AddressInput, AddressData } from './AddressInput'
import { VehicleType, VehicleLookupResult } from '../../../lib/types'
import { LocationSurcharge, ServiceSurcharge, TimeSurcharge } from '../../../lib/queries/price-lists'
import { StoredVehicleWithCustomer } from '../../../lib/queries/storage'

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
  selectedDefects: string[]
  onDefectsChange: (defects: string[]) => void
  
  // כתובות
  pickupAddress: AddressData
  onPickupAddressChange: (address: AddressData) => void
  dropoffAddress: AddressData
  onDropoffAddressChange: (address: AddressData) => void
  onPinDropClick: (field: 'pickup' | 'dropoff') => void
  
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
  selectedDefects,
  onDefectsChange,
  
  // כתובות
  pickupAddress,
  onPickupAddressChange,
  dropoffAddress,
  onDropoffAddressChange,
  onPinDropClick,
  
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
                {customerStoredVehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => onSelectStoredVehicle?.(vehicle)}
                    className="px-3 py-2 bg-white border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors text-sm flex items-center gap-2"
                  >
                    <Package size={14} className="text-purple-500" />
                    <span className="font-medium text-gray-800">{vehicle.plate_number}</span>
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
          />
          
          <DefectSelector
            selectedDefects={selectedDefects}
            onChange={onDefectsChange}
          />

          {/* שירותים נוספים - לפני סוג גרר */}
          <ServiceSurchargeSelector
            services={serviceSurchargesData}
            selectedServices={selectedServices}
            onChange={onSelectedServicesChange}
          />

          <div 
            ref={truckTypeSectionRef}
            className={`rounded-xl transition-all ${truckTypeError ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
          >
            <TowTruckTypeSelector
              selectedTypes={requiredTruckTypes}
              onChange={onRequiredTruckTypesChange}
            />
            {truckTypeError && (
              <p className="text-red-500 text-sm mt-2 font-medium">⚠️ יש לבחור סוג גרר נדרש</p>
            )}
          </div>
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
           {/* כתובות */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full mt-9 flex-shrink-0"></div>
              <div className="flex-1">
                <AddressInput
                  label="מוצא"
                  value={pickupAddress}
                  onChange={onPickupAddressChange}
                  placeholder="הזן כתובת איסוף..."
                  required
                  onPinDropClick={() => onPinDropClick('pickup')}
                />
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full mt-9 flex-shrink-0"></div>
              <div className="flex-1">
                <AddressInput
                  label="יעד"
                  value={dropoffAddress}
                  onChange={onDropoffAddressChange}
                  placeholder="הזן כתובת יעד..."
                  required
                  onPinDropClick={() => onPinDropClick('dropoff')}
                />
              </div>
            </div>
          </div>

          {/* צ'קבוקסים - אחסנה + יציאה מהבסיס */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* יעד לאחסנה */}
            {onDropoffToStorageChange && (
              <label className="flex items-center gap-2 cursor-pointer p-2 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
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
                <span className="text-xs font-medium text-gray-700">היעד הוא לאחסנה</span>
              </label>
            )}

            {/* יציאה מהבסיס */}
            {basePriceList?.base_address && (
              <label className="flex items-center gap-2 cursor-pointer p-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                <input
                  type="checkbox"
                  checked={startFromBase}
                  onChange={(e) => onStartFromBaseChange(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-base">🏠</span>
                <span className="text-xs font-medium text-gray-700">יציאה מהבסיס</span>
              </label>
            )}
          </div>

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
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-blue-100/50 border-b border-blue-200 flex items-center gap-2">
                <Navigation size={16} className="text-blue-600" />
                <span className="font-medium text-blue-800 text-sm">מידע מסלול</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-gray-800">
                      {totalDistance.distanceKm}
                      <span className="text-sm font-normal text-gray-500 mr-1">ק״מ</span>
                    </div>
                    <div className="text-xs text-gray-500">מרחק</div>
                  </div>
                  <div className="text-center sm:border-x border-blue-200">
                    <div className="text-xl sm:text-2xl font-bold text-gray-800">
                      {totalDistance.durationMinutes}
                      <span className="text-sm font-normal text-gray-500 mr-1">דק׳</span>
                    </div>
                    <div className="text-xs text-gray-500">זמן נסיעה</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-emerald-600">
                      ₪{Math.round((basePriceList?.[`base_price_${vehicleType || 'private'}`] || 180) + totalDistance.distanceKm * (basePriceList?.price_per_km || 12))}
                    </div>
                    <div className="text-xs text-gray-500">מחיר משוער</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* תוספות זמן - אוטומטיות */}
          {activeTimeSurcharges.length > 0 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <p className="text-sm font-medium text-orange-800 mb-2">🕐 תוספות זמן פעילות:</p>
              <div className="flex flex-wrap gap-2">
                {activeTimeSurcharges.map(s => (
                  <span key={s.id} className="px-3 py-1 bg-orange-500 text-white rounded-full text-sm">
                    {s.label} (+{s.surcharge_percent}%)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* כפתור חג */}
          <div className="flex items-center gap-3">
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

          {/* תוספות מיקום */}
          {locationSurchargesData.filter(l => l.is_active).length > 0 && (
            <div>
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
        </div>
      </div>
    </>
  )
}