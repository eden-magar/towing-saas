'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/AuthContext'
import { getCustomerForUser, getCustomerTows, getCustomerStats } from '@/app/lib/queries/customer-portal'
import type { CustomerPortalTow } from '@/app/lib/types'
import {
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ChevronLeft,
  Search,
  Filter,
  Loader2,
  Package
} from 'lucide-react'

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'ממתינה', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: Clock },
  assigned: { label: 'שובצה לנהג', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Truck },
  in_progress: { label: 'בביצוע', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Truck },
  completed: { label: 'הושלמה', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle2 },
  cancelled: { label: 'בוטלה', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: AlertCircle },
}

export default function CustomerDashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [tows, setTows] = useState<CustomerPortalTow[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (authLoading || !user) return

    const load = async () => {
      const info = await getCustomerForUser(user.id)
      if (!info) return
      setCustomerId(info.customerId)

      const [towsData, statsData] = await Promise.all([
        getCustomerTows(info.customerId, { status: statusFilter }),
        getCustomerStats(info.customerId),
      ])

      setTows(towsData)
      setStats(statsData)
      setLoading(false)
    }

    load()
  }, [user, authLoading, statusFilter])

  // סינון חיפוש לוקלי
  const filteredTows = tows.filter(tow => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      tow.order_number?.toLowerCase().includes(q) ||
      tow.vehicles.some(v => v.plate_number.includes(q)) ||
      tow.points.some(p => p.address?.toLowerCase().includes(q))
    )
  })

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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'סה"כ', value: stats.total, color: 'text-gray-700', bg: 'bg-white' },
          { label: 'ממתינות', value: stats.pending, color: 'text-yellow-700', bg: 'bg-yellow-50' },
          { label: 'בביצוע', value: stats.active, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'הושלמו', value: stats.completed, color: 'text-green-700', bg: 'bg-green-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-xl border border-gray-200 p-4`}>
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש לפי מספר הזמנה, רכב או כתובת..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
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
              onClick={() => setStatusFilter(filter.value)}
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

      {/* Tows List */}
      {filteredTows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">לא נמצאו גרירות</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTows.map(tow => {
            const { from, to } = getFirstAndLast(tow)
            const progress = getProgress(tow)
            const config = statusConfig[tow.status] || statusConfig.pending
            const StatusIcon = config.icon

            return (
              <button
                key={tow.id}
                onClick={() => router.push(`/customer/tows/${tow.id}`)}
                className="w-full bg-white rounded-xl border border-gray-200 p-4 text-right hover:border-blue-300 hover:shadow-sm transition-all"
              >
                {/* Top Row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {tow.order_number && (
                      <span className="text-sm font-bold text-gray-900">
                        #{tow.order_number}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.color}`}>
                      <StatusIcon size={12} />
                      {config.label}
                    </span>
                  </div>
                  <ChevronLeft size={18} className="text-gray-400" />
                </div>

                {/* Addresses */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700 truncate">{from}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700 truncate">{to}</p>
                  </div>
                </div>

                {/* Bottom Row */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-3">
                    <span>{formatDate(tow.scheduled_at || tow.created_at)}</span>
                    {tow.vehicles.length > 0 && (
                      <span>{tow.vehicles.length} רכבים</span>
                    )}
                    {tow.driver && (
                      <span>נהג: {tow.driver.full_name}</span>
                    )}
                  </div>

                  {/* Progress */}
                  {tow.status === 'in_progress' && tow.points.length > 1 && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
          })}
        </div>
      )}
    </div>
  )
}