'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { he } from 'react-day-picker/locale'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Sheet,
  X,
} from 'lucide-react'
import 'react-day-picker/style.css'
import {
  countCustomerTows,
  fetchAllCustomerTowsForExport,
  type CustomerPortalTowExportRow,
  type CustomerTowDateField,
} from '@/app/lib/queries/customer-portal'
import {
  downloadPortalTowsXlsx,
  jerusalemDayBoundsIso,
  portalExportPresetRange,
} from '@/app/lib/utils/portal-tow-export'
import {
  dateToYyyyMmDd,
  yyyyMmDdToDate,
} from '@/app/lib/utils/date-input-normalize'
import { resolvePortalVisibilityFlag } from '@/app/lib/utils/portal-visibility'

/** Order matches the design brief (billable statuses first). */
const EXPORT_STATUSES: { value: string; label: string }[] = [
  { value: 'completed', label: 'הושלמו' },
  { value: 'cancelled_charged', label: 'בוטלו בחיוב' },
  { value: 'cancelled', label: 'בוטלו' },
  { value: 'in_progress', label: 'בביצוע' },
  { value: 'assigned', label: 'שובצו' },
  { value: 'pending', label: 'ממתינות' },
  { value: 'quote', label: 'הצעות מחיר' },
]

const ALL_STATUS_VALUES = EXPORT_STATUSES.map((s) => s.value)
const DEFAULT_STATUSES = ['completed', 'cancelled_charged']

type PresetId = 'this_month' | 'last_month' | 'last_3_months' | 'this_year'

const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'this_month', label: 'החודש' },
  { id: 'last_month', label: 'החודש שעבר' },
  { id: 'last_3_months', label: '3 חודשים' },
  { id: 'this_year', label: 'השנה' },
]

type PortalTowExportModalProps = {
  open: boolean
  onClose: () => void
  customerId: string
}

function rangeFromYmd(fromYmd: string, toYmd: string): DateRange {
  return {
    from: yyyyMmDdToDate(fromYmd) ?? undefined,
    to: yyyyMmDdToDate(toYmd) ?? undefined,
  }
}

/** Always earlier date first (from ≤ to). */
function normalizeYmdPair(
  a: string,
  b: string
): { fromYmd: string; toYmd: string } {
  return a <= b ? { fromYmd: a, toYmd: b } : { fromYmd: b, toYmd: a }
}

function normalizeDateRange(range: DateRange | undefined): DateRange | undefined {
  if (!range?.from) return range
  if (!range.to) return range
  if (range.from.getTime() <= range.to.getTime()) return range
  return { from: range.to, to: range.from }
}

function formatHebrewDayMonth(date: Date, withYear: boolean): string {
  return date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' as const } : {}),
  })
}

/** e.g. "1 ביולי — 23 ביולי 2026" (earlier first; year once when same year). */
function formatHebrewRangeLabel(fromYmd: string, toYmd: string): string {
  const from = yyyyMmDdToDate(fromYmd)
  const to = yyyyMmDdToDate(toYmd)
  if (!from || !to) return ''
  const sameYear = from.getFullYear() === to.getFullYear()
  if (sameYear) {
    return `${formatHebrewDayMonth(from, false)} — ${formatHebrewDayMonth(to, true)}`
  }
  return `${formatHebrewDayMonth(from, true)} — ${formatHebrewDayMonth(to, true)}`
}

function towIncludesExportPrice(
  tow: CustomerPortalTowExportRow,
  portalSettings: Record<string, boolean>
): boolean {
  if (tow.status !== 'completed' && tow.status !== 'cancelled_charged') return false
  return resolvePortalVisibilityFlag('show_price', portalSettings, tow)
}

