'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../lib/AuthContext'
import { 
  getTaskDetail, 
  updateTaskStatusWithHistory, 
  updateLegStatus,
  uploadTowImage,
  deleteTowImage,
  type TaskDetailFull,
  type TowImage,
  type TowImageType
} from '../../../lib/queries/driver-tasks'
import { 
  ArrowRight,
  MapPin, 
  Clock, 
  Phone,
  Navigation,
  User,
  FileText,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  X,
  AlertCircle,
  Car,
  MessageSquare,
  MessageCircle,
  Map,
  ChevronDown,
  Loader2,
  Trash2
} from 'lucide-react'

// סטטוסים מפורטים של גרירה (flow)
const statusFlow = [
  { key: 'assigned', label: 'שויך', dbStatus: 'assigned' },
  { key: 'on_way_pickup', label: 'בדרך לאיסוף', dbStatus: 'in_progress' },
  { key: 'arrived_pickup', label: 'הגעתי לאיסוף', dbStatus: 'in_progress' },
  { key: 'on_way_dropoff', label: 'בדרך ליעד', dbStatus: 'in_progress' },
  { key: 'arrived_dropoff', label: 'הגעתי ליעד', dbStatus: 'in_progress' },
  { key: 'completed', label: 'הושלם', dbStatus: 'completed' },
]

const statusActions: Record<string, string> = {
  'assigned': 'יציאה לאיסוף',
  'on_way_pickup': 'הגעתי לאיסוף',
  'arrived_pickup': 'יציאה ליעד',
  'on_way_dropoff': 'הגעתי ליעד',
  'arrived_dropoff': 'סיום משימה',
}

