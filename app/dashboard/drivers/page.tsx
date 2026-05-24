'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Phone, Truck, Edit2, Trash2, X, User, CheckCircle, Clock, XCircle, MoreHorizontal, AlertTriangle, MapPin, BarChart2, RefreshCw } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { getDrivers, createDriver, updateDriver, deleteDriver, checkDuplicates } from '../../lib/queries/drivers'
import { DriverWithDetails, DriverStatus, TowTruck } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import DriversMap from '../../components/DriversMap'
import DriverHoursTab from '../../components/DriverHoursTab'
import ResendInviteModal from '../../components/ResendInviteModal'
import {
  LICENSE_CATEGORIES,
  LICENSE_PERMITS,
  formatLicenseLabel,
  getDriverLicenseCategoriesDisplay,
  toggleLicenseCode,
} from '../../lib/constants/driver-licenses'

function getTruckTypeLabel(type: string) {
  const types: Record<string, string> = {
    carrier: 'מובילית',
    carrier_large: 'מובילית 10+ רכבים',
    crane_tow: 'גרר מנוף',
    dolly: 'דולי (מערסל ידני)',
    flatbed: 'רמסע',
    heavy_equipment: 'ציוד כבד/לובי',
    heavy_rescue: 'חילוץ כבד',
    wheel_lift_cradle: 'משקפיים (מערסל)',
  }
  return types[type] || type
}

