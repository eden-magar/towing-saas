'use client'

import { useState } from 'react'
import { Plus, X, Package, Loader2, Navigation } from 'lucide-react'
import { AddressInput, AddressData } from './AddressInput'
import { 
  VehicleLookup, 
  DefectSelector, 
  TowTruckTypeSelector, 
  ServiceSurchargeSelector, 
  SelectedService,
  StartFromBase
} from '../shared'
import { VehicleType, VehicleLookupResult } from '../../../lib/types'
import { StoredVehicleWithCustomer } from '../../../lib/queries/storage'
import { LocationSurcharge, ServiceSurcharge, TimeSurcharge } from '../../../lib/queries/price-lists'

interface RouteStop {
  id: string
  address: AddressData
  contactName: string
  contactPhone: string
  notes: string
}

interface DistanceResult {
  distanceKm: number
  durationMinutes: number
}

interface ExchangeRouteProps {
  // Customer info (for copy button)
  customerName: string
  customerPhone: string
  
  // Working vehicle (תקין)
  workingVehicleSource: 'storage' | 'address'
  onWorkingVehicleSourceChange: (source: 'storage' | 'address') => void
  customerStoredVehicles: StoredVehicleWithCustomer[]
  selectedWorkingVehicleId: string | null
  onSelectWorkingVehicle: (vehicle: StoredVehicleWithCustomer) => void
  onClearWorkingVehicle: () => void
  workingVehicleAddress: AddressData
  onWorkingVehicleAddressChange: (address: AddressData) => void
  workingVehicleContact: string
  onWorkingVehicleContactChange: (name: string) => void
  workingVehicleContactPhone: string
  onWorkingVehicleContactPhoneChange: (phone: string) => void
  workingVehiclePlate: string
  onWorkingVehiclePlateChange: (plate: string) => void
  workingVehicleData: VehicleLookupResult | null
  onWorkingVehicleDataChange: (data: VehicleLookupResult | null) => void
  workingVehicleType: VehicleType | ''
  onWorkingVehicleTypeChange: (type: VehicleType | '') => void
  workingVehicleCode: string
  onWorkingVehicleCodeChange: (code: string) => void
  storageLoading: boolean
  
  // Exchange point (נקודת החלפה)
  exchangeAddress: AddressData
  onExchangeAddressChange: (address: AddressData) => void
  exchangeContactName: string
  onExchangeContactNameChange: (name: string) => void
  exchangeContactPhone: string
  onExchangeContactPhoneChange: (phone: string) => void
  
  // Defective vehicle (תקול)
  defectiveVehiclePlate: string
  onDefectiveVehiclePlateChange: (plate: string) => void
  defectiveVehicleData: VehicleLookupResult | null
  onDefectiveVehicleDataChange: (data: VehicleLookupResult | null) => void
  defectiveVehicleType: VehicleType | ''
  onDefectiveVehicleTypeChange: (type: VehicleType | '') => void
  defectiveVehicleCode: string
  onDefectiveVehicleCodeChange: (code: string) => void
  selectedDefects: string[]
  onDefectsChange: (defects: string[]) => void
  defectiveDestination: 'storage' | 'address'
  onDefectiveDestinationChange: (dest: 'storage' | 'address') => void
  defectiveDestinationAddress: AddressData
  onDefectiveDestinationAddressChange: (address: AddressData) => void
  defectiveDestinationContact: string
  onDefectiveDestinationContactChange: (name: string) => void
  defectiveDestinationContactPhone: string
  onDefectiveDestinationContactPhoneChange: (phone: string) => void
  
  // Route stops (עצירות)
  stopsBeforeExchange: RouteStop[]
  onStopsBeforeExchangeChange: (stops: RouteStop[]) => void
  stopsAfterExchange: RouteStop[]
  onStopsAfterExchangeChange: (stops: RouteStop[]) => void
  
  // Services & Truck type
  serviceSurchargesData: ServiceSurcharge[]
  selectedServices: SelectedService[]
  onSelectedServicesChange: (services: SelectedService[]) => void
  requiredTruckTypes: string[]
  onRequiredTruckTypesChange: (types: string[]) => void
  truckTypeSectionRef: React.RefObject<HTMLDivElement | null>
  truckTypeError: boolean
  
