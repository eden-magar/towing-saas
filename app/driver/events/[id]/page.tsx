'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Sparkles,
  User,
} from 'lucide-react'
import { useAuth } from '@/app/lib/AuthContext'
import { getDriverByUserId } from '@/app/lib/queries/driver-tasks'
import {
  completeEvent,
  getDriverEvent,
  saveEventChangeLog,
  updateEventDriverStatus,
  type EventWithDetails,
} from '@/app/lib/queries/events'
import { toWhatsApp } from '@/app/lib/utils/phone'

function getDriverProgressLabel(driverStatus: string | null): string {
  switch (driverStatus) {
    case 'received':
      return 'קיבל את האירוע'
    case 'departed':
      return 'בדרך'
    case 'arrived':
      return 'הגיע'
    default:
      return 'טרם התחיל'
  }
}

const EVENT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'טיוטה', className: 'bg-cyan-100 text-cyan-700' },
  quote: { label: 'הצעת מחיר', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'אושר', className: 'bg-green-100 text-green-700' },
  completed: { label: 'הושלם', className: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'בוטל', className: 'bg-red-100 text-red-700' },
}

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  return new Date(year, month - 1, day).toLocaleDateString('he-IL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

function formatEventTime(timeStr: string | null): string {
  if (!timeStr) return ''
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return timeStr
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function openPhone(phone: string) {
  window.open(`tel:${phone}`, '_self')
}

function openWhatsApp(phone: string, customerName: string) {
  const waNumber = toWhatsApp(phone).replace(/^\+/, '')
  if (!waNumber) return
  const message = `שלום${customerName ? ` ${customerName}` : ''}, אני בדרך לאירוע המיוחד.`
  window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank')
}

function openWazeForEvent(event: EventWithDetails) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  if (event.location_lat != null && event.location_lng != null) {
    const ll = `${event.location_lat},${event.location_lng}`
    const wazeAppUrl = `waze://?ll=${ll}&navigate=yes`
    const wazeWebUrl = `https://waze.com/ul?ll=${ll}&navigate=yes`
    if (isMobile) {
      window.location.href = wazeAppUrl
      setTimeout(() => window.open(wazeWebUrl, '_blank'), 2000)
    } else {
      window.open(wazeWebUrl, '_blank')
    }
    return
  }

  const address = event.location_address?.trim()
  if (!address) return

  const encoded = encodeURIComponent(address)
  const wazeAppUrl = `waze://?q=${encoded}&navigate=yes`
  const wazeWebUrl = `https://waze.com/ul?q=${encoded}&navigate=yes`
  if (isMobile) {
    window.location.href = wazeAppUrl
    setTimeout(() => window.open(wazeWebUrl, '_blank'), 2000)
  } else {
    window.open(wazeWebUrl, '_blank')
  }
}

function openGoogleMapsForEvent(event: EventWithDetails) {
  if (event.location_lat != null && event.location_lng != null) {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${event.location_lat},${event.location_lng}`,
      '_blank'
    )
    return
  }

  const address = event.location_address?.trim()
  if (!address) return
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
    '_blank'
  )
}

export default function DriverEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [event, setEvent] = useState<EventWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (authLoading || !user?.id) return
    void loadEvent()
  }, [authLoading, user?.id, id])

  const loadEvent = async (options?: { silent?: boolean }) => {
    if (!user?.id) return
    if (!options?.silent) {
      setLoading(true)
    }
    setNotFound(false)
    try {
      const driver = await getDriverByUserId(user.id)
      if (!driver) {
        setNotFound(true)
        setEvent(null)
        return
      }

      const data = await getDriverEvent(id, driver.id)
      if (!data) {
        setNotFound(true)
        setEvent(null)
        return
      }

      setEvent(data)
    } catch (err) {
      console.error('Error loading driver event:', err)
      setNotFound(true)
      setEvent(null)
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }

  const handleDriverAction = async () => {
    if (!user?.id || !event || actionLoading) return
    if (event.status === 'completed' || event.status === 'cancelled') return

    setActionLoading(true)
    setActionError('')

    try {
      const companyId = event.company_id
      const changedBy = user.id
      const previousLabel = getDriverProgressLabel(event.driver_status)

      if (!event.driver_status) {
        await updateEventDriverStatus(event.id, 'received', 'driver_received_at')
        await saveEventChangeLog({
          eventId: event.id,
          companyId,
          changedBy,
          fieldName: 'סטטוס נהג',
          oldValue: previousLabel,
          newValue: 'הנהג קיבל את האירוע',
        })
      } else if (event.driver_status === 'received') {
        await updateEventDriverStatus(event.id, 'departed', 'driver_departed_at')
        await saveEventChangeLog({
          eventId: event.id,
          companyId,
          changedBy,
          fieldName: 'סטטוס נהג',
          oldValue: previousLabel,
          newValue: 'הנהג יצא לדרך',
        })
      } else if (event.driver_status === 'departed') {
        await updateEventDriverStatus(event.id, 'arrived', 'driver_arrived_at')
        await saveEventChangeLog({
          eventId: event.id,
          companyId,
          changedBy,
          fieldName: 'סטטוס נהג',
          oldValue: previousLabel,
          newValue: 'הנהג הגיע',
        })
      } else if (event.driver_status === 'arrived') {
        await completeEvent(event.id, changedBy)
        await saveEventChangeLog({
          eventId: event.id,
          companyId,
          changedBy,
          fieldName: 'סיום',
          oldValue: null,
          newValue: 'האירוע הושלם על ידי הנהג',
        })
      }

      await loadEvent({ silent: true })
    } catch (err) {
      console.error('Error updating driver event progress:', err)
      setActionError('שגיאה בעדכון הסטטוס, נסה שוב')
    } finally {
      setActionLoading(false)
    }
  }

  const getNextActionLabel = (): string | null => {
    if (!event) return null
    if (event.status === 'completed') return null
    if (event.status === 'cancelled') return null
    if (!event.driver_status) return 'קיבלתי את האירוע'
    if (event.driver_status === 'received') return 'יצאתי לדרך'
    if (event.driver_status === 'departed') return 'הגעתי'
    if (event.driver_status === 'arrived') return 'סיים אירוע'
    return null
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-cyan-600" />
          <p className="text-gray-500">טוען אירוע...</p>
        </div>
      </div>
    )
  }

  if (notFound || !event) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6">
        <AlertCircle size={48} className="mb-4 text-gray-400" />
        <p className="mb-4 text-center text-gray-600">האירוע לא נמצא</p>
        <button
          type="button"
          onClick={() => router.push('/driver')}
          className="font-medium text-[#33d4ff]"
        >
          חזרה לדף הבית
        </button>
      </div>
    )
  }

  const status = EVENT_STATUS_CONFIG[event.status] ?? {
    label: event.status,
    className: 'bg-gray-100 text-gray-600',
  }
  const customerName = event.customer?.name || 'ללא לקוח'
  const customerPhone = event.customer?.phone
  const hasLocation = Boolean(event.location_address?.trim())
  const hasNavigationTarget =
    hasLocation || (event.location_lat != null && event.location_lng != null)
  const startTimeLabel = formatEventTime(event.start_time)
  const endTimeLabel = formatEventTime(event.end_time)

  const actionIconButtonClass =
    'flex h-10 w-10 items-center justify-center rounded-xl bg-[#33d4ff] text-white shadow-sm active:scale-[0.98] transition-transform'
  const nextActionLabel = getNextActionLabel()
  const driverProgressLabel =
    event.status === 'completed' ? 'הושלם' : getDriverProgressLabel(event.driver_status)

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100 pb-20">
      {/* Header — compact single row */}
      <div className="bg-gradient-to-l from-cyan-500 to-cyan-600 px-4 py-3 text-white shadow-sm">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push('/driver')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur"
            aria-label="חזרה לדף הבית"
          >
            <ArrowRight size={20} />
          </button>
          <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-base font-bold">
            <Sparkles size={16} className="shrink-0" />
            אירוע מיוחד
          </span>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
          {event.order_number && (
            <span className="shrink-0 font-mono text-xs text-white/90">#{event.order_number}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        {/* Customer */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-500">לקוח</p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-gray-800">{customerName}</p>
              {customerPhone && (
                <p className="mt-0.5 truncate text-sm text-gray-500 dir-ltr text-right">{customerPhone}</p>
              )}
            </div>
            {customerPhone && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPhone(customerPhone)}
                  className={actionIconButtonClass}
                  aria-label="התקשר ללקוח"
                >
                  <Phone size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => openWhatsApp(customerPhone, customerName)}
                  className={actionIconButtonClass}
                  aria-label="שלח וואטסאפ ללקוח"
                >
                  <MessageCircle size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-500">מועד</p>
          <div className="flex items-center gap-3 text-gray-800">
            <Calendar size={18} className="shrink-0 text-cyan-600" />
            <div className="min-w-0">
              <p className="text-base font-medium">{formatEventDate(event.event_date)}</p>
              <p className="text-sm text-gray-500">
                {startTimeLabel || endTimeLabel ? (
                  <span dir="ltr" className="tabular-nums unicode-bidi-isolate">
                    {startTimeLabel}
                    {startTimeLabel && endTimeLabel ? '–' : ''}
                    {endTimeLabel}
                  </span>
                ) : (
                  '—'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-500">מיקום</p>
          {hasLocation ? (
            <div className="mb-3 flex items-start gap-2 text-gray-700">
              <MapPin size={16} className="mt-0.5 shrink-0 text-cyan-600" />
              <span className="text-sm leading-relaxed">{event.location_address}</span>
            </div>
          ) : (
            <p className="mb-3 text-sm text-gray-400">לא צוין מיקום</p>
          )}
          {hasNavigationTarget && (
            <div className="flex flex-row gap-2">
              <button
                type="button"
                onClick={() => openWazeForEvent(event)}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-50 py-2.5 text-sm font-medium text-blue-600 active:scale-[0.98] transition-transform"
              >
                <Navigation size={16} />
                Waze
              </button>
              <button
                type="button"
                onClick={() => openGoogleMapsForEvent(event)}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-50 py-2.5 text-sm font-medium text-green-700 active:scale-[0.98] transition-transform"
              >
                <MapPin size={16} />
                Maps
              </button>
            </div>
          )}
        </div>

        {/* Contact */}
        {(event.contact_name || event.contact_phone) && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium text-gray-500">איש קשר</p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-gray-800">
                <User size={16} className="shrink-0 text-gray-400" />
                <span className="truncate text-sm font-medium">{event.contact_name || '—'}</span>
              </div>
              {event.contact_phone && (
                <button
                  type="button"
                  onClick={() => openPhone(event.contact_phone!)}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#33d4ff] px-3 text-sm font-medium text-white shadow-sm active:scale-[0.98] transition-transform"
                >
                  <Phone size={16} />
                  <span dir="ltr" className="tabular-nums">
                    {event.contact_phone}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Details — content height only */}
        {event.details?.trim() && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium text-gray-500">הנחיות / פרטים</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {event.details}
            </p>
          </div>
        )}

        {/* Driver progress */}
        <div className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
          <p className="mb-1 text-xs font-medium text-gray-500">התקדמות נהג</p>
          <p className="text-sm font-medium text-gray-800">
            סטטוס: <span className="text-cyan-700">{driverProgressLabel}</span>
          </p>
          {event.status === 'completed' ? (
            <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
              האירוע הושלם
            </div>
          ) : nextActionLabel ? (
            <>
              {actionError && (
                <p className="mt-2 text-sm text-red-600">{actionError}</p>
              )}
              <button
                type="button"
                onClick={() => void handleDriverAction()}
                disabled={actionLoading}
                className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#33d4ff] px-4 py-3 text-base font-bold text-white shadow-md active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    מעדכן...
                  </>
                ) : (
                  nextActionLabel
                )}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
