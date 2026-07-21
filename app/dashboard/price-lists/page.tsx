'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '../../lib/AuthContext'
import { Save, RefreshCw, X, Plus, Trash2 } from 'lucide-react'
import {
  getFullPriceList,
  upsertBasePriceList,
  getWeightBrackets,
  saveWeightBrackets,
  saveTimeSurcharges,
  saveLocationSurcharges,
  saveServiceSurcharges,
  updateCustomerPricing,
  saveFixedPriceItems,
  upsertCustomerPriceList,
  getCustomerPriceList,
  getCustomerSurcharges,
  saveCustomerSurcharges,
  searchCustomersForPricing,
  getCustomerPricingByCompanyId,
  type CustomerWithPricing,
} from '../../lib/queries/price-lists'
import { BasePriceTab } from './components/BasePriceTab'
import { FixedPriceTab } from './components/FixedPriceTab'
import { SurchargesTab } from './components/SurchargesTab'
import { CustomerPricingTab } from './components/CustomerPricingTab'
import { PriceSimulator } from './components/PriceSimulator'
import {
  TimeSurchargesEditor,
  createDefaultTimeSurchargeRow,
  resolveTimeSurchargeLabel,
} from './components/TimeSurchargesEditor'
import { CustomerServiceSurchargesModal } from './components/CustomerServiceSurchargesModal'
import {
  mergeCompanyServiceSurchargesForCustomer,
  type CustomerServiceSurchargeRow,
} from '../../lib/utils/customer-service-surcharges'

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

interface VehicleKmRate {
  id: string
  label: string
  field: string
  price: number | null
}

const DEFAULT_VEHICLE_KM_RATES: VehicleKmRate[] = [
  { id: 'private', label: 'רכב פרטי', field: 'price_per_km_private', price: null },
  { id: 'motorcycle', label: 'דו גלגלי', field: 'price_per_km_motorcycle', price: null },
  { id: 'heavy', label: 'רכב כבד', field: 'price_per_km_heavy', price: null },
  { id: 'machinery', label: 'צמ"ה', field: 'price_per_km_machinery', price: null },
]

function nullablePerTypeKm(value: number | null | undefined): number | null {
  if (value == null || value <= 0) return null
  return value
}

type WeightBracketRow = {
  id: string
  min_kg: number
  max_kg: number | null
  base_price: number
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
  is_vat_exempt?: boolean
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
  price_per_km_private?: number | null
  price_per_km_motorcycle?: number | null
  price_per_km_heavy?: number | null
  price_per_km_machinery?: number | null
  price_per_km_deadhead?: number | null
  minimum_price?: number | null
  customer_time_surcharges?: TimeSurcharge[]
  customer_location_surcharges?: LocationSurcharge[]
  /** Seeded from company services + customer overrides (always full company list in the modal). */
  customer_service_surcharges?: CustomerServiceSurchargeRow[]
}

function mapCustomerWithPricingToList(c: CustomerWithPricing): CustomerPriceList {
  return {
    id: c.customer_id,
    customer_company_id: c.id,
    name: c.customer?.name || '',
    type: c.customer?.customer_type === 'business' ? 'עסקי' : 'פרטי',
    discount_percent: c.discount_percent,
    price_items: c.price_items.map(p => ({
      id: p.id,
      label: p.label,
      price: p.price,
    })),
  }
}

// ==================== Component ====================

