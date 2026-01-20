'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  Camera, 
  X, 
  Trash2, 
  Check, 
  Loader2
} from 'lucide-react'
import { 
  uploadTowImage, 
  DriverTaskPoint,
  TowImageType
} from '@/app/lib/queries/driver-tasks'

interface StepCameraProps {
  towId: string
  point: DriverTaskPoint
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
  userId,
  onComplete
}: StepCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  
  const [images, setImages] = useState<{ file: File; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const isPickup = point.point_type === 'pickup'
  const title = 'צלם את הרכב'
  const subtitle = 'מינימום 4 תמונות'
  const minPhotos = 4

  // קביעת סוג התמונה
  const getImageType = (): TowImageType => {
    return isPickup ? 'before_pickup' : 'before_dropoff'
  }

  // הפעלת המצלמה
  const startCamera = async () => {
    setCameraError(null)
    setCameraReady(false)
    setCameraActive(true)
    
    try {
      // נסה קודם מצלמה אחורית, אם לא עובד - כל מצלמה
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
        // fallback - כל מצלמה זמינה
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        })
      }
      
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        // מחכים שהוידאו יטען
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

  // צילום תמונה מה-video stream
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // התאמת גודל הקנבס לגודל הוידאו
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // ציור הפריים הנוכחי
    ctx.drawImage(video, 0, 0)

    // המרה לקובץ
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
          const url = URL.createObjectURL(blob)
          setImages(prev => [...prev, { file, url }])
        }
      },
      'image/jpeg',
      0.85
    )
  }

  // מחיקת תמונה
  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].url)
      newImages.splice(index, 1)
      return newImages
    })
  }

  // סיום וסגירת מצלמה
  const handleDone = () => {
    stopCamera()
  }

  // שמירת כל התמונות
  const handleSaveAll = async () => {
    if (images.length < minPhotos) {
      alert(`יש לצלם לפחות ${minPhotos} תמונות`)
      return
    }

    setUploading(true)
    try {
      const imageType = getImageType()
      
      for (const img of images) {
        const compressed = await compressImage(img.file)
        await uploadTowImage(
          towId,
          userId,
          imageType,
          compressed,
          point.id
        )
      }

      // ניקוי URLs
      images.forEach(img => URL.revokeObjectURL(img.url))
      
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
      images.forEach(img => URL.revokeObjectURL(img.url))
    }
  }, [])

  return (
    <div className="flex flex-col min-h-[calc(100vh-70px)]">
      {/* Hidden Canvas for capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera View - Full Screen */}
      {cameraActive && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Video Stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Loading indicator */}
          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="text-center">
                <Loader2 size={40} className="animate-spin text-white mx-auto mb-3" />
                <p className="text-white">טוען מצלמה...</p>
              </div>
            </div>
          )}

          {/* Error in camera view */}
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

          {/* Top Bar - Counter & Close */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
            <button
              onClick={stopCamera}
              className="bg-black/50 p-2 rounded-full"
            >
              <X size={24} className="text-white" />
            </button>
            <div className="bg-black/50 px-4 py-2 rounded-full">
              <span className="text-white font-bold text-lg">
                {images.length}/{minPhotos}
              </span>
            </div>
            {images.length >= minPhotos && (
              <button
                onClick={handleDone}
                className="bg-emerald-500 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2"
              >
                <Check size={20} />
                סיימתי
              </button>
            )}
          </div>

          {/* Thumbnails Strip */}
          {images.length > 0 && (
            <div className="absolute top-20 left-0 right-0 px-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative flex-shrink-0">
                    <img 
                      src={img.url} 
                      className="w-14 h-14 object-cover rounded-lg border-2 border-white/50" 
                      alt={`תמונה ${idx + 1}`} 
                    />
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

          {/* Instructions */}
          {cameraReady && (
            <div className="absolute bottom-32 left-0 right-0 text-center">
              <p className="text-white/80 text-sm">
                {images.length < minPhotos 
                  ? `צלם עוד ${minPhotos - images.length} תמונות`
                  : 'אפשר להמשיך לצלם או ללחוץ "סיימתי"'
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Screen - When camera is not active */}
      {!cameraActive && (
        <>
          {/* Header Info */}
          <div className="px-5 pt-2 pb-6 text-white text-center">
            <h1 className="text-2xl font-bold mb-1">{title}</h1>
            <p className="text-white/80">{subtitle}</p>
          </div>

          {/* Content */}
          <div className="flex-1 bg-slate-900 rounded-t-3xl px-5 pt-6 pb-32">
            {/* Status */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {images.length >= minPhotos ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check size={20} />
                  <span className="font-medium">{images.length} תמונות צולמו</span>
                </div>
              ) : (
                <span className="text-gray-400">
                  {images.length}/{minPhotos} תמונות
                </span>
              )}
            </div>

            {/* Images Grid */}
            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
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
                {images.map((img, idx) => (
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
                
                {/* Add More Button */}
                {images.length < 8 && (
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

          {/* Bottom Actions - Fixed */}
          <div className="fixed bottom-0 left-0 right-0 bg-slate-900 p-4 pb-28">
            {images.length > 0 && (
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
                  disabled={uploading || images.length < minPhotos}
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
            <p className="font-medium text-gray-700">מעלה {images.length} תמונות...</p>
          </div>
        </div>
      )}
    </div>
  )
}