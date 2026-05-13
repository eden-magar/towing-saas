'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export interface ResendInviteModalProps {
  isOpen: boolean
  email: string
  onClose: () => void
  onConfirm: () => Promise<{ success: boolean; error?: string }>
}

type Phase = 'confirm' | 'sending' | 'success' | 'error'

export default function ResendInviteModal({
  isOpen,
  email,
  onClose,
  onConfirm,
}: ResendInviteModalProps) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      setPhase('confirm')
      setErrorMessage('')
    }
  }, [isOpen])

  const runSend = useCallback(async () => {
    setPhase('sending')
    try {
      const result = await onConfirm()
      if (result.success) {
        setPhase('success')
      } else {
        setErrorMessage(result.error || 'שגיאה')
        setPhase('error')
      }
    } catch {
      setErrorMessage('שגיאה לא צפויה')
      setPhase('error')
    }
  }, [onConfirm])

  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200"
        dir="rtl"
        role="dialog"
        aria-modal="true"
      >
        {phase === 'confirm' && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-2">שליחת קישור הזמנה</h2>
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
              האם לשלוח קישור הזמנה חדש למייל {email}?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => void runSend()}
                className="px-4 py-2.5 rounded-xl bg-[#33d4ff] text-white font-medium hover:bg-[#21b8e6]"
              >
                שלח
              </button>
            </div>
          </>
        )}

        {phase === 'sending' && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-4">שולח...</h2>
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="w-10 h-10 text-[#33d4ff] animate-spin" />
              <p className="text-gray-600 text-sm text-center">
                שולח קישור הזמנה למייל...
              </p>
            </div>
          </>
        )}

        {phase === 'success' && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-4">נשלח בהצלחה ✓</h2>
            <div className="flex flex-col items-center gap-3 py-2 mb-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-gray-600 text-sm text-center">
                הקישור נשלח למייל {email}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl bg-[#33d4ff] text-white font-medium hover:bg-[#21b8e6]"
              >
                סגור
              </button>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-4">שגיאה</h2>
            <div className="flex flex-col items-center gap-3 py-2 mb-6">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-red-700 text-sm text-center">{errorMessage}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
              >
                סגור
              </button>
              <button
                type="button"
                onClick={() => void runSend()}
                className="px-4 py-2.5 rounded-xl bg-[#33d4ff] text-white font-medium hover:bg-[#21b8e6]"
              >
                נסה שוב
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
