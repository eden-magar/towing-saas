'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowRight,
  Loader2,
  MapPin,
  Trash2,
  Truck,
} from 'lucide-react'
import { useAuth } from '@/app/lib/AuthContext'
import { getCustomerForUser } from '@/app/lib/queries/customer-portal'
import { getFullCustomerTowRequest } from '@/app/lib/queries/customer-tow-requests'
import {
  requestPendingCustomerTowRequestCancellation,
  getPendingCancellationRequestForRequest,
  withdrawCustomerTowCancellationRequest,
  type CustomerTowCancellationRequest,
} from '@/app/lib/queries/customer-tow-cancellation-requests'
import { canSubmitPortalOrders } from '@/app/lib/utils/portal-roles'
import type {
  CustomerTowRequestFull,
  CustomerTowRequestPoint,
  CustomerTowRequestPortalType,
  CustomerTowRequestVehicle,
} from '@/app/lib/types'
import { supabase } from '@/app/lib/supabase'
import { PORTAL_ERROR_BANNER_CLASS } from '@/app/components/customer-portal/portalRequestActionStyles'

/**
 * Narrow the content column (layout caps at max-w-6xl, far wider than this
 * content needs). At max-w-2xl the two detail columns actually fill, so short
 * values sit next to their labels instead of floating in an empty field.
 */
const PAGE = 'space-y-4 max-w-2xl mx-auto'

/** Single card — sections divided internally, never separate boxes. */
const CARD = 'bg-white rounded-xl border border-gray-200 divide-y divide-gray-200'

/**
 * Asymmetric rhythm carries the section boundaries: a wide band above each
 * heading (pt-8 + previous pb-5 ≈ 52px) versus a tight gap from the heading to
 * its own content (mb-3 ≈ 12px), so each heading groups with what follows it.
 * The divider is only supporting evidence.
 */
const SECTION = 'px-5 pt-8 pb-5'

/** Section headings sit distinctly heavier than the content beneath. */
const SECTION_TITLE = 'text-sm font-bold text-gray-900'

const FIELD_LABEL = 'text-xs text-gray-500 leading-none'

const FIELD_VALUE = 'text-[15px] font-medium text-gray-900 mt-1 leading-snug'

function formatScheduledAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function portalTowTypeLabel(towType: CustomerTowRequestPortalType): string {
  if (towType === 'exchange') return 'תקין תקול'
  if (towType === 'custom') return 'מותאם'
  return 'גרירה פשוטה'
}

function pointTypeLabel(pointType: CustomerTowRequestPoint['point_type']): string {
  switch (pointType) {
    case 'pickup':
      return 'איסוף'
    case 'dropoff':
      return 'מסירה'
    case 'exchange':
      return 'נקודת החלפה'
    case 'stop':
      return 'עצירה'
    default:
      return pointType
  }
}

function storagePointLabel(point: CustomerTowRequestPoint): string | null {
  if (!point.is_storage) return null
  if (point.point_type === 'dropoff') return 'לאחסנה'
  if (point.point_type === 'pickup') return 'מאחסנה'
  return 'מאחסנה'
}

const BACK_LINK_CLASS =
  'inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors'

function vehicleMakeModel(v: CustomerTowRequestVehicle): string {
  return [v.manufacturer, v.model].filter(Boolean).join(' ')
}

function statusChip(status: string | undefined): { line: string; className: string } {
  if (status === 'dismissed') {
    return {
      line: 'בוטלה',
      className: 'bg-red-50 text-red-700 border border-red-200',
    }
  }
  if (status === 'converted') {
    return {
      line: 'הומרה לגרירה',
      className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    }
  }
  return {
    line: 'ממתינה לאישור',
    className: 'bg-amber-50 text-amber-800 border border-amber-200',
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={FIELD_LABEL}>{label}</dt>
      <dd className={FIELD_VALUE}>{children}</dd>
    </div>
  )
}

