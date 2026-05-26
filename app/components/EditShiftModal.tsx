'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { editShift } from '../lib/queries/driver-shifts'
import { getDriverCashBalance } from '../lib/queries/driver-cash'
import { supabase } from '../lib/supabase'
import {
  buildLocalDateTime,
  computeEndShiftDefaults,
  dateTimeToJerusalemParts,
  END_SHIFT_HOUR_VALUES,
  END_SHIFT_MINUTE_VALUES,
  formatEndShiftTime,
  formatShiftStartJerusalem,
  getJerusalemDateStr,
} from '../lib/shift-datetime'

const WHEEL_ITEM_H = 40
const WHEEL_VISIBLE = 5
const WHEEL_PAD = ((WHEEL_VISIBLE - 1) / 2) * WHEEL_ITEM_H

export type EditShiftModalTarget = {
  shiftId: string
  driverName: string
  driverId: string
  startedAt: string
  endedAt: string | null
  workHoursEnd: string | null
}

export interface EditShiftModalProps {
  open: boolean
  target: EditShiftModalTarget | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}

function TimeWheelColumn({
  values,
  value,
  onChange,
  ariaLabel,
}: {
  values: readonly number[]
  value: number
  onChange: (v: number) => void
  ariaLabel: string
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const index = Math.max(0, values.indexOf(value))

  const scrollToIndex = useCallback((idx: number, smooth = false) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ top: idx * WHEEL_ITEM_H, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    scrollToIndex(index, false)
  }, [index, scrollToIndex])

  const snapToNearest = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const idx = Math.round(el.scrollTop / WHEEL_ITEM_H)
    const clamped = Math.max(0, Math.min(values.length - 1, idx))
    scrollToIndex(clamped, true)
    if (values[clamped] !== value) onChange(values[clamped])
  }, [onChange, scrollToIndex, value, values])

  const onScroll = () => {
    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current)
    scrollEndTimer.current = setTimeout(snapToNearest, 80)
  }

  const step = (delta: number) => {
    const currentIdx = values.indexOf(value)
    const nextIdx = Math.max(0, Math.min(values.length - 1, currentIdx + delta))
    onChange(values[nextIdx])
    scrollToIndex(nextIdx, true)
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={`${ariaLabel} — למעלה`}
        onClick={() => step(-1)}
        className="flex h-8 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      >
        ▲
      </button>
      <div className="relative w-16">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-10 -translate-y-1/2 rounded-lg border-y border-[#33d4ff]/50 bg-[#33d4ff]/10" />
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="h-[200px] snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollPaddingTop: WHEEL_PAD, scrollPaddingBottom: WHEEL_PAD }}
          role="listbox"
          aria-label={ariaLabel}
        >
          <div style={{ height: WHEEL_PAD }} aria-hidden />
          {values.map(v => (
            <div
              key={v}
              role="option"
              aria-selected={v === value}
              className={`flex h-10 snap-center items-center justify-center text-lg transition-colors ${
                v === value ? 'font-bold text-gray-900' : 'font-medium text-gray-400'
              }`}
            >
              {String(v).padStart(2, '0')}
            </div>
          ))}
          <div style={{ height: WHEEL_PAD }} aria-hidden />
        </div>
      </div>
      <button
        type="button"
        aria-label={`${ariaLabel} — למטה`}
        onClick={() => step(1)}
        className="flex h-8 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      >
        ▼
      </button>
    </div>
  )
}

