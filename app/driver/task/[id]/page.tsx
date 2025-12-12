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
  Loader2,
  Trash2,
  Check
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

// רק 2 סוגי תמונות
const photoCategories = {
  before_pickup: { label: 'תמונות באיסוף', icon: '📷', color: 'bg-blue-100 text-blue-700' },
  at_destination: { label: 'תמונות ביעד', icon: '📸', color: 'bg-emerald-100 text-emerald-700' },
}

// פונקציית compression לתמונות - מקטינה את גודל הקובץ
async function compressImage(file: File, maxSizeMB: number = 1): Promise<File> {
  return new Promise((resolve, reject) => {
    // אם הקובץ כבר קטן מספיק, מחזירים אותו כמו שהוא
    if (file.size <= maxSizeMB * 1024 * 1024) {
      console.log(`Image already small enough: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
      resolve(file)
      return
    }

    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      // חישוב גודל חדש - מקסימום 1920px
      let { width, height } = img
      const maxDimension = 1920

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension
          width = maxDimension
        } else {
          width = (width / height) * maxDimension
          height = maxDimension
        }
      }

      canvas.width = width
      canvas.height = height

      // ציור התמונה על הקנבס
      ctx?.drawImage(img, 0, 0, width, height)

      // המרה ל-blob עם quality נמוך יותר
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            console.log(`Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
            resolve(compressedFile)
          } else {
            reject(new Error('Failed to compress image'))
          }
        },
        'image/jpeg',
        0.7 // quality 70%
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const userRef = useRef(user) // שמירת user ב-ref
  const taskRef = useRef<TaskDetailFull | null>(null) // שמירת task ב-ref
  
  // States
  const [task, setTask] = useState<TaskDetailFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [currentFlowIndex, setCurrentFlowIndex] = useState(0)
  
  // Modals
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [showConfirmComplete, setShowConfirmComplete] = useState(false)
  const [showPhotoPreview, setShowPhotoPreview] = useState<TowImage | null>(null)
  
  // Photo upload states - NEW FLOW
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showQuickConfirm, setShowQuickConfirm] = useState(false) // אישור מהיר אחרי צילום
  const [photosInSession, setPhotosInSession] = useState(0) // כמה תמונות צולמו בסשן הנוכחי
  const [showSummary, setShowSummary] = useState(false) // מודל סיכום אחרי 4 תמונות
  const [imageQueue, setImageQueue] = useState<{file: File; url: string}[]>([])
  const [showImageModal, setShowImageModal] = useState(false)

  // עדכון ה-refs כשהם משתנים
  useEffect(() => {
    if (user) {
      userRef.current = user
    }
  }, [user])

  // עדכון taskRef כשה-task משתנה
  useEffect(() => {
    if (task) {
      taskRef.current = task
    }
  }, [task])

  // Load task data
  useEffect(() => {
    if (id) {
      loadTask()
    }
  }, [id])

  // Determine flow index based on task status and legs
  useEffect(() => {
    if (task) {
      if (task.status === 'assigned') {
        setCurrentFlowIndex(0)
      } else if (task.status === 'completed') {
        setCurrentFlowIndex(5)
      } else if (task.status === 'in_progress') {
        const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
        const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
        
        if (deliveryLeg?.status === 'completed') {
          setCurrentFlowIndex(4)
        } else if (deliveryLeg?.status === 'in_progress') {
          setCurrentFlowIndex(3)
        } else if (pickupLeg?.status === 'completed' || pickupLeg?.status === 'in_progress') {
          setCurrentFlowIndex(2)
        } else {
          setCurrentFlowIndex(1)
        }
      }
    }
  }, [task])

  const loadTask = async () => {
    setLoading(true)
    try {
      const data = await getTaskDetail(id)
      console.log('=== Task loaded ===')
      console.log('Total images:', data?.images?.length)
      console.log('All images:', data?.images)
      
      // ספירה ידנית
      const pickupCount = data?.images?.filter(img => img.image_type === 'before_pickup').length || 0
      const destCount = data?.images?.filter(img => img.image_type === 'after_pickup').length || 0
      console.log('Pickup photos (before_pickup):', pickupCount)
      console.log('Destination photos (after_pickup):', destCount)
      
      // בדיקה אם יש image_types אחרים
      const types = data?.images?.map(img => img.image_type) || []
      console.log('All image types:', [...new Set(types)])
      
      setTask(data)
      taskRef.current = data // שמירה ב-ref
    } catch (error) {
      console.error('Error loading task:', error)
    } finally {
      setLoading(false)
    }
  }

  // רענון בלי loading - לשימוש אחרי העלאת תמונות
  const refreshTask = async () => {
    try {
      const data = await getTaskDetail(id)
      console.log('=== Task refreshed ===')
      console.log('Total images:', data?.images?.length)
      setTask(data)
      taskRef.current = data
    } catch (error) {
      console.error('Error refreshing task:', error)
    }
  }

  // קביעה אוטומטית של סוג התמונה לפי השלב
  const getCurrentPhotoType = (): TowImageType => {
    if (currentFlowIndex <= 2) {
      return 'before_pickup'
    }
    return 'after_pickup' // נשתמש ב-after_pickup בתור "תמונות ביעד"
  }

  // ספירת תמונות לפי קטגוריה - משתמשים גם ב-ref כ-fallback
  const getPickupPhotosCount = () => {
    const currentTask = task || taskRef.current
    if (!currentTask) return 0
    return currentTask.images.filter(img => img.image_type === 'before_pickup').length
  }

  const getDestinationPhotosCount = () => {
    const currentTask = task || taskRef.current
    if (!currentTask) return 0
    return currentTask.images.filter(img => img.image_type === 'after_pickup').length
  }

  // בדיקה כמה תמונות חסרות בשלב הנוכחי
  const getMissingPhotosCount = () => {
    if (currentFlowIndex <= 2) {
      return Math.max(0, 4 - getPickupPhotosCount())
    }
    return Math.max(0, 4 - getDestinationPhotosCount())
  }

  const handleStatusUpdate = async () => {
    if (!task || !user) return
    
    const nextIndex = currentFlowIndex + 1
    if (nextIndex >= statusFlow.length) return
    
    // DEBUG
    console.log('=== handleStatusUpdate ===')
    console.log('currentFlowIndex:', currentFlowIndex)
    console.log('nextIndex:', nextIndex)
    console.log('task.images:', task.images)
    console.log('getPickupPhotosCount():', getPickupPhotosCount())
    console.log('getDestinationPhotosCount():', getDestinationPhotosCount())
    
    // אם זה סיום משימה - מראים מודל אישור
    if (nextIndex === 5) {
      // בדיקת 4 תמונות ביעד לפני סיום
      if (getDestinationPhotosCount() < 4) {
        alert(`יש לצלם לפחות 4 תמונות ביעד לפני סיום.\nכרגע יש ${getDestinationPhotosCount()} תמונות.`)
        return
      }
      setShowConfirmComplete(true)
      return
    }

    // בדיקת 4 תמונות באיסוף לפני יציאה ליעד (מ-arrived_pickup ל-on_way_dropoff)
    if (currentFlowIndex === 2 && getPickupPhotosCount() < 4) {
      console.log('BLOCKED: Not enough pickup photos')
      alert(`יש לצלם לפחות 4 תמונות באיסוף לפני יציאה ליעד.\nכרגע יש ${getPickupPhotosCount()} תמונות.`)
      return
    }

    setUpdating(true)
    try {
      const nextStatus = statusFlow[nextIndex]
      
      if (nextIndex === 2) {
        const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
        if (pickupLeg) {
          await updateLegStatus(pickupLeg.id, 'in_progress')
        }
      } else if (nextIndex === 3) {
        const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
        const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
        if (pickupLeg) await updateLegStatus(pickupLeg.id, 'completed')
        if (deliveryLeg) await updateLegStatus(deliveryLeg.id, 'in_progress')
      } else if (nextIndex === 4) {
        const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
        if (deliveryLeg) await updateLegStatus(deliveryLeg.id, 'completed')
      }
      
      await updateTaskStatusWithHistory(
        task.id, 
        nextStatus.dbStatus, 
        user.id,
        undefined,
        statusFlow[nextIndex].label
      )
      
      setCurrentFlowIndex(nextIndex)
      await loadTask()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('שגיאה בעדכון הסטטוס')
    } finally {
      setUpdating(false)
    }
  }

  const handleComplete = async () => {
    if (!task || !user) return
    
    // בדיקה נוספת של תמונות ביעד
    if (getDestinationPhotosCount() < 4) {
      alert(`יש לצלם לפחות 4 תמונות ביעד לפני סיום.\nכרגע יש ${getDestinationPhotosCount()} תמונות.`)
      setShowConfirmComplete(false)
      return
    }
    
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

  // ===== NEW PHOTO FLOW =====
  // צילום 4 תמונות קודם, העלאה רק בסוף
  
  // פתיחת צילום
  const handleOpenCamera = () => {
    setImageQueue([])
    setPhotosInSession(0)
    setShowImageModal(true)
    // פותח מצלמה אחרי שהמודל נפתח
    setTimeout(() => fileInputRef.current?.click(), 100)
  }

 // כשבוחרים/מצלמים תמונה - שומרים ב-queue
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // הוספה ל-queue
    const newImages = Array.from(files).map(file => ({
      file,
      url: URL.createObjectURL(file)
    }))
    
    const updatedQueue = [...imageQueue, ...newImages]
    setImageQueue(updatedQueue)
    setPhotosInSession(updatedQueue.length)
    
    // ניקוי ה-input
    if (fileInputRef.current) fileInputRef.current.value = ''
    
    // אם יש 4 תמונות - מעלים אוטומטית
    if (updatedQueue.length >= 4) {
      // מעלים ישר בלי להציג מודל
      await handleSaveAllPhotosAuto(updatedQueue)
    } else {
      // פותח מצלמה שוב מיד (בלי delay!)
      setTimeout(() => fileInputRef.current?.click(), 50)
    }
  }

  // העלאה אוטומטית אחרי 4 תמונות
  const handleSaveAllPhotosAuto = async (queue: {file: File; url: string}[]) => {
    const currentTask = task || taskRef.current
    const currentUser = user || userRef.current
    
    if (!currentTask || !currentUser) {
      alert('שגיאה: נסה לרענן את הדף')
      return
    }

    setUploadingImage(true)
    const photoType = getCurrentPhotoType()
    
    try {
      const uploadPromises = queue.map(async (img) => {
        const compressedFile = await compressImage(img.file, 1)
        return await uploadTowImage(
          currentTask.id,
          currentUser.id,
          photoType,
          compressedFile,
          undefined,
          currentTask.vehicles[0]?.id
        )
      })
      
      await Promise.all(uploadPromises)
      
      // ניקוי
      queue.forEach(img => URL.revokeObjectURL(img.url))
      setImageQueue([])
      setPhotosInSession(0)
      setShowImageModal(false)
      
      // רענון בלי loading
      await refreshTask()
      
      setShowSummary(true)
      
    } catch (error) {
      console.error('Error uploading images:', error)
      alert(`שגיאה בהעלאת התמונות: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploadingImage(false)
    }
  }

  // הסרת תמונה מה-queue
  const handleRemoveFromQueue = (index: number) => {
    setImageQueue(prev => {
      const newQueue = [...prev]
      URL.revokeObjectURL(newQueue[index].url)
      newQueue.splice(index, 1)
      return newQueue
    })
    setPhotosInSession(prev => prev - 1)
  }

  // העלאת כל התמונות
  const handleSaveAllPhotos = async () => {
    if (imageQueue.length === 0) return
    
    // נשתמש ב-refs כ-fallback
    const currentTask = task || taskRef.current
    const currentUser = user || userRef.current
    
    if (!currentTask) {
      alert('שגיאה: לא נמצאה משימה. נסה לרענן את הדף.')
      return
    }
    
    if (!currentUser) {
      alert('שגיאה: לא נמצא משתמש. הדף יתרענן עכשיו.')
      window.location.reload()
      return
    }

    setUploadingImage(true)
    const photoType = getCurrentPhotoType()
    
    try {
      // העלאה במקביל - הרבה יותר מהיר!
      const uploadPromises = imageQueue.map(async (img) => {
        console.log(`Compressing: ${img.file.name}`)
        const compressedFile = await compressImage(img.file, 1)
        
        console.log('Uploading to Supabase...')
        const result = await uploadTowImage(
          currentTask.id,
          currentUser.id,
          photoType,
          compressedFile,
          undefined,
          currentTask.vehicles[0]?.id
        )
        console.log('Upload successful!')
        return result
      })
      
      const uploadedImages = await Promise.all(uploadPromises)
      console.log('All uploads completed:', uploadedImages)
      

      // ניקוי
      imageQueue.forEach(img => URL.revokeObjectURL(img.url))
      setImageQueue([])
      setPhotosInSession(0)
      setShowImageModal(false)
      
      // טעינה מחדש מה-DB - מבטיח סנכרון מלא
      await refreshTask()
      
      setShowSummary(true)
      
    } catch (error) {
      console.error('Error uploading images:', error)
      alert(`שגיאה בהעלאת התמונות: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploadingImage(false)
    }
  }

  // סגירת המודל
  const handleCloseImageModal = () => {
    imageQueue.forEach(img => URL.revokeObjectURL(img.url))
    setImageQueue([])
    setPhotosInSession(0)
    setShowImageModal(false)
  }

  const handleDeleteImage = async (image: TowImage) => {
    if (!confirm('למחוק את התמונה?')) return
    
    try {
      await deleteTowImage(image.id, image.image_url)
      await refreshTask()
      setShowPhotoPreview(null)
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('שגיאה במחיקת התמונה')
    }
  }

  const handleCloseSummary = () => {
    setShowSummary(false)
    setPhotosInSession(0)
  }

  const getStatusColor = (index: number) => {
    if (index < currentFlowIndex) return 'bg-emerald-500 text-white'
    if (index === currentFlowIndex) return 'bg-[#33d4ff] text-white'
    return 'bg-gray-200 text-gray-400'
  }

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
  const totalDistance = task.legs.reduce((sum, leg) => sum + (leg.distance_km || 0), 0)
  const vehicle = task.vehicles[0]

  // חלוקת תמונות ל-2 קטגוריות
  const pickupImages = task.images.filter(img => img.image_type === 'before_pickup')
  const destinationImages = task.images.filter(img => img.image_type === 'after_pickup')

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

        {/* Photos - רק 2 קטגוריות */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">תמונות</h3>
            <button 
              onClick={handleOpenCamera}
              disabled={uploadingImage}
              className="flex items-center gap-1 text-[#33d4ff] text-sm font-medium disabled:opacity-50"
            >
              {uploadingImage ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Camera size={16} />
              )}
              הוסף תמונה
            </button>
          </div>

          {task.images.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <ImageIcon size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">אין תמונות עדיין</p>
              <button 
                onClick={handleOpenCamera}
                disabled={uploadingImage}
                className="mt-3 text-[#33d4ff] text-sm font-medium disabled:opacity-50"
              >
                {uploadingImage ? 'מעלה...' : 'צלם או העלה תמונה'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* תמונות באיסוף */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📷</span>
                    <span className="text-sm font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      תמונות באיסוף
                    </span>
                    <span className="text-xs text-gray-400">({pickupImages.length}/4)</span>
                  </div>
                  {pickupImages.length >= 4 && (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  )}
                </div>
                {pickupImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {pickupImages.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => setShowPhotoPreview(img)}
                        className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden"
                      >
                        <img 
                          src={img.image_url} 
                          alt="תמונה באיסוף"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">לא צולמו עדיין</p>
                )}
              </div>

              {/* תמונות ביעד */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📸</span>
                    <span className="text-sm font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      תמונות ביעד
                    </span>
                    <span className="text-xs text-gray-400">({destinationImages.length}/4)</span>
                  </div>
                  {destinationImages.length >= 4 && (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  )}
                </div>
                {destinationImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {destinationImages.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => setShowPhotoPreview(img)}
                        className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden"
                      >
                        <img 
                          src={img.image_url} 
                          alt="תמונה ביעד"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">לא צולמו עדיין</p>
                )}
              </div>
              
              {/* כפתור הוספה */}
              <button 
                onClick={handleOpenCamera}
                disabled={uploadingImage}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 text-gray-500 hover:border-[#33d4ff] hover:text-[#33d4ff] disabled:opacity-50"
              >
                {uploadingImage ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Camera size={18} />
                )}
                <span className="text-sm font-medium">
                  {uploadingImage ? 'מעלה תמונה...' : 
                   currentFlowIndex <= 2 ? `צלם תמונות באיסוף (${4 - pickupImages.length} נותרו)` : 
                   `צלם תמונות ביעד (${4 - destinationImages.length} נותרו)`}
                </span>
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

      {/* Hidden file input - without capture for better compatibility */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Quick Confirm Toast - אישור מהיר אחרי צילום */}
      {showQuickConfirm && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-pulse">
            <Check size={24} />
            <span className="font-bold">צולם! ({photosInSession}/4)</span>
          </div>
        </div>
      )}

      {/* Image Queue Modal - מודל לצילום תמונות */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-gray-800">
                  {currentFlowIndex <= 2 ? '📷 תמונות באיסוף' : '📸 תמונות ביעד'}
                </h3>
                <span className="bg-[#33d4ff] text-white text-xs px-2 py-1 rounded-full">
                  {imageQueue.length}/4
                </span>
              </div>
              <button onClick={handleCloseImageModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {imageQueue.length === 0 ? (
                <div className="text-center py-8">
                  <Camera size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">לחץ לצילום תמונות</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-[#33d4ff] text-white rounded-xl font-medium"
                  >
                    צלם תמונה
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-gray-600 mb-3">{imageQueue.length} תמונות מוכנות להעלאה</p>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {imageQueue.map((img, idx) => (
                      <div key={idx} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                        <img src={img.url} className="w-full h-full object-cover" />
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
                      onClick={() => fileInputRef.current?.click()}
                      disabled={imageQueue.length >= 4}
                      className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Camera size={18} />
                      צלם עוד ({4 - imageQueue.length})
                    </button>
                    <button
                      onClick={handleSaveAllPhotos}
                      disabled={uploadingImage || imageQueue.length === 0}
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Uploading Overlay */}
      {uploadingImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
            <Loader2 size={40} className="animate-spin text-[#33d4ff]" />
            <p className="font-medium text-gray-700">מעלה {imageQueue.length} תמונות...</p>
          </div>
        </div>
      )}

      {/* Summary Modal - אחרי 4 תמונות */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {currentFlowIndex <= 2 ? '📷 תמונות האיסוף הושלמו!' : '📸 תמונות היעד הושלמו!'}
              </h3>
              <p className="text-gray-600">
                {currentFlowIndex <= 2 
                  ? `צולמו ${getPickupPhotosCount()} תמונות באיסוף`
                  : `צולמו ${getDestinationPhotosCount()} תמונות ביעד`}
              </p>
              
              {/* תצוגה מקדימה של התמונות */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                {(currentFlowIndex <= 2 ? pickupImages : destinationImages).slice(-4).map((img) => (
                  <div key={img.id} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <img src={img.image_url} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleCloseSummary}
                className="w-full py-3 bg-[#33d4ff] text-white rounded-xl font-bold"
              >
                אישור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {showPhotoPreview && (
        <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
          <div className="flex items-center justify-between p-4">
            <div className="text-white text-sm">
              {showPhotoPreview.image_type === 'before_pickup' 
                ? '📷 תמונה באיסוף' 
                : '📸 תמונה ביעד'}
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
              
              {/* סטטוס תמונות */}
              <div className="mt-4 space-y-2 text-sm">
                <div className={`flex items-center justify-between p-2 rounded-lg ${getPickupPhotosCount() >= 4 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  <span>תמונות באיסוף</span>
                  <span className={getPickupPhotosCount() >= 4 ? 'text-emerald-600' : 'text-amber-600'}>
                    {getPickupPhotosCount()}/4 {getPickupPhotosCount() >= 4 ? '✓' : ''}
                  </span>
                </div>
                <div className={`flex items-center justify-between p-2 rounded-lg ${getDestinationPhotosCount() >= 4 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  <span>תמונות ביעד</span>
                  <span className={getDestinationPhotosCount() >= 4 ? 'text-emerald-600' : 'text-amber-600'}>
                    {getDestinationPhotosCount()}/4 {getDestinationPhotosCount() >= 4 ? '✓' : ''}
                  </span>
                </div>
              </div>
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