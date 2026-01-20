'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/AuthContext'
import { 
  getTaskDetail, 
  updateTaskStatus,
  updatePointStatus,
  getCurrentPointIndex,
  areAllPointsCompleted,
  type TaskDetailFull,
  type DriverTaskPoint
} from '@/app/lib/queries/driver-tasks'
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react'

// קומפוננטות השלבים
import StepOnTheWay from './components/StepOnTheWay'
import StepCamera from './components/StepCamera'
import StepDelivery from './components/StepDelivery'
import StepComplete from './components/StepComplete'

// שלבים בכל נקודה
type PointStep = 'on_the_way' | 'camera' | 'delivery'

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

  // סיום צילום - עובר לשלב סיום (גם באיסוף וגם בפריקה)
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
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
    <div dir="rtl" className={`min-h-screen ${getBackgroundColor()} transition-colors duration-300`}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3">
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
          
          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>

      {/* תוכן לפי השלב */}
      {pointStep === 'on_the_way' && currentPoint && (
        <StepOnTheWay
          point={currentPoint}
          vehicle={task.vehicles[0]}
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
  )
}