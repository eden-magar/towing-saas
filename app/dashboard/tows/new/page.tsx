'use client'

import { useState } from 'react'
import { ArrowRight, Search, Check, AlertTriangle, Plus, Trash2, MapPin, Banknote, CreditCard, FileText, Truck, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function NewTowPage() {
  const router = useRouter()
  const [showAssignNowModal, setShowAssignNowModal] = useState(false)
  const [savedTowId, setSavedTowId] = useState('')
  
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

  const mockCustomers = [
    { id: 1, name: 'מוסך רמט', phone: '03-5551234', type: 'business' },
    { id: 2, name: 'ליסינג ישיר', phone: '03-9876543', type: 'business' },
    { id: 3, name: 'יוסי כהן', phone: '050-1112233', type: 'private' },
  ]

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

  const handleSave = () => {
    const newTowId = 'T-' + Math.floor(1000 + Math.random() * 9000)
    setSavedTowId(newTowId)
    setShowAssignNowModal(true)
  }

  const handleAssignNow = () => {
    router.push(`/dashboard/tows/${savedTowId}`)
  }

  const handleAssignLater = () => {
    router.push('/dashboard/tows')
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
                    onClick={() => setCustomerType('existing')}
                    className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-sm font-medium transition-colors ${
                      customerType === 'existing'
                        ? 'bg-[#33d4ff] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    לקוח קיים
                  </button>
                  <button
                    onClick={() => setCustomerType('new')}
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
                      {showCustomerResults && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                          {mockCustomers.map((customer) => (
                            <div
                              key={customer.id}
                              onClick={() => {
                                setCustomerName(customer.name)
                                setCustomerPhone(customer.phone)
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
                                  customer.type === 'business' 
                                    ? 'bg-purple-100 text-purple-600' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {customer.type === 'business' ? 'עסקי' : 'פרטי'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
                          <option value="flatbed">משטח</option>
                          <option value="lift">הרמה</option>
                          <option value="heavy">כבד</option>
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
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Check size={16} className="text-emerald-600" />
                          </div>
                          <h3 className="font-bold text-gray-800">רכב תקין</h3>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">מספר רכב</label>
                          <input
                            type="text"
                            value={workingVehiclePlate}
                            onChange={(e) => setWorkingVehiclePlate(e.target.value)}
                            placeholder="12-345-67"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">סוג רכב</label>
                          <select
                            value={workingVehicleType}
                            onChange={(e) => setWorkingVehicleType(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                          >
                            <option value="">בחר סוג</option>
                            <option value="small">רכב קטן</option>
                            <option value="medium">רכב בינוני</option>
                            <option value="large">רכב גדול</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">מוצא</label>
                          <input
                            type="text"
                            value={workingPickup}
                            onChange={(e) => setWorkingPickup(e.target.value)}
                            placeholder="כתובת מוצא"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">יעד</label>
                          <input
                            type="text"
                            value={workingDropoff}
                            onChange={(e) => setWorkingDropoff(e.target.value)}
                            placeholder="כתובת יעד"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                            <AlertTriangle size={16} className="text-red-600" />
                          </div>
                          <h3 className="font-bold text-gray-800">רכב תקול</h3>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">מספר רכב</label>
                          <input
                            type="text"
                            value={defectiveVehiclePlate}
                            onChange={(e) => setDefectiveVehiclePlate(e.target.value)}
                            placeholder="12-345-67"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">סוג רכב</label>
                          <select
                            value={defectiveVehicleType}
                            onChange={(e) => setDefectiveVehicleType(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                          >
                            <option value="">בחר סוג</option>
                            <option value="small">רכב קטן</option>
                            <option value="medium">רכב בינוני</option>
                            <option value="large">רכב גדול</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">מוצא</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={defectivePickup}
                              onChange={(e) => setDefectivePickup(e.target.value)}
                              placeholder="כתובת מוצא"
                              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                            />
                            <button
                              onClick={copyFromWorkingDestination}
                              className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs hover:bg-gray-200 whitespace-nowrap"
                            >
                              העתק
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">יעד</label>
                          <input
                            type="text"
                            value={defectiveDropoff}
                            onChange={(e) => setDefectiveDropoff(e.target.value)}
                            placeholder="כתובת יעד"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
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
                            <button
                              onClick={() => removeVehicle(vehicle.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">מספר רכב</label>
                            <input
                              type="text"
                              value={vehicle.plate}
                              onChange={(e) => updateVehicle(vehicle.id, 'plate', e.target.value)}
                              placeholder="12-345-67"
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">סוג רכב</label>
                            <select
                              value={vehicle.type}
                              onChange={(e) => updateVehicle(vehicle.id, 'type', e.target.value)}
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                            >
                              <option value="">בחר סוג</option>
                              <option value="small">רכב קטן</option>
                              <option value="medium">רכב בינוני</option>
                              <option value="large">רכב גדול</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">תקלה</label>
                            <select
                              value={vehicle.defect}
                              onChange={(e) => updateVehicle(vehicle.id, 'defect', e.target.value)}
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                            >
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
                            <input
                              type="text"
                              value={vehicle.pickup}
                              onChange={(e) => updateVehicle(vehicle.id, 'pickup', e.target.value)}
                              placeholder="כתובת מוצא"
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">יעד</label>
                            <input
                              type="text"
                              value={vehicle.dropoff}
                              onChange={(e) => updateVehicle(vehicle.id, 'dropoff', e.target.value)}
                              placeholder="כתובת יעד"
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={addVehicle}
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#33d4ff] hover:text-[#33d4ff] transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={20} />
                      הוסף רכב נוסף
                    </button>
                  </div>
                )}
              </div>
            )}

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
                          <input
                            type="text"
                            value={pickupAddress}
                            onChange={(e) => setPickupAddress(e.target.value)}
                            placeholder="הזן כתובת"
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                          <button className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200">
                            <MapPin size={20} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">יעד <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={dropoffAddress}
                            onChange={(e) => setDropoffAddress(e.target.value)}
                            placeholder="הזן כתובת"
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                          <button className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200">
                            <MapPin size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={() => setFromBase(!fromBase)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        fromBase ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      יציאה מהבסיס
                    </button>
                    <button
                      onClick={() => setToTerritories(!toTerritories)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        toTerritories ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      שטחים (+25%)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {towType && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">{towType === 'single' ? '5' : '4'}</span>
                    פרטים נוספים
                  </h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-700 mb-3 text-sm">איש קשר במוצא</h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={pickupContactName}
                          onChange={(e) => setPickupContactName(e.target.value)}
                          placeholder="שם"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                        />
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            value={pickupContactPhone}
                            onChange={(e) => setPickupContactPhone(e.target.value)}
                            placeholder="טלפון"
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                          />
                          <button
                            onClick={() => copyFromCustomer('pickup')}
                            className="px-3 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-100 whitespace-nowrap"
                          >
                            זהה ללקוח
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-700 mb-3 text-sm">איש קשר ביעד</h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={dropoffContactName}
                          onChange={(e) => setDropoffContactName(e.target.value)}
                          placeholder="שם"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                        />
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            value={dropoffContactPhone}
                            onChange={(e) => setDropoffContactPhone(e.target.value)}
                            placeholder="טלפון"
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                          />
                          <button
                            onClick={() => copyFromCustomer('dropoff')}
                            className="px-3 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-100 whitespace-nowrap"
                          >
                            זהה ללקוח
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="הערות נוספות לגרירה..."
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>
            )}

            {towType && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">{towType === 'single' ? '6' : '5'}</span>
                    תשלום
                  </h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">שם לחשבונית</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={invoiceName}
                        onChange={(e) => setInvoiceName(e.target.value)}
                        placeholder="שם לחשבונית"
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                      <button
                        onClick={() => setInvoiceName(customerName)}
                        className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs hover:bg-gray-200 whitespace-nowrap"
                      >
                        זהה ללקוח
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">אמצעי תשלום</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setPaymentMethod('cash')}
                        className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                          paymentMethod === 'cash'
                            ? 'bg-[#33d4ff] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Banknote size={18} />
                        <span>מזומן</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('credit')}
                        className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                          paymentMethod === 'credit'
                            ? 'bg-[#33d4ff] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <CreditCard size={18} />
                        <span>אשראי</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('invoice')}
                        className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                          paymentMethod === 'invoice'
                            ? 'bg-[#33d4ff] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <FileText size={18} />
                        <span>חשבונית</span>
                      </button>
                    </div>
                  </div>

                  {paymentMethod === 'credit' && (
                    <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">מספר כרטיס</label>
                        <input
                          type="text"
                          value={creditCardNumber}
                          onChange={(e) => setCreditCardNumber(e.target.value)}
                          placeholder="0000-0000-0000-0000"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">תוקף</label>
                          <input
                            type="text"
                            value={creditCardExpiry}
                            onChange={(e) => setCreditCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                          <input
                            type="text"
                            value={creditCardCvv}
                            onChange={(e) => setCreditCardCvv(e.target.value)}
                            placeholder="000"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">ת.ז.</label>
                          <input
                            type="text"
                            value={creditCardId}
                            onChange={(e) => setCreditCardId(e.target.value)}
                            placeholder="123456789"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="lg:hidden">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-800 text-white">
                  <h3 className="font-bold text-sm">סיכום מחיר</h3>
                </div>
                <div className="p-4">
                  {towType ? (
                    <div className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">מחיר בסיס</span>
                          <span className="text-gray-700">180 ש״ח</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">מרחק: 22 ק״מ</span>
                          <span className="text-gray-700">264 ש״ח</span>
                        </div>
                        {toTerritories && (
                          <div className="flex justify-between text-amber-600">
                            <span>שטחים (+25%)</span>
                            <span>111 ש״ח</span>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-800">סה״כ</span>
                          <span className="text-xl font-bold text-gray-800">{toTerritories ? '555' : '444'} ש״ח</span>
                        </div>
                      </div>

                      <button 
                        onClick={handleSave}
                        className="w-full py-3 bg-[#33d4ff] text-white font-medium rounded-xl hover:bg-[#21b8e6] transition-colors"
                      >
                        שמור גרירה
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400">
                      <p className="text-sm">בחר סוג גרירה לחישוב מחיר</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-24">
              <div className="px-5 py-4 bg-gray-800 text-white">
                <h3 className="font-bold">סיכום מחיר</h3>
              </div>
              <div className="p-5">
                {towType ? (
                  <div className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">מחיר בסיס (רכב בינוני)</span>
                        <span className="text-gray-700">180 ש״ח</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">מרחק: 22 ק״מ × 12 ש״ח</span>
                        <span className="text-gray-700">264 ש״ח</span>
                      </div>
                      {toTerritories && (
                        <div className="flex justify-between text-amber-600">
                          <span>תוספת שטחים (+25%)</span>
                          <span>111 ש״ח</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800">סה״כ</span>
                        <span className="text-2xl font-bold text-gray-800">{toTerritories ? '555' : '444'} ש״ח</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button className="text-sm text-[#33d4ff] hover:text-[#21b8e6]">
                        שנה מחיר ידנית
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button className="flex-1 py-2 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                        הנחה 5%
                      </button>
                      <button className="flex-1 py-2 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                        הנחה 10%
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="w-12 h-12 mx-auto mb-3 opacity-50 bg-gray-100 rounded-xl flex items-center justify-center">
                      <FileText size={24} />
                    </div>
                    <p className="text-sm">בחר סוג גרירה לחישוב מחיר</p>
                  </div>
                )}
              </div>

              {towType && (
                <div className="px-5 pb-5">
                  <button 
                    onClick={handleSave}
                    className="w-full py-3 bg-[#33d4ff] text-white font-medium rounded-xl hover:bg-[#21b8e6] transition-colors"
                  >
                    שמור גרירה
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAssignNowModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">הגרירה נשמרה בהצלחה!</h2>
              <p className="text-gray-500 mb-2">מספר גרירה: <span className="font-mono font-bold">{savedTowId}</span></p>
              <p className="text-gray-600">האם לשבץ נהג עכשיו?</p>
            </div>
            
            <div className="flex gap-3 p-5 bg-gray-50 border-t border-gray-200">
              <button
                onClick={handleAssignLater}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
              >
                אחר כך
              </button>
              <button
                onClick={handleAssignNow}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] transition-colors font-medium flex items-center justify-center gap-2"
              >
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
