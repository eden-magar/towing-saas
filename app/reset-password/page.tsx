'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Lock, Check, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleReset = async () => {
    if (password.length < 8) {
      setError('הסיסמה חייבת להכיל לפחות 8 תווים')
      return
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('הסיסמה חייבת להכיל אות גדולה, אות קטנה וספרה')
      return
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות לא תואמות')
      return
    }

    setLoading(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    if (updateError) {
      const msg = updateError.message || ''
      let hebrewError = 'שגיאה בעדכון הסיסמה'
      if (msg.toLowerCase().includes('at least') && msg.toLowerCase().includes('character')) {
        hebrewError = 'הסיסמה חלשה מדי. נדרשים לפחות 8 תווים, כולל אות גדולה, אות קטנה וספרה'
      } else if (msg.toLowerCase().includes('weak') || msg.toLowerCase().includes('pwned')) {
        hebrewError = 'הסיסמה חלשה או נפוצה מדי. נסי סיסמה מורכבת יותר'
      } else if (msg.toLowerCase().includes('same') && msg.toLowerCase().includes('password')) {
        hebrewError = 'הסיסמה החדשה זהה לקודמת. בחרי סיסמה אחרת'
      } else if (msg.toLowerCase().includes('session')) {
        hebrewError = 'פג תוקף. בקשי קישור איפוס חדש'
      }
      setError(hebrewError)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex flex-1 bg-gray-50 items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">הסיסמה עודכנה!</h1>
          <p className="text-gray-500 mb-6">הסיסמה שונתה בהצלחה. ניתן להתחבר עם הסיסמה החדשה.</p>
          <a
            href="/login"
            className="block w-full py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] transition-colors"
          >
            התחבר
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 bg-gray-50 items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">איפוס סיסמה</h1>
          <p className="text-gray-500 mt-2">הזיני סיסמה חדשה</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה חדשה</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] text-gray-800"
                placeholder="לפחות 8 תווים"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              הסיסמה חייבת להכיל לפחות 8 תווים, כולל:
              <br />
              אות גדולה באנגלית (A-Z), אות קטנה באנגלית (a-z), וספרה (0-9)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">אימות סיסמה</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] text-gray-800"
              placeholder="הזיני שוב את הסיסמה"
            />
          </div>

          <button
            onClick={handleReset}
            disabled={loading || !password || !confirmPassword}
            className="w-full py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] transition-colors disabled:opacity-50"
          >
            {loading ? 'מעדכן...' : 'עדכן סיסמה'}
          </button>
        </div>
      </div>
    </div>
  )
}
