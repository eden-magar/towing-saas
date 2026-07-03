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
}: {
  form: Form
  quoteGate: QuoteGate
}) {
  const totalDistanceKm =
    (form.distance?.distanceKm ?? 0) +
    (form.startFromBase && form.baseToPickupDistance
      ? form.baseToPickupDistance.distanceKm
      : 0)

  return (
    <section className="bg-amber-50 rounded-xl border-2 border-amber-300 shadow-sm overflow-hidden mb-4">
      <div className="px-4 py-4">
        {quoteGate.quoteSavedId ? (
          <div className="text-center">
            <p className="font-medium text-amber-800 mb-2">
              נשמר כהצעת מחיר — ניתן לחזור אליה מרשימת הגרירות
            </p>
            <Link
              href={`/dashboard/tows/${quoteGate.quoteSavedId}`}
              className="inline-flex items-center justify-center min-h-[48px] px-4 py-2 bg-amber-500 text-white rounded-xl font-medium"
            >
              צפה בהצעה
            </Link>
          </div>
        ) : quoteGate.quoteDeclined ? (
          <div className="text-center">
            <p className="font-medium text-amber-800 mb-4">
              הצעת מחיר — אישור טלפוני
            </p>
            <button
              type="button"
              onClick={quoteGate.handleSaveAsQuote}
              disabled={form.saving}
              className="w-full min-h-[48px] px-6 py-3 bg-amber-500 text-white rounded-xl font-medium disabled:opacity-50"
            >
              {form.saving ? (
                <Loader2 size={20} className="animate-spin inline" />
              ) : (
                'שמור כהצעה'
              )}
            </button>
          </div>
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
                className="w-full min-h-[48px] py-3 bg-green-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
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
                className="w-full min-h-[48px] py-3 bg-white text-red-600 border border-red-200 rounded-xl font-medium"
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
