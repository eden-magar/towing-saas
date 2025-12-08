'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../lib/AuthContext'
import { 
  getCompanyById,
  suspendCompany,
  activateCompany,
  startImpersonation,
  type CompanyDetails
} from '../../../lib/superadmin'
import {
  ArrowRight,
  Building2,
  Users,
  Truck,
  MapPin,
  Phone,
  Mail,
  Globe,
  Calendar,
  CreditCard,
  Activity,
  Eye,
  Pencil,
  Shield,
  Ban,
  CheckCircle,
  Loader2,
  FileText,
  Clock,
  TrendingUp,
  AlertTriangle,
  X
} from 'lucide-react'

type TabType = 'overview' | 'users' | 'billing' | 'activity'

export default function CompanyDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const companyId = params.id as string

  const [company, setCompany] = useState<CompanyDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  
  // Modals
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadCompany()
  }, [companyId])

  const loadCompany = async () => {
    setLoading(true)
    try {
      const data = await getCompanyById(companyId)
      setCompany(data)
    } catch (error) {
      console.error('Error loading company:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSuspend = async () => {
    if (!user || !suspendReason.trim()) return
    setActionLoading(true)
    try {
      await suspendCompany(companyId, suspendReason, user.id)
      setShowSuspendModal(false)
      setSuspendReason('')
      await loadCompany()
    } catch (error) {
      console.error('Error suspending company:', error)
      alert('שגיאה בהשעיית החברה')
    } finally {
      setActionLoading(false)
    }
  }

  const handleActivate = async () => {
    if (!user) return
    setActionLoading(true)
    try {
      await activateCompany(companyId, user.id)
      await loadCompany()
    } catch (error) {
      console.error('Error activating company:', error)
      alert('שגיאה בהפעלת החברה')
    } finally {
      setActionLoading(false)
    }
  }

  const handleImpersonate = async () => {
    if (!user) return
    setActionLoading(true)
    try {
      await startImpersonation(user.id, companyId, 'צפייה במערכת')
      // Redirect to company dashboard
      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Error starting impersonation:', error)
      alert('שגיאה בהתחזות')
    } finally {
      setActionLoading(false)
    }
  }

  const getPlanBadge = (planName?: string) => {
    switch (planName) {
      case 'enterprise': return 'bg-violet-500/20 text-violet-400 border-violet-500/30'
      case 'pro': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'basic': return 'bg-slate-600/50 text-slate-400 border-slate-500/30'
      default: return 'bg-slate-600/50 text-slate-400'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/20 text-emerald-400'
      case 'trial': return 'bg-amber-500/20 text-amber-400'
      case 'suspended': return 'bg-red-500/20 text-red-400'
      default: return 'bg-slate-600/50 text-slate-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'פעיל'
      case 'trial': return 'תקופת ניסיון'
      case 'suspended': return 'מושעה'
      case 'cancelled': return 'מבוטל'
      default: return status
    }
  }

  const getRoleName = (role: string) => {
    switch (role) {
      case 'company_admin': return 'מנהל'
      case 'dispatcher': return 'מוקדן'
      case 'driver': return 'נהג'
      default: return role
    }
  }

  const getActionName = (action: string) => {
    const actions: Record<string, string> = {
      'INSERT': 'יצירה',
      'UPDATE': 'עדכון',
      'DELETE': 'מחיקה',
      'login': 'התחברות',
      'logout': 'התנתקות',
      'tow_created': 'יצירת גרירה',
      'tow_updated': 'עדכון גרירה',
      'status_change': 'שינוי סטטוס'
    }
    return actions[action] || action
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!company) {
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
            <span className="text-white">{company.name}</span>
          </div>

          {/* Company Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={company.name} className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-slate-300">{company.name.charAt(0)}</span>
                )}
              </div>
              
              {/* Info */}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white">{company.name}</h1>
                  <span className={`px-2 py-1 text-xs font-medium rounded-lg ${getStatusBadge(company.status)}`}>
                    {getStatusText(company.status)}
                  </span>
                  {company.subscription?.plan && (
                    <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${getPlanBadge(company.subscription.plan.name)}`}>
                      {company.subscription.plan.display_name}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 mt-1">
                  {company.business_number && `ח.פ. ${company.business_number} • `}
                  הצטרף ב-{new Date(company.created_at).toLocaleDateString('he-IL')}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleImpersonate}
                disabled={actionLoading || company.status === 'suspended'}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 text-white rounded-xl font-medium transition-colors"
              >
                <Eye size={18} />
                היכנס למערכת
              </button>
              <Link
                href={`/superadmin/companies/${companyId}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
              >
                <Pencil size={18} />
                ערוך
              </Link>
              {company.status === 'suspended' ? (
                <button
                  onClick={handleActivate}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
                >
                  <CheckCircle size={18} />
                  הפעל
                </button>
              ) : (
                <button
                  onClick={() => setShowSuspendModal(true)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl font-medium transition-colors"
                >
                  <Ban size={18} />
                  השעה
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-6 -mb-px">
            {[
              { id: 'overview', label: 'סקירה', icon: Building2 },
              { id: 'users', label: 'משתמשים', icon: Users },
              { id: 'billing', label: 'חיובים', icon: CreditCard },
              { id: 'activity', label: 'פעילות', icon: Activity },
            ].map((tab) => {
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
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: 'משתמשים', value: company.stats.users_count, icon: Users, color: 'violet' },
                { label: 'נהגים', value: company.stats.drivers_count, icon: Users, color: 'blue' },
                { label: 'משאיות', value: company.stats.trucks_count, icon: Truck, color: 'amber' },
                { label: 'גרירות החודש', value: company.stats.tows_this_month, icon: TrendingUp, color: 'emerald' },
                { label: 'הכנסות החודש', value: '₪0', icon: CreditCard, color: 'green' },
              ].map((stat, idx) => {
                const Icon = stat.icon
                return (
                  <div key={idx} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                    <div className={`w-10 h-10 bg-${stat.color}-500/20 rounded-lg flex items-center justify-center mb-3`}>
                      <Icon className={`text-${stat.color}-400`} size={20} />
                    </div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-sm text-slate-400">{stat.label}</p>
                  </div>
                )
              })}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Company Details */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="font-bold text-white mb-4">פרטי חברה</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Building2 size={18} className="text-slate-500" />
                    <div>
                      <p className="text-xs text-slate-500">שם החברה</p>
                      <p className="text-white">{company.name}</p>
                    </div>
                  </div>
                  {company.business_number && (
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">ח.פ.</p>
                        <p className="text-white">{company.business_number}</p>
                      </div>
                    </div>
                  )}
                  {company.address && (
                    <div className="flex items-center gap-3">
                      <MapPin size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">כתובת</p>
                        <p className="text-white">{company.address}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-slate-500" />
                    <div>
                      <p className="text-xs text-slate-500">תאריך הצטרפות</p>
                      <p className="text-white">{new Date(company.created_at).toLocaleDateString('he-IL')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="font-bold text-white mb-4">פרטי קשר</h3>
                <div className="space-y-4">
                  {company.email && (
                    <div className="flex items-center gap-3">
                      <Mail size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">אימייל</p>
                        <a href={`mailto:${company.email}`} className="text-violet-400 hover:text-violet-300">
                          {company.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {company.phone && (
                    <div className="flex items-center gap-3">
                      <Phone size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">טלפון</p>
                        <a href={`tel:${company.phone}`} className="text-violet-400 hover:text-violet-300">
                          {company.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {company.website && (
                    <div className="flex items-center gap-3">
                      <Globe size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">אתר</p>
                        <a href={company.website} target="_blank" className="text-violet-400 hover:text-violet-300">
                          {company.website}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Subscription Info */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="font-bold text-white mb-4">פרטי מנוי</h3>
                {company.subscription ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">חבילה</span>
                      <span className={`px-3 py-1 text-sm font-medium rounded-lg border ${getPlanBadge(company.subscription.plan?.name)}`}>
                        {company.subscription.plan?.display_name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">סטטוס</span>
                      <span className={`px-3 py-1 text-sm font-medium rounded-lg ${getStatusBadge(company.subscription.status)}`}>
                        {getStatusText(company.subscription.status)}
                      </span>
                    </div>
                    {company.subscription.trial_ends_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">סיום ניסיון</span>
                        <span className="text-white">
                          {new Date(company.subscription.trial_ends_at).toLocaleDateString('he-IL')}
                        </span>
                      </div>
                    )}
                    {company.subscription.next_billing_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">חיוב הבא</span>
                        <span className="text-white">
                          {new Date(company.subscription.next_billing_date).toLocaleDateString('he-IL')}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500">אין מנוי פעיל</p>
                )}
              </div>

              {/* Quick Stats */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="font-bold text-white mb-4">סטטיסטיקות</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">גרירות החודש</span>
                    <span className="text-white font-medium">{company.stats.tows_this_month}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">משתמשים פעילים</span>
                    <span className="text-white font-medium">{company.stats.users_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">נהגים</span>
                    <span className="text-white font-medium">{company.stats.drivers_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">משאיות</span>
                    <span className="text-white font-medium">{company.stats.trucks_count}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-white">משתמשים ({company.users.length})</h3>
            </div>
            
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-700/50 text-sm font-medium text-slate-400 border-b border-slate-700">
              <div className="col-span-4">משתמש</div>
              <div className="col-span-2">תפקיד</div>
              <div className="col-span-2">סטטוס</div>
              <div className="col-span-2">התחברות אחרונה</div>
              <div className="col-span-2">תאריך יצירה</div>
            </div>

            {/* Users List */}
            <div className="divide-y divide-slate-700">
              {company.users.map((u) => (
                <div key={u.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-slate-700/30">
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-300">
                        {u.full_name?.charAt(0) || u.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{u.full_name || '-'}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="px-2 py-1 text-xs font-medium rounded-lg bg-slate-700 text-slate-300">
                      {getRoleName(u.role)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-lg ${
                      u.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {u.is_active ? 'פעיל' : 'לא פעיל'}
                    </span>
                  </div>
                  <div className="col-span-2 text-sm text-slate-400">
                    {u.last_sign_in_at 
                      ? new Date(u.last_sign_in_at).toLocaleDateString('he-IL')
                      : 'אף פעם'
                    }
                  </div>
                  <div className="col-span-2 text-sm text-slate-400">
                    {new Date(u.created_at).toLocaleDateString('he-IL')}
                  </div>
                </div>
              ))}

              {company.users.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">אין משתמשים</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="font-bold text-white mb-4">חבילה נוכחית</h3>
              {company.subscription?.plan ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-violet-500/20 rounded-xl flex items-center justify-center">
                      <CreditCard className="text-violet-400" size={28} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">{company.subscription.plan.display_name}</p>
                      <p className="text-slate-400">
                        ₪{company.subscription.plan.price_monthly}/חודש
                      </p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium">
                    שנה חבילה
                  </button>
                </div>
              ) : (
                <p className="text-slate-500">אין מנוי פעיל</p>
              )}
            </div>

            {/* Billing History */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700">
                <h3 className="font-bold text-white">היסטוריית חיובים</h3>
              </div>

              {company.billing_history.length > 0 ? (
                <>
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-700/50 text-sm font-medium text-slate-400 border-b border-slate-700">
                    <div className="col-span-3">מספר חשבונית</div>
                    <div className="col-span-2">תאריך</div>
                    <div className="col-span-2">סכום</div>
                    <div className="col-span-2">סטטוס</div>
                    <div className="col-span-3">פעולות</div>
                  </div>

                  <div className="divide-y divide-slate-700">
                    {company.billing_history.map((bill) => (
                      <div key={bill.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center">
                        <div className="col-span-3 font-medium text-white">{bill.invoice_number}</div>
                        <div className="col-span-2 text-slate-400">
                          {new Date(bill.created_at).toLocaleDateString('he-IL')}
                        </div>
                        <div className="col-span-2 text-white font-medium">₪{bill.total_amount}</div>
                        <div className="col-span-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-lg ${
                            bill.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                            bill.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {bill.status === 'paid' ? 'שולם' : 
                             bill.status === 'pending' ? 'ממתין' : 'נכשל'}
                          </span>
                        </div>
                        <div className="col-span-3">
                          <button className="text-violet-400 hover:text-violet-300 text-sm">
                            הורד חשבונית
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="px-5 py-12 text-center">
                  <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">אין היסטוריית חיובים</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700">
              <h3 className="font-bold text-white">לוג פעילות</h3>
            </div>

            {company.recent_activity.length > 0 ? (
              <div className="divide-y divide-slate-700">
                {company.recent_activity.map((log) => (
                  <div key={log.id} className="px-5 py-4 flex items-start gap-4">
                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <Activity size={18} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white">
                        <span className="font-medium">{log.user_name || 'מערכת'}</span>
                        {' '}ביצע{' '}
                        <span className="text-violet-400">{getActionName(log.action)}</span>
                        {log.table_name && (
                          <span className="text-slate-400"> ב-{log.table_name}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(log.created_at).toLocaleString('he-IL')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">אין פעילות</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="text-red-400" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">השעיית חברה</h3>
                <p className="text-sm text-slate-400">פעולה זו תחסום גישה למערכת</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                סיבת ההשעיה
              </label>
              <select
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">בחר סיבה...</option>
                <option value="אי תשלום">אי תשלום</option>
                <option value="הפרת תנאי שימוש">הפרת תנאי שימוש</option>
                <option value="בקשת לקוח">בקשת לקוח</option>
                <option value="אחר">אחר</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSuspendModal(false)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium"
              >
                ביטול
              </button>
              <button
                onClick={handleSuspend}
                disabled={!suspendReason || actionLoading}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <Ban size={18} />
                    השעה
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}