export default function PriceListsPage() {
  const { companyId, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const deepLinkOpenedRef = useRef(false)
  const [activeTab, setActiveTab] = useState<'base' | 'fixed' | 'surcharges' | 'customers'>('base')
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Customer modal state
  const [editingCustomer, setEditingCustomer] = useState<CustomerPriceList | null>(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showServiceSurchargesModal, setShowServiceSurchargesModal] = useState(false)
  const [serviceSurchargesModalRows, setServiceSurchargesModalRows] = useState<
    CustomerServiceSurchargeRow[]
  >([])

  // Base prices state
  const [baseLocation, setBaseLocation] = useState<BaseLocationData>({ address: '' })
  const [vehiclePrices, setVehiclePrices] = useState<VehiclePrice[]>([
    { id: 'private', label: 'רכב פרטי', field: 'base_price_private', price: 180 },
    { id: 'motorcycle', label: 'דו גלגלי', field: 'base_price_motorcycle', price: 100 },
    { id: 'heavy', label: 'רכב כבד', field: 'base_price_heavy', price: 350 },
    { id: 'machinery', label: 'צמ"ה', field: 'base_price_machinery', price: 500 },
  ])
  const [pricePerKm, setPricePerKm] = useState(12)
  const [pricePerKmDeadhead, setPricePerKmDeadhead] = useState<number | null>(null)
  const [minimumPrice, setMinimumPrice] = useState(250)
  const [vehicleKmRates, setVehicleKmRates] = useState<VehicleKmRate[]>(DEFAULT_VEHICLE_KM_RATES)
  const [weightBrackets, setWeightBrackets] = useState<WeightBracketRow[]>([])

  // Fixed prices state
  const [fixedPriceItems, setFixedPriceItems] = useState<FixedPriceItem[]>([])

  // Surcharges state
  const [timeSurcharges, setTimeSurcharges] = useState<TimeSurcharge[]>([])
  const [locationSurcharges, setLocationSurcharges] = useState<LocationSurcharge[]>([])
  const [serviceSurcharges, setServiceSurcharges] = useState<ServiceSurcharge[]>([])

  // Customer pricing state
  const [customerPriceLists, setCustomerPriceLists] = useState<CustomerPriceList[]>([])
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<Array<{
    customer_id: string
    customer_company_id: string
    name: string
    type: string
    phone?: string | null
    discount_percent: number
  }>>([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)

  // ==================== Load Data ====================

  const loadData = async () => {
    if (!companyId) return

    try {
      setLoading(true)
      const [data, brackets] = await Promise.all([
        getFullPriceList(companyId),
        getWeightBrackets(companyId).catch((bracketError) => {
          console.error('Error loading weight brackets:', bracketError)
          return null
        }),
      ])

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
        setPricePerKmDeadhead(bp.price_per_km_deadhead ?? null)
        setMinimumPrice(bp.minimum_price || 250)
        setVehicleKmRates([
          { id: 'private', label: 'רכב פרטי', field: 'price_per_km_private', price: bp.price_per_km_private ?? null },
          { id: 'motorcycle', label: 'דו גלגלי', field: 'price_per_km_motorcycle', price: bp.price_per_km_motorcycle ?? null },
          { id: 'heavy', label: 'רכב כבד', field: 'price_per_km_heavy', price: bp.price_per_km_heavy ?? null },
          { id: 'machinery', label: 'צמ"ה', field: 'price_per_km_machinery', price: bp.price_per_km_machinery ?? null },
        ])
        if (bp.base_address) {
          setBaseLocation({
            address: bp.base_address,
            lat: bp.base_lat ?? undefined,
            lng: bp.base_lng ?? undefined
          })
        }
      }

      if (brackets) {
        setWeightBrackets(
          brackets.map(b => ({ id: b.id, min_kg: b.min_kg, max_kg: b.max_kg, base_price: b.base_price }))
        )
      } else {
        setWeightBrackets([])
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
        setTimeSurcharges(data.timeSurcharges.map(t => {
          const label = resolveTimeSurchargeLabel(t)
          return {
            id: t.id,
            name: label,
            label,
            time_start: t.time_start || '',
            time_end: t.time_end || '',
            day_type: t.day_type || 'all',
            surcharge_percent: t.surcharge_percent,
            is_active: t.is_active,
          }
        }))
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
          is_active: s.is_active,
          is_vat_exempt: (s as any).is_vat_exempt === true,
        })))
      }

      // Customer pricing
      setCustomerPriceLists(
        (data.customersWithPricing ?? []).map(mapCustomerWithPricingToList)
      )
    } catch (error) {
      console.error('Error loading price list:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!companyId) { setLoading(false); return }
    loadData()
  }, [companyId, authLoading])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearchQuery.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearchQuery])

  useEffect(() => {
    if (!companyId || debouncedCustomerSearch.length < 2) {
      setCustomerSearchResults([])
      setCustomerSearchLoading(false)
      return
    }

    let cancelled = false
    setCustomerSearchLoading(true)
    searchCustomersForPricing(companyId, debouncedCustomerSearch)
      .then((hits) => {
        if (cancelled) return
        setCustomerSearchResults(hits.map(hit => ({
          customer_id: hit.customer_id,
          customer_company_id: hit.customer_company_id,
          name: hit.name,
          type: hit.customer_type === 'business' ? 'עסקי' : 'פרטי',
          phone: hit.phone,
          discount_percent: hit.discount_percent,
        })))
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Error searching customers for pricing:', error)
          setCustomerSearchResults([])
        }
      })
      .finally(() => {
        if (!cancelled) setCustomerSearchLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId, debouncedCustomerSearch])

  // ==================== Save ====================

  const handleSave = async () => {
    if (!companyId) return

    setSaving(true)
    try {
      // Base prices
      const basePriceData: Record<string, number | string | null> = {
        price_per_km: pricePerKm,
        price_per_km_deadhead: pricePerKmDeadhead,
        minimum_price: minimumPrice,
        base_address: baseLocation.address || null,
        base_lat: baseLocation.lat ?? null,
        base_lng: baseLocation.lng ?? null
      }
      vehiclePrices.forEach(v => {
        basePriceData[v.field] = v.price
      })
      vehicleKmRates.forEach(v => {
        basePriceData[v.field] = nullablePerTypeKm(v.price)
      })
      await upsertBasePriceList(companyId, basePriceData)

      await saveWeightBrackets(
        companyId,
        weightBrackets.map((b, i) => ({
          min_kg: b.min_kg,
          max_kg: b.max_kg,
          base_price: b.base_price,
          sort_order: i,
        }))
      )

      // Fixed prices
      await saveFixedPriceItems(companyId, fixedPriceItems.map((f, index) => ({
        label: f.label,
        description: f.description || undefined,
        price: f.price,
        sort_order: index
      })))

      // Time surcharges
      await saveTimeSurcharges(companyId, timeSurcharges.map(t => {
        const label = resolveTimeSurchargeLabel(t)
        return {
          name: label,
          label,
          time_description: t.day_type === 'all' ? `${t.time_start}-${t.time_end}` : '',
          time_start: t.time_start || null,
          time_end: t.time_end || null,
          day_type: t.day_type,
          surcharge_percent: t.surcharge_percent,
          is_active: t.is_active,
        }
      }))

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
        is_active: s.is_active,
        is_vat_exempt: s.is_vat_exempt === true,
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

  const handleVehicleKmRateChange = (id: string, price: number | null) => {
    setVehicleKmRates(prev => prev.map(v => v.id === id ? { ...v, price } : v))
    markChanged()
  }

  // Weight brackets
  const handleWeightBracketAdd = () => {
    setWeightBrackets(prev => [...prev, {
      id: `new_${Date.now()}`,
      min_kg: 0,
      max_kg: null,
      base_price: 0,
    }])
    markChanged()
  }

  const handleWeightBracketUpdate = (id: string, updates: Partial<WeightBracketRow>) => {
    setWeightBrackets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
    markChanged()
  }

  const handleWeightBracketRemove = (id: string) => {
    setWeightBrackets(prev => prev.filter(b => b.id !== id))
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
    setTimeSurcharges(prev => [...prev, createDefaultTimeSurchargeRow()])
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
      is_active: true,
      is_vat_exempt: false,
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

  const handleCustomerTimeSurchargeAdd = () => {
    if (!editingCustomer) return
    setEditingCustomer({
      ...editingCustomer,
      customer_time_surcharges: [
        ...(editingCustomer.customer_time_surcharges || []),
        { ...createDefaultTimeSurchargeRow(), sort_order: 0 },
      ],
    })
  }

  const handleCustomerTimeSurchargeUpdate = (id: string, updates: Partial<TimeSurcharge>) => {
    if (!editingCustomer) return
    setEditingCustomer({
      ...editingCustomer,
      customer_time_surcharges: (editingCustomer.customer_time_surcharges || []).map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })
  }

  const handleCustomerTimeSurchargeRemove = (id: string) => {
    if (!editingCustomer) return
    setEditingCustomer({
      ...editingCustomer,
      customer_time_surcharges: (editingCustomer.customer_time_surcharges || []).filter(
        (t) => t.id !== id
      ),
    })
  }

  // Customer pricing
  const openCustomerModal = async (customer: CustomerPriceList) => {
    const base: CustomerPriceList = { ...customer, price_items: [...customer.price_items] }

    let savedServices: ServiceSurcharge[] = []

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
      base.price_per_km_private = existingPriceList.price_per_km_private
      base.price_per_km_motorcycle = existingPriceList.price_per_km_motorcycle
      base.price_per_km_heavy = existingPriceList.price_per_km_heavy
      base.price_per_km_machinery = existingPriceList.price_per_km_machinery
      base.price_per_km_deadhead = existingPriceList.price_per_km_deadhead
      base.minimum_price = existingPriceList.minimum_price
      base.customer_time_surcharges = surcharges.timeSurcharges.map((s) => {
        const label = resolveTimeSurchargeLabel(s)
        return {
          ...s,
          name: label,
          label,
        }
      })
      base.customer_location_surcharges = surcharges.locationSurcharges
      savedServices = (surcharges.serviceSurcharges || []).map((s) => ({
        id: s.id,
        label: s.label,
        price: s.price,
        price_type: (s.price_type as ServiceSurcharge['price_type']) || 'fixed',
        unit_label: s.unit_label || '',
        is_active: s.is_active,
        is_vat_exempt: s.is_vat_exempt === true,
      }))
    } else {
      base.customer_time_surcharges = []
      base.customer_location_surcharges = []
    }

    // Always show the full company service list; overlay saved customer prices by label.
    // TODO(company-service-sync): new company services appear here on re-open; frozen catalogs
    // stay stale in calc until re-save (see customer-service-surcharges.ts).
    base.customer_service_surcharges = mergeCompanyServiceSurchargesForCustomer(
      serviceSurcharges,
      savedServices
    )

    setEditingCustomer(base)
    setShowCustomerModal(true)
  }

  const openCustomerByCompanyId = async (customerCompanyId: string) => {
    if (!companyId) return

    try {
      const full = await getCustomerPricingByCompanyId(companyId, customerCompanyId)
      if (!full) {
        console.error('Customer not found for pricing:', customerCompanyId)
        return
      }
      const target = mapCustomerWithPricingToList(full)
      setCustomerPriceLists(prev => {
        if (prev.some(c => c.customer_company_id === target.customer_company_id)) return prev
        return [...prev, target]
      })
      await openCustomerModal(target)
    } catch (error) {
      console.error('Error opening customer pricing:', error)
    }
  }

  const handleSelectSearchCustomer = async (customer: CustomerPriceList) => {
    setCustomerSearchQuery('')
    setCustomerSearchResults([])
    await openCustomerByCompanyId(customer.customer_company_id)
  }

  useEffect(() => {
    if (loading || authLoading || !companyId || deepLinkOpenedRef.current) return

    const tab = searchParams.get('tab')
    const customerCompanyId = searchParams.get('customer_company_id')

    if (tab === 'customers') {
      setActiveTab('customers')
    }

    if (!customerCompanyId) return

    deepLinkOpenedRef.current = true

    void (async () => {
      await openCustomerByCompanyId(customerCompanyId)
      router.replace('/dashboard/price-lists', { scroll: false })
    })()
  }, [loading, authLoading, companyId, searchParams, router])

  const saveCustomerPrices = async (
    customerOverride?: CustomerPriceList,
    options?: { closeCustomerModal?: boolean }
  ) => {
    const customer = customerOverride ?? editingCustomer
    if (!customer || !companyId) return
    const closeCustomerModal = options?.closeCustomerModal !== false

    try {
      // שמירת הנחה + price items (כמו קודם)
      await updateCustomerPricing(
        customer.customer_company_id,
        customer.discount_percent,
        customer.price_items.map((p) => ({ label: p.label, price: p.price }))
      )

      // שמירת מחירון מלא / תוספות לקוח (base/km אופציונלי)
      const hasCustomPricing =
        customer.base_price_private ||
        customer.base_price_motorcycle ||
        customer.base_price_heavy ||
        customer.base_price_machinery ||
        customer.price_per_km ||
        customer.price_per_km_private ||
        customer.price_per_km_motorcycle ||
        customer.price_per_km_heavy ||
        customer.price_per_km_machinery ||
        customer.price_per_km_deadhead

      const hasSurcharges =
        (customer.customer_time_surcharges?.length ?? 0) > 0 ||
        (customer.customer_location_surcharges?.length ?? 0) > 0 ||
        (customer.customer_service_surcharges?.length ?? 0) > 0

      if (hasCustomPricing || hasSurcharges) {
        const priceListId = await upsertCustomerPriceList(
          companyId,
          customer.customer_company_id,
          {
            base_price_private: customer.base_price_private ?? null,
            base_price_motorcycle: customer.base_price_motorcycle ?? null,
            base_price_heavy: customer.base_price_heavy ?? null,
            base_price_machinery: customer.base_price_machinery ?? null,
            price_per_km: customer.price_per_km ?? null,
            price_per_km_private: customer.price_per_km_private ?? null,
            price_per_km_motorcycle: customer.price_per_km_motorcycle ?? null,
            price_per_km_heavy: customer.price_per_km_heavy ?? null,
            price_per_km_machinery: customer.price_per_km_machinery ?? null,
            price_per_km_deadhead: customer.price_per_km_deadhead ?? null,
            minimum_price: customer.minimum_price ?? null,
          }
        )

        await saveCustomerSurcharges(priceListId, companyId, {
          time: (customer.customer_time_surcharges || []).map((s) => {
            const label = resolveTimeSurchargeLabel(s)
            return {
              name: label,
              label,
              time_description: s.time_description ?? null,
              time_start: s.time_start ?? null,
              time_end: s.time_end ?? null,
              surcharge_percent: s.surcharge_percent,
              day_type: s.day_type ?? 'weekday',
              sort_order: s.sort_order ?? 0,
              is_active: s.is_active,
            }
          }),
          location: (customer.customer_location_surcharges || []).map((s) => ({
            label: s.label,
            surcharge_percent: s.surcharge_percent,
            is_active: s.is_active,
          })),
          service: (customer.customer_service_surcharges || []).map((s) => ({
            label: s.label,
            price: s.price,
            price_type: s.price_type,
            unit_label: s.unit_label,
            is_active: s.is_active,
            is_vat_exempt: s.is_vat_exempt === true,
          })),
        })
      }

      setCustomerPriceLists((prev) => {
        const exists = prev.some((c) => c.id === customer.id)
        if (exists) {
          return prev.map((c) => (c.id === customer.id ? customer : c))
        }
        return [...prev, customer]
      })
      setEditingCustomer(customer)
      if (closeCustomerModal) {
        setShowCustomerModal(false)
        setEditingCustomer(null)
      }
    } catch (error) {
      console.error('Error saving customer prices:', error)
      alert('שגיאה בשמירת מחירון הלקוח')
      throw error
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
          vehicleKmRates={vehicleKmRates}
          onVehicleKmRateChange={handleVehicleKmRateChange}
          pricePerKm={pricePerKm}
          onPricePerKmChange={(v) => { setPricePerKm(v); markChanged() }}
          pricePerKmDeadhead={pricePerKmDeadhead}
          onPricePerKmDeadheadChange={(v) => { setPricePerKmDeadhead(v); markChanged() }}
          minimumPrice={minimumPrice}
          onMinimumPriceChange={(v) => { setMinimumPrice(v); markChanged() }}
          weightBrackets={weightBrackets}
          onWeightBracketAdd={handleWeightBracketAdd}
          onWeightBracketUpdate={handleWeightBracketUpdate}
          onWeightBracketRemove={handleWeightBracketRemove}
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
            searchQuery={customerSearchQuery}
            onSearchQueryChange={setCustomerSearchQuery}
            searchResults={customerSearchResults}
            searchLoading={customerSearchLoading}
            onSelectSearchResult={handleSelectSearchCustomer}
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
          <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-[#33d4ff] text-white">
              <div>
                <h2 className="font-bold">מחירון מותאם</h2>
                <p className="text-white/80 text-sm">{editingCustomer.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowServiceSurchargesModal(false)
                  setShowCustomerModal(false)
                  setEditingCustomer(null)
                }}
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
                <div className="grid grid-cols-3 gap-3 mt-3">
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
                    <label className="block text-xs text-gray-500 mb-1">מחיר לק"מ סרק</label>
                    <div className="relative">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                      <input
                        type="number"
                        value={editingCustomer.price_per_km_deadhead ?? ''}
                        onChange={(e) => setEditingCustomer({ ...editingCustomer, price_per_km_deadhead: Number(e.target.value) || null })}
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
                <p className="text-xs font-medium text-gray-500 mt-4 mb-2">
                  מחיר לק״מ לפי סוג רכב (ריק = לפי מחירון כללי)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'price_per_km_private', label: 'רכב פרטי' },
                    { key: 'price_per_km_motorcycle', label: 'דו גלגלי' },
                    { key: 'price_per_km_heavy', label: 'רכב כבד' },
                    { key: 'price_per_km_machinery', label: 'צמ"ה' },
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
              </div>

              {/* תוספות זמן */}
              <TimeSurchargesEditor
                rows={(editingCustomer.customer_time_surcharges || []).map((s) => ({
                  id: s.id,
                  name: s.name,
                  label: s.label,
                  time_start: s.time_start || '',
                  time_end: s.time_end || '',
                  day_type: s.day_type || 'all',
                  surcharge_percent: s.surcharge_percent,
                  is_active: s.is_active,
                }))}
                onUpdate={handleCustomerTimeSurchargeUpdate}
                onAdd={handleCustomerTimeSurchargeAdd}
                onRemove={handleCustomerTimeSurchargeRemove}
              />

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

              {/* תוספות שירות — dedicated modal (keeps this form uncluttered) */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">תוספות שירות</h3>
                <button
                  type="button"
                  onClick={() => {
                    setServiceSurchargesModalRows([
                      ...(editingCustomer.customer_service_surcharges || []),
                    ])
                    setShowServiceSurchargesModal(true)
                  }}
                  className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-right hover:border-[#33d4ff] hover:bg-white transition-colors"
                >
                  <span className="font-medium text-gray-800">
                    תוספות שירות (
                    {(editingCustomer.customer_service_surcharges || []).length})
                  </span>
                  <span className="text-xs text-[#33d4ff] font-medium">עריכה</span>
                </button>
                <p className="text-xs text-gray-400 mt-1.5">
                  מחירי שירות מותאמים ללקוח — נפתח במסך נפרד
                </p>
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
                onClick={() => {
                  setShowServiceSurchargesModal(false)
                  setShowCustomerModal(false)
                  setEditingCustomer(null)
                }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 font-medium"
              >
                ביטול
              </button>
              <button
                onClick={() => void saveCustomerPrices()}
                className="flex-1 py-2.5 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] font-medium"
              >
                שמור
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomerServiceSurchargesModal
        open={showServiceSurchargesModal && !!editingCustomer}
        customerName={editingCustomer?.name || ''}
        initialRows={serviceSurchargesModalRows}
        onClose={() => setShowServiceSurchargesModal(false)}
        onSave={async (rows) => {
          if (!editingCustomer) return
          const next: CustomerPriceList = {
            ...editingCustomer,
            customer_service_surcharges: rows,
          }
          await saveCustomerPrices(next, { closeCustomerModal: false })
        }}
      />


    </div>
  )
}