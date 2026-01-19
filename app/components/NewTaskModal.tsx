'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  AlertCircle, 
  Clock, 
  Car, 
  Phone, 
  Navigation,
  CheckCircle2,
  MessageSquare,
  Loader2,
  X,
  Route
} from 'lucide-react'
import { DriverTask } from '@/app/lib/queries/driver-tasks'
import { 
  createRejectionRequest, 
  getPendingRejectionRequest,
  REJECTION_REASONS,
  RejectionReason 
} from '@/app/lib/queries/rejection-requests'
import { supabase } from '@/app/lib/supabase'

interface NewTaskModalProps {
  task: DriverTask
  driverId: string
  companyId: string
  hasActiveTask: boolean // האם יש משימה פעילה כרגע
  onClose: () => void
  onAccept: () => void
}

type ModalState = 'new_task' | 'reject_reason' | 'pending_approval'

export default function NewTaskModal({ 
  task, 
  driverId, 
  companyId,
  hasActiveTask, 
  onClose, 
  onAccept 
}: NewTaskModalProps) {
  const router = useRouter()
  const [modalState, setModalState] = useState<ModalState>('new_task')
  const [selectedReason, setSelectedReason] = useState<RejectionReason | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)

  // בדיקה אם יש כבר בקשת דחייה ממתינה
  useEffect(() => {
    checkPendingRequest()
  }, [task.id, driverId])

  const checkPendingRequest = async () => {
    const pending = await getPendingRejectionRequest(task.id, driverId)
    if (pending) {
      setHasPendingRequest(true)
      setModalState('pending_approval')
    }
  }

  // חילוץ כתובות מהמשימה
  const getAddresses = () => {
    if (task.points && task.points.length > 0) {
      const pickup = task.points.find(p => p.point_type === 'pickup')
      const dropoff = [...task.points].reverse().find(p => p.point_type === 'dropoff')
      return {
        pickup: {
          address: pickup?.address || 'לא צוין',
          contact: pickup?.contact_name || '',
          phone: pickup?.contact_phone || ''
        },
        dropoff: {
          address: dropoff?.address || 'לא צוין',
          contact: dropoff?.contact_name || '',
          phone: dropoff?.contact_phone || ''
        }
      }
    }
    
    // Fallback to legs
    const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
    const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
    return {
      pickup: {
        address: pickupLeg?.from_address || 'לא צוין',
        contact: task.customer?.name || '',
        phone: task.customer?.phone || ''
      },
      dropoff: {
        address: deliveryLeg?.to_address || 'לא צוין',
        contact: '',
        phone: ''
      }
    }
  }

  const addresses = getAddresses()

  const getVehicleInfo = () => {
    if (task.vehicles.length === 0) return { name: 'רכב', plate: '', color: '' }
    const v = task.vehicles[0]
    return {
      name: `${v.manufacturer || ''} ${v.model || ''}`.trim() || 'רכב',
      plate: v.plate_number || '',
      color: v.color || ''
    }
  }

  const vehicle = getVehicleInfo()

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--'
    return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }

  const openWaze = (address: string) => {
    window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, '_blank')
  }

  const openPhone = (phone: string) => {
    window.open(`tel:${phone}`, '_self')
  }

  // קבלת משימה
  const handleAccept = async () => {
    setIsProcessing(true)
    try {
      const newStatus = hasActiveTask ? 'assigned' : 'in_progress'
      
      const { error } = await supabase
        .from('tows')
        .update({ 
          status: newStatus,
          ...(newStatus === 'in_progress' ? { started_at: new Date().toISOString() } : {})
        })
        .eq('id', task.id)

      if (error) throw error

      onAccept()
      
      if (!hasActiveTask) {
        // אם אין משימה פעילה - עוברים ישירות למשימה
        router.push(`/driver/task/${task.id}`)
      } else {
        onClose()
      }
    } catch (err) {
      console.error('Error accepting task:', err)
      alert('שגיאה בקבלת המשימה')
    } finally {
      setIsProcessing(false)
    }
  }

  // שליחת בקשת דחייה
  const handleSubmitRejectRequest = async () => {
    if (!selectedReason) return
    setIsProcessing(true)
    
    try {
      await createRejectionRequest(
        task.id,
        driverId,
        companyId,
        selectedReason,
        rejectNote || undefined
      )
      
      setModalState('pending_approval')
      setHasPendingRequest(true)
    } catch (err) {
      console.error('Error creating rejection request:', err)
      alert('שגיאה בשליחת הבקשה')
    } finally {
      setIsProcessing(false)
    }
  }

  // ==================== New Task View ====================
  if (modalState === 'new_task') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" dir="rtl">
        <div className="bg-white w-full sm:max-w-md sm:mx-4 rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 text-center flex-shrink-0">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold">משימה חדשה!</h2>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto flex-1 min-h-0">
            {/* Time */}
            <div className="text-center mb-5">
              <div className="text-4xl font-bold text-gray-800">
                {formatTime(task.scheduled_at || task.created_at)}
              </div>
              <div className="text-gray-500">זמן מתוכנן</div>
            </div>

            {/* Quick Info */}
            <div className="flex gap-2 justify-center flex-wrap mb-5">
              <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium">
                <Route className="w-4 h-4" />
                {task.points?.length || 2} נקודות
              </span>
              <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-sm font-medium">
                <Car className="w-4 h-4" />
                {task.vehicles.length} רכב
              </span>
            </div>

            {/* Vehicle Card */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Car className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-800">{vehicle.name}</div>
                  <div className="text-sm text-gray-500">
                    {vehicle.plate}
                    {vehicle.color && ` • ${vehicle.color}`}
                  </div>
                </div>
              </div>
              {task.vehicles[0]?.tow_reason && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-sm text-gray-500">סיבת גרירה:</div>
                  <div className="text-sm font-medium text-gray-700">{task.vehicles[0].tow_reason}</div>
                </div>
              )}
            </div>

            {/* Route Points */}
            <div className="space-y-3 mb-4">
              {/* Pickup */}
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">1</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-emerald-700 mb-1">איסוף</div>
                    <div className="font-medium text-gray-800 mb-2">{addresses.pickup.address}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {addresses.pickup.phone && (
                        <button 
                          onClick={() => openPhone(addresses.pickup.phone)}
                          className="flex items-center gap-1.5 bg-white text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium border border-emerald-200"
                        >
                          <Phone className="w-4 h-4" />
                          {addresses.pickup.contact || 'התקשר'}
                        </button>
                      )}
                      <button 
                        onClick={() => openWaze(addresses.pickup.address)}
                        className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                      >
                        <Navigation className="w-4 h-4" />
                        נווט
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dropoff */}
              <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">2</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-red-700 mb-1">יעד</div>
                    <div className="font-medium text-gray-800 mb-2">{addresses.dropoff.address}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {addresses.dropoff.phone && (
                        <button 
                          onClick={() => openPhone(addresses.dropoff.phone)}
                          className="flex items-center gap-1.5 bg-white text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium border border-red-200"
                        >
                          <Phone className="w-4 h-4" />
                          {addresses.dropoff.contact || 'התקשר'}
                        </button>
                      )}
                      <button 
                        onClick={() => openWaze(addresses.dropoff.address)}
                        className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                      >
                        <Navigation className="w-4 h-4" />
                        נווט
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {task.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-amber-800 mb-1">הערות</div>
                    <p className="text-sm text-amber-700">{task.notes}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAccept}
                disabled={isProcessing}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors"
              >
                {isProcessing ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : hasActiveTask ? (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    קבל לתור
                  </>
                ) : (
                  <>
                    <Navigation className="w-6 h-6" />
                    קבל והתחל עכשיו
                  </>
                )}
              </button>
              <button
                onClick={() => setModalState('reject_reason')}
                disabled={isProcessing}
                className="w-full py-3 bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-medium text-base transition-colors"
              >
                בקש לדחות
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==================== Reject Reason View ====================
  if (modalState === 'reject_reason') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" dir="rtl">
        <div className="bg-white w-full sm:max-w-md sm:mx-4 rounded-t-3xl sm:rounded-2xl overflow-hidden h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white p-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setModalState('new_task')}
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="font-bold text-lg">בקשה לדחיית משימה</h3>
                <p className="text-white/70 text-sm">הבקשה תישלח למנהל לאישור</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-gray-600 mb-4">בחר את הסיבה לבקשת הדחייה:</p>
            
            <div className="space-y-2 mb-5">
              {REJECTION_REASONS.map((reason) => (
                <button
                  key={reason.key}
                  onClick={() => setSelectedReason(reason.key)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                    selectedReason === reason.key
                      ? 'bg-gray-100 border-2 border-gray-800'
                      : 'bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <span className="text-2xl">{reason.icon}</span>
                  <span className={`font-medium ${
                    selectedReason === reason.key ? 'text-gray-800' : 'text-gray-600'
                  }`}>
                    {reason.label}
                  </span>
                  {selectedReason === reason.key && (
                    <CheckCircle2 className="w-5 h-5 mr-auto text-gray-800" />
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
                placeholder="הסבר נוסף למנהל..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
              />
            </div>

            {/* Info Notice */}
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  הבקשה תישלח למנהל. עד לאישור, המשימה תישאר משויכת אליך.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex gap-3">
              <button
                onClick={() => setModalState('new_task')}
                disabled={isProcessing}
                className="flex-1 py-4 border-2 border-gray-200 bg-white text-gray-600 rounded-xl font-bold text-lg"
              >
                חזור
              </button>
              <button
                onClick={handleSubmitRejectRequest}
                disabled={isProcessing || !selectedReason}
                className="flex-1 py-4 bg-gray-800 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  'שלח בקשה'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==================== Pending Approval View ====================
  if (modalState === 'pending_approval') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" dir="rtl">
        <div className="bg-white w-full sm:max-w-md sm:mx-4 rounded-t-3xl sm:rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-6 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold">בקשה נשלחה</h2>
            <p className="text-amber-100 mt-1">ממתין לאישור המנהל</p>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <Car className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-800">{vehicle.name}</span>
                <span className="text-gray-400">{vehicle.plate}</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Navigation className="w-4 h-4 text-gray-400 mt-0.5" />
                <span>{addresses.pickup.address}</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <div className="font-medium text-amber-800 mb-1">שים לב</div>
                  <p className="text-sm text-amber-700">
                    המשימה עדיין משויכת אליך. אם המנהל לא יאשר את הדחייה, תצטרך לבצע אותה.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center text-sm text-gray-500">
              תקבל התראה כשהמנהל יגיב לבקשה
            </div>
          </div>

          {/* Action */}
          <div className="p-5 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="w-full py-4 bg-gray-800 text-white rounded-xl font-bold text-lg"
            >
              הבנתי
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}