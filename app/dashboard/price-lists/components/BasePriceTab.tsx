'use client'

import { Info, Home, MapPin } from 'lucide-react'
import AddressInput from '../../../components/address/AddressInput'

interface BaseLocationData {
  address: string
  placeId?: string
  lat?: number
  lng?: number
}

interface VehiclePrice {
  id: string
  label: string
  field: string
  price: number
}

interface BasePriceTabProps {
  // נקודת בסיס
  baseLocation: BaseLocationData
  onBaseLocationChange: (data: BaseLocationData) => void
  // מחירי רכב
  vehiclePrices: VehiclePrice[]
  onVehiclePriceChange: (id: string, price: number) => void
  // תעריף מרחק
  pricePerKm: number
  onPricePerKmChange: (price: number) => void
  minimumPrice: number
  onMinimumPriceChange: (price: number) => void
}

export function BasePriceTab({
  baseLocation,
  onBaseLocationChange,
  vehiclePrices,
  onVehiclePriceChange,
  pricePerKm,
  onPricePerKmChange,
  minimumPrice,
  onMinimumPriceChange
}: BasePriceTabProps) {
  return (
    <div className="space-y-6">
      {/* נקודת בסיס */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Home size={20} className="text-emerald-600" />
          <h3 className="font-bold text-gray-800">נקודת בסיס</h3>
        </div>
        
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-700">
              כתובת המוצא של הגררים. כש"יציאה מהבסיס" מסומן, המרחק מחושב: 
              <span className="font-medium"> (בסיס → מוצא) + (מוצא → יעד)</span>
            </p>
          </div>
        </div>

        <AddressInput
          value={baseLocation}
          onChange={onBaseLocationChange}
          placeholder="כתובת הבסיס..."
        />
        
        {baseLocation.lat && baseLocation.lng && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
            <MapPin size={14} className="text-emerald-500" />
            <span>{baseLocation.lat.toFixed(5)}, {baseLocation.lng.toFixed(5)}</span>
          </div>
        )}
      </div>

      {/* מחיר לפי סוג רכב */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4">מחיר בסיס לפי סוג רכב</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {vehiclePrices.map((item) => (
            <div key={item.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <label className="block text-sm text-gray-600 mb-1">{item.label}</label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) => onVehiclePriceChange(item.id, Number(e.target.value))}
                  className="w-full pr-8 pl-2 py-2 border border-gray-200 rounded-lg text-left font-medium focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* תעריף מרחק */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4">תעריף מרחק</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <label className="block text-sm text-gray-600 mb-1">מחיר לקילומטר</label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
              <input
                type="number"
                value={pricePerKm}
                onChange={(e) => onPricePerKmChange(Number(e.target.value))}
                className="w-full pr-8 pl-2 py-2 border border-gray-200 rounded-lg text-left font-medium focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              />
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <label className="block text-sm text-gray-600 mb-1">מחיר מינימום</label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
              <input
                type="number"
                value={minimumPrice}
                onChange={(e) => onMinimumPriceChange(Number(e.target.value))}
                className="w-full pr-8 pl-2 py-2 border border-gray-200 rounded-lg text-left font-medium focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              />
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-4">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              <span className="font-medium">נוסחה:</span> מחיר בסיס + (מרחק × מחיר לק"מ). 
              אם התוצאה נמוכה ממינימום - ייגבה מחיר מינימום.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}