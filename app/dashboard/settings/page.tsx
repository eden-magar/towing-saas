'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../lib/AuthContext'
import {
  Building2,
  Settings,
  Plug,
  Save,
  Upload,
  Trash2,
  X,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  FileText,
  Percent,
  CreditCard,
  MessageSquare,
  AlertCircle,
  ImageIcon
} from 'lucide-react'
import {
  getCompanyDetails,
  getCompanySettings,
  updateCompanyDetails,
  updateCompanySettings,
  updateIntegrations,
  uploadCompanyLogo,
  deleteCompanyLogo,
  CompanyDetails,
  CompanySettings
} from '../../lib/queries/settings'

type TabId = 'company' | 'system' | 'integrations'

export default function SettingsPage() {
  const { companyId } = useAuth()
  
  // Data state
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('company')

  // Form state - Company Details
  const [companyForm, setCompanyForm] = useState({
    name: '',
    business_number: '',
    phone: '',
    email: '',
    address: ''
  })

  // Form state - System Settings
  const [systemForm, setSystemForm] = useState({
    default_vat_percent: 18
  })

  // Form state - Integrations
  const [integrationsForm, setIntegrationsForm] = useState({
    kapaset_api_key: '',
    sms_provider: '',
    sms_api_key: ''
  })

  // Password visibility
  const [showKapasetKey, setShowKapasetKey] = useState(false)
  const [showSmsKey, setShowSmsKey] = useState(false)

  // Logo upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Load data
  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId])

  async function loadData() {
    if (!companyId) return
    setLoading(true)
    setError('')

    try {
      const [details, settings] = await Promise.all([
        getCompanyDetails(companyId),
        getCompanySettings(companyId)
      ])

      if (details) {
        setCompanyDetails(details)
        setCompanyForm({
          name: details.name || '',
          business_number: details.business_number || '',
          phone: details.phone || '',
          email: details.email || '',
          address: details.address || ''
        })
      }

      if (settings) {
        setCompanySettings(settings)
        setSystemForm({
          default_vat_percent: settings.default_vat_percent || 18
        })
        setIntegrationsForm({
          kapaset_api_key: settings.kapaset_api_key || '',
          sms_provider: settings.sms_provider || '',
          sms_api_key: settings.sms_api_key || ''
        })
      }
    } catch (err) {
      console.error('Error loading settings:', err)
      setError('שגיאה בטעינת ההגדרות')
    } finally {
      setLoading(false)
    }
  }

  // Save company details
  async function saveCompanyDetails() {
    if (!companyId) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await updateCompanyDetails(companyId, companyForm)
      setSuccess('פרטי החברה נשמרו בהצלחה')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving company details:', err)
      setError('שגיאה בשמירת פרטי החברה')
    } finally {
      setSaving(false)
    }
  }

  // Save system settings
  async function saveSystemSettings() {
    if (!companyId) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await updateCompanySettings(companyId, systemForm)
      setSuccess('הגדרות המערכת נשמרו בהצלחה')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving system settings:', err)
      setError('שגיאה בשמירת הגדרות המערכת')
    } finally {
      setSaving(false)
    }
  }

  // Save integrations
  async function saveIntegrations() {
    if (!companyId) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await updateIntegrations(companyId, integrationsForm)
      setSuccess('האינטגרציות נשמרו בהצלחה')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving integrations:', err)
      setError('שגיאה בשמירת האינטגרציות')
    } finally {
      setSaving(false)
    }
  }

  // Handle logo upload
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !companyId) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('יש להעלות קובץ תמונה בלבד')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('גודל הקובץ חייב להיות עד 2MB')
      return
    }

    setUploadingLogo(true)
    setError('')

    try {
      const logoUrl = await uploadCompanyLogo(companyId, file)
      setCompanyDetails(prev => prev ? { ...prev, logo_url: logoUrl } : null)
      setSuccess('הלוגו הועלה בהצלחה')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error uploading logo:', err)
      setError('שגיאה בהעלאת הלוגו')
    } finally {
      setUploadingLogo(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Delete logo
  async function handleDeleteLogo() {
    if (!companyId || !companyDetails?.logo_url) return

    if (!confirm('האם אתה בטוח שברצונך למחוק את הלוגו?')) return

    setUploadingLogo(true)
    setError('')

    try {
      await deleteCompanyLogo(companyId, companyDetails.logo_url)
      setCompanyDetails(prev => prev ? { ...prev, logo_url: null } : null)
      setSuccess('הלוגו נמחק בהצלחה')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error deleting logo:', err)
      setError('שגיאה במחיקת הלוגו')
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">הגדרות</h1>
            <p className="text-gray-500">ניהול הגדרות החברה והמערכת</p>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <X className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
            <button onClick={() => setError('')} className="mr-auto text-red-500 hover:text-red-700">
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('company')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'company' 
                  ? 'text-cyan-600 border-b-2 border-cyan-500 bg-cyan-50' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Building2 size={18} />
              פרטי חברה
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'system' 
                  ? 'text-cyan-600 border-b-2 border-cyan-500 bg-cyan-50' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Settings size={18} />
              הגדרות מערכת
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'integrations' 
                  ? 'text-cyan-600 border-b-2 border-cyan-500 bg-cyan-50' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Plug size={18} />
              אינטגרציות
            </button>
          </div>

          <div className="p-6">
            {/* Company Tab */}
            {activeTab === 'company' && (
              <div className="space-y-6">
                {/* Logo */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                    <ImageIcon size={18} className="text-cyan-500" />
                    לוגו החברה
                  </h3>
                  <div className="flex items-center gap-4">
                    {companyDetails?.logo_url ? (
                      <div className="relative">
                        <img 
                          src={companyDetails.logo_url} 
                          alt="Company Logo" 
                          className="w-24 h-24 object-contain rounded-xl border border-gray-200 bg-white"
                        />
                        <button
                          onClick={handleDeleteLogo}
                          disabled={uploadingLogo}
                          className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-gray-200 rounded-xl flex items-center justify-center">
                        <ImageIcon size={32} className="text-gray-400" />
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50"
                      >
                        {uploadingLogo ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <Upload size={16} />
                        )}
                        {uploadingLogo ? 'מעלה...' : 'העלה לוגו'}
                      </button>
                      <p className="text-xs text-gray-500 mt-2">PNG, JPG עד 2MB</p>
                    </div>
                  </div>
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Building2 size={14} className="inline ml-1" />
                    שם החברה
                  </label>
                  <input
                    type="text"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="שם החברה"
                  />
                </div>

                {/* Business Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FileText size={14} className="inline ml-1" />
                    ח.פ / עוסק מורשה
                  </label>
                  <input
                    type="text"
                    value={companyForm.business_number}
                    onChange={(e) => setCompanyForm({ ...companyForm, business_number: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="מספר עוסק"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone size={14} className="inline ml-1" />
                    טלפון
                  </label>
                  <input
                    type="tel"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="טלפון החברה"
                    dir="ltr"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail size={14} className="inline ml-1" />
                    דוא"ל
                  </label>
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="כתובת מייל"
                    dir="ltr"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin size={14} className="inline ml-1" />
                    כתובת
                  </label>
                  <input
                    type="text"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="כתובת החברה"
                  />
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={saveCompanyDetails}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    {saving ? 'שומר...' : 'שמור שינויים'}
                  </button>
                </div>
              </div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && (
              <div className="space-y-6">
                {/* VAT */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Percent size={14} className="inline ml-1" />
                    אחוז מע"מ
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={systemForm.default_vat_percent}
                      onChange={(e) => setSystemForm({ ...systemForm, default_vat_percent: parseFloat(e.target.value) || 0 })}
                      className="w-32 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">אחוז מע"מ ברירת מחדל לחשבוניות</p>
                </div>

                {/* Info box about time surcharges */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">הגדרת שעות עבודה ותוספות זמן</p>
                      <p className="text-sm text-blue-700 mt-1">
                        הגדרות תוספות זמן (שעות ערב, לילה, שבת, חג) נמצאות כעת בדף המחירונים, תחת טאב "תוספות".
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={saveSystemSettings}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    {saving ? 'שומר...' : 'שמור שינויים'}
                  </button>
                </div>
              </div>
            )}

            {/* Integrations Tab */}
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                {/* Kapaset */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                    <CreditCard size={18} className="text-emerald-500" />
                    כספית (הפקת חשבוניות)
                  </h3>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">API Key</label>
                    <div className="relative">
                      <input
                        type={showKapasetKey ? 'text' : 'password'}
                        value={integrationsForm.kapaset_api_key}
                        onChange={(e) => setIntegrationsForm({ ...integrationsForm, kapaset_api_key: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 pl-12"
                        placeholder="הכנס API Key מכספית"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKapasetKey(!showKapasetKey)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showKapasetKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      ניתן לקבל את ה-API Key מהגדרות החשבון בכספית
                    </p>
                  </div>
                </div>

                {/* SMS */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                    <MessageSquare size={18} className="text-blue-500" />
                    שליחת SMS
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">ספק SMS</label>
                      <select
                        value={integrationsForm.sms_provider}
                        onChange={(e) => setIntegrationsForm({ ...integrationsForm, sms_provider: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">בחר ספק...</option>
                        <option value="inforu">InforU</option>
                        <option value="sms4free">SMS4Free</option>
                        <option value="019sms">019 SMS</option>
                        <option value="other">אחר</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">API Key</label>
                      <div className="relative">
                        <input
                          type={showSmsKey ? 'text' : 'password'}
                          value={integrationsForm.sms_api_key}
                          onChange={(e) => setIntegrationsForm({ ...integrationsForm, sms_api_key: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 pl-12"
                          placeholder="הכנס API Key"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmsKey(!showSmsKey)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showSmsKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">שים לב</p>
                      <p className="text-sm text-blue-700 mt-1">
                        מפתחות ה-API נשמרים בצורה מאובטחת. ודא שאתה משתמש במפתחות של חשבון הייצור ולא של סביבת הבדיקות.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={saveIntegrations}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    {saving ? 'שומר...' : 'שמור שינויים'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
