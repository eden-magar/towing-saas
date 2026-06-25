'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, MapPin, User, Truck, Sparkles, X, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '../../lib/AuthContext'
import { getTows, getTowListStats, searchTowsByField, type TowSearchField, TowWithDetails } from '../../lib/queries/tows'
import { getEvents, type EventListItem } from '../../lib/queries/events'

type LocalYmd = { year: number; month: number; day: number }

function toLocalYmd(date: Date): LocalYmd {
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() }
}

function localYmdFromIso(iso: string): LocalYmd | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return toLocalYmd(d)
}

function localYmdFromDateString(dateStr: string): LocalYmd | null {
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return null
  return { year, month: month - 1, day }
}

function ymdEquals(a: LocalYmd, b: LocalYmd): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

function formatLocalYmdHe(ymd: LocalYmd): string {
  return new Date(ymd.year, ymd.month, ymd.day).toLocaleDateString('he-IL')
}

type ScheduledDateDisplay = {
  label: string
  variant: 'today' | 'tomorrow' | 'future'
}

function getScheduledDateDisplayFromYmd(ymd: LocalYmd): ScheduledDateDisplay {
  const now = new Date()
  const today = toLocalYmd(now)
  const tomorrow = toLocalYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))

  if (ymdEquals(ymd, today)) {
    return { label: 'להיום', variant: 'today' }
  }
  if (ymdEquals(ymd, tomorrow)) {
    return { label: 'למחר', variant: 'tomorrow' }
  }
  return { label: formatLocalYmdHe(ymd), variant: 'future' }
}

function getScheduledDateDisplay(
  scheduledAt: string | null | undefined
): ScheduledDateDisplay | null {
  if (!scheduledAt) return null
  const scheduled = localYmdFromIso(scheduledAt)
  if (!scheduled) return null
  return getScheduledDateDisplayFromYmd(scheduled)
}

function getScheduledDateDisplayForEventDate(
  eventDate: string | null | undefined
): ScheduledDateDisplay | null {
  if (!eventDate) return null
  const ymd = localYmdFromDateString(eventDate)
  if (!ymd) return null
  return getScheduledDateDisplayFromYmd(ymd)
}

