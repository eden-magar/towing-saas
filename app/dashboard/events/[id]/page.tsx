'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowRight,
  User,
  MapPin,
  Phone,
  FileText,
  Truck,
  Calendar,
  Receipt,
  Car,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../../../lib/AuthContext'
import { getEvent, type EventWithDetails } from '../../../lib/queries/events'

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: {
    label: 'טיוטה',
    color: 'bg-[#33d4ff]/10 text-[#21b8e6] border-[#33d4ff]/30',
  },
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function InfoPanel({
  icon: Icon,
  title,
  children,
  className = '',
}: {
  icon: typeof User
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-300 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_4px_12px_rgba(15,23,42,0.04)] overflow-hidden ${className}`}
    >
      <div className="px-3.5 py-2.5 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#33d4ff]/10 text-[#33d4ff] flex items-center justify-center shrink-0">
          <Icon size={15} />
        </div>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  )
}

function PlaceholderPanel({
  icon: Icon,
  title,
  message,
}: {
  icon: typeof Receipt
  title: string
  message: string
}) {
  return (
    <div className="bg-white/70 rounded-xl border border-dashed border-gray-300 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="px-3.5 py-2.5 border-b border-dashed border-gray-300 bg-gray-50/40 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
          <Icon size={15} />
        </div>
        <h2 className="text-sm font-semibold text-gray-500">{title}</h2>
      </div>
      <div className="px-3.5 py-6 text-center">
        <p className="text-sm text-gray-400">{message}</p>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs text-gray-500 mb-0.5">{children}</p>
}

function FieldValue({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium text-gray-800">{children}</p>
}

export default function EventDetailsPage() {
  const params = useParams()
  const eventId = params.id as string
  const { companyId } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [event, setEvent] = useState<EventWithDetails | null>(null)

  const loadEvent = useCallback(async () => {
    if (!companyId || !eventId) return
    setLoading(true)
    setError('')
    try {
      const data = await getEvent(eventId)
      setEvent(data)
    } catch (err) {
      console.error('Error loading event:', err)
      setError('שגיאה בטעינת האירוע')
    } finally {
      setLoading(false)
    }
  }, [companyId, eventId])

  useEffect(() => {
    if (companyId && eventId) {
      void loadEvent()
    }
  }, [companyId, eventId, loadEvent])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">טוען אירוע...</p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'האירוע לא נמצא'}</p>
          <Link href="/dashboard/events" className="text-[#33d4ff]">
            חזרה לרשימת אירועים
          </Link>
        </div>
      </div>
    )
  }

  const status = statusConfig[event.status] ?? {
    label: event.status,
    color: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  const titleLabel = event.order_number
    ? `אירוע #${event.order_number}`
    : 'אירוע מיוחד'

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#33d4ff]/5 via-gray-50 to-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-3 h-16 sm:h-[4.5rem]">
            <Link
              href="/dashboard/events"
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg shrink-0"
            >
              <ArrowRight size={20} />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-8 h-8 rounded-lg bg-[#33d4ff]/15 text-[#33d4ff] flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <h1 className="font-bold text-gray-900 text-base sm:text-lg truncate">
                  {titleLabel}
                </h1>
                <span
                  className={`px-2.5 py-0.5 text-xs font-medium rounded-full border shrink-0 ${status.color}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                <Calendar size={12} className="text-[#33d4ff]" />
                נוצר ב-{formatDateTime(event.created_at)}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 sm:py-5 space-y-3">
        {/* Row 1 — customer / contact / driver */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InfoPanel icon={User} title="פרטי לקוח">
            <FieldLabel>שם</FieldLabel>
            <FieldValue>{event.customer?.name || 'לא צוין'}</FieldValue>
            {event.customer?.phone && (
              <a
                href={`tel:${event.customer.phone}`}
                className="text-[#33d4ff] text-sm flex items-center gap-1 mt-2 hover:underline"
              >
                <Phone size={13} />
                {event.customer.phone}
              </a>
            )}
          </InfoPanel>

          <InfoPanel icon={Phone} title="איש קשר">
            <FieldLabel>שם</FieldLabel>
            <FieldValue>{event.contact_name?.trim() || 'לא צוין'}</FieldValue>
            {event.contact_phone && (
              <a
                href={`tel:${event.contact_phone}`}
                className="text-[#33d4ff] text-sm flex items-center gap-1 mt-2 hover:underline"
              >
                <Phone size={13} />
                {event.contact_phone}
              </a>
            )}
          </InfoPanel>

          <InfoPanel icon={Truck} title="נהג">
            {event.driver?.user?.full_name ? (
              <>
                <FieldLabel>שם</FieldLabel>
                <FieldValue>{event.driver.user.full_name}</FieldValue>
                {event.driver.user.phone && (
                  <a
                    href={`tel:${event.driver.user.phone}`}
                    className="text-[#33d4ff] text-sm flex items-center gap-1 mt-2 hover:underline"
                  >
                    <Phone size={13} />
                    {event.driver.user.phone}
                  </a>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">לא שובץ נהג</p>
            )}
          </InfoPanel>
        </div>

        {/* Row 2 — location */}
        <InfoPanel icon={MapPin} title="מיקום">
          <p className="text-sm text-gray-800 leading-relaxed">
            {event.location_address?.trim() || 'לא צוין'}
          </p>
        </InfoPanel>

        {/* Row 3 — details */}
        <InfoPanel icon={FileText} title="פרטים">
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {event.details?.trim() || 'לא צוין'}
          </p>
        </InfoPanel>

        {/* Placeholders — coming soon */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <PlaceholderPanel
            icon={Receipt}
            title="תמחור"
            message="התמחור יתווסף בקרוב"
          />
          <PlaceholderPanel
            icon={Car}
            title="רכבים שנגררו"
            message="תיעוד הרכבים יתווסף בקרוב"
          />
        </div>
      </div>
    </div>
  )
}
