'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, ExternalLink, X } from 'lucide-react'
import type {
  StaffCustomerPortalOrder,
  StaffPortalOrderCancellation,
} from '@/app/lib/queries/customer-tow-requests'
import { PortalPlateBadge } from '@/app/components/shared/PortalPlateBadge'

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(status: string): { text: string; className: string } {
  if (status === 'pending') {
    return {
      text: 'ממתינה',
      className: 'bg-amber-50 text-amber-800 border-amber-200',
    }
  }
  if (status === 'converted') {
    return {
      text: 'הומרה לגרירה',
      className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    }
  }
  if (status === 'dismissed') {
    return {
      text: 'בוטלה',
      className: 'bg-red-50 text-red-700 border-red-200',
    }
  }
  return {
    text: status,
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  }
}

function towTypeLabel(towType: string): string {
  if (towType === 'exchange') return 'תקין תקול'
  if (towType === 'custom') return 'מותאם'
  return 'גרירה פשוטה'
}

function cancelStatusLabel(status: string): string {
  if (status === 'pending') return 'ממתינה לאישור'
  if (status === 'approved') return 'אושרה'
  if (status === 'rejected') return 'נדחתה'
  if (status === 'cancelled') return 'נמשכה ע״י הלקוח'
  return status
}

function firstLastAddresses(
  points: StaffCustomerPortalOrder['points']
): { from: string | null; to: string | null } {
  const sorted = [...points].sort((a, b) => a.point_order - b.point_order)
  const pickup = sorted.find((p) => p.point_type === 'pickup')
  const dropoff = [...sorted].reverse().find((p) => p.point_type === 'dropoff')
  return {
    from: pickup?.address?.trim() || sorted[0]?.address?.trim() || null,
    to: dropoff?.address?.trim() || sorted[sorted.length - 1]?.address?.trim() || null,
  }
}

function CancellationBlock({ cancel }: { cancel: StaffPortalOrderCancellation }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-amber-950">בקשת ביטול</span>
        <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-white border border-amber-200 text-amber-900">
          {cancelStatusLabel(cancel.status)}
        </span>
      </div>
      <p className="text-amber-900">
        ביקש: {cancel.requesterName || 'משתמש פורטל'} · {formatWhen(cancel.created_at)}
      </p>
      {cancel.reason_note?.trim() ? (
        <p className="text-amber-900 whitespace-pre-wrap">סיבה: {cancel.reason_note.trim()}</p>
      ) : null}
      {(cancel.status === 'approved' || cancel.status === 'rejected') && (
        <p className="text-amber-900">
          {cancel.status === 'approved' ? 'אישר' : 'דחה'}:{' '}
          {cancel.reviewerName || 'נציג החברה'}
          {cancel.reviewed_at ? ` · ${formatWhen(cancel.reviewed_at)}` : ''}
        </p>
      )}
      {cancel.staff_note?.trim() ? (
        <p className="text-amber-800 whitespace-pre-wrap">
          הערת צוות: {cancel.staff_note.trim()}
        </p>
      ) : null}
    </div>
  )
}

