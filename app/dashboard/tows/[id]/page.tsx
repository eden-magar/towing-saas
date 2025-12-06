'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  ArrowRight, 
  Edit2, 
  X, 
  Phone, 
  MapPin, 
  User, 
  Truck, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Image,
  ChevronLeft,
  Search,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  RefreshCw
} from 'lucide-react'

interface Driver {
  id: number
  name: string
  phone: string
  status: 'available' | 'busy' | 'offline'
  trucks: { id: number; name: string; plate: string; capacity: number }[]
  currentTows: number
}

interface Vehicle {
  id: number
  plate: string
  manufacturer: string
  model: string
  year: number
  color: string
  type: string
  defects: string[]
}

export default function TowDetailsPage() {
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'images'>('details')
  const [isEditing, setIsEditing] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showChangeDriverModal, setShowChangeDriverModal] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [selectedTruck, setSelectedTruck] = useState<number | null>(null)
  const [driverFilter, setDriverFilter] = useState<'all' | 'available'>('all')
  const [driverSearch, setDriverSearch] = useState('')
  const [showBusyWarning, setShowBusyWarning] = useState(false)
  const [showCapacityWarning, setShowCapacityWarning] = useState(false)
  const [capacityWarningMessage, setCapacityWarningMessage] = useState('')
  const [showCantEditModal, setShowCantEditModal] = useState(false)
  const [showRemoveDriverConfirm, setShowRemoveDriverConfirm] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelStep, setCancelStep] = useState<'warning' | 'reason' | 'confirm'>('reason')
  const [cancelReason, setCancelReason] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [showCantCancelModal, setShowCantCancelModal] = useState(false)

  const [towData, setTowData] = useState({
    id: 'T-1003',
    status: 'pending',
    createdAt: '06/12/2024 10:00',
    customer: {
      id: 1,
      name: 'שרה לוי',
      phone: '052-9876543',
      type: 'private' as 'private' | 'business'
    },
    vehicles: [
      {
        id: 1,
        plate: '34-567-89',
        manufacturer: 'יונדאי',
        model: 'i20',
        year: 2020,
        color: 'כחול',
        type: 'רכב קטן',
        defects: ['מנוע', 'לא מניע']
      }
    ] as Vehicle[],
    route: {
      from: 'גבעתיים, רח׳ כצנלסון 23',
      to: 'תל אביב, נמל יפו',
      distance: '15 ק"מ',
      duration: '25 דקות'
    },
    contacts: {
      source: { name: 'שרה לוי', phone: '052-9876543' },
      destination: { name: 'מוסך יפו', phone: '03-6543210' }
    },
    driver: null as { id: number; name: string; phone: string; truck: string } | null,
    pricing: {
      base: 150,
      distance: 180,
      surcharge: 0,
      discount: 0,
      total: 330
    },
    payment: {
      method: 'cash' as 'cash' | 'credit' | 'invoice',
      invoiceName: 'שרה לוי',
      status: 'pending',
      hasInvoice: false,
      invoicePaid: false
    },
    notes: 'הלקוחה מבקשת להתקשר 10 דקות לפני ההגעה',
    statusHistory: [
      { status: 'pending', time: '10:00', user: 'מערכת' },
    ],
  })

  const [editForm, setEditForm] = useState({
    customerName: towData.customer.name,
    customerPhone: towData.customer.phone,
    customerType: towData.customer.type,
    routeFrom: towData.route.from,
    routeTo: towData.route.to,
    sourceContactName: towData.contacts.source.name,
    sourceContactPhone: towData.contacts.source.phone,
    destContactName: towData.contacts.destination.name,
    destContactPhone: towData.contacts.destination.phone,
    vehicles: [...towData.vehicles],
    pricingBase: towData.pricing.base,
    pricingDistance: towData.pricing.distance,
    pricingSurcharge: towData.pricing.surcharge,
    pricingDiscount: towData.pricing.discount,
    pricingTotal: towData.pricing.total,
    paymentMethod: towData.payment.method,
    invoiceName: towData.payment.invoiceName,
    notes: towData.notes,
  })

  const drivers: Driver[] = [
    { id: 1, name: 'יוסי כהן', phone: '050-1234567', status: 'available', currentTows: 2, trucks: [
      { id: 1, name: 'גרר משטח', plate: '12-345-67', capacity: 2 }
    ]},
    { id: 2, name: 'משה לוי', phone: '052-9876543', status: 'busy', currentTows: 4, trucks: [
      { id: 2, name: 'גרר הרמה', plate: '23-456-78', capacity: 1 }
    ]},
    { id: 3, name: 'דוד אברהם', phone: '054-5551234', status: 'offline', currentTows: 0, trucks: []},
    { id: 4, name: 'אבי ישראלי', phone: '050-7778899', status: 'available', currentTows: 1, trucks: [
      { id: 3, name: 'גרר כבד', plate: '34-567-89', capacity: 3 }
    ]},
  ]

  const mockCustomers = [
    { id: 1, name: 'שרה לוי', phone: '052-9876543', type: 'private' as const },
    { id: 2, name: 'מוסך רמט', phone: '03-5551234', type: 'business' as const },
    { id: 3, name: 'ליסינג ישיר', phone: '03-9876543', type: 'business' as const },
  ]

  const defectOptions = ['תקר', 'מנוע', 'סוללה', 'תאונה', 'נעילה', 'לא מניע', 'אחר']

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'ממתין לשיבוץ', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    assigned: { label: 'שובץ נהג', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    driver_accepted: { label: 'נהג אישר', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    driver_on_way: { label: 'נהג בדרך', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    arrived_pickup: { label: 'הגיע למוצא', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    loading: { label: 'מעמיס', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    in_progress: { label: 'בדרך ליעד', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    completed: { label: 'הושלם', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    cancelled: { label: 'בוטל', color: 'bg-gray-100 text-gray-500 border-gray-200' },
  }

  const driverStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
    available: { label: 'זמין', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    busy: { label: 'בגרירה', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    offline: { label: 'לא זמין', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  }

  const canEdit = towData.status !== 'completed' && towData.status !== 'cancelled'

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = driver.name.includes(driverSearch) || driver.phone.includes(driverSearch)
    const matchesFilter = driverFilter === 'all' || driver.status === 'available'
    return matchesSearch && matchesFilter
  })

  const handleEditClick = () => {
    if (!canEdit) {
      setShowCantEditModal(true)
    } else {
      setEditForm({
        customerName: towData.customer.name,
        customerPhone: towData.customer.phone,
        customerType: towData.customer.type,
        routeFrom: towData.route.from,
        routeTo: towData.route.to,
        sourceContactName: towData.contacts.source.name,
        sourceContactPhone: towData.contacts.source.phone,
        destContactName: towData.contacts.destination.name,
        destContactPhone: towData.contacts.destination.phone,
        vehicles: towData.vehicles.map(v => ({ ...v, defects: [...v.defects] })),
        pricingBase: towData.pricing.base,
        pricingDistance: towData.pricing.distance,
        pricingSurcharge: towData.pricing.surcharge,
        pricingDiscount: towData.pricing.discount,
        pricingTotal: towData.pricing.total,
        paymentMethod: towData.payment.method,
        invoiceName: towData.payment.invoiceName,
        notes: towData.notes,
      })
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const recalculatePrice = () => {
    const base = editForm.pricingBase
    const distance = editForm.pricingDistance
    const surcharge = editForm.pricingSurcharge
    const discount = editForm.pricingDiscount
    const total = base + distance + surcharge - discount
    setEditForm({ ...editForm, pricingTotal: total })
  }

  const handleSaveChanges = () => {
    if (editForm.vehicles.length === 0) {
      alert('חייב להיות לפחות רכב אחד בגרירה')
      return
    }

    setTowData({
      ...towData,
      customer: {
        ...towData.customer,
        name: editForm.customerName,
        phone: editForm.customerPhone,
        type: editForm.customerType,
      },
      vehicles: editForm.vehicles,
      route: {
        ...towData.route,
        from: editForm.routeFrom,
        to: editForm.routeTo,
      },
      contacts: {
        source: { name: editForm.sourceContactName, phone: editForm.sourceContactPhone },
        destination: { name: editForm.destContactName, phone: editForm.destContactPhone },
      },
      pricing: {
        base: editForm.pricingBase,
        distance: editForm.pricingDistance,
        surcharge: editForm.pricingSurcharge,
        discount: editForm.pricingDiscount,
        total: editForm.pricingTotal,
      },
      payment: {
        ...towData.payment,
        method: editForm.paymentMethod,
        invoiceName: editForm.invoiceName,
      },
      notes: editForm.notes,
    })

    setIsEditing(false)
  }

  const addVehicle = () => {
    const newId = Math.max(...editForm.vehicles.map(v => v.id), 0) + 1
    setEditForm({
      ...editForm,
      vehicles: [...editForm.vehicles, {
        id: newId,
        plate: '',
        manufacturer: '',
        model: '',
        year: new Date().getFullYear(),
        color: '',
        type: 'רכב קטן',
        defects: []
      }]
    })
  }

  const removeVehicle = (id: number) => {
    if (editForm.vehicles.length <= 1) {
      alert('חייב להיות לפחות רכב אחד')
      return
    }
    setEditForm({
      ...editForm,
      vehicles: editForm.vehicles.filter(v => v.id !== id)
    })
  }

  const updateVehicle = (id: number, field: keyof Vehicle, value: any) => {
    setEditForm({
      ...editForm,
      vehicles: editForm.vehicles.map(v => v.id === id ? { ...v, [field]: value } : v)
    })
  }

  const toggleVehicleDefect = (vehicleId: number, defect: string) => {
    setEditForm({
      ...editForm,
      vehicles: editForm.vehicles.map(v => {
        if (v.id === vehicleId) {
          const hasDefect = v.defects.includes(defect)
          return {
            ...v,
            defects: hasDefect ? v.defects.filter(d => d !== defect) : [...v.defects, defect]
          }
        }
        return v
      })
    })
  }

  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver)
    setSelectedTruck(null)
    setShowCapacityWarning(false)
    if (driver.status === 'busy') {
      setShowBusyWarning(true)
    } else {
      setShowBusyWarning(false)
    }
  }

  const handleSelectTruck = (truck: { id: number; name: string; plate: string; capacity: number }) => {
    setSelectedTruck(truck.id)
    const vehicleCount = towData.vehicles.length
    if (truck.capacity < vehicleCount) {
      setShowCapacityWarning(true)
      setCapacityWarningMessage(`הגרר יכול לקחת ${truck.capacity} רכבים, אבל הגרירה כוללת ${vehicleCount} רכבים`)
    } else {
      setShowCapacityWarning(false)
    }
  }

  const handleAssign = () => {
    if (selectedDriver && selectedTruck) {
      const truck = selectedDriver.trucks.find(t => t.id === selectedTruck)
      setTowData({
        ...towData,
        driver: {
          id: selectedDriver.id,
          name: selectedDriver.name,
          phone: selectedDriver.phone,
          truck: truck ? `${truck.name} - ${truck.plate}` : ''
        },
        status: 'assigned'
      })
      setShowAssignModal(false)
      setShowChangeDriverModal(false)
      setSelectedDriver(null)
      setSelectedTruck(null)
      setShowBusyWarning(false)
      setShowCapacityWarning(false)
    }
  }

  const handleRemoveDriver = () => {
    setTowData({
      ...towData,
      driver: null,
      status: 'pending'
    })
    setShowRemoveDriverConfirm(false)
  }

  const handleCancelClick = () => {
    if (towData.status === 'completed') {
      setShowCantCancelModal(true)
      return
    }
    
    if (['in_progress', 'driver_on_way', 'arrived_pickup', 'loading'].includes(towData.status)) {
      setCancelStep('warning')
    } else {
      setCancelStep('reason')
    }
    setShowCancelModal(true)
  }

  const handleConfirmCancel = () => {
    setTowData({
      ...towData,
      status: 'cancelled',
      driver: null
    })
    setShowCancelModal(false)
    setCancelReason('')
    setCancelStep('reason')
  }

  const closeCancelModal = () => {
    setShowCancelModal(false)
    setCancelReason('')
    setCancelStep('reason')
  }

  const closeDriverModal = () => {
    setShowAssignModal(false)
    setShowChangeDriverModal(false)
    setSelectedDriver(null)
    setSelectedTruck(null)
    setShowBusyWarning(false)
    setShowCapacityWarning(false)
  }

  const renderDriverModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
      <div className="bg-white w-full lg:max-w-lg lg:rounded-2xl lg:mx-4 overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
          <h2 className="font-bold text-lg">{towData.driver ? 'שינוי נהג' : 'שיבוץ נהג'}</h2>
          <button onClick={closeDriverModal} className="p-2 hover:bg-white/20 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="relative mb-3">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש נהג..."
              value={driverSearch}
              onChange={(e) => setDriverSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDriverFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                driverFilter === 'all' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              הכל
            </button>
            <button
              onClick={() => setDriverFilter('available')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                driverFilter === 'available' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              זמינים בלבד
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selectedDriver ? (
            <div className="space-y-2">
              {filteredDrivers.map((driver) => (
                <button
                  key={driver.id}
                  onClick={() => handleSelectDriver(driver)}
                  disabled={driver.status === 'offline'}
                  className={`w-full p-4 rounded-xl border text-right transition-colors ${
                    driver.status === 'offline' 
                      ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-[#33d4ff] hover:bg-[#33d4ff]/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <User size={24} className="text-gray-400" />
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${driverStatusConfig[driver.status].dot}`}></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">{driver.name}</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${driverStatusConfig[driver.status].color}`}>
                          {driverStatusConfig[driver.status].label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{driver.phone}</p>
                      <p className="text-xs text-gray-400 mt-1">{driver.currentTows} גרירות היום</p>
                    </div>
                    <ChevronLeft size={20} className="text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => {
                  setSelectedDriver(null)
                  setSelectedTruck(null)
                  setShowBusyWarning(false)
                  setShowCapacityWarning(false)
                }}
                className="flex items-center gap-2 text-[#33d4ff] text-sm font-medium"
              >
                <ArrowRight size={18} />
                חזור לרשימת נהגים
              </button>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                    <User size={24} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{selectedDriver.name}</p>
                    <p className="text-sm text-gray-500">{selectedDriver.phone}</p>
                  </div>
                </div>
              </div>

              {showBusyWarning && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                  <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">הנהג כרגע בגרירה</p>
                    <p className="text-sm text-amber-600 mt-1">האם לשבץ אותו בכל זאת?</p>
                  </div>
                </div>
              )}

              {selectedDriver.trucks.length > 0 ? (
                <div>
                  <h3 className="font-medium text-gray-800 mb-3">בחר גרר:</h3>
                  <div className="space-y-2">
                    {selectedDriver.trucks.map((truck) => (
                      <button
                        key={truck.id}
                        onClick={() => handleSelectTruck(truck)}
                        className={`w-full p-4 rounded-xl border text-right transition-colors ${
                          selectedTruck === truck.id
                            ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            selectedTruck === truck.id ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-400'
                          }`}>
                            <Truck size={20} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{truck.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-gray-500 font-mono">{truck.plate}</p>
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                קיבולת: {truck.capacity} רכבים
                              </span>
                            </div>
                          </div>
                          {selectedTruck === truck.id && (
                            <CheckCircle size={20} className="text-[#33d4ff]" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {showCapacityWarning && (
                    <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                      <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800">בעיית קיבולת</p>
                        <p className="text-sm text-amber-600 mt-1">{capacityWarningMessage}</p>
                        <p className="text-sm text-amber-700 mt-2 font-medium">להמשיך בכל זאת?</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">אין גרר משויך</p>
                    <p className="text-sm text-red-600 mt-1">יש לשייך גרר לנהג לפני השיבוץ</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={closeDriverModal}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
          >
            ביטול
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedDriver || !selectedTruck}
            className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {towData.driver ? 'שנה נהג' : 'שבץ נהג'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/tows" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <ArrowRight size={20} />
              </Link>
              <div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <h1 className="font-bold text-gray-800 text-base sm:text-lg font-mono">{towData.id}</h1>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusConfig[towData.status]?.color}`}>
                    {statusConfig[towData.status]?.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 hidden sm:block">נוצר ב-{towData.createdAt}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button 
                    onClick={handleCancelEdit}
                    className="p-2 sm:px-3 sm:py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm flex items-center gap-2"
                  >
                    <X size={18} />
                    <span className="hidden sm:inline">ביטול</span>
                  </button>
                  <button 
                    onClick={handleSaveChanges}
                    className="p-2 sm:px-3 sm:py-2 bg-[#33d4ff] text-white hover:bg-[#21b8e6] rounded-lg text-sm flex items-center gap-2"
                  >
                    <Save size={18} />
                    <span className="hidden sm:inline">שמור</span>
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleEditClick}
                    className="p-2 sm:px-3 sm:py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm flex items-center gap-2"
                  >
                    <Edit2 size={18} />
                    <span className="hidden sm:inline">ערוך</span>
                  </button>
                  <button 
                    onClick={handleCancelClick}
                    className="p-2 sm:px-3 sm:py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-2"
                  >
                    <X size={18} />
                    <span className="hidden sm:inline">בטל גרירה</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        <div className="flex gap-1 mb-4 sm:mb-6 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'details' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FileText size={16} />
            פרטים
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'history' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Clock size={16} />
            היסטוריה
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'images' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Image size={16} />
            תמונות
          </button>
        </div>

        {activeTab === 'details' && (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            <div className="flex-1 space-y-4 sm:space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <User size={18} />
                    פרטי לקוח
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">שם לקוח</label>
                          <input
                            type="text"
                            value={editForm.customerName}
                            onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">טלפון</label>
                          <input
                            type="tel"
                            value={editForm.customerPhone}
                            onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">סוג לקוח</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditForm({ ...editForm, customerType: 'private' })}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              editForm.customerType === 'private' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            פרטי
                          </button>
                          <button
                            onClick={() => setEditForm({ ...editForm, customerType: 'business' })}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              editForm.customerType === 'business' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            עסקי
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{towData.customer.name}</p>
                        <a href={`tel:${towData.customer.phone}`} className="text-[#33d4ff] text-sm flex items-center gap-1 mt-1">
                          <Phone size={14} />
                          {towData.customer.phone}
                        </a>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-lg ${
                        towData.customer.type === 'business' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {towData.customer.type === 'business' ? 'עסקי' : 'פרטי'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <Truck size={18} />
                    רכבים ({isEditing ? editForm.vehicles.length : towData.vehicles.length})
                  </h2>
                  {isEditing && (
                    <button 
                      onClick={addVehicle}
                      className="flex items-center gap-1 text-[#33d4ff] text-sm font-medium hover:text-[#21b8e6]"
                    >
                      <Plus size={16} />
                      הוסף רכב
                    </button>
                  )}
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      {editForm.vehicles.map((vehicle, idx) => (
                        <div key={vehicle.id} className="p-4 border border-gray-200 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-gray-800">רכב {idx + 1}</span>
                            {editForm.vehicles.length > 1 && (
                              <button 
                                onClick={() => removeVehicle(vehicle.id)}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">מספר רישוי</label>
                              <input
                                type="text"
                                value={vehicle.plate}
                                onChange={(e) => updateVehicle(vehicle.id, 'plate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">יצרן</label>
                              <input
                                type="text"
                                value={vehicle.manufacturer}
                                onChange={(e) => updateVehicle(vehicle.id, 'manufacturer', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">דגם</label>
                              <input
                                type="text"
                                value={vehicle.model}
                                onChange={(e) => updateVehicle(vehicle.id, 'model', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">צבע</label>
                              <input
                                type="text"
                                value={vehicle.color}
                                onChange={(e) => updateVehicle(vehicle.id, 'color', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                              />
                            </div>
                          </div>
                          <div className="mt-3">
                            <label className="block text-xs text-gray-500 mb-2">תקלות</label>
                            <div className="flex flex-wrap gap-2">
                              {defectOptions.map((defect) => (
                                <button
                                  key={defect}
                                  onClick={() => toggleVehicleDefect(vehicle.id, defect)}
                                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                                    vehicle.defects.includes(defect)
                                      ? 'bg-red-100 text-red-600 border border-red-200'
                                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                                  }`}
                                >
                                  {defect}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {towData.vehicles.map((vehicle, idx) => (
                        <div key={vehicle.id} className={idx > 0 ? 'pt-4 border-t border-gray-100' : ''}>
                          <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                              <Truck size={24} className="text-gray-400" />
                            </div>
                            <div>
                              <p className="font-mono text-lg font-bold text-gray-800">{vehicle.plate}</p>
                              <p className="text-sm text-gray-500">{vehicle.manufacturer} {vehicle.model}, {vehicle.year}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">{vehicle.type}</span>
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">{vehicle.color}</span>
                            {vehicle.defects.map((defect, defIdx) => (
                              <span key={defIdx} className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-sm">{defect}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <MapPin size={18} />
                    מסלול
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">כתובת מוצא</label>
                        <input
                          type="text"
                          value={editForm.routeFrom}
                          onChange={(e) => setEditForm({ ...editForm, routeFrom: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">איש קשר במוצא</label>
                          <input
                            type="text"
                            value={editForm.sourceContactName}
                            onChange={(e) => setEditForm({ ...editForm, sourceContactName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">טלפון</label>
                          <input
                            type="tel"
                            value={editForm.sourceContactPhone}
                            onChange={(e) => setEditForm({ ...editForm, sourceContactPhone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">כתובת יעד</label>
                        <input
                          type="text"
                          value={editForm.routeTo}
                          onChange={(e) => setEditForm({ ...editForm, routeTo: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">איש קשר ביעד</label>
                          <input
                            type="text"
                            value={editForm.destContactName}
                            onChange={(e) => setEditForm({ ...editForm, destContactName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">טלפון</label>
                          <input
                            type="tel"
                            value={editForm.destContactPhone}
                            onChange={(e) => setEditForm({ ...editForm, destContactPhone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                      </div>
                      <button
                        onClick={recalculatePrice}
                        className="flex items-center gap-2 text-[#33d4ff] text-sm font-medium hover:text-[#21b8e6]"
                      >
                        <RefreshCw size={16} />
                        חשב מרחק ומחיר מחדש
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex flex-col items-center pt-1">
                          <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                          <div className="w-0.5 flex-1 bg-gray-200 my-1"></div>
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        </div>
                        <div className="flex-1 space-y-4">
                          <div>
                            <p className="text-sm text-gray-500">מוצא</p>
                            <p className="font-medium text-gray-800">{towData.route.from}</p>
                            <p className="text-sm text-gray-500 mt-1">איש קשר: {towData.contacts.source.name}, {towData.contacts.source.phone}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">יעד</p>
                            <p className="font-medium text-gray-800">{towData.route.to}</p>
                            <p className="text-sm text-gray-500 mt-1">איש קשר: {towData.contacts.destination.name}, {towData.contacts.destination.phone}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">מרחק</p>
                          <p className="font-bold text-gray-800">{towData.route.distance}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">זמן משוער</p>
                          <p className="font-bold text-gray-800">{towData.route.duration}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800">הערות</h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  ) : (
                    <p className="text-gray-600">{towData.notes || 'אין הערות'}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:w-80 space-y-4 sm:space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-[#33d4ff] text-white">
                  <h2 className="font-bold">נהג</h2>
                </div>
                <div className="p-4 sm:p-5">
                  {towData.driver ? (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <User size={24} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{towData.driver.name}</p>
                          <a href={`tel:${towData.driver.phone}`} className="text-[#33d4ff] text-sm">{towData.driver.phone}</a>
                          <p className="text-xs text-gray-500 mt-1">{towData.driver.truck}</p>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowChangeDriverModal(true)}
                            className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
                          >
                            שנה נהג
                          </button>
                          <button
                            onClick={() => setShowRemoveDriverConfirm(true)}
                            className="flex-1 py-2 border border-red-200 text-red-600 rounded-xl text-sm hover:bg-red-50"
                          >
                            הסר נהג
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <User size={32} className="text-gray-300" />
                      </div>
                      <p className="text-gray-500 mb-4">לא שובץ נהג</p>
                      <button
                        onClick={() => setShowAssignModal(true)}
                        className="w-full py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] transition-colors"
                      >
                        שבץ נהג
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-800 text-white">
                  <h2 className="font-bold">מחיר</h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-500">מחיר בסיס</label>
                        <input
                          type="number"
                          value={editForm.pricingBase}
                          onChange={(e) => setEditForm({ ...editForm, pricingBase: Number(e.target.value) })}
                          className="w-24 px-2 py-1 border border-gray-200 rounded text-left text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-500">מרחק</label>
                        <input
                          type="number"
                          value={editForm.pricingDistance}
                          onChange={(e) => setEditForm({ ...editForm, pricingDistance: Number(e.target.value) })}
                          className="w-24 px-2 py-1 border border-gray-200 rounded text-left text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-500">תוספות</label>
                        <input
                          type="number"
                          value={editForm.pricingSurcharge}
                          onChange={(e) => setEditForm({ ...editForm, pricingSurcharge: Number(e.target.value) })}
                          className="w-24 px-2 py-1 border border-gray-200 rounded text-left text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-500">הנחה</label>
                        <input
                          type="number"
                          value={editForm.pricingDiscount}
                          onChange={(e) => setEditForm({ ...editForm, pricingDiscount: Number(e.target.value) })}
                          className="w-24 px-2 py-1 border border-gray-200 rounded text-left text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <button
                        onClick={recalculatePrice}
                        className="w-full py-2 border border-[#33d4ff] text-[#33d4ff] rounded-lg text-sm font-medium hover:bg-[#33d4ff]/5"
                      >
                        חשב סה״כ
                      </button>
                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-800">סה״כ</span>
                          <span className="text-xl font-bold text-gray-800">{editForm.pricingTotal} ש״ח</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">מחיר בסיס</span>
                          <span className="text-gray-700">{towData.pricing.base} ש״ח</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">מרחק ({towData.route.distance})</span>
                          <span className="text-gray-700">{towData.pricing.distance} ש״ח</span>
                        </div>
                        {towData.pricing.surcharge > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span>תוספות</span>
                            <span>{towData.pricing.surcharge} ש״ח</span>
                          </div>
                        )}
                        {towData.pricing.discount > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>הנחה</span>
                            <span>-{towData.pricing.discount} ש״ח</span>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-gray-200 mt-4 pt-4">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-800">סה״כ</span>
                          <span className="text-2xl font-bold text-gray-800">{towData.pricing.total} ש״ח</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800">תשלום</h2>
                </div>
                <div className="p-4 sm:p-5 space-y-3">
                  {isEditing ? (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">אמצעי תשלום</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditForm({ ...editForm, paymentMethod: 'cash' })}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                              editForm.paymentMethod === 'cash' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            מזומן
                          </button>
                          <button
                            onClick={() => setEditForm({ ...editForm, paymentMethod: 'credit' })}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                              editForm.paymentMethod === 'credit' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            אשראי
                          </button>
                          <button
                            onClick={() => setEditForm({ ...editForm, paymentMethod: 'invoice' })}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                              editForm.paymentMethod === 'invoice' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            חשבונית
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">שם לחשבונית</label>
                        <input
                          type="text"
                          value={editForm.invoiceName}
                          onChange={(e) => setEditForm({ ...editForm, invoiceName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">אמצעי תשלום</span>
                        <span className="text-gray-700">
                          {towData.payment.method === 'cash' && 'מזומן'}
                          {towData.payment.method === 'credit' && 'אשראי'}
                          {towData.payment.method === 'invoice' && 'חשבונית ס״ח'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">שם לחשבונית</span>
                        <span className="text-gray-700">{towData.payment.invoiceName}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">סטטוס</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          towData.payment.status === 'paid' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {towData.payment.status === 'paid' ? 'שולם' : 'טרם שולם'}
                        </span>
                      </div>
                      <button className="w-full mt-2 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
                        הפק חשבונית
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">היסטוריית סטטוסים</h2>
            </div>
            <div className="p-4 sm:p-5">
              <div className="relative">
                {towData.statusHistory.map((item, idx) => (
                  <div key={idx} className="flex gap-4 pb-6 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${idx === towData.statusHistory.length - 1 ? 'bg-[#33d4ff]' : 'bg-gray-300'}`}></div>
                      {idx < towData.statusHistory.length - 1 && (
                        <div className="w-0.5 h-full bg-gray-200 mt-1"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusConfig[item.status]?.color}`}>
                          {statusConfig[item.status]?.label}
                        </span>
                        <span className="text-sm text-gray-500">{item.time}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">על ידי {item.user}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">תמונות</h2>
            </div>
            <div className="p-4 sm:p-5">
              <div className="text-center py-12 text-gray-400">
                <Image size={48} className="mx-auto mb-4 opacity-50" />
                <p>אין תמונות עדיין</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {(showAssignModal || showChangeDriverModal) && renderDriverModal()}

      {showCantEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">לא ניתן לערוך</h2>
              <p className="text-gray-600">לא ניתן לערוך גרירה שהושלמה או בוטלה</p>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowCantEditModal(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                הבנתי
              </button>
            </div>
          </div>
        </div>
      )}

      {showRemoveDriverConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">הסרת נהג</h2>
              <p className="text-gray-600">האם להסיר את הנהג מהגרירה?</p>
              <p className="text-sm text-gray-500 mt-2">הנהג יקבל התראה על ההסרה</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowRemoveDriverConfirm(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleRemoveDriver}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                הסר נהג
              </button>
            </div>
          </div>
        </div>
      )}

      {showCantCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">לא ניתן לבטל</h2>
              <p className="text-gray-600">לא ניתן לבטל גרירה שהושלמה</p>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowCantCancelModal(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                הבנתי
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            {cancelStep === 'warning' && (
              <>
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} className="text-amber-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800 mb-2">הגרירה בביצוע</h2>
                  <p className="text-gray-600">הגרירה כבר בביצוע, הנהג בדרך או באיסוף.</p>
                  <p className="text-gray-600 mt-2">האם לבטל בכל זאת?</p>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button
                    onClick={closeCancelModal}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                  >
                    חזור
                  </button>
                  <button
                    onClick={() => setCancelStep('reason')}
                    className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
                  >
                    כן, בטל
                  </button>
                </div>
              </>
            )}

            {cancelStep === 'reason' && (
              <>
                <div className="px-5 py-4 border-b border-gray-200 bg-red-600 text-white">
                  <h2 className="font-bold text-lg">ביטול גרירה</h2>
                </div>
                <div className="p-5 space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">מספר גרירה</span>
                      <span className="font-mono font-bold text-gray-800">{towData.id}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">לקוח</span>
                      <span className="text-gray-800">{towData.customer.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">סה״כ</span>
                      <span className="font-bold text-gray-800">{towData.pricing.total} ש״ח</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">סיבת ביטול *</label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="נא לציין את סיבת הביטול..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {towData.driver && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                      <p className="text-amber-800">
                        <strong>שים לב:</strong> הנהג {towData.driver.name} ישוחרר מהמשימה ויקבל התראה
                      </p>
                    </div>
                  )}

                  {towData.payment.hasInvoice && (
                    <div className={`p-3 rounded-xl text-sm ${towData.payment.invoicePaid ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
                      {towData.payment.invoicePaid ? (
                        <p className="text-red-800">
                          <strong>שים לב:</strong> קיימת חשבונית ששולמה. יש לטפל בזיכוי בנפרד.
                        </p>
                      ) : (
                        <p className="text-blue-800">
                          החשבונית תבוטל אוטומטית
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNotifyCustomer(!notifyCustomer)}
                      className={`w-5 h-5 rounded border flex items-center justify-center ${
                        notifyCustomer ? 'bg-[#33d4ff] border-[#33d4ff]' : 'border-gray-300'
                      }`}
                    >
                      {notifyCustomer && <CheckCircle size={14} className="text-white" />}
                    </button>
                    <span className="text-sm text-gray-700">שלח הודעה ללקוח על הביטול</span>
                  </div>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button
                    onClick={closeCancelModal}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                  >
                    חזור
                  </button>
                  <button
                    onClick={() => setCancelStep('confirm')}
                    disabled={!cancelReason.trim()}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    המשך
                  </button>
                </div>
              </>
            )}

            {cancelStep === 'confirm' && (
              <>
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} className="text-red-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800 mb-2">אישור ביטול</h2>
                  <p className="text-gray-600">האם אתה בטוח שברצונך לבטל את הגרירה?</p>
                  <p className="text-sm text-gray-500 mt-2">פעולה זו לא ניתנת לביטול</p>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button
                    onClick={() => setCancelStep('reason')}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                  >
                    חזור
                  </button>
                  <button
                    onClick={handleConfirmCancel}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                  >
                    בטל גרירה
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
