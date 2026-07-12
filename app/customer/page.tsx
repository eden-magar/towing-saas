'use client'

import { supabase } from '@/app/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/AuthContext'
import { getCustomerForUser, getCustomerTows, getCustomerStats, CUSTOMER_PORTAL_TOW_PAGE_SIZE } from '@/app/lib/queries/customer-portal'
import { getCustomerTowRequests } from '@/app/lib/queries/customer-tow-requests'
import type { CustomerPortalTow, CustomerTowRequest } from '@/app/lib/types'
import { resolvePortalVisibilityFlag } from '@/app/lib/utils/portal-visibility'
import {
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  Package
} from 'lucide-react'

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'ממתינה', color: 'text-yellow-800', bg: 'bg-yellow-50 border-yellow-300', icon: Clock },
  assigned: { label: 'שובצה לנהג', color: 'text-blue-800', bg: 'bg-blue-50 border-blue-300', icon: Truck },
  in_progress: { label: 'בביצוע', color: 'text-purple-800', bg: 'bg-purple-50 border-purple-300', icon: Truck },
  completed: { label: 'הושלמה', color: 'text-green-800', bg: 'bg-green-50 border-green-300', icon: CheckCircle2 },
  cancelled: { label: 'בוטלה', color: 'text-red-800', bg: 'bg-red-50 border-red-300', icon: AlertCircle },
  cancelled_charged: { label: 'בוטל בחיוב', color: 'text-amber-900', bg: 'bg-amber-50 border-amber-300', icon: AlertCircle },
}

const pendingRequestBadge = {
  label: 'ממתין לאישור החברה',
  color: 'text-amber-800',
  bg: 'bg-amber-50 border-amber-300',
  icon: Clock,
}

/** Scrollable card list — needs a height-bounded flex parent (see layout + page shell). */
const PORTAL_LIST_SCROLL =
  'space-y-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pe-0.5 pb-1 [scrollbar-width:thin] [scrollbar-color:rgb(209_213_219)_transparent]'

