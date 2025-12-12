'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../lib/AuthContext'
import { 
  getDriverByUserId, 
  getDriverTasks, 
  getDriverStats,
  acceptTask,
  rejectTask,
  DriverTask,
  DriverInfo
} from '../lib/queries/driver-tasks'
import { 
  MapPin, 
  Clock, 
  Phone,
  Navigation,
  ChevronLeft,
  Truck,
  AlertCircle,
  CheckCircle2,
  Circle,
  Timer,
  X,
  XCircle,
  MessageSquare,
  Bell,
  Loader2,
  RefreshCw
} from 'lucide-react'

type RejectReason = 'break' | 'vehicle_issue' | 'too_far' | 'personal' | 'other'

const rejectReasons: { key: RejectReason; label: string; icon: string }[] = [
  { key: 'break', label: 'הפסקה', icon: '☕' },
  { key: 'vehicle_issue', label: 'תקלה ברכב', icon: '🔧' },
  { key: 'too_far', label: 'רחוק מדי', icon: '📍' },
  { key: 'personal', label: 'סיבה אישית', icon: '👤' },
  { key: 'other', label: 'אחר', icon: '💬' },
]

export default function DriverTasksPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  console.log('Component render - authLoading:', authLoading, 'user:', user?.id)  // הוסיפי כאן

  
  // State
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null)
  const [tasks, setTasks] = useState<DriverTask[]>([])
  const [stats, setStats] = useState({ todayTasks: 0, weekCompleted: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming'>('active')
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<DriverTask | null>(null)
  const [selectedRejectReason, setSelectedRejectReason] = useState<RejectReason | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // טעינת נתונים
  useEffect(() => {
    if (!authLoading && user) {
      loadData()
    }
  }, [authLoading, user])

  const loadData = async () => {
  if (!user) return
  
  setLoading(true)
  setError(null)

  console.log('1. Starting loadData, user:', user.id)

  try {
    // שליפת פרטי הנהג
    console.log('2. Calling getDriverByUserId')
    const driver = await getDriverByUserId(user.id)
    console.log('3. Got driver:', driver)
    
    if (!driver) {
      console.log('4. No driver found, setting error')
      setError('לא נמצא פרופיל נהג עבור המשתמש')
      setLoading(false)
      return
    }
    setDriverInfo(driver)

    // שליפת משימות
    console.log('5. Calling getDriverTasks')
    const driverTasks = await getDriverTasks(driver.id)
    console.log('6. Got tasks:', driverTasks)
    setTasks(driverTasks)

    // שליפת סטטיסטיקות
    console.log('7. Calling getDriverStats')
    const driverStats = await getDriverStats(driver.id)
    console.log('8. Got stats:', driverStats)
    setStats(driverStats)

    console.log('9. Done loading!')

  } catch (err) {
    console.error('Error loading data:', err)
    setError('שגיאה בטעינת הנתונים')
  } finally {
    setLoading(false)
  }
}


  // פילטור משימות
  const activeTasks = tasks.filter(t => ['assigned', 'in_progress'].includes(t.status))
  const upcomingTasks = tasks.filter(t => t.status === 'assigned' && t.scheduled_at)
  const currentTask = tasks.find(t => t.status === 'in_progress')
  const newTasks = tasks.filter(t => t.status === 'assigned')

  // פונקציות עזר
  const getStatusInfo = (status: DriverTask['status']) => {
    switch (status) {
      case 'assigned': return { text: 'ממתין', color: 'bg-amber-100 text-amber-700', icon: Clock }
      case 'in_progress': return { text: 'בביצוע', color: 'bg-blue-100 text-blue-700', icon: Navigation }
      case 'completed': return { text: 'הושלם', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 }
      case 'cancelled': return { text: 'בוטל', color: 'bg-red-100 text-red-700', icon: XCircle }
      default: return { text: status, color: 'bg-gray-100 text-gray-700', icon: Circle }
    }
  }

  const getVehicleInfo = (task: DriverTask) => {
    if (task.vehicles.length === 0) return 'אין פרטי רכב'
    const v = task.vehicles[0]
    const parts = [v.plate_number]
    if (v.manufacturer) parts.push(v.manufacturer)
    if (v.model) parts.push(v.model)
    if (v.year) parts.push(v.year.toString())
    if (v.color) parts.push(v.color)
    return parts.join(' • ')
  }

  const getAddresses = (task: DriverTask) => {
    const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
    const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
    return {
      from: pickupLeg?.from_address || task.legs[0]?.from_address || 'לא צוין',
      to: deliveryLeg?.to_address || task.legs[task.legs.length - 1]?.to_address || 'לא צוין'
    }
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--'
    return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }

  const openWaze = (address: string) => {
    const encoded = encodeURIComponent(address)
    window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, '_blank')
  }

  const openPhone = (phone: string) => {
    window.open(`tel:${phone}`, '_self')
  }

  // קבלת משימה
  const handleAcceptTask = async () => {
  if (!selectedTask) return
  setIsProcessing(true)
  try {
    await acceptTask(selectedTask.id)
    // מעבר ישיר לפרטי המשימה
    router.push(`/driver/task/${selectedTask.id}`)
  } catch (err) {
    console.error('Error accepting task:', err)
    alert('שגיאה בקבלת המשימה')
    setIsProcessing(false)
  }
}

  // דחיית משימה
  const handleRejectTask = () => {
    setShowNewTaskModal(false)
    setShowRejectModal(true)
  }

  const handleConfirmReject = async () => {
    if (!selectedRejectReason || !selectedTask) return
    setIsProcessing(true)
    try {
      const reasonLabel = rejectReasons.find(r => r.key === selectedRejectReason)?.label || selectedRejectReason
      await rejectTask(selectedTask.id, reasonLabel, rejectNote || undefined)
      setShowRejectModal(false)
      setSelectedTask(null)
      setSelectedRejectReason(null)
      setRejectNote('')
      await loadData() // רענון
    } catch (err) {
      console.error('Error rejecting task:', err)
      alert('שגיאה בדחיית המשימה')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancelReject = () => {
    setShowRejectModal(false)
    setShowNewTaskModal(true)
    setSelectedRejectReason(null)
    setRejectNote('')
  }

  const openTaskModal = (task: DriverTask) => {
    setSelectedTask(task)
    setShowNewTaskModal(true)
  }

  // מצבי טעינה ושגיאה
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mx-auto mb-2" />
          <p className="text-gray-500">טוען משימות...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-medium">{error}</p>
          <button 
            onClick={loadData}
            className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium"
          >
            נסה שוב
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* כפתור רענון */}
      <div className="flex justify-end mb-4">
        <button 
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-cyan-600 text-sm"
        >
          <RefreshCw size={16} />
          רענן
        </button>
      </div>

      {/* משימה פעילה נוכחית */}
      {currentTask && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">משימה פעילה</h2>
          <Link href={`/driver/task/${currentTask.id}`}>
            <div className="bg-gradient-to-br from-[#33d4ff] to-[#21b8e6] rounded-2xl p-4 text-white shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                    {getStatusInfo(currentTask.status).text}
                  </span>
                </div>
                <ChevronLeft size={20} className="opacity-70" />
              </div>

              <h3 className="font-bold text-xl mb-1">
                {currentTask.customer?.name || 'לקוח לא ידוע'}
              </h3>
              <p className="text-white/80 text-sm mb-3 font-mono">
                {getVehicleInfo(currentTask)}
              </p>

              <div className="bg-white/10 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  <span className="text-sm">{getAddresses(currentTask).from}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span className="text-sm">{getAddresses(currentTask).to}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-white/80">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>{formatTime(currentTask.scheduled_at || currentTask.created_at)}</span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* טאבים */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2.5 rounded-xl font-medium transition-colors ${
            activeTab === 'active'
              ? 'bg-cyan-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          פעילות ({activeTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2.5 rounded-xl font-medium transition-colors ${
            activeTab === 'upcoming'
              ? 'bg-cyan-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          קרובות ({upcomingTasks.length})
        </button>
      </div>

      {/* רשימת משימות */}
      <div className="space-y-3">
        {(activeTab === 'active' ? activeTasks : upcomingTasks).length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={32} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">אין משימות {activeTab === 'active' ? 'פעילות' : 'קרובות'}</p>
            <p className="text-gray-400 text-sm mt-1">משימות חדשות יופיעו כאן</p>
          </div>
        ) : (
          (activeTab === 'active' ? activeTasks : upcomingTasks).map((task) => {
            const statusInfo = getStatusInfo(task.status)
            const StatusIcon = statusInfo.icon
            const addresses = getAddresses(task)
            
            return (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-800">
                        {task.customer?.name || 'לקוח לא ידוע'}
                      </h3>
                      <p className="text-gray-500 text-sm font-mono">
                        {getVehicleInfo(task)}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color}`}>
                      <StatusIcon size={12} />
                      {statusInfo.text}
                    </span>
                  </div>

                  {/* Addresses */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      </div>
                      <span className="text-gray-600">{addresses.from}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin size={12} className="text-red-500" />
                      </div>
                      <span className="text-gray-600">{addresses.to}</span>
                    </div>
                  </div>

                  {/* Time & Notes */}
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>{formatTime(task.scheduled_at || task.created_at)}</span>
                    </div>
                    {task.notes && (
                      <div className="flex items-center gap-1">
                        <MessageSquare size={12} />
                        <span>יש הערות</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex border-t border-gray-100">
                  {task.customer?.phone && (
                    <button
                      onClick={() => openPhone(task.customer!.phone!)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Phone size={16} />
                      <span className="text-sm">התקשר</span>
                    </button>
                  )}
                  <button
                    onClick={() => openWaze(addresses.from)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-cyan-600 hover:bg-cyan-50 transition-colors border-r border-gray-100"
                  >
                    <Navigation size={16} />
                    <span className="text-sm">נווט</span>
                  </button>
                  {task.status === 'assigned' && (
                    <button
                      onClick={() => openTaskModal(task)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-emerald-600 hover:bg-emerald-50 transition-colors border-r border-gray-100"
                    >
                      <CheckCircle2 size={16} />
                      <span className="text-sm">קבל</span>
                    </button>
                  )}
                  <Link
                    href={`/driver/task/${task.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
                  >
                    <ChevronLeft size={16} />
                    <span className="text-sm">פרטים</span>
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-cyan-500">{stats.todayTasks}</p>
          <p className="text-xs text-gray-500">משימות היום</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-700">{stats.weekCompleted}</p>
          <p className="text-xs text-gray-500">הושלמו השבוע</p>
        </div>
      </div>

      {/* New Task Modal */}
      {showNewTaskModal && selectedTask && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-md sm:mx-4 rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-[#33d4ff] text-white p-5 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Bell size={20} />
                  </div>
                  <span className="font-bold text-lg">משימה חדשה!</span>
                </div>
              </div>
              <p className="text-white/80 text-sm">אשר או דחה את המשימה</p>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1">
              <div className="mb-4">
                <h3 className="font-bold text-xl text-gray-800">
                  {selectedTask.customer?.name || 'לקוח לא ידוע'}
                </h3>
                <p className="text-gray-500 font-mono">{getVehicleInfo(selectedTask)}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600 font-medium">איסוף</p>
                      <p className="text-gray-800 font-medium">{getAddresses(selectedTask).from}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin size={16} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs text-red-600 font-medium">יעד</p>
                      <p className="text-gray-800 font-medium">{getAddresses(selectedTask).to}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock size={16} className="text-gray-400" />
                  <span>{formatTime(selectedTask.scheduled_at || selectedTask.created_at)}</span>
                </div>
              </div>

              {selectedTask.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <MessageSquare size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">{selectedTask.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={handleRejectTask}
                  disabled={isProcessing}
                  className="flex-1 py-4 border-2 border-red-200 bg-white text-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
                >
                  <XCircle size={22} />
                  דחה
                </button>
                <button
                  onClick={handleAcceptTask}
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={22} />
                      קבל
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-md sm:mx-4 rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-red-500 text-white p-5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <XCircle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">דחיית משימה</h3>
                  <p className="text-white/80 text-sm">בחר סיבה לדחייה</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1">
              <div className="space-y-2 mb-4">
                {rejectReasons.map((reason) => (
                  <button
                    key={reason.key}
                    onClick={() => setSelectedRejectReason(reason.key)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                      selectedRejectReason === reason.key
                        ? 'bg-red-50 border-2 border-red-500'
                        : 'bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <span className="text-2xl">{reason.icon}</span>
                    <span className={`font-medium ${
                      selectedRejectReason === reason.key ? 'text-red-700' : 'text-gray-700'
                    }`}>
                      {reason.label}
                    </span>
                    {selectedRejectReason === reason.key && (
                      <CheckCircle2 size={20} className="mr-auto text-red-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  הערה נוספת (אופציונלי)
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="פרט את הסיבה..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={handleCancelReject}
                  disabled={isProcessing}
                  className="flex-1 py-4 border-2 border-gray-200 bg-white text-gray-600 rounded-xl font-bold text-lg"
                >
                  חזור
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={isProcessing || !selectedRejectReason}
                  className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    'אשר דחייה'
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