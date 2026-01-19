'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { getDriverByUserId, DriverInfo } from '../../lib/queries/driver-tasks'
import { supabase } from '../../lib/supabase'
import { 
  History, 
  Search, 
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Car,
  X,
  Loader2,
  ChevronLeft
} from 'lucide-react'
import Link from 'next/link'

// ==================== Types ====================

interface HistoryItem {
  id: string
  date: string
  time: string
  vehicle: { name: string; plate: string }
  from: string
  to: string
  status: 'completed' | 'cancelled'
  price: number
  duration: number
  cancelReason?: string
}

// ==================== Component ====================

export default function DriverHistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null)
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && user) {
      loadData()
    }
  }, [authLoading, user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)

    console.log('History - user:', user.id)

    const { data: { user: authUser } } = await supabase.auth.getUser()
    console.log('History - auth user:', authUser?.id)

    try {
      const driver = await getDriverByUserId(user.id)
      if (!driver) {
        setLoading(false)
        return
      }
      setDriverInfo(driver)

      const history = await fetchDriverHistory(driver.id)
      setHistoryItems(history)
    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setLoading(false)
    }
  }

  // ==================== Fetch History ====================

  const fetchDriverHistory = async (driverId: string): Promise<HistoryItem[]> => {
    // Fetch completed and cancelled tows from last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: tows, error } = await supabase
      .from('tows')
      .select(`
        id,
        status,
        created_at,
        completed_at,
        started_at,
        final_price,
        cancel_reason
      `)
      .eq('driver_id', driverId)
      .in('status', ['completed', 'cancelled'])
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (error || !tows) {
      console.error('Error fetching history:', error)
      return []
    }

    const towIds = tows.map(t => t.id)

    // Fetch vehicles for these tows
    const { data: vehicles } = await supabase
      .from('tow_vehicles')
      .select('tow_id, plate_number, manufacturer, model')
      .in('tow_id', towIds)

    // Fetch points or legs for addresses
    const { data: points } = await supabase
      .from('tow_points')
      .select('tow_id, point_type, address, point_order')
      .in('tow_id', towIds)
      .order('point_order', { ascending: true })

    const { data: legs } = await supabase
      .from('tow_legs')
      .select('tow_id, leg_type, from_address, to_address, leg_order')
      .in('tow_id', towIds)
      .order('leg_order', { ascending: true })

    // Map data
    const vehiclesByTow: Record<string, any> = {}
    vehicles?.forEach(v => {
      if (!vehiclesByTow[v.tow_id]) vehiclesByTow[v.tow_id] = v
    })

    const addressesByTow: Record<string, { from: string; to: string }> = {}
    
    // First try points
    points?.forEach(p => {
      if (!addressesByTow[p.tow_id]) {
        addressesByTow[p.tow_id] = { from: '', to: '' }
      }
      if (p.point_type === 'pickup' && !addressesByTow[p.tow_id].from) {
        addressesByTow[p.tow_id].from = p.address || ''
      }
      if (p.point_type === 'dropoff') {
        addressesByTow[p.tow_id].to = p.address || ''
      }
    })

    // Fallback to legs
    legs?.forEach(l => {
      if (!addressesByTow[l.tow_id]) {
        addressesByTow[l.tow_id] = { from: '', to: '' }
      }
      if (l.leg_type === 'pickup' && l.from_address && !addressesByTow[l.tow_id].from) {
        addressesByTow[l.tow_id].from = l.from_address
      }
      if (l.leg_type === 'delivery' && l.to_address) {
        addressesByTow[l.tow_id].to = l.to_address
      }
    })

    return tows.map(tow => {
      const vehicle = vehiclesByTow[tow.id]
      const addresses = addressesByTow[tow.id] || { from: 'לא צוין', to: 'לא צוין' }
      
      // Calculate duration
      let duration = 0
      if (tow.started_at && tow.completed_at) {
        const start = new Date(tow.started_at)
        const end = new Date(tow.completed_at)
        duration = Math.round((end.getTime() - start.getTime()) / 60000)
      }

      const createdDate = new Date(tow.created_at)

      return {
        id: tow.id,
        date: createdDate.toISOString().split('T')[0],
        time: createdDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        vehicle: {
          name: vehicle ? `${vehicle.manufacturer || ''} ${vehicle.model || ''}`.trim() || 'רכב' : 'רכב',
          plate: vehicle?.plate_number || ''
        },
        from: addresses.from || 'לא צוין',
        to: addresses.to || 'לא צוין',
        status: tow.status as 'completed' | 'cancelled',
        price: tow.final_price || 0,
        duration,
        cancelReason: tow.cancel_reason || 'בוטלה'
      }
    })
  }

  // ==================== Helpers ====================

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (dateStr === today.toISOString().split('T')[0]) return 'היום'
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'אתמול'
    
    return date.toLocaleDateString('he-IL', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'short' 
    })
  }

  // Filter and group items
  const filteredItems = historyItems
    .filter(item => filter === 'all' || item.status === filter)
    .filter(item => 
      !searchQuery || 
      item.vehicle.name.includes(searchQuery) ||
      item.vehicle.plate.includes(searchQuery) ||
      item.from.includes(searchQuery) ||
      item.to.includes(searchQuery)
    )

  const groupedItems = filteredItems.reduce((groups, item) => {
    const date = item.date
    if (!groups[date]) groups[date] = []
    groups[date].push(item)
    return groups
  }, {} as Record<string, HistoryItem[]>)

  const totalEarnings = filteredItems
    .filter(i => i.status === 'completed')
    .reduce((sum, i) => sum + i.price, 0)

  const totalTows = filteredItems.filter(i => i.status === 'completed').length

  // ==================== Loading State ====================

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">טוען היסטוריה...</p>
        </div>
      </div>
    )
  }

  // ==================== Main Render ====================

  return (
    <div className="min-h-screen bg-gray-50 pb-6" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="px-5 pt-12 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">היסטוריה</h1>
            <button 
              onClick={() => setSearchOpen(!searchOpen)}
              className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"
            >
              {searchOpen ? <X className="w-5 h-5 text-gray-600" /> : <Search className="w-5 h-5 text-gray-600" />}
            </button>
          </div>

          {/* Search Bar */}
          {searchOpen && (
            <div className="mb-4">
              <input
                type="text"
                placeholder="חיפוש לפי רכב, כתובת..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-gray-100 rounded-xl text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          )}

          {/* Summary Cards */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-3 text-white">
              <div className="text-2xl font-bold">₪{totalEarnings.toLocaleString()}</div>
              <div className="text-emerald-100 text-sm">סה״כ הכנסות</div>
            </div>
            <div className="flex-1 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 text-white">
              <div className="text-2xl font-bold">{totalTows}</div>
              <div className="text-blue-100 text-sm">גרירות הושלמו</div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                filter === 'all' 
                  ? 'bg-white text-gray-800 shadow-sm' 
                  : 'text-gray-500'
              }`}
            >
              הכל
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                filter === 'completed' 
                  ? 'bg-white text-emerald-600 shadow-sm' 
                  : 'text-gray-500'
              }`}
            >
              הושלמו
            </button>
            <button
              onClick={() => setFilter('cancelled')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                filter === 'cancelled' 
                  ? 'bg-white text-red-600 shadow-sm' 
                  : 'text-gray-500'
              }`}
            >
              בוטלו
            </button>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="px-5 py-4">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-12">
            <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">לא נמצאו גרירות</p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([date, items]) => (
            <div key={date} className="mb-6">
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-500">{formatDate(date)}</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                {items.map((item) => (
                  <Link 
                    key={item.id}
                    href={`/driver/task/${item.id}`}
                    className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
                  >
                    {/* Top Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          item.status === 'completed' 
                            ? 'bg-emerald-100' 
                            : 'bg-red-100'
                        }`}>
                          <Car className={`w-5 h-5 ${
                            item.status === 'completed' 
                              ? 'text-emerald-600' 
                              : 'text-red-500'
                          }`} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-800">{item.vehicle.name}</div>
                          <div className="text-sm text-gray-400">{item.vehicle.plate}</div>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-sm text-gray-400">{item.time}</div>
                        {item.status === 'completed' && item.price > 0 && (
                          <div className="text-lg font-bold text-emerald-600">₪{item.price}</div>
                        )}
                      </div>
                    </div>

                    {/* Route */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-sm text-gray-600 flex-1 truncate">{item.from}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-sm text-gray-600 flex-1 truncate">{item.to}</span>
                      </div>
                    </div>

                    {/* Bottom Row */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      {item.status === 'completed' ? (
                        <>
                          <div className="flex items-center gap-1 text-gray-400">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm">{item.duration > 0 ? `${item.duration} דק׳` : '--'}</span>
                          </div>
                          <div className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm font-medium">הושלמה</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm text-gray-400">{item.cancelReason}</div>
                          <div className="flex items-center gap-1 text-red-500">
                            <XCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">בוטלה</span>
                          </div>
                        </>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
