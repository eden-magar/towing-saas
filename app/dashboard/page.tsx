  'use client'

  import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react'
  import { useDebouncedCallback } from '../hooks/useDebouncedCallback'
  import { useRouter } from 'next/navigation'
  import { useAuth } from '../lib/AuthContext'
  import { getDashboardStats, getPendingUnassignedTows, getQuoteTows, getOpenTowsCountByDriver, DashboardStats } from '../lib/queries/dashboard'
  import { getExpiryAlerts, ExpiryAlert } from '../lib/queries/alerts'
  import { TowWithDetails, searchTows } from '../lib/queries/tows'
  import { getPendingRejectionRequests, approveRejectionRequest, denyRejectionRequest, REJECTION_REASONS } from '../lib/queries/rejection-requests'
  import { getPendingCustomerTowRequests } from '../lib/queries/customer-tow-requests'
  import { CustomerTowRequestDetailsPanel } from '../components/tow-forms/CustomerTowRequestDetailsPanel'
  import { SelectorModalShell } from '../components/tow-forms/shared/SelectorModalShell'
  import { getAvailableDrivers, getDrivers } from '../lib/queries/drivers'
  import { getDriversOvertime, getActiveDriversWithLocation } from '../lib/queries/driver-shifts'
  import { getDayTowsWithPrevDay } from '../lib/queries/calendar'
  import { getDayEvents, getQuoteEvents, getPendingUnassignedEvents, type EventListItem } from '../lib/queries/events'
  import { getEventTimeBounds } from '../lib/utils/event-time-bounds'
  import { supabase } from '../lib/supabase'
  import { ensureRealtimeAuthBeforeSubscribe, subscribeRealtimeChannel } from '../lib/realtime-auth'
  import { getVehicleTypeLabel, isKnownVehicleType } from '../lib/vehicle-lookup'
  import DriversMap, { MAP_STATUS_LEGEND } from '../components/DriversMap'
  import EditShiftModal from '../components/EditShiftModal'
  import {
    JERUSALEM_TZ,
    formatOpenShiftDuration,
    formatShiftStartJerusalem,
  } from '../lib/shift-datetime'
  import Link from 'next/link'
  import { Plus, RefreshCw, AlertTriangle, FileText, Shield, CreditCard, Clock, ChevronLeft, ChevronRight, Truck, Search, Loader2, CheckCircle, XCircle, Play, X, Sparkles } from 'lucide-react'
  import {
    getEffectiveTowStartIso,
    computeDaySegmentForTow,
    towOverlapsCalendarDay,
    towSegmentOverlapKey,
  } from '../lib/utils/tow-time-bounds'
  import {
    getOverlapLayout,
    getOverlapBlockWidthPct,
    type OverlapPosition,
  } from '../lib/utils/tow-overlap-layout'
  import { TowBlockClipIndicators } from '../components/TowBlockClipIndicators'

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
    cancelled_charged: 'bg-amber-100 text-amber-800',
  }

  const PIXELS_PER_HOUR_DASH = 28
  const DASH_CALENDAR_HOURS = Array.from({ length: 24 }, (_, i) => i)
  const DASH_GRID_HEIGHT_PX = DASH_CALENDAR_HOURS.length * PIXELS_PER_HOUR_DASH

  // Same 20-hue palette as app/dashboard/calendar/page.tsx (index by driver list order; not exported there)
  const DRIVER_COLORS = [
    '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d',
    '#16a34a', '#059669', '#0d9488', '#0891b2', '#0284c7',
    '#2563eb', '#4f46e5', '#7c3aed', '#9333ea', '#c026d3',
    '#db2777', '#be185d', '#b45309', '#047857', '#1e40af',
  ]

  function startOfDay(d: Date): Date {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }

  function formatListDateLabel(date: Date): string {
    if (date.toDateString() === new Date().toDateString()) {
      return 'היום'
    }
    return date.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' })
  }

  function formatIncomingScheduledAt(iso: string | null | undefined): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /** Search-dropdown date: he-IL day/month (same digits as formatIncomingScheduledAt), Asia/Jerusalem; year only when not current year. */
  function formatTowSearchResultDate(iso: string): string {
    const date = new Date(iso)
    const yearOpts: Intl.DateTimeFormatOptions = {
      timeZone: JERUSALEM_TZ,
      year: 'numeric',
    }
    const includeYear =
      date.toLocaleDateString('en-GB', yearOpts) !==
      new Date().toLocaleDateString('en-GB', yearOpts)
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      ...(includeYear ? { year: 'numeric' as const } : {}),
      timeZone: JERUSALEM_TZ,
    })
  }

  function getDriverColor(driverId: string, drivers: { id: string }[]): string {
    const index = drivers.findIndex((d) => d.id === driverId)
    return index >= 0 ? DRIVER_COLORS[index % DRIVER_COLORS.length] : '#6b7280'
  }

  function CompactTowBlockStatusBadge({ status }: { status: string }) {
    const iconSize = 10
    const shell =
      'absolute top-0.5 right-0.5 flex items-center justify-center rounded-full bg-white/90 p-px shadow-sm pointer-events-none z-10'
    if (status === 'pending' || status === 'assigned' || status === 'quote') {
      return null
    }
    if (status === 'completed') {
      return (
        <div className={shell}>
          <CheckCircle size={iconSize} className="text-green-600" strokeWidth={2.5} />
        </div>
      )
    }
    if (status === 'cancelled') {
      return (
        <div className={shell}>
          <XCircle size={iconSize} className="text-gray-600" strokeWidth={2.5} />
        </div>
      )
    }
    if (status === 'cancelled_charged') {
      return (
        <div className={shell}>
          <XCircle size={iconSize} className="text-amber-600" strokeWidth={2.5} />
        </div>
      )
    }
    if (status === 'in_progress') {
      return (
        <div className={shell}>
          <Play size={iconSize} className="text-orange-500 fill-orange-500" strokeWidth={2.5} />
        </div>
      )
    }
    return null
  }

  function getCurrentFractionalHour(): number {
    const d = new Date()
    return d.getHours() + d.getMinutes() / 60
  }

  interface DashEventCalendarItem {
    id: string
    startMs: number
    endMs: number
    driverId: string
    label: string
    status: string
  }

  function dashEventOverlapKey(eventId: string): string {
    return `event:${eventId}`
  }

  export default function DashboardPage() {
    const { user, companyId, loading: authLoading, realtimeAuthReady } = useAuth()
    const router = useRouter()

    const [stats, setStats] = useState<DashboardStats>({
      towsToday: 0,
      pendingTows: 0,
      completedToday: 0,
      availableDrivers: 0,
      inProgressTows: 0,
      todayRevenue: 0,
    })
    const [pendingTows, setPendingTows] = useState<TowWithDetails[]>([])
    const [pendingEvents, setPendingEvents] = useState<EventListItem[]>([])
    const [quoteTows, setQuoteTows] = useState<TowWithDetails[]>([])
    const [quoteEvents, setQuoteEvents] = useState<EventListItem[]>([])
    const [openTowsByDriver, setOpenTowsByDriver] = useState<Record<string, number>>({})
    const [alerts, setAlerts] = useState<ExpiryAlert[]>([])
    const [rejectionRequests, setRejectionRequests] = useState<any[]>([])
    const [incomingRequests, setIncomingRequests] = useState<any[]>([])
    const [viewingIncomingRequest, setViewingIncomingRequest] = useState<{
      id: string
      customerName: string | null
    } | null>(null)
    const [denyConfirmRequest, setDenyConfirmRequest] = useState<typeof rejectionRequests[0] | null>(null)
    const [availableDrivers, setAvailableDrivers] = useState<any[]>([])
    const [overtimeDrivers, setOvertimeDrivers] = useState<any[]>([])
    const [driversWithLocation, setDriversWithLocation] = useState<any[]>([])
    const [listDate, setListDate] = useState(() => startOfDay(new Date()))
    const [listTows, setListTows] = useState<TowWithDetails[]>([])
    const [listEvents, setListEvents] = useState<Awaited<ReturnType<typeof getDayEvents>>>([])
    const [showDriverModal, setShowDriverModal] = useState(false)
    const [pendingSlot, setPendingSlot] = useState<{ date: Date; hour: number } | null>(null)
    const [activeDrivers, setActiveDrivers] = useState<any[]>([])
    const [allDrivers, setAllDrivers] = useState<any[]>([])
    const [activeTasks, setActiveTasks] = useState<number>(0)
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
      const interval = setInterval(() => setNow(Date.now()), 60000)
      return () => clearInterval(interval)
    }, [])

    const [loading, setLoading] = useState(true)
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
    const dashCalendarScrollRef = useRef<HTMLDivElement>(null)
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

    const loadEssential = useCallback(async () => {
      if (!companyId) return
      try {
        const [statsData, pendingData, pendingEventsData, quoteData, quoteEventsData, openCountsData] = await Promise.all([
          getDashboardStats(companyId),
          getPendingUnassignedTows(companyId),
          getPendingUnassignedEvents(companyId),
          getQuoteTows(companyId),
          getQuoteEvents(companyId),
          getOpenTowsCountByDriver(companyId),
        ])
        setStats(statsData)
        setPendingTows(pendingData)
        setPendingEvents(pendingEventsData)
        setQuoteTows(quoteData)
        setQuoteEvents(quoteEventsData)
        setOpenTowsByDriver(openCountsData)
      } catch (err) {
        console.error('Dashboard essential load error:', err)
      }
    }, [companyId])

    const loadDeferred = useCallback(async () => {
      if (!companyId || deferredLoadedRef.current) return
      try {
        const [
          alertsData,
          rejectionsData,
          incomingData,
          driversData,
          overtimeData,
          activeDriversData,
          allDriversData,
        ] = await Promise.all([
          getExpiryAlerts(companyId),
          getPendingRejectionRequests(companyId),
          getPendingCustomerTowRequests(companyId),
          getAvailableDrivers(companyId),
          getDriversOvertime(companyId),
          getActiveDriversWithLocation(companyId),
          getDrivers(companyId),
        ])

        setAlerts(alertsData)
        setRejectionRequests(rejectionsData)
        setIncomingRequests(incomingData)
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

    const debouncedRefreshEssential = useDebouncedCallback(() => {
      void refreshEssential()
    }, 300)

    const refreshRejections = useCallback(async () => {
      if (!companyId) return
      try {
        const rejectionsData = await getPendingRejectionRequests(companyId)
        setRejectionRequests(rejectionsData)
      } catch (err) {
        console.error('Dashboard rejections refresh error:', err)
      }
    }, [companyId])

    const refreshIncoming = useCallback(async () => {
      if (!companyId) return
      try {
        const incomingData = await getPendingCustomerTowRequests(companyId)
        setIncomingRequests(incomingData)
      } catch (err) {
        console.error('Dashboard incoming requests refresh error:', err)
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

    const loadListTows = useCallback(async () => {
      if (!companyId) return
      try {
        const [tows, events] = await Promise.all([
          getDayTowsWithPrevDay(companyId, listDate),
          getDayEvents(companyId, listDate),
        ])
        setListTows(tows || [])
        setListEvents(events || [])
      } catch (err) {
        console.error('List tows load error:', err)
      }
    }, [companyId, listDate])

    const dashboardRealtimeHandlersRef = useRef({
      debouncedRefreshEssential,
      refreshRejections,
      refreshIncoming,
      refreshDriversAndMap,
      refreshShiftsAndOvertime,
      loadListTows,
    })
    dashboardRealtimeHandlersRef.current = {
      debouncedRefreshEssential,
      refreshRejections,
      refreshIncoming,
      refreshDriversAndMap,
      refreshShiftsAndOvertime,
      loadListTows,
    }

    const isListToday = listDate.toDateString() === new Date().toDateString()

    const prevListDay = () => {
      setListDate((d) => {
        const next = new Date(d)
        next.setDate(next.getDate() - 1)
        return startOfDay(next)
      })
    }

    const nextListDay = () => {
      setListDate((d) => {
        const next = new Date(d)
        next.setDate(next.getDate() + 1)
        return startOfDay(next)
      })
    }

    const goToListToday = () => setListDate(startOfDay(new Date()))

    const handleSlotClick = (date: Date, hour: number) => {
      const slotDate = new Date(date)
      slotDate.setHours(hour, 0, 0, 0)
      setPendingSlot({ date: slotDate, hour })
      setShowDriverModal(true)
    }

    const closeDriverModal = () => {
      setShowDriverModal(false)
      setPendingSlot(null)
    }

    const handleDriverSelect = (driverId: string) => {
      if (!pendingSlot) return
      const year = pendingSlot.date.getFullYear()
      const month = (pendingSlot.date.getMonth() + 1).toString().padStart(2, '0')
      const day = pendingSlot.date.getDate().toString().padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      const timeStr = `${pendingSlot.hour.toString().padStart(2, '0')}:00`
      router.push(`/dashboard/tows/create?date=${dateStr}&time=${timeStr}&driver=${driverId}`)
    }

    const handleCreateWithoutDriver = () => {
      if (!pendingSlot) return
      const year = pendingSlot.date.getFullYear()
      const month = (pendingSlot.date.getMonth() + 1).toString().padStart(2, '0')
      const day = pendingSlot.date.getDate().toString().padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      const timeStr = `${pendingSlot.hour.toString().padStart(2, '0')}:00`
      router.push(`/dashboard/tows/create?date=${dateStr}&time=${timeStr}`)
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
      if (!companyId || authLoading || loading) return
      void loadListTows()
    }, [companyId, authLoading, loading, loadListTows])

    // Realtime — scoped refreshes (no full dashboard reload)
    useEffect(() => {
      if (!companyId || !realtimeAuthReady) return

      let channel: ReturnType<typeof supabase.channel> | null = null
      let cancelled = false
      const channelName = `dashboard-realtime-${companyId}`

      void (async () => {
        const authed = await ensureRealtimeAuthBeforeSubscribe(channelName)
        if (cancelled || !authed) return

        channel = supabase
          .channel(channelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tows', filter: `company_id=eq.${companyId}` }, () => {
            dashboardRealtimeHandlersRef.current.debouncedRefreshEssential()
            void dashboardRealtimeHandlersRef.current.loadListTows()
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `company_id=eq.${companyId}` }, () => {
            dashboardRealtimeHandlersRef.current.debouncedRefreshEssential()
            void dashboardRealtimeHandlersRef.current.loadListTows()
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tow_rejection_requests', filter: `company_id=eq.${companyId}` }, () => {
            void dashboardRealtimeHandlersRef.current.refreshRejections()
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_tow_requests', filter: `company_id=eq.${companyId}` }, () => {
            void dashboardRealtimeHandlersRef.current.refreshIncoming()
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_shifts', filter: `company_id=eq.${companyId}` }, () => {
            void dashboardRealtimeHandlersRef.current.refreshShiftsAndOvertime()
            void dashboardRealtimeHandlersRef.current.refreshDriversAndMap()
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_tasks', filter: `company_id=eq.${companyId}` }, () => {
            dashboardRealtimeHandlersRef.current.debouncedRefreshEssential()
          })

        subscribeRealtimeChannel(channel, channelName)

        if (cancelled) {
          supabase.removeChannel(channel)
          channel = null
        }
      })()

      return () => {
        cancelled = true
        if (channel) supabase.removeChannel(channel)
      }
    }, [companyId, realtimeAuthReady])

    // Dedicated drivers channel — unfiltered server-side; client filters by companyId.
    useEffect(() => {
      if (!companyId || !realtimeAuthReady) return

      let driversChannel: ReturnType<typeof supabase.channel> | null = null
      let cancelled = false
      const driversChannelName = `dashboard-drivers-realtime-${companyId}`

      void (async () => {
        const authed = await ensureRealtimeAuthBeforeSubscribe(driversChannelName)
        if (cancelled || !authed) return

        driversChannel = supabase
          .channel(driversChannelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload) => {
            const newCompanyId = (payload.new as { company_id?: string } | undefined)?.company_id
            const oldCompanyId = (payload.old as { company_id?: string } | undefined)?.company_id
            if (newCompanyId !== companyId && oldCompanyId !== companyId) return

            if (payload.eventType === 'UPDATE') {
              type DriverLocRow = {
                id?: string
                last_lat?: number | null
                last_lng?: number | null
                last_seen_at?: string | null
              }
              const oldRow = payload.old as DriverLocRow | undefined
              const newRow = payload.new as DriverLocRow | undefined
              console.log('[drivers realtime test] UPDATE received', {
                driverId: newRow?.id ?? oldRow?.id,
                old_last_lat: oldRow?.last_lat,
                new_last_lat: newRow?.last_lat,
                old_last_lng: oldRow?.last_lng,
                new_last_lng: newRow?.last_lng,
                old_last_seen_at: oldRow?.last_seen_at,
                new_last_seen_at: newRow?.last_seen_at,
              })
            }

            void dashboardRealtimeHandlersRef.current.refreshDriversAndMap().then(() => {
              if (payload.eventType === 'UPDATE') {
                console.log('[drivers realtime test] refresh done')
              }
            })
          })

        subscribeRealtimeChannel(driversChannel, driversChannelName)

        if (cancelled) {
          supabase.removeChannel(driversChannel)
          driversChannel = null
        }
      })()

      return () => {
        cancelled = true
        if (driversChannel) supabase.removeChannel(driversChannel)
      }
    }, [companyId, realtimeAuthReady])

    const assignedListTows = useMemo(
      () =>
        listTows.filter(
          (t) => t.driver_id && towOverlapsCalendarDay(t, listDate, now),
        ),
      [listTows, listDate, now],
    )

    const sortedAssignedListTows = useMemo(() => {
      return [...assignedListTows].sort((a, b) => {
        const aMs = new Date(getEffectiveTowStartIso(a)).getTime()
        const bMs = new Date(getEffectiveTowStartIso(b)).getTime()
        return aMs - bMs
      })
    }, [assignedListTows])

    const assignedListEvents = useMemo(
      () => listEvents.filter((event) => event.driver_id),
      [listEvents],
    )

    const normalizedListEvents = useMemo((): DashEventCalendarItem[] => {
      const items: DashEventCalendarItem[] = []
      for (const event of assignedListEvents) {
        const bounds = getEventTimeBounds(event)
        if (!bounds || !event.driver_id) continue
        items.push({
          id: event.id,
          startMs: bounds.startMs,
          endMs: bounds.endMs,
          driverId: event.driver_id,
          label: event.customer?.name || 'אירוע',
          status: event.status,
        })
      }
      return items.sort((a, b) => a.startMs - b.startMs)
    }, [assignedListEvents])

    const listDayOverlapLayout = useMemo(() => {
      const towItems = sortedAssignedListTows.flatMap((tow) => {
        const segment = computeDaySegmentForTow(tow, listDate, now)
        if (!segment) return []
        return [{
          id: towSegmentOverlapKey(tow.id, listDate),
          startMs: segment.startMs,
          endMs: segment.endMs,
        }]
      })
      const eventItems = normalizedListEvents.map((event) => ({
        id: dashEventOverlapKey(event.id),
        startMs: event.startMs,
        endMs: event.endMs,
      }))
      return getOverlapLayout([...towItems, ...eventItems])
    }, [sortedAssignedListTows, normalizedListEvents, now, listDate])

    const listDayDrivers = useMemo(() => {
      const driverIds = new Set<string>()
      for (const tow of assignedListTows) {
        if (tow.driver_id) driverIds.add(tow.driver_id)
      }
      for (const event of normalizedListEvents) {
        driverIds.add(event.driverId)
      }
      return allDrivers.filter((d) => driverIds.has(d.id))
    }, [assignedListTows, normalizedListEvents, allDrivers])

    useEffect(() => {
      if (authLoading || loading) return
      const container = dashCalendarScrollRef.current
      if (!container) return
      const scrollToHour = isListToday ? getCurrentFractionalHour() : 7
      const position = scrollToHour * PIXELS_PER_HOUR_DASH
      container.scrollTop = Math.max(0, position - container.clientHeight / 3)
    }, [authLoading, loading, listDate, isListToday, sortedAssignedListTows.length])

    const getDaysText = (daysLeft: number) => {
      if (daysLeft < 0) return `פג לפני ${Math.abs(daysLeft)} ימים`
      if (daysLeft === 0) return 'פג היום!'
      if (daysLeft === 1) return 'פג מחר!'
      return `עוד ${daysLeft} ימים`
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
            <div className="text-xl font-semibold text-indigo-500">{stats?.inProgressTows ?? 0}</div>
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
            ₪{(stats?.todayRevenue ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">הכנסות היום</div>
        </div>

        <div className="w-px h-8 bg-gray-200" />

        {/* קבוצה 4: דחוף */}
        <div className={`rounded-xl px-4 py-2 min-w-[90px] border ${
          pendingTows.length + pendingEvents.length > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-white border-gray-200'
        }`}>
          <div className={`text-xl font-semibold ${pendingTows.length + pendingEvents.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {pendingTows.length + pendingEvents.length}
          </div>
          <div className={`text-xs ${pendingTows.length + pendingEvents.length > 0 ? 'text-red-400' : 'text-gray-400'}`}>
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
                  const towDateIso = t.scheduled_at || t.created_at
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
                      <span className="shrink-0 whitespace-nowrap text-gray-500">
                        {formatTowSearchResultDate(towDateIso)}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="shrink-0 font-bold text-gray-800">
                        {t.order_number ? (
                          <>{t.order_number}{t.customer_order_number ? ` (${t.customer_order_number})` : ''}</>
                        ) : (
                          '—'
                        )}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="min-w-0 truncate text-gray-700">{t.customer?.name ?? '—'}</span>
                      <span className="text-gray-400">|</span>
                      <span className="shrink-0 whitespace-nowrap text-gray-700">{v?.plate_number ?? '—'}</span>
                      <span className="text-gray-400">|</span>
                      <span className="shrink-0 whitespace-nowrap text-gray-600">{v?.vehicle_type && isKnownVehicleType(v.vehicle_type) ? getVehicleTypeLabel(v.vehicle_type) : '—'}</span>
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
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.85fr)] gap-3 flex-1 min-h-0 min-w-0">

          {/* עמודה ימין (צרה): מפה + רשימות משניות */}
          <div className="flex flex-col gap-3 min-h-0 min-w-0 overflow-hidden flex-1">
          <div className="bg-white border border-gray-200 rounded-xl flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
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
              <DriversMap drivers={driversWithLocation} embedded />
            </div>
            <div className="flex flex-wrap gap-3 px-3 py-1.5 border-t border-gray-100 flex-shrink-0">
              {MAP_STATUS_LEGEND.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: item.color }}
                  />
                  <span className="text-xs text-gray-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 shrink-0 min-w-0">
            {rejectionRequests.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl flex flex-col min-w-0 flex-shrink-0">
                <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="leading-snug">בקשות דחייה</span>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full shrink-0">
                    {rejectionRequests.length}
                  </span>
                </div>
                <div className="divide-y divide-gray-50 overflow-y-auto max-h-40 min-h-0">
                  {rejectionRequests.map(req => {
                    return (
                      <div key={req.id} className="px-3 py-2 flex items-start gap-2 min-w-0">
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
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setSelectedRequest(req); setShowApprovalModal(true) }} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100">אשר</button>
                          <button onClick={() => setDenyConfirmRequest(req)} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">דחה</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {alerts.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl flex flex-col min-w-0 flex-shrink-0">
                <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="leading-snug">התראות תוקף</span>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full shrink-0">
                    {alerts.length}
                  </span>
                </div>
                <div className="divide-y divide-gray-50 overflow-y-auto max-h-40 min-h-0">
                  {alerts.map(alert => {
                    const config = alertTypeConfig[alert.type]
                    const Icon = config?.icon || AlertTriangle
                    return (
                      <Link key={alert.id} href={`${config?.link || '/dashboard/trucks'}?edit=${alert.entityId}`} className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 min-w-0">
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${alert.severity === 'expired' ? 'bg-red-100' : 'bg-amber-100'}`}>
                          <Icon size={10} className={alert.severity === 'expired' ? 'text-red-600' : 'text-amber-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate">{alert.entityName}</div>
                          <div className="text-xs text-gray-500 truncate">{config?.label || ''}</div>
                          <div className="text-xs text-gray-400">{getDaysText(alert.daysLeft)}</div>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${alert.severity === 'expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                          {alert.severity === 'expired' ? 'פג' : 'בקרוב'}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {overtimeDrivers.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl flex flex-col min-w-0 flex-shrink-0">
                <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                    <span className="leading-snug">לא סיימו משמרת</span>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full shrink-0">
                    {overtimeDrivers.length}
                  </span>
                </div>
                <div className="min-h-0 max-h-52 overflow-y-auto overscroll-y-contain divide-y divide-gray-50">
                  {overtimeDrivers.map((shift: any) => {
                    const driver = shift.driver as any
                    const openTowsCount = driver?.id ? (openTowsByDriver[driver.id] ?? 0) : 0
                    const metaParts = [
                      formatShiftStartJerusalem(shift.started_at),
                      formatOpenShiftDuration(shift.started_at),
                      openTowsCount > 0 ? `${openTowsCount} גרירות פתוחות` : null,
                    ].filter(Boolean)
                    return (
                      <div key={shift.id} className="px-3 py-2 flex items-start gap-2 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="text-xs font-medium text-gray-700 truncate min-w-0">
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
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-200 shrink-0"
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
            )}
          </div>
          </div>

          {/* עמודה שמאל (רחבה): יומן + רשימות עדיפות */}
          <div className="flex flex-col gap-3 min-h-0 min-w-0 overflow-hidden">

            {/* גרירות היום */}
            <div className="bg-white border border-gray-200 rounded-xl flex flex-col flex-1 min-h-0 min-w-0">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-700 shrink-0">גרירות היום</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={prevListDay}
                      className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-500 hover:bg-gray-50"
                      aria-label="יום קודם"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <span className="text-xs font-medium text-gray-600 min-w-[4.5rem] text-center">
                      {formatListDateLabel(listDate)}
                    </span>
                    <button
                      type="button"
                      onClick={nextListDay}
                      className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-500 hover:bg-gray-50"
                      aria-label="יום הבא"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {!isListToday && (
                      <button
                        type="button"
                        onClick={goToListToday}
                        className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium"
                      >
                        היום
                      </button>
                    )}
                  </div>
                </div>
                <Link
                  href="/dashboard/calendar"
                  className="text-xs text-[#0284c7] hover:underline font-medium shrink-0"
                >
                  ליומן המלא ←
                </Link>
              </div>
              <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
                {sortedAssignedListTows.length === 0 && normalizedListEvents.length === 0 && (
                  <div className="px-3 py-1 text-xs text-gray-400 text-center shrink-0 border-b border-gray-50">
                    אין גרירות משובצות
                  </div>
                )}
                <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
                  <div
                    ref={dashCalendarScrollRef}
                    className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden"
                  >
                    <div className="flex min-w-0" style={{ height: `${DASH_GRID_HEIGHT_PX}px` }}>
                      <div className="flex-1 relative min-w-0 border-r border-gray-100">
                        {DASH_CALENDAR_HOURS.map((hour) => (
                          <div
                            key={hour}
                            onClick={() => handleSlotClick(listDate, hour)}
                            className="border-b border-gray-50 cursor-pointer hover:bg-[#33d4ff]/5 transition-colors"
                            style={{ height: `${PIXELS_PER_HOUR_DASH}px` }}
                          />
                        ))}
                        <div className="absolute inset-0 pointer-events-none">
                          {sortedAssignedListTows.map((tow) => {
                            const segment = computeDaySegmentForTow(tow, listDate, now)
                            if (!segment) return null

                            const pos: OverlapPosition =
                              listDayOverlapLayout.get(towSegmentOverlapKey(tow.id, listDate)) ?? {
                                columnIndex: 0,
                                totalColumns: 1,
                                span: 1,
                              }
                            const { offsetPct, widthPct } = getOverlapBlockWidthPct(pos, 100)
                            const segmentStart = new Date(segment.startMs)
                            const hour =
                              segmentStart.getHours() +
                              segmentStart.getMinutes() / 60
                            const top = hour * PIXELS_PER_HOUR_DASH
                            const driverColor = getDriverColor(tow.driver_id!, allDrivers)
                            const isPlainCancelled = tow.status === 'cancelled'
                            const isChargedCancel = tow.status === 'cancelled_charged'
                            const heightPx = Math.max(
                              16,
                              ((segment.endMs - segment.startMs) / 60000 / 60) * PIXELS_PER_HOUR_DASH,
                            )

                            return (
                              <button
                                key={towSegmentOverlapKey(tow.id, listDate)}
                                type="button"
                                onClick={() => router.push(`/dashboard/tows/${tow.id}`)}
                                className={`absolute pointer-events-auto rounded px-1 py-0.5 text-white overflow-hidden text-[10px] leading-tight text-right hover:brightness-95 transition-[filter] ${
                                  isPlainCancelled ? 'opacity-60 line-through' : ''
                                }`}
                                style={{
                                  top: `${top}px`,
                                  height: `${heightPx}px`,
                                  left: `calc(${offsetPct}% + 1px)`,
                                  width: `calc(${widthPct}% - 2px)`,
                                  backgroundColor:
                                    tow.status === 'completed'
                                      ? '#16a34a'
                                      : isPlainCancelled
                                        ? '#9ca3af'
                                        : isChargedCancel
                                          ? '#d97706'
                                          : driverColor,
                                }}
                              >
                                <TowBlockClipIndicators
                                  isTopClipped={segment.isTopClipped}
                                  isBottomClipped={segment.isBottomClipped}
                                  size="sm"
                                />
                                <CompactTowBlockStatusBadge status={tow.status} />
                                <span className="block line-clamp-2 pr-3">
                                  {tow.customer?.name || 'ללא לקוח'}
                                </span>
                              </button>
                            )
                          })}

                          {normalizedListEvents.map((event) => {
                            const pos: OverlapPosition =
                              listDayOverlapLayout.get(dashEventOverlapKey(event.id)) ?? {
                                columnIndex: 0,
                                totalColumns: 1,
                                span: 1,
                              }
                            const { offsetPct, widthPct } = getOverlapBlockWidthPct(pos, 100)
                            const eventDate = new Date(event.startMs)
                            const hour =
                              eventDate.getHours() + eventDate.getMinutes() / 60
                            const top = hour * PIXELS_PER_HOUR_DASH
                            const driverColor = getDriverColor(event.driverId, allDrivers)
                            const heightPx = Math.max(
                              16,
                              ((event.endMs - event.startMs) / 60000 / 60) * PIXELS_PER_HOUR_DASH,
                            )

                            return (
                              <button
                                key={dashEventOverlapKey(event.id)}
                                type="button"
                                onClick={() => router.push(`/dashboard/events/${event.id}`)}
                                className="absolute pointer-events-auto rounded px-1 py-0.5 text-white overflow-hidden text-[10px] leading-tight text-right hover:brightness-95 transition-[filter] ring-1 ring-cyan-300"
                                style={{
                                  top: `${top}px`,
                                  height: `${heightPx}px`,
                                  left: `calc(${offsetPct}% + 1px)`,
                                  width: `calc(${widthPct}% - 2px)`,
                                  backgroundColor: driverColor,
                                  borderRight: '3px solid #22d3ee',
                                }}
                              >
                                <span className="absolute top-0 left-0 flex items-center gap-px bg-cyan-400 text-white text-[7px] px-0.5 rounded-br font-bold leading-none">
                                  <Sparkles size={7} />
                                  אירוע
                                </span>
                                <span className="block line-clamp-2 pr-3 pt-2.5">
                                  {event.label}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                        {isListToday && (
                          <div
                            className="absolute right-0 left-0 border-t border-red-500 z-10 pointer-events-none"
                            style={{ top: `${getCurrentFractionalHour() * PIXELS_PER_HOUR_DASH}px` }}
                          >
                            <div className="absolute right-0 w-2 h-2 bg-red-500 rounded-full -mt-1 -mr-1" />
                          </div>
                        )}
                      </div>
                      <div className="w-10 shrink-0 border-r border-gray-100">
                        {DASH_CALENDAR_HOURS.map((hour) => (
                          <div
                            key={hour}
                            className="text-[10px] text-gray-400 text-center border-b border-gray-50 leading-none pt-0.5"
                            style={{ height: `${PIXELS_PER_HOUR_DASH}px` }}
                          >
                            {hour.toString().padStart(2, '0')}:00
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="w-[110px] shrink-0 border-r border-gray-100 overflow-y-auto py-1.5 px-2 space-y-1.5">
                    {listDayDrivers.map((driver) => (
                      <div key={driver.id} className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: getDriverColor(driver.id, allDrivers) }}
                        />
                        <span className="text-[10px] text-gray-600 truncate">
                          {(driver.user?.full_name || '').split(' ')[0] || 'נהג'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* הצעות מחיר ממתינות */}
            {quoteTows.length + quoteEvents.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 min-w-0 flex-shrink-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-amber-800 leading-snug min-w-0">
                    הצעות מחיר ממתינות
                  </span>
                  <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                    {quoteTows.length + quoteEvents.length}
                  </span>
                </div>
                <div className="space-y-1 max-h-20 overflow-y-auto min-h-0">
                  {quoteTows.map(t => (
                    <div
                      key={`tow-${t.id}`}
                      onClick={() => router.push(`/dashboard/tows/${t.id}`)}
                      className="flex items-center justify-between p-2 min-w-0 bg-white rounded-lg cursor-pointer hover:bg-amber-50 text-xs gap-2"
                    >
                      <span className="font-medium shrink-0">{t.order_number || t.id.slice(0, 8)}</span>
                      <span className="text-gray-500 flex-1 min-w-0 truncate">{t.customer?.name || 'לקוח'}</span>
                      <span className="text-amber-600 shrink-0">{formatWaitTime(t.created_at)}</span>
                    </div>
                  ))}
                  {quoteEvents.map(e => (
                    <div
                      key={`event-${e.id}`}
                      onClick={() => router.push(`/dashboard/events/${e.id}`)}
                      className="flex items-center justify-between p-2 min-w-0 bg-white rounded-lg cursor-pointer hover:bg-cyan-50 text-xs gap-2 ring-1 ring-cyan-200"
                    >
                      <span className="flex items-center gap-1 font-medium shrink-0">
                        <span className="inline-flex items-center gap-0.5 bg-cyan-400 text-white text-[9px] px-1 py-px rounded font-bold leading-none">
                          <Sparkles size={8} />
                          אירוע
                        </span>
                        {e.order_number || e.id.slice(0, 8)}
                      </span>
                      <span className="text-gray-500 flex-1 min-w-0 truncate">{e.customer?.name || 'לקוח'}</span>
                      <span className="text-amber-600 shrink-0">{formatWaitTime(e.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* רשימות עדיפות — ממתינות + בקשות נכנסות */}
            <div className="grid grid-cols-2 gap-3 flex-shrink-0 min-h-[11rem] max-h-[14rem]">
              {/* ממתינות לשיבוץ */}
              <div className="bg-white border border-gray-200 rounded-xl flex flex-col min-w-0 min-h-0">
                <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="leading-snug">ממתינות לשיבוץ</span>
                  </div>
                  {pendingTows.length + pendingEvents.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full shrink-0">
                      {pendingTows.length + pendingEvents.length}
                    </span>
                  )}
                </div>
                <div className="divide-y divide-gray-50 overflow-y-auto flex-1 min-h-0">
                    {pendingTows.length === 0 && pendingEvents.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-gray-300 text-center">אין ממתינות</div>
                    ) : (
                      <>
                    {pendingTows.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(tow => (
                    <div key={tow.id} onClick={() => router.push(`/dashboard/tows/${tow.id}`)} className="px-3 py-1.5 flex items-center gap-2 min-w-0 cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-700 truncate">{tow.customer?.name || '—'} · {tow.vehicles?.[0]?.plate_number || '—'}</div>
                        <div className="text-xs text-gray-400 truncate">{tow.legs?.[0]?.from_address?.split(',')[0] || '—'} ← {tow.legs?.[tow.legs.length - 1]?.to_address?.split(',')[0] || '—'}</div>
                      </div>
                      <span className="text-xs text-amber-600 shrink-0">{formatWaitTime(tow.created_at)}</span>
                      <button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/tows/${tow.id}`); }} className="text-xs px-2 py-1 bg-gray-900 text-white rounded-lg shrink-0 hover:bg-gray-700">שבץ</button>
                    </div>
                  ))}
                    {pendingEvents.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(event => (
                    <div key={event.id} onClick={() => router.push(`/dashboard/events/${event.id}`)} className="px-3 py-1.5 flex items-center gap-2 min-w-0 cursor-pointer hover:bg-cyan-50 transition-colors ring-1 ring-inset ring-cyan-100">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-700 truncate flex items-center gap-1">
                          <span className="inline-flex items-center gap-0.5 bg-cyan-400 text-white text-[9px] px-1 py-px rounded font-bold leading-none shrink-0">
                            <Sparkles size={8} />
                            אירוע
                          </span>
                          <span className="truncate">{event.customer?.name || '—'}</span>
                        </div>
                        <div className="text-xs text-gray-400 truncate">{event.location_address?.split(',')[0] || event.order_number || '—'}</div>
                      </div>
                      <span className="text-xs text-amber-600 shrink-0">{formatWaitTime(event.created_at)}</span>
                      <button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/events/${event.id}`); }} className="text-xs px-2 py-1 bg-gray-900 text-white rounded-lg shrink-0 hover:bg-gray-700">שבץ</button>
                    </div>
                  ))}
                      </>
                    )}
                </div>
              </div>

              {/* בקשות נכנסות */}
              <div className="bg-white border border-gray-200 rounded-xl flex flex-col min-w-0 min-h-0">
                <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#33d4ff] shrink-0" />
                    <span className="leading-snug">בקשות נכנסות</span>
                  </div>
                  {incomingRequests.length > 0 && (
                    <span className="text-sm font-bold px-2 py-0.5 bg-cyan-500 text-white rounded-full shrink-0 min-w-[1.5rem] text-center">
                      {incomingRequests.length}
                    </span>
                  )}
                </div>
                <div className="divide-y divide-gray-50 overflow-y-auto flex-1 min-h-0">
                  {incomingRequests.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-300 text-center">אין בקשות נכנסות</div>
                  ) : incomingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="px-3 py-2 flex items-center gap-2 min-w-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-medium text-gray-700 truncate">
                            {req.customer?.name || '—'}
                          </span>
                          {req.tow_type === 'exchange' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-800 border border-violet-200">
                              תקין תקול
                            </span>
                          )}
                          {req.tow_type === 'custom' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                              מותאם
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {formatIncomingScheduledAt(req.scheduled_at)}
                          {req.customer_order_number ? ` · ${req.customer_order_number}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title="צפה בפרטי גרירה"
                          onClick={() =>
                            setViewingIncomingRequest({
                              id: req.id,
                              customerName: req.customer?.name ?? null,
                            })
                          }
                          className="px-2 py-1 rounded-md border border-gray-200 bg-white text-[10px] font-medium text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
                        >
                          צפה
                        </button>
                        <button
                          type="button"
                          title="השלם פרטי גרירה ושגר"
                          onClick={() =>
                            router.push(`/dashboard/tows/create?fromRequest=${req.id}`)
                          }
                          className="px-2 py-1 rounded-md bg-gt-brand text-[10px] font-medium text-white hover:bg-gt-brand-hover transition-colors whitespace-nowrap"
                        >
                          השלם ושגר
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        <SelectorModalShell
          open={!!viewingIncomingRequest}
          onClose={() => setViewingIncomingRequest(null)}
          title="פרטי בקשת לקוח"
          panelClassName="max-w-lg"
          footer={
            viewingIncomingRequest ? (
              <div className="flex flex-col gap-2" dir="rtl">
                <button
                  type="button"
                  onClick={() => {
                    const id = viewingIncomingRequest.id
                    setViewingIncomingRequest(null)
                    router.push(`/dashboard/tows/create?fromRequest=${id}`)
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-gt-brand text-sm font-medium text-white transition-colors hover:bg-gt-brand-hover"
                >
                  המשך למילוי הגרירה
                </button>
                <button
                  type="button"
                  onClick={() => setViewingIncomingRequest(null)}
                  className="w-full min-h-[40px] rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  סגור
                </button>
              </div>
            ) : null
          }
        >
          {viewingIncomingRequest && (
            <CustomerTowRequestDetailsPanel
              requestId={viewingIncomingRequest.id}
              customerName={viewingIncomingRequest.customerName}
              embedded
            />
          )}
        </SelectorModalShell>

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

        {showDriverModal && pendingSlot && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
            <div className="bg-white w-full sm:rounded-2xl sm:max-w-md sm:mx-4 overflow-hidden rounded-t-2xl max-h-[80vh] overflow-y-auto">
              <div className="px-5 py-4 bg-[#33d4ff] text-white flex items-center justify-between sticky top-0">
                <div>
                  <h2 className="font-bold text-lg">בחר נהג</h2>
                  <p className="text-white/80 text-sm">
                    {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][pendingSlot.date.getDay()]},{' '}
                    {pendingSlot.date.toLocaleDateString('he-IL')} בשעה {pendingSlot.hour.toString().padStart(2, '0')}:00
                  </p>
                </div>
                <button type="button" onClick={closeDriverModal} className="p-2 hover:bg-white/20 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 space-y-2">
                {allDrivers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Truck size={40} className="mx-auto mb-3 text-gray-300" />
                    <p>אין נהגים במערכת</p>
                    <Link
                      href="/dashboard/drivers"
                      className="text-[#33d4ff] hover:underline text-sm mt-2 inline-block"
                    >
                      הוסף נהגים
                    </Link>
                  </div>
                ) : (
                  <>
                    {allDrivers.map((driver, index) => {
                      const color = DRIVER_COLORS[index % DRIVER_COLORS.length]
                      const targetDate = pendingSlot.date
                      const driverTowsToday = listTows.filter((t) => {
                        if (t.driver_id !== driver.id) return false
                        const towDate = new Date(t.scheduled_at || t.created_at)
                        return towDate.toDateString() === targetDate.toDateString()
                      })
                      const towCount = driverTowsToday.length

                      return (
                        <button
                          key={driver.id}
                          type="button"
                          onClick={() => handleDriverSelect(driver.id)}
                          className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 hover:border-[#33d4ff] hover:bg-[#33d4ff]/5 transition-all text-right"
                        >
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            {driver.user?.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800">{driver.user?.full_name}</p>
                            <p className="text-sm text-gray-500">{driver.user?.phone || 'אין טלפון'}</p>
                          </div>
                          <div className="text-left flex-shrink-0">
                            {towCount === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                פנוי
                              </span>
                            ) : towCount <= 3 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                {towCount} גרירות
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                {towCount} גרירות
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}

                    <div className="pt-2 border-t border-gray-200 mt-3">
                      <button
                        type="button"
                        onClick={handleCreateWithoutDriver}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all text-gray-500"
                      >
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <Plus size={20} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium">ללא נהג</p>
                          <p className="text-sm">שיבוץ מאוחר יותר</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={closeDriverModal}
                  className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }