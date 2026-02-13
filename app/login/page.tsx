'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setError('')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('אימייל או סיסמה שגויים')
      setLoading(false)
      return
    }

    // בדוק את התפקיד של המשתמש
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single()

    console.log('User query result:', { userData, userError })


    if (userError || !userData) {
      setError('לא נמצא משתמש במערכת')
      setLoading(false)
      return
    }

    // הפנה לפי תפקיד
    if (userData.role === 'driver') {
      window.location.href = '/driver'
    } else if (userData.role === 'super_admin') {
      window.location.href = '/superadmin'
    } else if (userData.role === 'customer') {
      window.location.href = '/customer'
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* כותרת */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">ברוכים הבאים</h1>
          <p className="text-slate-400">התחברו למערכת ניהול הגרירות</p>
        </div>

        {/* טופס */}
        <form onSubmit={handleLogin} className="bg-slate-800 rounded-xl p-6 space-y-4">
          
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

          {/* סיסמה */}
          <div>
            <label className="block text-sm font-medium mb-2">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          {/* שכחתי סיסמה */}
          <div className="text-left">
            <a href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300">
              שכחתי סיסמה
            </a>
          </div>

          {/* כפתור התחברות */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-3 rounded-lg transition-colors"
          >
            {loading ? 'מתחבר...' : 'התחברות'}
          </button>

        </form>

      </div>
    </div>
  )
}