function DriverLicenseChips({ driver }: { driver: DriverWithDetails }) {
  const categories =
    driver.license_categories?.length > 0
      ? driver.license_categories
      : driver.license_type
        ? [driver.license_type]
        : []
  const permits = driver.license_permits ?? []

  if (categories.length === 0 && permits.length === 0) {
    return <span className="text-gray-400 text-sm">---</span>
  }

  return (
    <div className="flex flex-col gap-1.5 items-start">
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {categories.map((code) => (
            <span
              key={code}
              className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium"
            >
              {code}
            </span>
          ))}
        </div>
      )}
      {permits.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {permits.map((code) => (
            <span
              key={code}
              className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium"
              title="היתר"
            >
              {code}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function AssignedTrucksCell({ trucks }: { trucks: TowTruck[] }) {
  if (trucks.length === 0) {
    return <span className="text-gray-400">ללא גרר משויך</span>
  }
  if (trucks.length === 1) {
    const t = trucks[0]
    return (
      <div className="flex items-center gap-2 text-gray-600">
        <Truck size={16} />
        <span>
          גרר: {t.plate_number}
          <span className="text-gray-400 text-xs mr-1">({getTruckTypeLabel(t.truck_type)})</span>
        </span>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {trucks.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-sm"
        >
          <Truck size={12} className="text-gray-500" />
          {t.plate_number}
        </span>
      ))}
    </div>
  )
}

export default function DriversPage() {
  const { companyId } = useAuth()
  
  const [activeTab, setActiveTab] = useState<'list' | 'map' | 'hours'>('list')
  const [driversWithLocation, setDriversWithLocation] = useState<any[]>([])

  // Data states
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [trucks, setTrucks] = useState<TowTruck[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newDriverPassword, setNewDriverPassword] = useState<string | null>(null)

  
  // UI states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'busy' | 'unavailable' | 'break'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingDriver, setEditingDriver] = useState<DriverWithDetails | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [resendModal, setResendModal] = useState<{
    isOpen: boolean
    driverId: string | null
    email: string
  }>({ isOpen: false, driverId: null, email: '' })
  const [showLicenseWarning, setShowLicenseWarning] = useState(false)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [duplicateField, setDuplicateField] = useState('')
  const [duplicateDriverName, setDuplicateDriverName] = useState('')
  const [error, setError] = useState('')

   const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    idNumber: '',
    email: '',
    address: '',
    licenseNumber: '',
    licenseCategories: [] as string[],
    licensePermits: [] as string[],
    licenseExpiry: '',
    yearsExperience: 0,
    truckAssignment: 'none' as 'existing' | 'none',
    selectedTruckIds: [] as string[],
    initialStatus: 'available' as 'available' | 'unavailable',
    sendSms: true,
    sendEmail: false,
    work_hours_start: '',
    work_hours_end: '',
    notes: '',
  })

  const statusConfig = {
    available: { label: 'זמין', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle },
    on_way: { label: 'בדרך', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', icon: Clock },
    busy: { label: 'בגרירה', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', icon: Clock },
    unavailable: { label: 'לא זמין', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', icon: XCircle },
    break: { label: 'בהפסקה', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400', icon: Clock },
  }

  // טעינת נתונים
  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId])

  useEffect(() => {
  if (!companyId) return
  const channel = supabase
    .channel(`drivers-location-${companyId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'drivers',
      filter: `company_id=eq.${companyId}`
    }, () => loadData())
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [companyId])

  const loadData = async () => {
    if (!companyId) return
    
    setPageLoading(true)
    try {
      // טעינת נהגים
      const driversData = await getDrivers(companyId)
      setDrivers(driversData)

      // טעינת משאיות
      const { data: trucksData } = await supabase
        .from('tow_trucks')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)

      setTrucks(trucksData || [])
      const { getActiveDriversWithLocation } = await import('../../lib/queries/driver-shifts')
      const activeDrivers = await getActiveDriversWithLocation(companyId)
      setDriversWithLocation(activeDrivers.map((d: any) => ({
        id: d.driver.id,
        name: d.driver.user?.full_name || 'נהג',
        status: d.driver.status,
        last_lat: d.driver.last_lat,
        last_lng: d.driver.last_lng,
        last_seen_at: d.driver.last_seen_at,
      })).filter((d: any) => d.last_lat && d.last_lng))
    } catch (err) {
      console.error('Error loading data:', err)
      setError('שגיאה בטעינת הנתונים')
    } finally {
      setPageLoading(false)
    }
  }

  function openResendModal(driver: DriverWithDetails) {
    const email = driver.user?.email
    if (!email) {
      alert('אין כתובת מייל לנהג')
      return
    }
    setResendModal({
      isOpen: true,
      driverId: driver.id,
      email,
    })
    setOpenMenuId(null)
  }

  const filteredDrivers = drivers.filter(driver => {
  // אם אין חיפוש - מתאים אוטומטית
  const matchesSearch = !searchQuery || 
    driver.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    driver.user?.phone?.includes(searchQuery)
  const matchesStatus = statusFilter === 'all' || driver.status === statusFilter
  return matchesSearch && matchesStatus
})

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      phone: '',
      idNumber: '',
      email: '',
      address: '',
      licenseNumber: '',
      licenseCategories: [],
      licensePermits: [],
      licenseExpiry: '',
      yearsExperience: 0,
      truckAssignment: 'none',
      selectedTruckIds: [],
      initialStatus: 'available',
      sendSms: true,
      sendEmail: false,
      work_hours_start: '',
      work_hours_end: '',
      notes: '',
    })
    setShowLicenseWarning(false)
    setShowDuplicateWarning(false)
    setError('')
  }

  const openAddModal = () => {
    setEditingDriver(null)
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (driver: DriverWithDetails) => {
    setEditingDriver(driver)
    const nameParts = driver.user?.full_name?.split(' ') || ['', '']
    setFormData({
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      phone: driver.user?.phone || '',
      idNumber: driver.user?.id_number || '',
      email: driver.user?.email || '',
      address: driver.user?.address || '',
      licenseNumber: driver.license_number || '',
      licenseCategories: driver.license_categories?.length
        ? [...driver.license_categories]
        : driver.license_type
          ? [driver.license_type]
          : [],
      licensePermits: driver.license_permits?.length ? [...driver.license_permits] : [],
      licenseExpiry: driver.license_expiry || '',
      yearsExperience: driver.years_experience || 0,
      truckAssignment: driver.current_trucks.length > 0 ? 'existing' : 'none',
      selectedTruckIds: driver.current_trucks.map((t) => t.id),
      initialStatus: driver.status === 'unavailable' ? 'unavailable' : 'available',
      sendSms: false,
      sendEmail: false,
      work_hours_start: driver.work_hours_start || '',
      work_hours_end: driver.work_hours_end || '',
      notes: driver.notes || '',
    })
    setShowModal(true)
    setOpenMenuId(null)
  }

  const checkLicenseExpiry = () => {
    if (!formData.licenseExpiry) return false
    const expiryDate = new Date(formData.licenseExpiry)
    const today = new Date()
    return expiryDate < today
  }

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName || !formData.phone || !companyId) {
      console.log('Missing data:', { 
        firstName: formData.firstName, 
        lastName: formData.lastName, 
        phone: formData.phone, 
        companyId 
      })
      return
    }
    // בדיקת כפילויות
    const duplicate = await checkDuplicates(
      companyId,
      formData.phone,
      formData.idNumber || undefined,
      formData.licenseNumber || undefined,
      editingDriver?.user.id,
      editingDriver?.id
    )

    if (duplicate && !showDuplicateWarning) {
      setDuplicateField(duplicate.field)
      setDuplicateDriverName(duplicate.driverName)
      setShowDuplicateWarning(true)
      return
    }

    setSaving(true)
    setError('')

    try {
      if (editingDriver) {
        // עריכה
        await updateDriver({
          driverId: editingDriver.id,
          userId: editingDriver.user.id,
          phone: formData.phone,
          fullName: `${formData.firstName} ${formData.lastName}`,
          idNumber: formData.idNumber || undefined,
          address: formData.address || undefined,
          email: formData.email || undefined,
          licenseNumber: formData.licenseNumber || undefined,
          licenseCategories: formData.licenseCategories,
          licensePermits: formData.licensePermits,
          licenseExpiry: formData.licenseExpiry || undefined,
          yearsExperience: formData.yearsExperience,
          work_hours_start: formData.work_hours_start || null,
          work_hours_end: formData.work_hours_end || null,
          notes: formData.notes || undefined,
          truckIds: formData.truckAssignment === 'existing' ? formData.selectedTruckIds : [],
        })
      } else {
        // הוספה
        const result = await createDriver({
          companyId,
          email: formData.email || `${formData.phone.replace(/-/g, '')}@driver.temp`,
          phone: formData.phone,
          fullName: `${formData.firstName} ${formData.lastName}`,
          idNumber: formData.idNumber || undefined,
          address: formData.address || undefined,
          licenseNumber: formData.licenseNumber,
          licenseCategories: formData.licenseCategories,
          licensePermits: formData.licensePermits,
          licenseExpiry: formData.licenseExpiry,
          yearsExperience: formData.yearsExperience,
          notes: formData.notes || undefined,
          initialStatus: formData.initialStatus as DriverStatus,
          truckIds:
            formData.truckAssignment === 'existing' && formData.selectedTruckIds.length > 0
              ? formData.selectedTruckIds
              : undefined,
        })
        
        // הצגת הסיסמה הזמנית
        if (result.tempPassword) {
          setNewDriverPassword(result.tempPassword)
        }
      }
      if (editingDriver) {
        await loadData()
      }
      setShowModal(false)
      resetForm()
    } catch (err) {
      console.error('Error saving driver:', err)
      setError('שגיאה בשמירת הנהג')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId)
    if (!driver) return

    try {
      await deleteDriver(driverId, driver.user?.id || '')
      await loadData()
      setShowDeleteConfirm(null)
    } catch (err) {
      console.error('Error deleting driver:', err)
      setError('שגיאה במחיקת הנהג')
    }
  }

  const stats = {
    total: drivers.length,
    available: drivers.filter(d => d.status === 'available').length,
    busy: drivers.filter(d => d.status === 'busy' || d.status === 'on_way').length,
    unavailable: drivers.filter(d => d.status === 'unavailable').length,
    break: { label: 'בהפסקה', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400', icon: Clock },
  }

  const toggleSelectedTruck = (truckId: string) => {
    setFormData((prev) => {
      const nextIds = prev.selectedTruckIds.includes(truckId)
        ? prev.selectedTruckIds.filter((id) => id !== truckId)
        : [...prev.selectedTruckIds, truckId]
      return {
        ...prev,
        selectedTruckIds: nextIds,
        truckAssignment: nextIds.length > 0 ? 'existing' : 'none',
      }
    })
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500">טוען נהגים...</p>
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ניהול נהגים</h1>
          <p className="text-gray-500 mt-1 text-sm hidden sm:block">צפייה וניהול נהגי החברה</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#33d4ff] hover:bg-[#21b8e6] text-white rounded-xl transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          הוסף נהג
        </button>
      </div>

      {/* טאבים */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6 w-fit">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'list'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <User size={15} />
          רשימה
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'map'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MapPin size={15} />
          מפה חיה
        </button>
        <button
          onClick={() => setActiveTab('hours')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'hours'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart2 size={15} />
          דוחות שעות
        </button>
      </div>
      {activeTab === 'map' && (
        <div style={{ height: '600px' }}>
          <DriversMap drivers={driversWithLocation} />
        </div>
      )}

      {activeTab === 'hours' && (
        <DriverHoursTab companyId={companyId || ''} />
      )}

      {activeTab === 'list' && <>
      {/* סטטיסטיקות */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <User size={18} className="text-blue-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-xs text-gray-500">סה״כ</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <CheckCircle size={18} className="text-emerald-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.available}</p>
          <p className="text-xs text-gray-500">זמינים</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <Clock size={18} className="text-amber-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.busy}</p>
          <p className="text-xs text-gray-500">בגרירה</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <XCircle size={18} className="text-gray-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.unavailable}</p>
          <p className="text-xs text-gray-500">לא זמינים</p>
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
                placeholder="חיפוש..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              />
            </div>
            <div className="flex gap-1.5 sm:gap-2">
              {(['all', 'available', 'busy', 'unavailable', 'break'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-[#33d4ff] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? 'הכל' : statusConfig[status].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">נהג</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">טלפון</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">רישיון</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">גררים</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">גרירות היום</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">סטטוס</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDrivers.map((driver) => {
                const StatusIcon = statusConfig[driver.status]?.icon || XCircle
                const licenseExpired = driver.license_expiry && new Date(driver.license_expiry) < new Date()
                return (
                  <tr key={driver.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <User size={20} className="text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{driver.user?.full_name || 'ללא שם'}</p>
                          <p className="text-sm text-gray-500">ת.ז. {driver.user?.id_number || '---'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone size={16} />
                        <span>{driver.user?.phone || '---'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <DriverLicenseChips driver={driver} />
                        {licenseExpired && (
                          <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs shrink-0">
                            פג תוקף
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <AssignedTrucksCell trucks={driver.current_trucks} />
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-medium text-gray-800">{driver.today_tows_count || 0}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${statusConfig[driver.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                        <StatusIcon size={14} />
                        {statusConfig[driver.status]?.label || driver.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === driver.id ? null : driver.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <MoreHorizontal size={18} className="text-gray-400" />
                        </button>

                        {openMenuId === driver.id && (
                          <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10">
                            <button
                              type="button"
                              onClick={() => openResendModal(driver)}
                              className="w-full px-4 py-2 text-right text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <RefreshCw size={16} />
                              שלח קישור הזמנה חדש
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openEditModal(driver)
                                setOpenMenuId(null)
                              }}
                              className="w-full px-4 py-2 text-right text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit2 size={16} />
                              ערוך
                            </button>
                            <hr className="my-1" />
                            <button
                              type="button"
                              onClick={() => {
                                setShowDeleteConfirm(driver.id)
                                setOpenMenuId(null)
                              }}
                              className="w-full px-4 py-2 text-right text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 size={16} />
                              מחק
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden">
          {filteredDrivers.map((driver) => {
            const licenseExpired = driver.license_expiry && new Date(driver.license_expiry) < new Date()
            return (
              <div key={driver.id} className="border-b border-gray-100 last:border-b-0">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <User size={24} className="text-gray-500" />
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 ${statusConfig[driver.status]?.dot || 'bg-gray-400'} rounded-full border-2 border-white`}></div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">{driver.user?.full_name || 'ללא שם'}</p>
                        {licenseExpired && (
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs">פג תוקף</span>
                        )}
                      </div>
                      <a href={`tel:${driver.user?.phone || ''}`} className="text-sm text-[#33d4ff]">{driver.user?.phone || '---'}</a>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === driver.id ? null : driver.id)}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                      <MoreHorizontal size={20} />
                    </button>
                    
                    {openMenuId === driver.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden">
                          <button
                            onClick={() => openEditModal(driver)}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 size={16} />
                            עריכה
                          </button>
                          <button
                            type="button"
                            onClick={() => openResendModal(driver)}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <RefreshCw size={16} />
                            שלח קישור הזמנה חדש
                          </button>
                          <button
                            onClick={() => {
                              setShowDeleteConfirm(driver.id)
                              setOpenMenuId(null)
                            }}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                            מחיקה
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="px-4 pb-4 flex items-center gap-4 text-sm text-gray-600">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[driver.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                    {statusConfig[driver.status]?.label || driver.status}
                  </span>
                  <span>
                    רישיון{' '}
                    {getDriverLicenseCategoriesDisplay(
                      driver.license_categories,
                      driver.license_type
                    )}
                  </span>
                  <span>{driver.today_tows_count || 0} גרירות</span>
                </div>
                
                <div className="px-4 pb-4">
                  <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    <AssignedTrucksCell trucks={driver.current_trucks} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredDrivers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <User size={48} className="mx-auto mb-3 opacity-50" />
            <p>לא נמצאו נהגים</p>
          </div>
        )}
      </div>
      </>}


      {/* Modal הוספה/עריכה */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:rounded-2xl lg:max-w-2xl lg:mx-4 overflow-hidden max-h-[95vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
              <h2 className="font-bold text-lg">
                {editingDriver ? 'עריכת נהג' : 'הוספת נהג חדש'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* פרטים אישיים */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">1</span>
                  פרטים אישיים
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">שם פרטי *</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">שם משפחה *</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">טלפון נייד *</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="050-1234567"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">תעודת זהות</label>
                      <input
                        type="text"
                        value={formData.idNumber}
                        onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">אימייל</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">כתובת מגורים</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                </div>
              </div>

              {/* רישיון ונסיון */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">2</span>
                  רישיון ונסיון
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">מספר רישיון נהיגה *</label>
                    <input
                      type="text"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">דרגות רישיון</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-3" dir="rtl">
                      {LICENSE_CATEGORIES.map(({ code, name }) => (
                        <label
                          key={code}
                          className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.licenseCategories.includes(code)}
                            onChange={() =>
                              setFormData({
                                ...formData,
                                licenseCategories: toggleLicenseCode(
                                  formData.licenseCategories,
                                  code
                                ),
                              })
                            }
                            className="rounded border-gray-300 text-[#33d4ff] focus:ring-[#33d4ff]"
                          />
                          <span>{formatLicenseLabel(code, name)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">היתרים</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-3" dir="rtl">
                      {LICENSE_PERMITS.map(({ code, name }) => (
                        <label
                          key={code}
                          className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.licensePermits.includes(code)}
                            onChange={() =>
                              setFormData({
                                ...formData,
                                licensePermits: toggleLicenseCode(
                                  formData.licensePermits,
                                  code
                                ),
                              })
                            }
                            className="rounded border-gray-300 text-[#33d4ff] focus:ring-[#33d4ff]"
                          />
                          <span>{formatLicenseLabel(code, name)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">תוקף רישיון *</label>
                      <input
                        type="date"
                        value={formData.licenseExpiry}
                        onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">שנות ניסיון בגרירה</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.yearsExperience || ''}
                        onChange={(e) => setFormData({ ...formData, yearsExperience: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* שיוך גררים */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">3</span>
                  שיוך גררים
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, truckAssignment: 'existing' })
                      }
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.truckAssignment === 'existing' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      בחר גררים
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          truckAssignment: 'none',
                          selectedTruckIds: [],
                        })
                      }
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.truckAssignment === 'none' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      ללא גרר משויך
                    </button>
                  </div>

                  {formData.truckAssignment === 'existing' && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">בחר גררים (ניתן לבחור יותר מאחד):</p>
                      {trucks.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">אין גררים פעילים במערכת</p>
                      ) : (
                        trucks.map((truck) => {
                          const checked = formData.selectedTruckIds.includes(truck.id)
                          return (
                            <label
                              key={truck.id}
                              className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                                checked
                                  ? 'border-[#33d4ff] bg-cyan-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleSelectedTruck(truck.id)}
                                  className="w-4 h-4 text-[#33d4ff] rounded"
                                />
                                <div>
                                  <p className="font-medium text-gray-800">{truck.plate_number}</p>
                                  <p className="text-sm text-gray-500">{getTruckTypeLabel(truck.truck_type)}</p>
                                </div>
                              </div>
                            </label>
                          )
                        })
                      )}
                      {formData.selectedTruckIds.length > 0 && (
                        <p className="text-xs text-gray-500">
                          נבחרו {formData.selectedTruckIds.length} גררים
                        </p>
                      )}
                    </div>
                  )}

                  {formData.truckAssignment === 'none' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-800 text-sm">נהג ללא גרר</p>
                          <p className="text-sm text-amber-700">הנהג יתווסף למערכת אבל לא יוכל לקבל משימות עד שישויך לגרר.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* סטטוס התחלתי - רק בהוספה */}
              {!editingDriver && (
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
                      <p className={`text-sm font-medium ${formData.initialStatus === 'available' ? 'text-emerald-700' : 'text-gray-600'}`}>זמין</p>
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, initialStatus: 'unavailable' })}
                      className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                        formData.initialStatus === 'unavailable'
                          ? 'border-gray-500 bg-gray-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <XCircle size={24} className={`mx-auto mb-1 ${formData.initialStatus === 'unavailable' ? 'text-gray-600' : 'text-gray-400'}`} />
                      <p className={`text-sm font-medium ${formData.initialStatus === 'unavailable' ? 'text-gray-700' : 'text-gray-600'}`}>לא זמין</p>
                    </button>
                  </div>
                </div>
              )}

              {/* שעות עבודה */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">
                    {editingDriver ? '4' : '5'}
                  </span>
                  שעות עבודה
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">שעת התחלה</label>
                    <input
                      type="time"
                      value={formData.work_hours_start}
                      onChange={(e) => setFormData({ ...formData, work_hours_start: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">שעת סיום</label>
                    <input
                      type="time"
                      value={formData.work_hours_end}
                      onChange={(e) => setFormData({ ...formData, work_hours_end: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                </div>
              </div>

              {/* הערות */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">
                    {editingDriver ? '5' : '6'}
                  </span>
                  הערות
                </h3>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות פנימיות על הנהג (לא יוצגו לנהג)..."
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
                disabled={!formData.firstName || !formData.lastName || !formData.phone || saving}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 transition-colors font-medium"
              >
                {saving ? 'שומר...' : editingDriver ? 'שמור' : 'הוסף נהג'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* אזהרת רישיון */}
      {showLicenseWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">רישיון לא בתוקף</h2>
              <p className="text-gray-600">תוקף הרישיון שהוזן כבר עבר.</p>
              <p className="text-gray-600 mt-2">האם להמשיך בכל זאת?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowLicenseWarning(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                חזור לעריכה
              </button>
              <button
                onClick={() => {
                  setShowLicenseWarning(false)
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

      {/* אזהרת כפילות */}
      {showDuplicateWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">נהג כבר קיים</h2>
              <p className="text-gray-600">נמצא נהג עם אותו {duplicateField}:</p>
              <div className="mt-3 p-3 bg-gray-50 rounded-xl text-sm">
                <p className="font-medium text-gray-800">{duplicateDriverName}</p>
              </div>
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

      {/* אישור מחיקה */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm sm:mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">מחיקת נהג</h3>
              <p className="text-gray-500">האם למחוק את הנהג?</p>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
              >
                ביטול
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-medium"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
      {/* מודל סיסמה זמנית */}
            {newDriverPassword && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
                  <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} className="text-green-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800 mb-2">הנהג נוסף בהצלחה!</h2>
                    <p className="text-gray-600 mb-4">סיסמה זמנית להתחברות:</p>
                    <div className="bg-gray-100 rounded-xl p-4 mb-4">
                      <p className="font-mono text-xl font-bold text-gray-800 select-all">{newDriverPassword}</p>
                    </div>
                    <p className="text-sm text-amber-600">
                      ⚠️ שמרי את הסיסמה! היא לא תוצג שוב.
                    </p>
                  </div>
                  <div className="px-5 pb-5">
                    <button
                      onClick={() => {
                        setNewDriverPassword(null)
                        loadData()
                      }}
                      className="w-full py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] transition-colors"
                    >
                      הבנתי
                    </button>
                  </div>
                </div>
              </div>
            )}

      <ResendInviteModal
        isOpen={resendModal.isOpen}
        email={resendModal.email}
        onClose={() =>
          setResendModal({ isOpen: false, driverId: null, email: '' })
        }
        onConfirm={async () => {
          const driverId = resendModal.driverId
          if (!driverId) {
            return { success: false, error: 'חסר מזהה נהג' }
          }

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000)

          try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch(`/api/drivers/${driverId}/resend-invite`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session?.access_token}`,
              },
              signal: controller.signal,
            })
            let data: { error?: string }
            try {
              data = await response.json()
            } catch {
              return {
                success: false,
                error: 'תשובה לא תקינה מהשרת. נסי שוב',
              }
            }
            if (!response.ok) {
              return {
                success: false,
                error: data.error || 'שגיאה בשליחת הקישור',
              }
            }
            return { success: true }
          } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
              return {
                success: false,
                error: 'הבקשה לקחה יותר מדי זמן. נסי שוב',
              }
            }
            return { success: false, error: 'שגיאת רשת. נסי שוב' }
          } finally {
            clearTimeout(timeoutId)
          }
        }}
      />

      {openMenuId && (
        <div
          className="fixed inset-0 z-5 hidden lg:block"
          onClick={() => setOpenMenuId(null)}
        />
      )}

    </div>
  )
}