function EndShiftTimePicker({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: {
  hour: number
  minute: number
  onHourChange: (h: number) => void
  onMinuteChange: (m: number) => void
}) {
  return (
    <div className="space-y-3" dir="rtl">
      <p className="text-center text-3xl font-bold tabular-nums text-gray-900" aria-live="polite">
        {formatEndShiftTime(hour, minute)}
      </p>
      <div className="flex items-center justify-center gap-4">
        <TimeWheelColumn
          values={END_SHIFT_HOUR_VALUES}
          value={hour}
          onChange={onHourChange}
          ariaLabel="שעות"
        />
        <span className="pb-8 text-2xl font-bold text-gray-300">:</span>
        <TimeWheelColumn
          values={END_SHIFT_MINUTE_VALUES}
          value={minute}
          onChange={onMinuteChange}
          ariaLabel="דקות"
        />
      </div>
    </div>
  )
}

export default function EditShiftModal({ open, target, onClose, onSaved }: EditShiftModalProps) {
  const [startShiftDate, setStartShiftDate] = useState(() => getJerusalemDateStr(new Date()))
  const [startShiftHour, setStartShiftHour] = useState(0)
  const [startShiftMinute, setStartShiftMinute] = useState(0)
  const [endShiftDate, setEndShiftDate] = useState(() => getJerusalemDateStr(new Date()))
  const [endShiftHour, setEndShiftHour] = useState(0)
  const [endShiftMinute, setEndShiftMinute] = useState(0)
  const [editShiftReason, setEditShiftReason] = useState('')
  const [isEditingStart, setIsEditingStart] = useState(false)
  const [endShiftSubmitting, setEndShiftSubmitting] = useState(false)
  const [endShiftError, setEndShiftError] = useState<string | null>(null)
  const [endShiftWarnings, setEndShiftWarnings] = useState<{ openTows: number; cashBalance: number } | null>(null)

  useEffect(() => {
    if (!open || !target) return

    const startParts = dateTimeToJerusalemParts(target.startedAt)
    const endParts = target.endedAt
      ? dateTimeToJerusalemParts(target.endedAt)
      : computeEndShiftDefaults(target.startedAt, target.workHoursEnd)

    setStartShiftDate(startParts.date)
    setStartShiftHour(startParts.hour)
    setStartShiftMinute(startParts.minute)
    setEndShiftDate(endParts.date)
    setEndShiftHour(endParts.hour)
    setEndShiftMinute(endParts.minute)
    setEditShiftReason('')
    setIsEditingStart(false)
    setEndShiftError(null)
    setEndShiftWarnings(null)
  }, [open, target])

  useEffect(() => {
    if (!open || !target) {
      setEndShiftWarnings(null)
      return
    }

    let cancelled = false
    ;(async () => {
      const { count, error } = await supabase
        .from('tows')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', target.driverId)
        .in('status', ['assigned', 'in_progress'])

      const openTows = error ? 0 : count ?? 0

      let cashBalance = 0
      try {
        cashBalance = await getDriverCashBalance(target.driverId)
      } catch {
        cashBalance = 0
      }

      if (!cancelled) setEndShiftWarnings({ openTows, cashBalance })
    })()

    return () => {
      cancelled = true
    }
  }, [open, target])

  if (!open || !target) return null

  const todayStr = getJerusalemDateStr(new Date())
  const startedAtLocal = buildLocalDateTime(startShiftDate, startShiftHour, startShiftMinute)
  const endedAtLocal = buildLocalDateTime(endShiftDate, endShiftHour, endShiftMinute)
  const endMinDate = getJerusalemDateStr(startedAtLocal)
  const endsBeforeStart = endedAtLocal.getTime() <= startedAtLocal.getTime()
  const reasonTooShort = editShiftReason.trim().length < 3
  const showCashWarning = endShiftWarnings && endShiftWarnings.cashBalance > 0
  const showTowsWarning = endShiftWarnings && endShiftWarnings.openTows > 0
  const showWarningsBlock = showCashWarning || showTowsWarning
  const originalStartedMs = new Date(target.startedAt).getTime()
  const startedChanged = isEditingStart && startedAtLocal.getTime() !== originalStartedMs

  const resetStartToOriginal = () => {
    const startParts = dateTimeToJerusalemParts(target.startedAt)
    setStartShiftDate(startParts.date)
    setStartShiftHour(startParts.hour)
    setStartShiftMinute(startParts.minute)
    setIsEditingStart(false)
  }

  const handleCancel = () => {
    setEditShiftReason('')
    setIsEditingStart(false)
    setEndShiftError(null)
    setEndShiftWarnings(null)
    onClose()
  }

  const handleSave = async () => {
    setEndShiftSubmitting(true)
    setEndShiftError(null)
    try {
      await editShift({
        shiftId: target.shiftId,
        newStartedAt: startedChanged ? startedAtLocal.toISOString() : null,
        newEndedAt: endedAtLocal.toISOString(),
        reason: editShiftReason.trim(),
      })
      setEditShiftReason('')
      setIsEditingStart(false)
      setEndShiftWarnings(null)
      await onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בשמירת המשמרת'
      setEndShiftError(message)
    } finally {
      setEndShiftSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white">
        <div className="border-b border-gray-100 p-5">
          <h3 className="text-lg font-bold text-gray-800">עריכת משמרת — {target.driverName}</h3>
        </div>
        <div className="space-y-5 p-5">
          {endShiftError && (
            <p className="text-right text-sm text-red-600" role="alert">{endShiftError}</p>
          )}

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700">
              <span>
                תחילת משמרת:{' '}
                <span className="font-medium text-gray-800">
                  {formatShiftStartJerusalem(target.startedAt)}
                </span>
              </span>
              {!isEditingStart && (
                <button
                  type="button"
                  onClick={() => setIsEditingStart(true)}
                  className="text-xs font-medium text-[#33d4ff] hover:underline"
                >
                  ✏ ערוך
                </button>
              )}
            </div>
            {isEditingStart && (
              <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">עריכת תחילת משמרת</p>
                  <button
                    type="button"
                    onClick={resetStartToOriginal}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
                  >
                    ביטול עריכה
                  </button>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">תאריך התחלה</label>
                  <input
                    type="date"
                    value={startShiftDate}
                    max={todayStr}
                    onChange={e => setStartShiftDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-3 text-right focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-600">שעת התחלה</label>
                  <EndShiftTimePicker
                    hour={startShiftHour}
                    minute={startShiftMinute}
                    onHourChange={setStartShiftHour}
                    onMinuteChange={setStartShiftMinute}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-800">סיום משמרת</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">תאריך סיום</label>
              <input
                type="date"
                value={endShiftDate}
                min={endMinDate}
                max={todayStr}
                onChange={e => setEndShiftDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 p-3 text-right focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">שעת סיום</label>
              <EndShiftTimePicker
                hour={endShiftHour}
                minute={endShiftMinute}
                onHourChange={setEndShiftHour}
                onMinuteChange={setEndShiftMinute}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">סיבת העריכה</label>
            <textarea
              value={editShiftReason}
              onChange={e => setEditShiftReason(e.target.value)}
              placeholder="למשל: שכחת לסגור משמרת"
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-200 p-3 text-right focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
            />
            {reasonTooShort && editShiftReason.length > 0 && (
              <p className="mt-1 text-right text-xs text-red-600">יש להזין לפחות 3 תווים</p>
            )}
          </div>

          {endsBeforeStart && (
            <p className="text-right text-xs text-red-600">
              שעת הסיום חייבת להיות אחרי תחילת המשמרת (
              {startedAtLocal.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
              )
            </p>
          )}

          {showWarningsBlock && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-right text-sm text-amber-900">
              <p className="font-medium">⚠ אזהרה לפני סיום</p>
              <p className="mt-1">
                {showTowsWarning && showCashWarning
                  ? `לנהג יש ${endShiftWarnings!.openTows} גרירות פתוחות ויתרת קופה של ₪${endShiftWarnings!.cashBalance.toLocaleString('he-IL')} — האם לסיים בכל זאת?`
                  : showTowsWarning
                    ? `לנהג יש ${endShiftWarnings!.openTows} גרירות פתוחות — האם לסיים בכל זאת?`
                    : `לנהג יש יתרת קופה של ₪${endShiftWarnings!.cashBalance.toLocaleString('he-IL')} — האם לסיים בכל זאת?`}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-3 border-t border-gray-100 bg-gray-50 p-5">
          <button
            type="button"
            onClick={handleCancel}
            disabled={endShiftSubmitting}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-3 font-medium text-gray-600 disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            disabled={endShiftSubmitting || endsBeforeStart || reasonTooShort}
            onClick={handleSave}
            className="flex-1 rounded-xl bg-[#33d4ff] py-3 font-medium text-white hover:bg-[#21b8e6] disabled:opacity-50"
          >
            {endShiftSubmitting ? 'שומר...' : 'שמור שינויים'}
          </button>
        </div>
      </div>
    </div>
  )
}
