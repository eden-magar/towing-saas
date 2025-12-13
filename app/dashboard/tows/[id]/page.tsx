'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
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
  RefreshCw,
  Receipt
} from 'lucide-react'
import { useAuth } from '../../../lib/AuthContext'
import { getTow, updateTow, updateTowStatus, assignDriver, TowWithDetails } from '../../../lib/queries/tows'
import { getDrivers } from '../../../lib/queries/drivers'
import { getTrucks } from '../../../lib/queries/trucks'
import { getCustomers, CustomerWithDetails } from '../../../lib/queries/customers'
import { createInvoiceFromTow, towHasInvoice } from '../../../lib/queries/invoices'
import { DriverWithDetails, TruckWithDetails } from '../../../lib/types'

interface EditVehicle {
  id: string
  plateNumber: string
  manufacturer: string
  model: string
  year: number
  vehicleType: string
  color: string
  towReason: string
}

export default function TowDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, companyId } = useAuth()
  const towId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tow, setTow] = useState<TowWithDetails | null>(null)
  
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [trucks, setTrucks] = useState<TruckWithDetails[]>([])
  const [customers, setCustomers] = useState<CustomerWithDetails[]>([])
  
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'images'>('details')
  const [isEditing, setIsEditing] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showChangeDriverModal, setShowChangeDriverModal] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null)
  const [driverSearch, setDriverSearch] = useState('')
  const [showCantEditModal, setShowCantEditModal] = useState(false)
  const [showRemoveDriverConfirm, setShowRemoveDriverConfirm] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelStep, setCancelStep] = useState<'warning' | 'reason' | 'confirm'>('reason')
  const [cancelReason, setCancelReason] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [showCantCancelModal, setShowCantCancelModal] = useState(false)
  const [assigning, setAssigning] = useState(false)

  // Invoice state
  const [hasInvoice, setHasInvoice] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [invoiceData, setInvoiceData] = useState({
    description: '',
    amount: ''
  })

  // Edit form state
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null)
  const [editCustomerSearch, setEditCustomerSearch] = useState('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editVehicles, setEditVehicles] = useState<EditVehicle[]>([])
  const [editFromAddress, setEditFromAddress] = useState('')
  const [editToAddress, setEditToAddress] = useState('')
  const [editFinalPrice, setEditFinalPrice] = useState(0)


  const [editScheduledDate, setEditScheduledDate] = useState('')
  const [editScheduledTime, setEditScheduledTime] = useState('')
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

  // טעינת נתונים
  useEffect(() => {
    if (companyId && towId) {
      loadData()
    }
  }, [companyId, towId])

  const loadData = async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [towData, driversData, trucksData, customersData] = await Promise.all([
        getTow(towId),
        getDrivers(companyId),
        getTrucks(companyId),
        getCustomers(companyId)
      ])
      setTow(towData)
      setDrivers(driversData)
      setTrucks(trucksData)
      setCustomers(customersData)
      
      // בדיקה אם יש חשבונית לגרירה
      if (towData) {
        const invoiceExists = await towHasInvoice(towId)
        setHasInvoice(invoiceExists)
      }
    } catch (err) {
      console.error('Error loading tow:', err)
      setError('שגיאה בטעינת הגרירה')
    } finally {
      setLoading(false)
    }
  }

  const canEdit = tow ? tow.status !== 'completed' && tow.status !== 'cancelled' : false

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = driver.user.full_name.toLowerCase().includes(driverSearch.toLowerCase()) || 
                          (driver.user.phone && driver.user.phone.includes(driverSearch))
    return matchesSearch
  })

  const filteredCustomers = customers.filter(c => {
    if (!editCustomerSearch) return false
    const query = editCustomerSearch.toLowerCase()
    return c.name.toLowerCase().includes(query) || 
           (c.phone && c.phone.includes(query))
  })

  const getDriverTrucks = (driverId: string) => {
    return trucks.filter(t => t.assigned_driver?.id === driverId)
  }

  const getFromAddress = () => {
    if (!tow?.legs || tow.legs.length === 0) return 'לא צוין'
    return tow.legs[0].from_address || 'לא צוין'
  }

  const getToAddress = () => {
    if (!tow?.legs || tow.legs.length === 0) return 'לא צוין'
    return tow.legs[tow.legs.length - 1].to_address || 'לא צוין'
  }

  const handleEditClick = () => {
    if (!canEdit) {
      setShowCantEditModal(true)
    } else if (tow) {
      // Initialize edit form with current values
      setEditCustomerId(tow.customer_id)
      setEditCustomerSearch(tow.customer?.name || '')
      setEditNotes(tow.notes || '')
      setEditFinalPrice(tow.final_price || 0)
      setEditFromAddress(getFromAddress())
      setEditToAddress(getToAddress())
      const scheduledDate = new Date(tow.scheduled_at || tow.created_at)
      setEditScheduledDate(scheduledDate.toISOString().split('T')[0])
      setEditScheduledTime(scheduledDate.toTimeString().slice(0, 5))
      setEditVehicles(tow.vehicles?.map((v: any) => ({
        id: v.id,
        plateNumber: v.plate_number,
        manufacturer: v.manufacturer || '',
        model: v.model || '',
        year: v.year || new Date().getFullYear(),
        vehicleType: v.vehicle_type || '',
        color: v.color || '',
        towReason: v.tow_reason || ''
      })) || [])
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const handleSaveChanges = async () => {
    if (!tow) return
    
    if (editVehicles.length === 0) {
      alert('חייב להיות לפחות רכב אחד בגרירה')
      return
    }

    // יצירת תאריך חדש
    const newScheduledAt = new Date(`${editScheduledDate}T${editScheduledTime}:00`)

    setSaving(true)
    try {
      await updateTow({
        towId: tow.id,
        customerId: editCustomerId,
        notes: editNotes || null,
        finalPrice: editFinalPrice || null,
        scheduledAt: newScheduledAt.toISOString(),
        vehicles: editVehicles.map(v => ({
          plateNumber: v.plateNumber,
          manufacturer: v.manufacturer || undefined,
          model: v.model || undefined,
          year: v.year || undefined,
          vehicleType: v.vehicleType as any || undefined,
          color: v.color || undefined,
          towReason: v.towReason || undefined
        })),
        legs: [{
          legType: 'pickup',
          fromAddress: editFromAddress,
          toAddress: editToAddress
        }]
      })
      await loadData()
      setIsEditing(false)
    } catch (err) {
      console.error('Error saving changes:', err)
      alert('שגיאה בשמירת השינויים')
    } finally {
      setSaving(false)
    }
  }

  const addVehicle = () => {
    setEditVehicles([...editVehicles, {
      id: crypto.randomUUID(),
      plateNumber: '',
      manufacturer: '',
      model: '',
      year: new Date().getFullYear(),
      vehicleType: '',
      color: '',
      towReason: ''
    }])
  }

  const removeVehicle = (id: string) => {
    if (editVehicles.length <= 1) {
      alert('חייב להיות לפחות רכב אחד')
      return
    }
    setEditVehicles(editVehicles.filter(v => v.id !== id))
  }

  const updateVehicle = (id: string, field: keyof EditVehicle, value: any) => {
    setEditVehicles(editVehicles.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  const handleAssignDriver = async () => {
    if (!selectedDriverId || !selectedTruckId || !tow) return
    
    setAssigning(true)
    try {
      await assignDriver(tow.id, selectedDriverId, selectedTruckId)
      await loadData()
      closeDriverModal()
    } catch (err) {
      console.error('Error assigning driver:', err)
      alert('שגיאה בשיבוץ הנהג')
    } finally {
      setAssigning(false)
    }
  }

  const handleRemoveDriver = async () => {
    if (!tow) return
    try {
      await assignDriver(tow.id, null as any, null as any)
      await updateTowStatus(tow.id, 'pending')
      await loadData()
      setShowRemoveDriverConfirm(false)
    } catch (err) {
      console.error('Error removing driver:', err)
    }
  }

  const handleCancelClick = () => {
    if (!tow) return
    if (tow.status === 'completed') {
      setShowCantCancelModal(true)
      return
    }
    
    if (['in_progress', 'driver_on_way', 'arrived_pickup', 'loading'].includes(tow.status)) {
      setCancelStep('warning')
    } else {
      setCancelStep('reason')
    }
    setShowCancelModal(true)
  }

  const handleConfirmCancel = async () => {
    if (!tow) return
    try {
      await updateTowStatus(tow.id, 'cancelled')
      await loadData()
      setShowCancelModal(false)
      setCancelReason('')
      setCancelStep('reason')
    } catch (err) {
      console.error('Error cancelling tow:', err)
    }
  }

  const closeCancelModal = () => {
    setShowCancelModal(false)
    setCancelReason('')
    setCancelStep('reason')
  }

  const closeDriverModal = () => {
    setShowAssignModal(false)
    setShowChangeDriverModal(false)
    setSelectedDriverId(null)
    setSelectedTruckId(null)
  }

  // ==================== Invoice Functions ====================
  
  const openInvoiceModal = () => {
    if (!tow) return
    setInvoiceData({
      description: `גרירה - ${getFromAddress()} → ${getToAddress()}`,
      amount: tow.final_price?.toString() || ''
    })
    setShowInvoiceModal(true)
  }

  const handleCreateInvoice = async () => {
    if (!tow || !companyId || !invoiceData.amount) return
    setCreatingInvoice(true)
    try {
      await createInvoiceFromTow(
        companyId,
        tow.id,
        tow.customer_id,
        parseFloat(invoiceData.amount),
        invoiceData.description || `גרירה - ${getFromAddress()} → ${getToAddress()}`
      )
      setHasInvoice(true)
      setShowInvoiceModal(false)
      alert('החשבונית נוצרה בהצלחה!')
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert('שגיאה ביצירת חשבונית')
    } finally {
      setCreatingInvoice(false)
    }
  }

  const renderDriverModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
      <div className="bg-white w-full lg:max-w-lg lg:rounded-2xl lg:mx-4 overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
          <h2 className="font-bold text-lg">{tow?.driver ? 'שינוי נהג' : 'שיבוץ נהג'}</h2>
          <button onClick={closeDriverModal} className="p-2 hover:bg-white/20 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש נהג..."
              value={driverSearch}
              onChange={(e) => setDriverSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selectedDriverId ? (
            <div className="space-y-2">
              {filteredDrivers.map((driver) => {
                const driverTrucks = getDriverTrucks(driver.id)
                return (
                  <button
                    key={driver.id}
                    onClick={() => driverTrucks.length > 0 && setSelectedDriverId(driver.id)}
                    disabled={driverTrucks.length === 0}
                    className={`w-full p-4 rounded-xl border text-right transition-colors ${
                      driverTrucks.length === 0 
                        ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                        : 'bg-white border-gray-200 hover:border-[#33d4ff] hover:bg-[#33d4ff]/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <User size={24} className="text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{driver.user.full_name}</p>
                        <p className="text-sm text-gray-500">{driver.user.phone}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {driverTrucks.length > 0 ? `${driverTrucks.length} גררים` : 'אין גרר משויך'}
                        </p>
                      </div>
                      <ChevronLeft size={20} className="text-gray-400" />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => {
                  setSelectedDriverId(null)
                  setSelectedTruckId(null)
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
                    <p className="font-bold text-gray-800">
                      {drivers.find(d => d.id === selectedDriverId)?.user.full_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {drivers.find(d => d.id === selectedDriverId)?.user.phone}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 mb-3">בחר גרר:</h3>
                <div className="space-y-2">
                  {getDriverTrucks(selectedDriverId).map((truck) => (
                    <button
                      key={truck.id}
                      onClick={() => setSelectedTruckId(truck.id)}
                      className={`w-full p-4 rounded-xl border text-right transition-colors ${
                        selectedTruckId === truck.id
                          ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          selectedTruckId === truck.id ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-400'
                        }`}>
                          <Truck size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{truck.truck_type}</p>
                          <p className="text-sm text-gray-500 font-mono">{truck.plate_number}</p>
                        </div>
                        {selectedTruckId === truck.id && (
                          <CheckCircle size={20} className="text-[#33d4ff]" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
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
            onClick={handleAssignDriver}
            disabled={!selectedDriverId || !selectedTruckId || assigning}
            className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {assigning ? 'משבץ...' : tow?.driver ? 'שנה נהג' : 'שבץ נהג'}
          </button>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">טוען גרירה...</p>
        </div>
      </div>
    )
  }

  if (error || !tow) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'הגרירה לא נמצאה'}</p>
          <Link href="/dashboard/tows" className="text-[#33d4ff]">חזרה לרשימת גרירות</Link>
        </div>
      </div>
    )
  }

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
                  <h1 className="font-bold text-gray-800 text-base sm:text-lg font-mono">{tow.id.slice(0, 8)}</h1>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusConfig[tow.status]?.color}`}>
                    {statusConfig[tow.status]?.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 hidden sm:block">נוצר ב-{new Date(tow.created_at).toLocaleString('he-IL')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button 
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="p-2 sm:px-3 sm:py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm flex items-center gap-2"
                  >
                    <X size={18} />
                    <span className="hidden sm:inline">ביטול</span>
                  </button>
                  <button 
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="p-2 sm:px-3 sm:py-2 bg-[#33d4ff] text-white hover:bg-[#21b8e6] rounded-lg text-sm flex items-center gap-2 disabled:bg-gray-300"
                  >
                    <Save size={18} />
                    <span className="hidden sm:inline">{saving ? 'שומר...' : 'שמור'}</span>
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
              {/* פרטי לקוח */}
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
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">חיפוש לקוח</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="שם או טלפון..."
                            value={editCustomerSearch}
                            onChange={(e) => {
                              setEditCustomerSearch(e.target.value)
                              setShowCustomerResults(e.target.value.length > 0)
                            }}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                          {showCustomerResults && filteredCustomers.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-48 overflow-y-auto">
                              {filteredCustomers.map((customer) => (
                                <div
                                  key={customer.id}
                                  onClick={() => {
                                    setEditCustomerId(customer.id)
                                    setEditCustomerSearch(customer.name)
                                    setShowCustomerResults(false)
                                  }}
                                  className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <p className="font-medium text-gray-800">{customer.name}</p>
                                  <p className="text-sm text-gray-500">{customer.phone}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{tow.customer?.name || 'לא צוין'}</p>
                        {tow.customer?.phone && (
                          <a href={`tel:${tow.customer.phone}`} className="text-[#33d4ff] text-sm flex items-center gap-1 mt-1">
                            <Phone size={14} />
                            {tow.customer.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* תאריך ושעה */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <Clock size={18} />
                    תאריך ושעה
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">תאריך</label>
                        <input
                          type="date"
                          value={editScheduledDate}
                          onChange={(e) => setEditScheduledDate(e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">שעה</label>
                        <input
                          type="time"
                          value={editScheduledTime}
                          onChange={(e) => setEditScheduledTime(e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#33d4ff]/10 rounded-lg flex items-center justify-center">
                        <Clock size={20} className="text-[#33d4ff]" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {new Date(tow.scheduled_at || tow.created_at).toLocaleDateString('he-IL', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(tow.scheduled_at || tow.created_at).toLocaleTimeString('he-IL', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* רכבים */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <Truck size={18} />
                    רכבים ({isEditing ? editVehicles.length : tow.vehicles?.length || 0})
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
                      {editVehicles.map((vehicle, idx) => (
                        <div key={vehicle.id} className="p-4 border border-gray-200 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-gray-800">רכב {idx + 1}</span>
                            {editVehicles.length > 1 && (
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
                                value={vehicle.plateNumber}
                                onChange={(e) => updateVehicle(vehicle.id, 'plateNumber', e.target.value)}
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
                            <label className="block text-xs text-gray-500 mb-1">תקלה</label>
                            <input
                              type="text"
                              value={vehicle.towReason}
                              onChange={(e) => updateVehicle(vehicle.id, 'towReason', e.target.value)}
                              placeholder="למשל: מנוע, תקר, סוללה..."
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tow.vehicles && tow.vehicles.length > 0 ? tow.vehicles.map((vehicle: any, idx: number) => (
                        <div key={vehicle.id} className={idx > 0 ? 'pt-4 border-t border-gray-100' : ''}>
                          <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                              <Truck size={24} className="text-gray-400" />
                            </div>
                            <div>
                              <p className="font-mono text-lg font-bold text-gray-800">{vehicle.plate_number}</p>
                              <p className="text-sm text-gray-500">
                                {vehicle.manufacturer} {vehicle.model}{vehicle.year ? `, ${vehicle.year}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {vehicle.vehicle_type && (
                              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">{vehicle.vehicle_type}</span>
                            )}
                            {vehicle.color && (
                              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">{vehicle.color}</span>
                            )}
                            {vehicle.tow_reason && (
                              <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-sm">{vehicle.tow_reason}</span>
                            )}
                          </div>
                        </div>
                      )) : (
                        <p className="text-gray-500">אין רכבים</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* מסלול */}
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
                          value={editFromAddress}
                          onChange={(e) => setEditFromAddress(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">כתובת יעד</label>
                        <input
                          type="text"
                          value={editToAddress}
                          onChange={(e) => setEditToAddress(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3 sm:gap-4">
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                        <div className="w-0.5 flex-1 bg-gray-200 my-1"></div>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div>
                          <p className="text-sm text-gray-500">מוצא</p>
                          <p className="font-medium text-gray-800">{getFromAddress()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">יעד</p>
                          <p className="font-medium text-gray-800">{getToAddress()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* הערות */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800">הערות</h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      placeholder="הערות לגרירה..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  ) : (
                    <p className="text-gray-600">{tow.notes || 'אין הערות'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* סיידבר */}
            <div className="lg:w-80 space-y-4 sm:space-y-6">
              {/* נהג */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-[#33d4ff] text-white">
                  <h2 className="font-bold">נהג</h2>
                </div>
                <div className="p-4 sm:p-5">
                  {tow.driver ? (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <User size={24} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{tow.driver.user?.full_name}</p>
                          {tow.driver.user?.phone && (
                            <a href={`tel:${tow.driver.user.phone}`} className="text-[#33d4ff] text-sm">{tow.driver.user.phone}</a>
                          )}
                          {tow.truck && (
                            <p className="text-xs text-gray-500 mt-1">{tow.truck.plate_number}</p>
                          )}
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
              {/* מחיר */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-800 text-white">
                  <h2 className="font-bold">סיכום מחיר</h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">מחיר סופי</label>
                      <input
                        type="number"
                        value={editFinalPrice}
                        onChange={(e) => setEditFinalPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  ) : tow.price_breakdown ? (
                    <div className="space-y-2 text-sm">
                      {/* מחיר בסיס */}
                      <div className="flex justify-between">
                        <span className="text-gray-600">מחיר בסיס ({tow.price_breakdown.vehicle_type === 'private' ? 'פרטי' : tow.price_breakdown.vehicle_type})</span>
                        <span className="font-medium text-gray-800">₪{tow.price_breakdown.base_price}</span>
                      </div>
                      
                      {/* מרחק */}
                      {tow.price_breakdown.distance_km > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">מרחק ({tow.price_breakdown.distance_km} ק״מ)</span>
                          <span className="font-medium text-gray-800">₪{tow.price_breakdown.distance_price}</span>
                        </div>
                      )}
                      
                      {/* תוספות זמן */}
                      {tow.price_breakdown.time_surcharges?.filter((s: any) => s.amount > 0).map((surcharge: any, idx: number) => (
                        <div key={surcharge.id || idx} className="flex justify-between text-amber-600">
                          <span>{surcharge.label} (+{surcharge.percent}%)</span>
                          <span className="font-medium">₪{surcharge.amount}</span>
                        </div>
                      ))}
                      
                      {/* תוספות מיקום */}
                      {tow.price_breakdown.location_surcharges?.map((surcharge: any, idx: number) => (
                        <div key={surcharge.id || idx} className="flex justify-between text-blue-600">
                          <span>{surcharge.label} (+{surcharge.percent}%)</span>
                          <span className="font-medium">₪{surcharge.amount}</span>
                        </div>
                      ))}
                      
                      {/* תוספות שירותים */}
                      {tow.price_breakdown.service_surcharges?.map((surcharge: any, idx: number) => (
                        <div key={surcharge.id || idx} className="flex justify-between text-purple-600">
                          <span>{surcharge.label}{surcharge.units ? ` (×${surcharge.units})` : ''}</span>
                          <span className="font-medium">₪{surcharge.amount}</span>
                        </div>
                      ))}
                      
                      {/* הנחה */}
                      {tow.price_breakdown.discount_amount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>הנחה ({tow.price_breakdown.discount_percent}%)</span>
                          <span className="font-medium">-₪{tow.price_breakdown.discount_amount}</span>
                        </div>
                      )}
                      
                      {/* מע"מ */}
                      <div className="flex justify-between text-gray-500">
                        <span>מע״מ (18%)</span>
                        <span className="font-medium">₪{tow.price_breakdown.vat_amount}</span>
                      </div>
                      
                      {/* סה"כ */}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 mt-2">
                        <span>סה״כ כולל מע״מ</span>
                        <span className="text-gray-800">₪{tow.price_breakdown.total}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">סה״כ</span>
                      <span className="text-2xl font-bold text-gray-800">{tow.final_price || 0} ש״ח</span>
                    </div>
                  )}
                </div>
              </div>

              {/* חשבונית */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-emerald-500 text-white">
                  <h2 className="font-bold flex items-center gap-2">
                    <Receipt size={18} />
                    חשבונית
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  {hasInvoice ? (
                    <div className="text-center">
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle size={24} className="text-emerald-600" />
                      </div>
                      <p className="text-gray-700 mb-3">חשבונית הופקה</p>
                      <Link
                        href={`/dashboard/invoices?tow=${tow.id}`}
                        className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <FileText size={18} />
                        צפה בחשבונית
                      </Link>
                    </div>
                  ) : tow.status === 'completed' ? (
                    <div className="text-center">
                      <p className="text-gray-500 mb-4">לא הופקה חשבונית</p>
                      <button
                        onClick={openInvoiceModal}
                        className="w-full py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Receipt size={18} />
                        הפק חשבונית
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-gray-400 text-sm">
                        ניתן להפיק חשבונית לאחר השלמת הגרירה
                      </p>
                    </div>
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
              <div className="flex gap-4 pb-6">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-[#33d4ff]"></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusConfig[tow.status]?.color}`}>
                      {statusConfig[tow.status]?.label}
                    </span>
                    <span className="text-sm text-gray-500">{new Date(tow.created_at).toLocaleString('he-IL')}</span>
                  </div>
                </div>
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

      {/* מודלים */}
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
                  <p className="text-gray-600">הגרירה כבר בביצוע. האם לבטל בכל זאת?</p>
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
                      <span className="font-mono font-bold text-gray-800">{tow.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">לקוח</span>
                      <span className="text-gray-800">{tow.customer?.name || 'לא צוין'}</span>
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

      {/* מודל הפקת חשבונית */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md sm:mx-4 overflow-hidden rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-emerald-500 text-white">
              <h2 className="font-bold text-lg">הפקת חשבונית</h2>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* פרטי לקוח */}
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">לקוח</p>
                <p className="font-medium text-gray-800">
                  {tow.customer?.name || 'לקוח מזדמן'}
                </p>
              </div>

              {/* תיאור */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                <input
                  type="text"
                  value={invoiceData.description}
                  onChange={(e) => setInvoiceData({ ...invoiceData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* סכום */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  סכום (לפני מע״מ) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                  <input
                    type="number"
                    value={invoiceData.amount}
                    onChange={(e) => setInvoiceData({ ...invoiceData, amount: e.target.value })}
                    className="w-full pr-8 pl-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* סיכום */}
              {invoiceData.amount && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">סכום לפני מע״מ</span>
                    <span>₪{parseFloat(invoiceData.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">מע״מ (18%)</span>
                    <span>₪{(parseFloat(invoiceData.amount) * 0.18).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-emerald-200 pt-2">
                    <span>סה״כ</span>
                    <span className="text-emerald-700">₪{(parseFloat(invoiceData.amount) * 1.18).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
              >
                ביטול
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={!invoiceData.amount || creatingInvoice}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:bg-gray-300 transition-colors font-medium flex items-center justify-center gap-2"
              >
                {creatingInvoice ? (
                  'יוצר...'
                ) : (
                  <>
                    <Receipt size={18} />
                    צור חשבונית
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}