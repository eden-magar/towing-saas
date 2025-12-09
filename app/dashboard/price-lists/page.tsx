'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/AuthContext'
import {
  getFullPriceList,
  upsertBasePriceList,
  saveDistanceTiers,
  saveTruckTypeSurcharges,
  saveTimeSurcharges,
  saveLocationSurcharges,
  saveServiceSurcharges,
  updateCustomerPricing,
  saveFixedPriceItems,
  CustomerWithPricing,
  FixedPriceItem
} from '../../lib/queries/price-lists'
import { Save, Plus, Trash2, Info, Calculator, Car, Clock, MapPin, Wrench, Building2, X, ChevronDown, ChevronUp, Edit2, RefreshCw, FileText } from 'lucide-react'

interface VehiclePrice {
  id: string
  label: string
  field: string
  price: number
}

interface TimeSurchargeLocal {
  id: string
  name: string
  label: string
  time_description: string
  surcharge_percent: number
  is_active: boolean
}

interface LocationSurchargeLocal {
  id: string
  label: string
  surcharge_percent: number
  is_active: boolean
}

interface ServiceSurchargeLocal {
  id: string
  label: string
  price: number
  is_active: boolean
}

interface DistanceTierLocal {
  id: string
  from_km: number
  to_km: number | null
  price_per_km: number
}

interface TruckTypePrice {
  id: string
  truck_type: string
  label: string
  surcharge: number
}

interface CustomerPriceItemLocal {
  id: string
  label: string
  price: number
}

interface CustomerPriceListLocal {
  id: string
  customer_company_id: string
  name: string
  type: string
  discount_percent: number
  price_items: CustomerPriceItemLocal[]
}

interface FixedPriceItemLocal {
  id: string
  label: string
  description: string
  price: number
  sort_order: number
}

