'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Truck, 
  Phone, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowLeft,
  MessageSquare,
  KeyRound,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

type LoginStep = 'login' | 'forgot' | 'verify' | 'newPassword' | 'firstLogin'

export default function DriverLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<LoginStep>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Form states
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const formatPhoneDisplay = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}${digits.slice(6, 10)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(digits)
  }

  const handleLogin = async () => {
    setError('')
    
    if (phone.length < 10) {
      setError('מספר טלפון לא תקין')
      return
    }
    if (password.length < 4) {
      setError('סיסמה חייבת להכיל לפחות 4 תווים')
      return
    }

    setLoading(true)
    
    // Mock login - simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Mock: check if first login
    const isFirstLogin = password === '1234' // Demo: if password is 1234, it's first login
    
    if (isFirstLogin) {
      setStep('firstLogin')
    } else {
      // Success - redirect to driver app
      router.push('/driver')
    }
    
    setLoading(false)
  }

  const handleForgotPassword = async () => {
    setError('')
    
    if (phone.length < 10) {
      setError('הזן מספר טלפון תקין')
      return
    }

    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setStep('verify')
    setLoading(false)
  }

  const handleVerifyCode = async () => {
    setError('')
    
    if (verifyCode.length !== 4) {
      setError('קוד האימות חייב להכיל 4 ספרות')
      return
    }

    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Mock verification
    if (verifyCode === '1234') {
      setStep('newPassword')
    } else {
      setError('קוד שגוי, נסה שנית')
    }
    
    setLoading(false)
  }

  const handleSetNewPassword = async () => {
    setError('')
    
    if (newPassword.length < 6) {
      setError('סיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('הסיסמאות אינן תואמות')
      return
    }

    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Success - redirect
    router.push('/driver')
    
    setLoading(false)
  }

  const handleResendCode = async () => {
    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setLoading(false)
    // Show toast or message that code was resent
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-[#33d4ff] to-[#21b8e6] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 pt-12 pb-8 px-6 text-center text-white">
        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Truck size={40} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold">אפליקציית נהגים</h1>
        <p className="text-white/80 mt-1">מערכת ניהול גרירות</p>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6">
        
        {/* Login Step */}
        {step === 'login' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800">התחברות</h2>
              <p className="text-gray-500 mt-1">הזן את פרטי ההתחברות שלך</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Phone Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">מספר טלפון</label>
                <div className="relative">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Phone size={20} className="text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={formatPhoneDisplay(phone)}
                    onChange={handlePhoneChange}
                    placeholder="050-000-0000"
                    className="w-full pr-12 pl-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] focus:border-transparent"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סיסמה</label>
                <div className="relative">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Lock size={20} className="text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="הזן סיסמה"
                    className="w-full pr-12 pl-12 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-1"
                  >
                    {showPassword ? (
                      <EyeOff size={20} className="text-gray-400" />
                    ) : (
                      <Eye size={20} className="text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Forgot Password */}
            <button
              onClick={() => setStep('forgot')}
              className="text-[#33d4ff] text-sm font-medium"
            >
              שכחת סיסמה?
            </button>

            {/* Login Button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-4 bg-[#33d4ff] text-white rounded-xl font-bold text-lg hover:bg-[#21b8e6] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  התחבר
                  <ArrowLeft size={20} />
                </>
              )}
            </button>
          </div>
        )}

        {/* Forgot Password Step */}
        {step === 'forgot' && (
          <div className="space-y-6">
            <button
              onClick={() => { setStep('login'); setError(''); }}
              className="flex items-center gap-2 text-gray-500"
            >
              <ArrowLeft size={20} className="rotate-180" />
              חזרה
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#33d4ff]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <KeyRound size={32} className="text-[#33d4ff]" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">שכחת סיסמה?</h2>
              <p className="text-gray-500 mt-1">נשלח לך קוד אימות ב-SMS</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">מספר טלפון</label>
              <div className="relative">
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Phone size={20} className="text-gray-400" />
                </div>
                <input
                  type="tel"
                  value={formatPhoneDisplay(phone)}
                  onChange={handlePhoneChange}
                  placeholder="050-000-0000"
                  className="w-full pr-12 pl-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] focus:border-transparent"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full py-4 bg-[#33d4ff] text-white rounded-xl font-bold text-lg hover:bg-[#21b8e6] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <MessageSquare size={20} />
                  שלח קוד אימות
                </>
              )}
            </button>
          </div>
        )}

        {/* Verify Code Step */}
        {step === 'verify' && (
          <div className="space-y-6">
            <button
              onClick={() => { setStep('forgot'); setError(''); setVerifyCode(''); }}
              className="flex items-center gap-2 text-gray-500"
            >
              <ArrowLeft size={20} className="rotate-180" />
              חזרה
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">הזן קוד אימות</h2>
              <p className="text-gray-500 mt-1">
                שלחנו קוד בן 4 ספרות ל-
                <span className="font-mono font-bold text-gray-700 mx-1" dir="ltr">
                  {formatPhoneDisplay(phone)}
                </span>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Code Input - 4 boxes */}
            <div className="flex justify-center gap-3" dir="ltr">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={1}
                  value={verifyCode[index] || ''}
                  onChange={(e) => {
                    const digit = e.target.value.replace(/\D/g, '')
                    const newCode = verifyCode.split('')
                    newCode[index] = digit
                    setVerifyCode(newCode.join(''))
                    
                    // Auto-focus next input
                    if (digit && index < 3) {
                      const nextInput = e.target.parentElement?.children[index + 1] as HTMLInputElement
                      nextInput?.focus()
                    }
                  }}
                  onKeyDown={(e) => {
                    // Handle backspace
                    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
                      const prevInput = (e.target as HTMLElement).parentElement?.children[index - 1] as HTMLInputElement
                      prevInput?.focus()
                    }
                  }}
                  className="w-16 h-16 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] focus:border-transparent"
                />
              ))}
            </div>

            <button
              onClick={handleVerifyCode}
              disabled={loading || verifyCode.length !== 4}
              className="w-full py-4 bg-[#33d4ff] text-white rounded-xl font-bold text-lg hover:bg-[#21b8e6] disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'אמת קוד'
              )}
            </button>

            <div className="text-center">
              <p className="text-gray-500 text-sm">לא קיבלת קוד?</p>
              <button
                onClick={handleResendCode}
                disabled={loading}
                className="text-[#33d4ff] font-medium mt-1"
              >
                שלח שוב
              </button>
            </div>
          </div>
        )}

        {/* New Password Step (after forgot) */}
        {step === 'newPassword' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">הגדר סיסמה חדשה</h2>
              <p className="text-gray-500 mt-1">בחר סיסמה חזקה בת 6 תווים לפחות</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סיסמה חדשה</label>
                <div className="relative">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Lock size={20} className="text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="לפחות 6 תווים"
                    className="w-full pr-12 pl-12 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-1"
                  >
                    {showPassword ? (
                      <EyeOff size={20} className="text-gray-400" />
                    ) : (
                      <Eye size={20} className="text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">אימות סיסמה</label>
                <div className="relative">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Lock size={20} className="text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="הזן שוב את הסיסמה"
                    className="w-full pr-12 pl-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSetNewPassword}
              disabled={loading}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  שמור והתחבר
                </>
              )}
            </button>
          </div>
        )}

        {/* First Login - Must Change Password */}
        {step === 'firstLogin' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <KeyRound size={32} className="text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">ברוך הבא!</h2>
              <p className="text-gray-500 mt-1">זו ההתחברות הראשונה שלך</p>
              <p className="text-gray-500">יש להגדיר סיסמה חדשה</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סיסמה חדשה</label>
                <div className="relative">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Lock size={20} className="text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="לפחות 6 תווים"
                    className="w-full pr-12 pl-12 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-1"
                  >
                    {showPassword ? (
                      <EyeOff size={20} className="text-gray-400" />
                    ) : (
                      <Eye size={20} className="text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">אימות סיסמה</label>
                <div className="relative">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Lock size={20} className="text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="הזן שוב את הסיסמה"
                    className="w-full pr-12 pl-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">דרישות סיסמה:</p>
              <ul className="space-y-1 text-sm">
                <li className={`flex items-center gap-2 ${newPassword.length >= 6 ? 'text-emerald-600' : 'text-gray-500'}`}>
                  <CheckCircle2 size={14} />
                  לפחות 6 תווים
                </li>
                <li className={`flex items-center gap-2 ${newPassword === confirmPassword && confirmPassword ? 'text-emerald-600' : 'text-gray-500'}`}>
                  <CheckCircle2 size={14} />
                  סיסמאות תואמות
                </li>
              </ul>
            </div>

            <button
              onClick={handleSetNewPassword}
              disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full py-4 bg-[#33d4ff] text-white rounded-xl font-bold text-lg hover:bg-[#21b8e6] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  המשך לאפליקציה
                  <ArrowLeft size={20} />
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
