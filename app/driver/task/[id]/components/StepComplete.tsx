'use client'

import { CheckCircle2 } from 'lucide-react'

interface StepCompleteProps {
  onGoHome: () => void
}

export default function StepComplete({ onGoHome }: StepCompleteProps) {
  return (
    <div dir="rtl" className="min-h-screen bg-emerald-500 flex flex-col items-center justify-center p-6">
      {/* Success Icon */}
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg">
        <CheckCircle2 size={56} className="text-emerald-500" />
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-white mb-2">הגרירה הושלמה!</h1>
      <p className="text-emerald-100 text-lg mb-12">כל הכבוד 🎉</p>

      {/* Home Button */}
      <button
        onClick={onGoHome}
        className="w-full max-w-xs py-4 bg-white text-emerald-600 rounded-2xl font-bold text-lg shadow-lg"
      >
        חזור לדף הבית
      </button>
    </div>
  )
}