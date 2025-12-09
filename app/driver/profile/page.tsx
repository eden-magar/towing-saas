'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { getDriverByUserId, updateDriverStatus, DriverInfo } from '../../lib/queries/driver-tasks'
import { supabase } from '../../lib/supabase'
import { 
  User,
  Truck,
  Star,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  FileText,
  Wrench,
  AlertTriangle,
  Coffee,
  UserX,
  MessageSquare,
  Timer,
  Loader2
} from 'lucide-react'

type DriverStatus = 'available' | 'busy' | 'unavailable'
type UnavailabilityReason = 'break' | 'end_of_day' | 'vehicle_issue' | 'personal' | 'other'

interface TruckDetails {
  id: string
  plate_number: string
  truck_type: string | null
  manufacturer: string | null
  model: string | null
  year: number | null
  color: string | null
  vehicle_capacity: number | null
  max_weight_kg: number | null
  license_expiry: string | null
  insurance_expiry: string | null
  test_expiry: string | null
}

interface HistoryItem {
  id: string
  created_at: string
  status: string
  final_price: number | null
  customer: { name: string } | null
  vehicles: { plate_number: string }[]
  legs: { from_address: string | null; to_address: string | null }[]
}

interface DriverStats {
  weekTows: number
  monthTows: number
  completedPercent: number
  totalKm: number
}

const unavailabilityReasons: { key: UnavailabilityReason; label: string; icon: React.ReactNode }[] = [
  { key: 'break', label: 'הפסקה', icon: <Coffee size={20} /> },
  { key: 'end_of_day', label: 'סוף יום עבודה', icon: <Clock size={20} /> },
  { key: 'vehicle_issue', label: 'תקלה ברכב', icon: <Wrench size={20} /> },
  { key: 'personal', label: 'סיבה אישית', icon: <UserX size={20} /> },
  { key: 'other', label: 'אחר', icon: <MessageSquare size={20} /> },
]

const returnTimeOptions = [
  { value: 15, label: '15 דקות' },
  { value: 30, label: '30 דקות' },
  { value: 60, label: 'שעה' },
  { value: 120, label: 'שעתיים' },
  { value: 0, label: 'לא ידוע' },
]

export default function DriverProfilePage() {
  const { user, loading: authLoading } = useAuth()
  
  // Data state
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null)
  const [truck, setTruck] = useState<TruckDetails | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [stats, setStats] = useState<DriverStats>({ weekTows: 0, monthTows: 0, completedPercent: 0, totalKm: 0 })
  const [loading, setLoading] = useState(true)
  
  // UI state
  const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'truck'>('stats')
  const [status, setStatus] = useState<DriverStatus>('available')
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showUnavailableModal, setShowUnavailableModal] = useState(false)
  const [selectedReason, setSelectedReason] = useState<UnavailabilityReason | null>(null)
  const [selectedReturnTime, setSelectedReturnTime] = useState<number | null>(null)
  const [customNote, setCustomNote] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  // טעינת נתונים
  useEffect(() => {
    if (!authLoading && user) {
      loadData()
    }
  }, [authLoading, user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)

    try {
      // שליפת פרטי נהג
      const driver = await getDriverByUserId(user.id)
      if (driver) {
        setDriverInfo(driver)
        setStatus(driver.status || 'unavailable')

        // שליפת פרטי גרר מלאים
        if (driver.truck?.id) {
          const { data: truckData } = await supabase
            .from('tow_trucks')
            .select('*')
            .eq('id', driver.truck.id)
            .single()
          
          if (truckData) setTruck(truckData)
        }

        // שליפת היסטוריה
        const { data: historyData } = await supabase
          .from('tows')
          .select(`
            id,
            created_at,
            status,
            final_price,
            customer:customers(name),
            vehicles:tow_vehicles(plate_number),
            legs:tow_legs(from_address, to_address)
          `)
          .eq('driver_id', driver.id)
          .in('status', ['completed', 'cancelled'])
          .order('created_at', { ascending: false })
          .limit(20)

        if (historyData) {
          setHistory(historyData as any)
        }

        // שליפת סטטיסטיקות
        await loadStats(driver.id)
      }
    } catch (err) {
      console.error('Error loading profile data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async (driverId: string) => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // גרירות השבוע
    const { count: weekCount } = await supabase
      .from('tows')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .gte('created_at', weekAgo)

    // גרירות החודש
    const { count: monthCount } = await supabase
      .from('tows')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .gte('created_at', monthAgo)

    // אחוז השלמה (מתוך החודש)
    const { count: completedCount } = await supabase
      .from('tows')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .gte('created_at', monthAgo)

    const completedPercent = monthCount ? Math.round((completedCount || 0) / monthCount * 100) : 0

    // סה"כ ק"מ החודש
    const { data: legsData } = await supabase
      .from('tow_legs')
      .select('distance_km, tow_id')
      .gte('created_at', monthAgo)

    // סינון רק רגליים של הנהג הזה (דרך tows)
    const { data: driverTows } = await supabase
      .from('tows')
      .select('id')
      .eq('driver_id', driverId)
      .gte('created_at', monthAgo)

    const driverTowIds = driverTows?.map(t => t.id) || []
    const totalKm = legsData
      ?.filter(l => driverTowIds.includes(l.tow_id))
      ?.reduce((sum, l) => sum + (l.distance_km || 0), 0) || 0

    setStats({
      weekTows: weekCount || 0,
      monthTows: monthCount || 0,
      completedPercent,
      totalKm: Math.round(totalKm)
    })
  }

  const getStatusInfo = (s: DriverStatus) => {
    switch (s) {
      case 'available': return { label: 'זמין', color: 'bg-emerald-500', textColor: 'text-emerald-600', bgLight: 'bg-emerald-100' }
      case 'busy': return { label: 'בגרירה', color: 'bg-amber-500', textColor: 'text-amber-600', bgLight: 'bg-amber-100' }
      case 'unavailable': return { label: 'לא זמין', color: 'bg-red-500', textColor: 'text-red-600', bgLight: 'bg-red-100' }
    }
  }

  const statusInfo = getStatusInfo(status)

  const handleStatusChange = async (newStatus: DriverStatus) => {
    if (newStatus === 'unavailable') {
      setShowStatusModal(false)
      setShowUnavailableModal(true)
    } else {
      setIsUpdating(true)
      try {
        if (driverInfo) {
          await updateDriverStatus(driverInfo.id, newStatus)
          setStatus(newStatus)
        }
      } catch (err) {
        console.error('Error updating status:', err)
        alert('שגיאה בעדכון הסטטוס')
      } finally {
        setIsUpdating(false)
        setShowStatusModal(false)
      }
    }
  }

  const handleConfirmUnavailable = async () => {
    if (!selectedReason || !driverInfo) return
    
    setIsUpdating(true)
    try {
      await updateDriverStatus(driverInfo.id, 'unavailable')
      setStatus('unavailable')
      setShowUnavailableModal(false)
      setSelectedReason(null)
      setSelectedReturnTime(null)
      setCustomNote('')
    } catch (err) {
      console.error('Error updating status:', err)
      alert('שגיאה בעדכון הסטטוס')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelUnavailable = () => {
    setShowUnavailableModal(false)
    setShowStatusModal(true)
    setSelectedReason(null)
    setSelectedReturnTime(null)
    setCustomNote('')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('he-IL')
  }

  const getTruckTypeName = (type: string | null) => {
  const types: Record<string, string> = {
    carrier: 'מובילית',
    carrier_large: 'מובילית 10+ רכבים',
    crane_tow: 'גרר מנוף',
    dolly: 'דולי (מערסל ידני)',
    flatbed_ramsa: 'רמסע',
    heavy_equipment: 'ציוד כבד/לובי',
    heavy_rescue: 'חילוץ כבד',
    wheel_lift_cradle: 'משקפיים (מערסל)',
  }
  return type ? types[type] || type : 'לא צוין'
}

  // מצב טעינה
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  // פרטי נהג
  const driverName = driverInfo?.user?.full_name || user?.full_name || 'נהג'
  const driverPhone = user?.phone || ''
  const driverEmail = user?.email || ''

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#33d4ff] to-[#21b8e6] text-white p-6 pb-20">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <User size={40} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{driverName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/70">{stats.monthTows} גרירות החודש</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className="px-4 -mt-14">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${statusInfo.color}`}></div>
              <div>
                <p className="text-sm text-gray-500">סטטוס נוכחי</p>
                <p className={`font-bold text-lg ${statusInfo.textColor}`}>{statusInfo.label}</p>
              </div>
            </div>
            <button
              onClick={() => setShowStatusModal(true)}
              className={`px-5 py-2.5 rounded-xl font-medium ${statusInfo.bgLight} ${statusInfo.textColor}`}
            >
              שנה סטטוס
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-4">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'stats' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            סטטיסטיקות
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'history' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            היסטוריה
          </button>
          <button
            onClick={() => setActiveTab('truck')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'truck' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            משאית
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Truck size={18} className="text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-500">השבוע</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{stats.weekTows}</p>
                <p className="text-xs text-gray-500">גרירות</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  </div>
                  <span className="text-sm text-gray-500">החודש</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{stats.monthTows}</p>
                <p className="text-xs text-gray-500">גרירות</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Star size={18} className="text-purple-600" />
                  </div>
                  <span className="text-sm text-gray-500">אחוז השלמה</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{stats.completedPercent}%</p>
                <p className="text-xs text-gray-500">מוצלח</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <MapPin size={18} className="text-amber-600" />
                  </div>
                  <span className="text-sm text-gray-500">סה"כ</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{stats.totalKm.toLocaleString()}</p>
                <p className="text-xs text-gray-500">ק"מ החודש</p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-bold text-gray-800 mb-3">פרטי קשר</h3>
              <div className="space-y-3">
                {driverPhone && (
                  <div className="flex items-center gap-3">
                    <Phone size={18} className="text-gray-400" />
                    <span className="text-gray-700 font-mono">{driverPhone}</span>
                  </div>
                )}
                {driverEmail && (
                  <div className="flex items-center gap-3">
                    <Mail size={18} className="text-gray-400" />
                    <span className="text-gray-700">{driverEmail}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-8 text-center">
                <p className="text-gray-500">אין היסטוריית גרירות</p>
              </div>
            ) : (
              history.map((item) => {
                const fromAddress = item.legs?.[0]?.from_address || 'לא צוין'
                const toAddress = item.legs?.[item.legs.length - 1]?.to_address || 'לא צוין'
                const vehiclePlate = item.vehicles?.[0]?.plate_number || ''
                
                return (
                  <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-800">{item.customer?.name || 'לקוח לא ידוע'}</p>
                        {vehiclePlate && (
                          <p className="text-sm text-gray-500 font-mono">{vehiclePlate}</p>
                        )}
                      </div>
                      <div className="text-left">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.status === 'completed' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {item.status === 'completed' ? 'הושלם' : 'בוטל'}
                        </span>
                        <p className="text-sm text-gray-500 mt-1">{formatDate(item.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin size={14} className="text-gray-400" />
                      <span className="truncate">{fromAddress}</span>
                      <ChevronLeft size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate">{toAddress}</span>
                    </div>
                    {item.final_price && item.final_price > 0 && (
                      <p className="text-left font-bold text-emerald-600 mt-2">₪{item.final_price}</p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Truck Tab */}
        {activeTab === 'truck' && (
          <div className="space-y-4">
            {!truck ? (
              <div className="bg-gray-50 rounded-xl p-8 text-center">
                <Truck size={48} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">אין גרר משויך</p>
                <p className="text-gray-400 text-sm mt-1">פנה למנהל לשיוך גרר</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Truck size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-lg text-gray-800">
                        {truck.manufacturer} {truck.model}
                      </p>
                      <p className="text-[#33d4ff] font-mono font-bold">{truck.plate_number}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">סוג</p>
                      <p className="font-medium text-gray-800">{getTruckTypeName(truck.truck_type)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">שנה</p>
                      <p className="font-medium text-gray-800">{truck.year || 'לא צוין'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">קיבולת רכבים</p>
                      <p className="font-medium text-gray-800">{truck.vehicle_capacity || 1}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">משקל מקסימלי</p>
                      <p className="font-medium text-gray-800">
                        {truck.max_weight_kg ? `${truck.max_weight_kg.toLocaleString()} ק"ג` : 'לא צוין'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Maintenance */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-bold text-gray-800 mb-3">תחזוקה ותוקף</h3>
                  <div className="space-y-3">
                    {truck.test_expiry && (
                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wrench size={18} className="text-amber-600" />
                          <span className="text-amber-800">טסט עד</span>
                        </div>
                        <span className="font-bold text-amber-800">{formatDate(truck.test_expiry)}</span>
                      </div>
                    )}
                    {truck.insurance_expiry && (
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText size={18} className="text-blue-600" />
                          <span className="text-blue-800">ביטוח עד</span>
                        </div>
                        <span className="font-bold text-blue-800">{formatDate(truck.insurance_expiry)}</span>
                      </div>
                    )}
                    {truck.license_expiry && (
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText size={18} className="text-green-600" />
                          <span className="text-green-800">רישיון עד</span>
                        </div>
                        <span className="font-bold text-green-800">{formatDate(truck.license_expiry)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Report Issue */}
                <button className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl font-medium border border-red-200">
                  <AlertTriangle size={20} />
                  דווח על תקלה
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold text-lg text-gray-800 text-center">שנה סטטוס</h3>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={() => handleStatusChange('available')}
                disabled={isUpdating}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                  status === 'available' ? 'bg-emerald-100 border-2 border-emerald-500' : 'bg-gray-50'
                }`}
              >
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={24} className="text-white" />
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">זמין</p>
                  <p className="text-sm text-gray-500">מוכן לקבל משימות</p>
                </div>
                {status === 'available' && (
                  <CheckCircle2 size={24} className="mr-auto text-emerald-500" />
                )}
              </button>

              <button
                onClick={() => handleStatusChange('busy')}
                disabled={isUpdating}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                  status === 'busy' ? 'bg-amber-100 border-2 border-amber-500' : 'bg-gray-50'
                }`}
              >
                <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
                  <Truck size={24} className="text-white" />
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">בגרירה</p>
                  <p className="text-sm text-gray-500">כרגע באמצע משימה</p>
                </div>
                {status === 'busy' && (
                  <CheckCircle2 size={24} className="mr-auto text-amber-500" />
                )}
              </button>

              <button
                onClick={() => handleStatusChange('unavailable')}
                disabled={isUpdating}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                  status === 'unavailable' ? 'bg-red-100 border-2 border-red-500' : 'bg-gray-50'
                }`}
              >
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                  <XCircle size={24} className="text-white" />
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">לא זמין</p>
                  <p className="text-sm text-gray-500">לא יכול לקבל משימות כרגע</p>
                </div>
                {status === 'unavailable' && (
                  <CheckCircle2 size={24} className="mr-auto text-red-500" />
                )}
              </button>
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowStatusModal(false)}
                className="w-full py-3 text-gray-600 font-medium"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unavailable Reason Modal */}
      {showUnavailableModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-md sm:mx-4 rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-red-500 text-white p-5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <XCircle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">מעבר ללא זמין</h3>
                  <p className="text-white/80 text-sm">בחר סיבה לאי-זמינות</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1">
              {/* Reasons */}
              <div className="space-y-2 mb-5">
                {unavailabilityReasons.map((reason) => (
                  <button
                    key={reason.key}
                    onClick={() => setSelectedReason(reason.key)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                      selectedReason === reason.key
                        ? 'bg-red-50 border-2 border-red-500'
                        : 'bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedReason === reason.key ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {reason.icon}
                    </div>
                    <span className={`font-medium ${
                      selectedReason === reason.key ? 'text-red-700' : 'text-gray-700'
                    }`}>
                      {reason.label}
                    </span>
                    {selectedReason === reason.key && (
                      <CheckCircle2 size={20} className="mr-auto text-red-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* Return Time */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Timer size={16} />
                    זמן חזרה משוער (אופציונלי)
                  </div>
                </label>
                <div className="flex flex-wrap gap-2">
                  {returnTimeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedReturnTime(option.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedReturnTime === option.value
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Note */}
              {selectedReason === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    פרט את הסיבה
                  </label>
                  <textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="הזן סיבה..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={handleCancelUnavailable}
                  disabled={isUpdating}
                  className="flex-1 py-4 border-2 border-gray-200 bg-white text-gray-600 rounded-xl font-bold text-lg"
                >
                  חזור
                </button>
                <button
                  onClick={handleConfirmUnavailable}
                  disabled={isUpdating || !selectedReason}
                  className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUpdating ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    'אישור'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}