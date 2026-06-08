'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Camera,
  Car,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  Search,
  Sparkles,
  User,
} from 'lucide-react'
import { useAuth } from '@/app/lib/AuthContext'
import { getDriverByUserId } from '@/app/lib/queries/driver-tasks'
import {
  addEventVehicle,
  completeEvent,
  getDriverEvent,
  getEventVehicles,
  saveEventChangeLog,
  updateEventDriverStatus,
  type EventVehicle,
  type EventVehicleDetails,
  type EventWithDetails,
} from '@/app/lib/queries/events'
import type { VehicleLookupResult } from '@/app/lib/types'
import { normalizePlate } from '@/app/lib/utils/plate-number'
import { toWhatsApp } from '@/app/lib/utils/phone'
import { lookupVehicle } from '@/app/lib/vehicle-lookup'
import {
  fileToDownscaledDataUrl,
  recognizePlate,
  savePlateRecognition,
  uploadPlateImage,
} from '@/app/lib/queries/event-plate-capture'
import PlateCamera from './components/PlateCamera'

type DriverEventStage = 1 | 2 | 3 | 4 | 'completed'

type PendingPlateCapture = {
  imagePath: string
  rawResponse: unknown
  model: string
  gptPlateNumber: string | null
  lat: number | null
  lng: number | null
}

async function captureCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000 }
    )
  })
}

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

function getDriverStage(event: EventWithDetails): DriverEventStage {
  if (event.status === 'completed') return 'completed'
  if (!event.driver_status) return 1
  if (event.driver_status === 'received') return 2
  if (event.driver_status === 'departed') return 3
  if (event.driver_status === 'arrived') return 4
  return 1
}

const EVENT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'טיוטה', className: 'bg-cyan-100 text-cyan-700' },
  quote: { label: 'הצעת מחיר', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'אושר', className: 'bg-green-100 text-green-700' },
  completed: { label: 'הושלם', className: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'בוטל', className: 'bg-red-100 text-red-700' },
}