export default function PriceListsPage() {
  const { companyId, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<'base' | 'fixed' | 'surcharges' | 'customers'>('base')
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTieredPricing, setShowTieredPricing] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerPriceListLocal | null>(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)

  // Base prices state - מעודכן לפי מאגרי משרד התחבורה
  const [vehiclePrices, setVehiclePrices] = useState<VehiclePrice[]>([
    { id: 'private', label: 'רכב פרטי', field: 'base_price_private', price: 180 },
    { id: 'motorcycle', label: 'דו גלגלי', field: 'base_price_motorcycle', price: 100 },
    { id: 'heavy', label: 'רכב כבד', field: 'base_price_heavy', price: 350 },
    { id: 'machinery', label: 'צמ"ה', field: 'base_price_machinery', price: 500 },
  ])

  const [pricePerKm, setPricePerKm] = useState(12)
  const [minimumPrice, setMinimumPrice] = useState(250)

  const [distanceTiers, setDistanceTiers] = useState<DistanceTierLocal[]>([
    { id: '1', from_km: 0, to_km: 20, price_per_km: 12 },
    { id: '2', from_km: 20, to_km: 50, price_per_km: 10 },
    { id: '3', from_km: 50, to_km: null, price_per_km: 8 },
  ])

  const [towTruckPrices, setTowTruckPrices] = useState<TruckTypePrice[]>([
  { id: 'crane_tow', truck_type: 'crane_tow', label: 'גרר מנוף', surcharge: 0 },
  { id: 'dolly', truck_type: 'dolly', label: 'דולי (מערסל ידני)', surcharge: 0 },
  { id: 'heavy_rescue', truck_type: 'heavy_rescue', label: 'חילוץ כבד', surcharge: 0 },
  { id: 'carrier', truck_type: 'carrier', label: 'מובילית', surcharge: 0 },
  { id: 'carrier_large', truck_type: 'carrier_large', label: 'מובילית 10+ רכבים', surcharge: 0 },
  { id: 'wheel_lift_cradle', truck_type: 'wheel_lift_cradle', label: 'משקפיים (מערסל)', surcharge: 0 },
  { id: 'heavy_equipment', truck_type: 'heavy_equipment', label: 'ציוד כבד/לובי', surcharge: 0 },
  { id: 'flatbed_ramsa', truck_type: 'flatbed_ramsa', label: 'רמסע', surcharge: 0 },
])

  // Fixed price items state (מחירון כללי)
  const [fixedPriceItems, setFixedPriceItems] = useState<FixedPriceItemLocal[]>([])

  // Surcharges state
  const [timeSurcharges, setTimeSurcharges] = useState<TimeSurchargeLocal[]>([
    { id: 'evening', name: 'evening', label: 'שעות ערב', time_description: '15:00-19:00', surcharge_percent: 25, is_active: true },
    { id: 'night', name: 'night', label: 'שעות לילה', time_description: '19:00-07:00', surcharge_percent: 50, is_active: true },
    { id: 'saturday', name: 'saturday', label: 'שבת', time_description: 'כל היום', surcharge_percent: 50, is_active: true },
    { id: 'holiday', name: 'holiday', label: 'חג', time_description: 'כל היום', surcharge_percent: 50, is_active: true },
  ])

  const [locationSurcharges, setLocationSurcharges] = useState<LocationSurchargeLocal[]>([
    { id: '1', label: 'שטחים (יו"ש)', surcharge_percent: 25, is_active: true },
    { id: '2', label: 'אילת והערבה', surcharge_percent: 30, is_active: true },
    { id: '3', label: 'רמת הגולן', surcharge_percent: 20, is_active: false },
  ])

  const [serviceSurcharges, setServiceSurcharges] = useState<ServiceSurchargeLocal[]>([
    { id: '1', label: 'יציאה מחניון', price: 50, is_active: true },
    { id: '2', label: 'המתנה (לכל 15 דקות)', price: 30, is_active: true },
    { id: '3', label: 'שימוש בכננת', price: 100, is_active: true },
    { id: '4', label: 'הנעה (ג׳אמפ)', price: 80, is_active: true },
    { id: '5', label: 'החלפת גלגל', price: 60, is_active: true },
    { id: '6', label: 'הבאת דלק', price: 70, is_active: false },
  ])

  // Customer price lists
  const [customerPriceLists, setCustomerPriceLists] = useState<CustomerPriceListLocal[]>([])

  // Price simulator state
  const [simVehicleType, setSimVehicleType] = useState('medium')
  const [simDistance, setSimDistance] = useState(25)
  const [simTime, setSimTime] = useState('regular')
  const [simCustomer, setSimCustomer] = useState('regular')

  // טעינת נתונים
  const loadData = async () => {
    if (!companyId) return

    try {
      const data = await getFullPriceList(companyId)

      // מחירון בסיס - מעודכן לפי מאגרי משרד התחבורה
      if (data.basePriceList) {
        const bp = data.basePriceList
        setVehiclePrices([
          { id: 'private', label: 'רכב פרטי', field: 'base_price_private', price: bp.base_price_private || 180 },
          { id: 'motorcycle', label: 'דו גלגלי', field: 'base_price_motorcycle', price: bp.base_price_motorcycle || 100 },
          { id: 'heavy', label: 'רכב כבד', field: 'base_price_heavy', price: bp.base_price_heavy || 350 },
          { id: 'machinery', label: 'צמ"ה', field: 'base_price_machinery', price: bp.base_price_machinery || 500 },
        ])
        setPricePerKm(bp.price_per_km || 12)
        setMinimumPrice(bp.minimum_price || 250)
      }

      // מדרגות מרחק
      if (data.distanceTiers.length > 0) {
        setDistanceTiers(data.distanceTiers.map(t => ({
          id: t.id,
          from_km: t.from_km,
          to_km: t.to_km,
          price_per_km: t.price_per_km
        })))
        setShowTieredPricing(true)
      }

      // תוספות סוג גרר
      if (data.truckTypeSurcharges.length > 0) {
        setTowTruckPrices(prev => prev.map(p => {
          const found = data.truckTypeSurcharges.find(t => t.truck_type === p.truck_type)
          return found ? { ...p, surcharge: found.surcharge } : p
        }))
      }

      // מחירון כללי
      if (data.fixedPriceItems && data.fixedPriceItems.length > 0) {
        setFixedPriceItems(data.fixedPriceItems.map(f => ({
          id: f.id,
          label: f.label,
          description: f.description || '',
          price: f.price,
          sort_order: f.sort_order
        })))
      }

      // תוספות זמן
      if (data.timeSurcharges.length > 0) {
        setTimeSurcharges(data.timeSurcharges.map(t => ({
          id: t.id,
          name: t.name,
          label: t.label,
          time_description: t.time_description || '',
          surcharge_percent: t.surcharge_percent,
          is_active: t.is_active
        })))
      }

      // תוספות מיקום
      if (data.locationSurcharges.length > 0) {
        setLocationSurcharges(data.locationSurcharges.map(l => ({
          id: l.id,
          label: l.label,
          surcharge_percent: l.surcharge_percent,
          is_active: l.is_active
        })))
      }

      // שירותים נוספים
      if (data.serviceSurcharges.length > 0) {
        setServiceSurcharges(data.serviceSurcharges.map(s => ({
          id: s.id,
          label: s.label,
          price: s.price,
          is_active: s.is_active
        })))
      }

      // מחירוני לקוחות
      if (data.customersWithPricing.length > 0) {
        setCustomerPriceLists(data.customersWithPricing.map(c => ({
          id: c.customer_id,
          customer_company_id: c.id,
          name: c.customer?.name || '',
          type: c.customer?.customer_type === 'business' ? 'עסקי' : 'פרטי',
          discount_percent: c.discount_percent,
          price_items: c.price_items.map(p => ({
            id: p.id,
            label: p.label,
            price: p.price
          }))
        })))
      }
    } catch (error) {
      console.error('Error loading price list:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) {
      if (companyId) {
        loadData()
      } else {
        setLoading(false)
      }
    }
  }, [companyId, authLoading])

  const calculateSimulatedPrice = () => {
    const basePrice = vehiclePrices.find(v => v.id === simVehicleType)?.price || 180
    const distancePrice = simDistance * pricePerKm
    let total = basePrice + distancePrice

    const timeItem = timeSurcharges.find(t => t.name === simTime)
    if (timeItem && timeItem.is_active) {
      total *= (1 + timeItem.surcharge_percent / 100)
    }

    if (simCustomer !== 'regular') {
      const customer = customerPriceLists.find(c => c.id === simCustomer)
      if (customer) {
        total *= (1 - customer.discount_percent / 100)
      }
    }

    return Math.max(total, minimumPrice)
  }

  const handleSave = async () => {
    if (!companyId) return

    setSaving(true)
    try {
      // שמירת מחירון בסיס
      const basePriceData: Record<string, number> = {
        price_per_km: pricePerKm,
        minimum_price: minimumPrice
      }
      vehiclePrices.forEach(v => {
        basePriceData[v.field] = v.price
      })
      await upsertBasePriceList(companyId, basePriceData)

      // שמירת מדרגות מרחק
      if (showTieredPricing) {
        await saveDistanceTiers(companyId, distanceTiers.map(t => ({
          from_km: t.from_km,
          to_km: t.to_km,
          price_per_km: t.price_per_km
        })))
      }

      // שמירת תוספות סוג גרר
      await saveTruckTypeSurcharges(companyId, towTruckPrices.map(t => ({
        truck_type: t.truck_type,
        surcharge: t.surcharge
      })))

      // שמירת מחירון כללי
      await saveFixedPriceItems(companyId, fixedPriceItems.map((f, index) => ({
        label: f.label,
        description: f.description || undefined,
        price: f.price,
        sort_order: index
      })))

      // שמירת תוספות זמן
      await saveTimeSurcharges(companyId, timeSurcharges.map(t => ({
        name: t.name,
        label: t.label,
        time_description: t.time_description,
        surcharge_percent: t.surcharge_percent,
        is_active: t.is_active
      })))

      // שמירת תוספות מיקום
      await saveLocationSurcharges(companyId, locationSurcharges.map(l => ({
        label: l.label,
        surcharge_percent: l.surcharge_percent,
        is_active: l.is_active
      })))

      // שמירת שירותים נוספים
      await saveServiceSurcharges(companyId, serviceSurcharges.map(s => ({
        label: s.label,
        price: s.price,
        is_active: s.is_active
      })))

      setHasChanges(false)
      alert('המחירון נשמר בהצלחה')
    } catch (error) {
      console.error('Error saving price list:', error)
      alert('שגיאה בשמירת המחירון')
    } finally {
      setSaving(false)
    }
  }

  const updateVehiclePrice = (id: string, price: number) => {
    setVehiclePrices(vehiclePrices.map(v => v.id === id ? { ...v, price } : v))
    setHasChanges(true)
  }

  const updateTimeSurcharge = (id: string, updates: Partial<TimeSurchargeLocal>) => {
    setTimeSurcharges(timeSurcharges.map(t => t.id === id ? { ...t, ...updates } : t))
    setHasChanges(true)
  }

  const updateLocationSurcharge = (id: string, updates: Partial<LocationSurchargeLocal>) => {
    setLocationSurcharges(locationSurcharges.map(l => l.id === id ? { ...l, ...updates } : l))
    setHasChanges(true)
  }

  const updateServiceSurcharge = (id: string, updates: Partial<ServiceSurchargeLocal>) => {
    setServiceSurcharges(serviceSurcharges.map(s => s.id === id ? { ...s, ...updates } : s))
    setHasChanges(true)
  }

  const addLocationSurcharge = () => {
    const newId = `new_${Date.now()}`
    setLocationSurcharges([...locationSurcharges, { id: newId, label: 'אזור חדש', surcharge_percent: 0, is_active: true }])
    setHasChanges(true)
  }

  const removeLocationSurcharge = (id: string) => {
    setLocationSurcharges(locationSurcharges.filter(l => l.id !== id))
    setHasChanges(true)
  }

  const addServiceSurcharge = () => {
    const newId = `new_${Date.now()}`
    setServiceSurcharges([...serviceSurcharges, { id: newId, label: 'שירות חדש', price: 0, is_active: true }])
    setHasChanges(true)
  }

  const removeServiceSurcharge = (id: string) => {
    setServiceSurcharges(serviceSurcharges.filter(s => s.id !== id))
    setHasChanges(true)
  }

  // Fixed price items functions
  const addFixedPriceItem = () => {
    const newId = `new_${Date.now()}`
    setFixedPriceItems([...fixedPriceItems, { 
      id: newId, 
      label: '', 
      description: '',
      price: 0, 
      sort_order: fixedPriceItems.length 
    }])
    setHasChanges(true)
  }

  const updateFixedPriceItem = (id: string, updates: Partial<FixedPriceItemLocal>) => {
    setFixedPriceItems(fixedPriceItems.map(f => f.id === id ? { ...f, ...updates } : f))
    setHasChanges(true)
  }

  const removeFixedPriceItem = (id: string) => {
    setFixedPriceItems(fixedPriceItems.filter(f => f.id !== id))
    setHasChanges(true)
  }

  const moveFixedPriceItem = (id: string, direction: 'up' | 'down') => {
    const index = fixedPriceItems.findIndex(f => f.id === id)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === fixedPriceItems.length - 1) return

    const newItems = [...fixedPriceItems]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    ;[newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]]
    setFixedPriceItems(newItems)
    setHasChanges(true)
  }

  const openCustomerModal = (customer: CustomerPriceListLocal) => {
    setEditingCustomer({ ...customer, price_items: [...customer.price_items] })
    setShowCustomerModal(true)
  }

  const addCustomerPrice = () => {
    if (!editingCustomer) return
    const newId = `new_${Date.now()}`
    setEditingCustomer({
      ...editingCustomer,
      price_items: [...editingCustomer.price_items, { id: newId, label: '', price: 0 }]
    })
  }

  const updateCustomerPrice = (priceId: string, updates: Partial<CustomerPriceItemLocal>) => {
    if (!editingCustomer) return
    setEditingCustomer({
      ...editingCustomer,
      price_items: editingCustomer.price_items.map(p =>
        p.id === priceId ? { ...p, ...updates } : p
      )
    })
  }

  const removeCustomerPrice = (priceId: string) => {
    if (!editingCustomer) return
    setEditingCustomer({
      ...editingCustomer,
      price_items: editingCustomer.price_items.filter(p => p.id !== priceId)
    })
  }

  const saveCustomerPrices = async () => {
    if (!editingCustomer) return

    try {
      await updateCustomerPricing(
        editingCustomer.customer_company_id,
        editingCustomer.discount_percent,
        editingCustomer.price_items.map(p => ({ label: p.label, price: p.price }))
      )

      setCustomerPriceLists(customerPriceLists.map(c =>
        c.id === editingCustomer.id ? editingCustomer : c
      ))
      setShowCustomerModal(false)
      setEditingCustomer(null)
    } catch (error) {
      console.error('Error saving customer prices:', error)
      alert('שגיאה בשמירת מחירון הלקוח')
    }
  }

  const simulatedPrice = calculateSimulatedPrice()
  const simBasePrice = vehiclePrices.find(v => v.id === simVehicleType)?.price || 180
  const simDistancePrice = simDistance * pricePerKm

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="animate-spin" size={20} />
          <span>טוען...</span>
        </div>
      </div>
    )
  }

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
            disabled={!hasChanges || saving}
            className={`hidden lg:flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
              hasChanges && !saving
                ? 'bg-[#33d4ff] hover:bg-[#21b8e6] text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
            {saving ? 'שומר...' : 'שמור שינויים'}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`lg:hidden flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition-colors w-full ${
            hasChanges && !saving
              ? 'bg-[#33d4ff] hover:bg-[#21b8e6] text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
          {saving ? 'שומר...' : 'שמור שינויים'}
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
          onClick={() => setActiveTab('fixed')}
          className={`px-4 sm:px-6 py-3 rounded-lg text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
            activeTab === 'fixed' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          מחירון כללי
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
                          {tier.from_km}-{tier.to_km || '∞'} ק״מ:
                        </span>
                        <div className="relative flex-1 max-w-24 sm:max-w-28">
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                          <input
                            type="number"
                            value={tier.price_per_km}
                            onChange={(e) => {
                              setDistanceTiers(distanceTiers.map(t =>
                                t.id === tier.id ? { ...t, price_per_km: Number(e.target.value) } : t
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
                        value={item.surcharge}
                        onChange={(e) => {
                          setTowTruckPrices(towTruckPrices.map(t =>
                            t.id === item.id ? { ...t, surcharge: Number(e.target.value) } : t
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

      {/* Fixed Price Tab - מחירון כללי */}
      {activeTab === 'fixed' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText size={22} className="text-gray-600" />
                <h3 className="font-bold text-gray-800 text-lg">מחירון כללי</h3>
              </div>
              <p className="text-gray-500 mt-1">תעריפים קבועים למסלולים נפוצים - מוצגים לכל הלקוחות</p>
            </div>
            
            <div className="p-4 sm:p-5 space-y-4">
              {/* Info box */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Info size={22} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-emerald-800">איך זה עובד?</p>
                    <p className="text-emerald-700 mt-1">
                      תעריפים אלה יוצגו בטופס גרירה חדשה לכל הלקוחות.
                      <br />
                      לדוגמה: "בת ים - חולון רכב קטן" או "תל אביב - פתח תקווה רכב בינוני"
                    </p>
                  </div>
                </div>
              </div>

              {/* Fixed price items list */}
              {fixedPriceItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="font-medium">אין תעריפים קבועים</p>
                  <p className="text-sm mt-1">הוסף תעריפים קבועים למסלולים נפוצים</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fixedPriceItems.map((item, index) => (
                    <div key={item.id} className="flex items-start gap-3 p-4 bg-gray-100 rounded-xl border border-gray-200">
                      {/* Move buttons */}
                      <div className="flex flex-col gap-1 pt-1">
                        <button
                          onClick={() => moveFixedPriceItem(item.id, 'up')}
                          disabled={index === 0}
                          className={`p-1 rounded ${index === 0 ? 'text-gray-300' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => moveFixedPriceItem(item.id, 'down')}
                          disabled={index === fixedPriceItems.length - 1}
                          className={`p-1 rounded ${index === fixedPriceItems.length - 1 ? 'text-gray-300' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateFixedPriceItem(item.id, { label: e.target.value })}
                            placeholder="שם התעריף (למשל: בת ים - חולון רכב קטן)"
                            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium"
                          />
                          <div className="relative w-full sm:w-32">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => updateFixedPriceItem(item.id, { price: Number(e.target.value) })}
                              placeholder="מחיר"
                              className="w-full pr-8 pl-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium text-left"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateFixedPriceItem(item.id, { description: e.target.value })}
                          placeholder="תיאור (אופציונלי)"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white text-sm text-gray-600"
                        />
                      </div>
                      
                      {/* Delete button */}
                      <button
                        onClick={() => removeFixedPriceItem(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={addFixedPriceItem}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#33d4ff] hover:text-[#33d4ff] transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                הוסף תעריף קבוע
              </button>
            </div>
          </div>

          {/* Examples */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-800 text-lg">דוגמאות לתעריפים נפוצים</h3>
            </div>
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'בת ים - חולון רכב קטן', price: 180 },
                  { label: 'תל אביב - פתח תקווה', price: 250 },
                  { label: 'ראשון לציון - אשדוד', price: 350 },
                  { label: 'נתניה - הרצליה', price: 220 },
                  { label: 'חיפה - קריות', price: 150 },
                  { label: 'באר שבע - דימונה', price: 280 },
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const newId = `new_${Date.now()}_${i}`
                      setFixedPriceItems([...fixedPriceItems, { 
                        id: newId, 
                        label: example.label, 
                        description: '',
                        price: example.price, 
                        sort_order: fixedPriceItems.length 
                      }])
                      setHasChanges(true)
                    }}
                    className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors text-right"
                  >
                    <span className="text-gray-700">{example.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">₪{example.price}</span>
                      <Plus size={16} className="text-[#33d4ff]" />
                    </div>
                  </button>
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
                    checked={item.is_active}
                    onChange={(e) => updateTimeSurcharge(item.id, { is_active: e.target.checked })}
                    className="w-5 h-5 text-[#33d4ff] rounded flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.time_description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 hidden sm:inline">+</span>
                    <div className="relative">
                      <input
                        type="number"
                        value={item.surcharge_percent}
                        onChange={(e) => updateTimeSurcharge(item.id, { surcharge_percent: Number(e.target.value) })}
                        className="w-20 sm:w-24 pr-3 pl-8 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                  </div>
                </div>
              ))}
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
                    checked={item.is_active}
                    onChange={(e) => updateLocationSurcharge(item.id, { is_active: e.target.checked })}
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
                        value={item.surcharge_percent}
                        onChange={(e) => updateLocationSurcharge(item.id, { surcharge_percent: Number(e.target.value) })}
                        className="w-20 sm:w-24 pr-3 pl-8 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeLocationSurcharge(item.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
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
                    checked={item.is_active}
                    onChange={(e) => updateServiceSurcharge(item.id, { is_active: e.target.checked })}
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
                  <button
                    onClick={() => removeServiceSurcharge(item.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
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
            {customerPriceLists.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Building2 size={48} className="mx-auto mb-4 text-gray-300" />
                <p>אין לקוחות עסקיים עם מחירון מותאם</p>
                <p className="text-sm mt-2">הוסף לקוחות עסקיים בדף הלקוחות כדי להגדיר להם מחירון מותאם</p>
              </div>
            ) : (
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
                        <p className="font-medium text-emerald-600">{customer.discount_percent}%</p>
                        <p className="text-sm text-gray-500">הנחה</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-gray-700">{customer.price_items.length}</p>
                        <p className="text-sm text-gray-500">מחירים</p>
                      </div>
                      <Edit2 size={20} className="text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    <option value="regular">רגיל</option>
                    {timeSurcharges.filter(t => t.is_active).map(t => (
                      <option key={t.name} value={t.name}>{t.label} (+{t.surcharge_percent}%)</option>
                    ))}
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
                      <option key={c.id} value={c.id}>{c.name} (-{c.discount_percent}%)</option>
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
                      <span>תוספת {timeSurcharges.find(t => t.name === simTime)?.label}</span>
                      <span>+{timeSurcharges.find(t => t.name === simTime)?.surcharge_percent}%</span>
                    </div>
                  )}
                  {simCustomer !== 'regular' && (
                    <div className="flex justify-between text-emerald-400">
                      <span>הנחת לקוח</span>
                      <span>-{customerPriceLists.find(c => c.id === simCustomer)?.discount_percent}%</span>
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
              <div className="p-4 bg-gray-100 rounded-xl border border-gray-200">
                <label className="block font-medium text-gray-700 mb-2">אחוז הנחה כללי</label>
                <div className="relative">
                  <input
                    type="number"
                    value={editingCustomer.discount_percent}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, discount_percent: Number(e.target.value) })}
                    className="w-full pr-4 pl-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-medium"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-3">מחירים מותאמים</h3>
                <div className="space-y-3">
                  {editingCustomer.price_items.map((price) => (
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