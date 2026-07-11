'use client'

/**
 * Read-only view of a pending customer tow request (simple or exchange).
 * Opened on demand from the dashboard "בקשות נכנסות" queue modal.
 */

import { useEffect, useState } from 'react'
import { ClipboardList, Loader2, MapPin, Truck } from 'lucide-react'
import { getFullCustomerTowRequest } from '@/app/lib/queries/customer-tow-requests'
import type {
  CustomerTowRequestFull,
  CustomerTowRequestPoint,
  CustomerTowRequestPortalType,
  CustomerTowRequestVehicle,
} from '@/app/lib/types'

type CustomerTowRequestDetailsPanelProps = {
  requestId: string
  /** Display name when already known (e.g. from the queue row). */
  customerName?: string | null
  className?: string
  /**
   * When true, omit the outer card chrome / collapse control — for use inside
   * a modal that already provides a title shell.
   */
  embedded?: boolean
}

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

function portalTowTypeBadge(towType: CustomerTowRequestPortalType): {
  label: string
  className: string
} | null {
  if (towType === 'exchange') {
    return {
      label: 'תקין תקול',
      className: 'bg-violet-50 text-violet-800 border-violet-200',
    }
  }
  if (towType === 'custom') {
    return {
      label: 'מותאם',
      className: 'bg-slate-50 text-slate-700 border-slate-200',
    }
  }
  return {
    label: 'גרירה פשוטה',
    className: 'bg-gray-50 text-gray-600 border-gray-200',
  }
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

function vehicleMakeModel(v: CustomerTowRequestVehicle): string {
  return [v.manufacturer, v.model].filter(Boolean).join(' ')
}

function VehicleRow({
  vehicle,
  emphasizeRoles,
}: {
  vehicle: CustomerTowRequestVehicle
  emphasizeRoles: boolean
}) {
  const makeModel = vehicleMakeModel(vehicle)
  const isWorking = vehicle.is_working

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-right ${
        isWorking
          ? 'border-emerald-200 bg-emerald-50/60'
          : 'border-red-200 bg-red-50/60'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 justify-start">
        <span className="font-semibold text-gray-900 text-sm">{vehicle.plate_number}</span>
        {makeModel ? (
          <span className="text-xs text-gray-500">{makeModel}</span>
        ) : null}
        {vehicle.year ? (
          <span className="text-xs text-gray-400">{vehicle.year}</span>
        ) : null}
        {vehicle.color ? (
          <span className="text-xs text-gray-400">{vehicle.color}</span>
        ) : null}
        <span
          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
            isWorking
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {isWorking ? 'תקין' : 'תקול'}
        </span>
        {emphasizeRoles && (
          <span className="text-[11px] font-medium text-gray-500">
            {isWorking ? 'נכנס (מהאחסנה / ללקוח)' : 'יוצא (מהלקוח)'}
          </span>
        )}
      </div>
      {vehicle.tow_reason ? (
        <p className="mt-1.5 text-xs text-gray-600">
          <span className="font-medium text-gray-500">תקלות: </span>
          {vehicle.tow_reason}
        </p>
      ) : null}
      {vehicle.notes ? (
        <p className="mt-1 text-xs text-gray-500">{vehicle.notes}</p>
      ) : null}
    </div>
  )
}

function PointRow({ point }: { point: CustomerTowRequestPoint }) {
  const storageLabel = storagePointLabel(point)

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-right">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-gray-700">
          {pointTypeLabel(point.point_type)}
        </span>
        <span className="text-[10px] text-gray-400">#{point.point_order + 1}</span>
        {storageLabel && (
          <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-cyan-50 text-cyan-800 border border-cyan-200">
            {storageLabel}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-800 flex items-start gap-1.5">
        <MapPin size={14} className="shrink-0 mt-0.5 text-gray-400" />
        <span>{point.address?.trim() || '—'}</span>
      </p>
      {(point.contact_name || point.contact_phone) && (
        <p className="mt-1 text-xs text-gray-500">
          {[point.contact_name, point.contact_phone].filter(Boolean).join(' · ')}
        </p>
      )}
      {(point.recipient_name || point.recipient_phone) && (
        <p className="mt-0.5 text-xs text-gray-500">
          מקבל:{' '}
          {[point.recipient_name, point.recipient_phone].filter(Boolean).join(' · ')}
        </p>
      )}
      {point.notes ? (
        <p className="mt-1 text-xs text-gray-500">{point.notes}</p>
      ) : null}
    </div>
  )
}

export function CustomerTowRequestDetailsPanel({
  requestId,
  customerName,
  className = '',
  embedded = false,
}: CustomerTowRequestDetailsPanelProps) {
  const [full, setFull] = useState<CustomerTowRequestFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')

    getFullCustomerTowRequest(requestId)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setLoadError('בקשת הגרירה לא נמצאה')
          setFull(null)
          return
        }
        setFull(data)
      })
      .catch((err) => {
        console.error('Error loading customer tow request details:', err)
        if (!cancelled) {
          setLoadError('שגיאה בטעינת פרטי הבקשה')
          setFull(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [requestId])

  const typeBadge = full ? portalTowTypeBadge(full.request.tow_type) : null
  const isExchange = full?.request.tow_type === 'exchange'
  const vehicles = full?.vehicles ?? []
  const points = full?.points ?? []

  const body = (
    <div className="p-4 space-y-4">
      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin text-cyan-600" />
          טוען פרטי בקשה...
        </div>
      )}

      {!loading && loadError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {loadError}
        </p>
      )}

      {!loading && full && (
        <>
          {embedded && typeBadge && (
            <div className="flex justify-start">
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold border ${typeBadge.className}`}
              >
                {typeBadge.label}
              </span>
            </div>
          )}

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-right">
            <div>
              <span className="text-xs text-gray-500">לקוח</span>
              <p className="font-medium text-gray-900">
                {customerName?.trim() || '—'}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">מס׳ הזמנת לקוח</span>
              <p className="font-medium text-gray-900">
                {full.request.customer_order_number?.trim() || '—'}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">מועד מבוקש</span>
              <p className="font-medium text-gray-900">
                {formatScheduledAt(full.request.scheduled_at)}
              </p>
            </div>
            {full.request.scheduled_end_at && (
              <div>
                <span className="text-xs text-gray-500">מועד סיום</span>
                <p className="font-medium text-gray-900">
                  {formatScheduledAt(full.request.scheduled_end_at)}
                </p>
              </div>
            )}
            <div>
              <span className="text-xs text-gray-500">מחלקה</span>
              <p className="font-medium text-gray-900">
                {full.request.department?.trim() || '—'}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">מזמין</span>
              <p className="font-medium text-gray-900">
                {[full.request.orderer, full.request.orderer_phone]
                  .filter((v) => v?.trim())
                  .join(' · ') || '—'}
              </p>
            </div>
            {full.request.notes?.trim() && (
              <div className="sm:col-span-2">
                <span className="text-xs text-gray-500">הערות</span>
                <p className="font-medium text-gray-900 whitespace-pre-wrap">
                  {full.request.notes}
                </p>
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <Truck size={14} className="text-gray-500" />
              <h3 className="text-xs font-semibold text-gray-600">
                רכבים ({vehicles.length})
              </h3>
            </div>
            {vehicles.length === 0 ? (
              <p className="text-xs text-gray-400">אין רכבים בבקשה</p>
            ) : (
              <div className="space-y-2">
                {isExchange && (
                  <>
                    {vehicles
                      .filter((v) => v.is_working)
                      .map((v) => (
                        <VehicleRow key={v.id} vehicle={v} emphasizeRoles />
                      ))}
                    {vehicles
                      .filter((v) => !v.is_working)
                      .map((v) => (
                        <VehicleRow key={v.id} vehicle={v} emphasizeRoles />
                      ))}
                  </>
                )}
                {!isExchange &&
                  vehicles.map((v) => (
                    <VehicleRow key={v.id} vehicle={v} emphasizeRoles={false} />
                  ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin size={14} className="text-gray-500" />
              <h3 className="text-xs font-semibold text-gray-600">
                כתובות ({points.length})
              </h3>
            </div>
            {points.length === 0 ? (
              <p className="text-xs text-gray-400">אין נקודות בבקשה</p>
            ) : (
              <div className="space-y-2">
                {points.map((p) => (
                  <PointRow key={p.id} point={p} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className={className} dir="rtl">
        {body}
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl border border-cyan-200 bg-cyan-50/40 overflow-hidden ${className}`.trim()}
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-cyan-100 bg-white/70">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardList size={16} className="shrink-0 text-cyan-700" />
          <h2 className="text-sm font-bold text-gray-800 truncate">פרטי בקשת לקוח</h2>
          {typeBadge && (
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border ${typeBadge.className}`}
            >
              {typeBadge.label}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="text-xs font-medium text-cyan-800 hover:text-cyan-950 px-2 py-1 rounded-lg hover:bg-cyan-100/80 transition-colors"
        >
          {collapsed ? 'הצג' : 'הסתר'}
        </button>
      </div>

      {!collapsed && body}
    </div>
  )
}
