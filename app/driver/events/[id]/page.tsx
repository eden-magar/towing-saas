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
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatEventTime(timeStr: string | null): string {
  if (!timeStr) return ''
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return timeStr
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function formatEventTimeRange(start: string | null, end: string | null): string {
  const startLabel = formatEventTime(start)
  const endLabel = formatEventTime(end)
  if (!startLabel && !endLabel) return '—'
  if (!endLabel) return startLabel
  if (!startLabel) return endLabel
  return `${startLabel}–${endLabel}`
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

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-cyan-500 to-cyan-600 px-4 pb-6 pt-4 text-white">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/driver')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur"
            aria-label="חזרה לדף הבית"
          >
            <ArrowRight size={20} />
          </button>
          {event.order_number && (
            <span className="font-mono text-sm text-white/90">#{event.order_number}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-sm font-bold">
            <Sparkles size={14} />
            אירוע מיוחד
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="-mt-3 flex flex-col gap-3 px-4">
        {/* Customer */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-400">לקוח</p>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800">{customerName}</p>
              {customerPhone && (
                <p className="mt-0.5 text-sm text-gray-500 dir-ltr text-right">{customerPhone}</p>
              )}
            </div>
            {customerPhone && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPhone(customerPhone)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#33d4ff] text-white"
                  aria-label="התקשר ללקוח"
                >
                  <Phone size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => openWhatsApp(customerPhone, customerName)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#33d4ff] text-white"
                  aria-label="שלח וואטסאפ ללקוח"
                >
                  <MessageCircle size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-400">מועד</p>
          <div className="flex items-center gap-2 text-gray-800">
            <Calendar size={18} className="shrink-0 text-cyan-600" />
            <div>
              <p className="font-medium">{formatEventDate(event.event_date)}</p>
              <p className="text-sm text-gray-500">
                {formatEventTimeRange(event.start_time, event.end_time)}
              </p>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-400">מיקום</p>
          {hasLocation ? (
            <div className="mb-3 flex items-start gap-2 text-gray-700">
              <MapPin size={16} className="mt-0.5 shrink-0 text-cyan-600" />
              <span className="text-sm leading-relaxed">{event.location_address}</span>
            </div>
          ) : (
            <p className="mb-3 text-sm text-gray-400">לא צוין מיקום</p>
          )}
          {hasNavigationTarget && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => openWazeForEvent(event)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-50 py-2.5 text-sm font-medium text-blue-600"
              >
                <Navigation size={16} />
                נווט עם Waze
              </button>
              <button
                type="button"
                onClick={() => openGoogleMapsForEvent(event)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-50 py-2.5 text-sm font-medium text-green-700"
              >
                <MapPin size={16} />
                Google Maps
              </button>
            </div>
          )}
        </div>

        {/* Contact */}
        {(event.contact_name || event.contact_phone) && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium text-gray-400">איש קשר</p>
            <div className="flex items-start gap-2 text-gray-700">
              <User size={16} className="mt-0.5 shrink-0 text-gray-400" />
              <span className="text-sm">{event.contact_name || '—'}</span>
            </div>
            {event.contact_phone && (
              <button
                type="button"
                onClick={() => openPhone(event.contact_phone!)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-green-50 py-2.5 text-sm font-medium text-green-600"
              >
                <Phone size={16} />
                {event.contact_phone}
              </button>
            )}
          </div>
        )}

        {/* Details */}
        {event.details?.trim() && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium text-gray-400">הנחיות / פרטים</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {event.details}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
