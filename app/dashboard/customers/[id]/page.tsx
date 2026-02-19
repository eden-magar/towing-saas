'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/AuthContext'
import {
  ArrowRight,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  Shield,
  Eye,
  UserCheck,
  UserX,
  Copy,
  Check,
  Settings
} from 'lucide-react'
import { supabase } from '@/app/lib/supabase'
import {
  getCustomerUsers,
  createCustomerUser,
  updateCustomerUserRole,
  toggleCustomerUserActive,
  deleteCustomerUser,
} from '@/app/lib/queries/customer-portal'
import type { CustomerUserWithDetails } from '@/app/lib/types'

interface CustomerDetail {
  id: string
  name: string
  customer_type: 'private' | 'business'
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  company_relation: {
    id: string
    payment_terms: 'immediate' | 'monthly'
    credit_limit: number | null
    discount_percent: number | null
    notes: string | null
    is_active: boolean
  } | null
}

const roleLabels: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'מנהל', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  manager: { label: 'מנהל תפעול', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  viewer: { label: 'צפייה', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { companyId } = useAuth()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [customerUsers, setCustomerUsers] = useState<CustomerUserWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'settings'>('info')
  const [portalSettings, setPortalSettings] = useState<Record<string, boolean>>({})

  // Modal states
  const [showAddUser, setShowAddUser] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)

  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'viewer' as 'admin' | 'manager' | 'viewer',
  })

  useEffect(() => {
    if (companyId && customerId) {
      loadData()
    }
  }, [companyId, customerId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load customer details
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select(`
          id, name, customer_type, id_number, phone, email, address, notes, created_at, portal_settings,
          customer_company (
            id, payment_terms, credit_limit, discount_percent, notes, is_active
          )
        `)
        .eq('id', customerId)
        .single()

      if (custError || !custData) {
        router.push('/dashboard/customers')
        return
      }

      const companyRelations = custData.customer_company as any[]
      const relation = companyRelations?.find((r: any) => r.is_active) || companyRelations?.[0] || null

      setCustomer({
        ...custData,
        customer_type: custData.customer_type as 'private' | 'business',
        company_relation: relation,
      })
      setPortalSettings((custData as { portal_settings?: Record<string, boolean> }).portal_settings || {})

      // Load customer users
      const users = await getCustomerUsers(customerId)
      setCustomerUsers(users)
    } catch (err) {
      console.error('Error loading customer:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    if (!newUserForm.fullName || !newUserForm.email) return

    setSaving(true)
    setError('')

    try {
      await createCustomerUser(
        newUserForm.email,
        newUserForm.fullName,
        newUserForm.phone || null,
        customerId,
        newUserForm.role
      )

      await loadData()
      setNewUserForm({ fullName: '', email: '', phone: '', role: 'viewer' })
      setShowAddUser(false)
      // TODO: אפשר להוסיף toast notification
    } catch (err: any) {
      setError(err.message || 'שגיאה ביצירת המשתמש')
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (customerUserId: string, newRole: 'admin' | 'manager' | 'viewer') => {
    try {
      await updateCustomerUserRole(customerUserId, newRole)
      await loadData()
    } catch (err) {
      console.error('Error updating role:', err)
    }
  }

  const handleToggleActive = async (customerUserId: string, currentActive: boolean) => {
    try {
      await toggleCustomerUserActive(customerUserId, !currentActive)
      await loadData()
    } catch (err) {
      console.error('Error toggling active:', err)
    }
  }

  const handleDeleteUser = async (customerUserId: string) => {
    try {
      await deleteCustomerUser(customerUserId)
      setShowDeleteConfirm(null)
      await loadData()
    } catch (err) {
      console.error('Error deleting user:', err)
    }
  }

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword)
      setCopiedPassword(true)
      setTimeout(() => setCopiedPassword(false), 2000)
    }
  }

  const handlePortalSettingChange = async (key: string, value: boolean) => {
    const newSettings = { ...portalSettings, [key]: value }
    setPortalSettings(newSettings)
    try {
      await supabase
        .from('customers')
        .update({ portal_settings: newSettings })
        .eq('id', customerId)
    } catch (err) {
      console.error('Error updating portal settings:', err)
      setPortalSettings(portalSettings)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#33d4ff]" />
      </div>
    )
  }

  if (!customer) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/customers')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowRight size={16} />
          חזרה לרשימת לקוחות
        </button>

        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
            customer.customer_type === 'business' ? 'bg-purple-100' : 'bg-blue-100'
          }`}>
            {customer.customer_type === 'business' ? (
              <Building2 size={28} className="text-purple-600" />
            ) : (
              <User size={28} className="text-blue-600" />
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{customer.name}</h1>
            <p className="text-sm text-gray-500">
              {customer.customer_type === 'business' ? 'לקוח עסקי' : 'לקוח פרטי'}
              {customer.id_number && ` · ${customer.customer_type === 'business' ? 'ח.פ' : 'ת.ז'}: ${customer.id_number}`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-200 p-1 w-fit">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'info'
              ? 'bg-[#33d4ff] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText size={16} />
          פרטים
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'bg-[#33d4ff] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Users size={16} />
          משתמשי פורטל
          {customerUsers.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'users' ? 'bg-white/20' : 'bg-gray-200'
            }`}>
              {customerUsers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-[#33d4ff] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Settings size={16} />
          הגדרות פורטל
        </button>
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Contact Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-4">פרטי התקשרות</h2>
            <div className="space-y-3">
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Phone size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">טלפון</p>
                    <a href={`tel:${customer.phone}`} className="text-[#33d4ff] font-medium">
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Mail size={16} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">אימייל</p>
                    <a href={`mailto:${customer.email}`} className="text-[#33d4ff] font-medium">
                      {customer.email}
                    </a>
                  </div>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                    <MapPin size={16} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">כתובת</p>
                    <p className="text-gray-800">{customer.address}</p>
                  </div>
                </div>
              )}
              {!customer.phone && !customer.email && !customer.address && (
                <p className="text-gray-400 text-sm">לא הוזנו פרטי התקשרות</p>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-4">תנאי תשלום</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                  <CreditCard size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">תנאי תשלום</p>
                  <p className="text-gray-800 font-medium">
                    {customer.company_relation?.payment_terms === 'monthly' ? 'שוטף + 30' : 'מיידי'}
                  </p>
                </div>
              </div>
              {customer.company_relation?.credit_limit && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
                    <CreditCard size={16} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">תקרת אשראי</p>
                    <p className="text-gray-800 font-medium">
                      {customer.company_relation.credit_limit.toLocaleString()} ש״ח
                    </p>
                  </div>
                </div>
              )}
              {customer.company_relation?.discount_percent && (
                <div>
                  <p className="text-xs text-gray-500">הנחה</p>
                  <p className="text-gray-800 font-medium">{customer.company_relation.discount_percent}%</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
              <h2 className="font-bold text-gray-800 mb-2">הערות</h2>
              <p className="text-gray-600 text-sm">{customer.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Add User Button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              משתמשים אלו יכולים להתחבר לפורטל הלקוח ולצפות בגרירות
            </p>
            <button
              onClick={() => {
                setShowAddUser(true)
                setError('')
                setTempPassword(null)
              }}
              className="flex items-center gap-2 bg-[#33d4ff] text-white px-4 py-2.5 rounded-xl hover:bg-[#21b8e6] transition-colors font-medium text-sm"
            >
              <Plus size={18} />
              הוסף משתמש
            </button>
          </div>

          {/* Users List */}
          {customerUsers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Users size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-1">אין משתמשי פורטל</p>
              <p className="text-sm text-gray-400">הוסף משתמשים כדי לאפשר ללקוח גישה לפורטל</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {customerUsers.map((cu) => {
                  const roleCfg = roleLabels[cu.role] || roleLabels.viewer

                  return (
                    <div key={cu.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            cu.is_active ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <User size={20} className={cu.is_active ? 'text-blue-600' : 'text-gray-400'} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${cu.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
                                {cu.user?.full_name || 'ללא שם'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${roleCfg.bg} ${roleCfg.color}`}>
                                {roleCfg.label}
                              </span>
                              {!cu.is_active && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                  מושבת
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                              <span>{cu.user?.email}</span>
                              {cu.user?.phone && <span>{cu.user.phone}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Role Select */}
                          <select
                            value={cu.role}
                            onChange={(e) => handleRoleChange(cu.id, e.target.value as any)}
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          >
                            <option value="admin">מנהל</option>
                            <option value="manager">מנהל תפעול</option>
                            <option value="viewer">צפייה</option>
                          </select>

                          {/* Toggle Active */}
                          <button
                            onClick={() => handleToggleActive(cu.id, cu.is_active)}
                            className={`p-2 rounded-lg transition-colors ${
                              cu.is_active
                                ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title={cu.is_active ? 'השבת משתמש' : 'הפעל משתמש'}
                          >
                            {cu.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setShowDeleteConfirm(cu.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-800 mb-4">הגדרות פורטל</h2>
          <p className="text-sm text-gray-500 mb-6">מה הלקוח רואה כשנכנס לפורטל — גרירות, תמונות, מחירים ועוד.</p>
          <div className="space-y-4">
            {[
              { key: 'show_photos', label: 'הצגת תמונות', desc: 'תמונות שצולמו במהלך הגרירה' },
              { key: 'show_price', label: 'הצגת מחיר', desc: 'מחיר הגרירה ופירוט עלויות' },
              { key: 'show_driver_info', label: 'הצגת שם נהג', desc: 'שם הנהג שמבצע את הגרירה' },
              { key: 'show_driver_phone', label: 'הצגת טלפון נהג', desc: 'מספר הטלפון של הנהג' },
              { key: 'show_status_history', label: 'הצגת היסטוריית סטטוסים', desc: 'ציר זמן של שלבי הגרירה' },
              { key: 'show_vehicles', label: 'הצגת פרטי רכבים', desc: 'פרטי הרכבים שנגררו' },
              { key: 'show_notes', label: 'הצגת הערות', desc: 'הערות פנימיות על הגרירה' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-800">{label}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePortalSettingChange(key, !portalSettings[key])}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${portalSettings[key] ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'}`}
                >
                  <span className="inline-block h-4 w-4 rounded-full bg-white shadow" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:max-w-md lg:rounded-2xl lg:mx-4 overflow-hidden rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white">
              <h2 className="font-bold text-lg">הוספת משתמש פורטל</h2>
              <button
                onClick={() => {
                  setShowAddUser(false)
                  setTempPassword(null)
                }}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

              {/* Form */}
              <div className="p-5 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-600 mb-1">שם מלא *</label>
                  <input
                    type="text"
                    value={newUserForm.fullName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">אימייל *</label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">טלפון</label>
                  <input
                    type="tel"
                    value={newUserForm.phone}
                    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">הרשאה</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'viewer', label: 'צפייה', icon: Eye, desc: 'צפייה בגרירות' },
                      { value: 'manager', label: 'מנהל תפעול', icon: Shield, desc: 'צפייה + דוחות' },
                      { value: 'admin', label: 'מנהל', icon: Shield, desc: 'ניהול מלא' },
                    ].map((opt) => {
                      const Icon = opt.icon
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setNewUserForm({ ...newUserForm, role: opt.value as any })}
                          className={`p-3 rounded-xl border-2 text-center transition-all ${
                            newUserForm.role === opt.value
                              ? 'border-[#33d4ff] bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon size={18} className={`mx-auto mb-1 ${
                            newUserForm.role === opt.value ? 'text-[#33d4ff]' : 'text-gray-400'
                          }`} />
                          <p className="text-xs font-medium">{opt.label}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAddUser(false)}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={handleAddUser}
                    disabled={!newUserForm.fullName || !newUserForm.email || saving}
                    className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 transition-colors font-medium"
                  >
                    {saving ? (
                      <Loader2 size={18} className="animate-spin mx-auto" />
                    ) : (
                      'צור משתמש'
                    )}
                  </button>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">מחיקת משתמש</h2>
              <p className="text-gray-600">המשתמש יאבד גישה לפורטל הלקוח. להמשיך?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => handleDeleteUser(showDeleteConfirm)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}