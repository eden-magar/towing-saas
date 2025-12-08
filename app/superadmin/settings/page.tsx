'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getSubscriptionPlans, updateSubscriptionPlan, getAuditLog, type SubscriptionPlan } from '../../lib/superadmin'
import {
  Settings,
  Package,
  Key,
  FileText,
  Server,
  Loader2,
  Save,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  RefreshCw,
  AlertTriangle,
  Shield,
  Database,
  Wifi,
  Mail
} from 'lucide-react'

type TabType = 'plans' | 'api_keys' | 'audit_log' | 'system'

interface ApiKey {
  key: string
  name: string
  value: string
  status: 'active' | 'inactive' | 'error'
  description: string
}

interface AuditLogEntry {
  id: string
  user_id: string
  action: string
  table_name: string | null
  old_values: any
  new_values: any
  created_at: string
  user?: {
    full_name: string
    email: string
  }
}

export default function SuperAdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('plans')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Plans
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [showApiKey, setShowApiKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [tempKeyValue, setTempKeyValue] = useState('')

  // Audit Log
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  // System
  const [maintenanceMode, setMaintenanceMode] = useState(false)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'plans') {
        const data = await getSubscriptionPlans()
        setPlans(data)
      } else if (activeTab === 'api_keys') {
        await loadApiKeys()
      } else if (activeTab === 'audit_log') {
        await loadAuditLog()
      } else if (activeTab === 'system') {
        await loadSystemSettings()
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadApiKeys = async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('*')
      .like('key', '%api_key%')

    const keys: ApiKey[] = [
      { key: 'google_maps_api_key', name: 'Google Maps API', value: '', status: 'inactive', description: 'מפות וניווט' },
      { key: 'sms_api_key', name: 'SMS Gateway', value: '', status: 'inactive', description: 'שליחת הודעות SMS' },
      { key: 'mot_api_key', name: 'משרד התחבורה API', value: '', status: 'inactive', description: 'שליפת פרטי רכב' },
      { key: 'email_api_key', name: 'Email Service', value: '', status: 'inactive', description: 'שליחת מיילים' },
    ]

    // Merge with existing data
    data?.forEach((setting) => {
      const keyIndex = keys.findIndex(k => k.key === setting.key)
      if (keyIndex >= 0) {
        keys[keyIndex].value = setting.value?.value || ''
        keys[keyIndex].status = setting.value?.value ? 'active' : 'inactive'
      }
    })

    setApiKeys(keys)
  }

  const saveApiKey = async (keyName: string, value: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: keyName,
          value: { value },
          description: apiKeys.find(k => k.key === keyName)?.description,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' })

      if (error) throw error

      setEditingKey(null)
      setTempKeyValue('')
      await loadApiKeys()
    } catch (error) {
      console.error('Error saving API key:', error)
      alert('שגיאה בשמירת המפתח')
    } finally {
      setSaving(false)
    }
  }

  const loadAuditLog = async () => {
    setAuditLoading(true)
    try {
      const data = await getAuditLog({ limit: 50 })
      setAuditLog(data)
    } catch (error) {
      console.error('Error loading audit log:', error)
    } finally {
      setAuditLoading(false)
    }
  }

  const loadSystemSettings = async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', 'maintenance_mode')
      .single()

    setMaintenanceMode(data?.value?.enabled || false)
  }

  const toggleMaintenanceMode = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'maintenance_mode',
          value: { enabled: !maintenanceMode },
          description: 'מצב תחזוקה - חוסם גישה למערכת',
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' })

      if (error) throw error
      setMaintenanceMode(!maintenanceMode)
    } catch (error) {
      console.error('Error toggling maintenance mode:', error)
      alert('שגיאה בשינוי מצב תחזוקה')
    } finally {
      setSaving(false)
    }
  }

  const savePlan = async () => {
    if (!editingPlan) return
    setSaving(true)
    try {
      await updateSubscriptionPlan(editingPlan.id, {
        display_name: editingPlan.display_name,
        price_monthly: editingPlan.price_monthly,
        price_yearly: editingPlan.price_yearly,
        max_users: editingPlan.max_users,
        max_drivers: editingPlan.max_drivers,
        max_trucks: editingPlan.max_trucks,
        max_tows_per_month: editingPlan.max_tows_per_month
      })
      setEditingPlan(null)
      await loadData()
    } catch (error) {
      console.error('Error saving plan:', error)
      alert('שגיאה בשמירת החבילה')
    } finally {
      setSaving(false)
    }
  }

  const getActionName = (action: string) => {
    const actions: Record<string, string> = {
      'INSERT': 'יצירה',
      'UPDATE': 'עדכון',
      'DELETE': 'מחיקה',
      'company_suspended': 'השעיית חברה',
      'company_activated': 'הפעלת חברה',
      'impersonation_started': 'התחלת התחזות',
      'impersonation_ended': 'סיום התחזות'
    }
    return actions[action] || action
  }

  const tabs = [
    { id: 'plans', label: 'חבילות', icon: Package },
    { id: 'api_keys', label: 'מפתחות API', icon: Key },
    { id: 'audit_log', label: 'לוג פעילות', icon: FileText },
    { id: 'system', label: 'מערכת', icon: Server },
  ]

  return (
    <div>
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-40 backdrop-blur">
        <div className="px-6 py-4">
          <h2 className="text-2xl font-bold text-white">הגדרות</h2>
          <p className="text-slate-400 text-sm">ניהול הגדרות הפלטפורמה</p>
        </div>

        {/* Tabs */}
        <div className="px-6 flex items-center gap-1 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : (
          <>
            {/* Plans Tab */}
            {activeTab === 'plans' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">ניהול חבילות</h3>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
                    >
                      {/* Plan Header */}
                      <div className={`p-4 ${
                        plan.name === 'enterprise' ? 'bg-violet-500/20' :
                        plan.name === 'pro' ? 'bg-blue-500/20' :
                        'bg-slate-700/50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold text-white">{plan.display_name}</h4>
                          <button
                            onClick={() => setEditingPlan(plan)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-bold text-white">₪{plan.price_monthly}</span>
                          <span className="text-slate-400 text-sm">/חודש</span>
                        </div>
                      </div>

                      {/* Plan Details */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">משתמשים</span>
                          <span className="text-white">{plan.max_users || '∞'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">נהגים</span>
                          <span className="text-white">{plan.max_drivers || '∞'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">משאיות</span>
                          <span className="text-white">{plan.max_trucks || '∞'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">גרירות/חודש</span>
                          <span className="text-white">{plan.max_tows_per_month || '∞'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">מחיר שנתי</span>
                          <span className="text-white">₪{plan.price_yearly || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Edit Plan Modal */}
                {editingPlan && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md">
                      <h3 className="text-lg font-bold text-white mb-4">עריכת חבילה - {editingPlan.display_name}</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">שם תצוגה</label>
                          <input
                            type="text"
                            value={editingPlan.display_name}
                            onChange={(e) => setEditingPlan({...editingPlan, display_name: e.target.value})}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-slate-400 mb-1">מחיר חודשי</label>
                            <input
                              type="number"
                              value={editingPlan.price_monthly}
                              onChange={(e) => setEditingPlan({...editingPlan, price_monthly: parseFloat(e.target.value)})}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-400 mb-1">מחיר שנתי</label>
                            <input
                              type="number"
                              value={editingPlan.price_yearly || ''}
                              onChange={(e) => setEditingPlan({...editingPlan, price_yearly: parseFloat(e.target.value) || null})}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-slate-400 mb-1">מקס משתמשים</label>
                            <input
                              type="number"
                              value={editingPlan.max_users || ''}
                              onChange={(e) => setEditingPlan({...editingPlan, max_users: parseInt(e.target.value) || null})}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                              placeholder="∞"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-400 mb-1">מקס נהגים</label>
                            <input
                              type="number"
                              value={editingPlan.max_drivers || ''}
                              onChange={(e) => setEditingPlan({...editingPlan, max_drivers: parseInt(e.target.value) || null})}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                              placeholder="∞"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-slate-400 mb-1">מקס משאיות</label>
                            <input
                              type="number"
                              value={editingPlan.max_trucks || ''}
                              onChange={(e) => setEditingPlan({...editingPlan, max_trucks: parseInt(e.target.value) || null})}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                              placeholder="∞"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-400 mb-1">גרירות/חודש</label>
                            <input
                              type="number"
                              value={editingPlan.max_tows_per_month || ''}
                              onChange={(e) => setEditingPlan({...editingPlan, max_tows_per_month: parseInt(e.target.value) || null})}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                              placeholder="∞"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-6">
                        <button
                          onClick={() => setEditingPlan(null)}
                          className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                        >
                          ביטול
                        </button>
                        <button
                          onClick={savePlan}
                          disabled={saving}
                          className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center justify-center gap-2"
                        >
                          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                          שמור
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* API Keys Tab */}
            {activeTab === 'api_keys' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white">מפתחות API</h3>

                <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700">
                  {apiKeys.map((apiKey) => (
                    <div key={apiKey.key} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          apiKey.status === 'active' ? 'bg-emerald-500/20' : 'bg-slate-700'
                        }`}>
                          <Key size={20} className={apiKey.status === 'active' ? 'text-emerald-400' : 'text-slate-500'} />
                        </div>
                        <div>
                          <p className="font-medium text-white">{apiKey.name}</p>
                          <p className="text-sm text-slate-400">{apiKey.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Status Badge */}
                        <span className={`px-2 py-1 text-xs font-medium rounded-lg ${
                          apiKey.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {apiKey.status === 'active' ? 'פעיל' : 'לא מוגדר'}
                        </span>

                        {/* Key Value */}
                        {editingKey === apiKey.key ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tempKeyValue}
                              onChange={(e) => setTempKeyValue(e.target.value)}
                              className="w-64 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
                              placeholder="הזן מפתח API..."
                            />
                            <button
                              onClick={() => saveApiKey(apiKey.key, tempKeyValue)}
                              disabled={saving}
                              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                            >
                              {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                            </button>
                            <button
                              onClick={() => { setEditingKey(null); setTempKeyValue('') }}
                              className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {apiKey.value && (
                              <>
                                <code className="text-sm text-slate-400 font-mono">
                                  {showApiKey === apiKey.key ? apiKey.value : '••••••••••••'}
                                </code>
                                <button
                                  onClick={() => setShowApiKey(showApiKey === apiKey.key ? null : apiKey.key)}
                                  className="p-1 text-slate-400 hover:text-white"
                                >
                                  {showApiKey === apiKey.key ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => { setEditingKey(apiKey.key); setTempKeyValue(apiKey.value) }}
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                            >
                              <Pencil size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Log Tab */}
            {activeTab === 'audit_log' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">לוג פעילות</h3>
                  <button
                    onClick={loadAuditLog}
                    disabled={auditLoading}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                  >
                    <RefreshCw size={16} className={auditLoading ? 'animate-spin' : ''} />
                    רענן
                  </button>
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  {auditLog.length > 0 ? (
                    <div className="divide-y divide-slate-700">
                      {auditLog.map((log) => (
                        <div key={log.id} className="p-4 flex items-start gap-4">
                          <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                            <Shield size={18} className="text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white">
                              <span className="font-medium">{log.user?.full_name || log.user?.email || 'מערכת'}</span>
                              {' '}ביצע{' '}
                              <span className="text-violet-400">{getActionName(log.action)}</span>
                              {log.table_name && (
                                <span className="text-slate-400"> ב-{log.table_name}</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {new Date(log.created_at).toLocaleString('he-IL')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">אין פעילות</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && (
              <div className="space-y-6">
                {/* System Status */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">סטטוס מערכת</h3>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { name: 'API Server', icon: Server, status: 'operational' },
                      { name: 'Database', icon: Database, status: 'operational' },
                      { name: 'Google Maps', icon: Wifi, status: 'operational' },
                      { name: 'Email Service', icon: Mail, status: 'operational' },
                    ].map((service) => {
                      const Icon = service.icon
                      return (
                        <div key={service.name} className="bg-slate-700/50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Icon size={20} className="text-slate-400" />
                            <span className={`w-2 h-2 rounded-full ${
                              service.status === 'operational' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}></span>
                          </div>
                          <p className="font-medium text-white">{service.name}</p>
                          <p className="text-xs text-emerald-400">פעיל</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Maintenance Mode */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        maintenanceMode ? 'bg-amber-500/20' : 'bg-slate-700'
                      }`}>
                        <AlertTriangle size={24} className={maintenanceMode ? 'text-amber-400' : 'text-slate-500'} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white">מצב תחזוקה</h4>
                        <p className="text-sm text-slate-400">כאשר מופעל, המערכת חסומה לכל המשתמשים חוץ מ-Super Admin</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleMaintenanceMode}
                      disabled={saving}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        maintenanceMode ? 'bg-amber-500' : 'bg-slate-600'
                      }`}
                    >
                      <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${
                        maintenanceMode ? 'right-1' : 'left-1'
                      }`}></span>
                    </button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-6">
                  <h3 className="text-lg font-bold text-red-400 mb-4">אזור מסוכן</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">מחיקת כל הנתונים</p>
                        <p className="text-sm text-slate-400">פעולה זו בלתי הפיכה!</p>
                      </div>
                      <button
                        disabled
                        className="px-4 py-2 bg-red-600/50 text-red-300 rounded-lg cursor-not-allowed"
                      >
                        לא זמין
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}