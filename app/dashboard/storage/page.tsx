'use client'

import { useState, useEffect } from 'react'
import { 
  Plus, 
  Search, 
  Car, 
  MapPin, 
  User, 
  Edit2, 
  Trash2, 
  X, 
  Package, 
  PackageCheck, 
  PackageX,
  MoreHorizontal,
  History,
  ArrowUpFromLine,
  ArrowDownToLine,
  Calendar,
  Building2
} from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { 
  getStoredVehicles, 
  addVehicleToStorage, 
  releaseVehicleFromStorage,
  updateStoredVehicle,
  getStorageStats,
  getVehicleStorageHistory,
  StoredVehicleWithCustomer,
  StorageHistoryItem
} from '../../lib/queries/storage'
import { supabase } from '../../lib/supabase'
import { lookupVehicle } from '../../lib/vehicle-lookup'

interface Customer {
  id: string
  name: string
}

export default function StoragePage() {
  const { companyId, user } = useAuth()
  
  // Data states
  const [vehicles, setVehicles] = useState<StoredVehicleWithCustomer[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState({ total: 0, stored: 0, released: 0, byCustomer: [] as any[] })
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // UI states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'stored' | 'released' | 'all'>('stored')
  const [customerFilter, setCustomerFilter] = useState<string>('')
  const [conditionFilter, setConditionFilter] = useState<'all' | 'operational' | 'faulty'>('all')
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'release'>('add')
  const [selectedVehicle, setSelectedVehicle] = useState<StoredVehicleWithCustomer | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyData, setHistoryData] = useState<StorageHistoryItem[]>([])
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [error, setError] = useState('')


  const [showAlreadyStoredModal, setShowAlreadyStoredModal] = useState(false)
  // Form state
  const [formData, setFormData] = useState({
    plateNumber: '',
    customerId: '',
    location: '',
    notes: '',
    vehicleData: null as any,
    vehicleCondition: 'operational' as 'operational' | 'faulty',
    vehicleCode: ''
  })
  const [vehicleLookupLoading, setVehicleLookupLoading] = useState(false)

  // טעינת נתונים
  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId, statusFilter, customerFilter])

  const loadData = async () => {
    if (!companyId) return
    
    setPageLoading(true)
    try {
      // טעינת רכבים
      const vehiclesData = await getStoredVehicles(
        companyId, 
        customerFilter || undefined,
        statusFilter
      )
      setVehicles(vehiclesData)

      // טעינת סטטיסטיקות
      const statsData = await getStorageStats(companyId)
      setStats(statsData)

      // טעינת לקוחות דרך טבלת הקשר
      const { data: customersData } = await supabase
        .from('customer_company')
        .select(`
          customer_id,
          customer:customers!customer_id (
            id,
            name
          )
        `)
        .eq('company_id', companyId)
        .eq('is_active', true)

      const customers = (customersData || [])
        .map(cc => cc.customer as unknown as Customer)
        .filter(c => c !== null)
        .sort((a, b) => a.name.localeCompare(b.name, 'he'))

      setCustomers(customers)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('שגיאה בטעינת הנתונים')
    } finally {
      setPageLoading(false)
    }
  }

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = 
      vehicle.plate_number.includes(searchQuery) ||
      vehicle.customer_name?.includes(searchQuery) ||
      vehicle.location?.includes(searchQuery) ||
      vehicle.vehicle_data?.manufacturer?.includes(searchQuery) ||
      vehicle.vehicle_data?.model?.includes(searchQuery) ||
      (vehicle as any).vehicle_code?.includes(searchQuery)
    const matchesCondition = conditionFilter === 'all' || (vehicle as any).vehicle_condition === conditionFilter
    return matchesSearch && matchesCondition
  })

  const resetForm = () => {
    setFormData({
      plateNumber: '',
      customerId: '',
      location: '',
      notes: '',
      vehicleData: null,
      vehicleCondition: 'operational',
      vehicleCode: ''
    })
    setError('')
  }

  const openAddModal = () => {
    setModalMode('add')
    setSelectedVehicle(null)
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (vehicle: StoredVehicleWithCustomer) => {
    setModalMode('edit')
    setSelectedVehicle(vehicle)
    setFormData({
      plateNumber: vehicle.plate_number,
      customerId: vehicle.customer_id || '',
      location: vehicle.location || '',
      notes: vehicle.notes || '',
      vehicleData: vehicle.vehicle_data,
      vehicleCondition: (vehicle as any).vehicle_condition || 'operational',
      vehicleCode: (vehicle as any).vehicle_code || ''
    })
    setShowModal(true)
    setOpenMenuId(null)
  }

  const openReleaseModal = (vehicle: StoredVehicleWithCustomer) => {
    setModalMode('release')
    setSelectedVehicle(vehicle)
    setFormData({
      ...formData,
      notes: ''
    })
    setShowModal(true)
    setOpenMenuId(null)
  }

  const openHistoryModal = async (vehicle: StoredVehicleWithCustomer) => {
    setSelectedVehicle(vehicle)
    setOpenMenuId(null)
    try {
      const history = await getVehicleStorageHistory(vehicle.id)
      setHistoryData(history)
      setShowHistoryModal(true)
    } catch (err) {
      console.error('Error loading history:', err)
      setError('שגיאה בטעינת היסטוריה')
    }
  }

  const handleVehicleLookup = async () => {
    if (formData.plateNumber.length < 5) return
    
    setVehicleLookupLoading(true)
    try {
      const result = await lookupVehicle(formData.plateNumber)
      if (result.found && result.data) {
        setFormData({
          ...formData,
          vehicleData: result.data
        })
      }
    } catch (err) {
      console.error('Error looking up vehicle:', err)
    } finally {
      setVehicleLookupLoading(false)
    }
  }

  const handleSave = async () => {
    if (!companyId) return

    if (modalMode === 'add' && !formData.plateNumber) {
      setError('יש להזין מספר רכב')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (modalMode === 'add') {
        await addVehicleToStorage({
          companyId,
          customerId: formData.customerId || undefined,
          plateNumber: formData.plateNumber,
          vehicleData: formData.vehicleData,
          location: formData.location || undefined,
          performedBy: user?.id,
          notes: formData.notes || undefined,
          vehicleCondition: formData.vehicleCondition,
          vehicleCode: formData.vehicleCode || undefined
        })
      } else if (modalMode === 'edit' && selectedVehicle) {
        await updateStoredVehicle({
          id: selectedVehicle.id,
          customerId: formData.customerId || null,
          location: formData.location || null,
          notes: formData.notes || null
        })
      } else if (modalMode === 'release' && selectedVehicle) {
        await releaseVehicleFromStorage({
          storedVehicleId: selectedVehicle.id,
          performedBy: user?.id,
          notes: formData.notes || undefined
        })
      }

      setShowModal(false)
      resetForm()
      await loadData()
    } catch (err: any) {
      console.error('Error saving:', err)
      if (err.message === 'הרכב כבר נמצא באחסנה') {
        setShowAlreadyStoredModal(true)
      } else {
        setError(err.message || 'שגיאה בשמירה')
      }
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getVehicleDisplayName = (vehicle: StoredVehicleWithCustomer) => {
    if (vehicle.vehicle_data) {
      const { manufacturer, model, year } = vehicle.vehicle_data
      return [manufacturer, model, year].filter(Boolean).join(' ')
    }
    return 'לא ידוע'
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500">טוען רכבים באחסנה...</p>
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

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4 lg:mb-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">מאגר רכבים באחסנה</h1>
            <p className="text-gray-500 mt-1 text-sm hidden sm:block">ניהול רכבים השמורים בבסיס</p>
          </div>
          <button
            onClick={openAddModal}
            className="hidden lg:flex items-center justify-center gap-2 px-4 py-2.5 bg-[#33d4ff] hover:bg-[#21b8e6] text-white rounded-xl transition-colors"
          >
            <Plus size={20} />
            הכנס רכב לאחסנה
          </button>
        </div>
        <button
          onClick={openAddModal}
          className="lg:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-[#33d4ff] hover:bg-[#21b8e6] text-white rounded-xl transition-colors w-full"
        >
          <Plus size={20} />
          הכנס רכב לאחסנה
        </button>
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <Package size={18} className="text-blue-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-xs text-gray-500">סה״כ</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <PackageCheck size={18} className="text-emerald-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.stored}</p>
          <p className="text-xs text-gray-500">באחסנה</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <PackageX size={18} className="text-gray-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.released}</p>
          <p className="text-xs text-gray-500">שוחררו</p>
        </div>
      </div>

      {/* טבלה */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="חיפוש לפי מספר רכב, לקוח, מיקום..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
              >
                <option value="">כל הלקוחות</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                {(['stored', 'released', 'all'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-[#33d4ff] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'stored' ? 'באחסנה' : status === 'released' ? 'שוחררו' : 'הכל'}
                  </button>
                ))}
              </div>
               <div className="flex gap-1">
                {(['all', 'operational', 'faulty'] as const).map((cond) => (
                  <button
                    key={cond}
                    onClick={() => setConditionFilter(cond)}
                    className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                      conditionFilter === cond
                        ? cond === 'faulty' ? 'bg-red-500 text-white' : cond === 'operational' ? 'bg-emerald-500 text-white' : 'bg-[#33d4ff] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cond === 'all' ? 'כל המצבים' : cond === 'operational' ? 'תקינים' : 'תקולים'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">רכב</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">לקוח</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">מיקום</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">תאריך כניסה</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">סטטוס</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <Car size={20} className="text-gray-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800">{vehicle.plate_number}</p>
                          {(vehicle as any).vehicle_condition === 'faulty' && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">תקול</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-500">{getVehicleDisplayName(vehicle)}</p>
                          {(vehicle as any).vehicle_code && (
                            <span className="text-xs text-blue-600">#{(vehicle as any).vehicle_code}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Building2 size={16} />
                      <span>{vehicle.customer_name || 'לא משויך'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin size={16} />
                      <span>{vehicle.location || '---'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar size={16} />
                      <span>{formatDate(vehicle.last_stored_at)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                      vehicle.current_status === 'stored' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {vehicle.current_status === 'stored' ? (
                        <>
                          <PackageCheck size={14} />
                          באחסנה
                        </>
                      ) : (
                        <>
                          <PackageX size={14} />
                          שוחרר
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {vehicle.current_status === 'stored' && (
                        <button
                          onClick={() => openReleaseModal(vehicle)}
                          className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                          title="שחרר מאחסנה"
                        >
                          <ArrowUpFromLine size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(vehicle)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="עריכה"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => openHistoryModal(vehicle)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="היסטוריה"
                      >
                        <History size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden">
          {filteredVehicles.map((vehicle) => (
            <div key={vehicle.id} className="border-b border-gray-100 last:border-b-0">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <Car size={24} className="text-gray-500" />
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                      vehicle.current_status === 'stored' ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}></div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">{vehicle.plate_number}</p>
                      {(vehicle as any).vehicle_condition === 'faulty' && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">תקול</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-500">{getVehicleDisplayName(vehicle)}</p>
                      {(vehicle as any).vehicle_code && (
                        <span className="text-xs text-blue-600">#{(vehicle as any).vehicle_code}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="relative">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === vehicle.id ? null : vehicle.id)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  
                  {openMenuId === vehicle.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden min-w-[140px]">
                        {vehicle.current_status === 'stored' && (
                          <button
                            onClick={() => openReleaseModal(vehicle)}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-orange-600 hover:bg-orange-50"
                          >
                            <ArrowUpFromLine size={16} />
                            שחרור
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(vehicle)}
                          className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Edit2 size={16} />
                          עריכה
                        </button>
                        <button
                          onClick={() => openHistoryModal(vehicle)}
                          className="flex items-center gap-2 w-full px-4 py-3 text-sm text-blue-600 hover:bg-blue-50"
                        >
                          <History size={16} />
                          היסטוריה
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="px-4 pb-4 flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  vehicle.current_status === 'stored' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {vehicle.current_status === 'stored' ? 'באחסנה' : 'שוחרר'}
                </span>
                {vehicle.customer_name && (
                  <span className="flex items-center gap-1">
                    <Building2 size={14} />
                    {vehicle.customer_name}
                  </span>
                )}
                {vehicle.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {vehicle.location}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredVehicles.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Package size={48} className="mx-auto mb-3 opacity-50" />
            <p>לא נמצאו רכבים</p>
          </div>
        )}
      </div>

      {/* Modal הוספה/עריכה/שחרור */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:rounded-2xl lg:max-w-lg lg:mx-4 overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl">
            <div className={`flex items-center justify-between px-5 py-4 border-b border-gray-200 text-white flex-shrink-0 ${
              modalMode === 'release' ? 'bg-orange-500' : 'bg-[#33d4ff]'
            }`}>
              <h2 className="font-bold text-lg">
                {modalMode === 'add' ? 'הכנסת רכב לאחסנה' : 
                 modalMode === 'edit' ? 'עריכת פרטי רכב' : 
                 'שחרור רכב מאחסנה'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {modalMode === 'release' && selectedVehicle ? (
                <>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="font-medium text-orange-800 mb-2">האם לשחרר את הרכב?</p>
                    <div className="flex items-center gap-3">
                      <Car size={24} className="text-orange-600" />
                      <div>
                        <p className="font-bold text-gray-800">{selectedVehicle.plate_number}</p>
                        <p className="text-sm text-gray-600">{getVehicleDisplayName(selectedVehicle)}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">הערות שחרור</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="למשל: שוחרר ללקוח, נלקח לגרירה..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* מספר רכב */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">מספר רכב *</label>
                    <input
                      type="text"
                      value={formData.plateNumber}
                      onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                      onBlur={handleVehicleLookup}
                      disabled={modalMode === 'edit'}
                      placeholder="12-345-67"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] disabled:bg-gray-100"
                    />
                    {vehicleLookupLoading && (
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                        מחפש במאגר...
                      </p>
                    )}
                  </div>

                  {/* מידע רכב */}
                  {formData.vehicleData && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="font-medium text-gray-800 mb-1">
                        {formData.vehicleData.manufacturer} {formData.vehicleData.model} {formData.vehicleData.year}
                      </p>
                      <p className="text-xs text-gray-500">
                        {[
                          formData.vehicleData.color && `צבע: ${formData.vehicleData.color}`,
                          formData.vehicleData.gearType && `גיר: ${formData.vehicleData.gearType}`,
                          formData.vehicleData.driveType && `הנעה: ${formData.vehicleData.driveType}`
                        ].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                  )}

                  {/* לקוח */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">לקוח</label>
                    <select
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                    >
                      <option value="">ללא לקוח</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* מיקום */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">מיקום בבסיס</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="למשל: חניה 5, מגרש אחורי..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>

                  {/* קוד רכב */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">קוד רכב</label>
                    <input
                      type="text"
                      value={formData.vehicleCode}
                      onChange={(e) => setFormData({ ...formData, vehicleCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      placeholder="קוד זיהוי פנימי"
                    />
                  </div>

                  {/* מצב רכב */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">מצב רכב</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, vehicleCondition: 'operational' })}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                          formData.vehicleCondition === 'operational'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        תקין
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, vehicleCondition: 'faulty' })}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                          formData.vehicleCondition === 'faulty'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        תקול
                      </button>
                    </div>
                  </div>

                  {/* הערות */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">הערות</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="הערות נוספות..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                </>
              )}
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
                disabled={saving || (modalMode === 'add' && !formData.plateNumber)}
                className={`flex-1 py-3 text-white rounded-xl transition-colors font-medium disabled:bg-gray-300 ${
                  modalMode === 'release' 
                    ? 'bg-orange-500 hover:bg-orange-600' 
                    : 'bg-[#33d4ff] hover:bg-[#21b8e6]'
                }`}
              >
                {saving ? 'שומר...' : 
                 modalMode === 'add' ? 'הכנס לאחסנה' : 
                 modalMode === 'edit' ? 'שמור' : 
                 'שחרר'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal היסטוריה */}
      {showHistoryModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:rounded-2xl lg:max-w-md lg:mx-4 overflow-hidden max-h-[80vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-blue-500 text-white flex-shrink-0">
              <div>
                <h2 className="font-bold text-lg">היסטוריית אחסנה</h2>
                <p className="text-sm text-blue-100">{selectedVehicle.plate_number}</p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {historyData.length === 0 ? (
                <p className="text-center text-gray-500 py-8">אין היסטוריה</p>
              ) : (
                <div className="space-y-3">
                  {historyData.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.action === 'in' ? 'bg-emerald-100' : 'bg-orange-100'
                      }`}>
                        {item.action === 'in' ? (
                          <ArrowDownToLine size={16} className="text-emerald-600" />
                        ) : (
                          <ArrowUpFromLine size={16} className="text-orange-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">
                          {item.action === 'in' ? 'נכנס לאחסנה' : 'שוחרר מאחסנה'}
                        </p>
                        <p className="text-sm text-gray-500">{formatDate(item.performed_at)}</p>
                        {item.performed_by_name && (
                          <p className="text-xs text-gray-400">ע״י {item.performed_by_name}</p>
                        )}
                        {item.notes && (
                          <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - רכב כבר באחסנה */}
      {showAlreadyStoredModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package size={32} className="text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">הרכב כבר באחסנה</h2>
              <p className="text-gray-500">רכב עם מספר זה כבר נמצא במאגר האחסנה</p>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
              <button 
                onClick={() => {
                  setShowAlreadyStoredModal(false)
                  setShowModal(false)
                  resetForm()
                }}
                className="w-full py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] transition-colors font-medium"
              >
                הבנתי
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}