const STAGE_TITLES: Record<DriverEventStage, string> = {
  1: 'פרטי האירוע',
  2: 'בדרך לאירוע',
  3: 'הגעה',
  4: 'תיעוד רכבים',
  completed: 'האירוע הושלם',
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

function openPhone(phone: string) {
  window.open(`tel:${phone}`, '_self')
}

function openWhatsAppToContact(event: EventWithDetails, onTheWay = false) {
  const phone = event.contact_phone || event.customer?.phone
  if (!phone) return
  const name = event.contact_name || event.customer?.name || ''
  const waNumber = toWhatsApp(phone).replace(/^\+/, '')
  if (!waNumber) return
  const message = onTheWay
    ? `שלום${name ? ` ${name}` : ''}, אני בדרך אליך`
    : `שלום${name ? ` ${name}` : ''}, אני בדרך לאירוע המיוחד.`
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

const primaryButtonClass =
  'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#33d4ff] px-4 py-3 text-base font-bold text-white shadow-md active:scale-[0.98] transition-transform disabled:opacity-60'

const actionIconButtonClass =
  'flex h-10 w-10 items-center justify-center rounded-xl bg-[#33d4ff] text-white shadow-sm active:scale-[0.98] transition-transform'

export default function DriverEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [event, setEvent] = useState<EventWithDetails | null>(null)
  const [vehicles, setVehicles] = useState<EventVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [summaryOpen, setSummaryOpen] = useState(false)

  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [plateInput, setPlateInput] = useState('')
  const [vehicleNotes, setVehicleNotes] = useState('')
  const [lookupResult, setLookupResult] = useState<VehicleLookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [vehicleSaveLoading, setVehicleSaveLoading] = useState(false)
  const [vehicleError, setVehicleError] = useState('')
  const [driverId, setDriverId] = useState<string | null>(null)
  const [showPlateCamera, setShowPlateCamera] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [pendingPlate, setPendingPlate] = useState<PendingPlateCapture | null>(null)

  useEffect(() => {
    if (authLoading || !user?.id) return
    void loadEvent()
  }, [authLoading, user?.id, id])

  const loadVehicles = async (eventId: string) => {
    const list = await getEventVehicles(eventId)
    setVehicles(list)
  }

  const loadEvent = async (options?: { silent?: boolean }) => {
    if (!user?.id) return
    if (!options?.silent) {
      setLoading(true)
    }
    setNotFound(false)
    try {
      const driver = await getDriverByUserId(user.id)
      if (!driver) {
        setDriverId(null)
        setNotFound(true)
        setEvent(null)
        return
      }

      setDriverId(driver.id)

      const data = await getDriverEvent(id, driver.id)
      if (!data) {
        setNotFound(true)
        setEvent(null)
        return
      }

      setEvent(data)
      if (data.driver_status === 'arrived' && data.status !== 'completed') {
        await loadVehicles(data.id)
      } else if (data.status === 'completed') {
        await loadVehicles(data.id)
      }
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

  const runStatusAdvance = async (
    action: () => Promise<void>,
    log: { fieldName: string; oldValue: string | null; newValue: string }
  ) => {
    if (!user?.id || !event || actionLoading) return
    setActionLoading(true)
    setActionError('')
    try {
      await action()
      await saveEventChangeLog({
        eventId: event.id,
        companyId: event.company_id,
        changedBy: user.id,
        fieldName: log.fieldName,
        oldValue: log.oldValue,
        newValue: log.newValue,
      })
      await loadEvent({ silent: true })
    } catch (err) {
      console.error('Error updating driver event progress:', err)
      setActionError('שגיאה בעדכון הסטטוס, נסה שוב')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReceived = () =>
    runStatusAdvance(
      () => updateEventDriverStatus(event!.id, 'received', 'driver_received_at'),
      {
        fieldName: 'סטטוס נהג',
        oldValue: getDriverProgressLabel(event?.driver_status ?? null),
        newValue: 'הנהג קיבל את האירוע',
      }
    )

  const handleDeparted = () =>
    runStatusAdvance(
      () => updateEventDriverStatus(event!.id, 'departed', 'driver_departed_at'),
      {
        fieldName: 'סטטוס נהג',
        oldValue: getDriverProgressLabel(event?.driver_status ?? null),
        newValue: 'הנהג יצא לדרך',
      }
    )

  const handleArrived = () =>
    runStatusAdvance(
      () => updateEventDriverStatus(event!.id, 'arrived', 'driver_arrived_at'),
      {
        fieldName: 'סטטוס נהג',
        oldValue: getDriverProgressLabel(event?.driver_status ?? null),
        newValue: 'הנהג הגיע',
      }
    )

  const handleComplete = async () => {
    if (!user?.id || !event || actionLoading) return
    setActionLoading(true)
    setActionError('')
    try {
      await completeEvent(event.id, user.id)
      await saveEventChangeLog({
        eventId: event.id,
        companyId: event.company_id,
        changedBy: user.id,
        fieldName: 'סיום',
        oldValue: null,
        newValue: 'האירוע הושלם על ידי הנהג',
      })
      await loadEvent({ silent: true })
    } catch (err) {
      console.error('Error completing event:', err)
      setActionError('שגיאה בסיום האירוע, נסה שוב')
    } finally {
      setActionLoading(false)
    }
  }

  const resetVehicleForm = () => {
    setPlateInput('')
    setVehicleNotes('')
    setLookupResult(null)
    setVehicleError('')
    setPendingPlate(null)
  }

  const savePendingPlateDataset = async (
    confirmedPlate: string,
    ctx: PendingPlateCapture
  ) => {
    if (!event) return
    try {
      await savePlateRecognition({
        companyId: event.company_id,
        eventId: event.id,
        driverId,
        imagePath: ctx.imagePath,
        gptRawResponse: ctx.rawResponse,
        gptPlateNumber: ctx.gptPlateNumber,
        gptModel: ctx.model,
        confirmedPlateNumber: confirmedPlate,
        wasCorrected:
          confirmedPlate !== normalizePlate(ctx.gptPlateNumber ?? ''),
        captureLat: ctx.lat,
        captureLng: ctx.lng,
      })
    } catch (err) {
      console.error('Error saving plate recognition dataset:', err)
    }
  }

  const performPlateLookup = async (
    plate: string,
    datasetCtx?: PendingPlateCapture | null
  ) => {
    if (plate.length < 5) {
      setVehicleError('יש להזין מספר רישוי תקין')
      return
    }

    const ctx = datasetCtx ?? pendingPlate
    if (ctx) {
      await savePendingPlateDataset(plate, ctx)
      setPendingPlate(null)
    }

    setLookupLoading(true)
    setVehicleError('')
    try {
      const result = await lookupVehicle(plate)
      setLookupResult(result)
      if (!result.found) {
        setVehicleError('לא נמצאו פרטים — ניתן לשמור עם מספר הרישוי בלבד')
      }
    } catch (err) {
      console.error('Error looking up vehicle:', err)
      setVehicleError('שגיאה בחיפוש פרטי הרכב')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleLookupPlate = async () => {
    const plate = normalizePlate(plateInput)
    await performPlateLookup(plate)
  }

  const handlePlateCameraConfirm = async (file: File) => {
    if (!event) return

    setShowPlateCamera(false)
    setOcrLoading(true)
    setVehicleError('')

    try {
      const position = await captureCurrentPosition()
      const dataUrl = await fileToDownscaledDataUrl(file)

      const uploadPromise = uploadPlateImage(event.id, file).catch((err) => {
        console.error('Error uploading plate image for dataset:', err)
        return null
      })

      const [result, imagePath] = await Promise.all([
        recognizePlate(dataUrl),
        uploadPromise,
      ])

      const plate = normalizePlate(result.plateNumber)

      const pending: PendingPlateCapture = {
        imagePath: imagePath ?? '',
        rawResponse: result.rawResponse,
        model: result.model,
        gptPlateNumber: result.plateNumber || null,
        lat: position?.lat ?? null,
        lng: position?.lng ?? null,
      }

      setPendingPlate(pending)
      setPlateInput(plate)
      setLookupResult(null)

      if (plate.length >= 5) {
        await performPlateLookup(plate, pending)
      }
    } catch (err) {
      console.error('Error in plate camera OCR flow:', err)
      setVehicleError('שגיאה בזיהוי — ניתן להקליד ידנית')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleSaveVehicle = async () => {
    if (!user?.id || !event) return
    const plate = normalizePlate(plateInput)
    if (plate.length < 5) {
      setVehicleError('יש להזין מספר רישוי תקין')
      return
    }

    setVehicleSaveLoading(true)
    setVehicleError('')
    try {
      const vehicleDetails: EventVehicleDetails = lookupResult?.data
        ? (lookupResult.data as unknown as Record<string, unknown>)
        : null

      await addEventVehicle({
        eventId: event.id,
        companyId: event.company_id,
        plateNumber: plate,
        vehicleDetails,
        notes: vehicleNotes.trim() || null,
        createdBy: user.id,
      })

      await saveEventChangeLog({
        eventId: event.id,
        companyId: event.company_id,
        changedBy: user.id,
        fieldName: 'רכב',
        oldValue: null,
        newValue: `נוסף רכב ${plate}`,
      })

      await loadVehicles(event.id)
      resetVehicleForm()
      setShowVehicleForm(true)
    } catch (err) {
      console.error('Error saving event vehicle:', err)
      setVehicleError('שגיאה בשמירת הרכב, נסה שוב')
    } finally {
      setVehicleSaveLoading(false)
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

  const stage = getDriverStage(event)
  const status = EVENT_STATUS_CONFIG[event.status] ?? {
    label: event.status,
    className: 'bg-gray-100 text-gray-600',
  }
  const customerName = event.customer?.name || 'ללא לקוח'
  const customerPhone = event.customer?.phone
  const contactPhone = event.contact_phone || customerPhone
  const hasLocation = Boolean(event.location_address?.trim())
  const hasNavigationTarget =
    hasLocation || (event.location_lat != null && event.location_lng != null)
  const startTimeLabel = formatEventTime(event.start_time)
  const endTimeLabel = formatEventTime(event.end_time)
  const driverProgressLabel =
    event.status === 'completed' ? 'הושלם' : getDriverProgressLabel(event.driver_status)

  const renderCompactSummary = () => (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setSummaryOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-4 text-right"
      >
        <span className="text-sm font-medium text-gray-800">פרטי קשר ומיקום</span>
        {summaryOpen ? (
          <ChevronUp size={18} className="shrink-0 text-gray-400" />
        ) : (
          <ChevronDown size={18} className="shrink-0 text-gray-400" />
        )}
      </button>
      {!summaryOpen && (
        <div className="border-t border-gray-100 px-4 pb-3 pt-0">
          <p className="truncate text-xs text-gray-500">{customerName}</p>
          {hasLocation && (
            <p className="truncate text-xs text-gray-600">{event.location_address}</p>
          )}
        </div>
      )}
      {summaryOpen && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500">לקוח</p>
            <p className="text-sm font-medium text-gray-800">{customerName}</p>
          </div>
          {hasLocation && (
            <div>
              <p className="text-xs text-gray-500">מיקום</p>
              <p className="text-sm text-gray-700">{event.location_address}</p>
            </div>
          )}
          {(event.contact_name || event.contact_phone) && (
            <div>
              <p className="text-xs text-gray-500">איש קשר</p>
              <p className="text-sm text-gray-800">{event.contact_name || '—'}</p>
              {event.contact_phone && (
                <p className="text-sm text-gray-500 dir-ltr text-right">{event.contact_phone}</p>
              )}
            </div>
          )}
          {hasNavigationTarget && (
            <div className="flex flex-row gap-2">
              <button
                type="button"
                onClick={() => openWazeForEvent(event)}
                className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-50 py-2 text-sm font-medium text-blue-600"
              >
                <Navigation size={15} />
                Waze
              </button>
              <button
                type="button"
                onClick={() => openGoogleMapsForEvent(event)}
                className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-50 py-2 text-sm font-medium text-green-700"
              >
                <MapPin size={15} />
                Maps
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const renderPrimaryButton = (label: string, onClick: () => void) => (
    <>
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={actionLoading}
        className={primaryButtonClass}
      >
        {actionLoading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            מעדכן...
          </>
        ) : (
          label
        )}
      </button>
    </>
  )

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100 pb-20">
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
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 truncate text-base font-bold">
              <Sparkles size={16} className="shrink-0" />
              אירוע מיוחד
            </span>
            <p className="truncate text-xs text-white/85">{STAGE_TITLES[stage]}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>
        <p className="mt-2 text-xs text-white/90">
          סטטוס נהג: <span className="font-medium">{driverProgressLabel}</span>
        </p>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        {/* SCREEN 1 — task info */}
        {stage === 1 && (
          <>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-medium text-gray-500">לקוח</p>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-gray-800">{customerName}</p>
                  {customerPhone && (
                    <p className="mt-0.5 truncate text-sm text-gray-500 dir-ltr text-right">
                      {customerPhone}
                    </p>
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
                      onClick={() => openWhatsAppToContact(event)}
                      className={actionIconButtonClass}
                      aria-label="שלח וואטסאפ"
                    >
                      <MessageCircle size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-medium text-gray-500">מועד</p>
              <div className="flex items-center gap-3 text-gray-800">
                <Calendar size={18} className="shrink-0 text-cyan-600" />
                <div>
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
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-50 py-2.5 text-sm font-medium text-blue-600"
                  >
                    <Navigation size={16} />
                    Waze
                  </button>
                  <button
                    type="button"
                    onClick={() => openGoogleMapsForEvent(event)}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-50 py-2.5 text-sm font-medium text-green-700"
                  >
                    <MapPin size={16} />
                    Maps
                  </button>
                </div>
              )}
            </div>

            {(event.contact_name || event.contact_phone) && (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-medium text-gray-500">איש קשר</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-gray-800">
                    <User size={16} className="shrink-0 text-gray-400" />
                    <span className="truncate text-sm font-medium">
                      {event.contact_name || '—'}
                    </span>
                  </div>
                  {event.contact_phone && (
                    <button
                      type="button"
                      onClick={() => openPhone(event.contact_phone!)}
                      className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#33d4ff] px-3 text-sm font-medium text-white shadow-sm"
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

            {event.details?.trim() && (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-medium text-gray-500">הנחיות / פרטים</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {event.details}
                </p>
              </div>
            )}

            {renderPrimaryButton('קיבלתי את האירוע', handleReceived)}
          </>
        )}

        {/* SCREEN 2 — en route */}
        {stage === 2 && (
          <>
            {renderCompactSummary()}

            <div className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm space-y-3">
              <p className="text-sm font-medium text-gray-800">לפני היציאה</p>
              {contactPhone ? (
                <button
                  type="button"
                  onClick={() => openWhatsAppToContact(event, true)}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-sm font-medium text-emerald-700"
                >
                  <MessageCircle size={18} />
                  שלח וואטסאפ — אני בדרך
                </button>
              ) : (
                <p className="text-sm text-gray-500">אין מספר טלפון לאיש קשר</p>
              )}
              {hasNavigationTarget && (
                <div className="flex flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => openWazeForEvent(event)}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-50 py-2.5 text-sm font-medium text-blue-600"
                  >
                    <Navigation size={16} />
                    נווט עם Waze
                  </button>
                  <button
                    type="button"
                    onClick={() => openGoogleMapsForEvent(event)}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-50 py-2.5 text-sm font-medium text-green-700"
                  >
                    <MapPin size={16} />
                    Google Maps
                  </button>
                </div>
              )}
            </div>

            {renderPrimaryButton('יצאתי לדרך', handleDeparted)}
          </>
        )}

        {/* SCREEN 3 — arrival */}
        {stage === 3 && (
          <>
            {renderCompactSummary()}
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-700">
                לאחר ההגעה ליעד, אשר הגעה והמשך לתיעוד הרכבים.
              </p>
            </div>
            {renderPrimaryButton('הגעתי', handleArrived)}
          </>
        )}

        {/* SCREEN 4 — vehicles */}
        {stage === 4 && (
          <>
            {renderCompactSummary()}

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">רכבים באירוע</p>
                <span className="text-xs text-gray-500">{vehicles.length} רכבים</span>
              </div>

              {vehicles.length === 0 ? (
                <p className="mb-3 text-sm text-gray-500">טרם נוספו רכבים</p>
              ) : (
                <ul className="mb-3 space-y-2">
                  {vehicles.map((vehicle) => {
                    const summary = formatVehicleSummary(vehicle.vehicle_details)
                    return (
                      <li
                        key={vehicle.id}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <Car size={16} className="mt-0.5 shrink-0 text-cyan-600" />
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm font-bold text-gray-800 dir-ltr text-right">
                              {vehicle.plate_number}
                            </p>
                            {summary && (
                              <p className="mt-0.5 text-xs text-gray-600">{summary}</p>
                            )}
                            {vehicle.notes && (
                              <p className="mt-1 text-xs text-gray-500">{vehicle.notes}</p>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {!showVehicleForm ? (
                <button
                  type="button"
                  onClick={() => {
                    resetVehicleForm()
                    setShowVehicleForm(true)
                  }}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cyan-200 bg-cyan-50/50 py-2.5 text-sm font-medium text-cyan-700"
                >
                  <Plus size={18} />
                  הוסף רכב
                </button>
              ) : (
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/30 p-3 space-y-3">
                  <p className="text-sm font-medium text-gray-800">רכב חדש</p>
                  <button
                    type="button"
                    onClick={() => setShowPlateCamera(true)}
                    disabled={ocrLoading}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#33d4ff] font-medium text-white disabled:opacity-60"
                  >
                    <Camera size={18} />
                    צלם לוחית
                  </button>
                  {ocrLoading && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <Loader2 size={16} className="animate-spin text-cyan-600" />
                      מפענח לוחית...
                    </div>
                  )}
                  <input
                    type="text"
                    value={plateInput}
                    onChange={(e) => {
                      setPlateInput(e.target.value)
                      setLookupResult(null)
                    }}
                    placeholder="מספר רישוי"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dir-ltr text-right focus:border-[#33d4ff] focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/20"
                  />
                  <button
                    type="button"
                    onClick={() => void handleLookupPlate()}
                    disabled={lookupLoading || normalizePlate(plateInput).length < 5}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-white border border-gray-200 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50"
                  >
                    {lookupLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Search size={16} />
                    )}
                    חפש פרטים
                  </button>

                  {lookupResult?.found && lookupResult.data && (
                    <div className="rounded-xl bg-white border border-gray-100 p-3 text-sm text-gray-700">
                      <p className="font-medium text-gray-800 mb-1">פרטי הרכב</p>
                      <p>{formatVehicleSummary(lookupResult.data as EventVehicleDetails)}</p>
                    </div>
                  )}

                  <textarea
                    value={vehicleNotes}
                    onChange={(e) => setVehicleNotes(e.target.value)}
                    placeholder="הערות לרכב"
                    rows={2}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm resize-none focus:border-[#33d4ff] focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/20"
                  />

                  {vehicleError && (
                    <p className="text-sm text-red-600">{vehicleError}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowVehicleForm(false)
                        resetVehicleForm()
                      }}
                      className="flex-1 min-h-[44px] rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600"
                    >
                      ביטול
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveVehicle()}
                      disabled={vehicleSaveLoading || normalizePlate(plateInput).length < 5}
                      className="flex-[2] min-h-[44px] rounded-xl bg-[#33d4ff] text-sm font-bold text-white disabled:opacity-60"
                    >
                      {vehicleSaveLoading ? 'שומר...' : 'שמור רכב'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {renderPrimaryButton('סיים אירוע', handleComplete)}
          </>
        )}

        {/* COMPLETED */}
        {stage === 'completed' && (
          <>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center shadow-sm">
              <p className="text-lg font-bold text-emerald-800">האירוע הושלם</p>
              <p className="mt-1 text-sm text-emerald-700">תודה! האירוע נסגר בהצלחה.</p>
            </div>

            {vehicles.length > 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="mb-3 text-sm font-semibold text-gray-800">
                  רכבים שתועדו ({vehicles.length})
                </p>
                <ul className="space-y-2">
                  {vehicles.map((vehicle) => (
                    <li
                      key={vehicle.id}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-3 font-mono text-sm dir-ltr text-right"
                    >
                      {vehicle.plate_number}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {renderCompactSummary()}
          </>
        )}
      </div>

      {showPlateCamera && (
        <PlateCamera
          onConfirm={(file) => void handlePlateCameraConfirm(file)}
          onCancel={() => setShowPlateCamera(false)}
        />
      )}
    </div>
  )
}
