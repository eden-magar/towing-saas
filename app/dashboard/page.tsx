  'use client'

  import React, { useCallback, useEffect, useLayoutEffect, useState, useRef, useMemo } from 'react'
  import { useRouter } from 'next/navigation'
  import { useAuth } from '../lib/AuthContext'
  import { getDashboardStats, DashboardStats } from '../lib/queries/dashboard'
  import { getExpiryAlerts, ExpiryAlert } from '../lib/queries/alerts'
  import { getTows, TowWithDetails, searchTows, recalculateTowPrice, updateTow } from '../lib/queries/tows'
  import { getPendingRejectionRequests, approveRejectionRequest, denyRejectionRequest, REJECTION_REASONS } from '../lib/queries/rejection-requests'
  import { getAvailableDrivers, getDrivers } from '../lib/queries/drivers'
  import { getDriversOvertime, getActiveDriversWithLocation } from '../lib/queries/driver-shifts'
  import { getDayTows, updateTowSchedule } from '../lib/queries/calendar'
  import { supabase } from '../lib/supabase'
  import DriversMap from '../components/DriversMap'
  import EditShiftModal from '../components/EditShiftModal'
  import { formatOpenShiftDuration, formatShiftStartJerusalem } from '../lib/shift-datetime'
  import Link from 'next/link'
  import { Plus, RefreshCw, AlertTriangle, FileText, Shield, CreditCard, Clock, ChevronLeft, ChevronRight, Truck, Check, Search, Loader2 } from 'lucide-react'

  type EndShiftModalTarget = {
    shiftId: string
    driverName: string
    driverId: string
    startedAt: string
    workHoursEnd: string | null
  }

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

  const PIXELS_PER_HOUR = 40

  /** Same fractional-hour convention as `app/dashboard/calendar/page.tsx` (local browser time). */
  function getLocalFractionalHour(dateStr: string): number {
    const d = new Date(dateStr)
    return d.getHours() + d.getMinutes() / 60
  }

  /** Client-side day filter — matches `getCalendarTows` / `getDayTows` behavior. */
  function filterTowsForDay(tows: TowWithDetails[], date: Date): TowWithDetails[] {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    return tows.filter(tow => {
      if (tow.status === 'cancelled') return false
      const towDate = new Date(tow.scheduled_at || tow.created_at)
      return towDate >= startOfDay && towDate <= endOfDay
    })
  }

  export default function DashboardPage() {
    const { user, companyId, loading: authLoading } = useAuth()
    const router = useRouter()

    const [stats, setStats] = useState<DashboardStats>({ towsToday: 0, pendingTows: 0, completedToday: 0, availableDrivers: 0 })
    const [pendingTows, setPendingTows] = useState<TowWithDetails[]>([])
    const [quoteTows, setQuoteTows] = useState<TowWithDetails[]>([])
    const [alerts, setAlerts] = useState<ExpiryAlert[]>([])
    const [rejectionRequests, setRejectionRequests] = useState<any[]>([])
    const [denyConfirmRequest, setDenyConfirmRequest] = useState<typeof rejectionRequests[0] | null>(null)
    const [availableDrivers, setAvailableDrivers] = useState<any[]>([])
    const [overtimeDrivers, setOvertimeDrivers] = useState<any[]>([])
    const [driversWithLocation, setDriversWithLocation] = useState<any[]>([])
    const [calendarDate, setCalendarDate] = useState(new Date())
    const [calendarTows, setCalendarTows] = useState<any[]>([])
    const calendarTheadRef = useRef<HTMLTableSectionElement>(null)
    const calendarOverlayLayoutRef = useRef<HTMLDivElement>(null)
    const [calendarTheadHeightPx, setCalendarTheadHeightPx] = useState(33)
    const [driverColumnRects, setDriverColumnRects] = useState<{ left: number; width: number }[]>([])
    const [todayTows, setTodayTows] = useState<any[]>([])
    const [activeDrivers, setActiveDrivers] = useState<any[]>([])
    const [allDrivers, setAllDrivers] = useState<any[]>([])
    const [activeTasks, setActiveTasks] = useState<number>(0)
    const [inProgressTows, setInProgressTows] = useState<number>(0)
    const [selectedDrivers, setSelectedDrivers] = useState<string[]>([])
    const [draggedTow, setDraggedTow] = useState<any>(null)
    const [showPriceUpdateModal, setShowPriceUpdateModal] = useState(false)
    const [priceUpdateInfo, setPriceUpdateInfo] = useState<{
      towId: string
      oldPrice: number
      newPrice: number | null
      newBreakdown: any | null
      customerName: string
      priceMode: string
    } | null>(null)
    const [updatingPrice, setUpdatingPrice] = useState(false)
    const [manualPrice, setManualPrice] = useState<string>('')
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
      const interval = setInterval(() => setNow(Date.now()), 60000)
      return () => clearInterval(interval)
    }, [])

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
    const [companyTows, setCompanyTows] = useState<TowWithDetails[]>([])
    const [deferredLoaded, setDeferredLoaded] = useState(false)
    const deferredLoadedRef = useRef(false)

    // modal state
    const [showApprovalModal, setShowApprovalModal] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState<any>(null)
    const [selectedNewDriver, setSelectedNewDriver] = useState('')
    const [approvalAction, setApprovalAction] = useState<'reassign' | 'unassign'>('unassign')
    const [processingRequest, setProcessingRequest] = useState(false)

    const [showEndShiftModal, setShowEndShiftModal] = useState(false)
    const [endShiftTarget, setEndShiftTarget] = useState<EndShiftModalTarget | null>(null)

    const searchWrapRef = useRef<HTMLDivElement>(null)
    const calendarScrollRef = useRef<HTMLDivElement>(null)
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

    const applyCompanyTows = useCallback((tows: TowWithDetails[]) => {
      setCompanyTows(tows)
      setPendingTows(tows.filter((t) => t.status === 'pending' && !t.driver_id))
      setQuoteTows(tows.filter((t) => t.status === 'quote'))
      setInProgressTows(tows.filter((t) => t.status === 'in_progress').length)
      setTodayTows(filterTowsForDay(tows, new Date()))
    }, [])

    const loadEssential = useCallback(async () => {
      if (!companyId) return
      try {
        const [statsData, towsData] = await Promise.all([
          getDashboardStats(companyId),
          getTows(companyId),
        ])
        setStats(statsData)
        applyCompanyTows(towsData)
      } catch (err) {
        console.error('Dashboard essential load error:', err)
      }
    }, [companyId, applyCompanyTows])

    const loadDeferred = useCallback(async () => {
      if (!companyId || deferredLoadedRef.current) return
      try {
        const [
          alertsData,
          rejectionsData,
          driversData,
          overtimeData,
          activeDriversData,
          allDriversData,
        ] = await Promise.all([
          getExpiryAlerts(companyId),
          getPendingRejectionRequests(companyId),
          getAvailableDrivers(companyId),
          getDriversOvertime(companyId),
          getActiveDriversWithLocation(companyId),
          getDrivers(companyId),
        ])

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
        deferredLoadedRef.current = true
        setDeferredLoaded(true)
      } catch (err) {
        console.error('Dashboard deferred load error:', err)
      }
    }, [companyId])

    const refreshEssential = useCallback(async () => {
      await loadEssential()
    }, [loadEssential])

    const refreshRejections = useCallback(async () => {
      if (!companyId) return
      try {
        const rejectionsData = await getPendingRejectionRequests(companyId)
        setRejectionRequests(rejectionsData)
      } catch (err) {
        console.error('Dashboard rejections refresh error:', err)
      }
    }, [companyId])

    const refreshDriversAndMap = useCallback(async () => {
      if (!companyId) return
      try {
        const [driversData, activeDriversData, allDriversData] = await Promise.all([
          getAvailableDrivers(companyId),
          getActiveDriversWithLocation(companyId),
          getDrivers(companyId),
        ])
        setAvailableDrivers(driversData)
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
      } catch (err) {
        console.error('Dashboard drivers refresh error:', err)
      }
    }, [companyId])

    const refreshShiftsAndOvertime = useCallback(async () => {
      if (!companyId) return
      try {
        const overtimeData = await getDriversOvertime(companyId)
        setOvertimeDrivers(overtimeData)
      } catch (err) {
        console.error('Dashboard shifts refresh error:', err)
      }
    }, [companyId])

    const refreshAlerts = useCallback(async () => {
      if (!companyId) return
      try {
        const alertsData = await getExpiryAlerts(companyId)
        setAlerts(alertsData)
      } catch (err) {
        console.error('Dashboard alerts refresh error:', err)
      }
    }, [companyId])

    const loadCalendarFromApi = useCallback(async () => {
      if (!companyId) return
      try {
        const tows = await getDayTows(companyId, calendarDate)
        setCalendarTows(tows || [])
      } catch (err) {
        console.error('Calendar load error:', err)
      }
    }, [companyId, calendarDate])

    const loadCalendarTows = useCallback(async () => {
      if (companyTows.length > 0) {
        setCalendarTows(filterTowsForDay(companyTows, calendarDate))
        return
      }
      await loadCalendarFromApi()
    }, [companyTows, calendarDate, loadCalendarFromApi])

    const handleDragStart = (e: React.DragEvent, tow: any) => {
      setDraggedTow(tow)
      e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }

    const handleDrop = async (e: React.DragEvent, driverId: string, hour: number) => {
      e.preventDefault()
      if (!draggedTow || !companyId) return
      const newDate = new Date(calendarDate)
      newDate.setHours(hour, 0, 0, 0)
      try {
        await updateTowSchedule(draggedTow.id, newDate, driverId)
        await loadCalendarTows()
        const priceMode = draggedTow.price_mode || 'recommended'
        if (priceMode === 'recommended' && draggedTow.price_breakdown) {
          const result = await recalculateTowPrice(draggedTow.id, newDate, companyId)
          const oldSurchargeIds = (draggedTow.price_breakdown?.time_surcharges ?? [])
            .map((s: any) => s.id).sort().join(',')
          const newSurchargeIds = (result?.newBreakdown?.time_surcharges ?? [])
            .map((s: any) => s.id).sort().join(',')
          const timeSurchargesChanged = oldSurchargeIds !== newSurchargeIds

          if (result && timeSurchargesChanged) {
            setPriceUpdateInfo({
              towId: draggedTow.id,
              oldPrice: result.oldPrice,
              newPrice: result.newPrice,
              newBreakdown: result.newBreakdown,
              customerName: draggedTow.customer?.name || 'ללא לקוח',
              priceMode
            })
            setManualPrice('')
            setShowPriceUpdateModal(true)
          }
        } else if (priceMode !== 'recommended') {
          setPriceUpdateInfo({
            towId: draggedTow.id,
            oldPrice: draggedTow.final_price || 0,
            newPrice: null,
            newBreakdown: null,
            customerName: draggedTow.customer?.name || 'ללא לקוח',
            priceMode
          })
          setManualPrice(String(draggedTow.final_price || ''))
          setShowPriceUpdateModal(true)
        }
      } catch (err) {
        console.error('Error moving tow:', err)
      }
      setDraggedTow(null)
    }

    const handleConfirmPriceUpdate = async () => {
      if (!priceUpdateInfo) return
      setUpdatingPrice(true)
      try {
        await updateTow({ towId: priceUpdateInfo.towId, finalPrice: priceUpdateInfo.newPrice, priceBreakdown: priceUpdateInfo.newBreakdown })
        setShowPriceUpdateModal(false)
        setPriceUpdateInfo(null)
        await loadCalendarTows()
      } catch (error) {
        console.error('Error updating price:', error)
      } finally {
        setUpdatingPrice(false)
      }
    }

    const handleManualPriceUpdate = async () => {
      if (!priceUpdateInfo || !manualPrice) return
      setUpdatingPrice(true)
      try {
        await updateTow({ towId: priceUpdateInfo.towId, finalPrice: parseFloat(manualPrice), priceBreakdown: null })
        setShowPriceUpdateModal(false)
        setPriceUpdateInfo(null)
        setManualPrice('')
        await loadCalendarTows()
      } catch (error) {
        console.error('Error updating manual price:', error)
      } finally {
        setUpdatingPrice(false)
      }
    }

    const handleSkipPriceUpdate = () => {
      setShowPriceUpdateModal(false)
      setPriceUpdateInfo(null)
    }

    useEffect(() => {
      if (authLoading) return
      if (!companyId) {
        setLoading(false)
        return
      }

      let cancelled = false
      setLoading(true)
      setDeferredLoaded(false)
      deferredLoadedRef.current = false

      ;(async () => {
        await loadEssential()
        if (!cancelled) setLoading(false)
        if (!cancelled) void loadDeferred()
      })()

      return () => {
        cancelled = true
      }
    }, [companyId, authLoading, loadEssential, loadDeferred])

    useEffect(() => {
      if (companyTows.length > 0) {
        setCalendarTows(filterTowsForDay(companyTows, calendarDate))
        return
      }
      if (!companyId || authLoading || loading) return
      void loadCalendarFromApi()
    }, [companyId, calendarDate, companyTows, authLoading, loading, loadCalendarFromApi])

    // Realtime — scoped refreshes (no full dashboard reload)
    useEffect(() => {
      if (!companyId) return

      const channel = supabase
        .channel(`dashboard-realtime-${companyId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tows', filter: `company_id=eq.${companyId}` }, () => { void refreshEssential() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tow_rejection_requests', filter: `company_id=eq.${companyId}` }, () => { void refreshRejections() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers', filter: `company_id=eq.${companyId}` }, () => { void refreshDriversAndMap() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_shifts', filter: `company_id=eq.${companyId}` }, () => {
          void refreshShiftsAndOvertime()
          void refreshDriversAndMap()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_tasks', filter: `company_id=eq.${companyId}` }, () => { void refreshEssential() })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations', filter: `company_id=eq.${companyId}` }, () => { void refreshDriversAndMap() })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }, [companyId, refreshEssential, refreshRejections, refreshDriversAndMap, refreshShiftsAndOvertime])

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

    useLayoutEffect(() => {
      const el = calendarTheadRef.current
      if (!el) {
        setDriverColumnRects([])
        return
      }
      const measure = () => {
        setCalendarTheadHeightPx(Math.round(el.getBoundingClientRect().height))

        const layoutEl = calendarOverlayLayoutRef.current
        if (!layoutEl) {
          setDriverColumnRects([])
          return
        }
        const containerRect = layoutEl.getBoundingClientRect()
        const allThs = el.querySelectorAll('th')
        const rects: { left: number; width: number }[] = []
        for (let i = 1; i < allThs.length; i++) {
          const thRect = allThs[i].getBoundingClientRect()
          rects.push({
            left: thRect.left - containerRect.left,
            width: thRect.width,
          })
        }
        setDriverColumnRects(rects)
      }
      measure()
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      const layoutEl = calendarOverlayLayoutRef.current
      if (layoutEl) ro.observe(layoutEl)
      return () => ro.disconnect()
    }, [calendarDate, calendarTows.length, driverIds.length, loading, authLoading, selectedDrivers.length, allDrivers.length])

    const getTowsForDriverHour = (driverId: string, hour: number) => {
      return filteredCalendarTows.filter((t: any) => {
        if (t.driver_id !== driverId) return false
        // Skip tows rendered by the overlay layer to avoid visual duplication
        const renderedInOverlay =
          (t.status === 'in_progress' || t.status === 'assigned' || t.status === 'completed') &&
          t.scheduled_at
        if (renderedInOverlay) return false
        const towHour = Math.floor(getLocalFractionalHour(t.scheduled_at || t.created_at))
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

    useEffect(() => {
      if (loading || authLoading) return
      const container = calendarScrollRef.current
      if (!container) return
      const currentTimePosition = getCurrentTimePosition() * PIXELS_PER_HOUR
      // Position current time roughly in the top third of the visible area
      container.scrollTop = Math.max(0, currentTimePosition - container.clientHeight / 3)
    }, [loading, authLoading])

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
                      <span className="font-bold text-gray-800">
                        {t.order_number ? (
                          <>{t.order_number}{t.customer_order_number ? ` (${t.customer_order_number})` : ''}</>
                        ) : (
                          '—'
                        )}
                      </span>
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
            <div className="bg-white border border-gray-200 rounded-xl flex flex-col flex-1 min-h-[380px]">
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
              <div ref={calendarScrollRef} className="flex-1 overflow-auto min-h-0">
                {driverIds.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-300 text-xs">אין גרירות ביום זה</div>
                ) : (
                  <div ref={calendarOverlayLayoutRef} className="relative">
                    <table className="w-full text-xs border-collapse" style={{ minWidth: `${driverIds.length * 120 + 60}px` }}>
                      <thead ref={calendarTheadRef}>
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
                          <tr key={hour} className="border-b border-gray-200" style={{ height: `${PIXELS_PER_HOUR}px` }}>
                            <td className="px-1 py-1 text-gray-500 border-l border-gray-200 text-xs font-medium">{hour}:00</td>
                            {driverIds.map(id => {
                              const tows = getTowsForDriverHour(id as string, hour)
                              return (
                                <td
                                  key={id as string}
                                  className="px-0.5 py-0.5 border-l border-gray-200 min-h-6"
                                  style={{ width: `${100 / driverIds.length}%` }}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDrop(e, id as string, hour)}
                                >
                                  {tows.length > 0 ? tows.map((t: any) => {
                                  const driverIdx = driverIds.indexOf(id)
                                  const color = DRIVER_COLORS[driverIdx % DRIVER_COLORS.length]
                                  const isLight = ['#f59e0b', '#10b981', '#06b6d4'].includes(color)
                                  return (
                                    <div
                                      key={t.id}
                                      draggable={true}
                                      onDragStart={(e) => handleDragStart(e, t)}
                                      onClick={() => !draggedTow && router.push(`/dashboard/tows/${t.id}`)}
                                      className="relative rounded px-1 py-0.5 mb-0.5 cursor-pointer truncate text-xs font-medium"
                                      style={
                                        t.status === 'completed'
                                          ? { background: '#16a34a', color: '#fff', border: '1px solid #15803d' }
                                          : t.status === 'in_progress'
                                          ? { background: '#f97316', color: '#fff', border: '1px solid #ea580c' }
                                          : { background: color + '25', color: color, border: `1px solid ${color}40` }
                                      }
                                      title={`${t.customer?.name || ''} ${t.order_number || ''}`.trim()}
                                    >
                                      {t.customer?.name || t.order_number?.slice(-4) || t.id.slice(0, 4)}
                                      {t.status === 'completed' && (
                                        <div className="absolute top-1 left-1 bg-white text-green-700 text-[9px] font-bold px-1 py-0.5 rounded">
                                          ✓ בוצעה
                                        </div>
                                      )}
                                    </div>
                                  )
                                }) : (
                                  <button
                                    onClick={() => {
                                      const params = new URLSearchParams()
                                      params.set('driver', id as string)
                                      params.set('date', calendarDate.toISOString().split('T')[0])
                                      params.set('time', `${String(hour).padStart(2, '0')}:00`)
                                      router.push(`/dashboard/tows/create?${params.toString()}`)
                                    }}
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
                              top: `${getCurrentTimePosition() * PIXELS_PER_HOUR}px`,
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

                    <div className="absolute inset-0 pointer-events-none">
                      {driverIds.map((id, driverIdx) => {
                        const liveTows = filteredCalendarTows.filter((t: any) =>
                          t.driver_id === id &&
                          (t.status === 'in_progress' || t.status === 'assigned' || t.status === 'completed') &&
                          t.scheduled_at
                        )
                        return liveTows.map((t: any) => {
                          const rect = driverColumnRects[driverIdx]
                          if (!rect) return null
                          // Use actual start time if available, otherwise scheduled time
                          const effectiveStartIso = t.started_at || t.scheduled_at
                          const startMs = new Date(effectiveStartIso).getTime()

                          // End time depends on status
                          let endMs: number
                          if (t.status === 'completed' && t.completed_at) {
                            endMs = new Date(t.completed_at).getTime()
                          } else if (t.status === 'in_progress') {
                            // Live - growing, but capped at end of the displayed day
                            const endOfDay = new Date(calendarDate)
                            endOfDay.setHours(23, 59, 59, 999)
                            endMs = Math.min(now, endOfDay.getTime())
                          } else if (t.status === 'assigned') {
                            // Not started yet - fixed 60-minute default block
                            endMs = startMs + 60 * 60 * 1000
                          } else {
                            // Defensive fallback for any other status
                            endMs = startMs + 60 * 60 * 1000
                          }

                          const elapsedMinutes = Math.max(60, (endMs - startMs) / 60000)
                          const startHour = getLocalFractionalHour(effectiveStartIso)
                          const top = calendarTheadHeightPx + startHour * PIXELS_PER_HOUR
                          const height = (elapsedMinutes / 60) * PIXELS_PER_HOUR
                          return (
                            <div
                              key={t.id}
                              onClick={() => router.push(`/dashboard/tows/${t.id}`)}
                              className="absolute rounded px-1 py-0.5 text-xs font-medium text-white cursor-pointer pointer-events-auto"
                              style={{
                                top: `${top}px`,
                                height: `${Math.max(height, 20)}px`,
                                left: `${rect.left + 2}px`,
                                width: `${rect.width - 4}px`,
                                backgroundColor: t.status === 'completed' ? '#16a34a' : t.status === 'in_progress' ? '#f97316' : DRIVER_COLORS[driverIdx % DRIVER_COLORS.length] + '99',
                                border: `1px solid ${t.status === 'in_progress' ? '#ea580c' : DRIVER_COLORS[driverIdx % DRIVER_COLORS.length]}`,
                                zIndex: 5,
                              }}
                            >
                              {/* badges wrapper - future-proofed for receipt/payment icons */}
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 2,
                                  left: 2,
                                  display: 'flex',
                                  gap: 2,
                                  pointerEvents: 'none',
                                }}
                              >
                                {t.status === 'completed' && (
                                  <span className="bg-white text-green-700 text-[9px] font-bold px-1 py-0.5 rounded">
                                    ✓ בוצעה
                                  </span>
                                )}
                              </div>
                              {t.customer?.name || t.order_number?.slice(-4) || t.id.slice(0, 4)}
                            </div>
                          )
                        })
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2×2 כרטיסים */}
            <div className="flex gap-3 min-h-0 overflow-y-auto">
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
                <div className="divide-y divide-gray-50 overflow-y-auto max-h-28">
                    {pendingTows.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-gray-300 text-center">אין ממתינות</div>
                    ) : pendingTows.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(tow => (
                    <div key={tow.id} onClick={() => router.push(`/dashboard/tows/${tow.id}`)} className="px-3 py-1.5 flex items-center gap-2 min-w-0 cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-700 truncate">{tow.customer?.name || '—'} · {tow.vehicles?.[0]?.plate_number || '—'}</div>
                        <div className="text-xs text-gray-400 truncate">{tow.legs?.[0]?.from_address?.split(',')[0] || '—'} ← {tow.legs?.[tow.legs.length - 1]?.to_address?.split(',')[0] || '—'}</div>
                      </div>
                      <span className="text-xs text-amber-600 flex-shrink-0">{formatWaitTime(tow.created_at)}</span>
                      <button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/tows/${tow.id}`); }} className="text-xs px-2 py-1 bg-gray-900 text-white rounded-lg flex-shrink-0 hover:bg-gray-700">שבץ</button>
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
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {quoteTows.map(t => (
                      <div
                        key={t.id}
                        onClick={() => router.push(`/dashboard/tows/${t.id}`)}
                        className="flex items-center justify-between p-2 min-w-0 bg-white rounded-lg cursor-pointer hover:bg-amber-50 text-xs"
                      >
                        <span className="font-medium flex-shrink-0">{t.order_number || t.id.slice(0, 8)}</span>
                        <span className="text-gray-500 flex-1 min-w-0 truncate">{t.customer?.name || 'לקוח'}</span>
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
                    return (
                      <div key={req.id} className="px-3 py-2 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate">{req.driver?.user?.full_name}</div>
                          <div className="text-xs text-gray-400 truncate">
                            {req.reason === 'other'
                              ? (req.reason_note || 'אחר')
                              : (REJECTION_REASONS.find(r => r.key === req.reason)?.label || req.reason_note || req.reason)}
                          </div>
                          <Link
                            href={`/dashboard/tows/${req.tow_id}`}
                            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600"
                          >
                            {(req as any).tow?.customer?.name || 'פרטי גרירה'} ←
                          </Link>
                          <span className="text-xs text-gray-300 mt-0.5 block">לחץ לטופס הגרירה</span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => { setSelectedRequest(req); setShowApprovalModal(true) }} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100">אשר</button>
                          <button onClick={() => setDenyConfirmRequest(req)} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">דחה</button>
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
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    לא סיימו משמרת
                  </div>
                  {overtimeDrivers.length > 0 && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">{overtimeDrivers.length}</span>}
                </div>
                <div className="min-h-0 max-h-52 overflow-y-auto overscroll-y-contain divide-y divide-gray-50">
                  {overtimeDrivers.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-300 text-center">כל הנהגים סיימו</div>
                  ) : overtimeDrivers.map((shift: any) => {
                    const driver = shift.driver as any
                    const openTowsCount = companyTows.filter(
                      t =>
                        t.driver_id === driver?.id &&
                        (t.status === 'assigned' || t.status === 'in_progress')
                    ).length
                    const metaParts = [
                      formatShiftStartJerusalem(shift.started_at),
                      formatOpenShiftDuration(shift.started_at),
                      openTowsCount > 0 ? `${openTowsCount} גרירות פתוחות` : null,
                    ].filter(Boolean)
                    return (
                      <div key={shift.id} className="px-3 py-2 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-medium text-gray-700 truncate">
                              {driver?.user?.full_name}
                            </div>
                            <button
                              onClick={() => {
                                setEndShiftTarget({
                                  shiftId: shift.id,
                                  driverName: driver?.user?.full_name || 'נהג',
                                  driverId: driver?.id,
                                  startedAt: shift.started_at,
                                  workHoursEnd: driver?.work_hours_end ?? null,
                                })
                                setShowEndShiftModal(true)
                              }}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-200 flex-shrink-0"
                            >
                              סיים
                            </button>
                          </div>
                          <div className="mt-0.5 text-[11px] leading-snug text-gray-400">
                            {metaParts.join(' · ')}
                          </div>
                        </div>
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
                      <Link key={alert.id} href={`${config?.link || '/dashboard/trucks'}?edit=${alert.entityId}`} className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50">
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${alert.severity === 'expired' ? 'bg-red-100' : 'bg-amber-100'}`}>
                          <Icon size={10} className={alert.severity === 'expired' ? 'text-red-600' : 'text-amber-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate">{alert.entityName}</div>
                          <div className="text-xs text-gray-500 truncate">{config?.label || ''}</div>
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
            <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto">
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
                      void refreshEssential()
                      void refreshRejections()
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

        <EditShiftModal
          open={showEndShiftModal}
          target={endShiftTarget ? { ...endShiftTarget, endedAt: null } : null}
          onClose={() => {
            setShowEndShiftModal(false)
            setEndShiftTarget(null)
          }}
          onSaved={async () => {
            await refreshShiftsAndOvertime()
            await refreshDriversAndMap()
            setShowEndShiftModal(false)
            setEndShiftTarget(null)
          }}
        />

        {denyConfirmRequest && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-2">דחיית בקשה</h3>
              <p className="text-sm text-gray-600 mb-6">
                האם לדחות את בקשת הדחייה של {denyConfirmRequest?.driver?.user?.full_name}?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDenyConfirmRequest(null)}
                  className="flex-1 py-3 border border-gray-200 bg-white text-gray-600 rounded-xl font-medium"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!denyConfirmRequest) return
                    await denyRejectionRequest(denyConfirmRequest.id, user?.id || '')
                    setDenyConfirmRequest(null)
                    void refreshEssential()
                    void refreshRejections()
                  }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700"
                >
                  דחה בקשה
                </button>
              </div>
            </div>
          </div>
        )}

        {/* מודל עדכון מחיר */}
        {showPriceUpdateModal && priceUpdateInfo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl">
              <div className={`px-5 py-4 text-white ${priceUpdateInfo.priceMode === 'recommended' ? 'bg-amber-500' : 'bg-blue-500'}`}>
                <h2 className="font-bold text-lg">
                  {priceUpdateInfo.priceMode === 'recommended' ? 'עדכון מחיר' : 'שים לב'}
                </h2>
                <p className="text-white/80 text-sm">{priceUpdateInfo.customerName}</p>
              </div>

              <div className="p-5 space-y-4">
                {priceUpdateInfo.priceMode === 'recommended' && priceUpdateInfo.newPrice !== null ? (
                  <>
                    {/* מחיר מומלץ - הצגת מחיר חדש מחושב */}
                    <div className="text-center">
                      <p className="text-gray-600 mb-4">המחיר עודכן בעקבות שינוי הזמן:</p>

                      <div className="flex items-center justify-center gap-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">מחיר קודם</p>
                          <p className="text-xl font-bold text-gray-400 line-through">₪{priceUpdateInfo.oldPrice}</p>
                        </div>
                        <div className="text-2xl text-gray-400">←</div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">מחיר חדש</p>
                          <p className="text-2xl font-bold text-amber-600">₪{priceUpdateInfo.newPrice?.toFixed(2)}</p>
                        </div>
                      </div>

                      {priceUpdateInfo.newBreakdown && (
                        <div className="border border-gray-100 rounded-xl p-3 space-y-1.5 text-xs bg-gray-50 text-right">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-800">₪{priceUpdateInfo.newBreakdown.base_price}</span>
                            <span className="text-gray-500">מחיר בסיס</span>
                          </div>
                          {priceUpdateInfo.newBreakdown.distance_km > 0 && (
                            <div className="flex justify-between">
                              <span className="font-medium text-gray-800">₪{priceUpdateInfo.newBreakdown.distance_price}</span>
                              <span className="text-gray-500">מרחק ({priceUpdateInfo.newBreakdown.distance_km} ק״מ)</span>
                            </div>
                          )}
                          {priceUpdateInfo.newBreakdown.time_surcharges?.filter((s: any) => s.amount > 0).map((s: any, idx: number) => (
                            <div key={s.id || idx} className="flex justify-between text-amber-600">
                              <span className="font-medium">₪{s.amount}</span>
                              <span>{s.label} (+{s.percent}%)</span>
                            </div>
                          ))}
                          {priceUpdateInfo.newBreakdown.location_surcharges?.map((s: any, idx: number) => (
                            <div key={s.id || idx} className="flex justify-between text-blue-600">
                              <span className="font-medium">₪{s.amount}</span>
                              <span>{s.label} (+{s.percent}%)</span>
                            </div>
                          ))}
                          {priceUpdateInfo.newBreakdown.service_surcharges?.map((s: any, idx: number) => (
                            <div key={s.id || idx} className="flex justify-between text-purple-600">
                              <span className="font-medium">₪{s.amount}</span>
                              <span>{s.label}</span>
                            </div>
                          ))}
                          {priceUpdateInfo.newBreakdown.discount_amount > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span className="font-medium">-₪{priceUpdateInfo.newBreakdown.discount_amount}</span>
                              <span>הנחה ({priceUpdateInfo.newBreakdown.discount_percent}%)</span>
                            </div>
                          )}
                          <div className="flex justify-between text-gray-500">
                            <span className="font-medium">₪{priceUpdateInfo.newBreakdown.vat_amount}</span>
                            <span>מע״מ (18%)</span>
                          </div>
                        </div>
                      )}

                      {priceUpdateInfo.newPrice > priceUpdateInfo.oldPrice ? (
                        <p className="text-sm text-amber-600 mt-3">
                          +₪{(priceUpdateInfo.newPrice - priceUpdateInfo.oldPrice).toFixed(2)} (תוספת זמן)
                        </p>
                      ) : (
                        <p className="text-sm text-green-600 mt-3">
                          -₪{(priceUpdateInfo.oldPrice - priceUpdateInfo.newPrice).toFixed(2)} (ללא תוספת זמן)
                        </p>
                      )}
                    </div>

                    {/* אפשרות למחיר ידני */}
                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-sm text-gray-500 mb-2">או הזן מחיר ידני:</p>
                      <div className="relative">
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                        <input
                          type="number"
                          value={manualPrice}
                          onChange={(e) => setManualPrice(e.target.value)}
                          placeholder="מחיר ידני"
                          className="w-full pr-8 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* מחיר ידני/קבוע/לקוח - התראה */}
                    <div className="text-center">
                      <p className="text-gray-600 mb-4">המועד השתנה. האם לעדכן את המחיר?</p>
                      <p className="text-lg font-bold text-gray-800 mb-4">מחיר נוכחי: ₪{priceUpdateInfo.oldPrice}</p>

                      <div className="text-right">
                        <p className="text-sm text-gray-500 mb-2">הזן מחיר חדש:</p>
                        <div className="relative">
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                          <input
                            type="number"
                            value={manualPrice}
                            onChange={(e) => setManualPrice(e.target.value)}
                            placeholder="מחיר חדש"
                            className="w-full pr-8 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleSkipPriceUpdate}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  השאר ללא שינוי
                </button>
                {priceUpdateInfo.priceMode === 'recommended' && priceUpdateInfo.newPrice !== null && !manualPrice ? (
                  <button
                    onClick={handleConfirmPriceUpdate}
                    disabled={updatingPrice}
                    className="flex-1 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium disabled:bg-gray-300"
                  >
                    {updatingPrice ? 'מעדכן...' : `עדכן ל-₪${priceUpdateInfo.newPrice}`}
                  </button>
                ) : (
                  <button
                    onClick={handleManualPriceUpdate}
                    disabled={updatingPrice || !manualPrice}
                    className={`flex-1 py-3 text-white rounded-xl transition-colors font-medium disabled:bg-gray-300 ${
                      priceUpdateInfo.priceMode === 'recommended' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    {updatingPrice ? 'מעדכן...' : 'עדכן מחיר'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }