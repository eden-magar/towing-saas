'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('הסיסמאות לא תואמות')
      return
    }

    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      setError('שגיאה בעדכון הסיסמה. נסי שוב.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* כותרת */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">איפוס סיסמה</h1>
          <p className="text-slate-400">הזיני סיסמה חדשה</p>
        </div>

        {/* הודעת הצלחה */}
        {success ? (
          <div className="bg-slate-800 rounded-xl p-6 text-center">
            <div className="text-green-400 text-5xl mb-4">✅</div>
            <h2 className="text-xl font-semibold mb-2">הסיסמה עודכנה!</h2>
            <p className="text-slate-400 mb-4">את יכולה להתחבר עם הסיסמה החדשה.</p>
            <a 
              href="/login" 
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
            >
              להתחברות
            </a>
          </div>
        ) : (
          /* טופס */
          <form onSubmit={handleSubmit} className="bg-slate-800 rounded-xl p-6 space-y-4">
            
            {/* שגיאה */}
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* סיסמה חדשה */}
            <div>
              <label className="block text-sm font-medium mb-2">סיסמה חדשה</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
                required
              />
            </div>

            {/* אישור סיסמה */}
            <div>
              <label className="block text-sm font-medium mb-2">אישור סיסמה</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
                required
              />
            </div>

            {/* כפתור שמירה */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-3 rounded-lg transition-colors"
            >
              {loading ? 'שומר...' : 'שמור סיסמה חדשה'}
            </button>

          </form>
        )}

      </div>
    </div>
  )
}