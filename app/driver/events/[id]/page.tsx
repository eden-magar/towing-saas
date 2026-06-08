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
import { getDriverEvent, type EventWithDetails } from '@/app/lib/queries/events'
import { toWhatsApp } from '@/app/lib/utils/phone'

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

  useEffect(() => {
    if (authLoading || !user?.id) return
    void loadEvent()
  }, [authLoading, user?.id, id])

  const loadEvent = async () => {
    if (!user?.id) return
    setLoading(true)
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
      setLoading(false)
    }
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

  return (
    <div dir="rtl" className="flex h-[100dvh] flex-col overflow-hidden bg-gray-100 pb-16">
      {/* Header — compact single row */}
      <div className="shrink-0 bg-gradient-to-l from-cyan-500 to-cyan-600 px-3 py-2 text-white">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/driver')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20"
            aria-label="חזרה לדף הבית"
          >
            <ArrowRight size={18} />
          </button>
          <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-bold">
            <Sparkles size={13} className="shrink-0" />
            אירוע מיוחד
          </span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
            {status.label}
          </span>
          {event.order_number && (
            <span className="shrink-0 font-mono text-[11px] text-white/85">#{event.order_number}</span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-3 py-2">
        {/* Customer */}
        <div className="shrink-0 rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm">
          <div className="mb-1 text-[10px] font-medium text-gray-400">לקוח</div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-800">{customerName}</p>
              {customerPhone && (
                <p className="truncate text-xs text-gray-500 dir-ltr text-right">{customerPhone}</p>
              )}
            </div>
            {customerPhone && (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openPhone(customerPhone)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#33d4ff] text-white"
                  aria-label="התקשר ללקוח"
                >
                  <Phone size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => openWhatsApp(customerPhone, customerName)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#33d4ff] text-white"
                  aria-label="שלח וואטסאפ ללקוח"
                >
                  <MessageCircle size={15} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="shrink-0 rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm">
          <div className="mb-1 text-[10px] font-medium text-gray-400">מועד</div>
          <div className="flex items-center gap-2 text-gray-800">
            <Calendar size={15} className="shrink-0 text-cyan-600" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{formatEventDate(event.event_date)}</p>
              <p className="text-xs text-gray-500">
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
        <div className="shrink-0 rounded-xl border border-cyan-100 bg-white p-2.5 shadow-sm">
          <div className="mb-1 text-[10px] font-medium text-gray-400">מיקום</div>
          {hasLocation ? (
            <div className="mb-2 flex items-start gap-1.5 text-gray-700">
              <MapPin size={14} className="mt-0.5 shrink-0 text-cyan-600" />
              <span className="line-clamp-2 text-xs leading-snug">{event.location_address}</span>
            </div>
          ) : (
            <p className="mb-2 text-xs text-gray-400">לא צוין מיקום</p>
          )}
          {hasNavigationTarget && (
            <div className="flex flex-row gap-1.5">
              <button
                type="button"
                onClick={() => openWazeForEvent(event)}
                className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 px-2 py-2 text-xs font-medium text-blue-600"
              >
                <Navigation size={14} />
                Waze
              </button>
              <button
                type="button"
                onClick={() => openGoogleMapsForEvent(event)}
                className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg bg-green-50 px-2 py-2 text-xs font-medium text-green-700"
              >
                <MapPin size={14} />
                Maps
              </button>
            </div>
          )}
        </div>

        {/* Contact */}
        {(event.contact_name || event.contact_phone) && (
          <div className="shrink-0 rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm">
            <div className="mb-1 text-[10px] font-medium text-gray-400">איש קשר</div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5 text-gray-700">
                <User size={14} className="shrink-0 text-gray-400" />
                <span className="truncate text-xs">{event.contact_name || '—'}</span>
              </div>
              {event.contact_phone && (
                <button
                  type="button"
                  onClick={() => openPhone(event.contact_phone!)}
                  className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-green-50 px-3 text-xs font-medium text-green-600"
                >
                  <Phone size={14} />
                  <span dir="ltr" className="tabular-nums">
                    {event.contact_phone}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Details — fills remaining space, clamped */}
        {event.details?.trim() && (
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm">
            <div className="mb-1 shrink-0 text-[10px] font-medium text-gray-400">הנחיות / פרטים</div>
            <p className="min-h-0 flex-1 overflow-hidden text-xs leading-snug text-gray-700 line-clamp-[6] whitespace-pre-wrap">
              {event.details}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
