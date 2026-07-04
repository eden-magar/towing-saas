'use client'

import Link from 'next/link'
import { Check, Loader2 } from 'lucide-react'
import { useTowForm } from '../../../hooks/useTowForm'
import type { QuoteGate } from '../../../hooks/useQuoteGate'
import { getTowTypeLabel } from '../../../lib/utils/tow-type-labels'

type Form = ReturnType<typeof useTowForm>

/**
 * Quote approval gate for single tows on the mobile scroll page — mirrors
 * create/page.tsx Section 6 (הצעת מחיר — אישור טלפוני).
 */
export function SectionQuoteGate({
  form,
  quoteGate,
  compact = false,
}: {
  form: Form
  quoteGate: QuoteGate
  /** Tighter layout for narrow desktop columns (ColumnLayout). Default preserves mobile sizing. */
  compact?: boolean
}) {
  const totalDistanceKm =
    (form.distance?.distanceKm ?? 0) +
    (form.startFromBase && form.baseToPickupDistance
      ? form.baseToPickupDistance.distanceKm
      : 0)

  const shellClass = compact
    ? 'bg-amber-50 rounded-lg border border-gray-200 shadow-sm mb-0'
    : 'bg-amber-50 rounded-xl border-2 border-amber-300 shadow-sm overflow-hidden mb-4'
  const bodyClass = compact ? 'px-3 py-2' : 'px-4 py-4'
  const primaryBtnClass = compact
    ? 'flex-1 min-w-0 min-h-[36px] px-1.5 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium leading-normal whitespace-normal flex items-center justify-center gap-1 disabled:opacity-50'
    : 'w-full min-h-[48px] py-3 bg-green-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50'
  const secondaryBtnClass = compact
    ? 'flex-1 min-w-0 min-h-[36px] px-1.5 py-1.5 bg-white text-red-600 border border-gray-200 rounded-lg text-xs font-medium leading-normal whitespace-normal flex items-center justify-center text-center'
    : 'w-full min-h-[48px] py-3 bg-white text-red-600 border border-red-200 rounded-xl font-medium'
  const saveQuoteBtnClass = compact
    ? 'w-full min-h-[36px] px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium leading-normal disabled:opacity-50'
    : 'w-full min-h-[48px] px-6 py-3 bg-amber-500 text-white rounded-xl font-medium disabled:opacity-50'
  const viewQuoteLinkClass = compact
    ? 'inline-flex items-center justify-center min-h-[36px] px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium'
    : 'inline-flex items-center justify-center min-h-[48px] px-4 py-2 bg-amber-500 text-white rounded-xl font-medium'

  return (
    <section className={shellClass}>
      <div className={bodyClass}>
        {quoteGate.quoteSavedId ? (
          <div className={compact ? 'text-center space-y-2' : 'text-center'}>
            <p
              className={
                compact
                  ? 'text-sm font-medium text-amber-800'
                  : 'font-medium text-amber-800 mb-2'
              }
            >
              נשמר כהצעת מחיר — ניתן לחזור אליה מרשימת הגרירות
            </p>
            <Link href={`/dashboard/tows/${quoteGate.quoteSavedId}`} className={viewQuoteLinkClass}>
              צפה בהצעה
            </Link>
          </div>
        ) : quoteGate.quoteDeclined ? (
          <div className={compact ? 'text-center space-y-2' : 'text-center'}>
            <p
              className={
                compact
                  ? 'text-sm font-medium text-amber-800'
                  : 'font-medium text-amber-800 mb-4'
              }
            >
              הצעת מחיר — אישור טלפוני
            </p>
            <button
              type="button"
              onClick={quoteGate.handleSaveAsQuote}
              disabled={form.saving}
              className={saveQuoteBtnClass}
            >
              {form.saving ? (
                <Loader2 size={compact ? 16 : 20} className="animate-spin inline" />
              ) : (
                'שמור כהצעה'
              )}
            </button>
          </div>
        ) : compact ? (
          <>
            <h3 className="font-semibold text-amber-900 text-sm mb-1">
              הצעת מחיר — אישור טלפוני
            </h3>
            <div className="flex items-end justify-between gap-2 mb-2 min-w-0">
              <p className="text-lg font-bold text-amber-900 leading-tight tabular-nums shrink-0">
                ₪{form.finalPrice.toFixed(2)}
              </p>
              <span className="text-xs text-gray-500 font-medium text-left leading-snug min-w-0">
                {getTowTypeLabel(form.towType)} • {totalDistanceKm.toFixed(1)} ק״מ
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={quoteGate.handleQuoteApproveClick}
                disabled={quoteGate.approvingQuote || form.saving}
                className={primaryBtnClass}
              >
                {quoteGate.approvingQuote ? (
                  <Loader2 size={14} className="animate-spin shrink-0" />
                ) : (
                  <Check size={14} className="shrink-0" />
                )}
                <span>הלקוח אישר ✓</span>
              </button>
              <button
                type="button"
                onClick={() => quoteGate.setQuoteDeclined(true)}
                className={secondaryBtnClass}
              >
                לא אישר — שמור כהצעה
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-bold text-amber-900 text-lg mb-2">
              הצעת מחיר — אישור טלפוני
            </h3>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-amber-800">
                {getTowTypeLabel(form.towType)} • {totalDistanceKm.toFixed(1)} ק״מ
              </span>
            </div>
            <p className="text-2xl font-bold text-amber-900 mb-4">
              ₪{form.finalPrice.toFixed(2)}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={quoteGate.handleQuoteApproveClick}
                disabled={quoteGate.approvingQuote || form.saving}
                className={primaryBtnClass}
              >
                {quoteGate.approvingQuote ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Check size={20} />
                )}
                הלקוח אישר ✓
              </button>
              <button
                type="button"
                onClick={() => quoteGate.setQuoteDeclined(true)}
                className={secondaryBtnClass}
              >
                לא אישר — שמור כהצעה
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