/**
 * Portal-only request detail. Staff keep CustomerTowRequestDetailsPanel unchanged.
 */
export default function CustomerRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const requestId = typeof params.id === 'string' ? params.id : ''

  const [userRole, setUserRole] = useState<string>('viewer')
  const [request, setRequest] = useState<CustomerTowRequestFull | null>(null)
  const [pendingCancel, setPendingCancel] =
    useState<CustomerTowCancellationRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)

  const canCancel = canSubmitPortalOrders(userRole)

  const reload = useCallback(async () => {
    if (!requestId) return
    const [data, cancel] = await Promise.all([
      getFullCustomerTowRequest(requestId),
      getPendingCancellationRequestForRequest(requestId),
    ])
    setRequest(data)
    setPendingCancel(cancel)
  }, [requestId])

  useEffect(() => {
    if (authLoading || !user || !requestId) return

    const load = async () => {
      const info = await getCustomerForUser(user.id)
      if (info) setUserRole(info.customerUserRole || 'viewer')
      await reload()
      setLoading(false)
    }

    void load()
  }, [user, authLoading, requestId, reload])

  useEffect(() => {
    if (!requestId) return
    const channel = supabase
      .channel(`customer-request-${requestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_tow_requests',
          filter: `id=eq.${requestId}`,
        },
        () => {
          void reload()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_tow_cancellation_requests',
          filter: `customer_tow_request_id=eq.${requestId}`,
        },
        () => {
          void reload()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [requestId, reload])

  const handleCancel = async () => {
    if (!requestId || !request || !user) return
    setCancelBusy(true)
    setCancelError('')
    try {
      await requestPendingCustomerTowRequestCancellation({
        companyId: request.request.company_id,
        customerId: request.request.customer_id,
        customerTowRequestId: requestId,
        requestedByUserId: user.id,
      })
      setShowCancelConfirm(false)
      await reload()
    } catch (err) {
      console.error('Error requesting pending cancellation:', err)
      setCancelError(
        err instanceof Error && err.message
          ? err.message
          : 'לא ניתן לשלוח בקשת ביטול. נסו שוב.'
      )
    } finally {
      setCancelBusy(false)
    }
  }

  const handleWithdrawCancel = async () => {
    if (!pendingCancel) return
    setWithdrawBusy(true)
    try {
      await withdrawCustomerTowCancellationRequest(pendingCancel.id)
      await reload()
    } catch (err) {
      console.error('Error withdrawing cancellation request:', err)
    } finally {
      setWithdrawBusy(false)
    }
  }

  const status = request?.request.status
  const isPending = status === 'pending'
  const isDismissed = status === 'dismissed'
  const chip = statusChip(status)
  const hasPendingCancel = !!pendingCancel
  // Trigger only when withdrawable and not already awaiting a decision.
  const showCancelAction = isPending && canCancel && !hasPendingCancel
  const vehicles = request?.vehicles ?? []
  const points = request?.points ?? []
  const isExchange = request?.request.tow_type === 'exchange'
  const orderedVehicles = isExchange
    ? [
        ...vehicles.filter((v) => v.is_working),
        ...vehicles.filter((v) => !v.is_working),
      ]
    : vehicles

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-20" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-[#33d4ff]" />
      </div>
    )
  }

  if (!requestId || !request) {
    return (
      <div className={PAGE} dir="rtl">
        <button type="button" onClick={() => router.push('/customer')} className={BACK_LINK_CLASS}>
          <ArrowRight size={16} />
          חזרה לרשימה
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-500">הבקשה לא נמצאה</p>
        </div>
      </div>
    )
  }

  const req = request.request
  const orderNumber =
    req.customer_order_number?.trim() || req.order_number?.trim() || ''
  const headline = orderNumber ? `#${orderNumber}` : portalTowTypeLabel(req.tow_type)

  return (
    <div className={PAGE} dir="rtl">
      {/* Header group: back nav sits with the headline, not orphaned above it */}
      <div className="space-y-2">
        {/* 2. Navigation — readable, aligned with the content column */}
        <button type="button" onClick={() => router.push('/customer')} className={BACK_LINK_CLASS}>
          <ArrowRight size={16} />
          חזרה לרשימה
        </button>

        {/* 1. Headline = the order number; status sits beside it */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 leading-none">
                {headline}
              </h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${chip.className}`}
              >
                {chip.line}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1.5">
              {portalTowTypeLabel(req.tow_type)}
              {orderNumber && req.order_number?.trim() && req.customer_order_number?.trim()
                ? ` · מס׳ מערכת ${req.order_number.trim()}`
                : ''}
            </p>
            {isPending && !canCancel && (
              <p className="text-xs text-gray-400 mt-1.5">
                צפייה בלבד — ביטול זמין למנהל חשבון / מנהל הזמנות
              </p>
            )}
          </div>

          {/* 2. Cancel — secondary, but clearly interactive: border + darker text */}
          {showCancelAction && (
            <button
              type="button"
              onClick={() => {
                setCancelError('')
                setShowCancelConfirm(true)
              }}
              className="inline-flex items-center gap-1.5 self-start shrink-0 px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <Trash2 size={15} className="text-gray-500" />
              ביטול הבקשה
            </button>
          )}
        </div>
      </div>

      {isDismissed && (
        <div className={PORTAL_ERROR_BANNER_CLASS}>
          <p>בקשה זו בוטלה ולא תומר לגרירה</p>
        </div>
      )}

      {/* Pending withdrawal — awaiting staff decision; offer to undo */}
      {isPending && hasPendingCancel && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900">
              בקשת ביטול נשלחה — ממתינה לאישור החברה
            </p>
            <p className="text-xs text-amber-800/80 mt-0.5">
              ההזמנה תיוותר פעילה עד שנציג יאשר את הביטול.
            </p>
          </div>
          {canCancel && (
            <button
              type="button"
              onClick={() => void handleWithdrawCancel()}
              disabled={withdrawBusy}
              className="shrink-0 self-start px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {withdrawBusy ? 'מבטל...' : 'ביטול בקשת הביטול'}
            </button>
          )}
        </div>
      )}

      {/* 3. One card, internal dividers between sections */}
      <div className={CARD}>
        {/* Order details — 6. two columns fill the width */}
        <section className={SECTION}>
          <h2 className={`${SECTION_TITLE} mb-3`}>פרטי הזמנה</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="מועד מבוקש">{formatScheduledAt(req.scheduled_at)}</Field>
            {req.scheduled_end_at ? (
              <Field label="מועד סיום">{formatScheduledAt(req.scheduled_end_at)}</Field>
            ) : null}
            <Field label="מחלקה">{req.department?.trim() || '—'}</Field>
            <Field label="מזמין">
              {[req.orderer, req.orderer_phone].filter((v) => v?.trim()).join(' · ') ||
                '—'}
            </Field>
            {req.notes?.trim() ? (
              <div className="col-span-2 min-w-0">
                <dt className={FIELD_LABEL}>הערות</dt>
                <dd className={`${FIELD_VALUE} font-normal whitespace-pre-wrap`}>
                  {req.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        {/* Vehicles */}
        <section className={SECTION}>
          <div className="flex items-center gap-1.5 mb-3">
            <Truck size={15} className="text-gray-500" />
            <h2 className={SECTION_TITLE}>רכבים ({vehicles.length})</h2>
          </div>
          {orderedVehicles.length === 0 ? (
            <p className="text-sm text-gray-400">אין רכבים בבקשה</p>
          ) : (
            <ul className="space-y-2.5">
              {orderedVehicles.map((vehicle) => {
                const makeModel = vehicleMakeModel(vehicle)
                return (
                  <li key={vehicle.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-gray-900">
                        {vehicle.plate_number}
                      </span>
                      {makeModel ? (
                        <span className="text-sm text-gray-600">{makeModel}</span>
                      ) : null}
                      {vehicle.year ? (
                        <span className="text-xs text-gray-400">{vehicle.year}</span>
                      ) : null}
                      {vehicle.color ? (
                        <span className="text-xs text-gray-400">{vehicle.color}</span>
                      ) : null}
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                        {vehicle.is_working ? 'תקין' : 'תקול'}
                      </span>
                      {isExchange && (
                        <span className="text-[11px] text-gray-400">
                          {vehicle.is_working
                            ? 'נכנס (מהאחסנה / ללקוח)'
                            : 'יוצא (מהלקוח)'}
                        </span>
                      )}
                    </div>
                    {vehicle.tow_reason ? (
                      <p className="mt-1 text-sm text-gray-600">
                        <span className="text-xs text-gray-500">תקלות · </span>
                        {vehicle.tow_reason}
                      </p>
                    ) : null}
                    {(vehicle.chassis ||
                      vehicle.total_weight != null ||
                      vehicle.vehicle_code) && (
                      <p className="mt-1 text-xs text-gray-500">
                        {[
                          vehicle.vehicle_code ? `קוד ${vehicle.vehicle_code}` : null,
                          vehicle.chassis ? `שלדה ${vehicle.chassis}` : null,
                          vehicle.total_weight != null
                            ? `${Number(vehicle.total_weight).toLocaleString('he-IL')} ק״ג`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    {vehicle.notes ? (
                      <p className="mt-1 text-xs text-gray-500">{vehicle.notes}</p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* 5. Addresses as a route — connector between points (tow-detail idea) */}
        <section className={SECTION}>
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin size={15} className="text-gray-500" />
            <h2 className={SECTION_TITLE}>מסלול ({points.length})</h2>
          </div>
          {points.length === 0 ? (
            <p className="text-sm text-gray-400">אין נקודות בבקשה</p>
          ) : (
            <div className="relative">
              {points.map((point, idx) => {
                const storageLabel = storagePointLabel(point)
                const isLast = idx === points.length - 1
                return (
                  <div key={point.id} className="relative flex gap-3">
                    {!isLast && (
                      <div className="absolute right-[13px] top-7 bottom-0 w-0.5 bg-gray-200" />
                    )}
                    <div className="relative z-10 flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                      {idx + 1}
                    </div>
                    <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">
                          {pointTypeLabel(point.point_type)}
                        </span>
                        {storageLabel && (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                            {storageLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-[15px] font-medium text-gray-900 leading-snug mt-0.5">
                        {point.address?.trim() || '—'}
                      </p>
                      {(point.contact_name || point.contact_phone) && (
                        <p className="mt-1 text-sm text-gray-600">
                          {[point.contact_name, point.contact_phone]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      {(point.recipient_name || point.recipient_phone) && (
                        <p className="mt-0.5 text-sm text-gray-500">
                          מקבל:{' '}
                          {[point.recipient_name, point.recipient_phone]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      {point.notes ? (
                        <p className="mt-1 text-xs text-gray-500">{point.notes}</p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Confirm — same pattern as contacts/addresses delete */}
      {showCancelConfirm && showCancelAction && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">ביטול הבקשה</h2>
              <p className="text-gray-600">
                בקשת ביטול תישלח לחברה לאישור. ההזמנה תיוותר פעילה עד שנציג יאשר. להמשיך?
              </p>
              {cancelError && (
                <p className="mt-3 text-sm text-red-600">{cancelError}</p>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={() => {
                  if (cancelBusy) return
                  setShowCancelConfirm(false)
                  setCancelError('')
                }}
                disabled={cancelBusy}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={cancelBusy}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cancelBusy ? 'שולח...' : 'שלח בקשת ביטול'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
