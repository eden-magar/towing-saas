'use client'

import { useState, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import {
  calculateEventPrice,
  type EventPriceResult,
} from '../../lib/utils/event-pricing'

function formatMoney(value: number): string {
  return `₪${value.toFixed(2)}`
}

export interface EventPriceEditorProps {
  initialBreakdown: EventPriceResult | null
  initialManualPrice: number | null
  vatRate: number
  saving: boolean
  onSave: (result: { enteredPrice: number; priceResult: EventPriceResult }) => void
  onCancel: () => void
}

function deriveInitialState(
  breakdown: EventPriceResult | null,
  manualPrice: number | null
) {
  if (breakdown) {
    const isSurcharge = (breakdown.surchargePercent ?? 0) > 0
    return {
      manualPriceStr:
        breakdown.enteredPrice != null ? String(breakdown.enteredPrice) : '',
      includesVat: breakdown.includesVat,
      adjustmentType: isSurcharge ? ('surcharge' as const) : ('discount' as const),
      adjustmentPercent: isSurcharge
        ? String(breakdown.surchargePercent || '')
        : breakdown.discountPercent > 0
          ? String(breakdown.discountPercent)
          : '',
    }
  }
  return {
    manualPriceStr: manualPrice != null ? String(manualPrice) : '',
    includesVat: true,
    adjustmentType: 'discount' as const,
    adjustmentPercent: '',
  }
}

export function EventPriceEditor({
  initialBreakdown,
  initialManualPrice,
  vatRate,
  saving,
  onSave,
  onCancel,
}: EventPriceEditorProps) {
  const initial = deriveInitialState(initialBreakdown, initialManualPrice)
  const [manualPrice, setManualPrice] = useState(initial.manualPriceStr)
  const [includesVat, setIncludesVat] = useState(initial.includesVat)
  const [adjustmentType, setAdjustmentType] = useState<'discount' | 'surcharge'>(
    initial.adjustmentType
  )
  const [adjustmentPercent, setAdjustmentPercent] = useState(initial.adjustmentPercent)

  const enteredPrice = useMemo(() => {
    const trimmed = manualPrice.trim()
    if (!trimmed) return null
    const parsed = parseFloat(trimmed)
    return Number.isNaN(parsed) ? null : parsed
  }, [manualPrice])

  const parsedAdjustment = useMemo(() => {
    const trimmed = adjustmentPercent.trim()
    if (!trimmed) return 0
    const parsed = parseFloat(trimmed)
    return Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
  }, [adjustmentPercent])

  const priceResult = useMemo(() => {
    if (enteredPrice == null) return null
    return calculateEventPrice({
      enteredPrice,
      includesVat,
      discountPercent: adjustmentType === 'discount' ? parsedAdjustment : 0,
      surchargePercent: adjustmentType === 'surcharge' ? parsedAdjustment : 0,
      vatRate,
    })
  }, [enteredPrice, includesVat, adjustmentType, parsedAdjustment, vatRate])

  const vatPercentLabel = Math.round(vatRate * 100)

  const handleSave = () => {
    if (enteredPrice == null || priceResult == null) return
    onSave({ enteredPrice, priceResult })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="number"
          min="0"
          step="0.01"
          value={manualPrice}
          onChange={(e) => setManualPrice(e.target.value)}
          placeholder="מחיר"
          disabled={saving}
          className="px-3 py-2 border border-gray-300 rounded-xl w-32 text-sm dir-ltr text-right focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includesVat}
            onChange={(e) => setIncludesVat(e.target.checked)}
            disabled={saving}
            className="rounded border-gray-300"
          />
          המחיר כולל מע״מ
        </label>
      </div>

      <div className="text-sm space-y-1">
        {priceResult ? (
          <>
            <p className="text-gray-500">
              לפני מע״מ: {formatMoney(priceResult.beforeVat)}
            </p>
            {priceResult.discountAmount > 0 && (
              <p className="text-gray-500">
                הנחה ({priceResult.discountPercent}%): -{formatMoney(priceResult.discountAmount)}
              </p>
            )}
            {priceResult.surchargeAmount > 0 && (
              <p className="text-gray-500">
                תוספת ({priceResult.surchargePercent}%): +{formatMoney(priceResult.surchargeAmount)}
              </p>
            )}
            <p className="text-gray-500">
              מע״מ ({vatPercentLabel}%): {formatMoney(priceResult.vatAmount)}
            </p>
            <p className="font-bold text-base text-gray-900">
              סה״כ: {formatMoney(priceResult.total)}
            </p>
          </>
        ) : (
          <p className="text-gray-400 text-sm">הזן מחיר ידני לחישוב פירוט</p>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-gray-200 mt-2">
          <button
            type="button"
            onClick={() => setAdjustmentType('discount')}
            disabled={saving}
            className={`px-2.5 py-1 rounded-lg text-xs ${
              adjustmentType === 'discount'
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            הנחה
          </button>
          <button
            type="button"
            onClick={() => setAdjustmentType('surcharge')}
            disabled={saving}
            className={`px-2.5 py-1 rounded-lg text-xs ${
              adjustmentType === 'surcharge'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            תוספת
          </button>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={adjustmentPercent}
            onChange={(e) => setAdjustmentPercent(e.target.value)}
            placeholder="%"
            disabled={saving}
            className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm dir-ltr text-right focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || priceResult == null}
          className="flex-1 py-2 bg-[#33d4ff] text-white rounded-xl text-sm font-medium hover:bg-[#21b8e6] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              שומר...
            </>
          ) : (
            'שמור'
          )}
        </button>
      </div>
    </div>
  )
}
