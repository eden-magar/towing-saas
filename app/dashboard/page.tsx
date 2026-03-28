  'use client'

  import { useEffect, useState, useRef, useMemo } from 'react'
  import { useRouter } from 'next/navigation'
  import { useAuth } from '../lib/AuthContext'
  import { getDashboardStats, DashboardStats } from '../lib/queries/dashboard'
  import { getExpiryAlerts, ExpiryAlert } from '../lib/queries/alerts'
  import { getTows, TowWithDetails, searchTows } from '../lib/queries/tows'
  import { getPendingRejectionRequests, approveRejectionRequest, denyRejectionRequest, REJECTION_REASONS } from '../lib/queries/rejection-requests'
  import { getAvailableDrivers, getDrivers } from '../lib/queries/drivers'
  import { getDriversOvertime, endShiftManually, getActiveDriversWithLocation } from '../lib/queries/driver-shifts'
  import { getDayTows } from '../lib/queries/calendar'
  import { getDriverTasksForDriver } from '../lib/queries/driver-tasks-admin'
  import { supabase } from '../lib/supabase'
  import DriversMap from '../components/DriversMap'
  import Link from 'next/link'
  import { Plus, RefreshCw, AlertTriangle, FileText, Shield, CreditCard, Clock, ChevronLeft, ChevronRight, Truck, Check, Search, Loader2 } from 'lucide-react'

  const alertTypeConfig: Record<string, { label: string; icon: typeof Truck; link: string }> = {
    truck_license: { label: 'רישיון רכב', icon: FileText, link: '/dashboard/trucks' },
    truck_insurance: { label: 'ביטוח גרר', icon: Shield, link: '/dashboard/trucks' },
    driver_license: { label: 'רישיון נהיגה', icon: CreditCard, link: '/dashboard/drivers' },
    tachograph: { label: 'כיול טכוגרף', icon: Clock, link: '/dashboard/trucks' },
    engineer_report: { label: 'תסקיר מהנדס', icon: FileText, link: '/dashboard/trucks' },
    winter_inspection: { label: 'בדיקת חורף', icon: Truck, link: '/dashboard/trucks' },
  }

  const TOW_STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    assigned: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  const DRIVER_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4']

  export default function DashboardPage() {
    const { user, companyId, loading: authLoading } = useAuth()
    const router = useRouter()

    const [stats, setStats] = useState<DashboardStats>({ towsToday: 0, pendingTows: 0, completedToday: 0, availableDrivers: 0 })
    const [pendingTows, setPendingTows] = useState<TowWithDetails[]>([])
    const [quoteTows, setQuoteTows] = useState<TowWithDetails[]>([])
    const [alerts, setAlerts] = useState<ExpiryAlert[]>([])
    const [rejectionRequests, setRejectionRequests] = useState<any[]>([])
    const [availableDrivers, setAvailableDrivers] = useState<any[]>([])
    const [overtimeDrivers, setOvertimeDrivers] = useState<any[]>([])
    const [driversWithLocation, setDriversWithLocation] = useState<any[]>([])
    const [calendarDate, setCalendarDate] = useState(new Date())
    const [calendarTows, setCalendarTows] = useState<any[]>([])
    const [todayTows, setTodayTows] = useState<any[]>([])
    const [activeDrivers, setActiveDrivers] = useState<any[]>([])
    const [allDrivers, setAllDrivers] = useState<any[]>([])
    const [activeTasks, setActiveTasks] = useState<number>(0)
    const [inProgressTows, setInProgressTows] = useState<number>(0)
    const [selectedDrivers, setSelectedDrivers] = useState<string[]>([])

  const isAllSelected = selectedDrivers.length === 0

  const toggleDriver = (driverId: string) => {
    if (driverId === 'all') {
      setSelectedDrivers([])
    } else {
      setSelectedDrivers(prev =>
        prev.includes(driverId) ? prev.filter(d => d !== driverId) : [...prev, driverId]
      )
    }
  }
    const [loading, setLoading] = useState(true)

    // modal state
    const [showApprovalModal, setShowApprovalModal] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState<any>(null)
    const [selectedNewDriver, setSelectedNewDriver] = useState('')
    const [approvalAction, setApprovalAction] = useState<'reassign' | 'unassign'>('unassign')
    const [processingRequest, setProcessingRequest] = useState(false)

    const [showEndShiftModal, setShowEndShiftModal] = useState(false)
    const [endShiftTarget, setEndShiftTarget] = useState<{ shiftId: string; driverName: string } | null>(null)
    const [endShiftDate, setEndShiftDate] = useState(() => new Date().toISOString().split('T')[0])
    const [endShiftTime, setEndShiftTime] = useState(() => {
      const n = new Date()
      return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
    })

    const searchWrapRef = useRef<HTMLDivElement>(null)
    const [towSearchInput, setTowSearchInput] = useState('')
    const [towSearchDebounced, setTowSearchDebounced] = useState('')
    const [towSearchResults, setTowSearchResults] = useState<TowWithDetails[]>([])
    const [towSearchOpen, setTowSearchOpen] = useState(false)
    const [isSearching, setIsSearching] = useState(false)

    useEffect(() => {
      const t = setTimeout(() => setTowSearchDebounced(towSearchInput), 300)
      return () => clearTimeout(t)
    }, [towSearchInput])

    useEffect(() => {
      if (!companyId || !towSearchDebounced.trim()) {
        setTowSearchResults([])
        setTowSearchOpen(false)
        setIsSearching(false)
        return
      }
      let cancelled = false
      setTowSearchResults([])
      setIsSearching(true)
      searchTows(companyId, towSearchDebounced)
        .then(r => {
          if (!cancelled) {
            setTowSearchResults(r)
            setTowSearchOpen(true)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setTowSearchResults([])
            setTowSearchOpen(false)
          }
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false)
        })
      return () => {
        cancelled = true
      }
    }, [towSearchDebounced, companyId])

    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
          setTowSearchOpen(false)
        }
      }
      document.addEventListener('mousedown', onDoc)
      return () => document.removeEventListener('mousedown', onDoc)
    }, [])

    const loadData = async () => {
      if (!companyId) return
      try {
        const [
          statsData, towsData, alertsData, rejectionsData,
          driversData, overtimeData, activeDriversData, allDriversData,
        ] = await Promise.all([
          getDashboardStats(companyId),
          getTows(companyId),
          getExpiryAlerts(companyId),
          getPendingRejectionRequests(companyId),
          getAvailableDrivers(companyId),
          getDriversOvertime(companyId),
          getActiveDriversWithLocation(companyId),
          getDrivers(companyId),
        ])

        setStats(statsData)
        setPendingTows(towsData.filter((t: TowWithDetails) => t.status === 'pending' && !t.driver_id))
        setQuoteTows(towsData.filter((t: TowWithDetails) => t.status === 'quote'))
        setInProgressTows(towsData.filter((t: TowWithDetails) => t.status === 'in_progress').length)
        setAlerts(alertsData)
        setRejectionRequests(rejectionsData)
        setAvailableDrivers(driversData)
        setOvertimeDrivers(overtimeData)

        const mappedDrivers = activeDriversData
          .map((d: any) => ({
            id: d.driver.id,
            name: d.driver.user?.full_name || 'נהג',
            status: d.driver.status,
            last_lat: d.driver.last_lat,
            last_lng: d.driver.last_lng,
            last_seen_at: d.driver.last_seen_at,
          }))
          .filter((d: any) => d.last_lat && d.last_lng)
        setDriversWithLocation(mappedDrivers)
        setActiveDrivers(activeDriversData.map((d: any) => d.driver))
        setAllDrivers(allDriversData)
        const todayData = await getDayTows(companyId, new Date())
        setTodayTows(todayData || [])
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }

    const loadCalendar = async () => {
      if (!companyId) return
      try {
        const dateStr = calendarDate.toISOString().split('T')[0]
        const tows = await getDayTows(companyId, calendarDate)
        setCalendarTows(tows || [])
      } catch (err) {
        console.error('Calendar load error:', err)
      }
    }

    useEffect(() => {
      if (!authLoading && companyId) {
        loadData()
      } else if (!authLoading) {
        setLoading(false)
      }
    }, [companyId, authLoading])

    useEffect(() => {
      loadCalendar()
    }, [companyId, calendarDate])

    // Realtime — כל הטבלאות
    useEffect(() => {
      if (!companyId) return

      const channel = supabase
        .channel(`dashboard-realtime-${companyId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tows', filter: `company_id=eq.${companyId}` }, () => { loadData(); loadCalendar() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tow_rejection_requests', filter: `company_id=eq.${companyId}` }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers', filter: `company_id=eq.${companyId}` }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_shifts', filter: `company_id=eq.${companyId}` }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_tasks', filter: `company_id=eq.${companyId}` }, () => loadData())
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }, [companyId])

    const prevDay = () => {
      const d = new Date(calendarDate)
      d.setDate(d.getDate() - 1)
      setCalendarDate(d)
    }

    const nextDay = () => {
      const d = new Date(calendarDate)
      d.setDate(d.getDate() + 1)
      setCalendarDate(d)
    }

    const isToday = calendarDate.toDateString() === new Date().toDateString()

    const formatDayLabel = (date: Date) => {
      return date.toLocaleDateString('he-IL', { weekday: 'short', day: '2-digit', month: '2-digit' })
    }

    const getDaysText = (daysLeft: number) => {
      if (daysLeft < 0) return `פג לפני ${Math.abs(daysLeft)} ימים`
      if (daysLeft === 0) return 'פג היום!'
      if (daysLeft === 1) return 'פג מחר!'
      return `עוד ${daysLeft} ימים`
    }

    // קיבוץ גרירות יומן לפי נהג
    const allDriverIds = allDrivers.filter((d: any) => d.user?.is_active === true).map((d: any) => d.id)

  const filteredCalendarTows = useMemo(() => {
    if (isAllSelected) return calendarTows
    return calendarTows.filter((t: any) => t.driver_id && selectedDrivers.includes(t.driver_id))
  }, [calendarTows, selectedDrivers, isAllSelected])

  const allActiveDriverIds = allDrivers
    .filter((d: any) => d.user?.is_active === true)
    .map((d: any) => d.id)
  const driverIds = isAllSelected
    ? allActiveDriverIds
    : allActiveDriverIds.filter((id: string) => selectedDrivers.includes(id))
    const HOURS = Array.from({ length: 24 }, (_, i) => i) // 00:00–23:00

    const getTowsForDriverHour = (driverId: string, hour: number) => {
    return filteredCalendarTows.filter((t: any) => {
        if (t.driver_id !== driverId) return false
        const towHour = t.scheduled_at ? new Date(t.scheduled_at).getHours() : new Date(t.created_at).getHours()
        return towHour === hour
      })
    }

    const getDriverName = (driverId: string) => {
      const d = activeDrivers.find((d: any) => d.id === driverId)
        || allDrivers.find((d: any) => d.id === driverId)
      return d?.user?.full_name || 'נהג'
    }

    const getCurrentTimePosition = () => {
      const now = new Date()
      return now.getHours() + now.getMinutes() / 60
    }

    function formatWaitTime(createdAt: string): string {
      const minutes = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000)
      if (minutes < 60) return `${minutes} דק׳`
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      if (hours < 24) {
        return remainingMinutes > 0 ? `${hours} שע׳ ${remainingMinutes} דק׳` : `${hours} שע׳`
      }
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return remainingHours > 0 ? `${days} ימים ${remainingHours} שע׳` : `${days} ימים`
    }

    if (authLoading || loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="animate-spin text-gray-400" size={24} />
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3 h-[calc(100vh-4rem)] p-4 overflow-hidden" dir="rtl">

        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">

        {/* קבוצה 1: גרירות */}
        <div className="flex gap-2">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 min-w-[80px]">
            <div className="text-xl font-semibold text-gray-800">{stats.towsToday}</div>
            <div className="text-xs text-gray-400">גרירות היום</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 min-w-[80px]">
            <div className="text-xl font-semibold text-emerald-600">{stats.completedToday}</div>
            <div className="text-xs text-gray-400">הושלמו</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 min-w-[80px]">
            <div className="text-xl font-semibold text-indigo-500">{inProgressTows}</div>
            <div className="text-xs text-gray-400">בביצוע</div>
          </div>
        </div>

        <div className="w-px h-8 bg-gray-200" />

        {/* קבוצה 2: נהגים */}
        <div className="flex gap-2">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 min-w-[80px]">
            <div className="text-xl font-semibold text-emerald-600">{stats.availableDrivers}</div>
            <div className="text-xs text-gray-400">נהגים זמינים</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 min-w-[80px]">
            <div className="text-xl font-semibold text-red-500">{driversWithLocation.filter(d => d.status === 'busy').length}</div>
            <div className="text-xs text-gray-400">עסוקים</div>
          </div>
        </div>

        <div className="w-px h-8 bg-gray-200" />

        {/* קבוצה 3: כספי */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 min-w-[100px]">
          <div className="text-xl font-semibold text-gray-800">
            ₪{todayTows.filter((t: any) => t.status === 'completed').reduce((s: number, t: any) => s + (t.final_price || 0), 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">הכנסות היום</div>
        </div>

        <div className="w-px h-8 bg-gray-200" />

        {/* קבוצה 4: דחוף */}
        <div className={`rounded-xl px-4 py-2 min-w-[90px] border ${
          pendingTows.length > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-white border-gray-200'
        }`}>
          <div className={`text-xl font-semibold ${pendingTows.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {pendingTows.length}
          </div>
          <div className={`text-xs ${pendingTows.length > 0 ? 'text-red-400' : 'text-gray-400'}`}>
            ממתינות לשיבוץ
          </div>
        </div>

        <div ref={searchWrapRef} className="relative flex-shrink-0">
          <div className="relative rounded-xl bg-white shadow-sm">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-[18px] -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              type="search"
              value={towSearchInput}
              onChange={e => setTowSearchInput(e.target.value)}
              onFocus={() => {
                if (towSearchResults.length > 0 && towSearchDebounced.trim()) setTowSearchOpen(true)
              }}
              placeholder="חיפוש גרירה..."
              className="w-72 rounded-xl border border-gray-300 bg-white py-2 pr-10 pl-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#33d4ff] focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
            />
          </div>
          {towSearchOpen && towSearchDebounced.trim() && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg">
              {isSearching ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  מחפש...
                </div>
              ) : towSearchResults.length === 0 && towSearchDebounced.trim() ? (
                <div className="px-3 py-2 text-xs text-gray-500">לא נמצאו תוצאות</div>
              ) : (
                towSearchResults.map(t => {
                  const v = t.vehicles?.[0]
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-gray-50 px-3 py-2 text-right text-xs last:border-0 hover:bg-gray-50"
                      onMouseEnter={() => router.prefetch(`/dashboard/tows/${t.id}`)}
                      onClick={() => {
                        router.push(`/dashboard/tows/${t.id}`)
                        setTowSearchOpen(false)
                        setTowSearchInput('')
                        setTowSearchDebounced('')
                        setTowSearchResults([])
                        setIsSearching(false)
                      }}
                    >
                      <span className="font-bold text-gray-800">{t.order_number ?? '—'}</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-700">{t.customer?.name ?? '—'}</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-700">{v?.plate_number ?? '—'}</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-600">{v?.vehicle_type ?? '—'}</span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        <Link
          href="/dashboard/tows/create"
          className="mr-auto flex items-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0"
        >
          <Plus size={16} />
          גרירה חדשה
        </Link>

      </div>

        {/* תוכן ראשי */}
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">

          {/* ימין: מפה לגובה מלא */}
          <div className="bg-white border border-gray-200 rounded-xl flex flex-col min-h-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                מפה חיה
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-xs text-gray-400">זמן אמת</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <DriversMap drivers={driversWithLocation} />
            </div>
            <div className="flex gap-3 px-3 py-1.5 border-t border-gray-100 flex-shrink-0">
              {[
                { color: '#1D9E75', label: 'זמין' },
                { color: '#E24B4A', label: 'עסוק' },
                { color: '#BA7517', label: 'הפסקה' },
                { color: '#888', label: 'לא זמין' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-xs text-gray-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* שמאל: יומן + 2×2 */}
          <div className="flex flex-col gap-3 min-h-0">

            {/* יומן */}
            <div className="bg-white border border-gray-200 rounded-xl flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <button onClick={prevDay} className="w-5 h-5 flex items-center justify-center border border-gray-200 rounded text-gray-500 hover:bg-gray-50">
                    <ChevronRight size={11} />
                  </button>
                  <button onClick={nextDay} className="w-5 h-5 flex items-center justify-center border border-gray-200 rounded text-gray-500 hover:bg-gray-50">
                    <ChevronLeft size={11} />
                  </button>
                  <span className="text-xs font-medium text-gray-700">{formatDayLabel(calendarDate)}</span>
                  {isToday && <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">היום</span>}
                </div>
                {/* פילטר נהגים */}
                {allDriverIds.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => toggleDriver('all')}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border transition-colors ${
                        isAllSelected ? 'border-[#33d4ff] bg-[#33d4ff]/10 text-[#33d4ff]' : 'border-gray-200 bg-gray-50 text-gray-500'
                      }`}
                    >
                      הכל {isAllSelected && <Check size={9} />}
                    </button>
                    {allDriverIds.map((id, i) => {
                      const color = DRIVER_COLORS[i % DRIVER_COLORS.length]
                      const selected = selectedDrivers.includes(id as string)
                      return (
                        <button
                          key={id as string}
                          onClick={() => toggleDriver(id as string)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border-2 transition-all"
                          style={{
                            backgroundColor: selected ? color + '20' : '#f3f4f6',
                            color: selected ? color : '#9ca3af',
                            borderColor: selected ? color : 'transparent',
                          }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                          {getDriverName(id as string).split(' ')[0]}
                          {selected && <Check size={9} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-auto min-h-0">
                {driverIds.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-300 text-xs">אין גרירות ביום זה</div>
                ) : (
                    <table className="w-full text-xs border-collapse" style={{ minWidth: `${driverIds.length * 120 + 60}px` }}>
                      <thead>
                        <tr className="sticky top-0 bg-gray-50 z-10">
                          <th className="text-right px-1.5 py-1.5 text-gray-400 font-medium border-b border-gray-100 w-8"></th>
                          {driverIds.map((id, i) => (
                            <th key={id as string} className="text-center px-1 py-1.5 font-medium border-b border-gray-100 border-l border-l-gray-100 text-xs" style={{ color: DRIVER_COLORS[i % DRIVER_COLORS.length], width: `${100 / driverIds.length}%` }}>
                              {getDriverName(id as string).split(' ')[0]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody style={{ position: 'relative' }}>
                        {HOURS.map(hour => (
                          <tr key={hour} className="border-b border-gray-200" style={{ height: '40px' }}>
                            <td className="px-1 py-1 text-gray-500 border-l border-gray-200 text-xs font-medium">{hour}:00</td>
                            {driverIds.map(id => {
                              const tows = getTowsForDriverHour(id as string, hour)
                              return (
                                <td key={id as string} className="px-0.5 py-0.5 border-l border-gray-200 min-h-6" style={{ width: `${100 / driverIds.length}%` }}>
                                  {tows.length > 0 ? tows.map((t: any) => {
                                  const driverIdx = driverIds.indexOf(id)
                                  const color = DRIVER_COLORS[driverIdx % DRIVER_COLORS.length]
                                  const isLight = ['#f59e0b', '#10b981', '#06b6d4'].includes(color)
                                  return (
                                    <div
                                      key={t.id}
                                      onClick={() => router.push(`/dashboard/tows/${t.id}`)}
                                      className="rounded px-1 py-0.5 mb-0.5 cursor-pointer truncate text-xs font-medium"
                                      style={{
                                        background: color + '25',
                                        color: color,
                                        border: `1px solid ${color}40`,
                                      }}
                                      title={`${t.customer?.name || ''} ${t.order_number || ''}`.trim()}
                                    >
                                      {t.customer?.name || t.order_number?.slice(-4) || t.id.slice(0, 4)}
                                    </div>
                                  )
                                }) : (
                                  <button
                                    onClick={() => router.push('/dashboard/tows/create')}
                                    className="w-full h-5 border border-dashed border-gray-100 rounded text-gray-200 opacity-0 hover:opacity-100 hover:border-gray-300 hover:text-gray-300 flex items-center justify-center text-xs transition-opacity"
                                  >
                                    +
                                  </button>
                                )}
                                 
                                 
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                        {isToday && (
                          <tr
                            className="pointer-events-none"
                            style={{
                              position: 'absolute',
                              top: `${getCurrentTimePosition() * 40}px`,
                              left: 0,
                              right: 0,
                              height: '2px',
                              backgroundColor: '#ef4444',
                              opacity: 0.7,
                              zIndex: 10,
                            }}
                          >
                            <td colSpan={driverIds.length + 1} style={{ padding: 0, height: '2px', backgroundColor: '#ef4444' }} />
                          </tr>
                        )}
                      </tbody>
                    </table>
                )}
              </div>
            </div>

            {/* 2×2 כרטיסים */}
            <div className="flex gap-3 flex-shrink-0">
              {/* Right column (RTL) */}
              <div className="flex flex-col gap-3 flex-1">
              {/* ממתינות לשיבוץ */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                    ממתינות לשיבוץ
                  </div>
                  {pendingTows.length > 0 && <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full">{pendingTows.length}</span>}
                </div>
                <div className="divide-y divide-gray-50 overflow-y-auto max-h-40">
                    {pendingTows.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-gray-300 text-center">אין ממתינות</div>
                    ) : pendingTows.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(tow => (
                    <div key={tow.id} className="px-3 py-1.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-700 truncate">{tow.vehicles?.[0]?.plate_number || '—'}</div>
                        <div className="text-xs text-gray-400 truncate">{tow.legs?.[0]?.from_address?.split(',')[0] || '—'} → {tow.legs?.[tow.legs.length - 1]?.to_address?.split(',')[0] || '—'}</div>
                      </div>
                      <span className="text-xs text-amber-600 flex-shrink-0">{formatWaitTime(tow.created_at)}</span>
                      <button onClick={() => router.push(`/dashboard/tows/${tow.id}`)} className="text-xs px-2 py-1 bg-gray-900 text-white rounded-lg flex-shrink-0 hover:bg-gray-700">שבץ</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* הצעות מחיר ממתינות */}
              {quoteTows.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-amber-800">
                      הצעות מחיר ממתינות
                    </span>
                    <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {quoteTows.length}
                    </span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {quoteTows.map(t => (
                      <div
                        key={t.id}
                        onClick={() => router.push(`/dashboard/tows/${t.id}`)}
                        className="flex items-center justify-between p-2 bg-white rounded-lg cursor-pointer hover:bg-amber-50 text-xs"
                      >
                        <span className="font-medium">{t.order_number || t.id.slice(0, 8)}</span>
                        <span className="text-gray-500">{t.customer?.name || 'לקוח'}</span>
                        <span className="text-amber-600 flex-shrink-0">{formatWaitTime(t.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* בקשות דחייה */}
              <div className="flex-shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                    בקשות דחייה
                  </div>
                  {rejectionRequests.length > 0 && <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full">{rejectionRequests.length}</span>}
                </div>
                <div className="divide-y divide-gray-50 overflow-y-auto max-h-40">
                  {rejectionRequests.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-300 text-center">אין בקשות דחייה</div>
                  ) : rejectionRequests.map(req => {
                    const reasonInfo = REJECTION_REASONS.find(r => r.key === req.reason)
                    return (
                      <div key={req.id} className="px-3 py-1.5 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate">{req.driver?.user?.full_name}</div>
                          <Link href={`/dashboard/tows/${req.tow_id}`} className="text-xs text-blue-500 hover:underline truncate block">
                            #{req.tow_id?.slice(0, 8)}
                          </Link>
                          <div className="text-xs text-gray-400 truncate">{reasonInfo?.label || req.reason_note}</div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => { setSelectedRequest(req); setShowApprovalModal(true) }} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100">אשר</button>
                          <button onClick={async () => { if (confirm('לדחות הבקשה?')) { await denyRejectionRequest(req.id, user?.id || ''); loadData() } }} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">דחה</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              </div>

              {/* Left column (RTL) */}
              <div className="flex flex-col gap-3 flex-1">
              {/* לא סיימו משמרת */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    לא סיימו משמרת
                  </div>
                  {overtimeDrivers.length > 0 && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">{overtimeDrivers.length}</span>}
                </div>
                <div className="divide-y divide-gray-50 overflow-y-auto max-h-40">
                  {overtimeDrivers.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-300 text-center">כל הנהגים סיימו</div>
                  ) : overtimeDrivers.map((shift: any) => {
                    const driver = shift.driver as any
                    return (
                      <div key={shift.id} className="px-3 py-1.5 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-700">{driver?.user?.full_name}</div>
                          <div className="text-xs text-gray-400">החל {new Date(shift.started_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} · עד {driver?.work_hours_end?.slice(0, 5)}</div>
                        </div>
                        <button
                          onClick={() => {
                            const today = new Date().toISOString().split('T')[0]
                            const now = new Date()
                            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                            const timeFromDriver = driver?.work_hours_end?.slice(0, 5)
                            setEndShiftTarget({ shiftId: shift.id, driverName: driver?.user?.full_name || 'נהג' })
                            setEndShiftDate(today)
                            setEndShiftTime(timeFromDriver || currentTime)
                            setShowEndShiftModal(true)
                          }}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-200 flex-shrink-0"
                        >
                          סיים
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* התראות תוקף */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                    התראות תוקף
                  </div>
                  {alerts.length > 0 && <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full">{alerts.length}</span>}
                </div>
                <div className="divide-y divide-gray-50 overflow-y-auto max-h-40">
                  {alerts.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-300 text-center">אין התראות</div>
                  ) : alerts.map(alert => {
                    const config = alertTypeConfig[alert.type]
                    const Icon = config?.icon || AlertTriangle
                    return (
                      <Link key={alert.id} href={config?.link || '/dashboard/trucks'} className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50">
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${alert.severity === 'expired' ? 'bg-red-100' : 'bg-amber-100'}`}>
                          <Icon size={10} className={alert.severity === 'expired' ? 'text-red-600' : 'text-amber-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate">{alert.entityName}</div>
                          <div className="text-xs text-gray-400">{getDaysText(alert.daysLeft)}</div>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${alert.severity === 'expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                          {alert.severity === 'expired' ? 'פג' : 'בקרוב'}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
              </div>

            </div>
          </div>

        </div>

        {/* מודל אישור דחייה */}
        {showApprovalModal && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800">אישור בקשת דחייה</h3>
                <p className="text-sm text-gray-500 mt-1">מה לעשות עם המשימה?</p>
              </div>
              <div className="p-5 space-y-4">
                <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="action" checked={approvalAction === 'reassign'} onChange={() => setApprovalAction('reassign')} className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-medium text-gray-800">העבר לנהג אחר</div>
                    <div className="text-sm text-gray-500">בחר נהג שיקבל את המשימה</div>
                  </div>
                </label>
                {approvalAction === 'reassign' && (
                  <select value={selectedNewDriver} onChange={e => setSelectedNewDriver(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">בחר נהג...</option>
                    {availableDrivers.filter(d => d.id !== selectedRequest.driver_id).map(driver => (
                      <option key={driver.id} value={driver.id}>{driver.user?.full_name}</option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="action" checked={approvalAction === 'unassign'} onChange={() => setApprovalAction('unassign')} className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-medium text-gray-800">החזר לתור</div>
                    <div className="text-sm text-gray-500">המשימה תחכה לשיבוץ חדש</div>
                  </div>
                </label>
              </div>
              <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button onClick={() => { setShowApprovalModal(false); setSelectedRequest(null); setSelectedNewDriver(''); setApprovalAction('unassign') }}
                  disabled={processingRequest} className="flex-1 py-3 border border-gray-200 bg-white text-gray-600 rounded-xl font-medium">
                  ביטול
                </button>
                <button
                  onClick={async () => {
                    if (approvalAction === 'reassign' && !selectedNewDriver) return alert('יש לבחור נהג')
                    setProcessingRequest(true)
                    try {
                      await approveRejectionRequest(selectedRequest.id, user?.id || '', approvalAction === 'reassign' ? selectedNewDriver : undefined)
                      setShowApprovalModal(false); setSelectedRequest(null); setSelectedNewDriver(''); setApprovalAction('unassign')
                      loadData()
                    } catch { alert('שגיאה באישור הבקשה') }
                    finally { setProcessingRequest(false) }
                  }}
                  disabled={processingRequest || (approvalAction === 'reassign' && !selectedNewDriver)}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium disabled:opacity-50">
                  {processingRequest ? 'מעבד...' : 'אשר'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* מודל סיום משמרת */}
        {showEndShiftModal && endShiftTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white">
              <div className="border-b border-gray-100 p-5">
                <h3 className="text-lg font-bold text-gray-800">סיום משמרת — {endShiftTarget.driverName}</h3>
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">תאריך סיום</label>
                  <input
                    type="date"
                    value={endShiftDate}
                    onChange={e => setEndShiftDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">שעת סיום</label>
                  <input
                    type="time"
                    value={endShiftTime}
                    onChange={e => setEndShiftTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
                  />
                </div>
              </div>
              <div className="flex gap-3 border-t border-gray-100 bg-gray-50 p-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowEndShiftModal(false)
                    setEndShiftTarget(null)
                  }}
                  className="flex-1 rounded-xl border border-gray-200 bg-white py-3 font-medium text-gray-600"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    console.log('endShift:', endShiftTarget?.shiftId, endShiftDate, endShiftTime)
                    const endedAt = new Date(`${endShiftDate}T${endShiftTime}:00`).toISOString()
                    await endShiftManually(endShiftTarget.shiftId, endedAt)
                    await loadData()
                    setShowEndShiftModal(false)
                    setEndShiftTarget(null)
                  }}
                  className="flex-1 rounded-xl bg-[#33d4ff] py-3 font-medium text-white hover:bg-[#21b8e6]"
                >
                  סיים משמרת
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }