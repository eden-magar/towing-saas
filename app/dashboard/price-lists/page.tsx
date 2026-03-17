'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { Save, RefreshCw, X, Plus, Trash2 } from 'lucide-react'
import {
  getFullPriceList,
  upsertBasePriceList,
  saveTimeSurcharges,
  saveLocationSurcharges,
  saveServiceSurcharges,
  updateCustomerPricing,
  saveFixedPriceItems,
  upsertCustomerPriceList,
  getCustomerPriceList,
  getCustomerSurcharges,
  saveCustomerSurcharges,
} from '../../lib/queries/price-lists'
import { BasePriceTab } from './components/BasePriceTab'
import { FixedPriceTab } from './components/FixedPriceTab'
import { SurchargesTab } from './components/SurchargesTab'
import { CustomerPricingTab } from './components/CustomerPricingTab'
import { PriceSimulator } from './components/PriceSimulator'

// ==================== Types ====================

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

interface TimeSurcharge {
  id: string
  name: string
  label: string
  time_description?: string | null
  time_start: string
  time_end: string
  day_type: string
  surcharge_percent: number
  sort_order?: number
  is_active: boolean
}


interface LocationSurcharge {
  id: string
  label: string
  surcharge_percent: number
  is_active: boolean
}

interface ServiceSurcharge {
  id: string
  label: string
  price: number
  price_type: 'fixed' | 'per_unit' | 'manual'
  unit_label?: string
  is_active: boolean
}

interface FixedPriceItem {
  id: string
  label: string
  description: string
  price: number
  sort_order: number
}

interface CustomerPriceItem {
  id: string
  label: string
  price: number
}

interface CustomerPriceList {
  id: string
  customer_company_id: string
  name: string
  type: string
  discount_percent: number
  price_items: CustomerPriceItem[]
  // מחירון מלא
  price_list_id?: string | null
  base_price_private?: number | null
  base_price_motorcycle?: number | null
  base_price_heavy?: number | null
  base_price_machinery?: number | null
  price_per_km?: number | null
  minimum_price?: number | null
  customer_time_surcharges?: TimeSurcharge[]
  customer_location_surcharges?: LocationSurcharge[]
  customer_service_surcharges?: ServiceSurcharge[]
}

// ==================== Component ====================

