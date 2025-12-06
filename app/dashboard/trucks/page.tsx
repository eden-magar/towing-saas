'use client'

import { useState } from 'react'
import { Plus, Search, Truck, Edit2, Trash2, X, User, CheckCircle, Clock, AlertTriangle, Wrench, XCircle, MoreHorizontal, Calendar, Settings } from 'lucide-react'

interface Driver {
  id: number
  name: string
  phone: string
  hasTruck: boolean
}

interface TruckData {
  id: number
  plate: string
  type: 'flatbed' | 'lift' | 'heavy' | 'combined'
  typeName: string
  manufacturer: string
  model: string
  year: number
  color: string
  vin: string
  maxWeight: number
  platformLength: number
  vehicleCapacity: number
  licenseExpiry: string
  insuranceExpiry: string
  testExpiry: string
  status: 'available' | 'busy' | 'maintenance' | 'inactive'
  driverId: number | null
  driverName: string | null
  currentTask: string | null
  maintenanceReason: string
  todayTows: number
  totalTows: number
  notes: string
  isActive: boolean
}

export default function TrucksPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'flatbed' | 'lift' | 'heavy' | 'combined'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'busy' | 'maintenance'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingTruck, setEditingTruck] = useState<TruckData | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [showExpiryWarning, setShowExpiryWarning] = useState(false)
  const [expiryWarningMessage, setExpiryWarningMessage] = useState('')

  const [formData, setFormData] = useState({
    plate: '',
    type: '' as '' | 'flatbed' | 'lift' | 'heavy' | 'combined',
    manufacturer: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    vin: '',
    maxWeight: 0,
    platformLength: 0,
    vehicleCapacity: 1,
    licenseExpiry: '',
    insuranceExpiry: '',
    testExpiry: '',
    driverAssignment: 'none' as 'existing' | 'none',
    selectedDriverId: null as number | null,
    initialStatus: 'available' as 'available' | 'inactive',
    maintenanceReason: '',
    notes: '',
  })

  const [drivers] = useState<Driver[]>([
    { id: 1, name: 'משה לוי', phone: '050-1234567', hasTruck: false },
    { id: 2, name: 'דוד אברהם', phone: '052-2345678', hasTruck: true },
    { id: 3, name: 'יעקב מזרחי', phone: '054-3456789', hasTruck: true },
    { id: 4, name: 'עמית שלום', phone: '054-6789012', hasTruck: false },
  ])

  const [trucks, setTrucks] = useState<TruckData[]>([
    {
      id: 1,
      plate: '12-345-67',
      type: 'flatbed',
      typeName: 'משטח',
      manufacturer: 'מרצדס',
      model: 'אקטרוס',
      year: 2021,
      color: 'לבן',
      vin: 'WDB1234567890123',
      maxWeight: 3500,
      platformLength: 5.5,
      vehicleCapacity: 2,
      licenseExpiry: '2025-06-15',
      insuranceExpiry: '2025-03-20',
      testExpiry: '2025-04-01',
      status: 'available',
      driverId: null,
      driverName: null,
      currentTask: null,
      maintenanceReason: '',
      todayTows: 2,
      totalTows: 156,
      notes: '',
      isActive: true
    },
    {
      id: 2,
      plate: '23-456-78',
      type: 'lift',
      typeName: 'הרמה',
      manufacturer: 'איווקו',
      model: 'דיילי',
      year: 2020,
      color: 'כחול',
      vin: 'ZCF1234567890456',
      maxWeight: 2500,
      platformLength: 4.5,
      vehicleCapacity: 1,
      licenseExpiry: '2025-08-10',
      insuranceExpiry: '2025-07-15',
      testExpiry: '2025-05-20',
      status: 'busy',
      driverId: 2,
      driverName: 'דוד אברהם',
      currentTask: 'T-1002',
      maintenanceReason: '',
      todayTows: 1,
      totalTows: 203,
      notes: '',
      isActive: true
    },
    {
      id: 3,
      plate: '34-567-89',
      type: 'flatbed',
      typeName: 'משטח',
      manufacturer: 'מאן',
      model: 'TGL',
      year: 2022,
      color: 'לבן',
      vin: 'WMA1234567890789',
      maxWeight: 4000,
      platformLength: 6.0,
      vehicleCapacity: 2,
      licenseExpiry: '2025-12-22',
      insuranceExpiry: '2025-11-30',
      testExpiry: '2025-10-15',
      status: 'busy',
      driverId: 3,
      driverName: 'יעקב מזרחי',
      currentTask: 'T-1003',
      maintenanceReason: '',
      todayTows: 3,
      totalTows: 89,
      notes: '',
      isActive: true
    },
    {
      id: 4,
      plate: '45-678-90',
      type: 'heavy',
      typeName: 'כבד',
      manufacturer: 'סקניה',
      model: 'R450',
      year: 2019,
      color: 'אדום',
      vin: 'YS21234567890012',
      maxWeight: 12000,
      platformLength: 8.0,
      vehicleCapacity: 3,
      licenseExpiry: '2025-04-05',
      insuranceExpiry: '2025-02-10',
      testExpiry: '2025-03-01',
      status: 'available',
      driverId: null,
      driverName: null,
      currentTask: null,
      maintenanceReason: '',
      todayTows: 1,
      totalTows: 312,
      notes: '',
      isActive: true
    },
    {
      id: 5,
      plate: '78-901-23',
      type: 'flatbed',
      typeName: 'משטח',
      manufacturer: 'מאן',
      model: 'TGM',
      year: 2018,
      color: 'לבן',
      vin: 'WMA9876543210321',
      maxWeight: 3500,
      platformLength: 5.0,
      vehicleCapacity: 2,
      licenseExpiry: '2025-07-12',
      insuranceExpiry: '2025-06-20',
      testExpiry: '2025-08-01',
      status: 'maintenance',
      driverId: null,
      driverName: null,
      currentTask: null,
      maintenanceReason: 'החלפת בלמים',
      todayTows: 0,
      totalTows: 267,
      notes: '',
      isActive: true
    },
  ])

  const typeConfig = {
    flatbed: { label: 'משטח', color: 'bg-blue-100 text-blue-600', iconBg: 'bg-blue-100' },
    lift: { label: 'הרמה', color: 'bg-purple-100 text-purple-600', iconBg: 'bg-purple-100' },
    heavy: { label: 'כבד', color: 'bg-amber-100 text-amber-600', iconBg: 'bg-amber-100' },
    combined: { label: 'משולב', color: 'bg-emerald-100 text-emerald-600', iconBg: 'bg-emerald-100' },
  }

  const statusConfig = {
    available: { label: 'פנוי', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    busy: { label: 'בפעילות', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    maintenance: { label: 'בטיפול', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    inactive: { label: 'לא פעיל', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  }

  const stats = {
    total: trucks.length,
    available: trucks.filter(t => t.status === 'available').length,
    busy: trucks.filter(t => t.status === 'busy').length,
    maintenance: trucks.filter(t => t.status === 'maintenance').length,
  }

  const filteredTrucks = trucks.filter(truck => {
    if (typeFilter !== 'all' && truck.type !== typeFilter) return false
    if (statusFilter !== 'all' && truck.status !== statusFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!truck.plate.includes(query) && 
          !truck.manufacturer.toLowerCase().includes(query) &&
          !truck.model.toLowerCase().includes(query)) {
        return false
      }
    }
    return true
  })

  const isExpired = (dateStr: string) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    return date < new Date()
  }

  const isExpiringSoon = (dateStr: string) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    const today = new Date()
    const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    return date > today && date <= thirtyDays
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('he-IL')
  }

  const resetForm = () => {
    setFormData({
      plate: '',
      type: '',
      manufacturer: '',
      model: '',
      year: new Date().getFullYear(),
      color: '',
      vin: '',
      maxWeight: 0,
      platformLength: 0,
      vehicleCapacity: 1,
      licenseExpiry: '',
      insuranceExpiry: '',
      testExpiry: '',
      driverAssignment: 'none',
      selectedDriverId: null,
      initialStatus: 'available',
      maintenanceReason: '',
      notes: '',
    })
    setShowExpiryWarning(false)
    setShowDuplicateWarning(false)
  }

  const openAddModal = () => {
    setEditingTruck(null)
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (truck: TruckData) => {
    setEditingTruck(truck)
    setFormData({
      plate: truck.plate,
      type: truck.type,
      manufacturer: truck.manufacturer,
      model: truck.model,
      year: truck.year,
      color: truck.color,
      vin: truck.vin,
      maxWeight: truck.maxWeight,
      platformLength: truck.platformLength,
      vehicleCapacity: truck.vehicleCapacity,
      licenseExpiry: truck.licenseExpiry,
      insuranceExpiry: truck.insuranceExpiry,
      testExpiry: truck.testExpiry,
      driverAssignment: truck.driverId ? 'existing' : 'none',
      selectedDriverId: truck.driverId,
      initialStatus: truck.status === 'inactive' ? 'inactive' : 'available',
      maintenanceReason: truck.maintenanceReason,
      notes: truck.notes,
    })
    setShowModal(true)
  }

  const checkDuplicates = () => {
    const duplicate = trucks.find(t => {
      if (editingTruck && t.id === editingTruck.id) return false
      return t.plate === formData.plate
    })
    return !!duplicate
  }

  const checkExpiryDates = () => {
    const warnings = []
    if (isExpired(formData.licenseExpiry)) warnings.push('רישיון רכב')
    if (isExpired(formData.testExpiry)) warnings.push('טסט')
    if (warnings.length > 0) {
      setExpiryWarningMessage(warnings.join(' ו') + ' פג תוקף!')
      return true
    }
    return false
  }

  const handleSave = () => {
    if (!formData.plate || !formData.type) return

    if (checkDuplicates()) {
      setShowDuplicateWarning(true)
      return
    }

    if (checkExpiryDates() && !showExpiryWarning) {
      setShowExpiryWarning(true)
      return
    }

    const typeName = typeConfig[formData.type as keyof typeof typeConfig]?.label || ''
    const selectedDriver = drivers.find(d => d.id === formData.selectedDriverId)

    if (editingTruck) {
      setTrucks(trucks.map(t => 
        t.id === editingTruck.id 
          ? { 
              ...t,
              plate: formData.plate,
              type: formData.type as TruckData['type'],
              typeName,
              manufacturer: formData.manufacturer,
              model: formData.model,
              year: formData.year,
              color: formData.color,
              vin: formData.vin,
              maxWeight: formData.maxWeight,
              platformLength: formData.platformLength,
              vehicleCapacity: formData.vehicleCapacity,
              licenseExpiry: formData.licenseExpiry,
              insuranceExpiry: formData.insuranceExpiry,
              testExpiry: formData.testExpiry,
              driverId: formData.driverAssignment === 'existing' ? formData.selectedDriverId : null,
              driverName: formData.driverAssignment === 'existing' && selectedDriver ? selectedDriver.name : null,
              maintenanceReason: formData.maintenanceReason,
              notes: formData.notes,
            }
          : t
      ))
    } else {
      const newTruck: TruckData = {
        id: Math.max(...trucks.map(t => t.id), 0) + 1,
        plate: formData.plate,
        type: formData.type as TruckData['type'],
        typeName,
        manufacturer: formData.manufacturer,
        model: formData.model,
        year: formData.year,
        color: formData.color,
        vin: formData.vin,
        maxWeight: formData.maxWeight,
        platformLength: formData.platformLength,
        vehicleCapacity: formData.vehicleCapacity,
        licenseExpiry: formData.licenseExpiry,
        insuranceExpiry: formData.insuranceExpiry,
        testExpiry: formData.testExpiry,
        status: formData.initialStatus,
        driverId: formData.driverAssignment === 'existing' ? formData.selectedDriverId : null,
        driverName: formData.driverAssignment === 'existing' && selectedDriver ? selectedDriver.name : null,
        currentTask: null,
        maintenanceReason: '',
        todayTows: 0,
        totalTows: 0,
        notes: formData.notes,
        isActive: formData.initialStatus !== 'inactive',
      }
      setTrucks([...trucks, newTruck])
    }
    setShowModal(false)
    resetForm()
  }

  const handleDelete = (id: number) => {
    setTrucks(trucks.filter(t => t.id !== id))
    setShowDeleteConfirm(null)
  }

  const availableDrivers = drivers.filter(d => !d.hasTruck || d.id === formData.selectedDriverId)

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4 lg:mb-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ניהול גררים</h1>
            <p className="text-gray-500 mt-1 text-sm hidden sm:block">צפייה וניהול צי הגררים</p>
          </div>
          <button
            onClick={openAddModal}
            className="hidden lg:flex items-center justify-center gap-2 px-4 py-2.5 bg-[#33d4ff] hover:bg-[#21b8e6] text-white rounded-xl transition-colors"
          >
            <Plus size={20} />
            הוסף גרר
          </button>
        </div>
        <button
          onClick={openAddModal}
          className="lg:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-[#33d4ff] hover:bg-[#21b8e6] text-white rounded-xl transition-colors w-full"
        >
          <Plus size={20} />
          הוסף גרר
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <Truck size={18} className="text-blue-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-xs text-gray-500">סה״כ</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <CheckCircle size={18} className="text-emerald-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.available}</p>
          <p className="text-xs text-gray-500">פנויים</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <Clock size={18} className="text-blue-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.busy}</p>
          <p className="text-xs text-gray-500">בפעילות</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <Wrench size={18} className="text-amber-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.maintenance}</p>
          <p className="text-xs text-gray-500">בטיפול</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש לפי מספר רישוי, יצרן או דגם..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1">
              {[
                { id: 'all', label: 'הכל' },
                { id: 'flatbed', label: 'משטח' },
                { id: 'lift', label: 'הרמה' },
                { id: 'heavy', label: 'כבד' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setTypeFilter(filter.id as any)}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                    typeFilter === filter.id
                      ? 'bg-[#33d4ff] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {[
                { id: 'all', label: 'כל הסטטוסים' },
                { id: 'available', label: 'פנוי' },
                { id: 'busy', label: 'בפעילות' },
                { id: 'maintenance', label: 'בטיפול' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id as any)}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                    statusFilter === filter.id
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTrucks.map((truck) => (
          <div
            key={truck.id}
            className={`bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow border-r-4 ${
              truck.status === 'available' ? 'border-r-emerald-500' :
              truck.status === 'busy' ? 'border-r-blue-500' :
              truck.status === 'maintenance' ? 'border-r-amber-500' :
              'border-r-gray-400'
            } ${!truck.isActive ? 'opacity-60' : ''}`}
          >
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeConfig[truck.type]?.iconBg || 'bg-gray-100'}`}>
                    <Truck size={24} className={truck.type === 'flatbed' ? 'text-blue-600' : truck.type === 'lift' ? 'text-purple-600' : 'text-amber-600'} />
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-gray-800 text-lg">{truck.plate}</h3>
                    <p className="text-sm text-gray-500">{truck.typeName}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-lg ${statusConfig[truck.status]?.color}`}>
                  {statusConfig[truck.status]?.label}
                </span>
              </div>

              <div className="mb-4 p-3 bg-gray-100 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">רכב:</span>
                  <span className="text-gray-800 font-medium">{truck.manufacturer} {truck.model}, {truck.year}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-500">קיבולת:</span>
                  <span className="text-gray-800 font-medium">{truck.vehicleCapacity} רכבים</span>
                </div>
              </div>

              {truck.status === 'busy' && truck.driverName && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
                        <User size={14} className="text-blue-700" />
                      </div>
                      <span className="text-sm font-medium text-blue-800">{truck.driverName}</span>
                    </div>
                    <span className="text-xs font-mono text-blue-600">{truck.currentTask}</span>
                  </div>
                </div>
              )}

              {truck.status === 'maintenance' && truck.maintenanceReason && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Wrench size={16} className="text-amber-600" />
                    <span className="text-sm text-amber-700">{truck.maintenanceReason}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">רישיון רכב:</span>
                  <span className={`font-medium ${isExpired(truck.licenseExpiry) ? 'text-red-600' : isExpiringSoon(truck.licenseExpiry) ? 'text-amber-600' : 'text-gray-700'}`}>
                    {formatDate(truck.licenseExpiry)}
                    {isExpired(truck.licenseExpiry) && (
                      <span className="mr-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">פג</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">טסט:</span>
                  <span className={`font-medium ${isExpired(truck.testExpiry) ? 'text-red-600' : isExpiringSoon(truck.testExpiry) ? 'text-amber-600' : 'text-gray-700'}`}>
                    {formatDate(truck.testExpiry)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">ביטוח:</span>
                  <span className={`font-medium ${isExpired(truck.insuranceExpiry) ? 'text-red-600' : 'text-gray-700'}`}>
                    {formatDate(truck.insuranceExpiry)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-gray-100 rounded-xl border border-gray-200">
                  <p className="text-xl font-bold text-gray-800">{truck.todayTows}</p>
                  <p className="text-xs text-gray-500">גרירות היום</p>
                </div>
                <div className="text-center p-3 bg-gray-100 rounded-xl border border-gray-200">
                  <p className="text-xl font-bold text-gray-800">{truck.totalTows}</p>
                  <p className="text-xs text-gray-500">סה״כ גרירות</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-gray-100/80 border-t border-gray-200 flex items-center justify-end gap-1">
              <button
                onClick={() => openEditModal(truck)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(truck.id)}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTrucks.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
          <Truck size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">לא נמצאו גררים</h3>
          <p className="text-gray-500">נסה לשנות את החיפוש או הסינון</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:rounded-2xl lg:max-w-2xl lg:mx-4 overflow-hidden max-h-[95vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
              <h2 className="font-bold text-lg">
                {editingTruck ? 'עריכת גרר' : 'הוספת גרר חדש'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">1</span>
                  פרטי רכב
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">מספר רישוי *</label>
                      <input
                        type="text"
                        value={formData.plate}
                        onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                        placeholder="12-345-67"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">סוג גרר *</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                      >
                        <option value="">בחר סוג</option>
                        <option value="flatbed">משטח</option>
                        <option value="lift">הרמה</option>
                        <option value="heavy">כבד</option>
                        <option value="combined">משולב</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">יצרן</label>
                      <input
                        type="text"
                        value={formData.manufacturer}
                        onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                        placeholder="לדוגמה: מרצדס"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">דגם</label>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        placeholder="לדוגמה: אקטרוס"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">שנת ייצור</label>
                      <input
                        type="number"
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                        min="2000"
                        max="2030"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">קיבולת רכבים</label>
                      <input
                        type="number"
                        value={formData.vehicleCapacity}
                        onChange={(e) => setFormData({ ...formData, vehicleCapacity: Number(e.target.value) })}
                        min="1"
                        max="5"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">2</span>
                  תוקף רישיונות
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">תוקף רישיון רכב</label>
                      <input
                        type="date"
                        value={formData.licenseExpiry}
                        onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">תוקף טסט</label>
                      <input
                        type="date"
                        value={formData.testExpiry}
                        onChange={(e) => setFormData({ ...formData, testExpiry: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">תוקף ביטוח</label>
                      <input
                        type="date"
                        value={formData.insuranceExpiry}
                        onChange={(e) => setFormData({ ...formData, insuranceExpiry: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">3</span>
                  שיוך נהג
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFormData({ ...formData, driverAssignment: 'existing', selectedDriverId: null })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.driverAssignment === 'existing' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      שייך לנהג
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, driverAssignment: 'none' })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.driverAssignment === 'none' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      ללא שיוך
                    </button>
                  </div>

                  {formData.driverAssignment === 'existing' && (
                    <div className="space-y-2">
                      {availableDrivers.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <p className="text-sm text-amber-800">אין נהגים ללא גרר</p>
                        </div>
                      ) : (
                        availableDrivers.map((driver) => (
                          <label
                            key={driver.id}
                            className={`flex items-center gap-4 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                              formData.selectedDriverId === driver.id
                                ? 'border-[#33d4ff] bg-cyan-50'
                                : driver.hasTruck
                                ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="driver"
                              checked={formData.selectedDriverId === driver.id}
                              onChange={() => setFormData({ ...formData, selectedDriverId: driver.id })}
                              disabled={driver.hasTruck && driver.id !== formData.selectedDriverId}
                              className="w-4 h-4 text-[#33d4ff]"
                            />
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <User size={18} className="text-gray-600" />
                            </div>
                            <div className="flex-1">
                              <span className="font-medium text-gray-800">{driver.name}</span>
                              <p className="text-sm text-gray-500">{driver.phone}</p>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded-lg ${
                              driver.hasTruck ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {driver.hasTruck ? 'משויך' : 'ללא גרר'}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  )}

                  {formData.driverAssignment === 'none' && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                      <p className="text-sm text-gray-600">תוכל לשייך נהג לגרר בכל עת דרך עריכת הגרר או הנהג.</p>
                    </div>
                  )}
                </div>
              </div>

              {!editingTruck && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">4</span>
                    סטטוס התחלתי
                  </h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFormData({ ...formData, initialStatus: 'available' })}
                      className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                        formData.initialStatus === 'available'
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <CheckCircle size={24} className={`mx-auto mb-1 ${formData.initialStatus === 'available' ? 'text-emerald-600' : 'text-gray-400'}`} />
                      <p className={`text-sm font-medium ${formData.initialStatus === 'available' ? 'text-emerald-700' : 'text-gray-600'}`}>פעיל</p>
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, initialStatus: 'inactive' })}
                      className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                        formData.initialStatus === 'inactive'
                          ? 'border-gray-500 bg-gray-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <XCircle size={24} className={`mx-auto mb-1 ${formData.initialStatus === 'inactive' ? 'text-gray-600' : 'text-gray-400'}`} />
                      <p className={`text-sm font-medium ${formData.initialStatus === 'inactive' ? 'text-gray-700' : 'text-gray-600'}`}>לא פעיל</p>
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">
                    {editingTruck ? '4' : '5'}
                  </span>
                  הערות
                </h3>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות על הגרר (תקלות ידועות, מגבלות וכו')..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
              >
                ביטול
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.plate || !formData.type}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 transition-colors font-medium"
              >
                {editingTruck ? 'שמור' : 'הוסף גרר'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicateWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">גרר כבר קיים</h2>
              <p className="text-gray-600">גרר עם מספר רישוי {formData.plate} כבר קיים במערכת</p>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowDuplicateWarning(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                הבנתי
              </button>
            </div>
          </div>
        </div>
      )}

      {showExpiryWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">תוקף פג</h2>
              <p className="text-gray-600">{expiryWarningMessage}</p>
              <p className="text-gray-600 mt-2">האם להמשיך בכל זאת?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowExpiryWarning(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                חזור
              </button>
              <button
                onClick={() => {
                  setShowExpiryWarning(false)
                  handleSave()
                }}
                className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
              >
                המשך בכל זאת
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">מחיקת גרר</h3>
              <p className="text-gray-500">האם למחוק את הגרר?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
