'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  getSubscriptionPlans,
  createCompany,
  type SubscriptionPlan
} from '../../../lib/superadmin'
import { supabase } from '../../../lib/supabase'
import {
  ArrowRight,
  ArrowLeft,
  Building2,
  Package,
  UserPlus,
  CheckCircle,
  Loader2,
  Check,
  Users,
  Truck,
  FileText,
  Zap,
  Mail,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react'

type Step = 1 | 2 | 3 | 4

interface FormData {
  // Step 1 - Company Info
  name: string
  business_number: string
  email: string
  phone: string
  address: string
  website: string
  
  // Step 2 - Plan
  plan_id: string
  
  // Step 3 - Admin
  admin_name: string
  admin_email: string
  admin_phone: string
  send_invite: boolean
  admin_password: string
}

export default function NewCompanyPage() {
  const router = useRouter()
  
  const [step, setStep] = useState<Step>(1)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [checkingBN, setCheckingBN] = useState(false)
  const [bnError, setBnError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    business_number: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    plan_id: '',
    admin_name: '',
    admin_email: '',
    admin_phone: '',
    send_invite: true,
    admin_password: ''
  })

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    const data = await getSubscriptionPlans()
    setPlans(data)
    // Set default to Pro
    const proPlan = data.find(p => p.name === 'pro')
    if (proPlan) {
      setFormData(prev => ({ ...prev, plan_id: proPlan.id }))
    }
  }

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const checkBusinessNumber = async (bn: string) => {
    if (!bn || bn.length < 5) return
    
    setCheckingBN(true)
    setBnError('')
    
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .eq('business_number', bn)
      .single()
    
    if (data) {
      setBnError('מספר ח.פ. כבר קיים במערכת')
    }
    
    setCheckingBN(false)
  }

  const validateStep = (currentStep: Step): boolean => {
    switch (currentStep) {
      case 1:
        if (!formData.name.trim()) {
          alert('נא להזין שם חברה')
          return false
        }
        if (!formData.email.trim()) {
          alert('נא להזין אימייל')
          return false
        }
        if (bnError) {
          alert('מספר ח.פ. כבר קיים במערכת')
          return false
        }
        return true
      case 2:
        if (!formData.plan_id) {
          alert('נא לבחור חבילה')
          return false
        }
        return true
      case 3:
        if (!formData.admin_name.trim()) {
          alert('נא להזין שם מנהל')
          return false
        }
        if (!formData.admin_email.trim()) {
          alert('נא להזין אימייל מנהל')
          return false
        }
        if (!formData.send_invite && !formData.admin_password) {
          alert('נא להזין סיסמה או לבחור שליחת הזמנה')
          return false
        }
        return true
      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((step + 1) as Step)
    }
  }

  const prevStep = () => {
    setStep((step - 1) as Step)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await createCompany({
        name: formData.name,
        business_number: formData.business_number || undefined,
        phone: formData.phone || undefined,
        email: formData.email,
        address: formData.address || undefined,
        website: formData.website || undefined,
        plan_id: formData.plan_id,
        admin_name: formData.admin_name,
        admin_email: formData.admin_email,
        admin_phone: formData.admin_phone || undefined,
        send_invite: formData.send_invite,
        admin_password: formData.admin_password || undefined
      })
      
      router.push('/superadmin/companies')
    } catch (error: any) {
      console.error('Error creating company:', error)
      alert(error.message || 'שגיאה ביצירת החברה')
    } finally {
      setLoading(false)
    }
  }

  const selectedPlan = plans.find(p => p.id === formData.plan_id)

  const steps = [
    { num: 1, label: 'פרטי חברה', icon: Building2 },
    { num: 2, label: 'בחירת חבילה', icon: Package },
    { num: 3, label: 'מנהל ראשי', icon: UserPlus },
    { num: 4, label: 'סיכום', icon: CheckCircle },
  ]

  return (
    <div>
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700">
        <div className="px-6 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
            <Link href="/superadmin/companies" className="hover:text-white flex items-center gap-1">
              <ArrowRight size={16} />
              חברות
            </Link>
            <span>/</span>
            <span className="text-white">הוספת חברה חדשה</span>
          </div>

          <h1 className="text-2xl font-bold text-white">הוספת חברה חדשה</h1>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="px-6 py-6 border-b border-slate-700">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => {
              const Icon = s.icon
              const isActive = step === s.num
              const isCompleted = step > s.num
              
              return (
                <div key={s.num} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isCompleted ? 'bg-emerald-500' :
                      isActive ? 'bg-violet-600' :
                      'bg-slate-700'
                    }`}>
                      {isCompleted ? (
                        <Check size={24} className="text-white" />
                      ) : (
                        <Icon size={24} className={isActive ? 'text-white' : 'text-slate-400'} />
                      )}
                    </div>
                    <span className={`text-sm mt-2 ${
                      isActive ? 'text-white font-medium' : 'text-slate-500'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-24 h-1 mx-4 rounded ${
                      step > s.num ? 'bg-emerald-500' : 'bg-slate-700'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          {/* Step 1: Company Info */}
          {step === 1 && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <h2 className="text-xl font-bold text-white mb-6">פרטי חברה</h2>
              
              <div className="space-y-4">
                {/* Company Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    שם החברה <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="לדוגמה: גרירות ישראל בע״מ"
                  />
                </div>

                {/* Business Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    ח.פ. / ע.מ.
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.business_number}
                      onChange={(e) => {
                        updateField('business_number', e.target.value)
                        checkBusinessNumber(e.target.value)
                      }}
                      className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                        bnError ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-violet-500'
                      }`}
                      placeholder="512345678"
                    />
                    {checkingBN && (
                      <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-slate-400" />
                    )}
                  </div>
                  {bnError && (
                    <p className="text-red-400 text-sm mt-1">{bnError}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    אימייל <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="info@company.co.il"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    טלפון
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="03-1234567"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    כתובת
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="רחוב, עיר"
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    אתר אינטרנט
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => updateField('website', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="https://www.company.co.il"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Plan Selection */}
          {step === 2 && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <h2 className="text-xl font-bold text-white mb-6">בחירת חבילה</h2>
              
              <div className="grid grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const isSelected = formData.plan_id === plan.id
                  const isPopular = plan.name === 'pro'
                  
                  return (
                    <div
                      key={plan.id}
                      onClick={() => updateField('plan_id', plan.id)}
                      className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-violet-500 bg-violet-500/10' 
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-violet-600 text-white text-xs font-medium rounded-full">
                          פופולרי
                        </div>
                      )}
                      
                      {isSelected && (
                        <div className="absolute top-3 left-3 w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center">
                          <Check size={14} className="text-white" />
                        </div>
                      )}

                      <h3 className="text-lg font-bold text-white mb-1">{plan.display_name}</h3>
                      <div className="mb-4">
                        <span className="text-2xl font-bold text-white">₪{plan.price_monthly}</span>
                        <span className="text-slate-400 text-sm">/חודש</span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Users size={14} className="text-slate-500" />
                          <span>עד {plan.max_users || '∞'} משתמשים</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Truck size={14} className="text-slate-500" />
                          <span>עד {plan.max_drivers || '∞'} נהגים</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <FileText size={14} className="text-slate-500" />
                          <span>{plan.max_tows_per_month || '∞'} גרירות/חודש</span>
                        </div>
                      </div>

                      {plan.features && plan.features.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                          {plan.features.slice(0, 4).map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-slate-400">
                              <Zap size={12} className="text-violet-400" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 p-4 bg-slate-700/50 rounded-xl">
                <p className="text-sm text-slate-400">
                  <span className="text-amber-400">💡</span>
                  {' '}כל החברות החדשות מקבלות <span className="text-white font-medium">14 ימי ניסיון חינם</span> לחבילה שנבחרה.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Admin User */}
          {step === 3 && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <h2 className="text-xl font-bold text-white mb-6">יצירת מנהל ראשי</h2>
              
              <div className="space-y-4">
                {/* Admin Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    שם מלא <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.admin_name}
                    onChange={(e) => updateField('admin_name', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="ישראל ישראלי"
                  />
                </div>

                {/* Admin Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    אימייל <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.admin_email}
                    onChange={(e) => updateField('admin_email', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="admin@company.co.il"
                  />
                </div>

                {/* Admin Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    טלפון
                  </label>
                  <input
                    type="tel"
                    value={formData.admin_phone}
                    onChange={(e) => updateField('admin_phone', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="050-1234567"
                  />
                </div>

                {/* Invite Option */}
                <div className="p-4 bg-slate-700/50 rounded-xl space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="invite_method"
                      checked={formData.send_invite}
                      onChange={() => updateField('send_invite', true)}
                      className="w-5 h-5 text-violet-600 bg-slate-700 border-slate-600 focus:ring-violet-500"
                    />
                    <div>
                      <p className="text-white font-medium">שלח הזמנה באימייל</p>
                      <p className="text-sm text-slate-400">המנהל יקבל אימייל עם קישור להגדרת סיסמה</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="invite_method"
                      checked={!formData.send_invite}
                      onChange={() => updateField('send_invite', false)}
                      className="w-5 h-5 text-violet-600 bg-slate-700 border-slate-600 focus:ring-violet-500"
                    />
                    <div>
                      <p className="text-white font-medium">הגדר סיסמה ידנית</p>
                      <p className="text-sm text-slate-400">תגדיר סיסמה עכשיו ותעביר אותה למנהל</p>
                    </div>
                  </label>
                </div>

                {/* Password Field */}
                {!formData.send_invite && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      סיסמה <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.admin_password}
                        onChange={(e) => updateField('admin_password', e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 pl-12 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        placeholder="לפחות 8 תווים"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Summary */}
          {step === 4 && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <h2 className="text-xl font-bold text-white mb-6">סיכום</h2>
              
              <div className="space-y-6">
                {/* Company Summary */}
                <div className="p-4 bg-slate-700/50 rounded-xl">
                  <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Building2 size={18} className="text-violet-400" />
                    פרטי חברה
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-400">שם:</span>
                      <span className="text-white mr-2">{formData.name}</span>
                    </div>
                    {formData.business_number && (
                      <div>
                        <span className="text-slate-400">ח.פ.:</span>
                        <span className="text-white mr-2">{formData.business_number}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400">אימייל:</span>
                      <span className="text-white mr-2">{formData.email}</span>
                    </div>
                    {formData.phone && (
                      <div>
                        <span className="text-slate-400">טלפון:</span>
                        <span className="text-white mr-2">{formData.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plan Summary */}
                <div className="p-4 bg-slate-700/50 rounded-xl">
                  <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Package size={18} className="text-violet-400" />
                    חבילה
                  </h3>
                  {selectedPlan && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{selectedPlan.display_name}</p>
                        <p className="text-sm text-slate-400">
                          {selectedPlan.max_users || '∞'} משתמשים • {selectedPlan.max_drivers || '∞'} נהגים
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-xl font-bold text-white">₪{selectedPlan.price_monthly}</p>
                        <p className="text-xs text-slate-400">לחודש</p>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-400">
                      🎁 14 ימי ניסיון חינם
                    </p>
                  </div>
                </div>

                {/* Admin Summary */}
                <div className="p-4 bg-slate-700/50 rounded-xl">
                  <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                    <UserPlus size={18} className="text-violet-400" />
                    מנהל ראשי
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-400">שם:</span>
                      <span className="text-white mr-2">{formData.admin_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">אימייל:</span>
                      <span className="text-white mr-2">{formData.admin_email}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    {formData.send_invite ? (
                      <>
                        <Mail size={14} className="text-blue-400" />
                        <span className="text-blue-400">תישלח הזמנה באימייל</span>
                      </>
                    ) : (
                      <>
                        <Lock size={14} className="text-emerald-400" />
                        <span className="text-emerald-400">סיסמה הוגדרה ידנית</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 w-5 h-5 text-violet-600 bg-slate-700 border-slate-600 rounded focus:ring-violet-500"
                    required
                  />
                  <span className="text-sm text-slate-400">
                    אני מאשר/ת שקראתי והבנתי את{' '}
                    <a href="#" className="text-violet-400 hover:text-violet-300">תנאי השימוש</a>
                    {' '}ואת{' '}
                    <a href="#" className="text-violet-400 hover:text-violet-300">מדיניות הפרטיות</a>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-6">
            {step > 1 ? (
              <button
                onClick={prevStep}
                className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
              >
                <ArrowRight size={18} />
                הקודם
              </button>
            ) : (
              <Link
                href="/superadmin/companies"
                className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
              >
                ביטול
              </Link>
            )}

            {step < 4 ? (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors"
              >
                הבא
                <ArrowLeft size={18} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white rounded-xl font-medium transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    יוצר חברה...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    צור חברה
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}