'use client'

import { useEffect, useState } from 'react'
import { getShiftEdits, type ShiftEdit } from '../lib/queries/driver-shifts'
import { formatJerusalemDateTime } from '../lib/shift-datetime'

export interface ShiftEditHistoryModalProps {
  open: boolean
  shiftId: string | null
  driverName: string
  onClose: () => void
}

const FIELD_LABELS: Record<ShiftEdit['field_name'], string> = {
  started_at: 'שעת התחלה',
  ended_at: 'שעת סיום',
}

export default function ShiftEditHistoryModal({
  open,
  shiftId,
  driverName,
  onClose,
}: ShiftEditHistoryModalProps) {
  const [loading, setLoading] = useState(false)
  const [edits, setEdits] = useState<ShiftEdit[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !shiftId) {
      setEdits([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const data = await getShiftEdits(shiftId)
        if (!cancelled) setEdits(data)
      } catch (err) {
        if (!cancelled) {
          setEdits([])
          setError(err instanceof Error ? err.message : 'שגיאה בטעינת ההיסטוריה')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, shiftId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white">
        <div className="border-b border-gray-100 p-5">
          <h3 className="text-lg font-bold text-gray-800">היסטוריית עריכות — {driverName}</h3>
        </div>

        <div className="space-y-3 p-5">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-8">טוען...</p>
          ) : error ? (
            <p className="text-right text-sm text-red-600" role="alert">{error}</p>
          ) : edits.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">אין היסטוריית עריכות</p>
          ) : (
            edits.map(edit => (
              <div
                key={edit.id}
                className="rounded-xl border border-gray-200 p-4 space-y-2 text-sm text-gray-700"
              >
                <p className="font-medium text-gray-800">
                  {edit.edited_by_name} · {formatJerusalemDateTime(edit.edited_at)}
                </p>
                <p>
                  <span className="text-gray-500">שדה: </span>
                  {FIELD_LABELS[edit.field_name]}
                </p>
                <p>
                  <span className="text-gray-500">שינוי: </span>
                  מ-{formatJerusalemDateTime(edit.old_value)} → {formatJerusalemDateTime(edit.new_value)}
                </p>
                <p className="text-gray-600 italic">
                  סיבה: &quot;{edit.reason}&quot;
                </p>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-100 bg-gray-50 p-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 font-medium text-gray-600 hover:bg-gray-50"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  )
}
