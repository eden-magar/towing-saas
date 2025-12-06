'use client'

import { useState } from 'react'
import { Save, Plus, Trash2, Info, Calculator, Car, Clock, MapPin, Wrench, Building2, X, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'

interface VehiclePrice {
  id: string
  label: string
  price: number
}

interface TimeSurcharge {
  id: string
  label: string
  time: string
  percent: number
  active: boolean
}

interface LocationSurcharge {
  id: string
  label: string
  percent: number
  active: boolean
}

interface ServiceSurcharge {
  id: string
  label: string
  price: number
  active: boolean
}

interface DistanceTier {
  id: string
  from: number
  to: number | null
  pricePerKm: number
}

interface CustomerCustomPrice {
  id: string
  label: string
  price: number
}

interface CustomerPriceList {
  id: number
  name: string
  type: string
  discountPercent: number
  customPrices: CustomerCustomPrice[]
}

export default function PriceListsPage() {
  const [activeTab, setActiveTab] = useState<'base' | 'surcharges' | 'customers'>('base')
  const [hasChanges, setHasChanges] = useState(false)
  const [showTieredPricing, setShowTieredPricing] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerPriceList | null>(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)

  // Base prices state
  const [vehiclePrices, setVehiclePrices] = useState<VehiclePrice[]>([
    { id: 'motorcycle', label: 'אופנוע', price: 100 },
    { id: 'small', label: 'רכב קטן', price: 150 },
    { id: 'medium', label: 'רכב בינוני', price: 180 },
    { id: 'large', label: 'רכב גדול / ג׳יפ', price: 220 },
    { id: 'suv', label: 'SUV', price: 250 },
    { id: 'van', label: 'רכב מסחרי', price: 300 },
    { id: 'truck', label: 'משאית קלה', price: 350 },
  ])

  const [pricePerKm, setPricePerKm] = useState(12)
  const [minimumPrice, setMinimumPrice] = useState(250)

  const [distanceTiers, setDistanceTiers] = useState<DistanceTier[]>([
    { id: '1', from: 0, to: 20, pricePerKm: 12 },
    { id: '2', from: 20, to: 50, pricePerKm: 10 },
    { id: '3', from: 50, to: null, pricePerKm: 8 },
  ])

  const [towTruckPrices, setTowTruckPrices] = useState([
    { id: 'flatbed', label: 'גרר משטח', price: 0 },
    { id: 'lift', label: 'גרר הרמה', price: 50 },
    { id: 'heavy', label: 'גרר כבד', price: 150 },
  ])

  // Surcharges state
  const [timeSurcharges, setTimeSurcharges] = useState<TimeSurcharge[]>([
    { id: 'evening', label: 'שעות ערב', time: '15:00-19:00', percent: 25, active: true },
    { id: 'night', label: 'שעות לילה', time: '19:00-07:00', percent: 50, active: true },
    { id: 'saturday', label: 'שבת', time: 'כל היום', percent: 50, active: true },
    { id: 'holiday', label: 'חג', time: 'כל היום', percent: 50, active: true },
  ])

  const [eveningStart, setEveningStart] = useState('15:00')
  const [nightStart, setNightStart] = useState('19:00')

  const [locationSurcharges, setLocationSurcharges] = useState<LocationSurcharge[]>([
    { id: 'territories', label: 'שטחים (יו"ש)', percent: 25, active: true },
    { id: 'eilat', label: 'אילת והערבה', percent: 30, active: true },
    { id: 'golan', label: 'רמת הגולן', percent: 20, active: false },
  ])

  const [serviceSurcharges, setServiceSurcharges] = useState<ServiceSurcharge[]>([
    { id: 'garage_exit', label: 'יציאה מחניון', price: 50, active: true },
    { id: 'waiting', label: 'המתנה (לכל 15 דקות)', price: 30, active: true },
    { id: 'winch', label: 'שימוש בכננת', price: 100, active: true },
    { id: 'jump_start', label: 'הנעה (ג׳אמפ)', price: 80, active: true },
    { id: 'tire_change', label: 'החלפת גלגל', price: 60, active: true },
    { id: 'fuel', label: 'הבאת דלק', price: 70, active: false },
  ])

  // Customer price lists
  const [customerPriceLists, setCustomerPriceLists] = useState<CustomerPriceList[]>([
    { 
      id: 1, 
      name: 'מוסך רמט', 
      type: 'מוסך', 
      discountPercent: 10, 
      customPrices: [
        { id: '1', label: 'גרירה רגילה', price: 200 },
        { id: '2', label: 'בין עירוני', price: 350 },
        { id: '3', label: 'חילוץ', price: 450 },
      ]
    },
    { 
      id: 2, 
      name: 'ליסינג ישיר', 
      type: 'חברת ליסינג', 
      discountPercent: 15, 
      customPrices: [
        { id: '1', label: 'גרירה עד 20 ק״מ', price: 180 },
        { id: '2', label: 'גרירה עד 50 ק״מ', price: 280 },
        { id: '3', label: 'גרירה עד 100 ק״מ', price: 400 },
        { id: '4', label: 'גרירה מעל 100 ק״מ', price: 550 },
        { id: '5', label: 'שירות דרך', price: 120 },
      ]
    },
    { 
      id: 3, 
      name: 'השכרת רכב אופק', 
      type: 'השכרת רכב', 
      discountPercent: 12, 
      customPrices: [
        { id: '1', label: 'גרירה רגילה', price: 220 },
        { id: '2', label: 'פינוי מכביש', price: 300 },
      ]
    },
  ])

  // Price simulator state
  const [simVehicleType, setSimVehicleType] = useState('medium')
  const [simDistance, setSimDistance] = useState(25)
  const [simTime, setSimTime] = useState('regular')
  const [simCustomer, setSimCustomer] = useState('regular')

  const calculateSimulatedPrice = () => {
    const basePrice = vehiclePrices.find(v => v.id === simVehicleType)?.price || 180
    const distancePrice = simDistance * pricePerKm
    let total = basePrice + distancePrice

    if (simTime === 'evening') {
      total *= 1.25
    } else if (simTime === 'night') {
      total *= 1.5
    }

    if (simCustomer !== 'regular') {
      const customer = customerPriceLists.find(c => c.id.toString() === simCustomer)
      if (customer) {
        total *= (1 - customer.discountPercent / 100)
      }
    }

    return Math.max(total, minimumPrice)
  }

  const handleSave = () => {
    setHasChanges(false)
    alert('המחירון נשמר בהצלחה')
  }

  const updateVehiclePrice = (id: string, price: number) => {
    setVehiclePrices(vehiclePrices.map(v => v.id === id ? { ...v, price } : v))
    setHasChanges(true)
  }

  const updateTimeSurcharge = (id: string, updates: Partial<TimeSurcharge>) => {
    setTimeSurcharges(timeSurcharges.map(t => t.id === id ? { ...t, ...updates } : t))
    setHasChanges(true)
  }

  const updateLocationSurcharge = (id: string, updates: Partial<LocationSurcharge>) => {
    setLocationSurcharges(locationSurcharges.map(l => l.id === id ? { ...l, ...updates } : l))
    setHasChanges(true)
  }

  const updateServiceSurcharge = (id: string, updates: Partial<ServiceSurcharge>) => {
    setServiceSurcharges(serviceSurcharges.map(s => s.id === id ? { ...s, ...updates } : s))
    setHasChanges(true)
  }

  const addLocationSurcharge = () => {
    const newId = `location_${Date.now()}`
    setLocationSurcharges([...locationSurcharges, { id: newId, label: 'אזור חדש', percent: 0, active: true }])
    setHasChanges(true)
  }

  const addServiceSurcharge = () => {
    const newId = `service_${Date.now()}`
    setServiceSurcharges([...serviceSurcharges, { id: newId, label: 'שירות חדש', price: 0, active: true }])
    setHasChanges(true)
  }

  const openCustomerModal = (customer: CustomerPriceList) => {
    setEditingCustomer({ ...customer, customPrices: [...customer.customPrices] })
    setShowCustomerModal(true)
  }

  const addCustomerPrice = () => {
    if (!editingCustomer) return
    const newId = `price_${Date.now()}`
    setEditingCustomer({
      ...editingCustomer,
      customPrices: [...editingCustomer.customPrices, { id: newId, label: '', price: 0 }]
    })
  }

  const updateCustomerPrice = (priceId: string, updates: Partial<CustomerCustomPrice>) => {
    if (!editingCustomer) return
    setEditingCustomer({
      ...editingCustomer,
      customPrices: editingCustomer.customPrices.map(p => 
        p.id === priceId ? { ...p, ...updates } : p
      )
    })
  }

  const removeCustomerPrice = (priceId: string) => {
    if (!editingCustomer) return
    setEditingCustomer({
      ...editingCustomer,
      customPrices: editingCustomer.customPrices.filter(p => p.id !== priceId)
    })
  }

  const saveCustomerPrices = () => {
    if (!editingCustomer) return
    setCustomerPriceLists(customerPriceLists.map(c => 
      c.id === editingCustomer.id ? editingCustomer : c
    ))
    setShowCustomerModal(false)
    setEditingCustomer(null)
    setHasChanges(true)
  }

  const simulatedPrice = calculateSimulatedPrice()
  const simBasePrice = vehiclePrices.find(v => v.id === simVehicleType)?.price || 180
  const simDistancePrice = simDistance * pricePerKm

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">מחירונים</h1>
            <p className="text-gray-500 mt-1">הגדרת מחירי גרירה ותוספות</p>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`hidden lg:flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
              hasChanges
                ? 'bg-[#33d4ff] hover:bg-[#21b8e6] text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save size={20} />
            שמור שינויים
          </button>
        </div>
        {/* Mobile/Tablet save button */}
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`lg:hidden flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition-colors w-full ${
            hasChanges
              ? 'bg-[#33d4ff] hover:bg-[#21b8e6] text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Save size={20} />
          שמור שינויים
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1.5 rounded-xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('base')}
          className={`px-4 sm:px-6 py-3 rounded-lg text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
            activeTab === 'base' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          מחירון בסיס
        </button>
        <button
          onClick={() => setActiveTab('surcharges')}
          className={`px-4 sm:px-6 py-3 rounded-lg text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
            activeTab === 'surcharges' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          תוספות
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 sm:px-6 py-3 rounded-lg text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
            activeTab === 'customers' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          מחירוני לקוחות
        </button>
      </div>

      {/* Base Price Tab */}
      {activeTab === 'base' && (
        <div className="space-y-6">
          {/* Vehicle Base Prices */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Car size={22} className="text-gray-600" />
                <h3 className="font-bold text-gray-800 text-lg">מחיר בסיס לפי סוג רכב</h3>
              </div>
              <p className="text-gray-500 mt-1">מחיר התחלתי לכל גרירה לפי סוג הרכב</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="space-y-3">
                {vehiclePrices.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-100 rounded-xl border border-gray-200">
                    <span className="flex-1 font-medium text-gray-700">{item.label}</span>
                    <div className="relative">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => updateVehiclePrice(item.id, Number(e.target.value))}
                        className="w-24 sm:w-32 pr-8 pl-3 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium text-left"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Distance Pricing */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <MapPin size={22} className="text-gray-600" />
                <h3 className="font-bold text-gray-800 text-lg">תעריף מרחק</h3>
              </div>
              <p className="text-gray-500 mt-1">חישוב מחיר לפי קילומטרים</p>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-100 rounded-xl border border-gray-200">
                  <label className="block font-medium text-gray-700 mb-2">מחיר לקילומטר</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                    <input
                      type="number"
                      value={pricePerKm}
                      onChange={(e) => { setPricePerKm(Number(e.target.value)); setHasChanges(true); }}
                      className="w-full pr-8 pl-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium"
                    />
                  </div>
                </div>
                <div className="p-4 bg-gray-100 rounded-xl border border-gray-200">
                  <label className="block font-medium text-gray-700 mb-2">מחיר מינימום לגרירה</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                    <input
                      type="number"
                      value={minimumPrice}
                      onChange={(e) => { setMinimumPrice(Number(e.target.value)); setHasChanges(true); }}
                      className="w-full pr-8 pl-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Formula info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Info size={22} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-800">נוסחת חישוב</p>
                    <p className="text-blue-700 mt-1">
                      מחיר גרירה = מחיר בסיס + (מרחק × מחיר לק״מ)
                      <br />
                      אם התוצאה נמוכה ממחיר מינימום - ייגבה מחיר מינימום
                    </p>
                  </div>
                </div>
              </div>

              {/* Tiered Pricing */}
              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={() => setShowTieredPricing(!showTieredPricing)}
                  className="flex items-center justify-between w-full text-right"
                >
                  <h4 className="font-medium text-gray-700">תעריפים מדורגים (אופציונלי)</h4>
                  {showTieredPricing ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
                </button>
                
                {showTieredPricing && (
                  <div className="mt-3 space-y-2">
                    {distanceTiers.map((tier) => (
                      <div key={tier.id} className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl border border-gray-200">
                        <span className="text-gray-600 min-w-[80px] sm:min-w-[90px]">
                          {tier.from}-{tier.to || '∞'} ק״מ:
                        </span>
                        <div className="relative flex-1 max-w-24 sm:max-w-28">
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                          <input
                            type="number"
                            value={tier.pricePerKm}
                            onChange={(e) => {
                              setDistanceTiers(distanceTiers.map(t => 
                                t.id === tier.id ? { ...t, pricePerKm: Number(e.target.value) } : t
                              ))
                              setHasChanges(true)
                            }}
                            className="w-full pr-6 pl-2 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                          />
                        </div>
                        <span className="text-gray-400">לק״מ</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tow Truck Type Pricing */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-800 text-lg">תוספת לפי סוג גרר</h3>
              <p className="text-gray-500 mt-1">תוספת מחיר לפי סוג הגרר הנדרש</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="space-y-3">
                {towTruckPrices.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-100 rounded-xl border border-gray-200">
                    <span className="flex-1 font-medium text-gray-700">{item.label}</span>
                    <div className="relative">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">+₪</span>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => {
                          setTowTruckPrices(towTruckPrices.map(t => 
                            t.id === item.id ? { ...t, price: Number(e.target.value) } : t
                          ))
                          setHasChanges(true)
                        }}
                        className="w-24 sm:w-32 pr-10 pl-3 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium text-left"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Surcharges Tab */}
      {activeTab === 'surcharges' && (
        <div className="space-y-6">
          {/* Time Surcharges */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Clock size={22} className="text-gray-600" />
                <h3 className="font-bold text-gray-800 text-lg">תוספות זמן</h3>
              </div>
              <p className="text-gray-500 mt-1">תוספות לפי שעה ויום</p>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              {timeSurcharges.map((item) => (
                <div key={item.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-100 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={(e) => updateTimeSurcharge(item.id, { active: e.target.checked })}
                    className="w-5 h-5 text-[#33d4ff] rounded flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.time}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 hidden sm:inline">+</span>
                    <div className="relative">
                      <input
                        type="number"
                        value={item.percent}
                        onChange={(e) => updateTimeSurcharge(item.id, { percent: Number(e.target.value) })}
                        className="w-20 sm:w-24 pr-3 pl-8 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Define Hours */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-700 mb-3">הגדרת שעות</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-100 rounded-xl border border-gray-200">
                    <label className="block text-gray-600 mb-1">תחילת שעות ערב</label>
                    <input
                      type="time"
                      value={eveningStart}
                      onChange={(e) => { setEveningStart(e.target.value); setHasChanges(true); }}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                    />
                  </div>
                  <div className="p-3 bg-gray-100 rounded-xl border border-gray-200">
                    <label className="block text-gray-600 mb-1">תחילת שעות לילה</label>
                    <input
                      type="time"
                      value={nightStart}
                      onChange={(e) => { setNightStart(e.target.value); setHasChanges(true); }}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Location Surcharges */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <MapPin size={22} className="text-gray-600" />
                <h3 className="font-bold text-gray-800 text-lg">תוספות מיקום</h3>
              </div>
              <p className="text-gray-500 mt-1">תוספות לפי אזור או מיקום</p>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              {locationSurcharges.map((item) => (
                <div key={item.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-100 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={(e) => updateLocationSurcharge(item.id, { active: e.target.checked })}
                    className="w-5 h-5 text-[#33d4ff] rounded flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateLocationSurcharge(item.id, { label: e.target.value })}
                    className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 hidden sm:inline">+</span>
                    <div className="relative">
                      <input
                        type="number"
                        value={item.percent}
                        onChange={(e) => updateLocationSurcharge(item.id, { percent: Number(e.target.value) })}
                        className="w-20 sm:w-24 pr-3 pl-8 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addLocationSurcharge}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#33d4ff] hover:text-[#33d4ff] transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                הוסף אזור
              </button>
            </div>
          </div>

          {/* Special Services */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Wrench size={22} className="text-gray-600" />
                <h3 className="font-bold text-gray-800 text-lg">שירותים נוספים</h3>
              </div>
              <p className="text-gray-500 mt-1">תוספות עבור שירותים מיוחדים</p>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              {serviceSurcharges.map((item) => (
                <div key={item.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-100 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={(e) => updateServiceSurcharge(item.id, { active: e.target.checked })}
                    className="w-5 h-5 text-[#33d4ff] rounded flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateServiceSurcharge(item.id, { label: e.target.value })}
                    className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium"
                  />
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">+₪</span>
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => updateServiceSurcharge(item.id, { price: Number(e.target.value) })}
                      className="w-24 sm:w-32 pr-10 pl-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium text-left"
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={addServiceSurcharge}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#33d4ff] hover:text-[#33d4ff] transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                הוסף שירות
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Price Lists Tab */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          {/* Customer List */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Building2 size={22} className="text-gray-600" />
                <h3 className="font-bold text-gray-800 text-lg">מחירוני לקוחות</h3>
              </div>
              <p className="text-gray-500 mt-1">לקוחות עסקיים עם מחירון מותאם</p>
            </div>
            <div className="divide-y divide-gray-100">
              {customerPriceLists.map((customer) => (
                <div 
                  key={customer.id} 
                  onClick={() => openCustomerModal(customer)}
                  className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Building2 size={20} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-lg">{customer.name}</p>
                      <p className="text-gray-500">{customer.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6 mr-14 sm:mr-0">
                    <div className="text-center">
                      <p className="font-medium text-emerald-600">{customer.discountPercent}%</p>
                      <p className="text-sm text-gray-500">הנחה</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-gray-700">{customer.customPrices.length}</p>
                      <p className="text-sm text-gray-500">מחירים</p>
                    </div>
                    <Edit2 size={20} className="text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Simulator */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calculator size={22} className="text-gray-600" />
                <h3 className="font-bold text-gray-800 text-lg">סימולטור מחיר</h3>
              </div>
              <p className="text-gray-500 mt-1">בדוק מחיר משוער לגרירה</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">סוג רכב</label>
                  <select
                    value={simVehicleType}
                    onChange={(e) => setSimVehicleType(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                  >
                    {vehiclePrices.map(v => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">מרחק (ק״מ)</label>
                  <input
                    type="number"
                    value={simDistance}
                    onChange={(e) => setSimDistance(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">שעה</label>
                  <select
                    value={simTime}
                    onChange={(e) => setSimTime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                  >
                    <option value="regular">רגיל (07:00-15:00)</option>
                    <option value="evening">ערב (+25%)</option>
                    <option value="night">לילה (+50%)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">לקוח</label>
                  <select
                    value={simCustomer}
                    onChange={(e) => setSimCustomer(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                  >
                    <option value="regular">לקוח רגיל</option>
                    {customerPriceLists.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (-{c.discountPercent}%)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-gray-800 rounded-xl text-white">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-300">מחיר משוער:</span>
                  <span className="text-3xl sm:text-4xl font-bold">₪{Math.round(simulatedPrice)}</span>
                </div>
                <div className="space-y-1 text-gray-400">
                  <div className="flex justify-between">
                    <span>בסיס ({vehiclePrices.find(v => v.id === simVehicleType)?.label})</span>
                    <span>₪{simBasePrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>מרחק ({simDistance} ק״מ × ₪{pricePerKm})</span>
                    <span>₪{simDistancePrice}</span>
                  </div>
                  {simTime !== 'regular' && (
                    <div className="flex justify-between text-amber-400">
                      <span>תוספת {simTime === 'evening' ? 'ערב' : 'לילה'}</span>
                      <span>+{simTime === 'evening' ? '25' : '50'}%</span>
                    </div>
                  )}
                  {simCustomer !== 'regular' && (
                    <div className="flex justify-between text-emerald-400">
                      <span>הנחת לקוח</span>
                      <span>-{customerPriceLists.find(c => c.id.toString() === simCustomer)?.discountPercent}%</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                    <span>סה״כ</span>
                    <span>₪{Math.round(simulatedPrice)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Price Edit Modal */}
      {showCustomerModal && editingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
              <div>
                <h2 className="font-bold text-lg">מחירון מותאם</h2>
                <p className="text-white/80">{editingCustomer.name}</p>
              </div>
              <button
                onClick={() => { setShowCustomerModal(false); setEditingCustomer(null); }}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Discount */}
              <div className="p-4 bg-gray-100 rounded-xl border border-gray-200">
                <label className="block font-medium text-gray-700 mb-2">אחוז הנחה כללי</label>
                <div className="relative">
                  <input
                    type="number"
                    value={editingCustomer.discountPercent}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, discountPercent: Number(e.target.value) })}
                    className="w-full pr-4 pl-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                </div>
              </div>

              {/* Custom Prices */}
              <div>
                <h3 className="font-medium text-gray-700 mb-3">מחירים מותאמים</h3>
                <div className="space-y-3">
                  {editingCustomer.customPrices.map((price) => (
                    <div key={price.id} className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl border border-gray-200">
                      <input
                        type="text"
                        value={price.label}
                        onChange={(e) => updateCustomerPrice(price.id, { label: e.target.value })}
                        placeholder="שם הקטגוריה"
                        className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                      />
                      <div className="relative">
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                        <input
                          type="number"
                          value={price.price}
                          onChange={(e) => updateCustomerPrice(price.id, { price: Number(e.target.value) })}
                          className="w-24 pr-8 pl-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white text-left"
                        />
                      </div>
                      <button
                        onClick={() => removeCustomerPrice(price.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={addCustomerPrice}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#33d4ff] hover:text-[#33d4ff] transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={20} />
                    הוסף קטגוריה
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => { setShowCustomerModal(false); setEditingCustomer(null); }}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
              >
                ביטול
              </button>
              <button
                onClick={saveCustomerPrices}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] transition-colors font-medium"
              >
                שמור מחירון
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