export function PortalTowExportModal({
  open,
  onClose,
  customerId,
}: PortalTowExportModalProps) {
  const initial = useMemo(() => portalExportPresetRange('this_month'), [])
  const [range, setRange] = useState<DateRange | undefined>(() =>
    rangeFromYmd(initial.fromYmd, initial.toYmd)
  )
  const [activePreset, setActivePreset] = useState<PresetId | null>('this_month')
  const [dateField, setDateField] = useState<CustomerTowDateField>('scheduled_at')
  const [statuses, setStatuses] = useState<string[]>(() => [...DEFAULT_STATUSES])
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [priceCount, setPriceCount] = useState(0)
  const [countLoading, setCountLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const normalizedYmd = useMemo(() => {
    if (!range?.from) return null
    const a = dateToYyyyMmDd(range.from)
    const b = range.to ? dateToYyyyMmDd(range.to) : a
    return normalizeYmdPair(a, b)
  }, [range])

  const fromYmd = normalizedYmd?.fromYmd ?? ''
  const toYmd = normalizedYmd?.toYmd ?? ''

  const filterOptions = useMemo(() => {
    if (!fromYmd || !toYmd || statuses.length === 0) return null
    const { startIso } = jerusalemDayBoundsIso(fromYmd)
    const { endIso } = jerusalemDayBoundsIso(toYmd)
    return {
      from: startIso,
      to: endIso,
      dateField,
      statuses,
    }
  }, [fromYmd, toYmd, dateField, statuses])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    if (!filterOptions) {
      setMatchCount(0)
      setPriceCount(0)
      setCountLoading(false)
      return
    }

    setCountLoading(true)
    setError('')

    const needsPriceScan = statuses.some(
      (s) => s === 'completed' || s === 'cancelled_charged'
    )

    Promise.all([
      countCustomerTows(customerId, filterOptions),
      needsPriceScan
        ? fetchAllCustomerTowsForExport(customerId, filterOptions)
        : Promise.resolve({ tows: [] as CustomerPortalTowExportRow[], portalSettings: {} }),
    ])
      .then(([n, { tows, portalSettings }]) => {
        if (cancelled) return
        setMatchCount(n)
        setPriceCount(
          needsPriceScan
            ? tows.filter((t) => towIncludesExportPrice(t, portalSettings)).length
            : 0
        )
      })
      .catch(() => {
        if (!cancelled) {
          setMatchCount(0)
          setPriceCount(0)
          setError('שגיאה בספירת גרירות')
        }
      })
      .finally(() => {
        if (!cancelled) setCountLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, customerId, filterOptions, statuses])

  const toggleStatus = useCallback((value: string) => {
    setStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    )
  }, [])

  const toggleSelectAllStatuses = useCallback(() => {
    setStatuses((prev) =>
      prev.length === ALL_STATUS_VALUES.length ? [] : [...ALL_STATUS_VALUES]
    )
  }, [])

  const applyPreset = useCallback((id: PresetId) => {
    const { fromYmd: f, toYmd: t } = portalExportPresetRange(id)
    const pair = normalizeYmdPair(f, t)
    setActivePreset(id)
    setRange(rangeFromYmd(pair.fromYmd, pair.toYmd))
  }, [])

  const handleRangeSelect = useCallback((next: DateRange | undefined) => {
    setActivePreset(null)
    setRange(normalizeDateRange(next))
  }, [])

  const handleExport = async () => {
    if (!filterOptions || !fromYmd || !toYmd || !matchCount) return
    setExporting(true)
    setError('')
    try {
      const { tows, portalSettings } = await fetchAllCustomerTowsForExport(
        customerId,
        filterOptions
      )
      if (tows.length === 0) {
        setError('אין גרירות לייצוא בטווח שנבחר')
        return
      }
      await downloadPortalTowsXlsx({
        tows,
        portalSettings,
        dateField,
        fromYmd,
        toYmd,
      })
      onClose()
    } catch (err) {
      console.error('Portal tow export failed:', err)
      setError('שגיאה בייצוא הקובץ')
    } finally {
      setExporting(false)
    }
  }

  if (!open) return null

  const allStatusesSelected = statuses.length === ALL_STATUS_VALUES.length
  const canExport =
    !!matchCount && matchCount > 0 && !countLoading && !exporting && !!filterOptions
  const rangeLabel =
    fromYmd && toYmd ? formatHebrewRangeLabel(fromYmd, toYmd) : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
      <div
        className="bg-white w-full lg:max-w-md lg:rounded-2xl lg:mx-4 overflow-hidden rounded-t-2xl max-h-[92vh] flex flex-col shadow-lg"
        dir="rtl"
      >
        {/* 1. Header */}
        <div className="shrink-0 flex items-center gap-2.5 px-5 py-4 border-b border-gray-200 bg-white">
          <Sheet size={22} className="text-[#217346] shrink-0" aria-hidden />
          <h2 className="flex-1 font-bold text-lg text-gray-900">ייצוא גרירות לאקסל</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* 2. Date basis — inline sentence */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span>סינון לפי</span>
            <div
              className="inline-flex p-0.5 rounded-lg bg-gray-100"
              role="group"
              aria-label="בסיס התאריך"
            >
              {(
                [
                  { value: 'scheduled_at' as const, label: 'תאריך ביצוע' },
                  { value: 'created_at' as const, label: 'תאריך הזמנה' },
                ] as const
              ).map((opt) => {
                const selected = dateField === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDateField(opt.value)}
                    className={`px-2.5 py-1 rounded-md text-sm font-medium transition-all ${
                      selected
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. Presets */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const selected = activePreset === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selected
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* 4. Calendar — one month */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="p-3 flex justify-center">
              <DayPicker
                mode="range"
                locale={he}
                dir="rtl"
                weekStartsOn={0}
                numberOfMonths={1}
                selected={range}
                onSelect={handleRangeSelect}
                defaultMonth={range?.from ?? new Date()}
                components={{
                  // Under RTL the stock chevron directions read backwards — swap icons.
                  Chevron: ({ orientation, className, ...props }) => {
                    const Icon =
                      orientation === 'left' ? ChevronRight : ChevronLeft
                    return <Icon className={className} size={18} {...props} />
                  },
                }}
                classNames={{
                  root: 'rdp-root text-sm',
                  month_caption:
                    'relative flex items-center justify-center font-semibold text-gray-800 mb-3 h-8',
                  nav: 'absolute inset-x-0 top-0 flex items-center justify-between px-1',
                  button_previous:
                    'inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100',
                  button_next:
                    'inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100',
                  weekday: 'text-gray-500 text-xs font-normal w-9',
                  day: 'w-9 h-9 text-sm p-0 relative',
                  day_button:
                    'w-full h-full rounded-full text-sm hover:bg-blue-50 transition-colors',
                  selected: '[&>button]:font-semibold',
                  range_start:
                    'bg-blue-100 rounded-r-full [&>button]:bg-blue-600 [&>button]:text-white [&>button]:rounded-full [&>button]:font-semibold',
                  range_end:
                    'bg-blue-100 rounded-l-full [&>button]:bg-blue-600 [&>button]:text-white [&>button]:rounded-full [&>button]:font-semibold',
                  range_middle:
                    'bg-blue-100 [&>button]:bg-transparent [&>button]:text-gray-800 [&>button]:rounded-none',
                  today: '[&>button]:ring-1 [&>button]:ring-blue-300',
                  outside: 'text-gray-300',
                  disabled: 'text-gray-300 opacity-50',
                }}
              />
            </div>
            <div className="border-t border-gray-100 px-4 py-2.5 text-sm text-gray-600 text-center">
              {rangeLabel ?? 'בחרו טווח תאריכים בלוח השנה'}
            </div>
          </div>

          {/* 5. Status chips */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-gray-800">סטטוס</p>
              <button
                type="button"
                onClick={toggleSelectAllStatuses}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                {allStatusesSelected ? 'נקה בחירה' : 'בחר הכל'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXPORT_STATUSES.map((s) => {
                const selected = statuses.includes(s.value)
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleStatus(s.value)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                      selected
                        ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                        : 'bg-white text-gray-500 font-normal border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {selected && <Check size={14} className="shrink-0" aria-hidden />}
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 6. Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-200 bg-gray-50 space-y-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="px-2 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50 transition-colors"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={!canExport}
              className="flex-1 py-3 bg-[#217346] text-white rounded-xl font-medium hover:bg-[#1a5c38] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              {exporting || countLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {exporting ? 'מייצא...' : 'סופר...'}
                </>
              ) : (
                <>
                  <Download size={18} />
                  {matchCount != null && matchCount > 0
                    ? `ייצוא ${matchCount} גרירות`
                    : 'ייצוא'}
                </>
              )}
            </button>
          </div>
          {!countLoading && matchCount != null && matchCount > 0 && (
            <p className="text-xs text-gray-500 text-center">
              כולל מחיר ל־{priceCount} גרירות
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