export default function CustomerDashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [portalSettings, setPortalSettings] = useState<Record<string, boolean>>({})
  const [tows, setTows] = useState<CustomerPortalTow[]>([])
  const [pendingRequests, setPendingRequests] = useState<CustomerTowRequest[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [pageLoading, setPageLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalTows, setTotalTows] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const totalPages = Math.max(1, Math.ceil(totalTows / CUSTOMER_PORTAL_TOW_PAGE_SIZE))

  // Boot: resolve customer + stats + pending requests
  useEffect(() => {
    if (authLoading || !user) return

    const load = async () => {
      const info = await getCustomerForUser(user.id)
      if (!info) {
        setLoading(false)
        return
      }
      setCustomerId(info.customerId)
      setPortalSettings(info.portalSettings || {})

      const [statsData, requestsData] = await Promise.all([
        getCustomerStats(info.customerId),
        getCustomerTowRequests(info.customerId),
      ])

      setStats(statsData)
      setPendingRequests(requestsData.filter((r) => r.status === 'pending'))
      setLoading(false)
    }

    void load()
  }, [user, authLoading])

  // Server-side page of tows (limit + offset)
  useEffect(() => {
    if (!customerId) return

    let cancelled = false

    const loadPage = async () => {
      setPageLoading(true)
      try {
        const offset = (page - 1) * CUSTOMER_PORTAL_TOW_PAGE_SIZE
        const { tows: nextTows, total } = await getCustomerTows(customerId, {
          status: statusFilter,
          limit: CUSTOMER_PORTAL_TOW_PAGE_SIZE,
          offset,
        })
        if (cancelled) return

        setTows(nextTows)
        setTotalTows(total)

        const pages = Math.max(1, Math.ceil(total / CUSTOMER_PORTAL_TOW_PAGE_SIZE))
        if (page > pages) {
          setPage(pages)
        }
      } finally {
        if (!cancelled) setPageLoading(false)
      }
    }

    void loadPage()
    return () => {
      cancelled = true
    }
  }, [customerId, statusFilter, page])

  // Realtime
  useEffect(() => {
    if (!customerId) return

    const refreshPendingRequests = () => {
      getCustomerTowRequests(customerId).then((requests) => {
        setPendingRequests(requests.filter((r) => r.status === 'pending'))
      })
    }

    const refreshTows = () => {
      const offset = (page - 1) * CUSTOMER_PORTAL_TOW_PAGE_SIZE
      getCustomerTows(customerId, {
        status: statusFilter,
        limit: CUSTOMER_PORTAL_TOW_PAGE_SIZE,
        offset,
      }).then(({ tows: nextTows, total }) => {
        setTows(nextTows)
        setTotalTows(total)
      })
      getCustomerStats(customerId).then(setStats)
    }

    const channel = supabase
      .channel('customer-tows-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tows' }, () => {
        refreshTows()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_tow_requests' }, () => {
        refreshPendingRequests()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [customerId, statusFilter, page])

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value)
    setPage(1)
  }

  // Client search within the current page only
  const filteredTows = tows.filter(tow => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      tow.order_number?.toLowerCase().includes(q) ||
      tow.customer_order_number?.toLowerCase().includes(q) ||
      tow.vehicles.some(v => v.plate_number.includes(q)) ||
      tow.points.some(p => p.address?.toLowerCase().includes(q))
    )
  })

  const getListHeaderText = () => {
    if (totalTows === 0) return 'אין גרירות להצגה'

    const from = (page - 1) * CUSTOMER_PORTAL_TOW_PAGE_SIZE + 1
    const to = Math.min(page * CUSTOMER_PORTAL_TOW_PAGE_SIZE, totalTows)

    if (searchQuery) {
      return `מציג ${filteredTows.length} בעמוד זה · גרירות ${from}–${to} מתוך ${totalTows}`
    }

    return `מציג ${from}–${to} מתוך ${totalTows} גרירות`
  }

  const paginationBar =
    totalTows > CUSTOMER_PORTAL_TOW_PAGE_SIZE ? (
      <div className="flex flex-col items-center gap-1">
        <div className="inline-flex items-center justify-center gap-2 flex-nowrap">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || pageLoading}
            aria-label="עמוד קודם"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            <ChevronRight size={14} aria-hidden />
            הקודם
          </button>
          <span className="text-xs sm:text-sm text-gray-700 tabular-nums whitespace-nowrap px-1">
            עמוד {page} מתוך {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || pageLoading}
            aria-label="עמוד הבא"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            הבא
            <ChevronLeft size={14} aria-hidden />
          </button>
        </div>
        <p className="text-[11px] sm:text-xs text-gray-500 text-center">{getListHeaderText()}</p>
      </div>
    ) : (
      <p className="text-xs text-gray-500 text-center">{getListHeaderText()}</p>
    )

  const getFirstAndLast = (tow: CustomerPortalTow) => {
    const pickup = tow.points.find(p => p.point_type === 'pickup')
    const dropoff = [...tow.points].reverse().find(p => p.point_type === 'dropoff')
    return {
      from: pickup?.address || 'לא צוין',
      to: dropoff?.address || 'לא צוין',
    }
  }

  const getProgress = (tow: CustomerPortalTow) => {
    if (!tow.points.length) return 0
    const completed = tow.points.filter(p => p.status === 'completed').length
    return Math.round((completed / tow.points.length) * 100)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-1 flex-col min-h-0 gap-3 md:h-full md:overflow-hidden">
      {/* Stats */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: 'סה"כ', value: stats.total, color: 'text-gray-700', bg: 'bg-white' },
          { label: 'ממתינות', value: stats.pending, color: 'text-yellow-700', bg: 'bg-yellow-50' },
          { label: 'בביצוע', value: stats.active, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'הושלמו', value: stats.completed, color: 'text-green-700', bg: 'bg-green-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-xl border border-gray-200 shadow-sm px-3 py-2.5`}>
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-xl font-bold leading-tight ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="shrink-0 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש לפי מספר הזמנה, רכב או כתובת..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {[
            { value: 'all', label: 'הכל' },
            { value: 'pending', label: 'ממתינות' },
            { value: 'assigned', label: 'שובצו' },
            { value: 'in_progress', label: 'בביצוע' },
            { value: 'completed', label: 'הושלמו' },
          ].map(filter => (
            <button
              key={filter.value}
              type="button"
              onClick={() => handleStatusFilter(filter.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === filter.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/*
        Columns fill remaining height (md+). Internal lists scroll.
        On mobile the page/main scrolls instead (no nested scroller).
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start md:min-h-0 md:flex-1 md:overflow-hidden md:items-stretch">
        {/* Pending */}
        <div className="min-w-0 flex flex-col gap-2 md:min-h-0 md:overflow-hidden">
          <h2 className="shrink-0 text-sm font-bold text-gray-900 px-1">
            ממתין לאישור החברה
            <span className="text-sm font-semibold text-amber-700 mr-2">({pendingRequests.length})</span>
          </h2>
          <div className={`${PORTAL_LIST_SCROLL} max-md:flex-none max-md:overflow-visible`}>
            {pendingRequests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
                <Clock size={40} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">אין בקשות ממתינות</p>
              </div>
            ) : (
              pendingRequests.map((req) => {
                const PendingIcon = pendingRequestBadge.icon
                const from = req.pickup_address?.trim() || null
                const to = req.dropoff_address?.trim() || null

                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => router.push(`/customer/requests/${req.id}`)}
                    className="w-full bg-white rounded-xl border border-gray-200 shadow-sm px-3.5 py-2.5 text-right hover:border-amber-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {req.customer_order_number && (
                          <span className="text-sm font-bold text-gray-900 truncate">
                            {req.customer_order_number}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${pendingRequestBadge.bg} ${pendingRequestBadge.color}`}>
                          <PendingIcon size={12} />
                          {pendingRequestBadge.label}
                        </span>
                      </div>
                      <ChevronLeft size={16} className="text-gray-400 shrink-0" />
                    </div>

                    {(from || to) && (
                      <div className="space-y-0.5 mb-1.5">
                        {from && (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                            <p className="text-sm text-gray-700 truncate leading-snug">{from}</p>
                          </div>
                        )}
                        {to && (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            <p className="text-sm text-gray-700 truncate leading-snug">{to}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-[11px] text-gray-500">
                      <span>{formatDate(req.scheduled_at)}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Tows */}
        <div className="min-w-0 flex flex-col gap-2 md:min-h-0 md:overflow-hidden">
          {tows.length === 0 && !pageLoading ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
              <Package size={40} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm">לא נמצאו גרירות</p>
            </div>
          ) : (
            <>
              <div className="shrink-0">{paginationBar}</div>

              <div className={`${PORTAL_LIST_SCROLL} max-md:flex-none max-md:overflow-visible`}>
                {pageLoading ? (
                  <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : filteredTows.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <Search size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500 text-sm">לא נמצאו גרירות התואמות לחיפוש</p>
                  </div>
                ) : (
                  filteredTows.map(tow => {
                    const { from, to } = getFirstAndLast(tow)
                    const progress = getProgress(tow)
                    const stopCount = tow.points.filter((p) => p.point_type === 'stop').length
                    const config = statusConfig[tow.status] || statusConfig.pending
                    const StatusIcon = config.icon
                    const showDriver =
                      !!tow.driver &&
                      resolvePortalVisibilityFlag('show_driver_info', portalSettings, tow)

                    return (
                      <button
                        key={tow.id}
                        type="button"
                        onClick={() => router.push(`/customer/tows/${tow.id}`)}
                        className="w-full bg-white rounded-xl border border-gray-200 shadow-sm px-3.5 py-2.5 text-right hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            {tow.order_number && (
                              <span className="text-sm font-bold text-gray-900 truncate">
                                #{tow.order_number}
                                {tow.customer_order_number ? ` (${tow.customer_order_number})` : ''}
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${config.bg} ${config.color}`}>
                              <StatusIcon size={12} />
                              {config.label}
                            </span>
                          </div>
                          <ChevronLeft size={16} className="text-gray-400 shrink-0" />
                        </div>

                        <div className="space-y-0.5 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                            <p className="text-sm text-gray-700 truncate leading-snug">{from}</p>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            <p className="text-sm text-gray-700 truncate leading-snug">{to}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
                          <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap min-w-0">
                            <span className="whitespace-nowrap">{formatDate(tow.scheduled_at || tow.created_at)}</span>
                            {tow.vehicles.length > 0 && (
                              <span className="whitespace-nowrap">{tow.vehicles.length} רכבים</span>
                            )}
                            {showDriver && (
                              <span className="truncate">נהג: {tow.driver!.full_name}</span>
                            )}
                            {stopCount > 0 && (
                              <span className="whitespace-nowrap">{stopCount} עצירות</span>
                            )}
                          </div>

                          {tow.status === 'in_progress' && tow.points.length > 1 && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-500 rounded-full transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span>{progress}%</span>
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              {totalTows > CUSTOMER_PORTAL_TOW_PAGE_SIZE && (
                <div className="shrink-0">{paginationBar}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
