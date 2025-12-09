'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Truck, Edit2, Trash2, X, User, CheckCircle, Clock, AlertTriangle, Wrench, XCircle } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { getTrucks, createTruck, updateTruck, deleteTruck, checkTruckDuplicate } from '../../lib/queries/trucks'
import { TruckWithDetails } from '../../lib/types'
import { getDrivers } from '../../lib/queries/drivers'
import { DriverWithDetails } from '../../lib/types'

export default function TrucksPage() {
  const { companyId } = useAuth()

  // Data states
  const [trucks, setTrucks] = useState<TruckWithDetails[]>([])
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // UI states
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'carrier' | 'carrier_large' | 'crane_tow' | 'dolly' | 'flatbed_ramsa' | 'heavy_equipment' | 'heavy_rescue' | 'wheel_lift_cradle'>('all')  
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'busy' | 'maintenance'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingTruck, setEditingTruck] = useState<TruckWithDetails | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [showExpiryWarning, setShowExpiryWarning] = useState(false)
  const [expiryWarningMessage, setExpiryWarningMessage] = useState('')

  const [formData, setFormData] = useState({
    plate: '',
    type: '' as '' | 'flatbed' | 'wheel_lift' | 'heavy_duty' | 'integrated',
    manufacturer: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    maxWeight: 0,
    vehicleCapacity: 1,
    licenseExpiry: '',
    insuranceExpiry: '',
    testExpiry: '',
    driverAssignment: 'none' as 'existing' | 'none',
    selectedDriverId: null as string | null,
    initialStatus: 'available' as 'available' | 'inactive',
    notes: '',
  })

  const typeConfig: Record<string, { label: string; color: string; iconBg: string }> = {
  carrier: { label: 'מובילית', color: 'bg-blue-100 text-blue-600', iconBg: 'bg-blue-100' },
  carrier_large: { label: 'מובילית 10+', color: 'bg-indigo-100 text-indigo-600', iconBg: 'bg-indigo-100' },
  crane_tow: { label: 'גרר מנוף', color: 'bg-purple-100 text-purple-600', iconBg: 'bg-purple-100' },
  dolly: { label: 'דולי', color: 'bg-pink-100 text-pink-600', iconBg: 'bg-pink-100' },
  flatbed_ramsa: { label: 'רמסע', color: 'bg-cyan-100 text-cyan-600', iconBg: 'bg-cyan-100' },
  heavy_equipment: { label: 'ציוד כבד', color: 'bg-amber-100 text-amber-600', iconBg: 'bg-amber-100' },
  heavy_rescue: { label: 'חילוץ כבד', color: 'bg-red-100 text-red-600', iconBg: 'bg-red-100' },
  wheel_lift_cradle: { label: 'משקפיים', color: 'bg-emerald-100 text-emerald-600', iconBg: 'bg-emerald-100' },
}

  const statusConfig = {
    available: { label: 'פנוי', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    busy: { label: 'בפעילות', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    maintenance: { label: 'בטיפול', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    inactive: { label: 'לא פעיל', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  }

  // טעינת נתונים
  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId])

  const loadData = async () => {
    if (!companyId) return

    setPageLoading(true)
    try {
      const [trucksData, driversData] = await Promise.all([
        getTrucks(companyId),
        getDrivers(companyId)
      ])
      setTrucks(trucksData)
      setDrivers(driversData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('שגיאה בטעינת הנתונים')
    } finally {
      setPageLoading(false)
    }
  }

  const getTruckStatus = (truck: TruckWithDetails): 'available' | 'busy' | 'maintenance' | 'inactive' => {
    if (!truck.is_active) return 'inactive'
    // כרגע אין לנו מעקב אחרי סטטוס דינמי, אז נחזיר available או busy לפי שיוך נהג
    if (truck.assigned_driver) return 'busy'
    return 'available'
  }

  const stats = {
    total: trucks.length,
    available: trucks.filter(t => t.is_active && !t.assigned_driver).length,
    busy: trucks.filter(t => t.is_active && t.assigned_driver).length,
    maintenance: 0, // יתעדכן כשנוסיף מעקב טיפולים
  }

  const filteredTrucks = trucks.filter(truck => {
    const status = getTruckStatus(truck)
    if (typeFilter !== 'all' && truck.truck_type !== typeFilter) return false
    if (statusFilter !== 'all' && status !== statusFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!truck.plate_number.toLowerCase().includes(query) &&
          !(truck.manufacturer?.toLowerCase().includes(query)) &&
          !(truck.model?.toLowerCase().includes(query))) {
        return false
      }
    }
    return true
  })

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    return date < new Date()
  }

  const isExpiringSoon = (dateStr: string | null) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    const today = new Date()
    const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    return date > today && date <= thirtyDays
  }

  const formatDate = (dateStr: string | null) => {
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
      maxWeight: 0,
      vehicleCapacity: 1,
      licenseExpiry: '',
      insuranceExpiry: '',
      testExpiry: '',
      driverAssignment: 'none',
      selectedDriverId: null,
      initialStatus: 'available',
      notes: '',
    })
    setShowExpiryWarning(false)
    setShowDuplicateWarning(false)
    setError('')
  }

  const openAddModal = () => {
    setEditingTruck(null)
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (truck: TruckWithDetails) => {
    setEditingTruck(truck)
    setFormData({
      plate: truck.plate_number,
      type: truck.truck_type as any,
      manufacturer: truck.manufacturer || '',
      model: truck.model || '',
      year: truck.year || new Date().getFullYear(),
      color: truck.color || '',
      maxWeight: truck.max_weight_kg || 0,
      vehicleCapacity: truck.vehicle_capacity,
      licenseExpiry: truck.license_expiry || '',
      insuranceExpiry: truck.insurance_expiry || '',
      testExpiry: truck.test_expiry || '',
      driverAssignment: truck.assigned_driver ? 'existing' : 'none',
      selectedDriverId: truck.assigned_driver?.id || null,
      initialStatus: truck.is_active ? 'available' : 'inactive',
      notes: truck.notes || '',
    })
    setShowModal(true)
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

  const handleSave = async () => {
    if (!formData.plate || !formData.type || !companyId) return

    // בדיקת כפילויות
    const isDuplicate = await checkTruckDuplicate(
      companyId,
      formData.plate,
      editingTruck?.id
    )

    if (isDuplicate) {
      setShowDuplicateWarning(true)
      return
    }

    if (checkExpiryDates() && !showExpiryWarning) {
      setShowExpiryWarning(true)
      return
    }

    setSaving(true)
    setError('')

    try {
      if (editingTruck) {
        await updateTruck({
          truckId: editingTruck.id,
          plateNumber: formData.plate,
          truckType: formData.type,
          manufacturer: formData.manufacturer || undefined,
          model: formData.model || undefined,
          year: formData.year || undefined,
          color: formData.color || undefined,
          vehicleCapacity: formData.vehicleCapacity,
          maxWeightKg: formData.maxWeight || undefined,
          licenseExpiry: formData.licenseExpiry || undefined,
          insuranceExpiry: formData.insuranceExpiry || undefined,
          testExpiry: formData.testExpiry || undefined,
          notes: formData.notes || undefined,
          isActive: formData.initialStatus === 'available',
          driverId: formData.driverAssignment === 'existing' ? formData.selectedDriverId : null,
        })
      } else {
        await createTruck({
          companyId,
          plateNumber: formData.plate,
          truckType: formData.type,
          manufacturer: formData.manufacturer || undefined,
          model: formData.model || undefined,
          year: formData.year || undefined,
          color: formData.color || undefined,
          vehicleCapacity: formData.vehicleCapacity,
          maxWeightKg: formData.maxWeight || undefined,
          licenseExpiry: formData.licenseExpiry || undefined,
          insuranceExpiry: formData.insuranceExpiry || undefined,
          testExpiry: formData.testExpiry || undefined,
          notes: formData.notes || undefined,
          isActive: formData.initialStatus === 'available',
          driverId: formData.driverAssignment === 'existing' ? formData.selectedDriverId || undefined : undefined,
        })
      }

      await loadData()
      setShowModal(false)
      resetForm()
    } catch (err) {
      console.error('Error saving truck:', err)
      setError('שגיאה בשמירת הגרר')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (truckId: string) => {
    try {
      await deleteTruck(truckId)
      await loadData()
      setShowDeleteConfirm(null)
    } catch (err) {
      console.error('Error deleting truck:', err)
      setError('שגיאה במחיקת הגרר')
    }
  }

  // נהגים פנויים (בלי גרר משויך או משויכים לגרר הנוכחי)
  const availableDrivers = drivers.filter(d => 
    !d.current_truck || d.current_truck.id === editingTruck?.id
  )

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500">טוען גררים...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error}
        </div>
      )}

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

      {/* סטטיסטיקות */}
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

      {/* סינון וחיפוש */}
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
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white min-w-[140px]"
            >
              <option value="all">כל הסוגים</option>
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
      </div>

      {/* רשימת גררים */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTrucks.map((truck) => {
          const status = getTruckStatus(truck)
          return (
            <div
              key={truck.id}
              className={`bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow border-r-4 ${
                status === 'available' ? 'border-r-emerald-500' :
                status === 'busy' ? 'border-r-blue-500' :
                status === 'maintenance' ? 'border-r-amber-500' :
                'border-r-gray-400'
              } ${!truck.is_active ? 'opacity-60' : ''}`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeConfig[truck.truck_type as keyof typeof typeConfig]?.iconBg || 'bg-gray-100'}`}>
                      <Truck size={24} className={typeConfig[truck.truck_type]?.color?.split(' ')[1] || 'text-gray-600'} />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-gray-800 text-lg">{truck.plate_number}</h3>
                      <p className="text-sm text-gray-500">{typeConfig[truck.truck_type as keyof typeof typeConfig]?.label || truck.truck_type}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-lg ${statusConfig[status]?.color}`}>
                    {statusConfig[status]?.label}
                  </span>
                </div>

                <div className="mb-4 p-3 bg-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">רכב:</span>
                    <span className="text-gray-800 font-medium">
                      {truck.manufacturer || '-'} {truck.model || ''}{truck.year ? `, ${truck.year}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-500">קיבולת:</span>
                    <span className="text-gray-800 font-medium">{truck.vehicle_capacity} רכבים</span>
                  </div>
                </div>

                {truck.assigned_driver && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
                        <User size={14} className="text-blue-700" />
                      </div>
                      <span className="text-sm font-medium text-blue-800">{truck.assigned_driver.user.full_name}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">רישיון רכב:</span>
                    <span className={`font-medium ${isExpired(truck.license_expiry) ? 'text-red-600' : isExpiringSoon(truck.license_expiry) ? 'text-amber-600' : 'text-gray-700'}`}>
                      {formatDate(truck.license_expiry)}
                      {isExpired(truck.license_expiry) && (
                        <span className="mr-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">פג</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">טסט:</span>
                    <span className={`font-medium ${isExpired(truck.test_expiry) ? 'text-red-600' : isExpiringSoon(truck.test_expiry) ? 'text-amber-600' : 'text-gray-700'}`}>
                      {formatDate(truck.test_expiry)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">ביטוח:</span>
                    <span className={`font-medium ${isExpired(truck.insurance_expiry) ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatDate(truck.insurance_expiry)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-gray-100 rounded-xl border border-gray-200">
                    <p className="text-xl font-bold text-gray-800">{truck.today_tows_count || 0}</p>
                    <p className="text-xs text-gray-500">גרירות היום</p>
                  </div>
                  <div className="text-center p-3 bg-gray-100 rounded-xl border border-gray-200">
                    <p className="text-xl font-bold text-gray-800">-</p>
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
          )
        })}
      </div>

      {filteredTrucks.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
          <Truck size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">לא נמצאו גררים</h3>
          <p className="text-gray-500">נסה לשנות את החיפוש או הסינון</p>
        </div>
      )}

      {/* Modal הוספה/עריכה */}
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
              {/* פרטי רכב */}
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

              {/* תוקף רישיונות */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">2</span>
                  תוקף רישיונות
                </h3>
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

              {/* שיוך נהג */}
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
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="driver"
                              checked={formData.selectedDriverId === driver.id}
                              onChange={() => setFormData({ ...formData, selectedDriverId: driver.id })}
                              className="w-4 h-4 text-[#33d4ff]"
                            />
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <User size={18} className="text-gray-600" />
                            </div>
                            <div className="flex-1">
                              <span className="font-medium text-gray-800">{driver.user.full_name}</span>
                              <p className="text-sm text-gray-500">{driver.user.phone}</p>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* סטטוס התחלתי */}
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

              {/* הערות */}
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
                disabled={!formData.plate || !formData.type || saving}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 transition-colors font-medium"
              >
                {saving ? 'שומר...' : editingTruck ? 'שמור' : 'הוסף גרר'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* אזהרת כפילות */}
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

      {/* אזהרת תוקף */}
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

      {/* אישור מחיקה */}
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