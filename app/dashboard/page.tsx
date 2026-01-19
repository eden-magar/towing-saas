'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { getDashboardStats, getRecentTows, DashboardStats } from '../lib/queries/dashboard'
import { getExpiryAlerts, ExpiryAlert } from '../lib/queries/alerts'
import { TowWithDetails } from '../lib/queries/tows'
import { Truck, Users, Clock, CheckCircle, Plus, ChevronLeft, RefreshCw, AlertTriangle, FileText, Shield, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { countPendingRejectionRequests, getPendingRejectionRequests, approveRejectionRequest, denyRejectionRequest, REJECTION_REASONS } from '../lib/queries/rejection-requests'
import { getAvailableDrivers } from '../lib/queries/drivers'

// מיפוי סטטוסים לעברית וצבעים
const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'ממתינה', color: 'bg-amber-100 text-amber-700' },
  assigned: { label: 'שובצה', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'בביצוע', color: 'bg-indigo-100 text-indigo-700' },
  completed: { label: 'הושלמה', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'בוטלה', color: 'bg-red-100 text-red-700' }
}

// מיפוי סוגי התראות
const alertTypeConfig: Record<string, { label: string; icon: typeof Truck; link: string }> = {
  truck_license: { label: 'רישיון רכב', icon: FileText, link: '/dashboard/trucks' },
  truck_insurance: { label: 'ביטוח גרר', icon: Shield, link: '/dashboard/trucks' },
  driver_license: { label: 'רישיון נהיגה', icon: CreditCard, link: '/dashboard/drivers' },
  tachograph: { label: 'כיול טכוגרף', icon: Clock, link: '/dashboard/trucks' },
  engineer_report: { label: 'תסקיר מהנדס', icon: FileText, link: '/dashboard/trucks' },
  winter_inspection: { label: 'בדיקת חורף', icon: Truck, link: '/dashboard/trucks' },
}

