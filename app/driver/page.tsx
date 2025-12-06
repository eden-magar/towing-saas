'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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
  Bell
} from 'lucide-react'

interface Task {
  id: number
  status: 'new' | 'pending' | 'accepted' | 'on_way' | 'arrived' | 'loading' | 'in_transit' | 'completed'
  customer: string
  customerPhone: string
  vehicle: string
  vehicleInfo: string
  from: string
  to: string
  scheduledTime: string
  distance: string
  estimatedDuration: string
  notes?: string
  isUrgent?: boolean
}

type RejectReason = 'break' | 'vehicle_issue' | 'too_far' | 'personal' | 'other'

const rejectReasons: { key: RejectReason; label: string; icon: string }[] = [
  { key: 'break', label: 'הפסקה', icon: '☕' },
  { key: 'vehicle_issue', label: 'תקלה ברכב', icon: '🔧' },
  { key: 'too_far', label: 'רחוק מדי', icon: '📍' },
  { key: 'personal', label: 'סיבה אישית', icon: '👤' },
  { key: 'other', label: 'אחר', icon: '💬' },
]

export default function DriverTasksPage() {
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming'>('active')
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [newTask, setNewTask] = useState<Task | null>(null)
  const [selectedRejectReason, setSelectedRejectReason] = useState<RejectReason | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      status: 'on_way',
      customer: 'יוסי כהן',
      customerPhone: '050-1234567',
      vehicle: '12-345-67',
      vehicleInfo: 'טויוטה קורולה 2020, לבן',
      from: 'רחוב הרצל 50, תל אביב',
      to: 'רחוב ויצמן 12, רמת גן',
      scheduledTime: '09:00',
      distance: '8.5 ק"מ',
      estimatedDuration: '25 דקות',
      notes: 'הלקוח מחכה ליד הרכב',
      isUrgent: true
    },
    {
      id: 2,
      status: 'pending',
      customer: 'מוסך רמט',
      customerPhone: '03-5551234',
      vehicle: '23-456-78',
      vehicleInfo: 'מאזדה 3 2019, אפור',
      from: 'רחוב סוקולוב 15, חולון',
      to: 'אזור התעשייה, בת ים',
      scheduledTime: '11:30',
      distance: '5.2 ק"מ',
      estimatedDuration: '15 דקות',
    },
    {
      id: 3,
      status: 'pending',
      customer: 'שרה לוי',
      customerPhone: '052-9876543',
      vehicle: '34-567-89',
      vehicleInfo: 'יונדאי i20 2021, אדום',
      from: 'קניון עזריאלי, תל אביב',
      to: 'רחוב בן גוריון 80, הרצליה',
      scheduledTime: '14:00',
      distance: '12 ק"מ',
      estimatedDuration: '35 דקות',
    },
  ])

  // Simulate new task notification
  useEffect(() => {
    const timer = setTimeout(() => {
      const incomingTask: Task = {
        id: 99,
        status: 'new',
        customer: 'דני רוזן',
        customerPhone: '054-7654321',
        vehicle: '99-888-77',
        vehicleInfo: 'הונדה סיוויק 2022, שחור',
        from: 'רחוב דיזנגוף 100, תל אביב',
        to: 'רחוב רוטשילד 50, ראשל"צ',
        scheduledTime: '15:30',
        distance: '15 ק"מ',
        estimatedDuration: '40 דקות',
        notes: 'רכב לא מניע, צריך גרירה מלאה',
        isUrgent: true
      }
      setNewTask(incomingTask)
      setShowNewTaskModal(true)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  const activeTasks = tasks.filter(t => !['completed', 'new'].includes(t.status))
  const upcomingTasks = tasks.filter(t => t.status === 'pending')
  const currentTask = tasks.find(t => ['on_way', 'arrived', 'loading', 'in_transit', 'accepted'].includes(t.status))

  const getStatusInfo = (status: Task['status']) => {
    switch (status) {
      case 'new': return { text: 'חדש', color: 'bg-blue-100 text-blue-700', icon: Bell }
      case 'pending': return { text: 'ממתין', color: 'bg-amber-100 text-amber-700', icon: Clock }
      case 'accepted': return { text: 'התקבל', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 }
      case 'on_way': return { text: 'בדרך לאיסוף', color: 'bg-blue-100 text-blue-700', icon: Navigation }
      case 'arrived': return { text: 'הגעתי', color: 'bg-purple-100 text-purple-700', icon: MapPin }
      case 'loading': return { text: 'טוען', color: 'bg-purple-100 text-purple-700', icon: Truck }
      case 'in_transit': return { text: 'בדרך ליעד', color: 'bg-indigo-100 text-indigo-700', icon: Navigation }
      case 'completed': return { text: 'הושלם', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 }
      default: return { text: status, color: 'bg-gray-100 text-gray-700', icon: Circle }
    }
  }

  const openWaze = (address: string) => {
    const encoded = encodeURIComponent(address)
    window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, '_blank')
  }

  const openPhone = (phone: string) => {
    window.open(`tel:${phone}`, '_self')
  }

  const handleAcceptTask = async () => {
    if (!newTask) return
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setTasks([...tasks, { ...newTask, status: 'accepted' }])
    setShowNewTaskModal(false)
    setNewTask(null)
    setIsProcessing(false)
  }

  const handleRejectTask = () => {
    setShowNewTaskModal(false)
    setShowRejectModal(true)
  }

  const handleConfirmReject = async () => {
    if (!selectedRejectReason) return
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('Rejected:', newTask?.id, selectedRejectReason, rejectNote)
    setShowRejectModal(false)
    setNewTask(null)
    setSelectedRejectReason(null)
    setRejectNote('')
    setIsProcessing(false)
  }

  const handleCancelReject = () => {
    setShowRejectModal(false)
    setShowNewTaskModal(true)
    setSelectedRejectReason(null)
    setRejectNote('')
  }

  return (
    <div className="p-4">
      {/* Current Active Task */}
      {currentTask && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">משימה פעילה</h2>
          <Link href={`/driver/task/${currentTask.id}`}>
            <div className="bg-gradient-to-br from-[#33d4ff] to-[#21b8e6] rounded-2xl p-4 text-white shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {currentTask.isUrgent && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium animate-pulse">
                      דחוף
                    </span>
                  )}
                  <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                    {getStatusInfo(currentTask.status).text}
                  </span>
                </div>
                <ChevronLeft size={20} className="text-white/70" />
              </div>

              <h3 className="font-bold text-lg mb-1">{currentTask.customer}</h3>
              <p className="text-white/80 text-sm font-mono mb-3">{currentTask.vehicle} • {currentTask.vehicleInfo.split(',')[0]}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center mt-0.5">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-white/60">איסוף</p>
                    <p className="text-sm">{currentTask.from}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-400 flex items-center justify-center mt-0.5">
                    <MapPin size={12} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-white/60">יעד</p>
                    <p className="text-sm">{currentTask.to}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Timer size={14} />
                    {currentTask.estimatedDuration}
                  </span>
                  <span className="flex items-center gap-1">
                    <Navigation size={14} />
                    {currentTask.distance}
                  </span>
                </div>
                <span className="text-white/70">{currentTask.scheduledTime}</span>
              </div>
            </div>
          </Link>

          <div className="flex gap-3 mt-3">
            <button 
              onClick={(e) => { e.preventDefault(); openWaze(currentTask.from); }}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-medium"
            >
              <Navigation size={18} />
              נווט לאיסוף
            </button>
            <button 
              onClick={(e) => { e.preventDefault(); openPhone(currentTask.customerPhone); }}
              className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-medium"
            >
              <Phone size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm ${
            activeTab === 'active' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          משימות היום ({activeTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm ${
            activeTab === 'upcoming' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          ממתינות ({upcomingTasks.length})
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {(activeTab === 'active' ? activeTasks : upcomingTasks).map((task) => {
          const statusInfo = getStatusInfo(task.status)
          const StatusIcon = statusInfo.icon
          const isCurrentTask = task.id === currentTask?.id

          if (isCurrentTask && activeTab === 'active') return null

          return (
            <Link key={task.id} href={`/driver/task/${task.id}`}>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${statusInfo.color}`}>
                      <StatusIcon size={12} />
                      {statusInfo.text}
                    </span>
                    {task.isUrgent && (
                      <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <AlertCircle size={12} />
                        דחוף
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Clock size={14} />
                    <span className="text-sm">{task.scheduledTime}</span>
                  </div>
                </div>

                <h3 className="font-bold text-gray-800 mb-1">{task.customer}</h3>
                <p className="text-sm text-gray-500 font-mono mb-3">{task.vehicle}</p>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    </div>
                    <span className="truncate">{task.from}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center">
                      <MapPin size={10} className="text-red-500" />
                    </div>
                    <span className="truncate">{task.to}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>{task.distance}</span>
                    <span>•</span>
                    <span>{task.estimatedDuration}</span>
                  </div>
                  <ChevronLeft size={18} className="text-gray-400" />
                </div>
              </div>
            </Link>
          )
        })}

        {((activeTab === 'active' && activeTasks.length === 0) || 
          (activeTab === 'upcoming' && upcomingTasks.length === 0)) && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500">אין משימות {activeTab === 'active' ? 'פעילות' : 'ממתינות'}</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-[#33d4ff]">{activeTasks.length}</p>
          <p className="text-xs text-gray-500">משימות היום</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">5</p>
          <p className="text-xs text-gray-500">הושלמו השבוע</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-700">127</p>
          <p className="text-xs text-gray-500">ק"מ היום</p>
        </div>
      </div>

      {/* New Task Modal */}
      {showNewTaskModal && newTask && (
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
                {newTask.isUrgent && (
                  <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse">
                    דחוף
                  </span>
                )}
              </div>
              <p className="text-white/80 text-sm">התקבלה משימה חדשה - אשר או דחה</p>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1">
              <div className="mb-4">
                <h3 className="font-bold text-xl text-gray-800">{newTask.customer}</h3>
                <p className="text-gray-500 font-mono">{newTask.vehicle} • {newTask.vehicleInfo.split(',')[0]}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600 font-medium">איסוף</p>
                      <p className="text-gray-800 font-medium">{newTask.from}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin size={16} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs text-red-600 font-medium">יעד</p>
                      <p className="text-gray-800 font-medium">{newTask.to}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock size={16} className="text-gray-400" />
                  <span>{newTask.scheduledTime}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Navigation size={16} className="text-gray-400" />
                  <span>{newTask.distance}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Timer size={16} className="text-gray-400" />
                  <span>{newTask.estimatedDuration}</span>
                </div>
              </div>

              {newTask.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <MessageSquare size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">{newTask.notes}</p>
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
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
