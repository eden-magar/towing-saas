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
  Clock,
  Moon,
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
    default_vat_percent: 17,
    working_hours_start: '08:00',
    working_hours_end: '18:00',
    night_hours_start: '22:00',
    night_hours_end: '06:00'
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
          default_vat_percent: settings.default_vat_percent || 17,
          working_hours_start: settings.working_hours_start || '08:00',
          working_hours_end: settings.working_hours_end || '18:00',
          night_hours_start: settings.night_hours_start || '22:00',
          night_hours_end: settings.night_hours_end || '06:00'
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

  // Handle logo delete
  async function handleLogoDelete() {
    if (!companyId) return

    setUploadingLogo(true)
    setError('')

    try {
      await deleteCompanyLogo(companyId)
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

  // Tabs configuration
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'company', label: 'פרטי חברה', icon: <Building2 size={18} /> },
    { id: 'system', label: 'הגדרות מערכת', icon: <Settings size={18} /> },
    { id: 'integrations', label: 'אינטגרציות', icon: <Plug size={18} /> }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500">טוען הגדרות...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">הגדרות</h1>
        <p className="text-gray-500 mt-1">ניהול פרטי החברה והגדרות המערכת</p>
      </div>

      {/* Error / Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            <X size={18} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2">
          <Check size={18} />
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-cyan-600 border-b-2 border-cyan-500 bg-cyan-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Company Details Tab */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              {/* Logo Section */}
              <div className="flex flex-col sm:flex-row items-start gap-6 pb-6 border-b border-gray-200">
                <div className="flex-shrink-0">
                  {companyDetails?.logo_url ? (
                    <div className="relative group">
                      <img
                        src={companyDetails.logo_url}
                        alt="לוגו החברה"
                        className="w-32 h-32 object-contain rounded-xl border border-gray-200"
                      />
                      <button
                        onClick={handleLogoDelete}
                        disabled={uploadingLogo}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                      <ImageIcon size={32} />
                      <span className="text-xs mt-1">אין לוגו</span>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-800 mb-1">לוגו החברה</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    הלוגו יופיע בחשבוניות ובמערכת. מומלץ להעלות תמונה ריבועית.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    {uploadingLogo ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    {uploadingLogo ? 'מעלה...' : 'העלאת לוגו'}
                  </button>
                </div>
              </div>

              {/* Company Details Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FileText size={14} className="inline ml-1" />
                    ח.פ. / עוסק מורשה
                  </label>
                  <input
                    type="text"
                    value={companyForm.business_number}
                    onChange={(e) => setCompanyForm({ ...companyForm, business_number: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="123456789"
                  />
                </div>

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
                    placeholder="03-1234567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail size={14} className="inline ml-1" />
                    אימייל
                  </label>
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="info@company.co.il"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin size={14} className="inline ml-1" />
                    כתובת
                  </label>
                  <input
                    type="text"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="רחוב, עיר"
                  />
                </div>
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

          {/* System Settings Tab */}
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

              {/* Working Hours */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                  <Clock size={18} className="text-cyan-500" />
                  שעות עבודה
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">שעת התחלה</label>
                    <input
                      type="time"
                      value={systemForm.working_hours_start}
                      onChange={(e) => setSystemForm({ ...systemForm, working_hours_start: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">שעת סיום</label>
                    <input
                      type="time"
                      value={systemForm.working_hours_end}
                      onChange={(e) => setSystemForm({ ...systemForm, working_hours_end: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">שעות העבודה הרגילות של החברה</p>
              </div>

              {/* Night Hours */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                  <Moon size={18} className="text-purple-500" />
                  שעות לילה (תעריף מיוחד)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">תחילת תעריף לילה</label>
                    <input
                      type="time"
                      value={systemForm.night_hours_start}
                      onChange={(e) => setSystemForm({ ...systemForm, night_hours_start: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">סיום תעריף לילה</label>
                    <input
                      type="time"
                      value={systemForm.night_hours_end}
                      onChange={(e) => setSystemForm({ ...systemForm, night_hours_end: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">טווח השעות בהן יחול תעריף לילה</p>
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
  )
}