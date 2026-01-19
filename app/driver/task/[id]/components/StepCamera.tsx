'use client'

import { useState, useRef } from 'react'
import { 
  Camera, 
  X, 
  Trash2, 
  Check, 
  Loader2,
  Plus
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<{ file: File; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)

  const isPickup = point.point_type === 'pickup'
  const title = 'צלם את הרכב'
  const subtitle = 'מינימום 4 תמונות'
  const minPhotos = 4

  // קביעת סוג התמונה
  const getImageType = (): TowImageType => {
    return isPickup ? 'before_pickup' : 'before_dropoff'
  }

  // בחירת/צילום תמונה
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newImages = Array.from(files).map(file => ({
      file,
      url: URL.createObjectURL(file)
    }))
    
    setImages(prev => [...prev, ...newImages])
    setShowCamera(false)
    
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // מחיקת תמונה מהתור
  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].url)
      newImages.splice(index, 1)
      return newImages
    })
  }

  // פתיחת מצלמה
  const openCamera = () => {
    setShowCamera(true)
    setTimeout(() => fileInputRef.current?.click(), 100)
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

  return (
    <div className="flex flex-col min-h-[calc(100vh-70px)]">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

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
            <p className="text-gray-500 mb-6">לחץ לצילום תמונות</p>
            <button
              onClick={openCamera}
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
                onClick={openCamera}
                className="aspect-square bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700"
              >
                <Plus size={32} />
                <span className="text-sm mt-1">צלם עוד</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Actions - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 p-4 pb-8">
        {images.length > 0 && (
          <div className="flex gap-3">
            <button
              onClick={openCamera}
              className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-medium flex items-center justify-center gap-2"
            >
              <Plus size={20} />
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