  // Base & Distance
  basePriceList: Record<string, any> | null
  startFromBase: boolean
  onStartFromBaseChange: (checked: boolean) => void
  totalDistance: DistanceResult | null
  distanceLoading: boolean
  
  // Time surcharges
  activeTimeSurcharges: TimeSurcharge[]
  isHoliday: boolean
  onIsHolidayChange: (isHoliday: boolean) => void
  locationSurchargesData: LocationSurcharge[]
  selectedLocationSurcharges: string[]
  onLocationSurchargesChange: (ids: string[]) => void
  
  // Pin drop
  onPinDropClick: (field: string) => void
  
  // Storage address
  storageAddress: string
}

export function ExchangeRoute({
  customerName,
  customerPhone,
  workingVehicleSource,
  onWorkingVehicleSourceChange,
  customerStoredVehicles,
  selectedWorkingVehicleId,
  onSelectWorkingVehicle,
  onClearWorkingVehicle,
  workingVehicleAddress,
  onWorkingVehicleAddressChange,
  workingVehicleContact,
  onWorkingVehicleContactChange,
  workingVehicleContactPhone,
  onWorkingVehicleContactPhoneChange,
  workingVehiclePlate,
  onWorkingVehiclePlateChange,
  workingVehicleData,
  onWorkingVehicleDataChange,
  workingVehicleType,
  onWorkingVehicleTypeChange,
  workingVehicleCode,
  onWorkingVehicleCodeChange,
  storageLoading,
  exchangeAddress,
  onExchangeAddressChange,
  exchangeContactName,
  onExchangeContactNameChange,
  exchangeContactPhone,
  onExchangeContactPhoneChange,
  defectiveVehiclePlate,
  onDefectiveVehiclePlateChange,
  defectiveVehicleData,
  onDefectiveVehicleDataChange,
  defectiveVehicleType,
  onDefectiveVehicleTypeChange,
  defectiveVehicleCode,
  onDefectiveVehicleCodeChange,
  selectedDefects,
  onDefectsChange,
  defectiveDestination,
  onDefectiveDestinationChange,
  defectiveDestinationAddress,
  onDefectiveDestinationAddressChange,
  defectiveDestinationContact,
  onDefectiveDestinationContactChange,
  defectiveDestinationContactPhone,
  onDefectiveDestinationContactPhoneChange,
  stopsBeforeExchange,
  onStopsBeforeExchangeChange,
  stopsAfterExchange,
  onStopsAfterExchangeChange,
  serviceSurchargesData,
  selectedServices,
  onSelectedServicesChange,
  requiredTruckTypes,
  onRequiredTruckTypesChange,
  truckTypeSectionRef,
  truckTypeError,
  basePriceList,
  startFromBase,
  onStartFromBaseChange,
  totalDistance,
  distanceLoading,
  activeTimeSurcharges,
  isHoliday,
  onIsHolidayChange,
  locationSurchargesData,
  selectedLocationSurcharges,
  onLocationSurchargesChange,
  onPinDropClick,
  storageAddress
}: ExchangeRouteProps) {

  // Helper to copy customer info
  const copyFromCustomer = (setter: (name: string) => void, phoneSetter: (phone: string) => void) => {
    setter(customerName)
    phoneSetter(customerPhone)
  }

  // Add stop helper
  const addStop = (type: 'before' | 'after') => {
    const newStop: RouteStop = {
      id: `stop-${Date.now()}`,
      address: { address: '' },
      contactName: '',
      contactPhone: '',
      notes: ''
    }
    if (type === 'before') {
      onStopsBeforeExchangeChange([...stopsBeforeExchange, newStop])
    } else {
      onStopsAfterExchangeChange([...stopsAfterExchange, newStop])
    }
  }

  // Remove stop helper
  const removeStop = (type: 'before' | 'after', id: string) => {
    if (type === 'before') {
      onStopsBeforeExchangeChange(stopsBeforeExchange.filter(s => s.id !== id))
    } else {
      onStopsAfterExchangeChange(stopsAfterExchange.filter(s => s.id !== id))
    }
  }

  // Update stop helper
  const updateStop = (type: 'before' | 'after', id: string, field: keyof RouteStop, value: any) => {
    const updateFn = (stops: RouteStop[]) => 
      stops.map(s => s.id === id ? { ...s, [field]: value } : s)
    
    if (type === 'before') {
      onStopsBeforeExchangeChange(updateFn(stopsBeforeExchange))
    } else {
      onStopsAfterExchangeChange(updateFn(stopsAfterExchange))
    }
  }

  // Get selected working vehicle details
  const selectedWorkingVehicle = customerStoredVehicles.find(v => v.id === selectedWorkingVehicleId)

  const toggleLocationSurcharge = (id: string) => {
    if (selectedLocationSurcharges.includes(id)) {
      onLocationSurchargesChange(selectedLocationSurcharges.filter(i => i !== id))
    } else {
      onLocationSurchargesChange([...selectedLocationSurcharges, id])
    }
  }

  return (
    <>
      {/* סעיף 3 - פרטי הרכבים */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
            <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">3</span>
            פרטי הרכבים
          </h2>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* ===== הרכב התקין ===== */}
          <div className="border border-green-200 rounded-xl overflow-hidden">
            <div className="bg-green-50 px-4 py-3 border-b border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-6 rounded-full bg-green-500"></div>
                <h3 className="font-bold text-gray-800 text-sm sm:text-base">הרכב התקין</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {/* מקור הרכב */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">מקור הרכב</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onWorkingVehicleSourceChange('storage')}
                    className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      workingVehicleSource === 'storage'
                        ? 'bg-blue-50 border-2 border-blue-300 text-blue-700'
                        : 'bg-gray-50 border-2 border-gray-200 text-gray-600'
                    }`}
                  >
                    📦 מאחסנה
                  </button>
                  <button
                    type="button"
                    onClick={() => onWorkingVehicleSourceChange('address')}
                    className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      workingVehicleSource === 'address'
                        ? 'bg-blue-50 border-2 border-blue-300 text-blue-700'
                        : 'bg-gray-50 border-2 border-gray-200 text-gray-600'
                    }`}
                  >
                    📍 מכתובת
                  </button>
                </div>
              </div>

              {/* בחירה מאחסנה */}
              {workingVehicleSource === 'storage' && (
                <>
                  {storageLoading && (
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <Loader2 size={16} className="animate-spin" />
                      בודק רכבים באחסנה...
                    </div>
                  )}

                  {!storageLoading && customerStoredVehicles.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                      אין רכבים באחסנה ללקוח זה
                    </div>
                  )}

                  {!storageLoading && customerStoredVehicles.length > 0 && !selectedWorkingVehicleId && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center gap-2 text-purple-700 mb-3">
                        <Package size={18} />
                        <span className="font-medium text-sm">רכבים באחסנה ({customerStoredVehicles.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {customerStoredVehicles.map((vehicle) => (
                          <button
                            key={vehicle.id}
                            type="button"
                            onClick={() => onSelectWorkingVehicle(vehicle)}
                            className="px-3 py-2 bg-white border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors text-sm flex items-center gap-2"
                          >
                            <span className="font-medium text-gray-800">{vehicle.plate_number}</span>
                            {vehicle.vehicle_data && (
                              <span className="text-xs text-gray-500 hidden sm:inline">
                                {vehicle.vehicle_data.manufacturer} {vehicle.vehicle_data.model}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedWorkingVehicleId && selectedWorkingVehicle && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-green-700 text-sm mb-1">
                            <span>✓</span>
                            <span className="font-medium">נבחר מאחסנה</span>
                          </div>
                          <div className="font-mono text-lg font-bold text-gray-800">{selectedWorkingVehicle.plate_number}</div>
                          {selectedWorkingVehicle.vehicle_data && (
                            <div className="text-sm text-gray-600">
                              {selectedWorkingVehicle.vehicle_data.manufacturer} {selectedWorkingVehicle.vehicle_data.model}
                              {selectedWorkingVehicle.vehicle_data.color && ` • ${selectedWorkingVehicle.vehicle_data.color}`}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={onClearWorkingVehicle}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* בחירה מכתובת */}
              {workingVehicleSource === 'address' && (
                <div className="space-y-3">
                  <AddressInput
                    label="כתובת איסוף"
                    value={workingVehicleAddress}
                    onChange={onWorkingVehicleAddressChange}
                    placeholder="הזן כתובת..."
                    onPinDropClick={() => onPinDropClick('workingVehicleAddress')}
                  />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">איש קשר</label>
                      <button
                        type="button"
                        onClick={() => copyFromCustomer(onWorkingVehicleContactChange, onWorkingVehicleContactPhoneChange)}
                        className="text-xs text-cyan-600 font-medium px-2 py-1 bg-cyan-50 rounded-lg hover:bg-cyan-100"
                      >
                        👤 הלקוח
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={workingVehicleContact}
                        onChange={(e) => onWorkingVehicleContactChange(e.target.value)}
                        placeholder="שם"
                        className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                      <input
                        type="tel"
                        value={workingVehicleContactPhone}
                        onChange={(e) => onWorkingVehicleContactPhoneChange(e.target.value)}
                        placeholder="טלפון"
                        className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                  
                  {/* פרטי הרכב התקין */}
                  <div className="pt-2 border-t border-gray-200">
                    <VehicleLookup
                      plateNumber={workingVehiclePlate}
                      onPlateChange={onWorkingVehiclePlateChange}
                      vehicleData={workingVehicleData}
                      onVehicleDataChange={onWorkingVehicleDataChange}
                      vehicleType={workingVehicleType}
                      onVehicleTypeChange={onWorkingVehicleTypeChange}
                      vehicleCode={workingVehicleCode}
                      onVehicleCodeChange={onWorkingVehicleCodeChange}
                    />
                  </div>
                </div>
              )}


            </div>
          </div>
          {/* ===== הרכב התקול ===== */}
          <div className="border border-red-200 rounded-xl overflow-hidden">
            <div className="bg-red-50 px-4 py-3 border-b border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-6 rounded-full bg-red-500"></div>
                <h3 className="font-bold text-gray-800 text-sm sm:text-base">הרכב התקול</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {/* VehicleLookup */}
              <VehicleLookup
                plateNumber={defectiveVehiclePlate}
                onPlateChange={onDefectiveVehiclePlateChange}
                vehicleData={defectiveVehicleData}
                onVehicleDataChange={onDefectiveVehicleDataChange}
                vehicleType={defectiveVehicleType}
                onVehicleTypeChange={onDefectiveVehicleTypeChange}
                vehicleCode={defectiveVehicleCode}
                onVehicleCodeChange={onDefectiveVehicleCodeChange}
              />

              {/* תקלות */}
              <DefectSelector
                selectedDefects={selectedDefects}
                onChange={onDefectsChange}
              />

              {/* יעד הרכב התקול */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">יעד הרכב התקול</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDefectiveDestinationChange('storage')}
                    className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      defectiveDestination === 'storage'
                        ? 'bg-blue-50 border-2 border-blue-300 text-blue-700'
                        : 'bg-gray-50 border-2 border-gray-200 text-gray-600'
                    }`}
                  >
                    📦 לאחסנה
                  </button>
                  <button
                    type="button"
                    onClick={() => onDefectiveDestinationChange('address')}
                    className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      defectiveDestination === 'address'
                        ? 'bg-blue-50 border-2 border-blue-300 text-blue-700'
                        : 'bg-gray-50 border-2 border-gray-200 text-gray-600'
                    }`}
                  >
                    📍 לכתובת
                  </button>
                </div>
              </div>

              {defectiveDestination === 'storage' && storageAddress && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                  <span className="font-medium">📦 הרכב יורד ב:</span> {storageAddress}
                </div>
              )}

              {defectiveDestination === 'address' && (
                <div className="space-y-3">
                  <AddressInput
                    label="כתובת יעד"
                    value={defectiveDestinationAddress}
                    onChange={onDefectiveDestinationAddressChange}
                    placeholder="הזן כתובת..."
                    onPinDropClick={() => onPinDropClick('defectiveDestinationAddress')}
                  />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">איש קשר</label>
                      <button
                        type="button"
                        onClick={() => copyFromCustomer(onDefectiveDestinationContactChange, onDefectiveDestinationContactPhoneChange)}
                        className="text-xs text-cyan-600 font-medium px-2 py-1 bg-cyan-50 rounded-lg hover:bg-cyan-100"
                      >
                        👤 הלקוח
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={defectiveDestinationContact}
                        onChange={(e) => onDefectiveDestinationContactChange(e.target.value)}
                        placeholder="שם"
                        className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                      <input
                        type="tel"
                        value={defectiveDestinationContactPhone}
                        onChange={(e) => onDefectiveDestinationContactPhoneChange(e.target.value)}
                        placeholder="טלפון"
                        className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* שירותים נוספים */}
          <ServiceSurchargeSelector
            services={serviceSurchargesData}
            selectedServices={selectedServices}
            onChange={onSelectedServicesChange}
          />

          {/* סוג גרר */}
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
        <div className="p-4 sm:p-5 space-y-0">

          {/* נקודה 1: מקור התקין */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">📦</div>
              <div className="w-0.5 h-4 bg-gray-300"></div>
            </div>
            <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-blue-600 font-medium">איסוף תקין</div>
                  <div className="font-medium text-gray-800 text-sm sm:text-base">
                    {workingVehicleSource === 'storage' 
                      ? (storageAddress || 'אחסנה')
                      : (workingVehicleAddress.address || 'לא הוזנה כתובת')
                    }
                  </div>
                </div>
                {selectedWorkingVehicle && (
                  <div className="text-green-600 text-xs sm:text-sm">⬆️ {selectedWorkingVehicle.plate_number}</div>
                )}
              </div>
            </div>
          </div>

          {/* כפתור עצירה לפני ההחלפה */}
          <div className="flex items-center gap-3 py-1">
            <div className="w-8 flex justify-center">
              <div className="w-0.5 h-full bg-gray-300"></div>
            </div>
            <button
              type="button"
              onClick={() => addStop('before')}
              className="flex-1 py-2 border-2 border-dashed border-gray-300 rounded-xl text-xs sm:text-sm text-gray-500 hover:border-cyan-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} /> הוסף עצירה בדרך
            </button>
          </div>

          {/* עצירות לפני ההחלפה */}
          {stopsBeforeExchange.map((stop, index) => (
            <div key={stop.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-2 bg-gray-300"></div>
                <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs">{index + 1}</div>
                <div className="w-0.5 h-2 bg-gray-300"></div>
              </div>
              <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-3 my-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-amber-600 font-medium">עצירה {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeStop('before', stop.id)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  <AddressInput
                    value={stop.address}
                    onChange={(addr: AddressData) => updateStop('before', stop.id, 'address', addr)}
                    placeholder="כתובת..."
                    onPinDropClick={() => onPinDropClick(`stop-before-${stop.id}`)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={stop.contactName}
                      onChange={(e) => updateStop('before', stop.id, 'contactName', e.target.value)}
                      placeholder="איש קשר"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                    <input
                      type="tel"
                      value={stop.contactPhone}
                      onChange={(e) => updateStop('before', stop.id, 'contactPhone', e.target.value)}
                      placeholder="טלפון"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                  <input
                    type="text"
                    value={stop.notes}
                    onChange={(e) => updateStop('before', stop.id, 'notes', e.target.value)}
                    placeholder="הערות..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* נקודה 2: נקודת ההחלפה */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-4 bg-gray-300"></div>
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm">🔄</div>
              <div className="w-0.5 h-4 bg-gray-300"></div>
            </div>
            <div className="flex-1 bg-purple-50 border border-purple-200 rounded-xl p-3 my-2">
              <div className="text-xs text-purple-600 font-medium mb-2">נקודת ההחלפה</div>
              <AddressInput
                value={exchangeAddress}
                onChange={onExchangeAddressChange}
                placeholder="הזן כתובת..."
                onPinDropClick={() => onPinDropClick('exchangeAddress')}
              />
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-600">איש קשר</label>
                  <button
                    type="button"
                    onClick={() => copyFromCustomer(onExchangeContactNameChange, onExchangeContactPhoneChange)}
                    className="text-xs text-cyan-600 font-medium px-2 py-1 bg-cyan-50 rounded-lg hover:bg-cyan-100"
                  >
                    👤 הלקוח
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={exchangeContactName}
                    onChange={(e) => onExchangeContactNameChange(e.target.value)}
                    placeholder="שם"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                  <input
                    type="tel"
                    value={exchangeContactPhone}
                    onChange={(e) => onExchangeContactPhoneChange(e.target.value)}
                    placeholder="טלפון"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-2 text-xs">
                <span className="text-orange-600">⬇️ תקין</span>
                <span className="text-green-600">⬆️ תקול</span>
              </div>
            </div>
          </div>
          {/* כפתור עצירה אחרי ההחלפה */}
          <div className="flex items-center gap-3 py-1">
            <div className="w-8 flex justify-center">
              <div className="w-0.5 h-full bg-gray-300"></div>
            </div>
            <button
              type="button"
              onClick={() => addStop('after')}
              className="flex-1 py-2 border-2 border-dashed border-gray-300 rounded-xl text-xs sm:text-sm text-gray-500 hover:border-cyan-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} /> הוסף עצירה בדרך
            </button>
          </div>

          {/* עצירות אחרי ההחלפה */}
          {stopsAfterExchange.map((stop, index) => (
            <div key={stop.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-2 bg-gray-300"></div>
                <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs">{index + 1}</div>
                <div className="w-0.5 h-2 bg-gray-300"></div>
              </div>
              <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-3 my-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-amber-600 font-medium">עצירה {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeStop('after', stop.id)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  <AddressInput
                    value={stop.address}
                    onChange={(addr: AddressData) => updateStop('after', stop.id, 'address', addr)}
                    placeholder="כתובת..."
                    onPinDropClick={() => onPinDropClick(`stop-after-${stop.id}`)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={stop.contactName}
                      onChange={(e) => updateStop('after', stop.id, 'contactName', e.target.value)}
                      placeholder="איש קשר"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                    <input
                      type="tel"
                      value={stop.contactPhone}
                      onChange={(e) => updateStop('after', stop.id, 'contactPhone', e.target.value)}
                      placeholder="טלפון"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                  <input
                    type="text"
                    value={stop.notes}
                    onChange={(e) => updateStop('after', stop.id, 'notes', e.target.value)}
                    placeholder="הערות..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* נקודה 3: יעד התקול */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-4 bg-gray-300"></div>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">📦</div>
            </div>
            <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-3 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-blue-600 font-medium">הורדה תקול</div>
                  <div className="font-medium text-gray-800 text-sm sm:text-base">
                    {defectiveDestination === 'storage'
                      ? (storageAddress || 'אחסנה')
                      : (defectiveDestinationAddress.address || 'לא הוזנה כתובת')
                    }
                  </div>
                </div>
                <div className="text-orange-600 text-xs sm:text-sm">⬇️ {defectiveVehiclePlate || '---'}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
      {/* סעיף 4 המשך - פרטי מסלול */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
            <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">4</span>
            פרטי מסלול
          </h2>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* יציאה מהבסיס */}
          <StartFromBase
            baseAddress={basePriceList?.base_address}
            checked={startFromBase}
            onChange={onStartFromBaseChange}
            baseToPickupDistance={null}
            isLoading={false}
            hasPickupAddress={true}
          />

          {/* תצוגת מרחק */}
          {distanceLoading && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3 text-gray-500">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">מחשב מרחק...</span>
              </div>
            </div>
          )}

          {!distanceLoading && totalDistance && (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-blue-100/50 border-b border-blue-200 flex items-center gap-2">
                <Navigation size={16} className="text-blue-600" />
                <span className="font-medium text-blue-800 text-sm">מידע מסלול</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-gray-800">
                      {totalDistance.distanceKm}
                      <span className="text-xs sm:text-sm font-normal text-gray-500 mr-1">ק״מ</span>
                    </div>
                    <div className="text-xs text-gray-500">מרחק</div>
                  </div>
                  <div className="text-center border-x border-blue-200">
                    <div className="text-xl sm:text-2xl font-bold text-gray-800">
                      {totalDistance.durationMinutes}
                      <span className="text-xs sm:text-sm font-normal text-gray-500 mr-1">דק׳</span>
                    </div>
                    <div className="text-xs text-gray-500">זמן נסיעה</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-emerald-600">
                      ₪{Math.round((basePriceList?.base_price_private || 180) + totalDistance.distanceKm * (basePriceList?.price_per_km || 12))}
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

