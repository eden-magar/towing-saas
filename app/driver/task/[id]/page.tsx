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
import { createCashCollection, updateTowCashPayment } from '@/app/lib/queries/driver-cash'
import { addVehicleToStorage } from '@/app/lib/queries/storage'
import { getDriverByUserId } from '@/app/lib/queries/driver-tasks'
import { supabase } from '@/app/lib/supabase'
import { ArrowRight, Loader2, AlertCircle, X, AlertTriangle } from 'lucide-react'

// קומפוננטות השלבים
import StepOnTheWay from './components/StepOnTheWay'
import StepCamera from './components/StepCamera'
import StepDelivery from './components/StepDelivery'
import StepComplete from './components/StepComplete'

// שלבים בכל נקודה
type PointStep = 'on_the_way' | 'camera' | 'delivery' | 'camera_after'

// סיבות דחייה
import { REJECTION_REASONS } from '@/app/lib/queries/rejection-requests'


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
  const [rejectionPending, setRejectionPending] = useState(false)

  const [pendingRejectionRequestId, setPendingRejectionRequestId] = useState<string | null>(null)
  const [rejectionDenied, setRejectionDenied] = useState(false)

  const [pendingDeliveryData, setPendingDeliveryData] = useState<{
    recipientName: string
    recipientPhone: string
    notes?: string
    cashCollected?: number
  } | null>(null)

  // טעינת המשימה
  useEffect(() => {
    loadTask()
  }, [id])

  useEffect(() => {
    if (!pendingRejectionRequestId) return
    const channel = supabase
      .channel(`rejection-${pendingRejectionRequestId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tow_rejection_requests',
        filter: `id=eq.${pendingRejectionRequestId}`
      }, (payload) => {
        if (payload.new.status === 'rejected') {
          setRejectionDenied(true)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [pendingRejectionRequestId])

  const loadTask = async () => {
    setLoading(true)
    try {
      const data = await getTaskDetail(id)
      if (data) {
        setTask(data)
        // בדוק אם יש בקשת דחייה ממתינה
        const driver = await getDriverByUserId(user?.id || '')
        if (driver) {
          const { getPendingRejectionRequest } = await import('@/app/lib/queries/rejection-requests')
          const pending = await getPendingRejectionRequest(id, driver.id)
          if (pending) {
            setRejectionPending(true)
            setPendingRejectionRequestId(pending.id)
          }
        }
        
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
              if (currentPoint.point_type === 'dropoff') {
                setPointStep('camera_after')
              } else if (currentPoint.point_type === 'stop') {
                setPointStep('delivery')
              } else {
                setPointStep('camera')
              }
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

  const cameraVehicles =
    pointStep === 'camera' && currentPoint?.point_type === 'exchange'
      ? currentPointVehicles.filter((v: any) => !v.is_working)
      : pointStep === 'camera_after' && currentPoint?.point_type === 'exchange'
        ? currentPointVehicles.filter((v: any) => v.is_working)
        : currentPointVehicles

  const totalPoints = task?.points.length || 0

  // הגעתי לנקודה
  const handleArrived = async (notes?: string) => {
    if (!currentPoint || !user) {
      alert(`חסר: currentPoint=${!!currentPoint} user=${!!user}`)
      return
    }
    try {
      await updatePointStatus(currentPoint.id, 'arrived', undefined, undefined, notes)
      if (currentPoint.point_type === 'dropoff') {
        setPointStep('camera_after')
      } else if (currentPoint.point_type === 'stop') {
        setPointStep('delivery')
      } else {
        setPointStep('camera')
      }
      await loadTask()
    } catch (error) {
      console.error('Error updating arrival:', error)
      alert(`שגיאה: ${JSON.stringify(error)}`)
    }
  }

  // סיום צילום - עובר לשלב סיום
  const handleCameraComplete = async () => {
    if (currentPoint?.point_type === 'exchange') {
      setPointStep('camera_after')
    } else {
      setPointStep('delivery')
    }
  }

  const handleCameraAfterComplete = async () => {
    if (currentPoint?.point_type === 'exchange') {
      setPointStep('delivery')
      return
    }
    if (!pendingDeliveryData) {
      setPointStep('delivery')
      return
    }
    await completeCurrentPoint(
      pendingDeliveryData.recipientName,
      pendingDeliveryData.recipientPhone,
      pendingDeliveryData.notes,
      pendingDeliveryData.cashCollected
    )
    setPendingDeliveryData(null)
  }

  // סיום פרטי מסירה/הערות
  const handleDeliveryComplete = async (recipientName: string, recipientPhone: string, notes?: string, cashCollected?: number) => {
    if (currentPoint?.point_type === 'exchange') {
      await completeCurrentPoint(recipientName, recipientPhone, notes, cashCollected)
      return
    }
    if (currentPoint?.point_type === 'stop') {
      await completeCurrentPoint(recipientName, recipientPhone, notes, cashCollected)
    } else if (currentPoint?.point_type === 'dropoff') {
      await completeCurrentPoint(recipientName, recipientPhone, notes, cashCollected)
    } else if (currentPoint?.point_type === 'pickup') {
      await completeCurrentPoint(recipientName, recipientPhone, notes, cashCollected)
    }
  }

  // השלמת הנקודה הנוכחית
  const completeCurrentPoint = async (recipientName?: string, recipientPhone?: string, notes?: string, cashCollected?: number) => {
    if (!currentPoint || !user || !task) return
    
    try {
      await updatePointStatus(currentPoint.id, 'completed', recipientName, recipientPhone, notes)
      
      // בדיקה אם זו הנקודה האחרונה
      const nextIndex = currentPointIndex + 1
      if (nextIndex >= totalPoints) {
        // סיום המשימה
        // שמירת מזומן אם נגבה
        if (cashCollected && cashCollected > 0) {
          await updateTowCashPayment(task.id, 'cash', cashCollected)
          const driver = await getDriverByUserId(user.id)
          if (driver) {
            await createCashCollection(driver.id, task.id, cashCollected, user.id)
          }
        }
        // סיום המשימה
        await updateTaskStatus(task.id, 'completed')
        
        // הכנסה לאחסנה אם נדרש
        if (task.dropoff_to_storage && user) {
          const lastVehicle = task.vehicles[0]
          if (lastVehicle?.plate_number) {
            try {
              await addVehicleToStorage({
                companyId: task.company_id || '',
                customerId: task.customer?.id || undefined,
                plateNumber: lastVehicle.plate_number,
                vehicleData: lastVehicle.manufacturer ? {
                  manufacturer: lastVehicle.manufacturer || undefined,
                  model: lastVehicle.model || undefined,
                  color: lastVehicle.color || undefined,
                } : undefined,
                towId: task.id,
                performedBy: user.id,
                notes: 'נכנס מגרירה',
                vehicleCondition: lastVehicle.tow_reason ? 'faulty' : 'operational',
                vehicleCode: lastVehicle.vehicle_code || undefined,
              })
            } catch (e) {
              console.error('Storage error:', e)
            }
          }
        }
        
        await loadTask()
        setIsCompleted(true)
      } else {
        // עובר לנקודה הבאה
        await loadTask()
        setCurrentPointIndex(nextIndex)
        setPointStep('on_the_way')
      }
    } catch (error) {
      console.error('Error completing point:', error)
      alert('שגיאה בהשלמת הנקודה')
    }
  }

  // דחיית הגרירה
  const handleReject = async () => {

  if (!task || !rejectReason || !user) return
  
  setRejecting(true)
  try {
    const driver = await getDriverByUserId(user.id)
    if (!driver) {
      alert('לא נמצא פרופיל נהג')
      return
    }
    const requestId = await rejectTask(task.id, driver.id, driver.company_id, rejectReason, rejectNote.trim() || undefined)
    setPendingRejectionRequestId(requestId)
    setRejecting(false)
    setShowRejectModal(false)
    setRejectionPending(true)
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
    if (currentPoint?.point_type === 'exchange') return 'bg-purple-500'
    if (currentPoint?.point_type === 'stop') return 'bg-gray-500'
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

  if (rejectionPending) {
    return (
      <div dir="rtl" className="fixed inset-0 bg-orange-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-sm w-full">
          {rejectionDenied && (
            <div className="bg-red-100 text-red-700 rounded-xl px-4 py-2 mb-4 font-medium text-sm">
              ❌ המנהל דחה את בקשת הדחייה — יש להמשיך בגרירה
            </div>
          )}
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">בקשת הדחייה נשלחה</h2>
          <p className="text-gray-500 mb-6">ממתין לאישור המנהל</p>
          <p className="text-sm text-gray-400 mb-6">הגרירה תוסר מהתור שלך לאחר אישור המנהל</p>
          <button
            onClick={async () => {
              if (pendingRejectionRequestId) {
                const { cancelRejectionRequest } = await import('@/app/lib/queries/rejection-requests')
                await cancelRejectionRequest(pendingRejectionRequestId)
              }
              setRejectionPending(false)
              setPendingRejectionRequestId(null)
            }}
            className="w-full py-3 rounded-xl bg-red-100 text-red-700 font-medium mb-3"
          >
            ביטול דחייה — חזרה לגרירה
          </button>
          <button
            onClick={() => router.push('/driver')}
            className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 font-medium"
          >
            חזרה לדף הבית
          </button>
        </div>
      </div>
    )
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
          
          <div className="bg-white/20 backdrop-blur rounded-full px-4 py-1.5 text-center">
            {task.order_number && (
              <span className="text-white/80 text-xs block">#{task.order_number}</span>
            )}
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
        {task.notes && (
          <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-medium text-amber-600 mb-1">📋 הערות דיספצ&apos;ר</p>
            <p className="text-sm text-amber-800">{task.notes}</p>
          </div>
        )}
        {pointStep === 'on_the_way' && currentPoint && (
          <StepOnTheWay
            point={currentPoint}
            vehicles={currentPointVehicles}
            customer={task.customer}
            totalPoints={totalPoints}
            currentIndex={currentPointIndex}
            onArrived={handleArrived}
            taskId={id}
          />
        )}

        {pointStep === 'camera' && currentPoint && (
          <StepCamera
            towId={task.id}
            point={currentPoint}
            vehicles={cameraVehicles}
            userId={user?.id || ''}
            onComplete={handleCameraComplete}
          />
        )}

        {pointStep === 'camera_after' && currentPoint && (
          <StepCamera
            towId={task.id}
            point={currentPoint}
            vehicles={cameraVehicles}
            userId={user?.id || ''}
            onComplete={handleCameraAfterComplete}
            isAfterDelivery={true}
          />
        )}

        {pointStep === 'delivery' && currentPoint && (
          <StepDelivery
            pointType={currentPoint.point_type}
            customer={task.customer}
            onComplete={handleDeliveryComplete}
            isLastPoint={currentPointIndex + 1 >= totalPoints}
            finalPrice={task.final_price}
            dropoffToStorage={!!task.dropoff_to_storage && currentPointIndex + 1 >= totalPoints}
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
                  {REJECTION_REASONS.map((reason) => (
                    <button
                      key={reason.key}
                      onClick={() => setRejectReason(reason.key)}
                      className={`w-full p-4 rounded-xl text-right transition-colors ${
                        rejectReason === reason.key
                          ? 'bg-red-50 border-2 border-red-500 text-red-700'
                          : 'bg-gray-50 border-2 border-transparent text-gray-700'
                      }`}
                    >
                      {reason.icon} {reason.label}
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