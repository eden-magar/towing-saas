'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowRight,
  MapPin, 
  Clock, 
  Phone,
  Navigation,
  Truck,
  User,
  FileText,
  Camera,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  X,
  AlertCircle,
  Car,
  MessageSquare,
  MessageCircle,
  Map,
  ChevronDown
} from 'lucide-react'

interface TaskDetail {
  id: number
  status: 'pending' | 'accepted' | 'on_way' | 'arrived' | 'loading' | 'in_transit' | 'arrived_destination' | 'completed'
  customer: string
  customerPhone: string
  customerType: 'private' | 'business'
  vehicle: string
  vehicleInfo: {
    manufacturer: string
    model: string
    year: number
    color: string
    type: string
  }
  from: string
  to: string
  scheduledTime: string
  distance: string
  estimatedDuration: string
  notes?: string
  isUrgent?: boolean
  towType: 'simple' | 'with_base' | 'transfer'
  price: number
  images: TaskImage[]
}

interface TaskImage {
  id: number
  url: string
  type: PhotoType
  note?: string
  timestamp: string
}

type PhotoType = 'before_loading' | 'after_loading' | 'before_unloading' | 'after_unloading' | 'damage' | 'other'

const photoTypes: { key: PhotoType; label: string; icon: string; color: string }[] = [
  { key: 'before_loading', label: 'לפני טעינה', icon: '📷', color: 'bg-blue-100 text-blue-700' },
  { key: 'after_loading', label: 'אחרי טעינה', icon: '📸', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'before_unloading', label: 'לפני פריקה', icon: '🚗', color: 'bg-purple-100 text-purple-700' },
  { key: 'after_unloading', label: 'אחרי פריקה', icon: '✅', color: 'bg-teal-100 text-teal-700' },
  { key: 'damage', label: 'נזק', icon: '⚠️', color: 'bg-red-100 text-red-700' },
  { key: 'other', label: 'אחר', icon: '📎', color: 'bg-gray-100 text-gray-700' },
]

