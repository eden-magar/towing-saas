export interface EventPriceInput {
  enteredPrice: number
  includesVat: boolean
  discountPercent?: number
  surchargePercent?: number
  vatRate: number
}

export interface EventPriceResult {
  enteredPrice: number
  includesVat: boolean
  discountPercent: number
  discountAmount: number
  surchargePercent: number
  surchargeAmount: number
  beforeVat: number
  vatAmount: number
  total: number
  vatRate: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function clampPercent(value: number | undefined): number {
  return Math.max(0, Math.min(100, value || 0))
}

/**
 * Event pricing: manual price + optional discount OR surcharge (before VAT) + VAT split.
 * Discount and surcharge are mutually exclusive — surcharge wins if both are passed.
 */
export function calculateEventPrice(input: EventPriceInput): EventPriceResult | null {
  const { enteredPrice, includesVat, vatRate } = input

  if (!Number.isFinite(enteredPrice) || enteredPrice < 0) return null
  if (!Number.isFinite(vatRate) || vatRate < 0) return null

  const surchargePct = clampPercent(input.surchargePercent)
  const discountPct = surchargePct > 0 ? 0 : clampPercent(input.discountPercent)
  const rate = vatRate
  const isSurcharge = surchargePct > 0
  const activePct = isSurcharge ? surchargePct : discountPct
  const factor = isSurcharge ? 1 + activePct / 100 : 1 - activePct / 100

  if (includesVat) {
    const afterAdjustment = round2(enteredPrice * factor)
    const beforeVat = round2(afterAdjustment / (1 + rate))
    const vatAmount = round2(afterAdjustment - beforeVat)
    const adjustmentAmount = round2(Math.abs(afterAdjustment - enteredPrice))

    return {
      enteredPrice: round2(enteredPrice),
      includesVat: true,
      discountPercent: discountPct,
      discountAmount: isSurcharge ? 0 : adjustmentAmount,
      surchargePercent: surchargePct,
      surchargeAmount: isSurcharge ? adjustmentAmount : 0,
      beforeVat,
      vatAmount,
      total: Math.round(afterAdjustment),
      vatRate: rate,
    }
  }

  const beforeVat = round2(enteredPrice * factor)
  const vatAmount = round2(beforeVat * rate)
  const totalBeforeRound = round2(beforeVat + vatAmount)
  const adjustmentAmount = round2(Math.abs(beforeVat - enteredPrice))

  return {
    enteredPrice: round2(enteredPrice),
    includesVat: false,
    discountPercent: discountPct,
    discountAmount: isSurcharge ? 0 : adjustmentAmount,
    surchargePercent: surchargePct,
    surchargeAmount: isSurcharge ? adjustmentAmount : 0,
    beforeVat,
    vatAmount,
    total: Math.round(totalBeforeRound),
    vatRate: rate,
  }
}
