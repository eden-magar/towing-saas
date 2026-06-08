'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Loader2, Camera, RotateCcw, Check } from 'lucide-react'

export interface PlateCameraProps {
  onConfirm: (file: File) => void
  onCancel: () => void
}

type PlateCameraMode = 'live' | 'preview'

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }

type TorchAdvancedConstraint = { torch?: boolean }

async function setTorch(track: MediaStreamTrack, enabled: boolean): Promise<void> {
  try {
    const capabilities = track.getCapabilities?.() as TorchCapabilities | undefined
    if (capabilities && 'torch' in capabilities && capabilities.torch) {
      const constraints = {
        advanced: [{ torch: enabled }] as TorchAdvancedConstraint[],
      } as MediaTrackConstraints
      await track.applyConstraints(constraints).catch(() => {})
    }
  } catch {
    // best-effort: unsupported devices behave as before
  }
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

export default function PlateCamera({ onConfirm, onCancel }: PlateCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const [mode, setMode] = useState<PlateCameraMode>('live')
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [streamReady, setStreamReady] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewUrl(null)
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        void setTorch(videoTrack, false)
      }
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
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        await setTorch(videoTrack, true)
      }
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
      revokePreviewUrl()
    }
  }, [startCamera, stopCamera, revokePreviewUrl])

  useEffect(() => {
    if (mode !== 'live' || !cameraActive || !streamRef.current || !videoRef.current) return

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
  }, [mode, cameraActive, streamReady, cameraReady, stopCamera])

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

        const file = new File([blob], `plate_${Date.now()}.jpg`, { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        previewUrlRef.current = url
        setPreviewUrl(url)
        setCapturedFile(file)
        stopCamera()
        setMode('preview')
      },
      'image/jpeg',
      0.85
    )
  }

  const handleRetake = () => {
    revokePreviewUrl()
    setCapturedFile(null)
    setMode('live')
    void startCamera()
  }

  const handleConfirm = async () => {
    if (!capturedFile || confirming) return

    setConfirming(true)
    try {
      stopCamera()
      const compressed = await compressImage(capturedFile)
      revokePreviewUrl()
      setCapturedFile(null)
      onConfirm(compressed)
    } catch (error) {
      console.error('Error confirming plate photo:', error)
      setCameraError('שגיאה בעיבוד התמונה, נסה שוב')
      setMode('live')
      void startCamera()
    } finally {
      setConfirming(false)
    }
  }

  const handleCancel = () => {
    stopCamera()
    revokePreviewUrl()
    setCapturedFile(null)
    onCancel()
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex flex-col bg-black">
      <canvas ref={canvasRef} className="hidden" />

      {mode === 'live' && (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />

          {!cameraReady && !cameraError && (
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
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
                    aria-label="סגור"
                  >
                    <X size={22} />
                  </button>
                  <p className="text-white text-sm font-medium">צלם את לוחית הרישוי</p>
                  <div className="w-11" />
                </div>
              </div>

              {cameraReady && (
                <>
                  <div className="absolute bottom-36 left-0 right-0 px-6 text-center">
                    <p className="text-white/80 text-sm">
                      מקם את לוחית הרישוי במרכז המסגרת ולחץ לצילום
                    </p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent pb-10 pt-8">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/30 bg-white active:scale-95 transition-transform"
                      aria-label="צלם"
                    >
                      <Camera size={32} className="text-gray-700" />
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {mode === 'preview' && previewUrl && (
        <>
          <img
            src={previewUrl}
            alt="תצוגה מקדימה של לוחית הרישוי"
            className="absolute inset-0 h-full w-full object-contain bg-black"
          />

          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4">
            <p className="text-center text-white text-sm font-medium">בדוק שהלוחית קריאה</p>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pb-8">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetake}
                disabled={confirming}
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 text-white font-medium disabled:opacity-50"
              >
                <RotateCcw size={18} />
                צלם שוב
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={confirming}
                className="flex min-h-[52px] flex-[1.2] items-center justify-center gap-2 rounded-xl bg-[#33d4ff] font-bold text-white disabled:opacity-60"
              >
                {confirming ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Check size={20} />
                )}
                אישור
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
