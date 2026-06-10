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
  Clock,
  Receipt,
  Sparkles,
  Edit2,
  History,
  Image,
  X,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { useAuth } from '../../../lib/AuthContext'
import { canApproveQuote } from '../../../lib/utils/can-edit-closed-tow'
import {
  approveEventQuote,
  assignEventDriver,
  getEvent,
  getEventChangeLog,
  getEventVehiclePhotos,
  getEventVehicles,
  updateEventPrice,
  cancelEvent,
  completeEvent,
  saveEventChangeLog,
  type EventVehicle,
  type EventVehicleDetails,
  type EventVehiclePhoto,
  type EventWithDetails,
  type EventChangeLogEntry,
} from '../../../lib/queries/events'
import { getDrivers } from '../../../lib/queries/drivers'
import { getEventImageSignedUrl } from '../../../lib/queries/event-plate-capture'
import { getCompanySettings } from '../../../lib/queries/settings'
import { DriverCalendarPicker } from '../../../components/DriverCalendarPicker'
import { EventPriceEditor } from '../../../components/event-forms/EventPriceEditor'
import type { DriverWithDetails } from '../../../lib/types'
import type { EventPriceResult } from '../../../lib/utils/event-pricing'

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: {
    label: 'טיוטה',
    color: 'bg-[#33d4ff]/10 text-[#21b8e6] border-[#33d4ff]/30',
  },
  quote: {
    label: 'הצעת מחיר',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  approved: {
    label: 'אושר',
    color: 'bg-green-100 text-green-800 border-green-200',
  },
  cancelled: {
    label: 'בוטל',
    color: 'bg-gray-100 text-gray-500 border-gray-200',
  },
  completed: {
    label: 'הושלם',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
}

const CANCELLATION_REASONS = [
  'הלקוח ביטל',
  'טעות בהזמנה',
  'כפילות',
  'אחר',
] as const

function getStatusLabel(status: string): string {
  return statusConfig[status]?.label ?? status
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

function formatEventDate(date: string | null | undefined): string {
  if (!date) return '—'
  const normalized = date.includes('T') ? date : `${date}T12:00:00`
  return new Date(normalized).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatEventTime(time: string | null | undefined): string {
  if (!time) return '—'
  return time.slice(0, 5)
}

function formatPrice(
  value: number | null | undefined,
  emptyLabel: string
): string {
  if (value == null) return emptyLabel
  return `₪${value.toLocaleString('he-IL')}`
}

function formatMoney(value: number): string {
  return `₪${value.toFixed(2)}`
}

function formatLogPrice(value: number | null | undefined): string {
  if (value == null) return '—'
  return `₪${value.toLocaleString('he-IL')}`
}

function formatVehicleSummary(details: EventVehicleDetails): string {
  if (!details || typeof details !== 'object') return ''
  const d = details as {
    manufacturer?: string | null
    model?: string | null
    year?: number | null
    color?: string | null
  }
  return [d.manufacturer, d.model, d.year?.toString(), d.color].filter(Boolean).join(' · ')
}

function googleMapsDestinationUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

type EventTab = 'details' | 'history' | 'documentation'

function EventPricingDisplay({
  breakdown,
  manualPrice,
  finalPrice,
  listPrice,
  variant = 'default',
}: {
  breakdown: EventPriceResult | null
  manualPrice: number | null
  finalPrice: number | null
  listPrice: number | null
  variant?: 'default' | 'sidebar'
}) {
  const vatLabel = breakdown
    ? Math.round(breakdown.vatRate * 100)
    : 18

  if (variant === 'sidebar') {
    if (breakdown) {
      return (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">לפני מע״מ</span>
            <span className="font-medium text-gray-800">{formatMoney(breakdown.beforeVat)}</span>
          </div>
          {breakdown.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>הנחה ({breakdown.discountPercent}%)</span>
              <span className="font-medium">-{formatMoney(breakdown.discountAmount)}</span>
            </div>
          )}
          {(breakdown.surchargeAmount ?? 0) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>תוספת ({breakdown.surchargePercent}%)</span>
              <span className="font-medium">+{formatMoney(breakdown.surchargeAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-500">
            <span>מע״מ ({vatLabel}%)</span>
            <span className="font-medium">{formatMoney(breakdown.vatAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 mt-2">
            <span>סה״כ כולל מע״מ</span>
            <span className="text-gray-800">{formatMoney(breakdown.total)}</span>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">מחיר ידני</span>
          <span className="font-medium text-gray-800">{formatPrice(manualPrice, 'לא הוזן')}</span>
        </div>
        {finalPrice != null && (
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 mt-2">
            <span>סה״כ</span>
            <span className="text-gray-800">{formatMoney(finalPrice)}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between text-gray-500 text-xs">
        <span>מחיר מחירון</span>
        <span>
          {listPrice != null ? formatMoney(listPrice) : 'יחובר בהמשך'}
        </span>
      </div>

      {breakdown ? (
        <>
          <div className="flex justify-between">
            <FieldLabel>מחיר שהוזן</FieldLabel>
            <FieldValue>
              {formatMoney(breakdown.enteredPrice)}
              <span className="text-xs font-normal text-gray-500 mr-1">
                ({breakdown.includesVat ? 'כולל מע״מ' : 'לפני מע״מ'})
              </span>
            </FieldValue>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-2.5 py-2 text-xs space-y-0.5">
            <div className="flex justify-between text-gray-600">
              <span>לפני מע״מ</span>
              <span className="font-medium">{formatMoney(breakdown.beforeVat)}</span>
            </div>
            {breakdown.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>הנחה ({breakdown.discountPercent}%)</span>
                <span className="font-medium">-{formatMoney(breakdown.discountAmount)}</span>
              </div>
            )}
            {(breakdown.surchargeAmount ?? 0) > 0 && (
              <div className="flex justify-between text-green-700">
                <span>תוספת ({breakdown.surchargePercent}%)</span>
                <span className="font-medium">+{formatMoney(breakdown.surchargeAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>מע״מ ({vatLabel}%)</span>
              <span className="font-medium">{formatMoney(breakdown.vatAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-900 pt-0.5 border-t border-gray-200">
              <span>סה״כ</span>
              <span>{formatMoney(breakdown.total)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex justify-between">
          <FieldLabel>מחיר ידני</FieldLabel>
          <FieldValue>{formatPrice(manualPrice, 'לא הוזן')}</FieldValue>
        </div>
      )}

      {!breakdown && finalPrice != null && (
        <div className="flex justify-between">
          <FieldLabel>מחיר סופי</FieldLabel>
          <FieldValue>{formatMoney(finalPrice)}</FieldValue>
        </div>
      )}
    </div>
  )
}

function EventHistoryTimeline({
  logs,
  loading,
}: {
  logs: EventChangeLogEntry[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-7 h-7 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (logs.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">אין רשומות עדיין</p>
  }

  return (
    <div className="space-y-0">
      {logs.map((log, idx) => {
        const hasChange =
          log.old_value != null ||
          log.new_value != null

        return (
          <div key={log.id} className="flex gap-3 pb-5 relative">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#33d4ff] z-10 shrink-0" />
              {idx < logs.length - 1 && (
                <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-sm font-medium text-gray-800">{log.field_name}</div>
              {hasChange && (log.old_value || log.new_value) && (
                <div className="mt-1 text-sm text-gray-500">
                  <span className="line-through">{log.old_value || '—'}</span>
                  <span className="mx-2">→</span>
                  <span className="text-gray-800">{log.new_value || '—'}</span>
                </div>
              )}
              {log.user?.full_name && (
                <div className="mt-1 text-xs text-gray-400">
                  על ידי {log.user.full_name}
                </div>
              )}
              <div className="mt-0.5 text-xs text-gray-400">
                {formatDateTime(log.changed_at)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InfoPanel({
  icon: Icon,
  title,
  children,
  className = '',
  headerAction,
}: {
  icon: typeof User
  title: string
  children: ReactNode
  className?: string
  headerAction?: ReactNode
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-300 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_4px_12px_rgba(15,23,42,0.04)] overflow-hidden ${className}`}
    >
      <div className="px-3.5 py-2.5 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#33d4ff]/10 text-[#33d4ff] flex items-center justify-center shrink-0">
            <Icon size={15} />
          </div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        </div>
        {headerAction}
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs text-gray-500 mb-0.5">{children}</p>
}

function FieldValue({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium text-gray-800">{children}</p>
}

function VehiclePhaseDocumentation({
  title,
  photos,
  signedUrlByPhotoId,
  signedUrlsLoading,
  locationLat,
  locationLng,
  locationLabel,
}: {
  title: string
  photos: EventVehiclePhoto[]
  signedUrlByPhotoId: Record<string, string | null>
  signedUrlsLoading: boolean
  locationLat: number | null
  locationLng: number | null
  locationLabel: string
}) {
  const hasLocation = locationLat != null && locationLng != null

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-800">{title}</p>

      {photos.length === 0 ? (
        <p className="text-xs text-gray-400">אין תמונות</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo) => {
            const signedUrl = signedUrlByPhotoId[photo.id]

            if (signedUrlsLoading && signedUrl === undefined) {
              return (
                <div
                  key={photo.id}
                  className="aspect-square rounded-xl border border-gray-200 bg-gray-100 animate-pulse"
                />
              )
            }

            if (!signedUrl) {
              return (
                <div
                  key={photo.id}
                  className="aspect-square rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center"
                >
                  <Image size={20} className="text-gray-300" />
                </div>
              )
            }

            return (
              <a
                key={photo.id}
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <div className="aspect-square rounded-xl overflow-hidden border border-gray-200 group-hover:border-[#33d4ff] transition-colors">
                  <img
                    src={signedUrl}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </a>
            )
          })}
        </div>
      )}

      {hasLocation ? (
        <a
          href={googleMapsDestinationUrl(locationLat, locationLng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#33d4ff] hover:underline"
        >
          <MapPin size={14} />
          {locationLabel}
        </a>
      ) : (
        <p className="text-xs text-gray-400">אין מיקום</p>
      )}
    </div>
  )
}

export default function EventDetailsPage() {
  const params = useParams()
  const eventId = params.id as string
  const { user, companyId } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [event, setEvent] = useState<EventWithDetails | null>(null)

  const [vatRate, setVatRate] = useState(0.18)
  const [isEditingPrice, setIsEditingPrice] = useState(false)
  const [priceSaving, setPriceSaving] = useState(false)
  const [priceError, setPriceError] = useState('')

  const [activeTab, setActiveTab] = useState<EventTab>('details')

  const [vehicles, setVehicles] = useState<EventVehicle[]>([])
  const [photos, setPhotos] = useState<EventVehiclePhoto[]>([])
  const [signedUrlByPhotoId, setSignedUrlByPhotoId] = useState<Record<string, string | null>>({})
  const [signedUrlsLoading, setSignedUrlsLoading] = useState(false)

  const [changeLogs, setChangeLogs] = useState<EventChangeLogEntry[]>([])
  const [changeLogsLoading, setChangeLogsLoading] = useState(false)
  const [changeLogsLoaded, setChangeLogsLoaded] = useState(false)

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelStep, setCancelStep] = useState<'reason' | 'confirm'>('reason')
  const [selectedCancellationReason, setSelectedCancellationReason] = useState('')
  const [cancellationDetails, setCancellationDetails] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState('')
  const [approvingQuote, setApprovingQuote] = useState(false)
  const [approveQuoteError, setApproveQuoteError] = useState('')

  const [showDriverPicker, setShowDriverPicker] = useState(false)
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [driversLoading, setDriversLoading] = useState(false)
  const [assigningDriver, setAssigningDriver] = useState(false)
  const [assignDriverError, setAssignDriverError] = useState('')

  const handleTabChange = (tab: EventTab) => {
    setActiveTab(tab)
    if (tab !== 'details') {
      setIsEditingPrice(false)
      setPriceError('')
    }
  }

  const loadChangeLogs = useCallback(async () => {
    if (!eventId) return
    setChangeLogsLoading(true)
    try {
      const logs = await getEventChangeLog(eventId)
      setChangeLogs(logs)
      setChangeLogsLoaded(true)
    } catch (err) {
      console.error('Error loading event change log:', err)
    } finally {
      setChangeLogsLoading(false)
    }
  }, [eventId])

  const loadEvent = useCallback(
    async (silent = false) => {
      if (!companyId || !eventId) return
      if (!silent) {
        setLoading(true)
        setError('')
      }
      try {
        const [data, vehiclesData, photosData] = await Promise.all([
          getEvent(eventId),
          getEventVehicles(eventId),
          getEventVehiclePhotos(eventId),
        ])
        setEvent(data)
        setVehicles(vehiclesData)
        setPhotos(photosData)
        setSignedUrlByPhotoId({})
      } catch (err) {
        console.error('Error loading event:', err)
        if (!silent) setError('שגיאה בטעינת האירוע')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [companyId, eventId]
  )

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    getCompanySettings(companyId)
      .then((settings) => {
        if (cancelled) return
        const pct = settings?.default_vat_percent ?? 18
        setVatRate(pct / 100)
      })
      .catch((err) => {
        console.error('Error loading company VAT for event detail:', err)
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  useEffect(() => {
    if (companyId && eventId) {
      void loadEvent()
    }
  }, [companyId, eventId, loadEvent])

  useEffect(() => {
    setVehicles([])
    setPhotos([])
    setSignedUrlByPhotoId({})
    setChangeLogsLoaded(false)
    setChangeLogs([])
    setIsEditingPrice(false)
    setShowCancelModal(false)
    setCancelStep('reason')
    setSelectedCancellationReason('')
    setCancellationDetails('')
    setCancelError('')
    setShowCompleteModal(false)
    setCompleteError('')
    if (eventId) {
      void loadChangeLogs()
    }
  }, [eventId, loadChangeLogs])

  useEffect(() => {
    if (activeTab !== 'documentation') {
      return
    }

    if (photos.length === 0) {
      setSignedUrlsLoading(false)
      return
    }

    let cancelled = false
    setSignedUrlsLoading(true)

    void (async () => {
      const entries = await Promise.all(
        photos.map(async (photo) => {
          const signedUrl = await getEventImageSignedUrl(photo.image_path)
          return [photo.id, signedUrl] as const
        })
      )

      if (cancelled) return

      const next: Record<string, string | null> = {}
      for (const [id, url] of entries) {
        next[id] = url
      }
      setSignedUrlByPhotoId(next)
      setSignedUrlsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [activeTab, photos])

  const closeCancelModal = () => {
    setShowCancelModal(false)
    setCancelStep('reason')
    setSelectedCancellationReason('')
    setCancellationDetails('')
    setCancelError('')
  }

  const handleApproveQuote = async () => {
    if (!user || !companyId || !event || event.status !== 'quote') return
    if (!canApproveQuote(user.role)) return

    setApprovingQuote(true)
    setApproveQuoteError('')
    try {
      const result = await approveEventQuote(eventId)
      if (!result.approved) {
        setApproveQuoteError(
          result.reason === 'not_quote'
            ? 'ההצעה כבר אושרה או שאינה בהצעת מחיר'
            : 'האירוע לא נמצא'
        )
        return
      }
      await saveEventChangeLog({
        eventId,
        companyId,
        changedBy: user.id,
        fieldName: 'סטטוס',
        oldValue: getStatusLabel('quote'),
        newValue: getStatusLabel('approved'),
      })
      await loadEvent(true)
      await loadChangeLogs()
    } catch (err) {
      console.error('Error approving event quote:', err)
      setApproveQuoteError('שגיאה באישור ההצעה')
    } finally {
      setApprovingQuote(false)
    }
  }

  const handleConfirmComplete = async () => {
    if (!user || !companyId || !event) return

    setCompleting(true)
    setCompleteError('')
    try {
      const previousStatus = event.status
      await completeEvent(eventId, user.id)
      await saveEventChangeLog({
        eventId,
        companyId,
        changedBy: user.id,
        fieldName: 'סיום',
        oldValue: getStatusLabel(previousStatus),
        newValue: 'הושלם',
      })
      await loadEvent(true)
      await loadChangeLogs()
      setShowCompleteModal(false)
    } catch (err) {
      console.error('Error completing event:', err)
      setCompleteError('שגיאה בסיום האירוע')
    } finally {
      setCompleting(false)
    }
  }

  const handleConfirmCancel = async () => {
    if (!user || !companyId || !event || !selectedCancellationReason) return

    setCancelling(true)
    setCancelError('')
    try {
      const previousStatus = event.status
      const details = cancellationDetails.trim() || null
      await cancelEvent(eventId, selectedCancellationReason, details)
      await saveEventChangeLog({
        eventId,
        companyId,
        changedBy: user.id,
        fieldName: 'ביטול',
        oldValue: getStatusLabel(previousStatus),
        newValue: `בוטל — ${selectedCancellationReason}`,
      })
      await loadEvent(true)
      await loadChangeLogs()
      closeCancelModal()
    } catch (err) {
      console.error('Error cancelling event:', err)
      setCancelError('שגיאה בביטול האירוע')
    } finally {
      setCancelling(false)
    }
  }

  const openDriverPicker = useCallback(() => {
    if (!companyId) return
    setAssignDriverError('')
    setShowDriverPicker(true)
    setDriversLoading(true)
    void getDrivers(companyId)
      .then((data) => setDrivers(data))
      .catch((err) => {
        console.error('Error loading drivers for event assign:', err)
        setAssignDriverError('שגיאה בטעינת רשימת הנהגים')
        setShowDriverPicker(false)
      })
      .finally(() => setDriversLoading(false))
  }, [companyId])

  const handleAssignDriverConfirm = async (driverId: string) => {
    if (!user || !companyId || !event) return

    setAssigningDriver(true)
    setAssignDriverError('')
    try {
      const oldDriverName = event.driver?.user?.full_name ?? 'לא שובץ'
      const newDriverName =
        drivers.find((d) => d.id === driverId)?.user?.full_name ?? driverId

      await assignEventDriver(eventId, driverId)
      await saveEventChangeLog({
        eventId,
        companyId,
        changedBy: user.id,
        fieldName: 'נהג',
        oldValue: oldDriverName,
        newValue: newDriverName,
      })
      setShowDriverPicker(false)
      await loadEvent(true)
      await loadChangeLogs()
    } catch (err) {
      console.error('Error assigning event driver:', err)
      setAssignDriverError('שגיאה בשיבוץ הנהג')
    } finally {
      setAssigningDriver(false)
    }
  }

  const handleSavePrice = async (result: {
    enteredPrice: number
    priceResult: EventPriceResult
  }) => {
    if (!user || !companyId || !event) return

    setPriceSaving(true)
    setPriceError('')
    try {
      const oldFinal = event.final_price
      await updateEventPrice(eventId, {
        manualPrice: result.enteredPrice,
        finalPrice: result.priceResult.total,
        priceBreakdown: result.priceResult,
      })
      await saveEventChangeLog({
        eventId,
        companyId,
        changedBy: user.id,
        fieldName: 'מחיר',
        oldValue: formatLogPrice(oldFinal),
        newValue: formatLogPrice(result.priceResult.total),
      })
      await loadEvent(true)
      await loadChangeLogs()
      setIsEditingPrice(false)
    } catch (err) {
      console.error('Error saving event price:', err)
      setPriceError('שגיאה בשמירת המחיר')
    } finally {
      setPriceSaving(false)
    }
  }

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

  const canModify =
    event.status !== 'cancelled' && event.status !== 'completed'
  const canApproveQuoteEvent =
    event.status === 'quote' && canApproveQuote(user?.role)
  const isCancelled = event.status === 'cancelled'
  const isCompleted = event.status === 'completed'

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#33d4ff]/5 via-gray-50 to-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
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
            <div className="flex items-center gap-1 shrink-0">
              {canApproveQuoteEvent && (
                <button
                  type="button"
                  onClick={handleApproveQuote}
                  disabled={approvingQuote}
                  className="p-2 sm:px-3 sm:py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle size={18} />
                  <span className="hidden sm:inline">
                    {approvingQuote ? 'מאשר...' : 'אשר הצעה'}
                  </span>
                </button>
              )}
              {canModify && (
                <button
                  type="button"
                  onClick={() => {
                    setCompleteError('')
                    setShowCompleteModal(true)
                  }}
                  className="p-2 sm:px-3 sm:py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg text-sm flex items-center gap-2"
                >
                  <CheckCircle size={18} />
                  <span className="hidden sm:inline">סיים אירוע</span>
                </button>
              )}
              {canModify && (
                <button
                  type="button"
                  onClick={() => {
                    setCancelError('')
                    setCancelStep('reason')
                    setShowCancelModal(true)
                  }}
                  className="p-2 sm:px-3 sm:py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-2"
                >
                  <X size={18} />
                  <span className="hidden sm:inline">בטל אירוע</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {approveQuoteError && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {approveQuoteError}
          </div>
        </div>
      )}

      {assignDriverError && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {assignDriverError}
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 border-r-4 border-r-red-500 rounded-xl">
            <span className="text-red-500 text-lg">✕</span>
            <div>
              <p className="font-bold text-red-700 text-sm">אירוע זה בוטל</p>
              {event.cancellation_reason && (
                <p className="text-red-500 text-xs mt-0.5">{event.cancellation_reason}</p>
              )}
              {event.cancellation_details && (
                <p className="text-red-400 text-xs mt-0.5">{event.cancellation_details}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        <div className="flex gap-1 mb-4 sm:mb-6 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTabChange('details')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'details'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FileText size={16} />
            פרטים
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('history')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Clock size={16} />
            היסטוריה
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('documentation')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'documentation'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Image size={16} />
            תיעוד רכבים
          </button>
        </div>

        {activeTab === 'details' && (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            <div className="flex-1 space-y-3 sm:space-y-4">
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

              <InfoPanel icon={Clock} title="מועד האירוע">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>תאריך</FieldLabel>
                    <FieldValue>{formatEventDate(event.event_date)}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>שעות</FieldLabel>
                    <FieldValue>
                      {event.start_time && event.end_time
                        ? `${formatEventTime(event.start_time)} – ${formatEventTime(event.end_time)}`
                        : 'לא צוין'}
                    </FieldValue>
                  </div>
                </div>
              </InfoPanel>

              <InfoPanel icon={MapPin} title="מיקום">
                <p className="text-sm text-gray-800 leading-relaxed">
                  {event.location_address?.trim() || 'לא צוין'}
                </p>
              </InfoPanel>

              <InfoPanel icon={FileText} title="פרטים">
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {event.details?.trim() || 'לא צוין'}
                </p>
              </InfoPanel>
            </div>

            <div className="lg:w-80 space-y-4 sm:space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-[#33d4ff] text-white">
                  <h2 className="font-bold">נהג</h2>
                </div>
                <div className="p-4 sm:p-5">
                  {event.driver?.user?.full_name ? (
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                          <User size={24} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{event.driver.user.full_name}</p>
                          {event.driver.user.phone && (
                            <a
                              href={`tel:${event.driver.user.phone}`}
                              className="text-[#33d4ff] text-sm hover:underline"
                            >
                              {event.driver.user.phone}
                            </a>
                          )}
                        </div>
                      </div>
                      {canModify && (
                        <button
                          type="button"
                          onClick={openDriverPicker}
                          disabled={assigningDriver || driversLoading}
                          className="mt-4 w-full py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          שנה נהג
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Truck size={32} className="text-gray-300" />
                      </div>
                      <p className="text-gray-500 text-sm mb-4">לא שובץ נהג</p>
                      {canModify && (
                        <button
                          type="button"
                          onClick={openDriverPicker}
                          disabled={assigningDriver || driversLoading}
                          className="w-full py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] transition-colors disabled:opacity-50"
                        >
                          שבץ נהג
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isCompleted && event.completed_at && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm">
                  <p className="font-medium text-emerald-800 flex items-center gap-2">
                    <CheckCircle size={16} className="shrink-0" />
                    הושלם בתאריך {formatDateTime(event.completed_at)}
                  </p>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-800 text-white flex items-center justify-between gap-2">
                  <h2 className="font-bold flex items-center gap-2">
                    <Receipt size={18} />
                    סיכום מחיר
                  </h2>
                  {canModify && !isEditingPrice && (
                    <button
                      type="button"
                      onClick={() => {
                        setPriceError('')
                        setIsEditingPrice(true)
                      }}
                      className="flex items-center gap-1 text-xs text-white/90 hover:text-white font-medium shrink-0"
                    >
                      <Edit2 size={13} />
                      ערוך מחיר
                    </button>
                  )}
                </div>
                <div className="p-4 sm:p-5">
                  {isEditingPrice ? (
                    <>
                      {priceError && (
                        <p className="text-sm text-red-600 mb-2">{priceError}</p>
                      )}
                      <EventPriceEditor
                        key={`${event.id}-${event.updated_at}`}
                        initialBreakdown={event.price_breakdown}
                        initialManualPrice={event.manual_price}
                        vatRate={vatRate}
                        saving={priceSaving}
                        onSave={(result) => void handleSavePrice(result)}
                        onCancel={() => {
                          setPriceError('')
                          setIsEditingPrice(false)
                        }}
                      />
                    </>
                  ) : (
                    <EventPricingDisplay
                      variant="sidebar"
                      breakdown={event.price_breakdown}
                      manualPrice={event.manual_price}
                      finalPrice={event.final_price}
                      listPrice={event.list_price}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <History size={18} />
                היסטוריה
              </h2>
            </div>
            <div className="p-4 sm:p-5">
              <EventHistoryTimeline
                logs={changeLogs}
                loading={changeLogsLoading && !changeLogsLoaded}
              />
            </div>
          </div>
        )}

        {activeTab === 'documentation' && (
          <div className="space-y-4">
            {vehicles.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-8 sm:p-12 text-center text-gray-400">
                  <Image size={48} className="mx-auto mb-4 opacity-50" />
                  <p>טרם תועדו רכבים</p>
                </div>
              </div>
            ) : (
              vehicles.map((vehicle) => {
                const vehiclePhotos = photos.filter((p) => p.event_vehicle_id === vehicle.id)
                const beforePhotos = vehiclePhotos.filter((p) => p.phase === 'before')
                const afterPhotos = vehiclePhotos.filter((p) => p.phase === 'after')
                const summary = formatVehicleSummary(vehicle.vehicle_details)

                return (
                  <InfoPanel key={vehicle.id} icon={Truck} title={vehicle.plate_number}>
                    {summary && (
                      <p className="mb-2 text-sm text-gray-600">{summary}</p>
                    )}
                    {vehicle.notes && (
                      <p className="mb-3 text-sm text-gray-500">{vehicle.notes}</p>
                    )}
                    <div className="space-y-4 border-t border-gray-100 pt-3">
                      <VehiclePhaseDocumentation
                        title="לפני הגרירה"
                        photos={beforePhotos}
                        signedUrlByPhotoId={signedUrlByPhotoId}
                        signedUrlsLoading={signedUrlsLoading}
                        locationLat={vehicle.pickup_location_lat}
                        locationLng={vehicle.pickup_location_lng}
                        locationLabel="מיקום לפני"
                      />
                      <VehiclePhaseDocumentation
                        title="אחרי הפריקה"
                        photos={afterPhotos}
                        signedUrlByPhotoId={signedUrlByPhotoId}
                        signedUrlsLoading={signedUrlsLoading}
                        locationLat={vehicle.dropoff_location_lat}
                        locationLng={vehicle.dropoff_location_lng}
                        locationLabel="מיקום אחרי"
                      />
                    </div>
                  </InfoPanel>
                )
              })
            )}
          </div>
        )}
      </div>

      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-2xl overflow-hidden w-full max-w-[420px]"
            dir="rtl"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">לסיים את האירוע?</h2>
              <p className="text-gray-600 text-sm">
                האירוע יסומן כהושלם ולא ניתן יהיה לערוך אותו.
              </p>
              {completeError && (
                <p className="text-sm text-red-600 mt-3">{completeError}</p>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={() => {
                  setShowCompleteModal(false)
                  setCompleteError('')
                }}
                disabled={completing}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmComplete()}
                disabled={completing}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:bg-gray-300 transition-colors"
              >
                {completing ? 'מסיים...' : 'סיים אירוע'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-2xl overflow-hidden w-full max-w-[420px]"
            dir="rtl"
          >
            {cancelStep === 'reason' && (
              <>
                <div className="px-5 py-4 border-b border-gray-200 bg-red-600 text-white">
                  <h2 className="font-bold text-lg">ביטול אירוע</h2>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      סיבת ביטול *
                    </label>
                    <select
                      value={selectedCancellationReason}
                      onChange={(e) => setSelectedCancellationReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                    >
                      <option value="">בחר סיבה...</option>
                      {CANCELLATION_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      פירוט נוסף (אופציונלי)
                    </label>
                    <textarea
                      value={cancellationDetails}
                      onChange={(e) => setCancellationDetails(e.target.value)}
                      placeholder="נא לציין פרטים נוספים..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                    />
                  </div>
                  {cancelError && (
                    <p className="text-sm text-red-600">{cancelError}</p>
                  )}
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button
                    type="button"
                    onClick={closeCancelModal}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                  >
                    חזור
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelStep('confirm')}
                    disabled={!selectedCancellationReason}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    המשך
                  </button>
                </div>
              </>
            )}

            {cancelStep === 'confirm' && (
              <>
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} className="text-red-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800 mb-2">אישור ביטול</h2>
                  <p className="text-gray-600">האם אתה בטוח שברצונך לבטל את האירוע?</p>
                  {cancelError && (
                    <p className="text-sm text-red-600 mt-3">{cancelError}</p>
                  )}
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button
                    type="button"
                    onClick={() => setCancelStep('reason')}
                    disabled={cancelling}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    חזור
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmCancel()}
                    disabled={cancelling}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:bg-gray-300 transition-colors"
                  >
                    {cancelling ? 'מבטל...' : 'בטל אירוע'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showDriverPicker && driversLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {showDriverPicker && companyId && !driversLoading && event && (
        <DriverCalendarPicker
          companyId={companyId}
          drivers={drivers}
          requiredTruckTypes={[]}
          initialDate={
            event.event_date
              ? event.event_date.includes('T')
                ? event.event_date.split('T')[0]
                : event.event_date
              : undefined
          }
          initialTime={event.start_time ? formatEventTime(event.start_time) : undefined}
          onConfirm={(driverId) => {
            if (assigningDriver) return
            void handleAssignDriverConfirm(driverId)
          }}
          onClose={() => {
            if (assigningDriver) return
            setShowDriverPicker(false)
          }}
        />
      )}
    </div>
  )
}
