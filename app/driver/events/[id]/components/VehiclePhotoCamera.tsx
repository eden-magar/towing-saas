'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Loader2, Check } from 'lucide-react'

export interface VehiclePhotoCameraProps {
  title: string
  minPhotos?: number
  onConfirm: (files: File[]) => void
  onCancel: () => void
}

type CapturedImage = {
  file: File
  url: string
}

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

export default function VehiclePhotoCamera({
  title,
  minPhotos = 4,
  onConfirm,
  onCancel,
}: VehiclePhotoCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [images, setImages] = useState<CapturedImage[]>([])
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [streamReady, setStreamReady] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const revokeAllUrls = useCallback((imgs: CapturedImage[]) => {
    imgs.forEach((img) => URL.revokeObjectURL(img.url))
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setStreamReady(false)
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCameraReady(false)
    setCameraActive(true)

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      streamRef.current = stream
      setStreamReady(true)
    } catch (error) {
      console.error('Camera error:', error)
      setCameraError('לא ניתן לגשת למצלמה — יש לאשר הרשאת מצלמה בדפדפן')
      setCameraActive(false)
    }
  }, [])

  useEffect(() => {
    void startCamera()
    return () => {
      stopCamera()
      setImages((prev) => {
        revokeAllUrls(prev)
        return []
      })
    }
  }, [startCamera, stopCamera, revokeAllUrls])

  useEffect(() => {
    if (!cameraActive || !streamRef.current || !videoRef.current) return

    const video = videoRef.current
    const stream = streamRef.current

    video.srcObject = stream

    const timeout = setTimeout(() => {
      if (!cameraReady) {
        setCameraError('שגיאה בהפעלת המצלמה. נסה שוב.')
        stopCamera()
      }
    }, 8000)

    video.onloadedmetadata = async () => {
      try {
        await video.play()
        setCameraReady(true)
        clearTimeout(timeout)
      } catch (playError) {
        console.error('Play error:', playError)
        setCameraError('שגיאה בהפעלת המצלמה')
        stopCamera()
      }
    }

    return () => clearTimeout(timeout)
  }, [cameraActive, streamReady, cameraReady, stopCamera])

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
        if (!blob) return

        const file = new File([blob], `vehicle_${Date.now()}.jpg`, { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        setImages((prev) => [...prev, { file, url }])
      },
      'image/jpeg',
      0.85
    )
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].url)
      next.splice(index, 1)
      return next
    })
  }

  const handleCancel = () => {
    stopCamera()
    setImages((prev) => {
      revokeAllUrls(prev)
      return []
    })
    onCancel()
  }

  const handleConfirm = async () => {
    if (images.length < minPhotos || confirming) return

    setConfirming(true)
    try {
      const compressed = await Promise.all(images.map((img) => compressImage(img.file)))
      stopCamera()
      revokeAllUrls(images)
      setImages([])
      onConfirm(compressed)
    } catch (error) {
      console.error('Error compressing vehicle photos:', error)
      setCameraError('שגיאה בעיבוד התמונות, נסה שוב')
      void startCamera()
    } finally {
      setConfirming(false)
    }
  }

  const canConfirm = images.length >= minPhotos && !confirming
  const photosRemaining = Math.max(0, minPhotos - images.length)

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex flex-col bg-black">
      <canvas ref={canvasRef} className="hidden" />

      {cameraActive && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {!cameraReady && !cameraError && cameraActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center">
            <Loader2 size={40} className="mx-auto mb-3 animate-spin text-[#33d4ff]" />
            <p className="text-white text-sm">טוען מצלמה...</p>
          </div>
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black p-6">
          <div className="max-w-sm text-center">
            <p className="mb-4 text-red-400 text-sm leading-relaxed">{cameraError}</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setCameraError(null)
                  void startCamera()
                }}
                className="min-h-[48px] rounded-xl bg-white px-6 py-3 font-medium text-gray-900"
              >
                נסה שוב
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="min-h-[44px] rounded-xl text-white/80 text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {!cameraError && (
        <>
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={confirming}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-50"
                aria-label="סגור"
              >
                <X size={22} />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-sm font-medium text-white">{title}</p>
                <p className="mt-0.5 text-xs font-bold text-[#33d4ff]">
                  {images.length}/{minPhotos}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!canConfirm}
                className="flex h-11 shrink-0 items-center justify-center gap-1 rounded-full bg-[#33d4ff] px-4 text-sm font-bold text-white disabled:opacity-40"
              >
                {confirming ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Check size={18} />
                    אישור
                  </>
                )}
              </button>
            </div>
          </div>

          {images.length > 0 && (
            <div className="absolute top-24 left-0 right-0 px-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <div key={img.url} className="relative shrink-0">
                    <img
                      src={img.url}
                      alt={`תמונה ${idx + 1}`}
                      className="h-14 w-14 rounded-lg border-2 border-white/50 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      disabled={confirming}
                      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white disabled:opacity-50"
                      aria-label={`הסר תמונה ${idx + 1}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cameraReady && (
            <>
              <div className="absolute bottom-36 left-0 right-0 px-6 text-center">
                {photosRemaining > 0 ? (
                  <p className="text-sm text-white/80">
                    יש לצלם לפחות {minPhotos} תמונות — נותרו עוד {photosRemaining}
                  </p>
                ) : (
                  <p className="text-sm text-emerald-300">ניתן לאשר ולהמשיך</p>
                )}
              </div>

              <div className="absolute bottom-0 left-0 right-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent pb-10 pt-8">
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={confirming}
                  className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/30 bg-white active:scale-95 transition-transform disabled:opacity-50"
                  aria-label="צלם"
                >
                  <div className="h-16 w-16 rounded-full border-2 border-gray-400 bg-white" />
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
