'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'
import {
  ArrowRight,
  Building2,
  Loader2,
  Save
} from 'lucide-react'

interface CompanyData {
  id: string
  name: string
  business_number: string | null
  email: string | null
  phone: string | null
  address: string | null
  website: string | null
  status: string
}

export default function EditCompanyPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<CompanyData | null>(null)

  useEffect(() => {
    loadCompany()
  }, [companyId])

  const loadCompany = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, business_number, email, phone, address, website, status')
      .eq('id', companyId)
      .single()

    if (error) {
      console.error('Error loading company:', error)
      alert('שגיאה בטעינת החברה')
      router.push('/superadmin/companies')
      return
    }

    setFormData(data)
    setLoading(false)
  }

  const updateField = (field: keyof CompanyData, value: string) => {
    if (!formData) return
    setFormData({ ...formData, [field]: value })
  }

  const handleSave = async () => {
    if (!formData) return

    setSaving(true)
    const { error } = await supabase
      .from('companies')
      .update({
        name: formData.name,
        business_number: formData.business_number || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        website: formData.website || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyId)

    setSaving(false)

    if (error) {
      console.error('Error saving company:', error)
      alert('שגיאה בשמירת החברה')
      return
    }

    router.push(`/superadmin/companies/${companyId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!formData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Building2 className="w-16 h-16 text-slate-600" />
        <p className="text-slate-400">החברה לא נמצאה</p>
        <Link href="/superadmin/companies" className="text-violet-400 hover:text-violet-300">
          חזרה לרשימת החברות
        </Link>
      </div>
    )
  }

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
            <Link href={`/superadmin/companies/${companyId}`} className="hover:text-white">
              {formData.name}
            </Link>
            <span>/</span>
            <span className="text-white">עריכה</span>
          </div>

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">עריכת חברה</h1>
            <div className="flex items-center gap-3">
              <Link
                href={`/superadmin/companies/${companyId}`}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium"
              >
                ביטול
              </Link>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 text-white rounded-xl font-medium"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                שמור
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-6">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                שם החברה <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Business Number */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                ח.פ. / ע.מ.
              </label>
              <input
                type="text"
                value={formData.business_number || ''}
                onChange={(e) => updateField('business_number', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                אימייל
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                טלפון
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                כתובת
              </label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => updateField('address', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                אתר אינטרנט
              </label>
              <input
                type="url"
                value={formData.website || ''}
                onChange={(e) => updateField('website', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Status (read-only) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                סטטוס
              </label>
              <div className="px-4 py-3 bg-slate-700 rounded-xl text-slate-300">
                {formData.status === 'active' && 'פעיל'}
                {formData.status === 'trial' && 'תקופת ניסיון'}
                {formData.status === 'suspended' && 'מושעה'}
                {formData.status === 'cancelled' && 'מבוטל'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                לשינוי סטטוס השתמש בכפתורי ההשעיה/הפעלה בדף החברה
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}