// מיפוי סוגי תמונות
const photoTypes: { key: TowImageType; label: string; icon: string; color: string }[] = [
  { key: 'before_pickup', label: 'לפני טעינה', icon: '📷', color: 'bg-blue-100 text-blue-700' },
  { key: 'after_pickup', label: 'אחרי טעינה', icon: '📸', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'before_dropoff', label: 'לפני פריקה', icon: '🚗', color: 'bg-purple-100 text-purple-700' },
  { key: 'after_dropoff', label: 'אחרי פריקה', icon: '✅', color: 'bg-teal-100 text-teal-700' },
  { key: 'damage', label: 'נזק', icon: '⚠️', color: 'bg-red-100 text-red-700' },
  { key: 'other', label: 'אחר', icon: '📎', color: 'bg-gray-100 text-gray-700' },
]

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // States
  const [task, setTask] = useState<TaskDetailFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [currentFlowIndex, setCurrentFlowIndex] = useState(0)
  
  // Modals
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [showConfirmComplete, setShowConfirmComplete] = useState(false)
  const [showPhotoPreview, setShowPhotoPreview] = useState<TowImage | null>(null)
  
  // Photo upload states
  const [selectedPhotoType, setSelectedPhotoType] = useState<TowImageType | null>(null)
  const [photoNote, setPhotoNote] = useState('')
  const [uploadStep, setUploadStep] = useState<'type' | 'capture' | 'preview'>('type')
  const [capturedImage, setCapturedImage] = useState<File | null>(null)
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageQueue, setImageQueue] = useState<{file: File; url: string; type: TowImageType}[]>([])


  // Load task data
  useEffect(() => {
    if (id) {
      loadTask()
    }
  }, [id])

  // Determine flow index based on task status and legs
  useEffect(() => {
    if (task) {
      // חישוב אינדקס ה-flow לפי סטטוס וסטטוס הרגליים
      if (task.status === 'assigned') {
        setCurrentFlowIndex(0)
      } else if (task.status === 'completed') {
        setCurrentFlowIndex(5)
      } else if (task.status === 'in_progress') {
        // בודקים את הרגליים כדי לדעת איפה אנחנו
        const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
        const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
        
        if (deliveryLeg?.status === 'completed') {
          setCurrentFlowIndex(4) // הגעתי ליעד
        } else if (deliveryLeg?.status === 'in_progress') {
          setCurrentFlowIndex(3) // בדרך ליעד
        } else if (pickupLeg?.status === 'completed' || pickupLeg?.status === 'in_progress') {
          setCurrentFlowIndex(2) // הגעתי לאיסוף
        } else {
          setCurrentFlowIndex(1) // בדרך לאיסוף
        }
      }
    }
  }, [task])

  const loadTask = async () => {
    setLoading(true)
    try {
      const data = await getTaskDetail(id)
      setTask(data)
    } catch (error) {
      console.error('Error loading task:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async () => {
    if (!task || !user) return
    
    const nextIndex = currentFlowIndex + 1
    if (nextIndex >= statusFlow.length) return
    
    // אם זה סיום משימה - מראים מודל אישור
    if (nextIndex === 5) {
      setShowConfirmComplete(true)
      return
    }

    // בדיקת 4 תמונות לפני יציאה ליעד (מ-arrived_pickup ל-on_way_dropoff)
    if (currentFlowIndex === 2 && task.images.length < 4) {
      alert(`יש לצלם לפחות 4 תמונות לפני יציאה ליעד.\nכרגע יש ${task.images.length} תמונות.`)
      return
    }

    setUpdating(true)
    try {
      const nextStatus = statusFlow[nextIndex]
      
      // עדכון סטטוס רגל אם רלוונטי
      // עדכון סטטוס רגל אם רלוונטי
      if (nextIndex === 2) {
        // הגעתי לאיסוף - רגל pickup מתחילה
        const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
        if (pickupLeg) {
          await updateLegStatus(pickupLeg.id, 'in_progress')
        }
      } else if (nextIndex === 3) {
        // יציאה ליעד - רגל pickup הסתיימה, delivery מתחילה
        const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
        const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
        if (pickupLeg) await updateLegStatus(pickupLeg.id, 'completed')
        if (deliveryLeg) await updateLegStatus(deliveryLeg.id, 'in_progress')
      } else if (nextIndex === 4) {
        // הגעתי ליעד - delivery הסתיימה
        const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
        if (deliveryLeg) await updateLegStatus(deliveryLeg.id, 'completed')
      }
      
      // עדכון סטטוס הגרירה הראשי
      await updateTaskStatusWithHistory(
        task.id, 
        nextStatus.dbStatus, 
        user.id,
        undefined,
        statusFlow[nextIndex].label
      )
      
      setCurrentFlowIndex(nextIndex)
      await loadTask() // רענון הנתונים
    } catch (error) {
      console.error('Error updating status:', error)
      alert('שגיאה בעדכון הסטטוס')
    } finally {
      setUpdating(false)
    }
  }

  const handleComplete = async () => {
    if (!task || !user) return
    
    setUpdating(true)
    try {
      await updateTaskStatusWithHistory(task.id, 'completed', user.id, undefined, 'הושלם')
      setCurrentFlowIndex(6)
      setShowConfirmComplete(false)
      await loadTask()
    } catch (error) {
      console.error('Error completing task:', error)
      alert('שגיאה בסיום המשימה')
    } finally {
      setUpdating(false)
    }
  }

  // External apps
  const openWaze = (address: string) => {
    window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, '_blank')
  }

  const openPhone = (phone: string) => {
    window.open(`tel:${phone}`, '_self')
  }

  const openWhatsApp = (phone: string) => {
    const phoneClean = phone.replace(/^0/, '972').replace(/-/g, '')
    const vehicle = task?.vehicles[0]?.plate_number || ''
    const message = `שלום, אני הנהג מחברת הגרירות בקשר לרכב ${vehicle}.`
    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`, '_blank')
  }

  // Photo helpers
  const getPhotoTypeInfo = (type: TowImageType) => {
    return photoTypes.find(p => p.key === type) || photoTypes[5]
  }

  const handleOpenUpload = () => {
    setShowImageUpload(true)
    setUploadStep('type')
    setSelectedPhotoType(null)
    setPhotoNote('')
    setCapturedImage(null)
    setCapturedImageUrl(null)
  }

  const handleSelectPhotoType = (type: TowImageType) => {
    setSelectedPhotoType(type)
    setUploadStep('capture')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files
  if (!files || files.length === 0 || !selectedPhotoType) return

  // הוספת כל הקבצים לתור
  const newImages = Array.from(files).map(file => ({
    file,
    url: URL.createObjectURL(file),
    type: selectedPhotoType
  }))
  
  setImageQueue(prev => [...prev, ...newImages])
  setUploadStep('preview')
  
  // איפוס ה-input
  if (fileInputRef.current) fileInputRef.current.value = ''
}

const handleAddMorePhotos = () => {
  setUploadStep('type')
  setSelectedPhotoType(null)
}

const handleRemoveFromQueue = (index: number) => {
  setImageQueue(prev => {
    const newQueue = [...prev]
    URL.revokeObjectURL(newQueue[index].url)
    newQueue.splice(index, 1)
    return newQueue
  })
}

const handleSaveAllPhotos = async () => {
  if (imageQueue.length === 0 || !task || !user) return

  setUploadingImage(true)
  try {
    for (const img of imageQueue) {
      await uploadTowImage(
        task.id,
        user.id,
        img.type,
        img.file,
        undefined,
        task.vehicles[0]?.id
      )
    }
    
    // ניקוי התור
    imageQueue.forEach(img => URL.revokeObjectURL(img.url))
    setImageQueue([])
    
    await loadTask()
    handleCloseUpload()
  } catch (error) {
    console.error('Error uploading images:', error)
    alert('שגיאה בהעלאת התמונות')
  } finally {
    setUploadingImage(false)
  }
}

  // const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const files = e.target.files
  //   if (!files || files.length === 0) return

  //   // אם יש רק קובץ אחד - flow רגיל
  //   if (files.length === 1) {
  //     setCapturedImage(files[0])
  //     setCapturedImageUrl(URL.createObjectURL(files[0]))
  //     setUploadStep('preview')
  //     return
  //   }

  //   // אם יש מספר קבצים - העלאה ישירה
  //   if (!selectedPhotoType || !task || !user) return
    
  //   setUploadingImage(true)
  //   try {
  //     for (const file of Array.from(files)) {
  //       await uploadTowImage(
  //         task.id,
  //         user.id,
  //         selectedPhotoType,
  //         file,
  //         undefined,
  //         task.vehicles[0]?.id
  //       )
  //     }
  //     await loadTask()
  //     handleCloseUpload()
  //   } catch (error) {
  //     console.error('Error uploading images:', error)
  //     alert('שגיאה בהעלאת התמונות')
  //   } finally {
  //     setUploadingImage(false)
  //     // איפוס ה-input
  //     if (fileInputRef.current) fileInputRef.current.value = ''
  //   }
  // }

  const handleSavePhoto = async () => {
    if (!selectedPhotoType || !capturedImage || !task || !user) return

    setUploadingImage(true)
    try {
      await uploadTowImage(
        task.id,
        user.id,
        selectedPhotoType,
        capturedImage,
        photoNote || undefined,
        task.vehicles[0]?.id
      )
      
      await loadTask() // רענון התמונות
      handleCloseUpload()
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('שגיאה בהעלאת התמונה')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDeleteImage = async (image: TowImage) => {
    if (!confirm('למחוק את התמונה?')) return
    
    try {
      await deleteTowImage(image.id, image.image_url)
      await loadTask()
      setShowPhotoPreview(null)
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('שגיאה במחיקת התמונה')
    }
  }

  const handleBackInUpload = () => {
    if (uploadStep === 'capture') {
      setUploadStep('type')
      setSelectedPhotoType(null)
    } else if (uploadStep === 'preview') {
      setUploadStep('capture')
      setCapturedImage(null)
      setCapturedImageUrl(null)
    }
  }

  const handleCloseUpload = () => {
  setShowImageUpload(false)
  setSelectedPhotoType(null)
  setPhotoNote('')
  setCapturedImage(null)
  setCapturedImageUrl(null)
  setUploadStep('type')
  // ניקוי התור
  imageQueue.forEach(img => URL.revokeObjectURL(img.url))
  setImageQueue([])
}

  const getStatusColor = (index: number) => {
    if (index < currentFlowIndex) return 'bg-emerald-500 text-white'
    if (index === currentFlowIndex) return 'bg-[#33d4ff] text-white'
    return 'bg-gray-200 text-gray-400'
  }

  // Navigation conditions
  const showNavigationButton = task && ['assigned', 'in_progress'].includes(task.status) && currentFlowIndex < 6

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#33d4ff]" />
      </div>
    )
  }

  // Not found
  if (!task) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <AlertCircle size={48} className="text-gray-300 mb-4" />
        <p className="text-gray-500">המשימה לא נמצאה</p>
        <button 
          onClick={() => router.back()}
          className="mt-4 text-[#33d4ff] font-medium"
        >
          חזרה
        </button>
      </div>
    )
  }

  // Get addresses from legs
  const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
  const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
  const pickupAddress = pickupLeg?.from_address || 'לא צוין'
  const dropoffAddress = deliveryLeg?.to_address || pickupLeg?.to_address || 'לא צוין'
  
  // Calculate total distance
  const totalDistance = task.legs.reduce((sum, leg) => sum + (leg.distance_km || 0), 0)
  
  // Get first vehicle
  const vehicle = task.vehicles[0]

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-[60px] z-30">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowRight size={20} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-gray-800">פרטי משימה</h1>
            <p className="text-sm text-gray-500">#{task.id.slice(0, 8)}</p>
          </div>
          {task.status === 'assigned' && (
            <span className="bg-amber-100 text-amber-600 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
              <AlertCircle size={12} />
              ממתין
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Navigation Button */}
        {showNavigationButton && (
          <Link href={`/driver/navigation/${task.id}`}>
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-4 text-white shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Map size={24} />
                </div>
                <div>
                  <p className="font-bold text-lg">פתח ניווט</p>
                  <p className="text-white/80 text-sm">
                    {currentFlowIndex >= 4 ? 'נווט ליעד' : 'נווט לאיסוף'}
                  </p>
                </div>
              </div>
              <Navigation size={24} className="text-white/70" />
            </div>
          </Link>
        )}

        {/* Status Progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-bold text-gray-800 mb-4">סטטוס משימה</h2>
          <div className="relative">
            <div className="absolute top-4 right-4 left-4 h-0.5 bg-gray-200">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(currentFlowIndex / (statusFlow.length - 1)) * 100}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between relative">
              {statusFlow.slice(0, 5).map((status, index) => (
                <div key={status.key} className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${getStatusColor(index)}`}>
                    {index < currentFlowIndex ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <p className={`text-[10px] mt-1 text-center max-w-[50px] ${index <= currentFlowIndex ? 'text-gray-700' : 'text-gray-400'}`}>
                    {status.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Customer Info */}
        {task.customer && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <User size={24} className="text-gray-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{task.customer.name}</h3>
                  <p className="text-sm text-gray-500">
                    {task.customer.customer_type === 'business' ? 'לקוח עסקי' : 
                     task.customer.customer_type === 'insurance' ? 'ביטוח' :
                     task.customer.customer_type === 'fleet' ? 'צי רכב' : 'לקוח פרטי'}
                  </p>
                </div>
              </div>
              {task.customer.phone && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => openWhatsApp(task.customer!.phone!)}
                    className="p-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200"
                  >
                    <MessageCircle size={20} />
                  </button>
                  <button 
                    onClick={() => openPhone(task.customer!.phone!)}
                    className="p-3 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200"
                  >
                    <Phone size={20} />
                  </button>
                </div>
              )}
            </div>
            {task.customer.phone && (
              <p className="text-sm text-gray-600 font-mono">{task.customer.phone}</p>
            )}
          </div>
        )}

        {/* Vehicle Info */}
        {vehicle && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Car size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">פרטי רכב</h3>
                <p className="text-lg font-mono text-[#33d4ff]">{vehicle.plate_number}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">יצרן ודגם</p>
                <p className="font-medium text-gray-800">
                  {vehicle.manufacturer || '-'} {vehicle.model || ''}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">שנה</p>
                <p className="font-medium text-gray-800">{vehicle.year || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">צבע</p>
                <p className="font-medium text-gray-800">{vehicle.color || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">מצב</p>
                <p className="font-medium text-gray-800">
                  {vehicle.is_working ? 'נוסע' : 'לא נוסע'}
                </p>
              </div>
            </div>
            {vehicle.tow_reason && (
              <div className="mt-3 p-2 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-600">סיבת גרירה: {vehicle.tow_reason}</p>
              </div>
            )}
          </div>
        )}

        {/* Route */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-bold text-gray-800 mb-3">מסלול</h3>
          
          <div className="space-y-4">
            {/* Pickup */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                </div>
                <div className="w-0.5 h-full bg-gray-200 my-1"></div>
              </div>
              <div className="flex-1 pb-4">
                <p className="text-xs text-emerald-600 font-medium mb-1">נקודת איסוף</p>
                <p className="text-gray-800 font-medium">{pickupAddress}</p>
                <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => openWaze(pickupAddress)}
                    className="flex items-center gap-1.5 text-sm text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-lg"
                  >
                    <Navigation size={14} />
                    Waze
                  </button>
                </div>
              </div>
            </div>

            {/* Destination */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <MapPin size={16} className="text-red-500" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-red-600 font-medium mb-1">יעד</p>
                <p className="text-gray-800 font-medium">{dropoffAddress}</p>
                <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => openWaze(dropoffAddress)}
                    className="flex items-center gap-1.5 text-sm text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-lg"
                  >
                    <Navigation size={14} />
                    Waze
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Distance & Time */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-gray-600">
              <Navigation size={16} className="text-gray-400" />
              <span className="text-sm">{totalDistance.toFixed(1)} ק"מ</span>
            </div>
            {task.scheduled_at && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock size={16} className="text-gray-400" />
                <span className="text-sm">
                  מתוזמן: {new Date(task.scheduled_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {task.notes && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <MessageSquare size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 text-sm mb-1">הערות</p>
                <p className="text-amber-700 text-sm">{task.notes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Photos */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">תמונות</h3>
            <button 
              onClick={handleOpenUpload}
              className="flex items-center gap-1 text-[#33d4ff] text-sm font-medium"
            >
              <Camera size={16} />
              הוסף תמונה
            </button>
          </div>

          {task.images.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <ImageIcon size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">אין תמונות עדיין</p>
              <button 
                onClick={handleOpenUpload}
                className="mt-3 text-[#33d4ff] text-sm font-medium"
              >
                צלם או העלה תמונה
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {photoTypes.map(photoType => {
                const imagesOfType = task.images.filter(img => img.image_type === photoType.key)
                if (imagesOfType.length === 0) return null
                
                return (
                  <div key={photoType.key}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{photoType.icon}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${photoType.color}`}>
                        {photoType.label}
                      </span>
                      <span className="text-xs text-gray-400">({imagesOfType.length})</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {imagesOfType.map((img) => (
                        <button
                          key={img.id}
                          onClick={() => setShowPhotoPreview(img)}
                          className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group"
                        >
                          <img 
                            src={img.image_url} 
                            alt={photoType.label}
                            className="w-full h-full object-cover"
                          />
                          {img.notes && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate">
                              {img.notes}
                            </div>
                          )}
                          <div className="absolute top-1 right-1 text-[10px] bg-black/50 text-white px-1 rounded">
                            {new Date(img.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
              
              <button 
                onClick={handleOpenUpload}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 text-gray-500 hover:border-[#33d4ff] hover:text-[#33d4ff]"
              >
                <Camera size={18} />
                <span className="text-sm font-medium">הוסף תמונה נוספת</span>
              </button>
            </div>
          )}
        </div>

        {/* Price */}
        {task.final_price && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <FileText size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">מחיר גרירה</p>
                  <p className="font-bold text-lg text-gray-800">₪{task.final_price}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action */}
      {task.status !== 'completed' && currentFlowIndex < 6 && (
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <button
            onClick={handleStatusUpdate}
            disabled={updating}
            className="w-full py-4 bg-[#33d4ff] text-white rounded-xl font-bold text-lg hover:bg-[#21b8e6] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {updating ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={22} />
                {statusActions[statusFlow[currentFlowIndex].key]}
              </>
            )}
          </button>
        </div>
      )}

      {task.status === 'completed' && (
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="bg-emerald-100 text-emerald-700 rounded-xl py-4 text-center font-bold flex items-center justify-center gap-2">
            <CheckCircle2 size={22} />
            המשימה הושלמה בהצלחה
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Image Upload Modal */}
      {showImageUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                {uploadStep !== 'type' && imageQueue.length === 0 && (
                  <button onClick={handleBackInUpload} className="p-1">
                    <ArrowRight size={20} className="text-gray-500" />
                  </button>
                )}
                <h3 className="font-bold text-gray-800">
                  {uploadStep === 'type' && 'בחר סוג תמונה'}
                  {uploadStep === 'capture' && 'צלם תמונה'}
                  {uploadStep === 'preview' && `תמונות בתור (${imageQueue.length})`}
                </h3>
              </div>
              <button onClick={handleCloseUpload} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {uploadStep === 'type' && (
                <div className="p-4 space-y-2">
                  {/* הצגת תור קיים */}
                  {imageQueue.length > 0 && (
                    <div className="mb-4 p-3 bg-emerald-50 rounded-xl">
                      <p className="text-emerald-700 text-sm font-medium mb-2">
                        {imageQueue.length} תמונות בתור - בחר סוג להוספה נוספת
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {imageQueue.map((img, idx) => (
                          <div key={idx} className="relative flex-shrink-0">
                            <img src={img.url} className="w-16 h-16 object-cover rounded-lg" />
                            <button
                              onClick={() => handleRemoveFromQueue(idx)}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {photoTypes.map((type) => (
                    <button
                      key={type.key}
                      onClick={() => handleSelectPhotoType(type.key)}
                      className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 active:scale-[0.99]"
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${type.color}`}>
                        <span className="text-2xl">{type.icon}</span>
                      </div>
                      <div className="text-right flex-1">
                        <p className="font-medium text-gray-800">{type.label}</p>
                      </div>
                      <ChevronDown size={20} className="text-gray-400 -rotate-90" />
                    </button>
                  ))}
                  
                  {/* כפתור שמירה אם יש תמונות בתור */}
                  {imageQueue.length > 0 && (
                    <button
                      onClick={handleSaveAllPhotos}
                      disabled={uploadingImage}
                      className="w-full mt-4 py-4 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 size={20} />
                          שמור {imageQueue.length} תמונות
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {uploadStep === 'capture' && selectedPhotoType && (
                <div className="p-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 ${getPhotoTypeInfo(selectedPhotoType).color}`}>
                    <span>{getPhotoTypeInfo(selectedPhotoType).icon}</span>
                    <span className="text-sm font-medium">{getPhotoTypeInfo(selectedPhotoType).label}</span>
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100"
                    >
                      <div className="w-12 h-12 bg-[#33d4ff] rounded-full flex items-center justify-center">
                        <Camera size={24} className="text-white" />
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-800">צלם / בחר תמונות</p>
                        <p className="text-sm text-gray-500">ניתן לבחור מספר תמונות</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {uploadStep === 'preview' && imageQueue.length > 0 && (
                <div className="p-4">
                  <p className="text-gray-600 mb-3">{imageQueue.length} תמונות מוכנות להעלאה</p>
                  
                  {/* גריד תמונות */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {imageQueue.map((img, idx) => (
                      <div key={idx} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                        <img src={img.url} className="w-full h-full object-cover" />
                        <div className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full ${getPhotoTypeInfo(img.type).color}`}>
                          {getPhotoTypeInfo(img.type).icon} {getPhotoTypeInfo(img.type).label}
                        </div>
                        <button
                          onClick={() => handleRemoveFromQueue(idx)}
                          className="absolute top-2 left-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleAddMorePhotos}
                      className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <Camera size={18} />
                      צלם עוד
                    </button>
                    <button
                      onClick={handleSaveAllPhotos}
                      disabled={uploadingImage}
                      className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 size={18} />
                          שמור הכל
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {showPhotoPreview && (
        <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
          <div className="flex items-center justify-between p-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${getPhotoTypeInfo(showPhotoPreview.image_type).color}`}>
              <span>{getPhotoTypeInfo(showPhotoPreview.image_type).icon}</span>
              <span className="text-sm font-medium">{getPhotoTypeInfo(showPhotoPreview.image_type).label}</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleDeleteImage(showPhotoPreview)}
                className="p-2 text-red-400 hover:text-red-300"
              >
                <Trash2 size={20} />
              </button>
              <button onClick={() => setShowPhotoPreview(null)} className="p-2 text-white">
                <X size={24} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4">
            <img 
              src={showPhotoPreview.image_url} 
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-xl"
            />
          </div>

          {showPhotoPreview.notes && (
            <div className="p-4 bg-black/50">
              <p className="text-white text-center">{showPhotoPreview.notes}</p>
            </div>
          )}

          <div className="p-4 text-center text-gray-400 text-sm">
            {new Date(showPhotoPreview.created_at).toLocaleString('he-IL')}
          </div>
        </div>
      )}

      {/* Confirm Complete Modal */}
      {showConfirmComplete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">סיום משימה</h3>
              <p className="text-gray-600">האם אתה בטוח שסיימת את המשימה?</p>
              <p className="text-sm text-gray-500 mt-2">ודא שהעלית את כל התמונות הנדרשות</p>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowConfirmComplete(false)}
                className="flex-1 py-3 border border-gray-200 bg-white text-gray-600 rounded-xl font-medium"
              >
                חזור
              </button>
              <button
                onClick={handleComplete}
                disabled={updating}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center"
              >
                {updating ? <Loader2 size={20} className="animate-spin" /> : 'סיום'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}