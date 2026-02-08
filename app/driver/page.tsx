'use client'
import { openWaze } from '../lib/utils/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
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
  XCircle,
  MessageSquare,
  Loader2,
  RefreshCw,
  Check
} from 'lucide-react'
import NewTaskModal from '../components/NewTaskModal'

const driverStatuses = [
  { id: 'available', label: 'זמין', icon: '🟢' },
  { id: 'busy', label: 'בגרירה', icon: '🔵' },
  { id: 'break', label: 'בהפסקה', icon: '🟡' },
  { id: 'unavailable', label: 'לא זמין', icon: '🔴' },
]

export default function DriverHomePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  
  // State
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null)
  const [tasks, setTasks] = useState<DriverTask[]>([])
  const [stats, setStats] = useState({ todayTasks: 0, weekCompleted: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modals
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<DriverTask | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // טעינת נתונים
  useEffect(() => {
    if (!authLoading && user) {
      loadData()
    }
  }, [authLoading, user])

  // Realtime - גרירות חדשות/עדכונים בזמן אמת
  useEffect(() => {
    if (!driverInfo?.id) return

    const channel = supabase
      .channel(`driver-realtime-${driverInfo.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tows',
        filter: `driver_id=eq.${driverInfo.id}`
      }, () => loadData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [driverInfo?.id])

  const loadData = async () => {
    if (!user) return
    
    setLoading(true)
    setError(null)

    try {
      const driver = await getDriverByUserId(user.id)
      
      if (!driver) {
        setError('לא נמצא פרופיל נהג עבור המשתמש')
        setLoading(false)
        return
      }
      setDriverInfo(driver)

      const driverTasks = await getDriverTasks(driver.id)
      setTasks(driverTasks)

      const driverStats = await getDriverStats(driver.id)
      setStats(driverStats)

    } catch (err) {
      console.error('Error loading data:', err)
      setError('שגיאה בטעינת הנתונים')
    } finally {
      setLoading(false)
    }
  }

  // פילטור משימות
  const activeTasks = tasks.filter(t => ['assigned', 'in_progress'].includes(t.status))
  const currentTask = tasks.find(t => t.status === 'in_progress')
  const hasActiveTask = !!currentTask


  // פונקציות עזר
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'בוקר טוב'
    if (hour < 17) return 'צהריים טובים'
    if (hour < 21) return 'ערב טוב'
    return 'לילה טוב'
  }

  const getHebrewDate = () => {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    const now = new Date()
    return `יום ${days[now.getDay()]}, ${now.getDate()} ב${months[now.getMonth()]}`
  }

  const getDriverName = () => {
    const fullName = driverInfo?.user?.full_name || user?.full_name || 'נהג'
    return fullName.split(' ')[0]
  }

  const getCurrentStatus = () => {
    const status = driverInfo?.status || 'unavailable'
    return driverStatuses.find(s => s.id === status) || driverStatuses[3]
  }

  const getTruckInfo = () => {
    if (!driverInfo?.truck) return null
    return {
      model: `${driverInfo.truck.manufacturer || ''} ${driverInfo.truck.model || ''}`.trim() || 'גרר',
      plate: driverInfo.truck.plate_number
    }
  }

  const getVehicleInfo = (task: DriverTask) => {
  if (task.vehicles.length === 0) return { name: 'אין פרטי רכב', plate: '' }
  const v = task.vehicles[0]
  return {
    name: `${v.manufacturer || ''} ${v.model || ''}`.trim() || 'רכב',
    plate: v.plate_number || ''
  }
}

  const getAddresses = (task: DriverTask) => {
    // קודם ננסה מ-points (המבנה החדש)
    if ((task as any).points && (task as any).points.length > 0) {
      const points = (task as any).points
      const firstPickup = points.find((p: any) => p.point_type === 'pickup') || points[0]
      const lastDropoff = [...points].reverse().find((p: any) => p.point_type === 'dropoff') || points[points.length - 1]
      return {
        from: firstPickup?.address || 'לא צוין',
        to: lastDropoff?.address || 'לא צוין',
        totalPoints: points.length
      }
    }
    // fallback ל-legs (המבנה הישן)
    const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
    const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
    return {
      from: pickupLeg?.from_address || task.legs[0]?.from_address || 'לא צוין',
      to: deliveryLeg?.to_address || task.legs[task.legs.length - 1]?.to_address || 'לא צוין',
      totalPoints: 2
    }
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--'
    return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }

  const openPhone = (phone: string) => {
    window.open(`tel:${phone}`, '_self')
  }

  // פתיחת מודל משימה
  const openTaskModal = (task: DriverTask) => {
    setSelectedTask(task)
    setShowNewTaskModal(true)
  }

  // קבלת משימה
  const handleAcceptTask = async () => {
    if (!selectedTask) return
    setIsProcessing(true)
    try {
      await acceptTask(selectedTask.id)
      router.push(`/driver/task/${selectedTask.id}`)
    } catch (err) {
      console.error('Error accepting task:', err)
      alert('שגיאה בקבלת המשימה')
      setIsProcessing(false)
    }
  }


  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-500">טוען...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <p className="text-gray-700 text-lg mb-4">{error}</p>
        <button 
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl"
        >
          <RefreshCw size={18} />
          נסה שוב
        </button>
      </div>
    )
  }

  const truckInfo = getTruckInfo()
  const currentStatus = getCurrentStatus()

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6">
            <h3 className="text-xl font-bold mb-4 text-center">עדכן סטטוס</h3>
            <div className="space-y-3">
              {driverStatuses.map(status => (
                <button
                key={status.id}
                onClick={async () => {
                  if (driverInfo?.id) {
                    try {
                      await supabase
                        .from('drivers')
                        .update({ status: status.id })
                        .eq('id', driverInfo.id)
                      
                      setDriverInfo(prev => prev ? { ...prev, status: status.id as any } : null)
                    } catch (err) {
                      console.error('Error updating status:', err)
                    }
                  }
                  setShowStatusModal(false)
                }}
                className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all ${
                  currentStatus.id === status.id 
                    ? 'bg-blue-100 border-2 border-blue-500' 
                    : 'bg-gray-50 border-2 border-transparent'
                }`}
              >
                <span className="text-2xl">{status.icon}</span>
                <span className="font-medium text-lg text-gray-800">{status.label}</span>
                {currentStatus.id === status.id && (
                  <Check className="mr-auto text-blue-500" size={24} />
                )}
              </button>
              ))}
            </div>
            <button 
              onClick={() => setShowStatusModal(false)}
              className="w-full mt-4 p-4 bg-gray-100 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-300"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{getGreeting()}, {getDriverName()} 👋</h1>
            <p className="text-blue-100 mt-1">{getHebrewDate()}</p>
          </div>
          <div className="bg-white/20 rounded-full p-3">
            <Truck size={28} />
          </div>
        </div>

        {/* Driver Status Button */}
        <button 
          onClick={() => setShowStatusModal(true)}
          className="w-full bg-white/20 rounded-2xl p-4 flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{currentStatus.icon}</span>
            <div className="text-right">
              <div className="text-sm text-blue-100">הסטטוס שלי</div>
              <div className="font-bold">{currentStatus.label}</div>
            </div>
          </div>
          <ChevronLeft size={24} className="text-blue-200" />
        </button>

        {/* Truck Info */}
        {truckInfo && (
          <div className="bg-white/20 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-xl p-3">
                <Truck size={24} />
              </div>
              <div className="flex-1">
                <div className="text-sm text-blue-100">הגרר שלי</div>
                <div className="font-bold">{truckInfo.model}</div>
                <span className="inline-block bg-yellow-400 text-gray-900 text-sm font-mono font-bold px-3 py-1 rounded mt-1 border-2 border-yellow-500">
                  {truckInfo.plate}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Quick Stats */}
        <div className="flex gap-4 mt-4">
          <div className="bg-white/20 rounded-2xl p-4 flex-1 text-center">
            <div className="text-3xl font-bold">{stats.todayTasks}</div>
            <div className="text-sm text-blue-100">גרירות היום</div>
          </div>
          <div className="bg-white/20 rounded-2xl p-4 flex-1 text-center">
            <div className="text-3xl font-bold">{stats.weekCompleted}</div>
            <div className="text-sm text-blue-100">השבוע</div>
          </div>
        </div>
      </div>

      {/* Active Task Banner */}
      {currentTask && (
        <div className="mx-4 -mt-4 relative z-10">
          <Link href={`/driver/task/${currentTask.id}`}>
            <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-2xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <Navigation size={24} />
                  </div>
                  <div>
                    <div className="text-sm text-cyan-100">
                      משימה פעילה {currentTask.order_number && `#${currentTask.order_number}`}
                    </div>
                    <div className="font-bold">{getVehicleInfo(currentTask).name}</div>
                    {getVehicleInfo(currentTask).plate && (
                      <span className="bg-white/20 text-xs font-mono px-2 py-0.5 rounded">
                        {getVehicleInfo(currentTask).plate}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronLeft size={24} className="text-white/70" />
              </div>
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="truncate">{getAddresses(currentTask).from}</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <div className="w-2 h-2 bg-red-400 rounded-full" />
                  <span className="truncate">{getAddresses(currentTask).to}</span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Schedule */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">📅 הלו"ז שלי</h2>
          <button onClick={loadData} className="text-gray-400 hover:text-gray-600">
            <RefreshCw size={20} />
          </button>
        </div>

        {activeTasks.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-gray-600 font-medium">אין משימות בתור</p>
            <p className="text-gray-400 text-sm mt-1">תיהנה מההפסקה!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTasks.map((task) => {
              const addresses = getAddresses(task)
              const isInProgress = task.status === 'in_progress'
              
              return (
                <div 
                  key={task.id}
                  onClick={() => isInProgress ? router.push(`/driver/task/${task.id}`) : openTaskModal(task)}
                  className={`bg-white rounded-2xl p-4 shadow-sm border transition-transform active:scale-[0.98] cursor-pointer ${
                    isInProgress ? 'border-cyan-200' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl px-3 py-2 font-bold ${
                        isInProgress 
                          ? 'bg-cyan-100 text-cyan-600' 
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {formatTime(task.scheduled_at || task.created_at)}
                      </div>
                      <div>
                        <div>
                          <div className="font-medium text-gray-800">{getVehicleInfo(task).name}</div>
                          {task.order_number && (
                        <div className="text-xs font-mono text-gray-400">#{task.order_number}</div>
                      )}
                          {getVehicleInfo(task).plate && (
                            <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-mono px-2 py-0.5 rounded mt-1">
                              {getVehicleInfo(task).plate}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {task.vehicles.length} רכב{task.vehicles.length > 1 ? 'ים' : ''} • {addresses.totalPoints} נקודות
                        </div>
                      </div>
                    </div>
                    <ChevronLeft className="text-gray-400" size={24} />
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="truncate">{addresses.from}</span>
                    </div>
                    {addresses.totalPoints > 2 && (
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-1 mr-4">
                        <span>+{addresses.totalPoints - 2} נקודות נוספות</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="truncate">{addresses.to}</span>
                    </div>
                  </div>

                  {task.notes && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                      <MessageSquare size={14} />
                      <span className="truncate">{task.notes}</span>
                    </div>
                  )}

                  {isInProgress && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          openWaze(addresses.from)
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium"
                      >
                        <Navigation size={16} />
                        נווט
                      </button>
                      {task.customer?.phone && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            openPhone(task.customer!.phone!)
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-50 text-green-600 rounded-xl text-sm font-medium"
                        >
                          <Phone size={16} />
                          התקשר
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

        {/* New Task Modal */}
        {showNewTaskModal && selectedTask && driverInfo && (
          <NewTaskModal
            task={selectedTask}
            driverId={driverInfo.id}
            companyId={driverInfo.company_id || ''}
            hasActiveTask={hasActiveTask}
            onClose={() => {
              setShowNewTaskModal(false)
              setSelectedTask(null)
            }}
            onAccept={() => {
              loadData()
              setShowNewTaskModal(false)
              setSelectedTask(null)
            }}
          />
        )}
    </div>
  )
}