'use client'

import { useState } from 'react'
import { Wallet, Plus, Pencil } from 'lucide-react'
import { useTowForm } from '../../../hooks/useTowForm'
import { FormCard } from '../../ui'
import { TimeSurcharge } from '../../../lib/queries/price-lists'
import { resolveSurchargeCatalog } from '../../../lib/queries/price-lists'
import {
  getActiveTimeSurchargeSummary,
  getTimeSurchargeLabel,
} from '../../../lib/utils/time-surcharge-summary'
import { CustomerPriceListBadge } from '../../CustomerPriceListBadge'

type Form = ReturnType<typeof useTowForm>

type PriceMode = Form['priceMode']

/**
 * Time surcharges + holiday chips — logic mirrors create/page.tsx TimeSurchargesSection
 * (line ~4349); styled for mobile touch targets.
 */
function TimeSurchargesSection({
  timeSurchargesData,
  isHoliday,
  setIsHoliday,
  activeTimeSurchargesList,
  setActiveTimeSurchargesList,
  setHasManualTimeSurchargeOverride,
  compact = false,
}: {
  timeSurchargesData: TimeSurcharge[]
  isHoliday: boolean
  setIsHoliday: (v: boolean) => void
  activeTimeSurchargesList: TimeSurcharge[]
  setActiveTimeSurchargesList: (v: TimeSurcharge[]) => void
  setHasManualTimeSurchargeOverride: (v: boolean) => void
  compact?: boolean
}) {
  const isCompact = compact ?? false
  const holidaySurcharge = timeSurchargesData.find(
    (s) => s.day_type === 'holiday' && s.is_active
  )
  const isActive = (s: TimeSurcharge) =>
    activeTimeSurchargesList.some((a) => a.id === s.id)
  const toggleSurcharge = (s: TimeSurcharge) => {
    if (isActive(s)) {
      setActiveTimeSurchargesList(
        activeTimeSurchargesList.filter((a) => a.id !== s.id)
      )
    } else {
      setActiveTimeSurchargesList([...activeTimeSurchargesList, s])
    }
    setHasManualTimeSurchargeOverride(true)
  }
  const nonHolidaySurcharges = timeSurchargesData.filter(
    (s) => s.is_active && s.day_type !== 'holiday'
  )

  const surchargeLabel = getTimeSurchargeLabel

  // Effective active surcharge for the collapsed summary — only the highest applies.
  const topActive = getActiveTimeSurchargeSummary(
    timeSurchargesData,
    activeTimeSurchargesList,
    isHoliday
  )

  const [expanded, setExpanded] = useState(false)

  const chipClass = (on: boolean) =>
    isCompact
      ? `inline-flex items-center justify-center min-h-[36px] h-9 px-2 rounded-lg text-xs transition-colors ${
          on
            ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-200 font-medium'
            : 'border border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:text-gray-600'
        }`
      : `inline-flex items-center justify-center h-9 px-3 rounded-lg text-sm transition-colors ${
          on
            ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200 font-medium'
            : 'border border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:text-gray-600'
        }`

  return (
    <div>
      <div className={`flex items-baseline justify-between ${isCompact ? 'mb-1' : 'mb-1.5'}`}>
        <p className={isCompact ? 'text-sm font-semibold text-gray-700' : 'text-sm font-semibold text-gray-700'}>
          תוספות זמן
        </p>
        {expanded && <p className="text-xs text-gray-400">הגבוהה מביניהן בלבד</p>}
      </div>

      {!expanded ? (
        <div className="flex items-center justify-between gap-2">
          <p className={isCompact ? 'text-xs text-gray-500 leading-snug' : 'text-sm text-gray-500'}>
            {topActive ? (
              <>
                תוספת פעילה:{' '}
                <span className="text-gray-700 font-medium">
                  {topActive.label} ({topActive.percent}%)
                </span>
              </>
            ) : (
              'אין תוספת זמן פעילה'
            )}
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={
              isCompact
                ? 'shrink-0 min-h-[36px] inline-flex items-center text-xs font-medium text-gt-brand'
                : 'shrink-0 min-h-[44px] text-sm font-medium text-gt-brand'
            }
          >
            שנה סוג תוספת
          </button>
        </div>
      ) : (
        <div className={isCompact ? 'flex flex-wrap gap-2' : 'flex flex-wrap gap-1.5'}>
          {nonHolidaySurcharges.map((s) => {
            const active = isActive(s)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSurcharge(s)}
                className={chipClass(active)}
              >
                {surchargeLabel(s)} ({s.surcharge_percent}%)
              </button>
            )
          })}
          {holidaySurcharge && (
            <button
              type="button"
              onClick={() => setIsHoliday(!isHoliday)}
              className={chipClass(isHoliday)}
            >
              חג ({holidaySurcharge.surcharge_percent}%)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const PRICE_MODE_OPTIONS: {
  mode: PriceMode
  label: string
  reset: (form: Form) => void
  showWhen?: (form: Form) => boolean
}[] = [
  {
    mode: 'recommended',
    label: 'מומלץ',
    reset: (form) => {
      form.setPriceMode('recommended')
      form.setSelectedPriceItem(null)
      form.setCustomPrice('')
    },
  },
  {
    mode: 'recommended_customer',
    label: 'ללקוח',
    showWhen: (form) => !!form.selectedCustomerPricing,
    reset: (form) => {
      form.setPriceMode('recommended_customer')
      form.setSelectedPriceItem(null)
      form.setCustomPrice('')
    },
  },
  {
    mode: 'fixed',
    label: 'קבוע',
    reset: (form) => {
      form.setPriceMode('fixed')
      form.setCustomPrice('')
    },
  },
  {
    mode: 'custom',
    label: 'ידני',
    reset: (form) => {
      form.setPriceMode('custom')
      form.setSelectedPriceItem(null)
    },
  },
]

/**
 * Pricing section for single tows on the mobile scroll page — time surcharges,
 * price mode, live breakdown, and manual discount/markup. Mirrors create/page.tsx
 * Section 5 (מחיר) logic via shared useTowForm / useTowPricing state.
 */
export function SectionPricing({
  form,
  compact = false,
}: {
  form: Form
  /** Tighter layout for narrow desktop columns (ColumnLayout). Default preserves mobile sizing. */
  compact?: boolean
}) {
  const isCompact = compact ?? false
  const [showManualAdj, setShowManualAdj] = useState(false)

  const adjPercent = parseFloat(form.manualAdjustmentPercent) || 0
  const hasManualAdj = adjPercent > 0
  const manualAdjSummary = hasManualAdj
    ? `${form.manualAdjustmentType === 'discount' ? 'הנחה' : 'תוספת'} ${adjPercent}%`
    : null

  const displayTimeSurcharges = resolveSurchargeCatalog(
    form.priceMode === 'recommended_customer'
      ? form.selectedCustomerPricing?.customer_time_surcharges
      : null,
    form.timeSurchargesData,
  )

  const usesCompanyTimeFallback =
    form.priceMode === 'recommended_customer' &&
    !!form.selectedCustomerPricing &&
    (form.selectedCustomerPricing?.customer_time_surcharges?.length ?? 0) === 0

  const visiblePriceModes = PRICE_MODE_OPTIONS.filter(
    (opt) => !opt.showWhen || opt.showWhen(form)
  )

  const showRecommendedBreakdown =
    form.priceMode === 'recommended' || form.priceMode === 'recommended_customer'

  return (
    <FormCard icon={Wallet} title="מחיר" className={isCompact ? 'mb-0' : undefined}>
      <div className={isCompact ? 'space-y-2' : 'space-y-4'}>
        {showRecommendedBreakdown && (
          <TimeSurchargesSection
            compact={isCompact}
            timeSurchargesData={displayTimeSurcharges}
            isHoliday={form.isHoliday}
            setIsHoliday={form.setIsHoliday}
            activeTimeSurchargesList={form.activeTimeSurchargesList}
            setActiveTimeSurchargesList={form.setActiveTimeSurchargesList}
            setHasManualTimeSurchargeOverride={form.setHasManualTimeSurchargeOverride}
          />
        )}

        <div>
          <p className={isCompact ? 'text-sm font-semibold text-gray-700 mb-1' : 'text-sm font-semibold text-gray-700 mb-2'}>
            מצב מחיר
          </p>
          <div className={isCompact ? 'flex gap-2' : 'flex gap-1.5'}>
            {visiblePriceModes.map((opt) => {
              const isActive = form.priceMode === opt.mode
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => opt.reset(form)}
                  className={
                    isCompact
                      ? `flex-1 flex items-center justify-center min-h-[36px] py-1.5 px-0.5 rounded-lg border text-xs font-medium transition-colors ${
                          isActive
                            ? 'border-gt-brand bg-gt-brand text-white'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`
                      : `flex-1 flex items-center justify-center min-h-[44px] px-1 rounded-lg border text-sm font-medium transition-colors ${
                          isActive
                            ? 'border-gt-brand bg-gt-brand text-white'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`
                  }
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {form.priceMode === 'recommended_customer' && (
            <div className={isCompact ? 'mt-1.5' : 'mt-2'}>
              <CustomerPriceListBadge
                customerName={form.selectedCustomerPricing?.customer?.name}
              />
            </div>
          )}
        </div>

        {form.priceMode === 'fixed' && (
          <div className={isCompact ? 'space-y-2' : 'space-y-3'}>
            <select
              value={form.selectedPriceItem?.id || ''}
              onChange={(e) => {
                const item = form.fixedPriceItems.find((i) => i.id === e.target.value)
                form.setSelectedPriceItem(
                  item
                    ? {
                        id: item.id,
                        label: item.label,
                        price: item.price,
                      }
                    : null
                )
              }}
              className={
                isCompact
                  ? 'w-full px-2.5 h-9 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gt-brand/15 focus:border-gt-brand bg-white'
                  : 'w-full px-3 h-12 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white'
              }
            >
              <option value="">בחר פריט</option>
              {form.fixedPriceItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label} — ₪{i.price}
                </option>
              ))}
            </select>
            {form.selectedPriceItem ? (
              <div className={isCompact ? 'text-xs space-y-1' : 'text-sm space-y-1'}>
                <p className="text-gray-500">
                  {form.selectedPriceItem.label}: ₪
                  {form.selectedPriceItem.price.toFixed(2)}
                </p>
                {(form.priceResult?.discountAmount ?? 0) > 0 && (
                  <p className="text-emerald-600">
                    הנחת לקוח
                    {form.selectedCustomerPricing?.discount_percent
                      ? ` (${form.selectedCustomerPricing.discount_percent}%)`
                      : ''}
                    : -₪{(form.priceResult?.discountAmount ?? 0).toFixed(2)}
                  </p>
                )}
                <div
                  className={
                    isCompact
                      ? 'flex items-baseline justify-between gap-2 pt-1.5 mt-0.5 border-t border-gray-200'
                      : 'flex items-baseline justify-between pt-2 mt-1 border-t border-gray-200'
                  }
                >
                  <span
                    className={
                      isCompact ? 'text-xs font-medium text-gray-500' : 'text-sm font-medium text-gray-500'
                    }
                  >
                    סה״כ
                  </span>
                  <span
                    className={
                      isCompact
                        ? 'text-lg font-bold text-gray-900 tabular-nums shrink-0'
                        : 'text-2xl font-bold text-gray-900'
                    }
                  >
                    ₪{form.finalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <p className={isCompact ? 'text-xs text-gray-400' : 'text-sm text-gray-400'}>
                בחר פריט כדי לראות מחיר
              </p>
            )}
          </div>
        )}

        {form.priceMode === 'custom' && (
          <div className={isCompact ? 'space-y-2' : 'space-y-2'}>
            <input
              type="number"
              value={form.customPrice}
              onChange={(e) => form.setCustomPrice(e.target.value)}
              placeholder="מחיר"
              className={
                isCompact
                  ? 'w-full px-2.5 h-9 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gt-brand/15 focus:border-gt-brand'
                  : 'w-full px-3 h-12 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]'
              }
            />
            <label
              className={
                isCompact
                  ? 'inline-flex items-center gap-2 min-h-[36px] cursor-pointer'
                  : 'inline-flex items-center gap-2 min-h-[44px] cursor-pointer'
              }
            >
              <input
                type="checkbox"
                checked={form.customPriceIncludesVat}
                onChange={(e) => form.setCustomPriceIncludesVat(e.target.checked)}
                className={isCompact ? 'w-4 h-4 rounded border-gray-200' : 'w-4 h-4 rounded border-gray-300'}
              />
              <span className={isCompact ? 'text-xs text-gray-500 font-medium' : 'text-sm text-gray-700'}>
                כולל מע״מ
              </span>
            </label>
            <div
              className={
                isCompact
                  ? 'flex items-baseline justify-between gap-2 pt-1.5 mt-0.5 border-t border-gray-200'
                  : 'flex items-baseline justify-between pt-2 mt-1 border-t border-gray-200'
              }
            >
              <span
                className={
                  isCompact
                    ? 'text-xs font-medium text-gray-500'
                    : 'text-sm font-medium text-gray-500'
                }
              >
                סה״כ
              </span>
              <span
                className={
                  isCompact
                    ? 'text-lg font-bold text-gray-900 tabular-nums shrink-0'
                    : 'text-2xl font-bold text-gray-900'
                }
              >
                ₪{form.finalPrice.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {showRecommendedBreakdown && (
          <div className={isCompact ? 'text-xs space-y-1' : 'text-sm space-y-2'}>
            {form.priceResult ? (
              (() => {
                const rows = form.priceResult.breakdown.filter(
                  (item) => item.amount !== 0
                )
                // The final total is the last bold row (post-manual-adjustment total
                // when an adjustment applies, otherwise the plain סה״כ). Make it the star.
                const grandTotalIdx = rows.reduce(
                  (last, item, i) => (item.bold ? i : last),
                  -1
                )
                return (
                  <>
                    {rows.map((item, idx) => {
                      const label =
                        item.type === 'time' &&
                        form.priceResult!.maxTimeSurchargePercent > 0
                          ? form.priceResult!.maxTimeSurchargeLabel
                            ? `תוספת ${form.priceResult!.maxTimeSurchargeLabel} (${form.priceResult!.maxTimeSurchargePercent}%)`
                            : `תוספת זמן (${form.priceResult!.maxTimeSurchargePercent}%)`
                          : item.label
                      if (idx === grandTotalIdx) {
                        return (
                          <div
                            key={idx}
                            className={
                              isCompact
                                ? 'flex items-baseline justify-between gap-2 pt-1.5 mt-0.5 border-t border-gray-200'
                                : 'flex items-baseline justify-between pt-2 mt-1 border-t border-gray-200'
                            }
                          >
                            <span
                              className={
                                isCompact
                                  ? 'text-xs font-medium text-gray-500'
                                  : 'text-sm font-medium text-gray-500'
                              }
                            >
                              {label}
                            </span>
                            <span
                              className={
                                isCompact
                                  ? 'text-lg font-bold text-gray-900 tabular-nums shrink-0'
                                  : 'text-2xl font-bold text-gray-900'
                              }
                            >
                              ₪{item.amount.toFixed(2)}
                            </span>
                          </div>
                        )
                      }
                      return (
                        <p
                          key={idx}
                          className={
                            item.bold
                              ? isCompact
                                ? 'font-bold text-sm text-gray-900 leading-snug'
                                : 'font-bold text-base text-gray-900 leading-relaxed'
                              : isCompact
                                ? 'text-gray-500 leading-snug'
                                : 'text-gray-500 leading-relaxed'
                          }
                        >
                          {label}: ₪{item.amount.toFixed(2)}
                        </p>
                      )
                    })}
                    {usesCompanyTimeFallback &&
                      form.priceResult!.maxTimeSurchargePercent > 0 && (
                        <p className="text-xs text-amber-600">
                          תוספת השעה לפי תעריף החברה — ללקוח זה אין תוספת שעה מותאמת
                        </p>
                      )}
                  </>
                )
              })()
            ) : (
              <>
                <p className="text-gray-500">בסיס + מרחק + תוספות</p>
                <p className="text-gray-500">
                  לפני מע״מ: ₪{(form.finalPrice / 1.18).toFixed(2)}
                </p>
                <p className="text-gray-500">
                  מע״מ 18%: ₪{((form.finalPrice / 1.18) * 0.18).toFixed(2)}
                </p>
                <div
                  className={
                    isCompact
                      ? 'flex items-baseline justify-between gap-2 pt-1.5 mt-0.5 border-t border-gray-200'
                      : 'flex items-baseline justify-between pt-2 mt-1 border-t border-gray-200'
                  }
                >
                  <span
                    className={
                      isCompact ? 'text-xs font-medium text-gray-500' : 'text-sm font-medium text-gray-500'
                    }
                  >
                    סה״כ
                  </span>
                  <span
                    className={
                      isCompact
                        ? 'text-lg font-bold text-gray-900 tabular-nums shrink-0'
                        : 'text-2xl font-bold text-gray-900'
                    }
                  >
                    ₪{form.finalPrice.toFixed(2)}
                  </span>
                </div>
              </>
            )}

            {/* הנחה / תוספת ידנית — collapsed behind a quiet trigger.
                Only affects recommended / recommended_customer modes (matches desktop). */}
            <div className={isCompact ? 'pt-1.5 border-t border-gray-200 mt-1.5' : 'pt-2 border-t border-gray-200 mt-2'}>
              {!showManualAdj ? (
                <button
                  type="button"
                  onClick={() => setShowManualAdj(true)}
                  className={
                    isCompact
                      ? 'inline-flex items-center gap-1.5 min-h-[36px] text-xs font-medium text-gt-brand'
                      : 'inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-gt-brand'
                  }
                >
                  {hasManualAdj ? (
                    <>
                      <Pencil size={isCompact ? 13 : 15} className="shrink-0" />
                      <span>{manualAdjSummary}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={isCompact ? 14 : 16} className="shrink-0" />
                      <span>הוסף הנחה/תוספת</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => form.setManualAdjustmentType('discount')}
                    className={
                      isCompact
                        ? `min-h-[36px] px-2.5 rounded-lg text-xs font-medium ${
                            form.manualAdjustmentType === 'discount'
                              ? 'bg-red-500 text-white'
                              : 'bg-white text-gray-700 border border-gray-200'
                          }`
                        : `min-h-[44px] px-3 rounded-lg text-xs font-medium ${
                            form.manualAdjustmentType === 'discount'
                              ? 'bg-red-500 text-white'
                              : 'bg-white text-gray-700 border border-gray-300'
                          }`
                    }
                  >
                    הנחה
                  </button>
                  <button
                    type="button"
                    onClick={() => form.setManualAdjustmentType('markup')}
                    className={
                      isCompact
                        ? `min-h-[36px] px-2.5 rounded-lg text-xs font-medium ${
                            form.manualAdjustmentType === 'markup'
                              ? 'bg-green-500 text-white'
                              : 'bg-white text-gray-700 border border-gray-200'
                          }`
                        : `min-h-[44px] px-3 rounded-lg text-xs font-medium ${
                            form.manualAdjustmentType === 'markup'
                              ? 'bg-green-500 text-white'
                              : 'bg-white text-gray-700 border border-gray-300'
                          }`
                    }
                  >
                    תוספת
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.manualAdjustmentPercent}
                    onChange={(e) => form.setManualAdjustmentPercent(e.target.value)}
                    placeholder="%"
                    className={
                      isCompact
                        ? 'w-14 h-9 px-1.5 border border-gray-200 rounded-lg text-sm text-center'
                        : 'w-16 min-h-[44px] px-2 border border-gray-300 rounded-lg text-sm text-center'
                    }
                  />
                  <span className="text-xs text-gray-500">אחוז</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </FormCard>
  )
}