export default function DashboardPage() {
  const { user, companyId, loading: authLoading } = useAuth()
  console.log('Auth state:', { user, companyId, authLoading })
  const [stats, setStats] = useState<DashboardStats>({
    towsToday: 0,
    pendingTows: 0,
    completedToday: 0,
    availableDrivers: 0
  })
  const [recentTows, setRecentTows] = useState<TowWithDetails[]>([])
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rejectionRequests, setRejectionRequests] = useState<any[]>([])
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([])
  const [selectedNewDriver, setSelectedNewDriver] = useState<string>('')
  const [approvalAction, setApprovalAction] = useState<'reassign' | 'unassign'>('unassign')
  const [processingRequest, setProcessingRequest] = useState(false)

  const loadData = async () => {
  if (!companyId) return
  
  try {
    const [statsData, towsData, alertsData, rejectionsData, driversData] = await Promise.all([
      getDashboardStats(companyId),
      getRecentTows(companyId, 5),
      getExpiryAlerts(companyId),
      getPendingRejectionRequests(companyId),
      getAvailableDrivers(companyId)
    ])
    setStats(statsData)
    setRecentTows(towsData)
    setAlerts(alertsData)
    setRejectionRequests(rejectionsData)
    setAvailableDrivers(driversData)
  } catch (error) {
    console.error('Error loading dashboard data:', error)
  } finally {
    setLoading(false)
    setRefreshing(false)
  }
}

  useEffect(() => {
  if (!authLoading) {
    if (companyId) {
      loadData()
    } else {
      setLoading(false)
    }
  }
}, [companyId, authLoading])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="animate-spin" size={20} />
          <span>טוען...</span>
        </div>
      </div>
    )
  }

  const statCards = [
    { label: 'גרירות היום', value: stats.towsToday, icon: Truck, color: 'bg-[#33d4ff]' },
    { label: 'ממתינות לשיבוץ', value: stats.pendingTows, icon: Clock, color: 'bg-amber-400' },
    { label: 'הושלמו היום', value: stats.completedToday, icon: CheckCircle, color: 'bg-emerald-400' },
    { label: 'נהגים זמינים', value: stats.availableDrivers, icon: Users, color: 'bg-violet-400' },
  ]

  // פונקציה לקבלת כתובות מהרגליים
  const getRoute = (tow: TowWithDetails) => {
    if (tow.legs && tow.legs.length > 0) {
      const firstLeg = tow.legs.find(l => l.from_address)
      const lastLeg = [...tow.legs].reverse().find(l => l.to_address)
      
      const from = firstLeg?.from_address?.split(',')[0] || '-'
      const to = lastLeg?.to_address?.split(',')[0] || '-'
      
      return { from, to }
    }
    return { from: '-', to: '-' }
  }

  // פונקציה לקבלת מספר רכב ראשון
  const getFirstVehicle = (tow: TowWithDetails) => {
    if (tow.vehicles && tow.vehicles.length > 0) {
      return tow.vehicles[0].plate_number
    }
    return '-'
  }

  // פונקציה לפורמט תאריך
  const formatExpiryDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('he-IL')
  }

  // פונקציה לטקסט ימים
  const getDaysText = (daysLeft: number) => {
    if (daysLeft < 0) {
      return `פג לפני ${Math.abs(daysLeft)} ימים`
    } else if (daysLeft === 0) {
      return 'פג היום!'
    } else if (daysLeft === 1) {
      return 'פג מחר!'
    } else {
      return `עוד ${daysLeft} ימים`
    }
  }

  return (
    <div>
      {/* כותרת */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">דשבורד</h1>
          <p className="text-gray-500 text-sm mt-1 truncate hidden lg:block">
          ברוך הבא, {user?.full_name || user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            title="רענן נתונים"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <Link
            href="/dashboard/tows/new"
            className="hidden lg:flex items-center justify-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-4 py-2.5 rounded-xl transition-colors flex-shrink-0"
          >
            <Plus size={20} />
            <span>גרירה חדשה</span>
          </Link>
        </div>
      </div>

      {/* התראות תוקף */}
      {alerts.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500" />
            <h2 className="font-semibold text-gray-800">התראות תוקף ({alerts.length})</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
            {alerts.map((alert) => {
              const config = alertTypeConfig[alert.type]
              const Icon = config.icon
              
              return (
                <Link
                  key={alert.id}
                  href={config.link}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    alert.severity === 'expired' ? 'bg-red-100' :
                    alert.severity === 'critical' ? 'bg-orange-100' :
                    'bg-amber-100'
                  }`}>
                    <Icon size={20} className={
                      alert.severity === 'expired' ? 'text-red-600' :
                      alert.severity === 'critical' ? 'text-orange-600' :
                      'text-amber-600'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">{alert.entityName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        alert.severity === 'expired' ? 'bg-red-100 text-red-700' :
                        alert.severity === 'critical' ? 'bg-orange-100 text-orange-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {alert.severity === 'expired' ? 'פג תוקף' :
                         alert.severity === 'critical' ? 'דחוף' : 
                         'בקרוב'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {config.label} • {formatExpiryDate(alert.expiryDate)} • {getDaysText(alert.daysLeft)}
                    </p>
                  </div>
                  <ChevronLeft size={20} className="text-gray-400 flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* בקשות דחייה ממתינות */}
      {rejectionRequests.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="p-4 border-b border-red-100 bg-red-50 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            <h2 className="font-semibold text-red-800">בקשות דחייה ממתינות ({rejectionRequests.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {rejectionRequests.map((request) => {
              const reasonInfo = REJECTION_REASONS.find(r => r.key === request.reason)
              return (
                <div key={request.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-800">
                          {request.driver?.user?.full_name || 'נהג'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {reasonInfo?.icon} {reasonInfo?.label || request.reason}
                        </span>
                      </div>
                      {request.reason_note && (
                        <p className="text-sm text-gray-500 mb-2">{request.reason_note}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {new Date(request.created_at).toLocaleString('he-IL')}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          setSelectedRequest(request)
                          setShowApprovalModal(true)
                        }}
                        className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors"
                      >
                        אשר
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('לדחות את הבקשה? הנהג יצטרך לבצע את המשימה.')) {
                            await denyRejectionRequest(request.id, user?.id || '')
                            loadData()
                          }
                        }}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                      >
                        דחה
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* כרטיסי סטטיסטיקה */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`${stat.color} p-2.5 sm:p-3 rounded-lg flex-shrink-0`}>
                  <Icon size={20} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-gray-500 text-xs sm:text-sm truncate">{stat.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800">{stat.value}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* גרירות אחרונות */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">גרירות אחרונות</h2>
          <Link href="/dashboard/tows" className="text-[#33d4ff] text-sm hover:underline">
            הצג הכל
          </Link>
        </div>
        
        {recentTows.length === 0 ? (
          <div className="p-6">
            <p className="text-gray-400 text-center py-8">אין גרירות להצגה</p>
          </div>
        ) : (
          <>
            {/* תצוגת טבלה - דסקטופ */}
            <div className="hidden sm:block">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">תאריך</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">רכב</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">לקוח</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">מסלול</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">נהג</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTows.map((tow) => {
                    const route = getRoute(tow)
                    const status = statusMap[tow.status] || { label: tow.status, color: 'bg-gray-100 text-gray-700' }
                    
                    return (
                      <tr 
                        key={tow.id} 
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/dashboard/tows/${tow.id}`}
                      >
                        <td className="px-4 py-3 text-gray-600 text-sm">
                          {new Date(tow.created_at).toLocaleDateString('he-IL')}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-600">{getFirstVehicle(tow)}</td>
                        <td className="px-4 py-3 text-gray-600">{tow.customer?.name || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <span className="truncate max-w-[100px]">{route.from}</span>
                            <ChevronLeft size={14} className="flex-shrink-0" />
                            <span className="truncate max-w-[100px]">{route.to}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {tow.driver?.user?.full_name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* תצוגת כרטיסים - מובייל */}
            <div className="sm:hidden divide-y divide-gray-100">
              {recentTows.map((tow) => {
                const route = getRoute(tow)
                const status = statusMap[tow.status] || { label: tow.status, color: 'bg-gray-100 text-gray-700' }
                
                return (
                  <Link
                    key={tow.id}
                    href={`/dashboard/tows/${tow.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-gray-800">{getFirstVehicle(tow)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{tow.customer?.name || 'ללא לקוח'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{route.from} ← {route.to}</p>
                    </div>
                    <ChevronLeft size={20} className="text-gray-400 flex-shrink-0" />
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* מודל אישור בקשת דחייה */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">אישור בקשת דחייה</h3>
              <p className="text-sm text-gray-500 mt-1">מה לעשות עם המשימה?</p>
            </div>
            
            <div className="p-5 space-y-4">
              <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="action"
                  checked={approvalAction === 'reassign'}
                  onChange={() => setApprovalAction('reassign')}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <div className="font-medium text-gray-800">העבר לנהג אחר</div>
                  <div className="text-sm text-gray-500">בחר נהג שיקבל את המשימה</div>
                </div>
              </label>

              {approvalAction === 'reassign' && (
                <select
                  value={selectedNewDriver}
                  onChange={(e) => setSelectedNewDriver(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">בחר נהג...</option>
                  {availableDrivers
                    .filter(d => d.id !== selectedRequest.driver_id)
                    .map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.user?.full_name || 'נהג'} {driver.status === 'available' ? '(זמין)' : ''}
                      </option>
                    ))
                  }
                </select>
              )}

              <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="action"
                  checked={approvalAction === 'unassign'}
                  onChange={() => setApprovalAction('unassign')}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <div className="font-medium text-gray-800">החזר לתור</div>
                  <div className="text-sm text-gray-500">המשימה תחכה לשיבוץ חדש</div>
                </div>
              </label>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false)
                  setSelectedRequest(null)
                  setSelectedNewDriver('')
                  setApprovalAction('unassign')
                }}
                disabled={processingRequest}
                className="flex-1 py-3 border border-gray-200 bg-white text-gray-600 rounded-xl font-medium"
              >
                ביטול
              </button>
              <button
                onClick={async () => {
                  if (approvalAction === 'reassign' && !selectedNewDriver) {
                    alert('יש לבחור נהג')
                    return
                  }
                  setProcessingRequest(true)
                  try {
                    await approveRejectionRequest(
                      selectedRequest.id,
                      user?.id || '',
                      approvalAction === 'reassign' ? selectedNewDriver : undefined
                    )
                    setShowApprovalModal(false)
                    setSelectedRequest(null)
                    setSelectedNewDriver('')
                    setApprovalAction('unassign')
                    loadData()
                  } catch (err) {
                    console.error('Error approving request:', err)
                    alert('שגיאה באישור הבקשה')
                  } finally {
                    setProcessingRequest(false)
                  }
                }}
                disabled={processingRequest || (approvalAction === 'reassign' && !selectedNewDriver)}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {processingRequest ? 'מעבד...' : 'אשר'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}