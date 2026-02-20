'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, MapPin, User, ChevronLeft, Truck, Calendar, Phone } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '../../lib/AuthContext'
import { getTows, TowWithDetails } from '../../lib/queries/tows'

export default function TowsPage() {
  const { companyId } = useAuth()
  const router = useRouter()
  
  const [tows, setTows] = useState<TowWithDetails[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [searchTerm, setSearchTerm] = useState('')
  const [activeStatus, setActiveStatus] = useState('all')

  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId])

  const loadData = async () => {
    if (!companyId) return
    
    setPageLoading(true)
    try {
      const data = await getTows(companyId)
      setTows(data)
    } catch (err) {
      console.error('Error loading tows:', err)
      setError('שגיאה בטעינת הנתונים')
    } finally {
      setPageLoading(false)
    }
  }

  const statuses = [
    { id: 'all', label: 'הכל' },
    { id: 'pending', label: 'ממתינות' },
    { id: 'assigned', label: 'משויכות' },
    { id: 'in_progress', label: 'בביצוע' },
    { id: 'completed', label: 'הושלמו' },
    { id: 'cancelled', label: 'בוטלו' },
  ]

  const statusConfig: Record<string, { label: string; class: string }> = {
    pending: { label: 'ממתינה', class: 'bg-amber-100 text-amber-700' },
    assigned: { label: 'משויכת', class: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'בביצוע', class: 'bg-purple-100 text-purple-700' },
    completed: { label: 'הושלמה', class: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'בוטלה', class: 'bg-red-100 text-red-700' },
  }

  const filteredTows = tows.filter(tow => {
    // סינון לפי סטטוס
    if (activeStatus !== 'all' && tow.status !== activeStatus) return false
    
    // סינון לפי חיפוש
    if (searchTerm) {
      const query = searchTerm.toLowerCase()
      const vehiclePlate = tow.vehicles[0]?.plate_number?.toLowerCase() || ''
      const customerName = tow.customer?.name?.toLowerCase() || ''
      const driverName = tow.driver?.user?.full_name?.toLowerCase() || ''
      const orderNum = tow.order_number?.toLowerCase() || ''
      
      // חיפוש עם # מחפש רק מספר הזמנה
      if (query.startsWith('#')) {
        const orderQuery = query.slice(1)
        return orderNum.startsWith(orderQuery)
      }
      
      if (!vehiclePlate.includes(query) && 
          !customerName.includes(query) && 
          !driverName.includes(query) &&
          !orderNum.startsWith(query)) {
        return false
      }
    }
    return true
  })

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('he-IL')
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }

  const getFromTo = (tow: TowWithDetails) => {
    const pickup = tow.legs.find(l => l.leg_type === 'pickup')
    const delivery = tow.legs.find(l => l.leg_type === 'delivery')
    return {
      from: pickup?.from_address || pickup?.to_address || '-',
      to: delivery?.to_address || pickup?.to_address || '-'
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500">טוען גרירות...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">גרירות</h1>
          <p className="text-gray-500 mt-1 text-sm">ניהול כל הגרירות במערכת</p>
        </div>
        <Link
          href="/dashboard/tows/new"
          className="hidden lg:flex items-center justify-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={20} />
          <span>גרירה חדשה</span>
        </Link>
      </div>

      {/* כפתור מובייל */}
      <Link
        href="/dashboard/tows/new"
        className="lg:hidden flex items-center justify-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-4 py-3 rounded-xl transition-colors mb-6"
      >
        <Plus size={20} />
        <span>גרירה חדשה</span>
      </Link>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{tows.length}</p>
          <p className="text-xs text-gray-500">סה״כ</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{tows.filter(t => t.status === 'pending').length}</p>
          <p className="text-xs text-gray-500">ממתינות</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{tows.filter(t => t.status === 'assigned').length}</p>
          <p className="text-xs text-gray-500">משויכות</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{tows.filter(t => t.status === 'in_progress').length}</p>
          <p className="text-xs text-gray-500">בביצוע</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold text-emerald-600">{tows.filter(t => t.status === 'completed').length}</p>
          <p className="text-xs text-gray-500">הושלמו</p>
        </div>
      </div>

      {/* חיפוש וסינון */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש לפי מס' הזמנה, רכב, לקוח או נהג..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {statuses.map((status) => (
            <button
              key={status.id}
              onClick={() => setActiveStatus(status.id)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeStatus === status.id
                  ? 'bg-[#33d4ff] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* טבלה */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredTows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">אין גרירות להצגה</h3>
            <p className="text-gray-500 mb-6">צרו את הגרירה הראשונה שלכם</p>
            <Link
              href="/dashboard/tows/new"
              className="inline-flex items-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={20} />
              <span>גרירה חדשה</span>
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">תאריך</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">מס' הזמנה</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">רכב</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">לקוח</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">נהג</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">מסלול</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">סטטוס</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">מחיר</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTows.map((tow) => {
                    const { from, to } = getFromTo(tow)
                    const vehicle = tow.vehicles[0]
                    return (
                      <tr key={tow.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/tows/${tow.id}`)}>

                        <td className="px-4 py-4">
                          <span className="font-medium text-gray-800">{formatDate(tow.created_at)}</span>
                          <p className="text-xs text-gray-500">{formatTime(tow.created_at)}</p>
                        </td>
                        <td className="px-4 py-4">
                          {tow.order_number ? (
                            <span className="font-mono text-gray-800">{tow.order_number}{tow.customer_order_number ? ` (${tow.customer_order_number})` : ''}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {vehicle ? (
                            <>
                              <span className="font-mono text-gray-800">{vehicle.plate_number}</span>
                              <p className="text-sm text-gray-500">
                                {vehicle.manufacturer} {vehicle.model}
                              </p>
                            </>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {tow.customer ? (
                            <>
                              <span className="text-gray-800">{tow.customer.name}</span>
                              {tow.customer.phone && (
                                <p className="text-sm text-gray-500">{tow.customer.phone}</p>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">לא צוין</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {tow.driver ? (
                            <span className="text-gray-600">{tow.driver.user.full_name}</span>
                          ) : (
                            <span className="text-amber-600 text-sm">לא שויך</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600 max-w-[200px]">
                            <span className="truncate">{from}</span>
                            <ChevronLeft size={14} className="flex-shrink-0" />
                            <span className="truncate">{to}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[tow.status]?.class || 'bg-gray-100 text-gray-600'}`}>
                            {statusConfig[tow.status]?.label || tow.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {tow.final_price ? (
                            <span className="font-medium text-gray-800">{tow.final_price} ש״ח</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/dashboard/tows/${tow.id}`}
                            className="text-[#33d4ff] hover:text-[#21b8e6] text-sm font-medium"
                          >
                            פרטים
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {filteredTows.map((tow) => {
                const { from, to } = getFromTo(tow)
                const vehicle = tow.vehicles[0]
                return (
                  <Link
                    key={tow.id}
                    href={`/dashboard/tows/${tow.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">
                            {vehicle?.plate_number || 'ללא רכב'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[tow.status]?.class}`}>
                            {statusConfig[tow.status]?.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {formatDate(tow.created_at)} | {formatTime(tow.created_at)}
                        </p>
                        {tow.order_number && (
                          <p className="text-xs font-mono text-gray-400 mt-0.5">#{tow.order_number}{tow.customer_order_number ? ` (${tow.customer_order_number})` : ''}</p>
                        )}
                      </div>
                      {tow.final_price && (
                        <span className="font-bold text-[#33d4ff]">{tow.final_price} ש״ח</span>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-gray-700 truncate">{from}</span>
                      </div>
                      <div className="w-0.5 h-3 bg-gray-300 mr-[3px] my-1"></div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-gray-700 truncate">{to}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        {tow.customer && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <User size={14} />
                            <span>{tow.customer.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {tow.driver && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-sm text-gray-500">
                        <Truck size={14} />
                        <span className="text-gray-700">{tow.driver.user.full_name}</span>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}