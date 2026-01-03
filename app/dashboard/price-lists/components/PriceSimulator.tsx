'use client'

import { useState } from 'react'
import { Calculator } from 'lucide-react'

interface VehiclePrice {
  id: string
  label: string
  price: number
}

interface TimeSurcharge {
  name: string
  label: string
  surcharge_percent: number
  is_active: boolean
}

interface CustomerPriceList {
  id: string
  name: string
  discount_percent: number
}

interface PriceSimulatorProps {
  vehiclePrices: VehiclePrice[]
  timeSurcharges: TimeSurcharge[]
  customers: CustomerPriceList[]
  pricePerKm: number
  minimumPrice: number
}

export function PriceSimulator({
  vehiclePrices,
  timeSurcharges,
  customers,
  pricePerKm,
  minimumPrice
}: PriceSimulatorProps) {
  const [vehicleType, setVehicleType] = useState('private')
  const [distance, setDistance] = useState(25)
  const [time, setTime] = useState('regular')
  const [customer, setCustomer] = useState('regular')

  const calculate = () => {
    const basePrice = vehiclePrices.find(v => v.id === vehicleType)?.price || 180
    const distancePrice = distance * pricePerKm
    let total = basePrice + distancePrice

    const timeItem = timeSurcharges.find(t => t.name === time)
    if (timeItem && timeItem.is_active) {
      total *= (1 + timeItem.surcharge_percent / 100)
    }

    if (customer !== 'regular') {
      const customerItem = customers.find(c => c.id === customer)
      if (customerItem) {
        total *= (1 - customerItem.discount_percent / 100)
      }
    }

    return Math.max(total, minimumPrice)
  }

  const simulatedPrice = calculate()
  const basePrice = vehiclePrices.find(v => v.id === vehicleType)?.price || 180
  const distancePrice = distance * pricePerKm

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator size={20} className="text-gray-600" />
        <h3 className="font-bold text-gray-800">סימולטור מחירים</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">סוג רכב</label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
          >
            {vehiclePrices.map(v => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">מרחק (ק״מ)</label>
          <input
            type="number"
            value={distance}
            onChange={(e) => setDistance(Number(e.target.value))}
            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
          />
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">זמן</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
          >
            <option value="regular">רגיל</option>
            {timeSurcharges.filter(t => t.is_active).map(t => (
              <option key={t.name} value={t.name}>{t.label} (+{t.surcharge_percent}%)</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">לקוח</label>
          <select
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
          >
            <option value="regular">לקוח רגיל</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name} (-{c.discount_percent}%)</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">מחיר משוער:</span>
          <span className="text-3xl font-bold">₪{Math.round(simulatedPrice)}</span>
        </div>
        <div className="space-y-1 text-sm text-gray-400">
          <div className="flex justify-between">
            <span>בסיס ({vehiclePrices.find(v => v.id === vehicleType)?.label})</span>
            <span>₪{basePrice}</span>
          </div>
          <div className="flex justify-between">
            <span>מרחק ({distance} ק״מ × ₪{pricePerKm})</span>
            <span>₪{distancePrice}</span>
          </div>
          {time !== 'regular' && (
            <div className="flex justify-between text-amber-400">
              <span>תוספת {timeSurcharges.find(t => t.name === time)?.label}</span>
              <span>+{timeSurcharges.find(t => t.name === time)?.surcharge_percent}%</span>
            </div>
          )}
          {customer !== 'regular' && (
            <div className="flex justify-between text-emerald-400">
              <span>הנחת לקוח</span>
              <span>-{customers.find(c => c.id === customer)?.discount_percent}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}