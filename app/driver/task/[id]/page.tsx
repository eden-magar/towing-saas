'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/AuthContext'
import { 
  getTaskDetail, 
  updateTaskStatus,
  updatePointStatus,
  getCurrentPointIndex,
  rejectTask,
  type TaskDetailFull,
  type DriverTaskPoint
} from '@/app/lib/queries/driver-tasks'
import { ArrowRight, Loader2, AlertCircle, X, AlertTriangle } from 'lucide-react'

// קומפוננטות השלבים
import StepOnTheWay from './components/StepOnTheWay'
import StepCamera from './components/StepCamera'
import StepDelivery from './components/StepDelivery'
import StepComplete from './components/StepComplete'

// שלבים בכל נקודה
type PointStep = 'on_the_way' | 'camera' | 'delivery'

// סיבות דחייה
const rejectionReasons = [
  'תקלה ברכב הגרר',
  'תאונה בדרך',
  'הלקוח ביטל',
  'לא מצאתי את הכתובת',
  'הרכב לא נגיש',
  'בעיה בטיחותית',
  'אחר'
]

export default function TaskFlowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  
  // State
  const [task, setTask] = useState<TaskDetailFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPointIndex, setCurrentPointIndex] = useState(0)
  const [pointStep, setPointStep] = useState<PointStep>('on_the_way')
  const [isCompleted, setIsCompleted] = useState(false)
  
  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // טעינת המשימה
  useEffect(() => {
    loadTask()
  }, [id])

  const loadTask = async () => {
    setLoading(true)
    try {
      const data = await getTaskDetail(id)
      if (data) {
        setTask(data)
        
        // קביעת המצב הנוכחי
        if (data.status === 'completed') {
          setIsCompleted(true)
        } else if (data.points.length > 0) {
          const idx = getCurrentPointIndex(data.points)
          setCurrentPointIndex(idx)
          
          // קביעת השלב בנקודה
          const currentPoint = data.points[idx]
          if (currentPoint) {
            if (currentPoint.status === 'pending') {
              setPointStep('on_the_way')
            } else if (currentPoint.status === 'arrived') {
              setPointStep('camera')
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading task:', error)
    } finally {
      setLoading(false)
    }
  }

  // הנקודה הנוכחית
  const currentPoint = task?.points[currentPointIndex] || null
  const currentPointVehicles = (() => {
    if (!currentPoint?.point_vehicles?.length) return task?.vehicles || []
    const pointVehicleIds = currentPoint.point_vehicles.map((pv: any) => pv.tow_vehicle_id)
    const filtered = (task?.vehicles || []).filter((v: any) => pointVehicleIds.includes(v.id))
    return filtered.length > 0 ? filtered : task?.vehicles || []
  })()
  const totalPoints = task?.points.length || 0

  // הגעתי לנקודה
  const handleArrived = async () => {
    if (!currentPoint || !user) return
    
    try {
      await updatePointStatus(currentPoint.id, 'arrived')
      setPointStep('camera')
      await loadTask()
    } catch (error) {
      console.error('Error updating arrival:', error)
      alert('שגיאה בעדכון ההגעה')
    }
  }

  // סיום צילום - עובר לשלב סיום
  const handleCameraComplete = async () => {
    setPointStep('delivery')
  }

  // סיום פרטי מסירה/הערות
  const handleDeliveryComplete = async (recipientName: string, recipientPhone: string, notes?: string) => {
    await completeCurrentPoint(recipientName, recipientPhone, notes)
  }

  // השלמת הנקודה הנוכחית
  const completeCurrentPoint = async (recipientName?: string, recipientPhone?: string, notes?: string) => {
    if (!currentPoint || !user || !task) return
    
    try {
      await updatePointStatus(currentPoint.id, 'completed', recipientName, recipientPhone, notes)
      
      // בדיקה אם זו הנקודה האחרונה
      const nextIndex = currentPointIndex + 1
      if (nextIndex >= totalPoints) {
        // סיום המשימה
        await updateTaskStatus(task.id, 'completed')
        setIsCompleted(true)
      } else {
        // עובר לנקודה הבאה
        setCurrentPointIndex(nextIndex)
        setPointStep('on_the_way')
      }
      
      await loadTask()
    } catch (error) {
      console.error('Error completing point:', error)
      alert('שגיאה בהשלמת הנקודה')
    }
  }

  // דחיית הגרירה
  const handleReject = async () => {
    if (!task || !rejectReason) return
    
    setRejecting(true)
    try {
      await rejectTask(task.id, rejectReason, rejectNote.trim() || undefined)
      router.push('/driver')
    } catch (error) {
      console.error('Error rejecting task:', error)
      alert('שגיאה בדחיית הגרירה')
    } finally {
      setRejecting(false)
    }
  }

  // צבע הרקע לפי השלב
  const getBackgroundColor = () => {
    if (isCompleted) return 'bg-emerald-500'
    if (pointStep === 'camera') return 'bg-purple-500'
    if (pointStep === 'delivery') return 'bg-emerald-500'
    if (currentPoint?.point_type === 'pickup') return 'bg-blue-500'
    return 'bg-orange-500' // dropoff
  }

  // Loading
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-500">טוען משימה...</p>
        </div>
      </div>
    )
  }

  // לא נמצא
  if (!task) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-100 p-4">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <p className="text-gray-600 mb-4">המשימה לא נמצאה</p>
        <button 
          onClick={() => router.push('/driver')}
          className="text-blue-600 font-medium"
        >
          חזרה לדף הבית
        </button>
      </div>
    )
  }

  // אין נקודות
  if (task.points.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-100 p-4">
        <AlertCircle size={48} className="text-amber-400 mb-4" />
        <p className="text-gray-600 mb-4">אין נקודות במשימה זו</p>
        <button 
          onClick={() => router.push('/driver')}
          className="text-blue-600 font-medium"
        >
          חזרה לדף הבית
        </button>
      </div>
    )
  }

  // מסך סיום
  if (isCompleted) {
    return <StepComplete onGoHome={() => router.push('/driver')} />
  }

  return (
    <div dir="rtl" className={`fixed inset-0 ${getBackgroundColor()} transition-colors duration-300 overflow-hidden`}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => router.push('/driver')}
            className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center"
          >
            <ArrowRight size={20} className="text-white" />
          </button>
          
          <div className="bg-white/20 backdrop-blur rounded-full px-4 py-1.5">
            <span className="text-white text-sm font-medium">
              שלב {currentPointIndex + 1}/{totalPoints}
            </span>
          </div>
          
          {/* כפתור דחייה */}
          <button 
            onClick={() => setShowRejectModal(true)}
            className="w-10 h-10 bg-red-500/80 backdrop-blur rounded-xl flex items-center justify-center"
          >
            <X size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* תוכן לפי השלב */}
      <div className="pt-16 h-full overflow-auto">
        {pointStep === 'on_the_way' && currentPoint && (
          <StepOnTheWay
            point={currentPoint}
            vehicles={currentPointVehicles}
            customer={task.customer}
            totalPoints={totalPoints}
            currentIndex={currentPointIndex}
            onArrived={handleArrived}
          />
        )}

        {pointStep === 'camera' && currentPoint && (
          <StepCamera
            towId={task.id}
            point={currentPoint}
            vehicles={currentPointVehicles}
            userId={user?.id || ''}
            onComplete={handleCameraComplete}
          />
        )}

        {pointStep === 'delivery' && currentPoint && (
          <StepDelivery
            pointType={currentPoint.point_type}
            customer={task.customer}
            onComplete={handleDeliveryComplete}
          />
        )}
      </div>

      {/* מודל דחיית גרירה */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl max-h-[85vh] overflow-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">דחיית גרירה</h2>
              <button 
                onClick={() => setShowRejectModal(false)}
                className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* תוכן */}
            <div className="p-5">
              {/* אזהרה */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3">
                <AlertTriangle size={24} className="text-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800">שים לב</p>
                  <p className="text-sm text-amber-700">דחיית הגרירה תחזיר אותה למוקד לשיבוץ מחדש</p>
                </div>
              </div>

              {/* סיבות דחייה */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">סיבת הדחייה</label>
                <div className="space-y-2">
                  {rejectionReasons.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setRejectReason(reason)}
                      className={`w-full p-4 rounded-xl text-right transition-colors ${
                        rejectReason === reason
                          ? 'bg-red-50 border-2 border-red-500 text-red-700'
                          : 'bg-gray-50 border-2 border-transparent text-gray-700'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {/* הערה נוספת */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">הערה נוספת (אופציונלי)</label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="פרט את הסיבה..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            </div>

            {/* כפתורים */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-5 flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                ביטול
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason || rejecting}
                className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {rejecting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  'דחה גרירה'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}