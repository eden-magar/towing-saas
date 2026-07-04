'use client'

import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      })

      let data: { success?: boolean; message?: string; error?: string }
      try {
        data = await response.json()
      } catch {
        setError('תשובה לא תקינה מהשרת. נסי שוב.')
        return
      }

      if (!response.ok) {
        setError(data.error || 'שגיאה בשליחת המייל. נסי שוב.')
        return
      }

      setSent(true)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('הבקשה ארכה זמן רב מדי. נסי שוב.')
      } else {
        setError('שגיאה בשליחת המייל. נסי שוב.')
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* כותרת */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">שכחתי סיסמה</h1>
          <p className="text-slate-400">נשלח לך קישור לאיפוס הסיסמה</p>
        </div>

        {/* הודעת הצלחה */}
        {sent ? (
          <div className="bg-slate-800 rounded-xl p-6 text-center">
            <div className="text-green-400 text-5xl mb-4">✉️</div>
            <h2 className="text-xl font-semibold mb-2">המייל נשלח!</h2>
            <p className="text-slate-400 mb-4">בדקי את תיבת המייל שלך וליחצי על הקישור לאיפוס הסיסמה.</p>
            <a href="/login" className="text-blue-400 hover:text-blue-300">
              חזרה להתחברות
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

            {/* אימייל */}
            <div>
              <label className="block text-sm font-medium mb-2">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                placeholder="name@example.com"
                required
              />
            </div>

            {/* כפתור שליחה */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-3 rounded-lg transition-colors"
            >
              {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
            </button>

            {/* חזרה */}
            <div className="text-center">
              <a href="/login" className="text-sm text-blue-400 hover:text-blue-300">
                חזרה להתחברות
              </a>
            </div>

          </form>
        )}

      </div>
    </div>
  )
}
