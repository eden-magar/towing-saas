'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, Check, AlertTriangle, Plus, Trash2, MapPin, Banknote, CreditCard, FileText, Truck, Tag, Calculator, Edit3 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../lib/AuthContext'
import { createTow } from '../../../lib/queries/tows'
import { getCustomers, CustomerWithDetails } from '../../../lib/queries/customers'
import { getDrivers } from '../../../lib/queries/drivers'
import { getTrucks } from '../../../lib/queries/trucks'
import { getBasePriceList, getCustomersWithPricing, getFixedPriceItems, CustomerWithPricing, FixedPriceItem } from '../../../lib/queries/price-lists'
import { DriverWithDetails, TruckWithDetails } from '../../../lib/types'

interface PriceItem {
  id: string
  label: string
  price: number
}

export default function NewTowPage() {
  const router = useRouter()
  const { user, companyId } = useAuth()
  const [showAssignNowModal, setShowAssignNowModal] = useState(false)
  const [savedTowId, setSavedTowId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  // נתונים מהדאטאבייס
  const [customers, setCustomers] = useState<CustomerWithDetails[]>([])
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [trucks, setTrucks] = useState<TruckWithDetails[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  
  // מחירון
  const [basePriceList, setBasePriceList] = useState<any>(null)
  const [fixedPriceItems, setFixedPriceItems] = useState<FixedPriceItem[]>([])
  const [customersWithPricing, setCustomersWithPricing] = useState<CustomerWithPricing[]>([])
  const [selectedCustomerPricing, setSelectedCustomerPricing] = useState<CustomerWithPricing | null>(null)
  
  // בחירת מחיר
  const [priceMode, setPriceMode] = useState<'recommended' | 'fixed' | 'customer' | 'custom'>('recommended')
  const [selectedPriceItem, setSelectedPriceItem] = useState<PriceItem | null>(null)
  const [customPrice, setCustomPrice] = useState<string>('')
  
  const [customerType, setCustomerType] = useState<'new' | 'existing'>('new')
  const [searchCustomer, setSearchCustomer] = useState('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  
  const [towDate, setTowDate] = useState('')
  const [towTime, setTowTime] = useState('')
  const [isToday, setIsToday] = useState(true)
  
  const [towType, setTowType] = useState<'single' | 'exchange' | 'multiple' | ''>('')
  
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [vehicleLoading, setVehicleLoading] = useState(false)
  const [vehicleData, setVehicleData] = useState<any>(null)
  const [vehicleType, setVehicleType] = useState('')
  const [towTruckType, setTowTruckType] = useState('')
  const [selectedDefects, setSelectedDefects] = useState<string[]>([])
  
  const [workingVehiclePlate, setWorkingVehiclePlate] = useState('')
  const [workingVehicleType, setWorkingVehicleType] = useState('')
  const [workingPickup, setWorkingPickup] = useState('')
  const [workingDropoff, setWorkingDropoff] = useState('')
  const [defectiveVehiclePlate, setDefectiveVehiclePlate] = useState('')
  const [defectiveVehicleType, setDefectiveVehicleType] = useState('')
  const [defectivePickup, setDefectivePickup] = useState('')
  const [defectiveDropoff, setDefectiveDropoff] = useState('')
  
  const [vehicles, setVehicles] = useState([{ id: 1, plate: '', type: '', defect: '', pickup: '', dropoff: '' }])
  
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [fromBase, setFromBase] = useState(false)
  const [toTerritories, setToTerritories] = useState(false)
  
  const [pickupContactName, setPickupContactName] = useState('')
  const [pickupContactPhone, setPickupContactPhone] = useState('')
  const [dropoffContactName, setDropoffContactName] = useState('')
  const [dropoffContactPhone, setDropoffContactPhone] = useState('')
  const [notes, setNotes] = useState('')
  
  const [invoiceName, setInvoiceName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'invoice'>('cash')
  const [creditCardNumber, setCreditCardNumber] = useState('')
  const [creditCardExpiry, setCreditCardExpiry] = useState('')
  const [creditCardCvv, setCreditCardCvv] = useState('')
  const [creditCardId, setCreditCardId] = useState('')

  const defects = ['תקר', 'מנוע', 'סוללה', 'תאונה', 'נעילה', 'אחר']

  // טעינת נתונים
  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId])

  const loadData = async () => {
    if (!companyId) return
    try {
      const [customersData, driversData, trucksData, basePriceData, fixedPricesData, customersPricingData] = await Promise.all([
        getCustomers(companyId),
        getDrivers(companyId),
        getTrucks(companyId),
        getBasePriceList(companyId),
        getFixedPriceItems(companyId),
        getCustomersWithPricing(companyId)
      ])
      setCustomers(customersData)
      setDrivers(driversData)
      setTrucks(trucksData)
      setBasePriceList(basePriceData)
      setFixedPriceItems(fixedPricesData)
      setCustomersWithPricing(customersPricingData)
    } catch (err) {
      console.error('Error loading data:', err)
    }
  }

  // כשבוחרים לקוח - בדיקה אם יש לו מחירון
  useEffect(() => {
    if (selectedCustomerId) {
      const customerPricing = customersWithPricing.find(c => c.customer_id === selectedCustomerId)
      setSelectedCustomerPricing(customerPricing || null)
    } else {
      setSelectedCustomerPricing(null)
    }
    // איפוס בחירת מחיר כשמחליפים לקוח
    setPriceMode('recommended')
    setSelectedPriceItem(null)
    setCustomPrice('')
  }, [selectedCustomerId, customersWithPricing])

  // סינון לקוחות לפי חיפוש
  const filteredCustomers = customers.filter(c => {
    if (!searchCustomer) return false
    const query = searchCustomer.toLowerCase()
    return c.name.toLowerCase().includes(query) || 
           (c.phone && c.phone.includes(query)) ||
           (c.id_number && c.id_number.includes(query))
  })

  // חישוב מחיר מומלץ
  const calculateRecommendedPrice = () => {
    if (!basePriceList) return 0
    
    const vehicleTypeMap: Record<string, string> = {
      'motorcycle': 'base_price_motorcycle',
      'small': 'base_price_small',
      'medium': 'base_price_medium',
      'large': 'base_price_large',
      'truck': 'base_price_truck'
    }
    
    const priceField = vehicleTypeMap[vehicleType] || 'base_price_medium'
    const basePrice = basePriceList[priceField] || 180
    const pricePerKm = basePriceList.price_per_km || 12
    const minimumPrice = basePriceList.minimum_price || 250
    
    // לצורך הדגמה - מרחק קבוע של 22 ק"מ
    const distance = 22
    let total = basePrice + (distance * pricePerKm)
    
    if (toTerritories) {
      total *= 1.25
    }
    
    // הנחת לקוח
    if (selectedCustomerPricing && selectedCustomerPricing.discount_percent) {
      total = total * (1 - selectedCustomerPricing.discount_percent / 100)
    }
    
    return Math.max(Math.round(total), minimumPrice)
  }

  // חישוב מחיר סופי
  const calculateFinalPrice = () => {
    if (priceMode === 'custom' && customPrice) {
      return parseFloat(customPrice)
    }
    
    if ((priceMode === 'fixed' || priceMode === 'customer') && selectedPriceItem) {
      let price = selectedPriceItem.price
      // הנחת לקוח רק במחירון הכללי
      if (priceMode === 'fixed' && selectedCustomerPricing && selectedCustomerPricing.discount_percent) {
        price = price * (1 - selectedCustomerPricing.discount_percent / 100)
      }
      return Math.round(price)
    }
    
    return calculateRecommendedPrice()
  }

  const recommendedPrice = calculateRecommendedPrice()
  const finalPrice = calculateFinalPrice()

  const lookupVehicle = () => {
    if (vehiclePlate.length >= 5) {
      setVehicleLoading(true)
      setTimeout(() => {
        setVehicleData({
          plate: vehiclePlate,
          manufacturer: 'טויוטה',
          model: 'קורולה',
          year: 2021,
          color: 'לבן'
        })
        setVehicleLoading(false)
      }, 800)
    }
  }

  const toggleDefect = (defect: string) => {
    if (selectedDefects.includes(defect)) {
      setSelectedDefects(selectedDefects.filter(d => d !== defect))
    } else {
      setSelectedDefects([...selectedDefects, defect])
    }
  }

  const addVehicle = () => {
    setVehicles([...vehicles, { id: vehicles.length + 1, plate: '', type: '', defect: '', pickup: '', dropoff: '' }])
  }

  const removeVehicle = (id: number) => {
    if (vehicles.length > 1) {
      setVehicles(vehicles.filter(v => v.id !== id))
    }
  }

  const updateVehicle = (id: number, field: string, value: string) => {
    setVehicles(vehicles.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  const copyFromCustomer = (target: 'pickup' | 'dropoff') => {
    if (target === 'pickup') {
      setPickupContactName(customerName)
      setPickupContactPhone(customerPhone)
    } else {
      setDropoffContactName(customerName)
      setDropoffContactPhone(customerPhone)
    }
  }

  const copyFromWorkingDestination = () => {
    setDefectivePickup(workingDropoff)
  }

  const handleSave = async () => {
    if (!companyId || !user) return
    
    setSaving(true)
    setError('')
    
    try {
      const vehiclesData = towType === 'single' ? [{
        plateNumber: vehiclePlate,
        vehicleType: vehicleType as any || undefined,
        isWorking: false,
        towReason: selectedDefects.join(', ') || undefined
      }] : towType === 'exchange' ? [
        { plateNumber: workingVehiclePlate, vehicleType: workingVehicleType as any || undefined, isWorking: true },
        { plateNumber: defectiveVehiclePlate, vehicleType: defectiveVehicleType as any || undefined, isWorking: false }
      ] : vehicles.map(v => ({
        plateNumber: v.plate,
        vehicleType: v.type as any || undefined,
        isWorking: false,
        towReason: v.defect || undefined
      }))

      const legsData = towType === 'single' ? [
        { legType: 'pickup' as const, fromAddress: pickupAddress, toAddress: dropoffAddress }
      ] : towType === 'exchange' ? [
        { legType: 'pickup' as const, fromAddress: workingPickup, toAddress: workingDropoff, towVehicleIndex: 0 },
        { legType: 'pickup' as const, fromAddress: defectivePickup, toAddress: defectiveDropoff, towVehicleIndex: 1 }
      ] : vehicles.map((v, i) => ({
        legType: 'pickup' as const,
        fromAddress: v.pickup,
        toAddress: v.dropoff,
        towVehicleIndex: i
      }))

      const result = await createTow({
        companyId,
        createdBy: user.id,
        customerId: selectedCustomerId || undefined,
        towType: towType === 'single' ? 'simple' : towType === 'exchange' ? 'transfer' : 'multi_vehicle',
        notes: notes || undefined,
        finalPrice: finalPrice || undefined,
        vehicles: vehiclesData,
        legs: legsData
      })

      setSavedTowId(result.id)
      setShowAssignNowModal(true)
    } catch (err) {
      console.error('Error creating tow:', err)
      setError('שגיאה ביצירת הגרירה')
    } finally {
      setSaving(false)
    }
  }

  const handleAssignNow = () => {
    router.push(`/dashboard/tows/${savedTowId}`)
  }

  const handleAssignLater = () => {
    router.push('/dashboard/tows')
  }

  // רכיב בחירת מחיר
  const PriceSelector = () => {
    const hasCustomerPricing = selectedCustomerPricing && selectedCustomerPricing.price_items.length > 0
    const hasFixedPrices = fixedPriceItems.length > 0

    return (
      <div className="space-y-3">
        {/* מחיר מומלץ */}
        <button
          onClick={() => {
            setPriceMode('recommended')
            setSelectedPriceItem(null)
            setCustomPrice('')
          }}
          className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
            priceMode === 'recommended'
              ? 'border-[#33d4ff] bg-[#33d4ff]/5'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                priceMode === 'recommended' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <Calculator size={20} />
              </div>
              <div>
                <p className={`font-medium ${priceMode === 'recommended' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>
                  מחיר מומלץ
                </p>
                <p className="text-xs text-gray-500">חישוב אוטומטי לפי מחירון</p>
              </div>
            </div>
            <span className={`text-xl font-bold ${priceMode === 'recommended' ? 'text-[#33d4ff]' : 'text-gray-800'}`}>
              ₪{recommendedPrice}
            </span>
          </div>
        </button>

        {/* מחירון כללי */}
        {hasFixedPrices && (
          <div className={`rounded-xl border-2 transition-all overflow-hidden ${
            priceMode === 'fixed' ? 'border-emerald-500' : 'border-gray-200'
          }`}>
            <button
              onClick={() => {
                setPriceMode('fixed')
                setSelectedPriceItem(null)
                setCustomPrice('')
              }}
              className={`w-full p-4 text-right ${priceMode === 'fixed' ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  priceMode === 'fixed' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <FileText size={20} />
                </div>
                <div>
                  <p className={`font-medium ${priceMode === 'fixed' ? 'text-emerald-700' : 'text-gray-700'}`}>
                    מחירון כללי
                  </p>
                  <p className="text-xs text-gray-500">תעריפים קבועים</p>
                </div>
              </div>
            </button>
            
            {priceMode === 'fixed' && (
              <div className="p-3 pt-0 space-y-2">
                {fixedPriceItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedPriceItem({ id: item.id, label: item.label, price: item.price })}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                      selectedPriceItem?.id === item.id
                        ? 'border-emerald-500 bg-emerald-100'
                        : 'border-gray-200 bg-white hover:border-emerald-300'
                    }`}
                  >
                    <div className="text-right">
                      <span className={`font-medium ${selectedPriceItem?.id === item.id ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {item.label}
                      </span>
                      {item.description && (
                        <p className="text-xs text-gray-500">{item.description}</p>
                      )}
                    </div>
                    <span className={`font-bold ${selectedPriceItem?.id === item.id ? 'text-emerald-700' : 'text-gray-800'}`}>
                      ₪{item.price}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* מחירון לקוח - רק אם נבחר לקוח עסקי עם מחירון */}
        {hasCustomerPricing && (
          <div className={`rounded-xl border-2 transition-all overflow-hidden ${
            priceMode === 'customer' ? 'border-purple-500' : 'border-gray-200'
          }`}>
            <button
              onClick={() => {
                setPriceMode('customer')
                setSelectedPriceItem(null)
                setCustomPrice('')
              }}
              className={`w-full p-4 text-right ${priceMode === 'customer' ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  priceMode === 'customer' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Tag size={20} />
                </div>
                <div>
                  <p className={`font-medium ${priceMode === 'customer' ? 'text-purple-700' : 'text-gray-700'}`}>
                    מחירון {selectedCustomerPricing?.customer?.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    מחירון מותאם ללקוח
                    {(selectedCustomerPricing?.discount_percent ?? 0) > 0 && (
                      <span className="mr-2 text-purple-600">• הנחה {selectedCustomerPricing?.discount_percent}%</span>
                    )}
                  </p>
                </div>
              </div>
            </button>
            
            {priceMode === 'customer' && selectedCustomerPricing && (
              <div className="p-3 pt-0 space-y-2">
                {selectedCustomerPricing.price_items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedPriceItem({ id: item.id, label: item.label, price: item.price })}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                      selectedPriceItem?.id === item.id
                        ? 'border-purple-500 bg-purple-100'
                        : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <span className={`font-medium ${selectedPriceItem?.id === item.id ? 'text-purple-700' : 'text-gray-700'}`}>
                      {item.label}
                    </span>
                    <span className={`font-bold ${selectedPriceItem?.id === item.id ? 'text-purple-700' : 'text-gray-800'}`}>
                      ₪{item.price}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* מחיר ידני */}
        <div className={`rounded-xl border-2 transition-all overflow-hidden ${
          priceMode === 'custom' ? 'border-amber-500' : 'border-gray-200'
        }`}>
          <button
            onClick={() => {
              setPriceMode('custom')
              setSelectedPriceItem(null)
            }}
            className={`w-full p-4 text-right ${priceMode === 'custom' ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                priceMode === 'custom' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <Edit3 size={20} />
              </div>
              <div>
                <p className={`font-medium ${priceMode === 'custom' ? 'text-amber-700' : 'text-gray-700'}`}>
                  מחיר ידני
                </p>
                <p className="text-xs text-gray-500">הזן מחיר אחר</p>
              </div>
            </div>
          </button>
          
          {priceMode === 'custom' && (
            <div className="p-3 pt-0">
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                <input
                  type="number"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="הזן מחיר"
                  className="w-full pr-8 pl-4 py-3 border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium text-lg"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // רכיב סיכום מחיר (סיידבר)
  const PriceSummary = ({ isMobile = false }: { isMobile?: boolean }) => {
    if (!towType) {
      return (
        <div className={`text-center ${isMobile ? 'py-4' : 'py-8'} text-gray-400`}>
          {!isMobile && (
            <div className="w-12 h-12 mx-auto mb-3 opacity-50 bg-gray-100 rounded-xl flex items-center justify-center">
              <FileText size={24} />
            </div>
          )}
          <p className="text-sm">בחר סוג גרירה לחישוב מחיר</p>
        </div>
      )
    }

    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="space-y-2 text-sm">
          {priceMode === 'recommended' && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">מחיר בסיס</span>
                <span className="text-gray-700">₪{basePriceList?.[`base_price_${vehicleType || 'medium'}`] || 180}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">מרחק: 22 ק״מ</span>
                <span className="text-gray-700">₪{22 * (basePriceList?.price_per_km || 12)}</span>
              </div>
              {toTerritories && (
                <div className="flex justify-between text-amber-600">
                  <span>שטחים (+25%)</span>
                  <span>+25%</span>
                </div>
              )}
            </>
          )}

          {priceMode === 'fixed' && selectedPriceItem && (
            <div className="flex justify-between">
              <span className="text-gray-500">{selectedPriceItem.label}</span>
              <span className="text-gray-700">₪{selectedPriceItem.price}</span>
            </div>
          )}

          {priceMode === 'customer' && selectedPriceItem && (
            <div className="flex justify-between">
              <span className="text-gray-500">{selectedPriceItem.label}</span>
              <span className="text-gray-700">₪{selectedPriceItem.price}</span>
            </div>
          )}

          {priceMode === 'custom' && customPrice && (
            <div className="flex justify-between">
              <span className="text-gray-500">מחיר ידני</span>
              <span className="text-gray-700">₪{customPrice}</span>
            </div>
          )}

          {selectedCustomerPricing && selectedCustomerPricing.discount_percent > 0 && priceMode === 'fixed' && (
            <div className="flex justify-between text-emerald-600">
              <span>הנחת לקוח</span>
              <span>-{selectedCustomerPricing.discount_percent}%</span>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 pt-3">
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-800">סה״כ</span>
            <span className={`font-bold text-gray-800 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
              ₪{finalPrice || 0}
            </span>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-[#33d4ff] text-white font-medium rounded-xl hover:bg-[#21b8e6] transition-colors disabled:bg-gray-300"
        >
          {saving ? 'שומר...' : 'שמור גרירה'}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error}
        </div>
      )}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/tows" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <ArrowRight size={20} />
              </Link>
              <div>
                <h1 className="font-bold text-gray-800 text-base sm:text-lg">גרירה חדשה</h1>
                <p className="text-xs text-gray-500 hidden sm:block">מילוי פרטי הגרירה</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 sm:py-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="flex-1 space-y-4 sm:space-y-6">
            
            {/* סעיף 1 - פרטי לקוח */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">1</span>
                  פרטי לקוח
                </h2>
              </div>
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCustomerType('existing'); setSelectedCustomerId(null); setCustomerName(''); setCustomerPhone(''); setSearchCustomer(''); }}
                    className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-sm font-medium transition-colors ${
                      customerType === 'existing'
                        ? 'bg-[#33d4ff] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    לקוח קיים
                  </button>
                  <button
                    onClick={() => { setCustomerType('new'); setSelectedCustomerId(null); setSearchCustomer(''); }}
                    className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-sm font-medium transition-colors ${
                      customerType === 'new'
                        ? 'bg-[#33d4ff] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    לקוח חדש
                  </button>
                </div>

                {customerType === 'existing' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">חיפוש לקוח</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="שם, טלפון או ח.פ..."
                        value={searchCustomer}
                        onChange={(e) => {
                          setSearchCustomer(e.target.value)
                          setShowCustomerResults(e.target.value.length > 0)
                        }}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                      {showCustomerResults && filteredCustomers.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-60 overflow-y-auto">
                          {filteredCustomers.map((customer) => (
                            <div
                              key={customer.id}
                              onClick={() => {
                                setSelectedCustomerId(customer.id)
                                setCustomerName(customer.name)
                                setCustomerPhone(customer.phone || '')
                                setSearchCustomer(customer.name)
                                setShowCustomerResults(false)
                              }}
                              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-800">{customer.name}</p>
                                  <p className="text-sm text-gray-500">{customer.phone}</p>
                                </div>
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  customer.customer_type === 'business'
                                    ? 'bg-purple-100 text-purple-600' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {customer.customer_type === 'business' ? 'עסקי' : 'פרטי'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedCustomerId && (
                      <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-center gap-2 text-emerald-700">
                          <Check size={18} />
                          <span className="font-medium">{customerName}</span>
                          {selectedCustomerPricing && (selectedCustomerPricing.discount_percent > 0 || selectedCustomerPricing.price_items.length > 0) && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full mr-auto">
                            יש מחירון מותאם
                          </span>
                        )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">שם לקוח <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">טלפון <span className="text-red-500">*</span></label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">תאריך ביצוע</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsToday(true)}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                          isToday ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        היום
                      </button>
                      <input
                        type="date"
                        value={towDate}
                        onChange={(e) => {
                          setTowDate(e.target.value)
                          setIsToday(false)
                        }}
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">שעה</label>
                    <input
                      type="time"
                      value={towTime}
                      onChange={(e) => setTowTime(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* סעיף 2 - סוג גרירה */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">2</span>
                  סוג גרירה
                </h2>
              </div>
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <button
                    onClick={() => setTowType('single')}
                    className={`p-3 sm:p-4 rounded-xl border-2 text-center transition-all ${
                      towType === 'single'
                        ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
                      towType === 'single' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <ArrowRight size={18} className="rotate-180" />
                    </div>
                    <p className={`font-medium text-xs sm:text-sm ${towType === 'single' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>רכב תקול</p>
                    <p className="text-xs text-gray-500 mt-1 hidden sm:block">גרירה רגילה</p>
                  </button>

                  <button
                    onClick={() => setTowType('exchange')}
                    className={`p-3 sm:p-4 rounded-xl border-2 text-center transition-all ${
                      towType === 'exchange'
                        ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
                      towType === 'exchange' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <ArrowRight size={18} />
                    </div>
                    <p className={`font-medium text-xs sm:text-sm ${towType === 'exchange' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>תקין-תקול</p>
                    <p className="text-xs text-gray-500 mt-1 hidden sm:block">מסירה + איסוף</p>
                  </button>

                  <button
                    onClick={() => setTowType('multiple')}
                    className={`p-3 sm:p-4 rounded-xl border-2 text-center transition-all ${
                      towType === 'multiple'
                        ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
                      towType === 'multiple' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <Plus size={18} />
                    </div>
                    <p className={`font-medium text-xs sm:text-sm ${towType === 'multiple' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>מרובה</p>
                    <p className="text-xs text-gray-500 mt-1 hidden sm:block">כמה רכבים</p>
                  </button>
                </div>
              </div>
            </div>

            {/* סעיף 3 - פרטי רכב */}
            {towType && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">3</span>
                    פרטי רכב
                  </h2>
                </div>

                {towType === 'single' && (
                  <div className="p-4 sm:p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">מספר רכב <span className="text-red-500">*</span></label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={vehiclePlate}
                          onChange={(e) => setVehiclePlate(e.target.value)}
                          placeholder="12-345-67"
                          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono"
                        />
                        <button
                          onClick={lookupVehicle}
                          disabled={vehicleLoading}
                          className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          {vehicleLoading ? (
                            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                          ) : (
                            'חפש'
                          )}
                        </button>
                      </div>

                      {vehicleData && (
                        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <Check size={20} />
                            <span className="font-medium text-sm">{vehicleData.manufacturer} {vehicleData.model}, {vehicleData.year}, {vehicleData.color}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">סוג רכב</label>
                        <select
                          value={vehicleType}
                          onChange={(e) => setVehicleType(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                        >
                          <option value="">בחר סוג</option>
                          <option value="motorcycle">אופנוע</option>
                          <option value="small">רכב קטן</option>
                          <option value="medium">רכב בינוני</option>
                          <option value="large">רכב גדול / ג׳יפ</option>
                          <option value="truck">משאית קלה</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">סוג גרר</label>
                        <select
                          value={towTruckType}
                          onChange={(e) => setTowTruckType(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                        >
                          <option value="">בחר גרר</option>
                          <option value="crane_tow">גרר מנוף</option>
                          <option value="dolly">דולי (מערסל ידני)</option>
                          <option value="heavy_rescue">חילוץ כבד</option>
                          <option value="carrier">מובילית</option>
                          <option value="carrier_large">מובילית 10+ רכבים</option>
                          <option value="wheel_lift_cradle">משקפיים (מערסל)</option>
                          <option value="heavy_equipment">ציוד כבד/לובי</option>
                          <option value="flatbed_ramsa">רמסע</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">תקלה</label>
                      <div className="flex flex-wrap gap-2">
                        {defects.map((defect) => (
                          <button
                            key={defect}
                            onClick={() => toggleDefect(defect)}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              selectedDefects.includes(defect)
                                ? 'bg-[#33d4ff] text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {defect}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {towType === 'exchange' && (
                  <div className="p-4 sm:p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      {/* רכב תקין */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Check size={16} className="text-emerald-600" />
                          </div>
                          <h3 className="font-bold text-gray-800">רכב תקין</h3>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">מספר רכב</label>
                          <input type="text" value={workingVehiclePlate} onChange={(e) => setWorkingVehiclePlate(e.target.value)} placeholder="12-345-67" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">סוג רכב</label>
                          <select value={workingVehicleType} onChange={(e) => setWorkingVehicleType(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white">
                            <option value="">בחר סוג</option>
                            <option value="small">רכב קטן</option>
                            <option value="medium">רכב בינוני</option>
                            <option value="large">רכב גדול</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">מוצא</label>
                          <input type="text" value={workingPickup} onChange={(e) => setWorkingPickup(e.target.value)} placeholder="כתובת מוצא" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">יעד</label>
                          <input type="text" value={workingDropoff} onChange={(e) => setWorkingDropoff(e.target.value)} placeholder="כתובת יעד" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" />
                        </div>
                      </div>

                      {/* רכב תקול */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                            <AlertTriangle size={16} className="text-red-600" />
                          </div>
                          <h3 className="font-bold text-gray-800">רכב תקול</h3>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">מספר רכב</label>
                          <input type="text" value={defectiveVehiclePlate} onChange={(e) => setDefectiveVehiclePlate(e.target.value)} placeholder="12-345-67" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">סוג רכב</label>
                          <select value={defectiveVehicleType} onChange={(e) => setDefectiveVehicleType(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white">
                            <option value="">בחר סוג</option>
                            <option value="small">רכב קטן</option>
                            <option value="medium">רכב בינוני</option>
                            <option value="large">רכב גדול</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">מוצא</label>
                          <div className="flex gap-2">
                            <input type="text" value={defectivePickup} onChange={(e) => setDefectivePickup(e.target.value)} placeholder="כתובת מוצא" className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" />
                            <button onClick={copyFromWorkingDestination} className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs hover:bg-gray-200 whitespace-nowrap">העתק</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">יעד</label>
                          <input type="text" value={defectiveDropoff} onChange={(e) => setDefectiveDropoff(e.target.value)} placeholder="כתובת יעד" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {towType === 'multiple' && (
                  <div className="p-4 sm:p-5 space-y-4">
                    {vehicles.map((vehicle, index) => (
                      <div key={vehicle.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-gray-800">רכב {index + 1}</h4>
                          {vehicles.length > 1 && (
                            <button onClick={() => removeVehicle(vehicle.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">מספר רכב</label>
                            <input type="text" value={vehicle.plate} onChange={(e) => updateVehicle(vehicle.id, 'plate', e.target.value)} placeholder="12-345-67" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">סוג רכב</label>
                            <select value={vehicle.type} onChange={(e) => updateVehicle(vehicle.id, 'type', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white">
                              <option value="">בחר סוג</option>
                              <option value="small">רכב קטן</option>
                              <option value="medium">רכב בינוני</option>
                              <option value="large">רכב גדול</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">תקלה</label>
                            <select value={vehicle.defect} onChange={(e) => updateVehicle(vehicle.id, 'defect', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white">
                              <option value="">בחר תקלה</option>
                              <option value="flat">תקר</option>
                              <option value="engine">מנוע</option>
                              <option value="battery">סוללה</option>
                              <option value="accident">תאונה</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">מוצא</label>
                            <input type="text" value={vehicle.pickup} onChange={(e) => updateVehicle(vehicle.id, 'pickup', e.target.value)} placeholder="כתובת מוצא" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">יעד</label>
                            <input type="text" value={vehicle.dropoff} onChange={(e) => updateVehicle(vehicle.id, 'dropoff', e.target.value)} placeholder="כתובת יעד" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={addVehicle} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#33d4ff] hover:text-[#33d4ff] transition-colors flex items-center justify-center gap-2">
                      <Plus size={20} />
                      הוסף רכב נוסף
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* סעיף 4 - מסלול (רק לגרירה רגילה) */}
            {towType === 'single' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">4</span>
                    מסלול
                  </h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex flex-col items-center pt-3">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                      <div className="w-0.5 h-16 bg-gray-200"></div>
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">מוצא <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                          <input type="text" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="הזן כתובת" className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" />
                          <button className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200">
                            <MapPin size={20} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">יעד <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                          <input type="text" value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} placeholder="הזן כתובת" className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" />
                          <button className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200">
                            <MapPin size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button onClick={() => setFromBase(!fromBase)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${fromBase ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      יציאה מהבסיס
                    </button>
                    <button onClick={() => setToTerritories(!toTerritories)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${toTerritories ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      שטחים (+25%)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* סעיף 5 - מחיר */}
            {towType && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">{towType === 'single' ? '5' : '4'}</span>
                    מחיר
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  <PriceSelector />
                </div>
              </div>
            )}

            {/* סעיף 6 - פרטים נוספים */}
            {towType && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">{towType === 'single' ? '6' : '5'}</span>
                    פרטים נוספים
                  </h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-700 mb-3 text-sm">איש קשר במוצא</h4>
                      <div className="space-y-3">
                        <input type="text" value={pickupContactName} onChange={(e) => setPickupContactName(e.target.value)} placeholder="שם" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                        <div className="flex gap-2">
                          <input type="tel" value={pickupContactPhone} onChange={(e) => setPickupContactPhone(e.target.value)} placeholder="טלפון" className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                          <button onClick={() => copyFromCustomer('pickup')} className="px-3 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-100 whitespace-nowrap">זהה ללקוח</button>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-700 mb-3 text-sm">איש קשר ביעד</h4>
                      <div className="space-y-3">
                        <input type="text" value={dropoffContactName} onChange={(e) => setDropoffContactName(e.target.value)} placeholder="שם" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                        <div className="flex gap-2">
                          <input type="tel" value={dropoffContactPhone} onChange={(e) => setDropoffContactPhone(e.target.value)} placeholder="טלפון" className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                          <button onClick={() => copyFromCustomer('dropoff')} className="px-3 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-100 whitespace-nowrap">זהה ללקוח</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="הערות נוספות לגרירה..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] resize-none"></textarea>
                  </div>
                </div>
              </div>
            )}

            {/* סעיף 7 - תשלום */}
            {towType && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">{towType === 'single' ? '7' : '6'}</span>
                    תשלום
                  </h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">שם לחשבונית</label>
                    <div className="flex gap-2">
                      <input type="text" value={invoiceName} onChange={(e) => setInvoiceName(e.target.value)} placeholder="שם לחשבונית" className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" />
                      <button onClick={() => setInvoiceName(customerName)} className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs hover:bg-gray-200 whitespace-nowrap">זהה ללקוח</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">אמצעי תשלום</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setPaymentMethod('cash')} className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${paymentMethod === 'cash' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <Banknote size={18} />
                        <span>מזומן</span>
                      </button>
                      <button onClick={() => setPaymentMethod('credit')} className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${paymentMethod === 'credit' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <CreditCard size={18} />
                        <span>אשראי</span>
                      </button>
                      <button onClick={() => setPaymentMethod('invoice')} className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${paymentMethod === 'invoice' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <FileText size={18} />
                        <span>חשבונית</span>
                      </button>
                    </div>
                  </div>

                  {paymentMethod === 'credit' && (
                    <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">מספר כרטיס</label>
                        <input type="text" value={creditCardNumber} onChange={(e) => setCreditCardNumber(e.target.value)} placeholder="0000-0000-0000-0000" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">תוקף</label>
                          <input type="text" value={creditCardExpiry} onChange={(e) => setCreditCardExpiry(e.target.value)} placeholder="MM/YY" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                          <input type="text" value={creditCardCvv} onChange={(e) => setCreditCardCvv(e.target.value)} placeholder="000" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">ת.ז.</label>
                          <input type="text" value={creditCardId} onChange={(e) => setCreditCardId(e.target.value)} placeholder="123456789" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* סיכום מחיר - מובייל */}
            <div className="lg:hidden">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-800 text-white">
                  <h3 className="font-bold text-sm">סיכום מחיר</h3>
                </div>
                <div className="p-4">
                  <PriceSummary isMobile />
                </div>
              </div>
            </div>
          </div>

          {/* סיידבר - סיכום מחיר */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-24">
              <div className="px-5 py-4 bg-gray-800 text-white">
                <h3 className="font-bold">סיכום מחיר</h3>
              </div>
              <div className="p-5">
                <PriceSummary />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* מודל הצלחה */}
      {showAssignNowModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">הגרירה נשמרה בהצלחה!</h2>
              <p className="text-gray-500 mb-2">מחיר: <span className="font-bold">₪{finalPrice}</span></p>
              <p className="text-gray-600">האם לשבץ נהג עכשיו?</p>
            </div>
            
            <div className="flex gap-3 p-5 bg-gray-50 border-t border-gray-200">
              <button onClick={handleAssignLater} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium">
                אחר כך
              </button>
              <button onClick={handleAssignNow} className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] transition-colors font-medium flex items-center justify-center gap-2">
                <Truck size={18} />
                שבץ נהג
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}