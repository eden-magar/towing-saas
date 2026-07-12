'use client'

import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/AuthContext'
import { getWeekTows, updateTowSchedule, searchTows, type CalendarTowSearchHit } from '../../lib/queries/calendar'
import { getWeekEvents } from '../../lib/queries/events'
import { getEventTimeBounds } from '../../lib/utils/event-time-bounds'
import { getDrivers } from '../../lib/queries/drivers'
import { getTrucks } from '../../lib/queries/trucks'
import { TowWithDetails } from '../../lib/queries/tows'
import { DriverWithDetails, TruckWithDetails } from '../../lib/types'
import { getTruckTypeLabel } from '../../lib/utils/truck-type-labels'
import { recalculateTowPrice, updateTow } from '../../lib/queries/tows'
import { supabase } from '../../lib/supabase'
import { 
  ChevronRight,
  ChevronLeft,
  Plus,
  Clock,
  Truck,
  X,
  GripVertical,
  RefreshCw,
  Calendar,
  ArrowRight,
  User,
  AlertTriangle,
  Search,
  Users,
  CheckCircle,
  XCircle,
  Play,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import {
  computeDaySegmentForTow,
  getEffectiveTowStartIso,
  getTowTimeBounds,
  towOverlapsCalendarDay,
  towSegmentOverlapKey,
  type TowDaySegment,
} from '../../lib/utils/tow-time-bounds'
import {
  consumeRestoredCalendarView,
  persistCalendarViewForReturn,
} from '../../lib/utils/calendar-view-session'
import { getOverlapLayout, getOverlapBlockWidthPct, type OverlapPosition } from '../../lib/utils/tow-overlap-layout'
import { TowBlockClipIndicators } from '../../components/TowBlockClipIndicators'

// צבעים לנהגים — ~20 well-separated hues (id-based via getDriverColor)
const DRIVER_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d',
  '#16a34a', '#059669', '#0d9488', '#0891b2', '#0284c7',
  '#2563eb', '#4f46e5', '#7c3aed', '#9333ea', '#c026d3',
  '#db2777', '#be185d', '#b45309', '#047857', '#1e40af',
]

// מיפוי סטטוסים
const statusLabels: Record<string, string> = {
  pending: 'ממתינה',
  assigned: 'שובצה',
  in_progress: 'בביצוע',
  completed: 'הושלמה',
  cancelled: 'בוטלה',
  cancelled_charged: 'בוטל בחיוב',
  quote: 'הצעת מחיר',
}

const CANCELLED_CHARGED_COLOR = '#d97706'

function getTowCalendarBackgroundColor(status: string, driverColor: string): string {
  if (status === 'completed') return '#16a34a'
  if (status === 'cancelled') return '#9ca3af'
  if (status === 'cancelled_charged') return CANCELLED_CHARGED_COLOR
  return driverColor
}

const PIXELS_PER_HOUR_WEEK = 40
const PIXELS_PER_HOUR_DAY = 48
const VISIBLE_HOURS = 12
const WEEK_VIEWPORT_MIN_HEIGHT = VISIBLE_HOURS * PIXELS_PER_HOUR_WEEK
const DAY_VIEWPORT_MIN_HEIGHT = VISIBLE_HOURS * PIXELS_PER_HOUR_DAY
const CALENDAR_SCROLL_MAX_HEIGHT = 'calc(100vh - 280px)'

function calendarScrollViewportStyle(viewportMinHeight: number): CSSProperties {
  return {
    minHeight: `${viewportMinHeight}px`,
    maxHeight: `max(${viewportMinHeight}px, ${CALENDAR_SCROLL_MAX_HEIGHT})`,
  }
}

interface EventCalendarItem {
  id: string
  kind: 'event'
  startMs: number
  endMs: number
  driverId: string | null
  label: string
  status: string
}

function eventOverlapKey(eventId: string): string {
  return `event:${eventId}`
}

const MIN_SEGMENT_BLOCK_HEIGHT = 20

function segmentToCalendarBlockPixels(
  segment: TowDaySegment,
  pixelsPerHour: number,
  view: 'day' | 'week',
): { top: number; heightPx: number } {
  const startDate = new Date(segment.startMs)
  const hour =
    startDate.getHours() +
    startDate.getMinutes() / 60 +
    startDate.getSeconds() / 3600
  const top = hour * pixelsPerHour
  const elapsedMinutes = (segment.endMs - segment.startMs) / 60000
  let heightPx = (elapsedMinutes / 60) * pixelsPerHour
  if (view === 'week') {
    heightPx = Math.max(heightPx - 4, MIN_SEGMENT_BLOCK_HEIGHT)
  } else {
    heightPx = Math.max(heightPx, MIN_SEGMENT_BLOCK_HEIGHT)
  }
  return { top, heightPx }
}

function formatTowTimeRange(startMs: number, endMs: number): string {
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  const start = new Date(startMs).toLocaleTimeString('he-IL', timeOpts)
  const end = new Date(endMs).toLocaleTimeString('he-IL', timeOpts)
  return `${start}–${end}`
}

function TowBlockStatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  if (status === 'pending' || status === 'assigned' || status === 'quote') {
    return null
  }

  const iconSize = size === 'sm' ? 12 : 14
  const shell = 'absolute top-1 right-1 flex items-center justify-center rounded-full bg-white/90 p-0.5 shadow-sm pointer-events-none z-10'

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

function TowModalStatusIcon({ status }: { status: string }) {
  const iconSize = 16
  if (status === 'completed') {
    return <CheckCircle size={iconSize} className="text-green-600 shrink-0" strokeWidth={2.5} />
  }
  if (status === 'cancelled') {
    return <XCircle size={iconSize} className="text-gray-600 shrink-0" strokeWidth={2.5} />
  }
  if (status === 'cancelled_charged') {
    return <XCircle size={iconSize} className="text-amber-600 shrink-0" strokeWidth={2.5} />
  }
  if (status === 'in_progress') {
    return (
      <Play size={iconSize} className="text-orange-500 fill-orange-500 shrink-0" strokeWidth={2.5} />
    )
  }
  return null
}

function TowDetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <div className="text-sm text-gray-800 text-left flex-1 min-w-0">{children}</div>
    </div>
  )
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט',
  'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

const MINI_CAL_WEEKDAY_HEADERS = ['ש', 'ו', 'ה', 'ד', 'ג', 'ב', 'א'] as const

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function sundayOfWeek(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - x.getDay())
  return x
}

interface MiniCalendarProps {
  selectedDate: Date
  onPickDate: (date: Date) => void
}

function MiniCalendar({ selectedDate, onPickDate }: MiniCalendarProps) {
  const [miniCalMonth, setMiniCalMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  )

  const todayKey = startOfDay(new Date()).toDateString()
  const selectedKey = startOfDay(selectedDate).toDateString()
  const displayMonth = miniCalMonth.getMonth()
  const displayYear = miniCalMonth.getFullYear()

  const cells = useMemo(() => {
    const first = new Date(displayYear, displayMonth, 1)
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - first.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
  }, [displayMonth, displayYear])

  const handlePick = (date: Date) => {
    onPickDate(startOfDay(date))
    setMiniCalMonth(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() =>
            setMiniCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
          }
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
          aria-label="חודש קודם"
        >
          <ChevronRight size={16} />
        </button>
        <span className="text-xs font-semibold text-gray-800">
          {HEBREW_MONTHS[displayMonth]} {displayYear}
        </span>
        <button
          type="button"
          onClick={() =>
            setMiniCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
          }
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
          aria-label="חודש הבא"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {MINI_CAL_WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className="text-[10px] text-gray-400 text-center font-medium py-0.5"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((date) => {
          const key = date.toDateString()
          const isToday = key === todayKey
          const isSelected = !isToday && key === selectedKey
          const inMonth = date.getMonth() === displayMonth

          return (
            <button
              key={key}
              type="button"
              onClick={() => handlePick(date)}
              className={[
                'mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors',
                isToday
                  ? 'bg-[#33d4ff] text-white font-semibold'
                  : isSelected
                    ? 'bg-[#33d4ff]/25 text-gray-800 font-medium'
                    : inMonth
                      ? 'text-gray-800 hover:bg-gray-100'
                      : 'text-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface DriverFilterPanelProps {
  drivers: DriverWithDetails[]
  selectedDrivers: string[]
  showAllDrivers: boolean
  showUnassigned: boolean
  driverSearch: string
  onDriverSearchChange: (value: string) => void
  onToggleDriver: (driverId: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  onShowUnassignedChange: (value: boolean) => void
  getDriverColor: (driverId: string) => string
  getDriverName: (driverId: string) => string
  selectedDate: Date
  onPickDate: (date: Date) => void
  onClose?: () => void
  className?: string
}

function DriverFilterPanel({
  drivers,
  selectedDrivers,
  showAllDrivers,
  showUnassigned,
  driverSearch,
  onDriverSearchChange,
  onToggleDriver,
  onSelectAll,
  onClearAll,
  onShowUnassignedChange,
  getDriverColor,
  getDriverName,
  selectedDate,
  onPickDate,
  onClose,
  className = '',
}: DriverFilterPanelProps) {
  const searchLower = driverSearch.trim().toLowerCase()
  const visibleDrivers = drivers.filter((driver) => {
    if (driver.user?.is_active !== true) return false
    if (!searchLower) return true
    const name = getDriverName(driver.id) || driver.user?.full_name || ''
    return name.toLowerCase().includes(searchLower)
  })

  const isDriverVisible = (driverId: string) =>
    showAllDrivers || selectedDrivers.includes(driverId)

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col ${className}`}>
      <div className="p-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-gray-800">נהגים</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="p-3 space-y-3">
        <MiniCalendar selectedDate={selectedDate} onPickDate={onPickDate} />
        <div className="border-t border-gray-100" />

        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={driverSearch}
            onChange={(e) => onDriverSearchChange(e.target.value)}
            placeholder="חיפוש נהג..."
            className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40 focus:border-[#33d4ff]"
          />
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[#33d4ff] hover:underline font-medium"
          >
            בחר הכל
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={onClearAll}
            className="text-gray-500 hover:underline font-medium"
          >
            נקה הכל
          </button>
        </div>

        <button
          type="button"
          onClick={() => onToggleDriver('all')}
          className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-right transition-colors ${
            showAllDrivers ? 'bg-[#33d4ff]/10' : 'hover:bg-gray-50'
          }`}
        >
          <span
            className={`w-3 h-3 rounded-full shrink-0 bg-[#33d4ff] ${showAllDrivers ? '' : 'opacity-30'}`}
          />
          <span className={`text-sm flex-1 ${showAllDrivers ? 'font-medium text-gray-800' : 'text-gray-400'}`}>
            הכל
          </span>
        </button>

        <div className="border-t border-gray-100 pt-1 space-y-0.5">
          {visibleDrivers.length === 0 ? (
            <p className="text-xs text-gray-400 px-2 py-3 text-center">לא נמצאו נהגים</p>
          ) : (
            visibleDrivers.map((driver) => {
              const visible = isDriverVisible(driver.id)
              const color = getDriverColor(driver.id)
              return (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => onToggleDriver(driver.id)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-right transition-colors ${
                    visible ? 'bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 ${visible ? '' : 'opacity-30'}`}
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className={`text-sm flex-1 truncate ${
                      visible ? 'font-medium text-gray-800' : 'text-gray-400'
                    }`}
                  >
                    {getDriverName(driver.id) || driver.user?.full_name}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => onShowUnassignedChange(!showUnassigned)}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-right transition-colors ${
              showUnassigned ? 'bg-gray-50' : 'hover:bg-gray-50'
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full shrink-0 bg-gray-500 ${showUnassigned ? '' : 'opacity-30'}`}
            />
            <span
              className={`text-sm flex-1 ${showUnassigned ? 'font-medium text-gray-800' : 'text-gray-400'}`}
            >
              לא משויך
            </span>
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 px-3 py-2 border-t border-gray-100 shrink-0">
        {showAllDrivers
          ? 'כל הנהגים'
          : selectedDrivers.length === 0
            ? 'אין נהגים נבחרים'
            : `${selectedDrivers.length} נהגים נבחרו`}
      </p>
    </div>
  )
}

export default function CalendarPage() {
  const router = useRouter()
  const { companyId, loading: authLoading } = useAuth()
  const [view, setView] = useState<'week' | 'day'>('day')
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([])
  const [showAllDrivers, setShowAllDrivers] = useState(true)
  const [showUnassigned, setShowUnassigned] = useState(true)
  const [driverSearch, setDriverSearch] = useState('')
  const [driverPanelOpen, setDriverPanelOpen] = useState(false)
  
  // תאריך תחילת שבוע
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day
    const weekStart = new Date(today)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
  })

  // תאריך נבחר לתצוגה יומית
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
  
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [trucks, setTrucks] = useState<TruckWithDetails[]>([])
  const [tows, setTows] = useState<TowWithDetails[]>([])
  const [events, setEvents] = useState<Awaited<ReturnType<typeof getWeekEvents>>>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [selectedTow, setSelectedTow] = useState<TowWithDetails | null>(null)
  const [towActionMenu, setTowActionMenu] = useState<TowWithDetails | null>(null)
  const [draggedTow, setDraggedTow] = useState<TowWithDetails | null>(null)
  
  // מודל בחירת נהג
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [pendingSlot, setPendingSlot] = useState<{ date: Date; hour: number } | null>(null)
  const [towToAssign, setTowToAssign] = useState<TowWithDetails | null>(null)
  const [selectedAssignDriverId, setSelectedAssignDriverId] = useState<string | null>(null)
  const [selectedAssignTruckId, setSelectedAssignTruckId] = useState<string | null>(null)
  const [assigningTow, setAssigningTow] = useState(false)

  // מודל עדכון מחיר
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

  const [globalSearchInput, setGlobalSearchInput] = useState('')
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState('')
  const [globalSearchResults, setGlobalSearchResults] = useState<CalendarTowSearchHit[]>([])
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const [globalSearchError, setGlobalSearchError] = useState('')
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [searchHitPopover, setSearchHitPopover] = useState<CalendarTowSearchHit | null>(null)

  const dayLayoutRef = useRef<HTMLDivElement>(null)
  const globalSearchWrapRef = useRef<HTMLDivElement>(null)
  const globalSearchRequestIdRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGlobalSearch(globalSearchInput.trim())
    }, 200)
    return () => clearTimeout(timer)
  }, [globalSearchInput])

  useEffect(() => {
    if (!companyId || debouncedGlobalSearch.length < 2) {
      setGlobalSearchResults([])
      setGlobalSearchLoading(false)
      setGlobalSearchError('')
      return
    }

    let cancelled = false
    const requestId = ++globalSearchRequestIdRef.current
    setGlobalSearchLoading(true)
    setGlobalSearchError('')

    searchTows(companyId, debouncedGlobalSearch)
      .then((results) => {
        if (!cancelled && requestId === globalSearchRequestIdRef.current) {
          setGlobalSearchResults(results)
        }
      })
      .catch((err) => {
        console.error('Calendar global search failed:', err)
        if (!cancelled && requestId === globalSearchRequestIdRef.current) {
          setGlobalSearchResults([])
          setGlobalSearchError('שגיאה בחיפוש')
        }
      })
      .finally(() => {
        if (!cancelled && requestId === globalSearchRequestIdRef.current) {
          setGlobalSearchLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [companyId, debouncedGlobalSearch])

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!globalSearchWrapRef.current?.contains(e.target as Node)) {
        setGlobalSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const hours = Array.from({ length: 24 }, (_, i) => i)

  // זיהוי מובייל
  const [isMobile, setIsMobile] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // טעינת נתונים
  const loadData = async () => {
    if (!companyId) return
    
    try {
      const [driversData, trucksData, towsData, eventsData] = await Promise.all([
        getDrivers(companyId),
        getTrucks(companyId),
        getWeekTows(companyId, currentWeekStart),
        getWeekEvents(companyId, currentWeekStart),
      ])
      
      setDrivers(driversData)
      setTrucks(trucksData)
      setTows(towsData)
      setEvents(eventsData)
    } catch (error) {
      console.error('Error loading calendar data:', error)
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
  }, [companyId, authLoading, currentWeekStart])

  useEffect(() => {
    if (!companyId) return
    const channel = supabase
      .channel(`calendar-realtime-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tows', filter: `company_id=eq.${companyId}` }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [companyId])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  // מיפוי צבעים לנהגים
  const getDriverColor = (driverId: string) => {
    const index = drivers.findIndex(d => d.id === driverId)
    return DRIVER_COLORS[index % DRIVER_COLORS.length] || '#6b7280'
  }

  const getDriverName = (driverId: string) => {
    return drivers.find(d => d.id === driverId)?.user?.full_name || ''
  }

  const getDriverTrucks = (driverId: string) =>
    trucks.filter((t) => (t.assigned_drivers ?? []).some((d) => d.id === driverId))

  // יצירת ימי השבוע
  const weekDays = useMemo(() => {
    const days = []
    const today = new Date()
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(currentWeekStart.getDate() + i)
      const isToday = date.toDateString() === today.toDateString()
      days.push({
        day: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][date.getDay()],
        date: date.getDate().toString(),
        fullDate: date,
        isToday,
        dayIndex: i
      })
    }
    return days
  }, [currentWeekStart])

  // ימים להצגה - 1 במובייל, 7 בדסקטופ
  const [mobileDayIndex, setMobileDayIndex] = useState(() => {
    // אתחול פעם אחת - מהיום הנוכחי בשבוע
    return new Date().getDay()
  })

  useEffect(() => {
    const restored = consumeRestoredCalendarView()
    if (!restored) return
    setCurrentWeekStart(restored.weekStart)
    setSelectedDate(restored.selectedDate)
    setView(restored.view)
    setMobileDayIndex(restored.selectedDate.getDay())
  }, [])

  const persistCalendarViewBeforeCreate = useCallback(() => {
    persistCalendarViewForReturn({
      weekStart: currentWeekStart,
      selectedDate,
      view,
    })
  }, [currentWeekStart, selectedDate, view])

  // ניווט בין שבועות — in day view, keep selectedDate on the same weekday in the new week
  const navigateWeek = (direction: 'prev' | 'next') => {
    const delta = direction === 'next' ? 7 : -7
    const newWeekStart = new Date(currentWeekStart)
    newWeekStart.setDate(newWeekStart.getDate() + delta)
    newWeekStart.setHours(0, 0, 0, 0)
    setCurrentWeekStart(newWeekStart)

    setSelectedDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + delta)
      next.setHours(0, 0, 0, 0)
      return next
    })
  }

  /** Move day cursor to `date` and refetch that date's week when needed. */
  const selectCalendarDay = (date: Date) => {
    const picked = startOfDay(date)
    setSelectedDate(picked)
    setCurrentWeekStart(sundayOfWeek(picked))
    setMobileDayIndex(picked.getDay())
  }

  // ניווט יום במובייל — sync selectedDate; on week boundary move week + land on Sun/Sat
  const navigateMobileDay = (direction: 'prev' | 'next') => {
    if (direction === 'next') {
      if (mobileDayIndex < 6) {
        const nextIndex = mobileDayIndex + 1
        const d = new Date(currentWeekStart)
        d.setDate(currentWeekStart.getDate() + nextIndex)
        d.setHours(0, 0, 0, 0)
        setMobileDayIndex(nextIndex)
        setSelectedDate(d)
        return
      }
      const newWeekStart = new Date(currentWeekStart)
      newWeekStart.setDate(newWeekStart.getDate() + 7)
      newWeekStart.setHours(0, 0, 0, 0)
      setCurrentWeekStart(newWeekStart)
      setSelectedDate(newWeekStart)
      setMobileDayIndex(0)
      return
    }

    if (mobileDayIndex > 0) {
      const nextIndex = mobileDayIndex - 1
      const d = new Date(currentWeekStart)
      d.setDate(currentWeekStart.getDate() + nextIndex)
      d.setHours(0, 0, 0, 0)
      setMobileDayIndex(nextIndex)
      setSelectedDate(d)
      return
    }
    const newWeekStart = new Date(currentWeekStart)
    newWeekStart.setDate(newWeekStart.getDate() - 7)
    newWeekStart.setHours(0, 0, 0, 0)
    const saturday = new Date(newWeekStart)
    saturday.setDate(newWeekStart.getDate() + 6)
    saturday.setHours(0, 0, 0, 0)
    setCurrentWeekStart(newWeekStart)
    setSelectedDate(saturday)
    setMobileDayIndex(6)
  }

  const displayedDays = useMemo(() => {
    if (!isMobile) return weekDays
    return [weekDays[mobileDayIndex]].filter(Boolean)
  }, [weekDays, isMobile, mobileDayIndex])

  const toggleDriver = (driverId: string) => {
    if (driverId === 'all') {
      setShowAllDrivers(true)
      setSelectedDrivers([])
      return
    }
    if (showAllDrivers) {
      setShowAllDrivers(false)
      setSelectedDrivers([driverId])
      return
    }
    setSelectedDrivers((prev) => {
      if (prev.includes(driverId)) {
        return prev.filter((d) => d !== driverId)
      }
      return [...prev, driverId]
    })
  }

  const filteredTows = useMemo(() => {
    return tows.filter((t) => {
      if (!t.driver_id) {
        return showUnassigned
      }
      if (showAllDrivers) {
        return true
      }
      return selectedDrivers.includes(t.driver_id)
    })
  }, [tows, selectedDrivers, showAllDrivers, showUnassigned])

  const eventCalendarItems = useMemo((): EventCalendarItem[] => {
    const items: EventCalendarItem[] = []
    for (const event of events) {
      const bounds = getEventTimeBounds(event)
      if (!bounds) continue
      items.push({
        id: event.id,
        kind: 'event',
        startMs: bounds.startMs,
        endMs: bounds.endMs,
        driverId: event.driver_id,
        label: event.customer?.name || 'אירוע',
        status: event.status,
      })
    }
    return items
  }, [events])

  const filteredEvents = useMemo(() => {
    return eventCalendarItems.filter((event) => {
      if (!event.driverId) {
        return showUnassigned
      }
      if (showAllDrivers) {
        return true
      }
      return selectedDrivers.includes(event.driverId)
    })
  }, [eventCalendarItems, selectedDrivers, showAllDrivers, showUnassigned])

  const handleSelectAllDrivers = () => {
    setShowAllDrivers(true)
    setSelectedDrivers([])
  }
  const handleClearAllDrivers = () => {
    setShowAllDrivers(false)
    setSelectedDrivers([])
  }

  const handlePickDate = (date: Date) => {
    selectCalendarDay(date)
  }

  const handleGlobalSearchResultClick = (hit: CalendarTowSearchHit) => {
    setSearchHitPopover(hit)
    setGlobalSearchOpen(false)
  }

  const clearGlobalSearch = () => {
    setGlobalSearchInput('')
    setDebouncedGlobalSearch('')
    setGlobalSearchResults([])
    setGlobalSearchError('')
    setGlobalSearchOpen(false)
  }

  const driverFilterPanelProps: DriverFilterPanelProps = {
    drivers,
    selectedDrivers,
    showAllDrivers,
    showUnassigned,
    driverSearch,
    onDriverSearchChange: setDriverSearch,
    onToggleDriver: toggleDriver,
    onSelectAll: handleSelectAllDrivers,
    onClearAll: handleClearAllDrivers,
    onShowUnassignedChange: setShowUnassigned,
    getDriverColor,
    getDriverName,
    selectedDate,
    onPickDate: handlePickDate,
  }

  // גרירות לתצוגה יומית
  const dayFilteredTows = useMemo(() => {
    return filteredTows.filter((tow) =>
      towOverlapsCalendarDay(tow, selectedDate, now),
    )
  }, [filteredTows, selectedDate, now])

  const dayFilteredEvents = useMemo(() => {
    return filteredEvents.filter((event) => {
      const eventDay = new Date(event.startMs)
      return eventDay.toDateString() === selectedDate.toDateString()
    })
  }, [filteredEvents, selectedDate])

  const weekOverlapLayout = useMemo(() => {
    const layout = new Map<string, OverlapPosition>()

    for (const day of weekDays) {
      const towItems = filteredTows.flatMap((tow) => {
        const segment = computeDaySegmentForTow(tow, day.fullDate, now)
        if (!segment) return []
        return [{
          id: towSegmentOverlapKey(tow.id, day.fullDate),
          startMs: segment.startMs,
          endMs: segment.endMs,
        }]
      })
      const eventItems = filteredEvents
        .filter((event) => new Date(event.startMs).toDateString() === day.fullDate.toDateString())
        .map((event) => ({
          id: eventOverlapKey(event.id),
          startMs: event.startMs,
          endMs: event.endMs,
        }))
      for (const [id, pos] of getOverlapLayout([...towItems, ...eventItems])) {
        layout.set(id, pos)
      }
    }

    return layout
  }, [filteredTows, filteredEvents, now, weekDays])

  const dayOverlapLayout = useMemo(() => {
    const towItems = dayFilteredTows.flatMap((tow) => {
      const segment = computeDaySegmentForTow(tow, selectedDate, now)
      if (!segment) return []
      return [{ id: tow.id, startMs: segment.startMs, endMs: segment.endMs }]
    })
    const eventItems = dayFilteredEvents.map((event) => ({
      id: eventOverlapKey(event.id),
      startMs: event.startMs,
      endMs: event.endMs,
    }))
    return getOverlapLayout([...towItems, ...eventItems])
  }, [dayFilteredTows, dayFilteredEvents, now, selectedDate])

  const getEventWeekPosition = (event: EventCalendarItem) => {
    const eventDate = new Date(event.startMs)
    const dayIndex = weekDays.findIndex(
      (d) => d.fullDate.toDateString() === eventDate.toDateString()
    )
    const hour = eventDate.getHours() + eventDate.getMinutes() / 60
    return { dayIndex, hour }
  }

  // קבלת מידע מהגרירה
  const getRoute = (tow: TowWithDetails) => {
    if (tow.legs && tow.legs.length > 0) {
      const firstLeg = tow.legs.find(l => l.from_address)
      const lastLeg = [...tow.legs].reverse().find(l => l.to_address)
      return {
        from: firstLeg?.from_address?.split(',')[0] || '-',
        to: lastLeg?.to_address?.split(',')[0] || '-'
      }
    }
    return { from: '-', to: '-' }
  }

  // מסלול מלא (כתובות מלאות) לבועות היומן — null כשאין כתובות
  const getFullRoute = (tow: TowWithDetails): { from: string; to: string } | null => {
    if (!tow.legs || tow.legs.length === 0) return null
    const from = tow.legs.find(l => l.from_address)?.from_address?.trim()
    const to = [...tow.legs].reverse().find(l => l.to_address)?.to_address?.trim()
    if (!from && !to) return null
    return { from: from || '-', to: to || '-' }
  }

  const goToToday = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day
    const weekStart = new Date(today)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)
    setCurrentWeekStart(weekStart)
    setMobileDayIndex(today.getDay()) // היום הנוכחי בשבוע
    
    const todayClean = new Date()
    todayClean.setHours(0, 0, 0, 0)
    setSelectedDate(todayClean)
  }

  const getMonthYear = (d: Date = currentWeekStart) => {
    return `${HEBREW_MONTHS[d.getMonth()]} ${d.getFullYear()}`
  }

  const getWeekTitleLabel = () => {
    const weekStart = currentWeekStart
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    if (
      weekStart.getMonth() === weekEnd.getMonth() &&
      weekStart.getFullYear() === weekEnd.getFullYear()
    ) {
      return getMonthYear(weekStart)
    }

    if (weekStart.getFullYear() !== weekEnd.getFullYear()) {
      return `${HEBREW_MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()} – ${HEBREW_MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
    }

    return `${HEBREW_MONTHS[weekStart.getMonth()]} – ${HEBREW_MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
  }

  const getCurrentTime = () => {
    const now = new Date()
    return now.getHours() + now.getMinutes() / 60
  }

  useEffect(() => {
    if (loading) return
    const container = scrollContainerRef.current
    if (!container) return
    const hourHeight = view === 'week' ? PIXELS_PER_HOUR_WEEK : PIXELS_PER_HOUR_DAY
    const currentTimePosition = getCurrentTime() * hourHeight
    // Position current time roughly in the top third of the visible area
    container.scrollTop = Math.max(0, currentTimePosition - container.clientHeight / 3)
  }, [view, loading])

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, tow: TowWithDetails) => {
    setDraggedTow(tow)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tow.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, dayIndex: number, hour: number, driverId?: string) => {
    e.preventDefault()
    if (!draggedTow || !companyId) return


    const targetDate = view === 'week' ? weekDays[dayIndex].fullDate : selectedDate
    const newDate = new Date(targetDate)
    newDate.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0)

    try {
      // עדכון הזמן
      await updateTowSchedule(draggedTow.id, newDate, driverId)
      
      // עדכון מקומי
      setTows(tows.map(t => 
        t.id === draggedTow.id 
          ? { 
              ...t, 
              scheduled_at: newDate.toISOString(),
              driver_id: driverId || t.driver_id
            }
          : t
      ))

      // בדיקה אם יש פירוט מחיר - אם כן, נחשב מחדש
      // בדיקת מצב המחיר
      const priceMode = draggedTow.price_mode || 'recommended'
      
      if (priceMode === 'recommended' && draggedTow.price_breakdown) {
        // מחיר מומלץ - מחשבים מחדש
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
            priceMode: priceMode
          })
          setManualPrice('')
          setShowPriceUpdateModal(true)
        }
      } else if (priceMode !== 'recommended') {
        // מחיר ידני/קבוע/לקוח - רק מתריעים
        setPriceUpdateInfo({
          towId: draggedTow.id,
          oldPrice: draggedTow.final_price || 0,
          newPrice: null,
          newBreakdown: null,
          customerName: draggedTow.customer?.name || 'ללא לקוח',
          priceMode: priceMode
        })
        setManualPrice(String(draggedTow.final_price || ''))
        setShowPriceUpdateModal(true)
      }
    } catch (error) {
      console.error('Error updating tow schedule:', error)
    }
    
    setDraggedTow(null)
  }

  const handleConfirmPriceUpdate = async () => {
  if (!priceUpdateInfo) return
  
  setUpdatingPrice(true)
  try {
    await updateTow({
      towId: priceUpdateInfo.towId,
      finalPrice: priceUpdateInfo.newPrice,
      priceBreakdown: priceUpdateInfo.newBreakdown
    })
    
    // עדכון מקומי
    setTows(tows.map(t => 
      t.id === priceUpdateInfo.towId 
        ? { ...t, final_price: priceUpdateInfo.newPrice, price_breakdown: priceUpdateInfo.newBreakdown }
        : t
    ))
    
    setShowPriceUpdateModal(false)
    setPriceUpdateInfo(null)
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
    await updateTow({
      towId: priceUpdateInfo.towId,
      finalPrice: parseFloat(manualPrice),
      priceBreakdown: null // מנקים את ה-breakdown כי זה מחיר ידני
    })
    
    // עדכון ה-state המקומי
    setTows(prev => prev.map(t => 
      t.id === priceUpdateInfo.towId 
        ? { ...t, final_price: parseFloat(manualPrice), price_breakdown: null }
        : t
    ))
    
    setShowPriceUpdateModal(false)
    setPriceUpdateInfo(null)
    setManualPrice('')
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

  // פתיחת מודל בחירת נהג למשבצת ריקה
  const handleSlotClick = (date: Date, hour: number) => {
    const slotDate = new Date(date)
    slotDate.setHours(hour, 0, 0, 0)
    setPendingSlot({ date: slotDate, hour })
    setTowToAssign(null)
    setSelectedAssignDriverId(null)
    setSelectedAssignTruckId(null)
    setShowDriverModal(true)
  }

  // פתיחת מודל לשיבוץ נהג לגרירה קיימת
  const handleAssignDriver = (tow: TowWithDetails) => {
    setTowToAssign(tow)
    setPendingSlot(null)
    setSelectedAssignDriverId(null)
    setSelectedAssignTruckId(null)
    setShowDriverModal(true)
  }

  // בחירת נהג - מעביר לטופס או עובר לשלב בחירת משאית
  const handleDriverSelect = (driverId: string) => {
    if (pendingSlot) {
      const year = pendingSlot.date.getFullYear()
      const month = (pendingSlot.date.getMonth() + 1).toString().padStart(2, '0')
      const day = pendingSlot.date.getDate().toString().padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      const timeStr = `${pendingSlot.hour.toString().padStart(2, '0')}:00`
      persistCalendarViewBeforeCreate()
      window.location.href = `/dashboard/tows/new?date=${dateStr}&time=${timeStr}&driver=${driverId}`
    } else if (towToAssign) {
      const driverTrucks = getDriverTrucks(driverId)
      setSelectedAssignDriverId(driverId)
      setSelectedAssignTruckId(driverTrucks.length === 1 ? driverTrucks[0].id : null)
    }
  }

  const handleConfirmTowAssign = async () => {
    if (!towToAssign || !selectedAssignDriverId || !selectedAssignTruckId) return
    setAssigningTow(true)
    try {
      await updateTowSchedule(
        towToAssign.id,
        new Date(towToAssign.scheduled_at || towToAssign.created_at),
        selectedAssignDriverId,
        selectedAssignTruckId
      )
      setTows(tows.map(t =>
        t.id === towToAssign.id
          ? { ...t, driver_id: selectedAssignDriverId, truck_id: selectedAssignTruckId }
          : t
      ))
      closeDriverModal()
    } catch (error) {
      console.error('Error assigning driver:', error)
    } finally {
      setAssigningTow(false)
    }
  }

  // סגירת מודל בחירת נהג
  const closeDriverModal = () => {
    setShowDriverModal(false)
    setPendingSlot(null)
    setTowToAssign(null)
    setSelectedAssignDriverId(null)
    setSelectedAssignTruckId(null)
  }

  // בחירת יום לתצוגה יומית
  const selectDay = (date: Date) => {
    selectCalendarDay(date)
    setView('day')
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="animate-spin" size={20} />
          <span>טוען...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-4">
        {/* Top Row - Title and Navigation */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">יומן גרירות</h1>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDriverPanelOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Users size={18} />
              נהגים
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="רענן"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            
            <Link
              href="/dashboard/tows/new"
              onClick={persistCalendarViewBeforeCreate}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#33d4ff] text-white rounded-xl text-sm font-medium hover:bg-[#21b8e6]"
            >
              <Plus size={18} />
              גרירה חדשה
            </Link>
          </div>
        </div>

        {/* Global tow search */}
        <div ref={globalSearchWrapRef} className="relative w-full max-w-xl">
          <Search
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          {globalSearchInput && (
            <button
              type="button"
              onClick={clearGlobalSearch}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              aria-label="נקה חיפוש"
            >
              <X size={16} />
            </button>
          )}
          <input
            type="search"
            value={globalSearchInput}
            onChange={(e) => {
              setGlobalSearchInput(e.target.value)
              setGlobalSearchOpen(true)
            }}
            onFocus={() => setGlobalSearchOpen(true)}
            placeholder="חיפוש גרירה..."
            className={`w-full py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40 focus:border-[#33d4ff] pr-10 ${
              globalSearchInput ? 'pl-10' : 'pl-4'
            }`}
            autoComplete="off"
          />
          {globalSearchOpen && globalSearchInput.trim().length >= 2 && (
            <div className="absolute z-50 right-0 left-0 top-full mt-1 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
              {globalSearchLoading && (
                <p className="px-4 py-3 text-sm text-gray-500 text-center">מחפש...</p>
              )}
              {!globalSearchLoading && globalSearchError && (
                <p className="px-4 py-3 text-sm text-red-600 text-center">{globalSearchError}</p>
              )}
              {!globalSearchLoading && !globalSearchError && globalSearchResults.length === 0 && debouncedGlobalSearch.length >= 2 && (
                <p className="px-4 py-3 text-sm text-gray-500 text-center">לא נמצאו גרירות</p>
              )}
              {!globalSearchLoading &&
                !globalSearchError &&
                globalSearchResults.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleGlobalSearchResultClick(hit)}
                    className="w-full px-4 py-3 text-right hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {hit.customer_name || 'ללא לקוח'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {hit.scheduled_date.toLocaleDateString('he-IL', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'numeric',
                            year: 'numeric',
                          })}
                          {' · '}
                          {hit.time_range_label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {hit.plate ? `לוחית ${hit.plate}` : 'ללא לוחית'}
                          {' · '}
                          {hit.driver_name || 'לא משויך'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Navigation Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Desktop: week navigation */}
            <button 
              onClick={() => navigateWeek('prev')}
              className="hidden sm:block p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
            
            {/* Mobile: day navigation */}
            <button 
              onClick={() => navigateMobileDay('prev')}
              className="sm:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
            
            {/* Desktop: month/year, Mobile: day name and date */}
            <span className="hidden sm:block text-base sm:text-lg font-medium text-gray-700 min-w-[120px] text-center">
              {getWeekTitleLabel()}
            </span>
            <span className="sm:hidden text-base font-medium text-gray-700 min-w-[100px] text-center">
              {weekDays[mobileDayIndex]?.day}{' '}
              {weekDays[mobileDayIndex]?.date}/
              {(weekDays[mobileDayIndex]?.fullDate.getMonth() ?? 0) + 1}
            </span>
            
            {/* Desktop: week navigation */}
            <button 
              onClick={() => navigateWeek('next')}
              className="hidden sm:block p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            
            {/* Mobile: day navigation */}
            <button 
              onClick={() => navigateMobileDay('next')}
              className="sm:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            
            <button 
              onClick={goToToday}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
            >
              היום
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('day')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                view === 'day' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'
              }`}
            >
              יום
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                view === 'week' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'
              }`}
            >
              שבוע
            </button>
          </div>
        </div>
        
        {/* Mobile Add Button */}
        <Link
          href="/dashboard/tows/new"
          onClick={persistCalendarViewBeforeCreate}
          className="sm:hidden flex items-center justify-center gap-2 px-4 py-3 bg-[#33d4ff] text-white rounded-xl font-medium w-full"
        >
          <Plus size={20} />
          גרירה חדשה
        </Link>
      </div>

      <div className="flex flex-row-reverse gap-4 items-start">
        <aside className="w-60 shrink-0 hidden lg:block sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DriverFilterPanel {...driverFilterPanelProps} />
        </aside>

        <div className="flex-1 min-w-0">
      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Week View */}
        {view === 'week' && (
          <div>
            {/* Days Header - Desktop only */}
            {!isMobile && (
              <div className="grid grid-cols-8 border-b border-gray-200 sticky top-0 bg-white z-20">
                <div className="p-2 sm:p-3 text-center text-sm text-gray-500 border-l border-gray-200">
                  <Clock size={16} className="mx-auto" />
                </div>
                {displayedDays.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectDay(day.fullDate)}
                    className={`p-2 sm:p-3 text-center border-l border-gray-200 hover:bg-gray-50 transition-colors ${
                      day.isToday ? 'bg-[#33d4ff]/10' : ''
                    }`}
                  >
                    <p className="text-xs sm:text-sm text-gray-500">{day.day}</p>
                    <p className={`text-lg sm:text-xl font-bold ${day.isToday ? 'text-[#33d4ff]' : 'text-gray-800'}`}>
                      {day.date}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Time Grid */}
            <div
              ref={scrollContainerRef}
              className="relative overflow-y-auto"
              style={calendarScrollViewportStyle(WEEK_VIEWPORT_MIN_HEIGHT)}
            >
              {hours.map((hour) => (
                <div key={hour} className={`grid border-b border-gray-100 ${isMobile ? 'grid-cols-2' : 'grid-cols-8'}`} style={{ height: `${PIXELS_PER_HOUR_WEEK}px` }}>
                  <div className="p-1 sm:p-2 text-xs sm:text-sm text-gray-400 text-center border-l border-gray-200 flex items-start justify-center">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  {displayedDays.map((day, dayIdx) => {
                    return (
                      <div
                        key={dayIdx}
                        onClick={() => handleSlotClick(day.fullDate, hour)}
                        className={`border-l border-gray-100 hover:bg-[#33d4ff]/5 cursor-pointer transition-colors relative group ${
                          day.isToday ? 'bg-[#33d4ff]/5' : ''
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, day.dayIndex, hour)}
                      >
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-6 h-6 bg-[#33d4ff] rounded-full flex items-center justify-center shadow-lg">
                            <Plus size={14} className="text-white" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* Tow Events */}
              <div className={`absolute top-0 left-0 bottom-0 pointer-events-none ${isMobile ? 'right-[50%]' : 'right-[12.5%]'}`}>
                {displayedDays.flatMap((day, displayIndex) =>
                  filteredTows.map((tow) => {
                    const segment = computeDaySegmentForTow(tow, day.fullDate, now)
                    if (!segment) return null

                    const segmentKey = towSegmentOverlapKey(tow.id, day.fullDate)
                    const { top, heightPx } = segmentToCalendarBlockPixels(
                      segment,
                      PIXELS_PER_HOUR_WEEK,
                      'week',
                    )
                    const numDays = isMobile ? 1 : 7
                    const dayWidth = 100 / numDays
                    const overlap = weekOverlapLayout.get(segmentKey) || {
                      columnIndex: 0,
                      totalColumns: 1,
                      span: 1,
                    }
                    const { offsetPct, widthPct } = getOverlapBlockWidthPct(overlap, dayWidth)
                    const right = displayIndex * dayWidth + offsetPct
                    const driverColor = tow.driver_id ? getDriverColor(tow.driver_id) : '#6b7280'
                    const isPlainCancelled = tow.status === 'cancelled'
                    const towName = tow.customer?.name || 'ללא לקוח'
                    const route = getFullRoute(tow)
                    const bubbleTitle = route
                      ? `${towName} | ${route.from} ← ${route.to}`
                      : towName

                    return (
                      <div
                        key={segmentKey}
                        draggable={!isMobile}
                        onDragStart={(e) => handleDragStart(e, tow)}
                        onClick={(e) => {
                          e.stopPropagation()
                          setTowActionMenu(tow)
                        }}
                        title={bubbleTitle}
                        className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing rounded-lg p-1 sm:p-2 text-xs text-white overflow-hidden shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all border-r-4 ${
                          draggedTow?.id === tow.id ? 'opacity-50' : isPlainCancelled ? 'opacity-60' : ''
                        } ${!tow.driver_id ? 'animate-pulse ring-2 ring-white ring-offset-1' : ''}`}
                        style={{
                          top: `${top}px`,
                          height: `${heightPx}px`,
                          right: `${right + 0.3}%`,
                          width: `${Math.max(widthPct - 0.6, 0)}%`,
                          backgroundColor: getTowCalendarBackgroundColor(tow.status, driverColor),
                          borderRightColor: getTowCalendarBackgroundColor(tow.status, driverColor),
                        }}
                      >
                        <TowBlockClipIndicators
                          isTopClipped={segment.isTopClipped}
                          isBottomClipped={segment.isBottomClipped}
                          size="sm"
                        />
                        <TowBlockStatusBadge status={tow.status} />
                        {tow.status === 'quote' && (
                          <div className="absolute top-0 left-0 bg-amber-400 text-white text-[8px] px-1 rounded-br font-bold">
                            הצעה
                          </div>
                        )}
                        {!tow.driver_id && tow.status !== 'quote' && (
                          <div className="absolute top-0 left-0 bg-white text-gray-600 text-[8px] px-1 rounded-br font-bold">
                            לשיבוץ
                          </div>
                        )}
                        <div className="absolute top-0.5 left-1 text-[8px] sm:text-[9px] opacity-90 font-medium truncate max-w-[70%] pointer-events-none">
                          {formatTowTimeRange(segment.towStartMs, segment.towEndMs)}
                        </div>
                        <div className={`pt-2.5 min-w-0 ${isPlainCancelled ? 'line-through decoration-white/70' : ''}`}>
                          <div className="font-bold truncate leading-tight text-[10px] sm:text-xs">
                            {towName}
                          </div>
                          {route && heightPx >= 32 && (
                            <div className="text-[9px] sm:text-[10px] opacity-90 truncate leading-tight min-w-0">
                              {route.from} ← {route.to}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }),
                )}

                {filteredEvents.map((event) => {
                  const { dayIndex, hour } = getEventWeekPosition(event)
                  const displayIndex = displayedDays.findIndex((d) => d.dayIndex === dayIndex)
                  if (displayIndex === -1) return null

                  const { startMs, endMs } = event
                  const top = hour * PIXELS_PER_HOUR_WEEK
                  const elapsedMinutes = (endMs - startMs) / 60000
                  const heightPx = (elapsedMinutes / 60) * PIXELS_PER_HOUR_WEEK
                  const numDays = isMobile ? 1 : 7
                  const dayWidth = 100 / numDays
                  const overlap = weekOverlapLayout.get(eventOverlapKey(event.id)) || {
                    columnIndex: 0,
                    totalColumns: 1,
                    span: 1,
                  }
                  const { offsetPct, widthPct } = getOverlapBlockWidthPct(overlap, dayWidth)
                  const right = displayIndex * dayWidth + offsetPct
                  const driverColor = event.driverId ? getDriverColor(event.driverId) : '#6b7280'

                  return (
                    <div
                      key={eventOverlapKey(event.id)}
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/dashboard/events/${event.id}`)
                      }}
                      className="absolute pointer-events-auto cursor-pointer rounded-lg p-1 sm:p-2 text-xs text-white overflow-hidden shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all border-r-4 ring-2 ring-cyan-300 ring-offset-1"
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(heightPx - 4, 20)}px`,
                        right: `${right + 0.3}%`,
                        width: `${Math.max(widthPct - 0.6, 0)}%`,
                        backgroundColor: driverColor,
                        borderRightColor: '#22d3ee',
                      }}
                    >
                      <div className="absolute top-0 left-0 flex items-center gap-0.5 bg-cyan-400 text-white text-[8px] px-1 rounded-br font-bold">
                        <Sparkles size={8} />
                        אירוע
                      </div>
                      <div className="absolute top-0.5 left-1 text-[8px] sm:text-[9px] opacity-90 font-medium truncate max-w-[70%] pointer-events-none pt-3">
                        {formatTowTimeRange(startMs, endMs)}
                      </div>
                      <div className="pt-3 min-w-0">
                        <div className="font-bold truncate text-[10px] sm:text-xs">
                          {event.label}
                        </div>
                      </div>
                    </div>
                  )
                })}
                </div>

                {/* Current Time Line */}
                {weekDays.some(d => d.isToday) && (
                  <div
                    className="absolute right-0 left-0 border-t-2 border-red-500 z-10 pointer-events-none"
                    style={{ top: `${getCurrentTime() * PIXELS_PER_HOUR_WEEK}px` }}
                  >
                    <div className="absolute right-0 w-3 h-3 bg-red-500 rounded-full -mt-1.5 -mr-1.5"></div>
                  </div>
                )}
              </div>
          </div>
        )}

        {/* Day View */}
        {view === 'day' && (
          <div>
            {/* Day Header */}
            <div className="p-4 border-b border-gray-200 bg-[#33d4ff]/10">
              <div className="flex items-center justify-center gap-4">
                <button 
                  onClick={() => {
                    const newDate = new Date(selectedDate)
                    newDate.setDate(newDate.getDate() - 1)
                    selectCalendarDay(newDate)
                  }}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <ChevronRight size={24} className="text-gray-600" />
                </button>
                
                <div className="text-center">
                  <span className="text-base sm:text-lg text-gray-600">
                    {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][selectedDate.getDay()]},{' '}
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-[#33d4ff]">
                    {selectedDate.getDate()} ב{getMonthYear(selectedDate)}
                  </span>
                </div>
                
                <button 
                  onClick={() => {
                    const newDate = new Date(selectedDate)
                    newDate.setDate(newDate.getDate() + 1)
                    selectCalendarDay(newDate)
                  }}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <ChevronLeft size={24} className="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Time Grid for Day View */}
            <div
              ref={scrollContainerRef}
              className="relative overflow-y-auto"
              style={calendarScrollViewportStyle(DAY_VIEWPORT_MIN_HEIGHT)}
            >
              <div className="flex min-w-0">
                <div className="w-16 sm:w-20 flex-shrink-0 border-l border-gray-200">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="p-2 text-sm text-gray-400 text-center border-b border-gray-100"
                      style={{ height: `${PIXELS_PER_HOUR_DAY}px` }}
                    >
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                <div
                  ref={dayLayoutRef}
                  className="flex-1 relative border-l border-gray-200"
                  style={{ height: `${hours.length * PIXELS_PER_HOUR_DAY}px` }}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      onClick={() => handleSlotClick(selectedDate, hour)}
                      className="group border-b border-gray-100 hover:bg-[#33d4ff]/5 cursor-pointer transition-colors relative"
                      style={{ height: `${PIXELS_PER_HOUR_DAY}px` }}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 0, hour)}
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="w-7 h-7 bg-[#33d4ff] rounded-full flex items-center justify-center shadow-lg">
                          <Plus size={16} className="text-white" />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="absolute inset-0 pointer-events-none">
                    {dayFilteredTows.map((tow) => {
                      const segment = computeDaySegmentForTow(tow, selectedDate, now)
                      if (!segment) return null

                      const pos = dayOverlapLayout.get(tow.id) || {
                        columnIndex: 0,
                        totalColumns: 1,
                        span: 1,
                      }
                      const { offsetPct, widthPct } = getOverlapBlockWidthPct(pos, 100)
                      const { top, heightPx } = segmentToCalendarBlockPixels(
                        segment,
                        PIXELS_PER_HOUR_DAY,
                        'day',
                      )
                      const driverColor = tow.driver_id ? getDriverColor(tow.driver_id) : '#6b7280'
                      const isPlainCancelled = tow.status === 'cancelled'
                      const towName = tow.customer?.name || 'ללא לקוח'
                      const route = getFullRoute(tow)
                      const bubbleTitle = route
                        ? `${towName} | ${route.from} ← ${route.to}`
                        : towName

                      return (
                        <div
                          key={tow.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, tow)}
                          onClick={(e) => {
                            e.stopPropagation()
                            setTowActionMenu(tow)
                          }}
                          title={bubbleTitle}
                          className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing rounded-lg p-2 sm:p-3 text-white overflow-hidden shadow-md hover:shadow-lg transition-all border-r-4 ${
                            draggedTow?.id === tow.id ? 'opacity-50' : isPlainCancelled ? 'opacity-60' : ''
                          } ${!tow.driver_id ? 'animate-pulse ring-2 ring-white ring-offset-1' : ''}`}
                          style={{
                            top: `${top}px`,
                            height: `${heightPx}px`,
                            left: `calc(${offsetPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            backgroundColor: getTowCalendarBackgroundColor(tow.status, driverColor),
                            borderRightColor: getTowCalendarBackgroundColor(tow.status, driverColor),
                          }}
                        >
                          <TowBlockClipIndicators
                            isTopClipped={segment.isTopClipped}
                            isBottomClipped={segment.isBottomClipped}
                            size="md"
                          />
                          <TowBlockStatusBadge status={tow.status} size="md" />
                          {tow.status === 'quote' && (
                            <div className="absolute top-0 left-0 bg-amber-400 text-white text-[10px] px-1.5 py-0.5 rounded-br font-bold">
                              הצעה
                            </div>
                          )}
                          {!tow.driver_id && tow.status !== 'quote' && (
                            <div className="absolute top-0 left-0 bg-white text-gray-600 text-[10px] px-1.5 py-0.5 rounded-br font-bold">
                              לשיבוץ
                            </div>
                          )}
                          <div className="absolute top-1 left-2 text-[10px] opacity-90 font-medium truncate max-w-[70%] pointer-events-none">
                            {formatTowTimeRange(segment.towStartMs, segment.towEndMs)}
                          </div>
                          <div className={`pt-4 min-w-0 ${isPlainCancelled ? 'line-through decoration-white/70' : ''}`}>
                            <div className="font-bold truncate leading-tight text-sm">
                              {towName}
                            </div>
                            {route && heightPx >= 40 && (
                              <div className="text-[9px] sm:text-[10px] opacity-90 truncate leading-tight min-w-0">
                                {route.from} ← {route.to}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {dayFilteredEvents.map((event) => {
                      const pos = dayOverlapLayout.get(eventOverlapKey(event.id)) || {
                        columnIndex: 0,
                        totalColumns: 1,
                        span: 1,
                      }
                      const { offsetPct, widthPct } = getOverlapBlockWidthPct(pos, 100)
                      const eventDate = new Date(event.startMs)
                      const hour =
                        eventDate.getHours() + eventDate.getMinutes() / 60
                      const top = hour * PIXELS_PER_HOUR_DAY
                      const driverColor = event.driverId ? getDriverColor(event.driverId) : '#6b7280'
                      const { startMs, endMs } = event
                      const elapsedMinutes = (endMs - startMs) / 60000
                      const heightPx = (elapsedMinutes / 60) * PIXELS_PER_HOUR_DAY

                      return (
                        <div
                          key={eventOverlapKey(event.id)}
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/dashboard/events/${event.id}`)
                          }}
                          className="absolute pointer-events-auto cursor-pointer rounded-lg p-2 sm:p-3 text-white overflow-hidden shadow-md hover:shadow-lg transition-all border-r-4 ring-2 ring-cyan-300 ring-offset-1"
                          style={{
                            top: `${top}px`,
                            height: `${heightPx}px`,
                            left: `calc(${offsetPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            backgroundColor: driverColor,
                            borderRightColor: '#22d3ee',
                          }}
                        >
                          <div className="absolute top-0 left-0 flex items-center gap-0.5 bg-cyan-400 text-white text-[10px] px-1.5 py-0.5 rounded-br font-bold">
                            <Sparkles size={10} />
                            אירוע
                          </div>
                          <div className="absolute top-1 left-2 text-[10px] opacity-90 font-medium truncate max-w-[70%] pointer-events-none pt-4">
                            {formatTowTimeRange(startMs, endMs)}
                          </div>
                          <div className="pt-4 min-w-0">
                            <div className="font-bold truncate text-sm">{event.label}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {selectedDate.toDateString() === new Date().toDateString() && (
                    <div
                      className="absolute right-0 left-0 border-t-2 border-red-500 z-10 pointer-events-none"
                      style={{ top: `${getCurrentTime() * PIXELS_PER_HOUR_DAY}px` }}
                    >
                      <div className="absolute right-0 w-3 h-3 bg-red-500 rounded-full -mt-1.5 -mr-1.5"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {tows.length === 0 && events.length === 0 && !loading && (
        <div className="mt-6 text-center py-12 bg-white rounded-xl border border-gray-200">
          <Truck size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">אין גרירות מתוזמנות לשבוע זה</p>
          <Link
            href="/dashboard/tows/new"
            onClick={persistCalendarViewBeforeCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#33d4ff] text-white rounded-xl text-sm font-medium hover:bg-[#21b8e6]"
          >
            <Plus size={18} />
            צור גרירה חדשה
          </Link>
        </div>
      )}

        </div>
      </div>

      {/* Mobile driver filter drawer */}
      {driverPanelOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setDriverPanelOpen(false)}
            aria-hidden
          />
          <aside className="fixed top-0 right-0 h-full w-72 max-w-[85vw] z-50 lg:hidden overflow-y-auto">
            <DriverFilterPanel
              {...driverFilterPanelProps}
              onClose={() => setDriverPanelOpen(false)}
              className="min-h-full rounded-none border-0 shadow-none"
            />
          </aside>
        </>
      )}

      {/* Instructions - Hidden on mobile */}
      <div className="mt-4 hidden sm:grid sm:grid-cols-3 gap-3 text-sm">
        <div className="p-3 bg-[#33d4ff]/10 border border-[#33d4ff]/30 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 bg-[#33d4ff] rounded-full flex items-center justify-center flex-shrink-0">
            <Plus size={16} className="text-white" />
          </div>
          <p className="text-gray-700"><strong>הוספה:</strong> לחץ על משבצת</p>
        </div>
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
            <GripVertical size={16} className="text-white" />
          </div>
          <p className="text-gray-700"><strong>הזזה:</strong> גרור לשעה אחרת</p>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Calendar size={16} className="text-white" />
          </div>
          <p className="text-gray-700"><strong>יום:</strong> לחץ על תאריך</p>
        </div>
      </div>

      {/* Search result details popover */}
      {searchHitPopover && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSearchHitPopover(null)}
        >
          <div
            className="bg-white w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-xl"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#33d4ff] text-white flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="font-bold text-lg truncate">
                  {searchHitPopover.customer_name || 'ללא לקוח'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSearchHitPopover(null)}
                className="p-2 hover:bg-white/20 rounded-lg shrink-0"
                aria-label="סגור"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-3">
              <TowDetailRow label="לקוח">
                <span className="font-medium">{searchHitPopover.customer_name || 'ללא לקוח'}</span>
              </TowDetailRow>
              <TowDetailRow label="תאריך ושעה">
                <span className="font-medium">
                  {searchHitPopover.scheduled_date.toLocaleDateString('he-IL', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {' · '}
                  <span dir="ltr">{searchHitPopover.time_range_label}</span>
                </span>
              </TowDetailRow>
              {(searchHitPopover.customer_order_number || searchHitPopover.order_number) && (
                <TowDetailRow label="מס' הזמנה">
                  <span className="font-medium" dir="ltr">
                    {searchHitPopover.customer_order_number || searchHitPopover.order_number}
                  </span>
                </TowDetailRow>
              )}
              {searchHitPopover.pickup_address && (
                <TowDetailRow label="מוצא">
                  <span className="font-medium">{searchHitPopover.pickup_address}</span>
                </TowDetailRow>
              )}
              {searchHitPopover.dropoff_address && (
                <TowDetailRow label="יעד">
                  <span className="font-medium">{searchHitPopover.dropoff_address}</span>
                </TowDetailRow>
              )}
              <TowDetailRow label="לוחית">
                <span className="font-mono font-medium">{searchHitPopover.plate || '—'}</span>
              </TowDetailRow>
              <TowDetailRow label="נהג">
                <span className="font-medium">{searchHitPopover.driver_name || 'לא משויך'}</span>
              </TowDetailRow>
              <TowDetailRow label="סטטוס">
                <div className="flex items-center gap-2">
                  <TowModalStatusIcon status={searchHitPopover.status} />
                  <span className="font-medium">
                    {statusLabels[searchHitPopover.status] || searchHitPopover.status}
                  </span>
                </div>
              </TowDetailRow>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setSearchHitPopover(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
              >
                סגור
              </button>
              <button
                type="button"
                onClick={() => {
                  const hit = searchHitPopover
                  setSearchHitPopover(null)
                  router.push(`/dashboard/tows/${hit.id}`)
                }}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6]"
              >
                כניסה לגרירה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tow action menu */}
      {towActionMenu && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setTowActionMenu(null)}
        >
          <div
            className="bg-white w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-xl"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#33d4ff] text-white flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="font-bold text-lg truncate">
                  {towActionMenu.customer?.name || 'ללא לקוח'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTowActionMenu(null)}
                className="p-2 hover:bg-white/20 rounded-lg shrink-0"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  const tow = towActionMenu
                  setTowActionMenu(null)
                  handleAssignDriver(tow)
                }}
                className="w-full py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6]"
              >
                שיבוץ
              </button>
              <button
                type="button"
                onClick={() => {
                  const tow = towActionMenu
                  setTowActionMenu(null)
                  router.push(`/dashboard/tows/${tow.id}`)
                }}
                className="w-full py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
              >
                פתיחת הגרירה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tow Detail Modal */}
      {selectedTow && (() => {
        const tow = selectedTow
        const route = getRoute(tow)
        const cellDay = new Date(getEffectiveTowStartIso(tow))
        const { startMs, endMs } = getTowTimeBounds(tow, now, { clampEndToDay: cellDay })
        const vehiclePlates =
          tow.vehicles?.map((v) => v.plate_number).filter(Boolean).join(' · ') || '-'
        const driverColor = tow.driver_id ? getDriverColor(tow.driver_id) : '#6b7280'

        return (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div
            className="bg-white w-full sm:rounded-2xl sm:mx-4 overflow-hidden rounded-t-2xl max-h-[80vh] overflow-y-auto"
            style={{ maxWidth: '380px' }}
            dir="rtl"
          >
            <div
              className="px-5 py-4 text-white flex items-center justify-between sticky top-0"
              style={{ backgroundColor: driverColor }}
            >
              <div className="min-w-0">
                <h2 className="font-bold text-lg truncate">{tow.customer?.name || 'ללא לקוח'}</h2>
                <p className="text-white/80 text-sm truncate">
                  {tow.driver_id ? getDriverName(tow.driver_id) : 'לא שובץ נהג'}
                </p>
              </div>
              <button onClick={() => setSelectedTow(null)} className="p-2 hover:bg-white/20 rounded-lg shrink-0">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-3">
              <TowDetailRow label="לקוח">
                <span className="font-medium">{tow.customer?.name || 'ללא לקוח'}</span>
              </TowDetailRow>

              <TowDetailRow label="טלפון">
                {tow.customer?.phone ? (
                  <a
                    href={`tel:${tow.customer.phone}`}
                    className="text-[#0284c7] hover:underline font-medium"
                    dir="ltr"
                  >
                    {tow.customer.phone}
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </TowDetailRow>

              <TowDetailRow label="מסלול">
                <span className="font-medium">
                  {route.from} → {route.to}
                </span>
              </TowDetailRow>

              <TowDetailRow label="נהג">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {tow.driver_id ? getDriverName(tow.driver_id) : 'לא שובץ'}
                  </span>
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: driverColor }}
                  />
                </div>
              </TowDetailRow>

              <TowDetailRow label="רכבים">
                <span className="font-mono font-medium">{vehiclePlates}</span>
              </TowDetailRow>

              <TowDetailRow label="זמן">
                <span className="font-medium" dir="ltr">
                  {formatTowTimeRange(startMs, endMs)}
                </span>
              </TowDetailRow>

              <TowDetailRow label="סטטוס">
                <div className="flex items-center gap-2">
                  <TowModalStatusIcon status={tow.status} />
                  <span className="font-medium">{statusLabels[tow.status] || tow.status}</span>
                </div>
              </TowDetailRow>

              {tow.final_price != null && (
                <TowDetailRow label="מחיר">
                  <span className="font-medium" dir="ltr">
                    {tow.final_price.toLocaleString('he-IL')} ₪
                  </span>
                </TowDetailRow>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setSelectedTow(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
              >
                סגור
              </button>
              <Link
                href={`/dashboard/tows/${tow.id}`}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] text-center"
              >
                פרטים מלאים
              </Link>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Driver Selection Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md sm:mx-4 overflow-hidden rounded-t-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-5 py-4 bg-[#33d4ff] text-white flex items-center justify-between sticky top-0">
              <div>
                <h2 className="font-bold text-lg">
                  {towToAssign ? 'שיבוץ נהג לגרירה' : 'בחר נהג'}
                </h2>
                <p className="text-white/80 text-sm">
                  {pendingSlot && (
                    <>
                      {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][pendingSlot.date.getDay()]},{' '}
                      {pendingSlot.date.toLocaleDateString('he-IL')} בשעה {pendingSlot.hour.toString().padStart(2, '0')}:00
                    </>
                  )}
                  {towToAssign && (
                    <>
                      {towToAssign.customer?.name || 'ללא לקוח'}
                    </>
                  )}
                </p>
              </div>
              <button onClick={closeDriverModal} className="p-2 hover:bg-white/20 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {towToAssign && selectedAssignDriverId ? (() => {
                const assignDriverTrucks = getDriverTrucks(selectedAssignDriverId)
                const assignTruckOptions =
                  assignDriverTrucks.length > 0
                    ? assignDriverTrucks
                    : trucks.filter((t) => t.is_active)
                return (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssignDriverId(null)
                        setSelectedAssignTruckId(null)
                      }}
                      className="flex items-center gap-2 text-[#33d4ff] text-sm font-medium"
                    >
                      <ArrowRight size={18} />
                      חזור לרשימת נהגים
                    </button>

                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                          <User size={24} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">
                            {drivers.find(d => d.id === selectedAssignDriverId)?.user?.full_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {drivers.find(d => d.id === selectedAssignDriverId)?.user?.phone}
                          </p>
                        </div>
                      </div>
                    </div>

                    {assignDriverTrucks.length === 1 ? (
                      <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600 flex items-center gap-2">
                        <Truck size={16} className="text-gray-400" />
                        {`${getTruckTypeLabel(assignDriverTrucks[0].truck_type)} — ${assignDriverTrucks[0].plate_number}`}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          בחירת משאית
                        </label>
                        <select
                          value={selectedAssignTruckId || ''}
                          onChange={(e) => setSelectedAssignTruckId(e.target.value || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        >
                          <option value="">בחרי משאית...</option>
                          {assignTruckOptions.map((truck) => (
                            <option key={truck.id} value={truck.id}>
                              {truck.plate_number}
                              {(truck.manufacturer || truck.model)
                                ? ` — ${[truck.manufacturer, truck.model].filter(Boolean).join(' ')}`
                                : ` — ${getTruckTypeLabel(truck.truck_type)}`}
                            </option>
                          ))}
                        </select>
                        {assignDriverTrucks.length === 0 && (
                          <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            לנהג זה אין משאית משויכת — בחרי משאית מהרשימה
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })() : drivers.length === 0 ? (
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
                  {/* רשימת נהגים עם מספר גרירות היום */}
                  {drivers.map((driver, index) => {
                    const color = DRIVER_COLORS[index % DRIVER_COLORS.length]
                    const targetDate = pendingSlot?.date || (towToAssign ? new Date(towToAssign.scheduled_at || towToAssign.created_at) : new Date())
                    const driverTowsToday = tows.filter(t => {
                      if (t.driver_id !== driver.id) return false
                      const towDate = new Date(t.scheduled_at || t.created_at)
                      return towDate.toDateString() === targetDate.toDateString()
                    })
                    const towCount = driverTowsToday.length
                    
                    return (
                      <button
                        key={driver.id}
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
                  
                  {/* אפשרות ללא נהג */}
                  {pendingSlot && (
                    <div className="pt-2 border-t border-gray-200 mt-3">
                      <Link
                        href={`/dashboard/tows/new?date=${pendingSlot.date.toISOString().split('T')[0]}&time=${pendingSlot.hour.toString().padStart(2, '0')}:00`}
                        onClick={persistCalendarViewBeforeCreate}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all text-gray-500"
                      >
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <Plus size={20} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium">ללא נהג</p>
                          <p className="text-sm">שיבוץ מאוחר יותר</p>
                        </div>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
              {towToAssign && selectedAssignDriverId ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeDriverModal}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTowAssign}
                    disabled={!selectedAssignTruckId || assigningTow}
                    className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {assigningTow ? 'משבץ...' : 'שבץ נהג'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={closeDriverModal}
                  className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
                >
                  ביטול
                </button>
              )}
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