function ScheduledDateBadge({
  scheduledAt,
  eventDate,
}: {
  scheduledAt?: string | null
  eventDate?: string | null
}) {
  const display = eventDate != null
    ? getScheduledDateDisplayForEventDate(eventDate)
    : getScheduledDateDisplay(scheduledAt)
  if (!display) return null

  const variantClass =
    display.variant === 'today'
      ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
      : display.variant === 'tomorrow'
        ? 'bg-blue-100 text-blue-800 ring-blue-200'
        : 'bg-gray-100 text-gray-600 ring-gray-200 font-medium'

  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${variantClass}`}
    >
      {display.label}
    </span>
  )
}

const TOWS_FILTER_STORAGE = {
  search: 'towsFilter_search',
  status: 'towsFilter_status',
  kind: 'towsFilter_kind',
} as const

/** Page size for the tows list (initial load + each "load more"). */
const TOWS_PAGE_SIZE = 100

/** "חפש לפי" Phase 1 fields — order, customer, vehicle, date. */
const SEARCH_FIELD_OPTIONS: { id: TowSearchField; label: string; placeholder: string }[] = [
  { id: 'order', label: 'מספר הזמנה', placeholder: "מס' הזמנה / מס' לקוח" },
  { id: 'customer', label: 'לקוח', placeholder: 'שם הלקוח' },
  { id: 'vehicle', label: 'רכב', placeholder: 'מספר רכב' },
  { id: 'driver', label: 'נהג', placeholder: 'שם הנהג' },
  { id: 'address', label: 'כתובת', placeholder: 'עיר / רחוב' },
  { id: 'date', label: 'תאריך', placeholder: '' },
]

const SEARCH_FIELD_LABELS: Record<TowSearchField, string> = {
  order: 'מספר הזמנה',
  customer: 'לקוח',
  vehicle: 'רכב',
  driver: 'נהג',
  address: 'כתובת',
  date: 'תאריך',
}

/** Minimum chars for an address search before we run the query (volume guard). */
const ADDRESS_SEARCH_MIN_LENGTH = 2

/** Matches SEARCH_BY_FIELD_ID_CAP in tows.ts — used only for the "capped" hint copy. */
const SEARCH_BY_FIELD_ID_CAP_LABEL = '1000'

type ListKind = 'all' | 'tows' | 'events'

const LIST_KIND_IDS = new Set<ListKind>(['all', 'tows', 'events'])

const TOWS_FILTER_STATUS_IDS = new Set([
  'all',
  'quote',
  'pending',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
])

function clearTowsFilterSession() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(TOWS_FILTER_STORAGE.search)
  sessionStorage.removeItem(TOWS_FILTER_STORAGE.status)
  sessionStorage.removeItem(TOWS_FILTER_STORAGE.kind)
}

export default function TowsPage() {
  const { companyId } = useAuth()
  const router = useRouter()
  
  const [tows, setTows] = useState<TowWithDetails[]>([])
  const [events, setEvents] = useState<EventListItem[]>([])
  const [towListStats, setTowListStats] = useState({
    total: 0,
    pending: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
  })
  const [pageLoading, setPageLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  
  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window === 'undefined') return ''
    return sessionStorage.getItem(TOWS_FILTER_STORAGE.search) ?? ''
  })
  const [activeStatus, setActiveStatus] = useState(() => {
    if (typeof window === 'undefined') return 'all'
    const saved = sessionStorage.getItem(TOWS_FILTER_STORAGE.status)
    return saved && TOWS_FILTER_STATUS_IDS.has(saved) ? saved : 'all'
  })
  const [listKind, setListKind] = useState<ListKind>(() => {
    if (typeof window === 'undefined') return 'all'
    const saved = sessionStorage.getItem(TOWS_FILTER_STORAGE.kind)
    return saved && LIST_KIND_IDS.has(saved as ListKind) ? (saved as ListKind) : 'all'
  })

  // "חפש לפי" — single-field server search ("results mode")
  const [searchByField, setSearchByField] = useState<TowSearchField>('order')
  const [searchByValue, setSearchByValue] = useState('')
  const [searchResults, setSearchResults] = useState<TowWithDetails[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchOffset, setSearchOffset] = useState(0)
  const [inResultsMode, setInResultsMode] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [loadingMoreResults, setLoadingMoreResults] = useState(false)
  // Inline validation hint (e.g. address min length) shown under the controls.
  const [searchHint, setSearchHint] = useState('')
  // True when the server hit the id-resolution cap → suggest narrowing.
  const [resultsCapped, setResultsCapped] = useState(false)
  // The field+value that produced the current results (frozen at search time so
  // the banner doesn't drift while the user edits the inputs).
  const [resultsQuery, setResultsQuery] = useState<{ field: TowSearchField; value: string } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(TOWS_FILTER_STORAGE.search, searchTerm)
    sessionStorage.setItem(TOWS_FILTER_STORAGE.status, activeStatus)
    sessionStorage.setItem(TOWS_FILTER_STORAGE.kind, listKind)
  }, [searchTerm, activeStatus, listKind])

  const hasActiveFilters =
    searchTerm !== '' || activeStatus !== 'all' || listKind !== 'all'

  const handleClearFilters = () => {
    setSearchTerm('')
    setActiveStatus('all')
    setListKind('all')
    clearTowsFilterSession()
  }

  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId])

  const loadData = async () => {
    if (!companyId) return
    
    setPageLoading(true)
    try {
      // First page: last 90 days, newest 100. Older tows via "load more".
      const [towsData, eventsData, stats] = await Promise.all([
        getTows(companyId, { limit: TOWS_PAGE_SIZE }),
        getEvents(companyId, {}),
        getTowListStats(companyId),
      ])
      setTows(towsData)
      setEvents(eventsData)
      setTowListStats(stats)
    } catch (err) {
      console.error('Error loading tows:', err)
      setError('שגיאה בטעינת הנתונים')
    } finally {
      setPageLoading(false)
    }
  }

  // Load the next page of tows (all history) and APPEND — keeps the page usable.
  const handleLoadMore = async () => {
    if (!companyId || loadingMore) return

    setLoadingMore(true)
    try {
      const more = await getTows(companyId, {
        since: null,
        limit: TOWS_PAGE_SIZE,
        offset: tows.length,
      })
      setTows(prev => [...prev, ...more])
    } catch (err) {
      console.error('Error loading more tows:', err)
      setError('שגיאה בטעינת גרירות נוספות')
    } finally {
      setLoadingMore(false)
    }
  }

  // Run a single-field server search and enter "results mode". The normal list
  // state (tows/filteredTows) is left untouched so clearing needs no refetch.
  const handleRunFieldSearch = async () => {
    if (!companyId || searchLoading) return
    const value = searchByValue.trim()
    if (!value) return

    // Address volume guard: require a minimum length before querying legs.
    if (searchByField === 'address' && value.length < ADDRESS_SEARCH_MIN_LENGTH) {
      setSearchHint(`הזן לפחות ${ADDRESS_SEARCH_MIN_LENGTH} תווים`)
      return
    }
    setSearchHint('')

    setSearchLoading(true)
    try {
      const { rows, total, capped } = await searchTowsByField(companyId, searchByField, value, {
        limit: TOWS_PAGE_SIZE,
        offset: 0,
      })
      setSearchResults(rows)
      setSearchTotal(total)
      setSearchOffset(rows.length)
      setResultsCapped(capped)
      setResultsQuery({ field: searchByField, value })
      setInResultsMode(true)
    } catch (err) {
      console.error('Error searching tows by field:', err)
      setError('שגיאה בחיפוש גרירות')
    } finally {
      setSearchLoading(false)
    }
  }

  // Page additional matches WITHIN the current results set.
  const handleLoadMoreResults = async () => {
    if (!companyId || loadingMoreResults || !resultsQuery) return

    setLoadingMoreResults(true)
    try {
      const { rows, total } = await searchTowsByField(companyId, resultsQuery.field, resultsQuery.value, {
        limit: TOWS_PAGE_SIZE,
        offset: searchOffset,
      })
      setSearchResults(prev => [...prev, ...rows])
      setSearchTotal(total)
      setSearchOffset(prev => prev + rows.length)
    } catch (err) {
      console.error('Error loading more results:', err)
      setError('שגיאה בטעינת תוצאות נוספות')
    } finally {
      setLoadingMoreResults(false)
    }
  }

  // Exit results mode → fall back to the normal paginated list (no refetch).
  const handleClearResults = () => {
    setInResultsMode(false)
    setSearchResults([])
    setSearchTotal(0)
    setSearchOffset(0)
    setResultsQuery(null)
    setSearchByValue('')
    setSearchHint('')
    setResultsCapped(false)
  }

  const statuses = [
    { id: 'all', label: 'הכל' },
    { id: 'quote', label: 'הצעות מחיר' },
    { id: 'pending', label: 'ממתינות' },
    { id: 'assigned', label: 'משויכות' },
    { id: 'in_progress', label: 'בביצוע' },
    { id: 'completed', label: 'הושלמו' },
    { id: 'cancelled', label: 'בוטלו' },
  ]

  const statusConfig: Record<string, { label: string; class: string }> = {
    quote: { label: 'הצעת מחיר', class: 'bg-amber-100 text-amber-700' },
    pending: { label: 'ממתינה', class: 'bg-amber-100 text-amber-700' },
    assigned: { label: 'משויכת', class: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'בביצוע', class: 'bg-purple-100 text-purple-700' },
    completed: { label: 'הושלמה', class: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'בוטלה', class: 'bg-red-100 text-red-700' },
    cancelled_charged: { label: 'בוטל בחיוב', class: 'bg-amber-100 text-amber-800' },
  }

  const filteredTows = tows.filter(tow => {
    // סינון לפי סטטוס
    if (activeStatus !== 'all') {
      if (activeStatus === 'cancelled') {
        if (tow.status !== 'cancelled' && tow.status !== 'cancelled_charged') return false
      } else if (tow.status !== activeStatus) {
        return false
      }
    }
    
    // סינון לפי חיפוש
    if (searchTerm) {
      const query = searchTerm.toLowerCase()
      const vehiclePlate = tow.vehicles[0]?.plate_number?.toLowerCase() || ''
      const customerName = tow.customer?.name?.toLowerCase() || ''
      const driverName = tow.driver?.user?.full_name?.toLowerCase() || ''
      const orderNum = tow.order_number?.toLowerCase() || ''
      const customerOrderNum = tow.customer_order_number?.toLowerCase() || ''
      
      // חיפוש עם # מחפש מספרי הזמנה (אוטומטי או של לקוח)
      if (query.startsWith('#')) {
        const orderQuery = query.slice(1)
        return orderNum.startsWith(orderQuery) || customerOrderNum.startsWith(orderQuery)
      }
      
      if (!vehiclePlate.includes(query) && 
          !customerName.includes(query) && 
          !driverName.includes(query) &&
          !orderNum.startsWith(query) &&
          !customerOrderNum.startsWith(query)) {
        return false
      }
    }
    return true
  })

  const eventStatusConfig: Record<string, { label: string; class: string }> = {
    draft: { label: 'טיוטה', class: 'bg-cyan-50 text-cyan-700' },
    quote: { label: 'הצעת מחיר', class: 'bg-amber-100 text-amber-700' },
    approved: { label: 'אושר', class: 'bg-green-100 text-green-700' },
    cancelled: { label: 'בוטל', class: 'bg-red-100 text-red-700' },
    completed: { label: 'הושלם', class: 'bg-emerald-100 text-emerald-700' },
  }

  const filteredEvents = events.filter((event) => {
    if (!searchTerm) return true

    const query = searchTerm.toLowerCase()
    const customerName = event.customer?.name?.toLowerCase() || ''
    const orderNum = event.order_number?.toLowerCase() || ''

    if (query.startsWith('#')) {
      const orderQuery = query.slice(1)
      return orderNum.startsWith(orderQuery)
    }

    return customerName.includes(query) || orderNum.startsWith(query)
  })

  type TowsListRow =
    | { kind: 'tow'; tow: TowWithDetails; sortKey: string }
    | { kind: 'event'; event: EventListItem; sortKey: string }

  const towRows: TowsListRow[] =
    listKind === 'events'
      ? []
      : filteredTows.map((tow) => ({
          kind: 'tow' as const,
          tow,
          sortKey: tow.created_at,
        }))

  const eventRows: TowsListRow[] =
    listKind === 'tows'
      ? []
      : filteredEvents.map((event) => ({
          kind: 'event' as const,
          event,
          sortKey: event.created_at,
        }))

  const mergedRows: TowsListRow[] = [...towRows, ...eventRows].sort(
    (a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime()
  )

  // Status pills stay active in results mode as a CLIENT filter over the matches.
  const towMatchesActiveStatus = (tow: TowWithDetails) => {
    if (activeStatus === 'all') return true
    if (activeStatus === 'cancelled') {
      return tow.status === 'cancelled' || tow.status === 'cancelled_charged'
    }
    return tow.status === activeStatus
  }

  const resultRows: TowsListRow[] = searchResults
    .filter(towMatchesActiveStatus)
    .map((tow) => ({ kind: 'tow' as const, tow, sortKey: tow.created_at }))
    .sort((a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime())

  const displayRows = inResultsMode ? resultRows : mergedRows

  const resultsValueLabel =
    resultsQuery?.field === 'date'
      ? (() => {
          const ymd = localYmdFromDateString(resultsQuery.value)
          return ymd ? formatLocalYmdHe(ymd) : resultsQuery.value
        })()
      : resultsQuery?.value ?? ''

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

  const formatEventListDate = (event: EventListItem) => {
    if (event.event_date) {
      const [year, month, day] = event.event_date.split('-').map(Number)
      if (year && month && day) {
        return new Date(year, month - 1, day).toLocaleDateString('he-IL')
      }
    }
    return formatDate(event.created_at)
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
          href="/dashboard/tows/create"
          className="hidden lg:flex items-center justify-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={20} />
          <span>גרירה חדשה</span>
        </Link>
      </div>

      {/* כפתור מובייל */}
      <Link
        href="/dashboard/tows/create"
        className="lg:hidden flex items-center justify-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-4 py-3 rounded-xl transition-colors mb-6"
      >
        <Plus size={20} />
        <span>גרירה חדשה</span>
      </Link>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{towListStats.total}</p>
          <p className="text-xs text-gray-500">סה״כ</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{towListStats.pending}</p>
          <p className="text-xs text-gray-500">ממתינות</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{towListStats.assigned}</p>
          <p className="text-xs text-gray-500">משויכות</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{towListStats.in_progress}</p>
          <p className="text-xs text-gray-500">בביצוע</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold text-emerald-600">{towListStats.completed}</p>
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
              disabled={inResultsMode}
              title={inResultsMode ? 'חיפוש חופשי מושבת בזמן חיפוש לפי שדה' : undefined}
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-3" role="group" aria-label="סוג רשומות">
          {([
            { id: 'all', label: 'הכל' },
            { id: 'tows', label: 'גרירות' },
            { id: 'events', label: 'אירועים' },
          ] as { id: ListKind; label: string }[]).map((kind) => (
            <button
              key={kind.id}
              type="button"
              aria-pressed={listKind === kind.id}
              onClick={() => setListKind(kind.id)}
              disabled={inResultsMode}
              title={inResultsMode ? 'סוג הרשומות נעול לגרירות בזמן חיפוש לפי שדה' : undefined}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${
                listKind === kind.id
                  ? 'bg-[#33d4ff] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {kind.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {listKind !== 'events' && (
            <div className="flex gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
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
          )}
        </div>

        {/* שורת בקרה: במצב רגיל — ספירה + ניקוי סינון + טען עוד. במצב תוצאות — באנר תוצאות */}
        {inResultsMode ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#33d4ff]/10 px-3 py-1.5 text-xs font-semibold text-[#1593b8] ring-1 ring-inset ring-[#33d4ff]/30">
              <Search size={13} aria-hidden />
              <span>
                תוצאות עבור: {resultsQuery ? SEARCH_FIELD_LABELS[resultsQuery.field] : ''}
                {' = '}
                <span className="font-bold">{resultsValueLabel}</span>
              </span>
              <span className="text-[#1593b8]/60">·</span>
              <span className="text-[#1593b8]/80">נמצאו {searchTotal} תוצאות</span>
            </span>
            <button
              type="button"
              onClick={handleClearResults}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
            >
              <X size={14} aria-hidden />
              חזרה לרשימה
            </button>
            {resultsCapped && (
              <span className="text-xs font-medium text-amber-600">
                מוצגות {SEARCH_BY_FIELD_ID_CAP_LABEL} תוצאות ראשונות — צמצם את החיפוש
              </span>
            )}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
              {`${tows.length} / ${towListStats.total}`}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
              >
                <X size={14} aria-hidden />
                נקה סינון
              </button>
            )}
            {tows.length < towListStats.total && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#33d4ff] bg-[#33d4ff]/10 px-4 py-2 text-xs font-semibold text-[#1593b8] shadow-sm transition-all hover:bg-[#33d4ff]/20 hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#1593b8] border-t-transparent" />
                )}
                {loadingMore ? 'טוען…' : `טען עוד ${TOWS_PAGE_SIZE}`}
              </button>
            )}

            {/* מפריד עדין בין "טען עוד" (העמוד הבא) לבין "שלוף הכל" (כל ההיסטוריה) */}
            <span className="mx-1 hidden h-6 w-px self-center bg-gray-200 sm:block" aria-hidden />
            <span className="text-xs font-medium text-gray-400 sm:hidden">או</span>

            {/* דרך נפרדת ועוצמתית יותר: שליפת כל הגרירות התואמות מכל ההיסטוריה */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <SlidersHorizontal size={14} aria-hidden className="text-[#1593b8]" />
                <span className="leading-tight">
                  שלוף את כל הגרירות לפי
                  <span className="block text-[10px] font-normal leading-tight text-gray-400">מכל ההיסטוריה</span>
                </span>
              </span>
              <select
                value={searchByField}
                onChange={(e) => {
                  setSearchByField(e.target.value as TowSearchField)
                  setSearchByValue('')
                  setSearchOffset(0)
                  setSearchHint('')
                }}
                aria-label="בחר שדה חיפוש"
                className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              >
                {SEARCH_FIELD_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {searchByField === 'date' ? (
                <input
                  type="date"
                  value={searchByValue}
                  onChange={(e) => {
                    setSearchByValue(e.target.value)
                    setSearchOffset(0)
                  }}
                  className="w-36 rounded-xl border border-gray-200 px-2 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              ) : (
                <input
                  type="text"
                  value={searchByValue}
                  onChange={(e) => {
                    setSearchByValue(e.target.value)
                    setSearchOffset(0)
                    if (searchHint) setSearchHint('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRunFieldSearch()
                  }}
                  placeholder={
                    SEARCH_FIELD_OPTIONS.find((o) => o.id === searchByField)?.placeholder
                  }
                  className="w-40 rounded-xl border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              )}
              <button
                type="button"
                onClick={handleRunFieldSearch}
                disabled={searchLoading || !searchByValue.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#33d4ff] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#21b8e6] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searchLoading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Search size={14} aria-hidden />
                )}
                חפש
              </button>
            </div>

            {searchHint && (
              <span className="basis-full text-xs font-medium text-amber-600">
                {searchHint}
              </span>
            )}
          </div>
        )}
      </div>

      {/* טבלה */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {displayRows.length === 0 && inResultsMode ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">לא נמצאו גרירות עבור החיפוש</h3>
            <p className="text-gray-500 mb-6">
              {resultsQuery ? SEARCH_FIELD_LABELS[resultsQuery.field] : ''} = {resultsValueLabel}
            </p>
            <button
              type="button"
              onClick={handleClearResults}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <X size={18} aria-hidden />
              <span>חזרה לרשימה</span>
            </button>
          </div>
        ) : displayRows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">אין גרירות להצגה</h3>
            <p className="text-gray-500 mb-6">צרו את הגרירה הראשונה שלכם</p>
            <Link
              href="/dashboard/tows/create"
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
                  {displayRows.map((row) => {
                    if (row.kind === 'tow') {
                      const tow = row.tow
                      const { from, to } = getFromTo(tow)
                      const vehicle = tow.vehicles[0]
                      return (
                        <tr key={tow.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/tows/${tow.id}`)}>

                          <td className="px-4 py-4">
                            <ScheduledDateBadge scheduledAt={tow.scheduled_at} />
                            <div className={tow.scheduled_at ? 'mt-1.5' : ''}>
                              <p className="text-[10px] text-gray-400 leading-none mb-0.5">הוזמן</p>
                              <span className="font-medium text-gray-800">{formatDate(tow.created_at)}</span>
                              <p className="text-xs text-gray-500">{formatTime(tow.created_at)}</p>
                            </div>
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
                            <div className="max-w-[280px]">
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0"></div>
                                <span className="text-gray-700 truncate">{from}</span>
                              </div>
                              <div className="w-0.5 h-3 bg-gray-300 mr-[3px] my-1"></div>
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-2 h-2 bg-red-500 rounded-full shrink-0"></div>
                                <span className="text-gray-700 truncate">{to}</span>
                              </div>
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
                    }

                    const event = row.event
                    return (
                      <tr
                        key={event.id}
                        className="hover:bg-cyan-50/40 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard/events/${event.id}`)}
                      >
                        <td className="px-4 py-4">
                          <ScheduledDateBadge eventDate={event.event_date} />
                          <div className={event.event_date ? 'mt-1.5' : ''}>
                            <span className="font-medium text-gray-800">{formatEventListDate(event)}</span>
                            <p className="text-xs text-gray-500">{formatTime(event.created_at)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {event.order_number ? (
                            <span className="font-mono text-gray-800">{event.order_number}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-400 text-white text-xs font-bold">
                            <Sparkles size={12} />
                            אירוע מיוחד
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {event.customer ? (
                            <>
                              <span className="text-gray-800">{event.customer.name}</span>
                              {event.customer.phone && (
                                <p className="text-sm text-gray-500">{event.customer.phone}</p>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">לא צוין</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {event.driver?.user?.full_name ? (
                            <span className="text-gray-600">{event.driver.user.full_name}</span>
                          ) : (
                            <span className="text-amber-600 text-sm">לא שויך</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600 truncate block max-w-[200px]">
                            {event.location_address || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${eventStatusConfig[event.status]?.class || 'bg-gray-100 text-gray-600'}`}>
                            {eventStatusConfig[event.status]?.label || event.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {event.final_price ? (
                            <span className="font-medium text-gray-800">{event.final_price} ש״ח</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/dashboard/events/${event.id}`}
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
              {displayRows.map((row) => {
                if (row.kind === 'tow') {
                  const tow = row.tow
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
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <ScheduledDateBadge scheduledAt={tow.scheduled_at} />
                            <p className="text-sm text-gray-500">
                              <span className="text-xs text-gray-400">הוזמן </span>
                              {formatDate(tow.created_at)} | {formatTime(tow.created_at)}
                            </p>
                          </div>
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
                }

                const event = row.event
                return (
                  <Link
                    key={event.id}
                    href={`/dashboard/events/${event.id}`}
                    className="block p-4 hover:bg-cyan-50/40 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-400 text-white text-xs font-bold">
                            <Sparkles size={12} />
                            אירוע מיוחד
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${eventStatusConfig[event.status]?.class}`}>
                            {eventStatusConfig[event.status]?.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <ScheduledDateBadge eventDate={event.event_date} />
                          <p className="text-sm text-gray-500">
                            {formatEventListDate(event)} | {formatTime(event.created_at)}
                          </p>
                        </div>
                        {event.order_number && (
                          <p className="text-xs font-mono text-gray-400 mt-0.5">#{event.order_number}</p>
                        )}
                      </div>
                      {event.final_price && (
                        <span className="font-bold text-[#33d4ff]">{event.final_price} ש״ח</span>
                      )}
                    </div>

                    <div className="bg-cyan-50 rounded-lg p-3 mb-3 ring-1 ring-cyan-200">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin size={14} className="text-cyan-600 shrink-0" />
                        <span className="text-gray-700 truncate">{event.location_address || '-'}</span>
                      </div>
                    </div>

                    {event.customer && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <User size={14} />
                        <span>{event.customer.name}</span>
                        {event.customer.phone && (
                          <span className="text-gray-400">· {event.customer.phone}</span>
                        )}
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-sm text-gray-500">
                      <Truck size={14} />
                      <span className="text-gray-700">
                        {event.driver?.user?.full_name || 'לא שויך'}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* אזור "טען עוד" — במצב תוצאות: טען עוד תוצאות; אחרת: טען עוד 100 */}
      {inResultsMode
        ? searchResults.length < searchTotal && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleLoadMoreResults}
                disabled={loadingMoreResults}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#33d4ff] bg-[#33d4ff]/10 px-6 py-2.5 text-sm font-semibold text-[#1593b8] shadow-sm transition-all hover:bg-[#33d4ff]/20 hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMoreResults && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1593b8] border-t-transparent" />
                )}
                {loadingMoreResults ? 'טוען…' : 'טען עוד תוצאות'}
              </button>
            </div>
          )
        : tows.length < towListStats.total && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#33d4ff] bg-[#33d4ff]/10 px-6 py-2.5 text-sm font-semibold text-[#1593b8] shadow-sm transition-all hover:bg-[#33d4ff]/20 hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1593b8] border-t-transparent" />
                )}
                {loadingMore ? 'טוען…' : `טען עוד ${TOWS_PAGE_SIZE}`}
              </button>
            </div>
          )}
    </div>
  )
}