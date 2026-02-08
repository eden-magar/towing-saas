'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  Camera, 
  X, 
  Trash2, 
  Check, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  Car
} from 'lucide-react'
import { 
  uploadTowImage, 
  DriverTaskPoint,
  DriverTaskVehicle,
  TowImageType
} from '@/app/lib/queries/driver-tasks'

interface StepCameraProps {
  towId: string
  point: DriverTaskPoint
  vehicles: DriverTaskVehicle[]
  userId: string
  onComplete: () => Promise<void>
}

// פונקציית compression
async function compressImage(file: File, maxSizeMB: number = 1): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.size <= maxSizeMB * 1024 * 1024) {
      resolve(file)
      return
    }

    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
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
      ctx?.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          } else {
            reject(new Error('Failed to compress'))
          }
        },
        'image/jpeg',
        0.7
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

export default function StepCamera({
  towId,
  point,
  vehicles,
  userId,
  onComplete
}: StepCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  
  // אינדקס הרכב הנוכחי
  const [currentVehicleIndex, setCurrentVehicleIndex] = useState(0)
  
  // תמונות לכל רכב - מפתח הוא plate_number
  const [imagesByVehicle, setImagesByVehicle] = useState<Record<string, { file: File; url: string }[]>>({})
  
  const [uploading, setUploading] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const isPickup = point.point_type === 'pickup'
  const minPhotosPerVehicle = 4
  const currentVehicle = vehicles[currentVehicleIndex]
  const currentVehicleKey = currentVehicle?.plate_number || `vehicle_${currentVehicleIndex}`
  const currentImages = imagesByVehicle[currentVehicleKey] || []

  // קביעת סוג התמונה
  const getImageType = (): TowImageType => {
    return isPickup ? 'before_pickup' : 'before_dropoff'
  }

  // בדיקה אם כל הרכבים צולמו
  const allVehiclesComplete = vehicles.every(v => {
    const key = v.plate_number || `vehicle_${vehicles.indexOf(v)}`
    const imgs = imagesByVehicle[key] || []
    return imgs.length >= minPhotosPerVehicle
  })

  // ספירת תמונות כוללת
  const totalImages = Object.values(imagesByVehicle).reduce((sum, imgs) => sum + imgs.length, 0)
  const totalRequired = vehicles.length * minPhotosPerVehicle

  // הפעלת המצלמה
  const startCamera = async () => {
    setCameraError(null)
    setCameraReady(false)
    setCameraActive(true)
    
    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { exact: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        })
      }
      
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play()
            setCameraReady(true)
          } catch (playError) {
            console.error('Play error:', playError)
            setCameraError('שגיאה בהפעלת המצלמה')
          }
        }
      }
    } catch (error) {
      console.error('Camera error:', error)
      setCameraError('לא ניתן לגשת למצלמה. אנא אשר הרשאות.')
      setCameraActive(false)
    }
  }

  // עצירת המצלמה
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setCameraReady(false)
  }

  // צילום תמונה
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo_${currentVehicleKey}_${Date.now()}.jpg`, { type: 'image/jpeg' })
          const url = URL.createObjectURL(blob)
          setImagesByVehicle(prev => ({
            ...prev,
            [currentVehicleKey]: [...(prev[currentVehicleKey] || []), { file, url }]
          }))
        }
      },
      'image/jpeg',
      0.85
    )
  }

  // מחיקת תמונה
  const handleRemoveImage = (index: number) => {
    setImagesByVehicle(prev => {
      const vehicleImages = [...(prev[currentVehicleKey] || [])]
      URL.revokeObjectURL(vehicleImages[index].url)
      vehicleImages.splice(index, 1)
      return { ...prev, [currentVehicleKey]: vehicleImages }
    })
  }

  // מעבר לרכב הבא
  const goToNextVehicle = () => {
    if (currentVehicleIndex < vehicles.length - 1) {
      setCurrentVehicleIndex(currentVehicleIndex + 1)
    }
  }

  // מעבר לרכב הקודם
  const goToPrevVehicle = () => {
    if (currentVehicleIndex > 0) {
      setCurrentVehicleIndex(currentVehicleIndex - 1)
    }
  }

  // סיום צילום לרכב נוכחי
  const handleDoneWithVehicle = () => {
    stopCamera()
    if (currentVehicleIndex < vehicles.length - 1 && currentImages.length >= minPhotosPerVehicle) {
      goToNextVehicle()
    }
  }

  // שמירת כל התמונות
  const handleSaveAll = async () => {
    if (!allVehiclesComplete) {
      alert(`יש לצלם לפחות ${minPhotosPerVehicle} תמונות לכל רכב`)
      return
    }

    setUploading(true)
    try {
      const imageType = getImageType()
      
      for (const [vehicleKey, imgs] of Object.entries(imagesByVehicle)) {
        for (const img of imgs) {
          const compressed = await compressImage(img.file)
          await uploadTowImage(
            towId,
            userId,
            imageType,
            compressed,
            point.id,
            vehicles.find(v => v.plate_number === vehicleKey)?.id
          )
        }
      }

      // ניקוי URLs
      Object.values(imagesByVehicle).forEach(imgs => {
        imgs.forEach(img => URL.revokeObjectURL(img.url))
      })
      
      await onComplete()
    } catch (error) {
      console.error('Error uploading images:', error)
      alert('שגיאה בהעלאת התמונות')
    } finally {
      setUploading(false)
    }
  }

  // ניקוי בעת unmount
  useEffect(() => {
    return () => {
      stopCamera()
      Object.values(imagesByVehicle).forEach(imgs => {
        imgs.forEach(img => URL.revokeObjectURL(img.url))
      })
    }
  }, [])

  return (
    <div className="flex flex-col min-h-[calc(100vh-70px)]">
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera View */}
      {cameraActive && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="text-center">
                <Loader2 size={40} className="animate-spin text-white mx-auto mb-3" />
                <p className="text-white">טוען מצלמה...</p>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="text-center p-6">
                <p className="text-red-400 mb-4">{cameraError}</p>
                <button
                  onClick={() => { stopCamera(); startCamera(); }}
                  className="bg-white text-black px-6 py-3 rounded-xl font-medium"
                >
                  נסה שוב
                </button>
              </div>
            </div>
          )}

          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex justify-between items-center">
              <button onClick={stopCamera} className="bg-black/50 p-2 rounded-full">
                <X size={24} className="text-white" />
              </button>
              
              {/* Vehicle indicator */}
              <div className="bg-black/50 px-4 py-2 rounded-full text-center">
                <p className="text-white text-xs">{currentVehicle?.plate_number}</p>
                <p className="text-white font-bold">{currentImages.length}/{minPhotosPerVehicle}</p>
              </div>
              
              {currentImages.length >= minPhotosPerVehicle && (
                <button
                  onClick={handleDoneWithVehicle}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2"
                >
                  <Check size={20} />
                  {currentVehicleIndex < vehicles.length - 1 ? 'רכב הבא' : 'סיימתי'}
                </button>
              )}
            </div>
            
            {/* Vehicle name */}
            <div className="mt-2 text-center">
              <p className="text-white/80 text-sm">
                רכב {currentVehicleIndex + 1}/{vehicles.length}: {currentVehicle?.manufacturer} {currentVehicle?.model}
              </p>
            </div>
          </div>

          {/* Thumbnails */}
          {currentImages.length > 0 && (
            <div className="absolute top-28 left-0 right-0 px-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {currentImages.map((img, idx) => (
                  <div key={idx} className="relative flex-shrink-0">
                    <img src={img.url} className="w-14 h-14 object-cover rounded-lg border-2 border-white/50" alt={`תמונה ${idx + 1}`} />
                    <button
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capture Button */}
          {cameraReady && (
            <div className="absolute bottom-0 left-0 right-0 pb-10 pt-6 flex justify-center bg-gradient-to-t from-black/60 to-transparent">
              <button
                onClick={capturePhoto}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-4 border-gray-300 active:scale-95 transition-transform"
              >
                <div className="w-16 h-16 bg-white rounded-full border-2 border-gray-400" />
              </button>
            </div>
          )}

          {cameraReady && (
            <div className="absolute bottom-32 left-0 right-0 text-center">
              <p className="text-white/80 text-sm">
                {currentImages.length < minPhotosPerVehicle 
                  ? `צלם עוד ${minPhotosPerVehicle - currentImages.length} תמונות לרכב זה`
                  : currentVehicleIndex < vehicles.length - 1
                    ? 'לחץ "רכב הבא" להמשיך'
                    : 'לחץ "סיימתי" לסיום'
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Screen */}
      {!cameraActive && (
        <>
          <div className="px-5 pt-2 pb-6 text-white text-center">
            <h1 className="text-2xl font-bold mb-1">צלם את הרכבים</h1>
            <p className="text-white/80">{minPhotosPerVehicle} תמונות לכל רכב</p>
          </div>

          <div className="flex-1 bg-slate-900 rounded-t-3xl px-5 pt-6 pb-32">
            {/* Vehicle Selector */}
            {vehicles.length > 1 && (
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goToPrevVehicle}
                  disabled={currentVehicleIndex === 0}
                  className="p-2 bg-slate-800 rounded-lg disabled:opacity-30"
                >
                  <ChevronRight size={20} className="text-white" />
                </button>
                
                <div className="text-center">
                  <p className="text-white font-bold">
                    רכב {currentVehicleIndex + 1}/{vehicles.length}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {currentVehicle?.manufacturer} {currentVehicle?.model}
                  </p>
                </div>
                
                <button
                  onClick={goToNextVehicle}
                  disabled={currentVehicleIndex === vehicles.length - 1}
                  className="p-2 bg-slate-800 rounded-lg disabled:opacity-30"
                >
                  <ChevronLeft size={20} className="text-white" />
                </button>
              </div>
            )}

            {/* Current Vehicle Card */}
            <div className="bg-slate-800 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center">
                  <Car size={24} className="text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">{currentVehicle?.plate_number}</p>
                  <p className="text-gray-400 text-sm">{currentVehicle?.manufacturer} {currentVehicle?.model}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  currentImages.length >= minPhotosPerVehicle 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-700 text-gray-300'
                }`}>
                  {currentImages.length}/{minPhotosPerVehicle}
                </div>
              </div>
            </div>

            {/* Progress for all vehicles */}
            {vehicles.length > 1 && (
              <div className="mb-4">
                <div className="flex gap-1">
                  {vehicles.map((v, idx) => {
                    const key = v.plate_number || `vehicle_${idx}`
                    const imgs = imagesByVehicle[key] || []
                    const complete = imgs.length >= minPhotosPerVehicle
                    return (
                      <div
                        key={idx}
                        onClick={() => setCurrentVehicleIndex(idx)}
                        className={`flex-1 h-2 rounded-full cursor-pointer ${
                          complete ? 'bg-emerald-500' : idx === currentVehicleIndex ? 'bg-purple-500' : 'bg-slate-700'
                        }`}
                      />
                    )
                  })}
                </div>
                <p className="text-center text-gray-500 text-xs mt-2">
                  {totalImages}/{totalRequired} תמונות סה"כ
                </p>
              </div>
            )}

            {/* Images Grid */}
            {currentImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                  <Camera size={40} className="text-slate-600" />
                </div>
                <p className="text-gray-500 mb-6">לחץ לפתיחת המצלמה</p>
                <button
                  onClick={startCamera}
                  className="px-8 py-4 bg-purple-600 text-white rounded-2xl font-bold text-lg flex items-center gap-2"
                >
                  <Camera size={22} />
                  פתח מצלמה
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {currentImages.map((img, idx) => (
                  <div key={idx} className="relative aspect-square bg-slate-800 rounded-2xl overflow-hidden">
                    <img src={img.url} className="w-full h-full object-cover" alt={`תמונה ${idx + 1}`} />
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                      {idx + 1}
                    </div>
                    <button
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-2 left-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                
                {currentImages.length < 8 && (
                  <button
                    onClick={startCamera}
                    className="aspect-square bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700"
                  >
                    <Camera size={32} />
                    <span className="text-sm mt-1">צלם עוד</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="fixed bottom-0 left-0 right-0 bg-slate-900 p-4 pb-28">
            {currentImages.length > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={startCamera}
                  className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-medium flex items-center justify-center gap-2"
                >
                  <Camera size={20} />
                  צלם עוד
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={uploading || !allVehiclesComplete}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <Check size={20} />
                      אישור והמשך
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Uploading Overlay */}
      {uploading && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
            <Loader2 size={40} className="animate-spin text-purple-600" />
            <p className="font-medium text-gray-700">מעלה {totalImages} תמונות...</p>
          </div>
        </div>
      )}
    </div>
  )
}