const statusFlow = [
  { key: 'pending', label: 'ממתין', action: 'קבל משימה' },
  { key: 'accepted', label: 'התקבל', action: 'יציאה לאיסוף' },
  { key: 'on_way', label: 'בדרך לאיסוף', action: 'הגעתי לאיסוף' },
  { key: 'arrived', label: 'הגעתי לאיסוף', action: 'התחל טעינה' },
  { key: 'loading', label: 'טוען', action: 'סיימתי טעינה' },
  { key: 'in_transit', label: 'בדרך ליעד', action: 'הגעתי ליעד' },
  { key: 'arrived_destination', label: 'הגעתי ליעד', action: 'סיום משימה' },
  { key: 'completed', label: 'הושלם', action: null },
]

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [showConfirmComplete, setShowConfirmComplete] = useState(false)
  const [showPhotoPreview, setShowPhotoPreview] = useState<TaskImage | null>(null)
  
  // Photo upload states
  const [selectedPhotoType, setSelectedPhotoType] = useState<PhotoType | null>(null)
  const [photoNote, setPhotoNote] = useState('')
  const [uploadStep, setUploadStep] = useState<'type' | 'capture' | 'preview'>('type')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)

  const [task, setTask] = useState<TaskDetail>({
    id: parseInt(id),
    status: 'on_way',
    customer: 'יוסי כהן',
    customerPhone: '050-1234567',
    customerType: 'private',
    vehicle: '12-345-67',
    vehicleInfo: {
      manufacturer: 'טויוטה',
      model: 'קורולה',
      year: 2020,
      color: 'לבן',
      type: 'רכב פרטי'
    },
    from: 'רחוב הרצל 50, תל אביב',
    to: 'רחוב ויצמן 12, רמת גן',
    scheduledTime: '09:00',
    distance: '8.5 ק"מ',
    estimatedDuration: '25 דקות',
    notes: 'הלקוח מחכה ליד הרכב. הרכב לא מניע - בעיה במצבר.',
    isUrgent: true,
    towType: 'simple',
    price: 350,
    images: []
  })

  const currentStatusIndex = statusFlow.findIndex(s => s.key === task.status)
  const nextStatus = statusFlow[currentStatusIndex + 1]

  const handleStatusUpdate = () => {
    if (nextStatus) {
      if (nextStatus.key === 'completed') {
        setShowConfirmComplete(true)
      } else {
        setTask({ ...task, status: nextStatus.key as TaskDetail['status'] })
      }
    }
  }

  const handleComplete = () => {
    setTask({ ...task, status: 'completed' })
    setShowConfirmComplete(false)
  }

  const openWaze = (address: string) => {
    const encoded = encodeURIComponent(address)
    window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, '_blank')
  }

  const openPhone = (phone: string) => {
    window.open(`tel:${phone}`, '_self')
  }

  const openWhatsApp = (phone: string, message?: string) => {
    const phoneClean = phone.replace(/^0/, '972').replace(/-/g, '')
    const defaultMessage = `שלום, אני הנהג מחברת הגרירות בקשר לרכב ${task.vehicle}.`
    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(message || defaultMessage)}`, '_blank')
  }

  const getStatusColor = (status: string, index: number) => {
    if (index < currentStatusIndex) return 'bg-emerald-500 text-white'
    if (index === currentStatusIndex) return 'bg-[#33d4ff] text-white'
    return 'bg-gray-200 text-gray-400'
  }

  const showNavigationButton = ['accepted', 'on_way', 'in_transit'].includes(task.status)

  const getPhotoTypeInfo = (type: PhotoType) => {
    return photoTypes.find(p => p.key === type) || photoTypes[5]
  }

  // Photo upload handlers
  const handleOpenUpload = () => {
    setShowImageUpload(true)
    setUploadStep('type')
    setSelectedPhotoType(null)
    setPhotoNote('')
    setCapturedImage(null)
  }

  const handleSelectPhotoType = (type: PhotoType) => {
    setSelectedPhotoType(type)
    setUploadStep('capture')
  }

  const handleCapturePhoto = (source: 'camera' | 'gallery') => {
    // Simulate photo capture - in production, use actual camera/file input
    setCapturedImage('/placeholder-car.jpg')
    setUploadStep('preview')
  }

  const handleSavePhoto = () => {
    if (!selectedPhotoType || !capturedImage) return

    const newImage: TaskImage = {
      id: Date.now(),
      url: capturedImage,
      type: selectedPhotoType,
      note: photoNote || undefined,
      timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    }

    setTask({
      ...task,
      images: [...task.images, newImage]
    })

    setShowImageUpload(false)
    setSelectedPhotoType(null)
    setPhotoNote('')
    setCapturedImage(null)
    setUploadStep('type')
  }

  const handleBackInUpload = () => {
    if (uploadStep === 'capture') {
      setUploadStep('type')
      setSelectedPhotoType(null)
    } else if (uploadStep === 'preview') {
      setUploadStep('capture')
      setCapturedImage(null)
    }
  }

  const handleCloseUpload = () => {
    setShowImageUpload(false)
    setSelectedPhotoType(null)
    setPhotoNote('')
    setCapturedImage(null)
    setUploadStep('type')
  }

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
            <p className="text-sm text-gray-500">הזמנה #{task.id}</p>
          </div>
          {task.isUrgent && (
            <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
              <AlertCircle size={12} />
              דחוף
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Navigation Button - Prominent */}
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
                    {task.status === 'in_transit' ? 'נווט ליעד' : 'נווט לאיסוף'}
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
                style={{ width: `${(currentStatusIndex / (statusFlow.length - 1)) * 100}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between relative">
              {statusFlow.slice(0, 5).map((status, index) => (
                <div key={status.key} className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${getStatusColor(status.key, index)}`}>
                    {index < currentStatusIndex ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <p className={`text-[10px] mt-1 text-center max-w-[50px] ${index <= currentStatusIndex ? 'text-gray-700' : 'text-gray-400'}`}>
                    {status.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <User size={24} className="text-gray-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{task.customer}</h3>
                <p className="text-sm text-gray-500">
                  {task.customerType === 'business' ? 'לקוח עסקי' : 'לקוח פרטי'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => openWhatsApp(task.customerPhone)}
                className="p-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200"
              >
                <MessageCircle size={20} />
              </button>
              <button 
                onClick={() => openPhone(task.customerPhone)}
                className="p-3 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200"
              >
                <Phone size={20} />
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-600 font-mono">{task.customerPhone}</p>
        </div>

        {/* Vehicle Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Car size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">פרטי רכב</h3>
              <p className="text-lg font-mono text-[#33d4ff]">{task.vehicle}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">יצרן ודגם</p>
              <p className="font-medium text-gray-800">{task.vehicleInfo.manufacturer} {task.vehicleInfo.model}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">שנה</p>
              <p className="font-medium text-gray-800">{task.vehicleInfo.year}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">צבע</p>
              <p className="font-medium text-gray-800">{task.vehicleInfo.color}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">סוג</p>
              <p className="font-medium text-gray-800">{task.vehicleInfo.type}</p>
            </div>
          </div>
        </div>

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
                <p className="text-gray-800 font-medium">{task.from}</p>
                <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => openWaze(task.from)}
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
                <p className="text-gray-800 font-medium">{task.to}</p>
                <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => openWaze(task.to)}
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
              <span className="text-sm">{task.distance}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={16} className="text-gray-400" />
              <span className="text-sm">{task.estimatedDuration}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={16} className="text-gray-400" />
              <span className="text-sm">מתוזמן: {task.scheduledTime}</span>
            </div>
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

        {/* Photos - Updated Section */}
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
              {/* Group images by type */}
              {photoTypes.map(photoType => {
                const imagesOfType = task.images.filter(img => img.type === photoType.key)
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
                          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                            <Camera size={20} className="text-gray-400" />
                          </div>
                          {img.note && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate">
                              {img.note}
                            </div>
                          )}
                          <div className="absolute top-1 right-1 text-[10px] bg-black/50 text-white px-1 rounded">
                            {img.timestamp}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
              
              {/* Add more button */}
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
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <FileText size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">מחיר גרירה</p>
                <p className="font-bold text-lg text-gray-800">₪{task.price}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      {task.status !== 'completed' && nextStatus && (
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <button
            onClick={handleStatusUpdate}
            className="w-full py-4 bg-[#33d4ff] text-white rounded-xl font-bold text-lg hover:bg-[#21b8e6] flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={22} />
            {nextStatus.action}
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

      {/* Image Upload Modal - Multi Step */}
      {showImageUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-2xl overflow-hidden max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                {uploadStep !== 'type' && (
                  <button onClick={handleBackInUpload} className="p-1">
                    <ArrowRight size={20} className="text-gray-500" />
                  </button>
                )}
                <h3 className="font-bold text-gray-800">
                  {uploadStep === 'type' && 'בחר סוג תמונה'}
                  {uploadStep === 'capture' && 'צלם תמונה'}
                  {uploadStep === 'preview' && 'תצוגה מקדימה'}
                </h3>
              </div>
              <button onClick={handleCloseUpload} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Step 1: Select Photo Type */}
              {uploadStep === 'type' && (
                <div className="p-4 space-y-2">
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
                </div>
              )}

              {/* Step 2: Capture Photo */}
              {uploadStep === 'capture' && selectedPhotoType && (
                <div className="p-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 ${getPhotoTypeInfo(selectedPhotoType).color}`}>
                    <span>{getPhotoTypeInfo(selectedPhotoType).icon}</span>
                    <span className="text-sm font-medium">{getPhotoTypeInfo(selectedPhotoType).label}</span>
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={() => handleCapturePhoto('camera')}
                      className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100"
                    >
                      <div className="w-12 h-12 bg-[#33d4ff] rounded-full flex items-center justify-center">
                        <Camera size={24} className="text-white" />
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-800">צלם תמונה</p>
                        <p className="text-sm text-gray-500">פתח את המצלמה</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => handleCapturePhoto('gallery')}
                      className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100"
                    >
                      <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                        <ImageIcon size={24} className="text-white" />
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-800">בחר מהגלריה</p>
                        <p className="text-sm text-gray-500">העלה תמונה קיימת</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Preview & Add Note */}
              {uploadStep === 'preview' && capturedImage && selectedPhotoType && (
                <div className="p-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 ${getPhotoTypeInfo(selectedPhotoType).color}`}>
                    <span>{getPhotoTypeInfo(selectedPhotoType).icon}</span>
                    <span className="text-sm font-medium">{getPhotoTypeInfo(selectedPhotoType).label}</span>
                  </div>

                  {/* Image Preview */}
                  <div className="aspect-video bg-gray-200 rounded-xl mb-4 flex items-center justify-center">
                    <div className="text-center">
                      <Camera size={40} className="text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">תצוגה מקדימה של התמונה</p>
                    </div>
                  </div>

                  {/* Note Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      הערה לתמונה (אופציונלי)
                    </label>
                    <textarea
                      value={photoNote}
                      onChange={(e) => setPhotoNote(e.target.value)}
                      placeholder='לדוגמה: "שריטה קיימת בפגוש"'
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setUploadStep('capture')}
                      className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium"
                    >
                      צלם מחדש
                    </button>
                    <button
                      onClick={handleSavePhoto}
                      className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl font-bold flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} />
                      שמור
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
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${getPhotoTypeInfo(showPhotoPreview.type).color}`}>
              <span>{getPhotoTypeInfo(showPhotoPreview.type).icon}</span>
              <span className="text-sm font-medium">{getPhotoTypeInfo(showPhotoPreview.type).label}</span>
            </div>
            <button onClick={() => setShowPhotoPreview(null)} className="p-2 text-white">
              <X size={24} />
            </button>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md aspect-video bg-gray-800 rounded-xl flex items-center justify-center">
              <Camera size={48} className="text-gray-600" />
            </div>
          </div>

          {showPhotoPreview.note && (
            <div className="p-4 bg-black/50">
              <p className="text-white text-center">{showPhotoPreview.note}</p>
            </div>
          )}

          <div className="p-4 text-center text-gray-400 text-sm">
            {showPhotoPreview.timestamp}
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
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold"
              >
                סיום
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