function PortalOrderModal({
  order,
  onClose,
}: {
  order: StaffCustomerPortalOrder
  onClose: () => void
}) {
  const { request, vehicles, points, cancellations, convertedTowOrderNumber } = order
  const becameTow = request.status === 'converted' && !!request.converted_tow_id
  const { from, to } = firstLastAddresses(points)
  const chip = statusLabel(request.status)

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-gray-800 truncate">
                {request.customer_order_number?.trim()
                  ? request.customer_order_number.trim()
                  : 'הזמנת פורטל'}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium border ${chip.className}`}
              >
                {chip.text}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {towTypeLabel(request.tow_type)} · נשלחה {formatWhen(request.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {becameTow ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm text-emerald-900 mb-2">ההזמנה הומרה לגרירה.</p>
              <Link
                href={`/dashboard/tows/${request.converted_tow_id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 underline"
              >
                <ExternalLink size={14} />
                {convertedTowOrderNumber
                  ? `פתח גרירה #${convertedTowOrderNumber}`
                  : 'פתח את הגרירה'}
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">מועד מבוקש</p>
                  <p className="font-medium text-gray-800">{formatWhen(request.scheduled_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">מזמין</p>
                  <p className="font-medium text-gray-800">
                    {[request.orderer, request.orderer_phone].filter((v) => v?.trim()).join(' · ') ||
                      '—'}
                  </p>
                </div>
                {request.department?.trim() ? (
                  <div>
                    <p className="text-xs text-gray-500">מחלקה</p>
                    <p className="font-medium text-gray-800">{request.department}</p>
                  </div>
                ) : null}
              </div>

              {vehicles.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">רכבים</p>
                  <ul className="space-y-2">
                    {vehicles.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center gap-2">
                        <PortalPlateBadge plate={v.plate_number} />
                        <span className="text-sm text-gray-600">
                          {[v.manufacturer, v.model].filter(Boolean).join(' ')}
                          {v.is_working ? '' : ' · תקול'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(from || to) && (
                <div className="space-y-1 text-sm">
                  {from && (
                    <p>
                      <span className="text-gray-500">מאיסוף: </span>
                      <span className="text-gray-800">{from}</span>
                    </p>
                  )}
                  {to && (
                    <p>
                      <span className="text-gray-500">ליעד: </span>
                      <span className="text-gray-800">{to}</span>
                    </p>
                  )}
                </div>
              )}

              {request.notes?.trim() ? (
                <div>
                  <p className="text-xs text-gray-500 mb-1">הערות</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{request.notes}</p>
                </div>
              ) : null}

              {cancellations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500">היסטוריית ביטול</p>
                  {cancellations.map((c) => (
                    <CancellationBlock key={c.id} cancel={c} />
                  ))}
                </div>
              )}
            </>
          )}

          {becameTow && cancellations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500">היסטוריית ביטול על ההזמנה</p>
              {cancellations.map((c) => (
                <CancellationBlock key={c.id} cancel={c} />
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  )
}

export function PortalOrdersSection({
  orders,
  loading,
}: {
  orders: StaffCustomerPortalOrder[]
  loading?: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(
    () => orders.find((o) => o.request.id === selectedId) ?? null,
    [orders, selectedId]
  )

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
        טוען הזמנות פורטל...
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <ClipboardList size={40} className="mx-auto text-gray-300 mb-2" />
        <p className="text-gray-500 text-sm">אין הזמנות שנשלחו דרך הפורטל</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {orders.map((order) => {
          const { request, vehicles, points } = order
          const chip = statusLabel(request.status)
          const becameTow = request.status === 'converted' && !!request.converted_tow_id
          const { from, to } = firstLastAddresses(points)
          const plates = vehicles.map((v) => v.plate_number).filter(Boolean)
          const latestCancel = order.cancellations[0] ?? null

          return (
            <button
              key={request.id}
              type="button"
              onClick={() => setSelectedId(request.id)}
              className="w-full text-right px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800 truncate">
                      {request.customer_order_number?.trim() || towTypeLabel(request.tow_type)}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium border ${chip.className}`}
                    >
                      {chip.text}
                    </span>
                    {becameTow && (
                      <span className="text-[11px] text-emerald-700">
                        {order.convertedTowOrderNumber
                          ? `#${order.convertedTowOrderNumber}`
                          : 'יש גרירה'}
                      </span>
                    )}
                  </div>
                  {!becameTow && (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {plates.slice(0, 3).map((plate) => (
                          <PortalPlateBadge key={plate} plate={plate} />
                        ))}
                        {plates.length > 3 && (
                          <span className="text-xs text-gray-400">+{plates.length - 3}</span>
                        )}
                      </div>
                      {(from || to) && (
                        <p className="text-xs text-gray-500 truncate">
                          {[from, to].filter(Boolean).join(' → ')}
                        </p>
                      )}
                      {latestCancel && (
                        <p className="text-xs text-amber-800 mt-1">
                          ביטול: {cancelStatusLabel(latestCancel.status)}
                          {latestCancel.requesterName
                            ? ` · ${latestCancel.requesterName}`
                            : ''}
                        </p>
                      )}
                    </>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">
                    {formatWhen(request.created_at)}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <PortalOrderModal order={selected} onClose={() => setSelectedId(null)} />
      )}
    </>
  )
}