export default function PriceListsPage() {
  const { companyId, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<'base' | 'fixed' | 'surcharges' | 'customers'>('base')
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Customer modal state
  const [editingCustomer, setEditingCustomer] = useState<CustomerPriceList | null>(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)

  // Base prices state
  const [baseLocation, setBaseLocation] = useState<BaseLocationData>({ address: '' })
  const [vehiclePrices, setVehiclePrices] = useState<VehiclePrice[]>([
    { id: 'private', label: 'רכב פרטי', field: 'base_price_private', price: 180 },
    { id: 'motorcycle', label: 'דו גלגלי', field: 'base_price_motorcycle', price: 100 },
    { id: 'heavy', label: 'רכב כבד', field: 'base_price_heavy', price: 350 },
    { id: 'machinery', label: 'צמ"ה', field: 'base_price_machinery', price: 500 },
  ])
  const [pricePerKm, setPricePerKm] = useState(12)
  const [minimumPrice, setMinimumPrice] = useState(250)

  // Fixed prices state
  const [fixedPriceItems, setFixedPriceItems] = useState<FixedPriceItem[]>([])

  // Surcharges state
  const [timeSurcharges, setTimeSurcharges] = useState<TimeSurcharge[]>([])
  const [locationSurcharges, setLocationSurcharges] = useState<LocationSurcharge[]>([])
  const [serviceSurcharges, setServiceSurcharges] = useState<ServiceSurcharge[]>([])

  // Customer pricing state
  const [customerPriceLists, setCustomerPriceLists] = useState<CustomerPriceList[]>([])

  // ==================== Load Data ====================

  const loadData = async () => {
    if (!companyId) return

    try {
      const data = await getFullPriceList(companyId)

      // Base prices
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
        if (bp.base_address) {
          setBaseLocation({
            address: bp.base_address,
            lat: bp.base_lat ?? undefined,
            lng: bp.base_lng ?? undefined
          })
        }
      }

      // Fixed prices
      if (data.fixedPriceItems?.length > 0) {
        setFixedPriceItems(data.fixedPriceItems.map(f => ({
          id: f.id,
          label: f.label,
          description: f.description || '',
          price: f.price,
          sort_order: f.sort_order
        })))
      }

      // Time surcharges
      if (data.timeSurcharges?.length > 0) {
        setTimeSurcharges(data.timeSurcharges.map(t => ({
          id: t.id,
          name: t.name,
          label: t.label,
          time_start: t.time_start || '',
          time_end: t.time_end || '',
          day_type: t.day_type || 'all',
          surcharge_percent: t.surcharge_percent,
          is_active: t.is_active
        })))
      }

      // Location surcharges
      if (data.locationSurcharges?.length > 0) {
        setLocationSurcharges(data.locationSurcharges.map(l => ({
          id: l.id,
          label: l.label,
          surcharge_percent: l.surcharge_percent,
          is_active: l.is_active
        })))
      }

      // Service surcharges
      if (data.serviceSurcharges?.length > 0) {
        setServiceSurcharges(data.serviceSurcharges.map(s => ({
          id: s.id,
          label: s.label,
          price: s.price,
          price_type: (s as any).price_type || 'fixed',
          unit_label: (s as any).unit_label || '',
          is_active: s.is_active
        })))
      }

      // Customer pricing
      if (data.customersWithPricing?.length > 0) {
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
    if (!authLoading && companyId) {
      loadData()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [companyId, authLoading])

  // ==================== Save ====================

  const handleSave = async () => {
    if (!companyId) return

    setSaving(true)
    try {
      // Base prices
      const basePriceData: Record<string, number | string | null> = {
        price_per_km: pricePerKm,
        minimum_price: minimumPrice,
        base_address: baseLocation.address || null,
        base_lat: baseLocation.lat ?? null,
        base_lng: baseLocation.lng ?? null
      }
      vehiclePrices.forEach(v => {
        basePriceData[v.field] = v.price
      })
      await upsertBasePriceList(companyId, basePriceData)

      // Fixed prices
      await saveFixedPriceItems(companyId, fixedPriceItems.map((f, index) => ({
        label: f.label,
        description: f.description || undefined,
        price: f.price,
        sort_order: index
      })))

      // Time surcharges
      await saveTimeSurcharges(companyId, timeSurcharges.map(t => ({
        name: t.name,
        label: t.label,
        time_description: t.day_type === 'all' ? `${t.time_start}-${t.time_end}` : '',
        time_start: t.time_start || null,
        time_end: t.time_end || null,
        day_type: t.day_type,
        surcharge_percent: t.surcharge_percent,
        is_active: t.is_active
      })))

      // Location surcharges
      await saveLocationSurcharges(companyId, locationSurcharges.map(l => ({
        label: l.label,
        surcharge_percent: l.surcharge_percent,
        is_active: l.is_active
      })))

      // Service surcharges
      await saveServiceSurcharges(companyId, serviceSurcharges.map(s => ({
        label: s.label,
        price: s.price,
        price_type: s.price_type,
        unit_label: s.unit_label,
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

  // ==================== Handlers ====================

  const markChanged = () => setHasChanges(true)

  // Vehicle prices
  const handleVehiclePriceChange = (id: string, price: number) => {
    setVehiclePrices(prev => prev.map(v => v.id === id ? { ...v, price } : v))
    markChanged()
  }

  // Fixed prices
  const handleFixedPriceAdd = () => {
    setFixedPriceItems(prev => [...prev, {
      id: `new_${Date.now()}`,
      label: '',
      description: '',
      price: 0,
      sort_order: prev.length
    }])
    markChanged()
  }

  const handleFixedPriceUpdate = (id: string, updates: Partial<FixedPriceItem>) => {
    setFixedPriceItems(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
    markChanged()
  }

  const handleFixedPriceRemove = (id: string) => {
    setFixedPriceItems(prev => prev.filter(f => f.id !== id))
    markChanged()
  }

  const handleFixedPriceMove = (id: string, direction: 'up' | 'down') => {
    const index = fixedPriceItems.findIndex(f => f.id === id)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === fixedPriceItems.length - 1) return

    const newItems = [...fixedPriceItems]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    ;[newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]]
    setFixedPriceItems(newItems)
    markChanged()
  }

  // Time surcharges
  const handleTimeSurchargeAdd = () => {
    const newId = `new_${Date.now()}`
    setTimeSurcharges(prev => [...prev, {
      id: newId,
      name: newId,
      label: '',
      time_start: '18:00',
      time_end: '22:00',
      day_type: 'all',
      surcharge_percent: 0,
      is_active: true
    }])
    markChanged()
  }

  const handleTimeSurchargeUpdate = (id: string, updates: Partial<TimeSurcharge>) => {
    setTimeSurcharges(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    markChanged()
  }

  const handleTimeSurchargeRemove = (id: string) => {
    setTimeSurcharges(prev => prev.filter(t => t.id !== id))
    markChanged()
  }

  // Location surcharges
  const handleLocationSurchargeAdd = () => {
    setLocationSurcharges(prev => [...prev, {
      id: `new_${Date.now()}`,
      label: '',
      surcharge_percent: 0,
      is_active: true
    }])
    markChanged()
  }

  const handleLocationSurchargeUpdate = (id: string, updates: Partial<LocationSurcharge>) => {
    setLocationSurcharges(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
    markChanged()
  }

  const handleLocationSurchargeRemove = (id: string) => {
    setLocationSurcharges(prev => prev.filter(l => l.id !== id))
    markChanged()
  }

  // Service surcharges
  const handleServiceSurchargeAdd = () => {
    setServiceSurcharges(prev => [...prev, {
      id: `new_${Date.now()}`,
      label: '',
      price: 0,
      price_type: 'fixed',
      unit_label: '',
      is_active: true
    }])
    markChanged()
  }

  const handleServiceSurchargeUpdate = (id: string, updates: Partial<ServiceSurcharge>) => {
    setServiceSurcharges(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    markChanged()
  }

  const handleServiceSurchargeRemove = (id: string) => {
    setServiceSurcharges(prev => prev.filter(s => s.id !== id))
    markChanged()
  }

  // Customer pricing
  const openCustomerModal = async (customer: CustomerPriceList) => {
  const base = { ...customer, price_items: [...customer.price_items] }
  
  // שליפת מחירון לקוח אם קיים
  const existingPriceList = await getCustomerPriceList(customer.customer_company_id)
    if (existingPriceList) {
      const surcharges = await getCustomerSurcharges(existingPriceList.id)
      base.price_list_id = existingPriceList.id
      base.base_price_private = existingPriceList.base_price_private
      base.base_price_motorcycle = existingPriceList.base_price_motorcycle
      base.base_price_heavy = existingPriceList.base_price_heavy
      base.base_price_machinery = existingPriceList.base_price_machinery
      base.price_per_km = existingPriceList.price_per_km
      base.minimum_price = existingPriceList.minimum_price
      base.customer_time_surcharges = surcharges.timeSurcharges
      base.customer_location_surcharges = surcharges.locationSurcharges
      base.customer_service_surcharges = surcharges.serviceSurcharges
    } else {
      base.customer_time_surcharges = []
      base.customer_location_surcharges = []
      base.customer_service_surcharges = []
    }

    setEditingCustomer(base)
    setShowCustomerModal(true)
  }

  const saveCustomerPrices = async () => {
    if (!editingCustomer || !companyId) return

    try {
      // שמירת הנחה + price items (כמו קודם)
      await updateCustomerPricing(
        editingCustomer.customer_company_id,
        editingCustomer.discount_percent,
        editingCustomer.price_items.map(p => ({ label: p.label, price: p.price }))
      )

      // שמירת מחירון מלא אם הוגדר
      const hasCustomPricing = editingCustomer.base_price_private ||
        editingCustomer.base_price_motorcycle ||
        editingCustomer.base_price_heavy ||
        editingCustomer.base_price_machinery ||
        editingCustomer.price_per_km

      if (hasCustomPricing) {
        const priceListId = await upsertCustomerPriceList(
          companyId,
          editingCustomer.customer_company_id,
          {
            base_price_private: editingCustomer.base_price_private || undefined,
            base_price_motorcycle: editingCustomer.base_price_motorcycle || undefined,
            base_price_heavy: editingCustomer.base_price_heavy || undefined,
            base_price_machinery: editingCustomer.base_price_machinery || undefined,
            price_per_km: editingCustomer.price_per_km || undefined,
            minimum_price: editingCustomer.minimum_price || undefined,
          }
        )

        await saveCustomerSurcharges(priceListId, companyId, {
          time: (editingCustomer.customer_time_surcharges || []).map(s => ({
          name: s.name,
          label: s.label,
          time_description: s.time_description ?? null,
          time_start: s.time_start ?? null,
          time_end: s.time_end ?? null,
          surcharge_percent: s.surcharge_percent,
          day_type: s.day_type ?? 'weekday',
          sort_order: s.sort_order ?? 0,
          is_active: s.is_active,
        })),
          location: (editingCustomer.customer_location_surcharges || []).map(s => ({
            label: s.label,
            surcharge_percent: s.surcharge_percent,
            is_active: s.is_active,
          })),
          service: (editingCustomer.customer_service_surcharges || []).map(s => ({
            label: s.label,
            price: s.price,
            price_type: s.price_type,
            unit_label: s.unit_label,
            is_active: s.is_active,
          })),
        })
      }

      setCustomerPriceLists(prev => prev.map(c =>
        c.id === editingCustomer.id ? editingCustomer : c
      ))
      setShowCustomerModal(false)
      setEditingCustomer(null)
    } catch (error) {
      console.error('Error saving customer prices:', error)
      alert('שגיאה בשמירת מחירון הלקוח')
    }
  }

  // ==================== Render ====================

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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">מחירונים</h1>
          <p className="text-gray-500 text-sm">הגדרת מחירי גרירה ותוספות</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
            hasChanges && !saving
              ? 'bg-[#33d4ff] hover:bg-[#21b8e6] text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        {[
          { id: 'base', label: 'מחירון בסיס' },
          { id: 'fixed', label: 'מחירון כללי' },
          { id: 'surcharges', label: 'תוספות' },
          { id: 'customers', label: 'מחירוני לקוחות' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id 
                ? 'bg-white text-gray-800 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'base' && (
        <BasePriceTab
          baseLocation={baseLocation}
          onBaseLocationChange={(data) => { setBaseLocation(data); markChanged() }}
          vehiclePrices={vehiclePrices}
          onVehiclePriceChange={handleVehiclePriceChange}
          pricePerKm={pricePerKm}
          onPricePerKmChange={(v) => { setPricePerKm(v); markChanged() }}
          minimumPrice={minimumPrice}
          onMinimumPriceChange={(v) => { setMinimumPrice(v); markChanged() }}
        />
      )}

      {activeTab === 'fixed' && (
        <FixedPriceTab
          items={fixedPriceItems}
          onAdd={handleFixedPriceAdd}
          onUpdate={handleFixedPriceUpdate}
          onRemove={handleFixedPriceRemove}
          onMove={handleFixedPriceMove}
        />
      )}

      {activeTab === 'surcharges' && (
        <SurchargesTab
          timeSurcharges={timeSurcharges}
          onTimeSurchargeUpdate={handleTimeSurchargeUpdate}
          onTimeSurchargeAdd={handleTimeSurchargeAdd}
          onTimeSurchargeRemove={handleTimeSurchargeRemove}
          locationSurcharges={locationSurcharges}
          onLocationSurchargeUpdate={handleLocationSurchargeUpdate}
          onLocationSurchargeAdd={handleLocationSurchargeAdd}
          onLocationSurchargeRemove={handleLocationSurchargeRemove}
          serviceSurcharges={serviceSurcharges}
          onServiceSurchargeUpdate={handleServiceSurchargeUpdate}
          onServiceSurchargeAdd={handleServiceSurchargeAdd}
          onServiceSurchargeRemove={handleServiceSurchargeRemove}
        />
      )}

      {activeTab === 'customers' && (
        <div className="space-y-6">
          <CustomerPricingTab
            customers={customerPriceLists}
            onEdit={openCustomerModal}
          />
          <PriceSimulator
            vehiclePrices={vehiclePrices}
            timeSurcharges={timeSurcharges}
            customers={customerPriceLists}
            pricePerKm={pricePerKm}
            minimumPrice={minimumPrice}
          />
        </div>
      )}

      {/* Customer Edit Modal */}
      {showCustomerModal && editingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-[#33d4ff] text-white">
              <div>
                <h2 className="font-bold">מחירון מותאם</h2>
                <p className="text-white/80 text-sm">{editingCustomer.name}</p>
              </div>
              <button
                onClick={() => { setShowCustomerModal(false); setEditingCustomer(null) }}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-6 overflow-y-auto flex-1">

              {/* הנחה */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">הנחה כללית</h3>
                <div className="relative w-40">
                  <input
                    type="number"
                    value={editingCustomer.discount_percent}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, discount_percent: Number(e.target.value) })}
                    className="w-full pr-4 pl-8 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                </div>
              </div>

              {/* מחירי בסיס */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">מחירי בסיס לפי סוג רכב</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'base_price_private', label: 'רכב פרטי' },
                    { key: 'base_price_motorcycle', label: 'דו גלגלי' },
                    { key: 'base_price_heavy', label: 'רכב כבד' },
                    { key: 'base_price_machinery', label: 'צמ"ה' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <div className="relative">
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                        <input
                          type="number"
                          value={(editingCustomer as any)[key] || ''}
                          onChange={(e) => setEditingCustomer({ ...editingCustomer, [key]: Number(e.target.value) || null })}
                          placeholder="כמו מחירון כללי"
                          className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">מחיר לק"מ</label>
                    <div className="relative">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                      <input
                        type="number"
                        value={editingCustomer.price_per_km || ''}
                        onChange={(e) => setEditingCustomer({ ...editingCustomer, price_per_km: Number(e.target.value) || null })}
                        placeholder="כמו מחירון כללי"
                        className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">מחיר מינימום</label>
                    <div className="relative">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                      <input
                        type="number"
                        value={editingCustomer.minimum_price || ''}
                        onChange={(e) => setEditingCustomer({ ...editingCustomer, minimum_price: Number(e.target.value) || null })}
                        placeholder="כמו מחירון כללי"
                        className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* תוספות זמן */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">תוספות זמן</h3>
                  <button
                    onClick={() => setEditingCustomer({
                      ...editingCustomer,
                      customer_time_surcharges: [...(editingCustomer.customer_time_surcharges || []), {
                        id: `new_${Date.now()}`, name: '', label: '', time_start: '', time_end: '',
                        day_type: 'weekday', surcharge_percent: 0, is_active: true, sort_order: 0
                      }]
                    })}
                    className="text-xs text-[#33d4ff] flex items-center gap-1 hover:underline"
                  >
                    <Plus size={14} /> הוסף
                  </button>
                </div>
                <div className="space-y-2">
                  {(editingCustomer.customer_time_surcharges || []).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                      <input
                        type="text"
                        value={s.label}
                        onChange={(e) => {
                          const updated = [...(editingCustomer.customer_time_surcharges || [])]
                          updated[i] = { ...updated[i], label: e.target.value, name: e.target.value }
                          setEditingCustomer({ ...editingCustomer, customer_time_surcharges: updated })
                        }}
                        placeholder="שם"
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                      <select
                        value={s.day_type}
                        onChange={(e) => {
                          const updated = [...(editingCustomer.customer_time_surcharges || [])]
                          updated[i] = { ...updated[i], day_type: e.target.value }
                          setEditingCustomer({ ...editingCustomer, customer_time_surcharges: updated })
                        }}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
                      >
                        <option value="weekday">ימי חול</option>
                        <option value="friday">שישי</option>
                        <option value="saturday">שבת</option>
                        <option value="holiday">חג</option>
                      </select>
                      <div className="relative w-20">
                        <input
                          type="number"
                          value={s.surcharge_percent}
                          onChange={(e) => {
                            const updated = [...(editingCustomer.customer_time_surcharges || [])]
                            updated[i] = { ...updated[i], surcharge_percent: Number(e.target.value) }
                            setEditingCustomer({ ...editingCustomer, customer_time_surcharges: updated })
                          }}
                          className="w-full pl-5 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
                        />
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                      </div>
                      <button
                        onClick={() => setEditingCustomer({
                          ...editingCustomer,
                          customer_time_surcharges: (editingCustomer.customer_time_surcharges || []).filter((_, idx) => idx !== i)
                        })}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* תוספות מיקום */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">תוספות מיקום</h3>
                  <button
                    onClick={() => setEditingCustomer({
                      ...editingCustomer,
                      customer_location_surcharges: [...(editingCustomer.customer_location_surcharges || []), {
                        id: `new_${Date.now()}`, label: '', surcharge_percent: 0, is_active: true
                      }]
                    })}
                    className="text-xs text-[#33d4ff] flex items-center gap-1 hover:underline"
                  >
                    <Plus size={14} /> הוסף
                  </button>
                </div>
                <div className="space-y-2">
                  {(editingCustomer.customer_location_surcharges || []).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                      <input
                        type="text"
                        value={s.label}
                        onChange={(e) => {
                          const updated = [...(editingCustomer.customer_location_surcharges || [])]
                          updated[i] = { ...updated[i], label: e.target.value }
                          setEditingCustomer({ ...editingCustomer, customer_location_surcharges: updated })
                        }}
                        placeholder="שם"
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                      <div className="relative w-20">
                        <input
                          type="number"
                          value={s.surcharge_percent}
                          onChange={(e) => {
                            const updated = [...(editingCustomer.customer_location_surcharges || [])]
                            updated[i] = { ...updated[i], surcharge_percent: Number(e.target.value) }
                            setEditingCustomer({ ...editingCustomer, customer_location_surcharges: updated })
                          }}
                          className="w-full pl-5 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
                        />
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                      </div>
                      <button
                        onClick={() => setEditingCustomer({
                          ...editingCustomer,
                          customer_location_surcharges: (editingCustomer.customer_location_surcharges || []).filter((_, idx) => idx !== i)
                        })}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* תוספות שירות */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">תוספות שירות</h3>
                  <button
                    onClick={() => setEditingCustomer({
                      ...editingCustomer,
                      customer_service_surcharges: [...(editingCustomer.customer_service_surcharges || []), {
                        id: `new_${Date.now()}`, label: '', price: 0, price_type: 'fixed', unit_label: '', is_active: true
                      }]
                    })}
                    className="text-xs text-[#33d4ff] flex items-center gap-1 hover:underline"
                  >
                    <Plus size={14} /> הוסף
                  </button>
                </div>
                <div className="space-y-2">
                  {(editingCustomer.customer_service_surcharges || []).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                      <input
                        type="text"
                        value={s.label}
                        onChange={(e) => {
                          const updated = [...(editingCustomer.customer_service_surcharges || [])]
                          updated[i] = { ...updated[i], label: e.target.value }
                          setEditingCustomer({ ...editingCustomer, customer_service_surcharges: updated })
                        }}
                        placeholder="שם"
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                      <select
                        value={s.price_type}
                        onChange={(e) => {
                          const updated = [...(editingCustomer.customer_service_surcharges || [])]
                          updated[i] = { ...updated[i], price_type: e.target.value as any }
                          setEditingCustomer({ ...editingCustomer, customer_service_surcharges: updated })
                        }}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
                      >
                        <option value="fixed">קבוע</option>
                        <option value="per_unit">ליחידה</option>
                        <option value="manual">ידני</option>
                      </select>
                      <div className="relative w-24">
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                        <input
                          type="number"
                          value={s.price}
                          onChange={(e) => {
                            const updated = [...(editingCustomer.customer_service_surcharges || [])]
                            updated[i] = { ...updated[i], price: Number(e.target.value) }
                            setEditingCustomer({ ...editingCustomer, customer_service_surcharges: updated })
                          }}
                          className="w-full pr-7 pl-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={() => setEditingCustomer({
                          ...editingCustomer,
                          customer_service_surcharges: (editingCustomer.customer_service_surcharges || []).filter((_, idx) => idx !== i)
                        })}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* מחירים מותאמים (price items) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">מחירים קבועים</h3>
                  <button
                    onClick={() => setEditingCustomer({
                      ...editingCustomer,
                      price_items: [...editingCustomer.price_items, { id: `new_${Date.now()}`, label: '', price: 0 }]
                    })}
                    className="text-xs text-[#33d4ff] flex items-center gap-1 hover:underline"
                  >
                    <Plus size={14} /> הוסף
                  </button>
                </div>
                <div className="space-y-2">
                  {editingCustomer.price_items.map((price) => (
                    <div key={price.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={price.label}
                        onChange={(e) => setEditingCustomer({
                          ...editingCustomer,
                          price_items: editingCustomer.price_items.map(p =>
                            p.id === price.id ? { ...p, label: e.target.value } : p
                          )
                        })}
                        placeholder="קטגוריה"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                      <div className="relative w-24">
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                        <input
                          type="number"
                          value={price.price}
                          onChange={(e) => setEditingCustomer({
                            ...editingCustomer,
                            price_items: editingCustomer.price_items.map(p =>
                              p.id === price.id ? { ...p, price: Number(e.target.value) } : p
                            )
                          })}
                          className="w-full pr-7 pl-2 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <button
                        onClick={() => setEditingCustomer({
                          ...editingCustomer,
                          price_items: editingCustomer.price_items.filter(p => p.id !== price.id)
                        })}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="flex gap-3 px-5 py-4 border-t bg-gray-50">
              <button
                onClick={() => { setShowCustomerModal(false); setEditingCustomer(null) }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 font-medium"
              >
                ביטול
              </button>
              <button
                onClick={saveCustomerPrices}
                className="flex-1 py-2.5 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] font-medium"
              >
                שמור
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}