function round2(n: number): number {

  return Math.round(n * 100) / 100

}



export type CancellationBaseTow = {

  price_mode?: string | null

  final_price?: number | null

  price_breakdown?: {

    base_price?: number

    distance_price?: number

  } | null

}



export type TowRevenueTow = {

  status: string

  final_price?: number | null

  cancellation_fee?: number | null

}



export type CancellationFeeBreakdown = {

  base: number

  feeBeforeVat: number

  vatAmount: number

  feeTotal: number

}



const ZERO_BREAKDOWN: CancellationFeeBreakdown = {

  base: 0,

  feeBeforeVat: 0,

  vatAmount: 0,

  feeTotal: 0,

}



function isPreVatCancellationMode(mode: string): boolean {

  return mode === 'recommended' || mode === 'recommended_customer'

}



/** Revenue contribution: completed → final_price; cancelled_charged → cancellation_fee (VAT-inclusive). */

export function getTowRevenueContribution(tow: TowRevenueTow): number {

  if (tow.status === 'completed') {

    return tow.final_price ?? 0

  }

  if (tow.status === 'cancelled_charged') {

    return tow.cancellation_fee ?? 0

  }

  return 0

}



export function getCancellationBase(tow: CancellationBaseTow): number {

  const mode = tow.price_mode ?? ''

  if (isPreVatCancellationMode(mode)) {

    const breakdown = tow.price_breakdown

    return (breakdown?.base_price ?? 0) + (breakdown?.distance_price ?? 0)

  }

  return tow.final_price ?? 0

}



export function computeCancellationFeeBreakdown(

  tow: CancellationBaseTow,

  percent: number,

  vatRate: number

): CancellationFeeBreakdown {

  const base = getCancellationBase(tow)

  if (!(base >= 0) || !(percent > 0 && percent <= 100) || !(vatRate >= 0)) {

    return ZERO_BREAKDOWN

  }



  const mode = tow.price_mode ?? ''

  if (isPreVatCancellationMode(mode)) {

    const feeBeforeVat = round2(base * percent / 100)

    const vatAmount = round2(feeBeforeVat * vatRate)

    const feeTotal = round2(feeBeforeVat + vatAmount)

    return { base, feeBeforeVat, vatAmount, feeTotal }

  }



  const feeTotal = round2(base * percent / 100)

  const feeBeforeVat = round2(feeTotal / (1 + vatRate))

  const vatAmount = round2(feeTotal - feeBeforeVat)

  return { base, feeBeforeVat, vatAmount, feeTotal }

}



/** Split stored VAT-inclusive cancellation_fee for display. */

export function extractCancellationFeeFromTotal(

  feeTotal: number,

  vatRate: number

): Pick<CancellationFeeBreakdown, 'feeBeforeVat' | 'vatAmount' | 'feeTotal'> {

  if (!(feeTotal > 0) || !(vatRate >= 0)) {

    return { feeBeforeVat: 0, vatAmount: 0, feeTotal: 0 }

  }

  const total = round2(feeTotal)

  const feeBeforeVat = round2(total / (1 + vatRate))

  const vatAmount = round2(total - feeBeforeVat)

  return { feeBeforeVat, vatAmount, feeTotal: total }

}



/** VAT-inclusive total to store in tows.cancellation_fee. */

export function computeCancellationFee(

  tow: CancellationBaseTow,

  percent: number,

  vatRate: number

): number {

  return computeCancellationFeeBreakdown(tow, percent, vatRate).feeTotal

}


