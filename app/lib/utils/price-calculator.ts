/**
 * Unified tow price calculator.
 * Single source of truth for all price calculations (UI, save, breakdown).
 *
 * Recommended / recommended_customer formula (execution order):
 *   1. base (by vehicle type)
 *   2. + km × rate          (distanceKm includes מהחניון→מוצא; deadhead מיעד→חניון added at its rate)
 *   3. + fixed-₪ services   (taxable catalog + ad-hoc only — VAT-exempt held aside)
 *   ─────────────────────
 *   4. × each location %    (compounded: Π (1 + pᵢ/100))
 *   5. × time surcharge     (separate multiplier: × (1 + maxTime%/100))
 *   ─────────────────────
 *   6. + VAT
 *   7. − customer discount  (on VAT-INCLUSIVE total from step 6)
 *   8. ± manual adjustment  (on step-7 result)
 *   9. + VAT-exempt ₪       (untaxed, undiscounted)
 *  10. minimum price floor  (on the FINAL total)
 *   = total
 *
 * No mid-calculation rounding — callers round only for display/storage.
 * A 100% customer discount yields exactly ₪0 on the discounted portion (never negative).
 *
 * Fixed / custom modes bypass this stack and do NOT apply the minimum floor —
 * the dispatcher-set or catalog item price is charged as-is (plus optional VAT-exempt ₪).
 * Customer catalog items still apply the minimum after VAT / exempt lines.
 */

import { VehicleType } from '../types'
import { TimeSurcharge, getActiveTimeSurcharges } from '../queries/price-lists'

/** Customer standing discount applies only in ללקוח (`recommended_customer`) mode. */
export function customerDiscountForPriceMode(
  priceMode: string | null | undefined,
  discountPercent: number | null | undefined,
): number {
  if (priceMode !== 'recommended_customer') return 0
  const n = Number(discountPercent)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Apply a signed percent adjustment to a money base.
 * - Discount (negative percent) is capped at 100% and never exceeds `base`.
 * - Result is never negative.
 * - No mid-calculation rounding — callers round only for display.
 */
export function applyPercentAdjustment(
  base: number,
  signedPercent: number
): { amount: number; result: number } {
  const safeBase = Number.isFinite(base) ? base : 0
  if (!signedPercent || safeBase === 0) {
    return { amount: 0, result: Math.max(0, safeBase) }
  }
  const cappedPercent =
    signedPercent < 0 ? Math.max(signedPercent, -100) : signedPercent
  const raw = Math.abs(safeBase * (cappedPercent / 100))
  const amount = cappedPercent < 0 ? Math.min(raw, Math.max(0, safeBase)) : raw
  const result = Math.max(
    0,
    safeBase + (cappedPercent > 0 ? amount : cappedPercent < 0 ? -amount : 0)
  )
  return { amount, result }
}

/** Cap a customer/catalog discount percent to [0, 100] and amount to the base. */
export function applyDiscountPercent(
  base: number,
  discountPercent: number
): { discountAmount: number; afterDiscount: number } {
  const pct = Math.min(100, Math.max(0, discountPercent || 0))
  const { amount, result } = applyPercentAdjustment(base, pct === 0 ? 0 : -pct)
  return { discountAmount: amount, afterDiscount: result }
}

// ==================== Input ====================

export interface TowPriceListInput {
  base_prices: Record<VehicleType, number>
  price_per_km: number
  minimum_price: number
  price_per_km_private?: number | null
  price_per_km_motorcycle?: number | null
  price_per_km_heavy?: number | null
  price_per_km_machinery?: number | null
}

export interface ServiceSurchargeCalcInput {
  amount: number
  label?: string
  /** When true, held until after VAT/discount/manual — not taxed or discounted. */
  vatExempt?: boolean
  /** Alias accepted from stored/DB-shaped lines (same meaning as vatExempt). */
  is_vat_exempt?: boolean
}

export interface LocationSurchargeCalcInput {
  percent: number
  label?: string
  id?: string
}

export interface TowPriceInput {
  priceList: TowPriceListInput
  vehicleType: VehicleType
  distanceKm: number
  basePriceOverride?: number

  deadheadKm?: number
  deadheadRate?: number

  timeSurcharges: TimeSurcharge[]
  towDate: string
  towTime: string
  isHoliday: boolean
  activeTimeSurchargeIds?: string[]
  hasManualTimeSurchargeOverride?: boolean

  locationSurcharges: LocationSurchargeCalcInput[]
  serviceSurcharges: ServiceSurchargeCalcInput[]

  priceMode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  fixedPrice?: number
  customPrice?: number
  customPriceIncludesVat?: boolean

  discountPercent: number
  manualAdjustmentPercent?: number

  vatPercent?: number
}

// ==================== Output ====================

export interface PriceBreakdownItem {
  label: string
  amount: number
  type:
    | 'base'
    | 'distance'
    | 'time'
    | 'location'
    | 'service'
    | 'discount'
    | 'vat'
    | 'vat_exempt'
  bold?: boolean
}

export interface LocationSurchargeResultLine {
  id?: string
  label: string
  percent: number
  amount: number
}

export interface TowPriceResult {
  basePrice: number
  distancePrice: number
  deadheadKm: number
  deadheadPrice: number
  /** Taxable fixed-₪ services (inside multipliers). */
  serviceSurchargeAmount: number
  /** VAT-exempt fixed-₪ services (after everything, before min floor). */
  vatExemptSurchargeAmount: number
  /** base + distance + deadhead + taxable services (pre-multipliers). */
  subtotal: number
  maxTimeSurchargePercent: number
  maxTimeSurchargeLabel: string
  timeSurchargeAmount: number
  locationSurchargePercent: number
  locationSurchargeAmount: number
  locationSurchargeLines: LocationSurchargeResultLine[]
  /** Amount after location × time multipliers, before VAT. */
  beforeVat: number
  vatAmount: number
  /** VAT-inclusive total after step 6 (before customer discount). */
  afterVat: number
  beforeDiscount: number
  discountAmount: number
  afterDiscount: number
  manualAdjustmentAmount: number
  finalPrice: number
  minimumApplied: boolean
  total: number
  breakdown: PriceBreakdownItem[]
}

// ==================== Helpers ====================

function splitServices(services: ServiceSurchargeCalcInput[]): {
  taxable: ServiceSurchargeCalcInput[]
  exempt: ServiceSurchargeCalcInput[]
} {
  const taxable: ServiceSurchargeCalcInput[] = []
  const exempt: ServiceSurchargeCalcInput[] = []
  for (const s of services) {
    if (!s.amount || s.amount <= 0) continue
    if (s.vatExempt === true || s.is_vat_exempt === true) exempt.push(s)
    else taxable.push(s)
  }
  return { taxable, exempt }
}

function appendVatExemptLines(
  breakdown: PriceBreakdownItem[],
  exempt: ServiceSurchargeCalcInput[],
): number {
  let sum = 0
  for (const s of exempt) {
    sum += s.amount
    breakdown.push({
      label: `ללא מע״מ: ${s.label || 'שירות'}`,
      amount: s.amount,
      type: 'vat_exempt',
    })
  }
  return sum
}

function applyMinimumFloor(total: number, minimumPrice: number): {
  total: number
  minimumApplied: boolean
} {
  if (total < minimumPrice) return { total: minimumPrice, minimumApplied: true }
  return { total, minimumApplied: false }
}

// ==================== Main function ====================

export function calculateTowPrice(input: TowPriceInput): TowPriceResult {
  const vatRate = input.vatPercent ?? 0.18
  const { taxable: taxableServices, exempt: exemptServices } = splitServices(
    input.serviceSurcharges || [],
  )
  const emptyLocationLines: LocationSurchargeResultLine[] = []

  const emptyRecommendedFields = {
    deadheadKm: 0,
    deadheadPrice: 0,
    serviceSurchargeAmount: 0,
    vatExemptSurchargeAmount: 0,
    maxTimeSurchargePercent: 0,
    maxTimeSurchargeLabel: '',
    timeSurchargeAmount: 0,
    locationSurchargePercent: 0,
    locationSurchargeAmount: 0,
    locationSurchargeLines: emptyLocationLines,
    afterVat: 0,
    afterDiscount: 0,
    manualAdjustmentAmount: 0,
  }

  // ---------- Fixed / customer / custom (bypass recommended stack) ----------
  if (input.priceMode === 'fixed' && input.fixedPrice != null) {
    const { discountAmount, afterDiscount: total } = applyDiscountPercent(
      input.fixedPrice,
      input.discountPercent
    )
    const vatAmount = Math.max(0, total - total / (1 + vatRate))
    const beforeVat = total - vatAmount
    const breakdown: PriceBreakdownItem[] = [
      { label: 'לפני מע״מ', amount: beforeVat, type: 'base' },
      { label: `מע"מ ${Math.round(vatRate * 100)}%`, amount: vatAmount, type: 'vat' },
    ]
    const exemptSum = appendVatExemptLines(breakdown, exemptServices)
    const withExempt = total + exemptSum
    // Fixed catalog price is explicit — do not apply the minimum floor.
    breakdown.push({ label: 'סה״כ', amount: withExempt, type: 'base', bold: true })
    return {
      basePrice: 0,
      distancePrice: 0,
      ...emptyRecommendedFields,
      vatExemptSurchargeAmount: exemptSum,
      subtotal: 0,
      beforeVat,
      vatAmount,
      beforeDiscount: total,
      discountAmount,
      finalPrice: withExempt,
      minimumApplied: false,
      total: withExempt,
      breakdown,
    }
  }

  if (input.priceMode === 'customer' && input.fixedPrice != null) {
    const { discountAmount, afterDiscount: beforeDiscount } = applyDiscountPercent(
      input.fixedPrice,
      input.discountPercent
    )
    const vatAmount = Math.max(0, beforeDiscount * vatRate)
    const rawTotal = beforeDiscount + vatAmount
    const breakdown: PriceBreakdownItem[] = [
      { label: 'מחיר לקוח', amount: input.fixedPrice, type: 'base' },
    ]
    const exemptSum = appendVatExemptLines(breakdown, exemptServices)
    const withExempt = rawTotal + exemptSum
    const floored = applyMinimumFloor(withExempt, input.priceList.minimum_price)
    breakdown.push({ label: 'סה״כ', amount: floored.total, type: 'base', bold: true })
    return {
      basePrice: 0,
      distancePrice: 0,
      ...emptyRecommendedFields,
      vatExemptSurchargeAmount: exemptSum,
      subtotal: 0,
      beforeVat: beforeDiscount,
      vatAmount,
      afterVat: rawTotal,
      beforeDiscount: rawTotal,
      discountAmount,
      afterDiscount: rawTotal,
      finalPrice: floored.total,
      minimumApplied: floored.minimumApplied,
      total: floored.total,
      breakdown,
    }
  }

  if (input.priceMode === 'custom' && input.customPrice != null) {
    const price = input.customPrice
    const beforeVat = input.customPriceIncludesVat ? price / (1 + vatRate) : price
    const vatAmount = input.customPriceIncludesVat ? price - beforeVat : price * vatRate
    const total = input.customPriceIncludesVat ? price : price + vatAmount
    const breakdown: PriceBreakdownItem[] = [
      { label: 'לפני מע״מ', amount: beforeVat, type: 'base' },
      { label: `מע"מ ${Math.round(vatRate * 100)}%`, amount: vatAmount, type: 'vat' },
    ]
    const exemptSum = appendVatExemptLines(breakdown, exemptServices)
    const withExempt = total + exemptSum
    // Manual (ידני): dispatcher-set price — do not apply the minimum floor.
    breakdown.push({ label: 'סה״כ', amount: withExempt, type: 'base', bold: true })
    return {
      basePrice: 0,
      distancePrice: 0,
      ...emptyRecommendedFields,
      vatExemptSurchargeAmount: exemptSum,
      subtotal: 0,
      beforeVat,
      vatAmount,
      afterVat: total,
      beforeDiscount: total,
      discountAmount: 0,
      afterDiscount: total,
      finalPrice: withExempt,
      minimumApplied: false,
      total: withExempt,
      breakdown,
    }
  }

  // ---------- Recommended ----------
  const basePrice = input.basePriceOverride ?? (input.priceList.base_prices[input.vehicleType] ?? 0)
  const pricePerKm = resolvePricePerKm(input.vehicleType, input.priceList)
  const minimumPrice = input.priceList.minimum_price

  const distancePrice = input.distanceKm * pricePerKm

  const deadheadKm = input.deadheadKm ?? 0
  const deadheadRate = input.deadheadRate ?? 0
  const deadheadPrice = deadheadKm > 0 && deadheadRate > 0 ? deadheadKm * deadheadRate : 0

  const serviceAmount = taxableServices.reduce((sum, s) => sum + s.amount, 0)

  // Steps 1–3
  const stack = basePrice + distancePrice + deadheadPrice + serviceAmount

  // Time
  let activeTime: TimeSurcharge[] = []
  if (input.hasManualTimeSurchargeOverride) {
    activeTime = input.activeTimeSurchargeIds
      ? input.timeSurcharges.filter((s) => input.activeTimeSurchargeIds!.includes(s.id))
      : []
  } else {
    activeTime = getActiveTimeSurcharges(
      input.timeSurcharges,
      input.towTime,
      input.towDate,
      input.isHoliday
    )
  }
  const maxTimePercent =
    activeTime.length > 0 ? Math.max(...activeTime.map((s) => s.surcharge_percent), 0) : 0
  const maxTimeLabel =
    activeTime.length > 0
      ? activeTime.reduce(
          (max, s) => (s.surcharge_percent > max.surcharge_percent ? s : max),
          activeTime[0],
        ).label
      : ''

  // Step 4 — compound location %
  const locationLines: LocationSurchargeResultLine[] = []
  let afterLocation = stack
  let locationTotalAmount = 0
  let locationPercentSum = 0
  for (const loc of input.locationSurcharges) {
    if (!(loc.percent > 0)) continue
    locationPercentSum += loc.percent
    const before = afterLocation
    afterLocation = afterLocation * (1 + loc.percent / 100)
    const amount = afterLocation - before
    locationTotalAmount += amount
    locationLines.push({
      id: loc.id,
      label: loc.label || `תוספת מיקום (${loc.percent}%)`,
      percent: loc.percent,
      amount,
    })
  }

  // Step 5 — time multiplier
  const beforeTime = afterLocation
  const afterTime = afterLocation * (1 + maxTimePercent / 100)
  const timeAmount = afterTime - beforeTime

  // Step 6 — VAT
  const beforeVat = afterTime
  const vatAmount = Math.max(0, beforeVat * vatRate)
  const afterVat = beforeVat + vatAmount

  // Step 7 — customer discount on VAT-inclusive
  const { discountAmount, afterDiscount } = applyDiscountPercent(
    afterVat,
    input.discountPercent
  )

  // Step 8 — manual adjustment
  const manualAdjBase = input.manualAdjustmentPercent ?? 0
  const { amount: manualAdjAmount, result: afterManual } = applyPercentAdjustment(
    afterDiscount,
    manualAdjBase
  )

  // Step 9 — VAT-exempt
  const vatExemptSum = exemptServices.reduce((sum, s) => sum + s.amount, 0)
  const beforeMin = afterManual + vatExemptSum

  // Step 10 — minimum on FINAL total
  const { total, minimumApplied } = applyMinimumFloor(beforeMin, minimumPrice)

  const breakdown: PriceBreakdownItem[] = []
  if (basePrice !== 0) {
    breakdown.push({ label: 'מחיר בסיס', amount: basePrice, type: 'base' })
  }
  if (distancePrice !== 0) {
    breakdown.push({
      label: `מרחק (${input.distanceKm} ק״מ)`,
      amount: distancePrice,
      type: 'distance',
    })
  }
  if (deadheadPrice > 0) {
    breakdown.push({
      label: `מרחק סרק (${deadheadKm} ק״מ)`,
      amount: deadheadPrice,
      type: 'distance',
    })
  }
  for (const s of taxableServices) {
    breakdown.push({ label: s.label || 'שירות', amount: s.amount, type: 'service' })
  }
  for (const line of locationLines) {
    if (line.amount === 0) continue
    breakdown.push({
      label: line.label.includes('%') ? line.label : `${line.label} (${line.percent}%)`,
      amount: line.amount,
      type: 'location',
    })
  }
  if (maxTimePercent > 0 && timeAmount !== 0) {
    breakdown.push({
      label: maxTimeLabel
        ? `תוספת ${maxTimeLabel} (${maxTimePercent}%)`
        : `תוספת זמן (${maxTimePercent}%)`,
      amount: timeAmount,
      type: 'time',
    })
  }
  if (beforeVat !== 0) {
    breakdown.push({ label: 'סה״כ לפני מע״מ', amount: beforeVat, type: 'base' })
  }
  if (vatAmount !== 0) {
    breakdown.push({
      label: `מע״מ (${Math.round(vatRate * 100)}%)`,
      amount: vatAmount,
      type: 'vat',
    })
  }
  if (input.discountPercent > 0 && discountAmount !== 0) {
    breakdown.push({
      label: `הנחת לקוח (${input.discountPercent}%)`,
      amount: -discountAmount,
      type: 'discount',
    })
  }
  if (manualAdjBase !== 0 && manualAdjAmount !== 0) {
    breakdown.push({
      label:
        manualAdjBase > 0
          ? `תוספת (${manualAdjBase}%)`
          : `הנחה ידנית (${Math.abs(manualAdjBase)}%)`,
      amount: manualAdjBase > 0 ? manualAdjAmount : -manualAdjAmount,
      type: manualAdjBase > 0 ? 'service' : 'discount',
    })
  }
  appendVatExemptLines(breakdown, exemptServices)
  breakdown.push({
    label: minimumApplied ? 'מחיר מינימום' : 'סה״כ',
    amount: total,
    type: 'base',
    bold: true,
  })

  return {
    basePrice,
    distancePrice,
    deadheadKm,
    deadheadPrice,
    serviceSurchargeAmount: serviceAmount,
    vatExemptSurchargeAmount: vatExemptSum,
    subtotal: stack,
    maxTimeSurchargePercent: maxTimePercent,
    maxTimeSurchargeLabel: maxTimeLabel,
    timeSurchargeAmount: timeAmount,
    locationSurchargePercent: locationPercentSum,
    locationSurchargeAmount: locationTotalAmount,
    locationSurchargeLines: locationLines,
    beforeVat,
    vatAmount,
    afterVat,
    beforeDiscount: afterVat,
    discountAmount,
    afterDiscount,
    manualAdjustmentAmount: manualAdjAmount,
    finalPrice: total,
    minimumApplied,
    total,
    breakdown,
  }
}

/** Treat '' as unset; preserve 0 as an explicit value. */
function normalizeNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export { normalizeNullableNumber }

function normalizeNullableString(value: unknown): string | null {
  if (value === '' || value === null || value === undefined) return null
  return String(value)
}

/** Inputs persisted on tows.price_breakdown. Prefer stored `total` as source of truth. */
export type StoredPriceBreakdownForTotals = {
  subtotal: number
  vat_amount: number
  manual_adjustment_percent?: number | null
  manual_adjustment_type?: 'discount' | 'markup' | null
  total?: number
  discount_amount?: number
  vat_exempt_surcharges?: { amount: number }[]
}

/**
 * Display totals from a stored breakdown (new formula).
 * Prefer `breakdown.total` as the final charged price.
 * Manual adjustment applies after VAT+discount; VAT-exempt is after that.
 */
export function computeStoredPriceBreakdownTotals(
  breakdown: StoredPriceBreakdownForTotals,
  _vatRate: number
): {
  beforeVat: number
  preManualVat: number
  totalBeforeManual: number
  afterDiscount: number
  vatExemptAmount: number
  manualAdjustment: {
    percent: number
    type: 'discount' | 'markup'
    amount: number
  } | null
  finalTotal: number
  postManualBeforeVat: number
  postManualVat: number
} {
  const beforeVat = breakdown.subtotal
  const preManualVat = breakdown.vat_amount
  const afterVat = beforeVat + preManualVat
  const discountAmount = Math.max(0, breakdown.discount_amount ?? 0)
  const afterDiscount = Math.max(0, afterVat - discountAmount)
  const vatExemptAmount = (breakdown.vat_exempt_surcharges ?? []).reduce(
    (sum, x) => sum + (Number(x.amount) || 0),
    0,
  )

  const percent = breakdown.manual_adjustment_percent ?? 0
  let manualAdjustment: {
    percent: number
    type: 'discount' | 'markup'
    amount: number
  } | null = null
  let afterManual = afterDiscount
  if (percent > 0) {
    const type = breakdown.manual_adjustment_type === 'markup' ? 'markup' : 'discount'
    const signed = type === 'markup' ? percent : -percent
    const { amount, result } = applyPercentAdjustment(afterDiscount, signed)
    manualAdjustment = { percent, type, amount }
    afterManual = result
  }

  const finalTotal = Math.max(
    0,
    breakdown.total ?? afterManual + vatExemptAmount,
  )

  return {
    beforeVat,
    preManualVat,
    /** VAT-inclusive total before customer discount / manual / exempt (step 6). */
    totalBeforeManual: afterVat,
    afterDiscount,
    vatExemptAmount,
    manualAdjustment,
    finalTotal,
    // Legacy fields: VAT is fixed at step 6; do not backsolve from final total.
    postManualBeforeVat: beforeVat,
    postManualVat: preManualVat,
  }
}

const MERGE_NUMERIC_FIELDS = [
  'base_price_private',
  'base_price_motorcycle',
  'base_price_heavy',
  'base_price_machinery',
  'price_per_km',
  'price_per_km_private',
  'price_per_km_motorcycle',
  'price_per_km_heavy',
  'price_per_km_machinery',
  'price_per_km_deadhead',
  'minimum_price',
  'base_lat',
  'base_lng',
] as const

type MergeablePriceList = Record<string, any> | null | undefined

const PER_TYPE_KM_TYPES = ['private', 'motorcycle', 'heavy', 'machinery'] as const
type PerTypeKmVehicleType = (typeof PER_TYPE_KM_TYPES)[number]

/** Per-type km when set; else global price_per_km; else 12. */
export function resolvePricePerKm(
  vehicleType: string,
  priceList: Pick<
    TowPriceListInput,
    | 'price_per_km'
    | 'price_per_km_private'
    | 'price_per_km_motorcycle'
    | 'price_per_km_heavy'
    | 'price_per_km_machinery'
  >
): number {
  if (PER_TYPE_KM_TYPES.includes(vehicleType as PerTypeKmVehicleType)) {
    const perTypeKey = `price_per_km_${vehicleType}` as keyof typeof priceList
    const perType = normalizeNullableNumber(priceList[perTypeKey])
    if (perType != null && perType > 0) return perType
  }
  const global = normalizeNullableNumber(priceList.price_per_km)
  if (global != null) return global
  return 12
}

export function resolveDeadheadRate(
  priceList: { price_per_km_deadhead?: number | null } | null | undefined
): number {
  const rate = normalizeNullableNumber(priceList?.price_per_km_deadhead)
  return rate != null && rate > 0 ? rate : 0
}

export function priceListForTowCalc(
  priceList: Record<string, any> | null | undefined,
  options?: { globalKmOnly?: boolean }
): TowPriceListInput {
  const globalKmOnly = options?.globalKmOnly === true
  return {
    base_prices: extractBasePrices(priceList ?? null),
    price_per_km: priceList?.price_per_km ?? 12,
    minimum_price: priceList?.minimum_price ?? 250,
    price_per_km_private: globalKmOnly ? null : (priceList?.price_per_km_private ?? null),
    price_per_km_motorcycle: globalKmOnly ? null : (priceList?.price_per_km_motorcycle ?? null),
    price_per_km_heavy: globalKmOnly ? null : (priceList?.price_per_km_heavy ?? null),
    price_per_km_machinery: globalKmOnly ? null : (priceList?.price_per_km_machinery ?? null),
  }
}

export function mergePriceLists(
  company: MergeablePriceList,
  customer: MergeablePriceList
): Record<string, any> | null {
  if (customer == null) return (company as Record<string, any>) ?? null
  if (company == null) return (customer as Record<string, any>) ?? null

  const merged: Record<string, any> = { ...(company as Record<string, any>) }

  const customerRec = customer as Record<string, any>
  for (const key of MERGE_NUMERIC_FIELDS) {
    const customerVal = normalizeNullableNumber(customerRec[key])
    if (customerVal != null) {
      merged[key] = customerVal
    }
  }

  const customerAddress = normalizeNullableString(customerRec.base_address)
  if (customerAddress != null) {
    merged.base_address = customerAddress
  }

  return merged
}

export function extractBasePrices(priceList: Record<string, any> | null): Record<VehicleType, number> {
  if (!priceList) {
    return { private: 180, motorcycle: 100, heavy: 350, machinery: 500, personal_import: 180 }
  }
  const privatePrice = priceList.base_price_private ?? 180
  return {
    private: privatePrice,
    motorcycle: priceList.base_price_motorcycle ?? 100,
    heavy: priceList.base_price_heavy ?? 350,
    machinery: priceList.base_price_machinery ?? 500,
    personal_import: privatePrice,
  }
}

export function resolveWeightBracketBase(
  weightKg: number,
  brackets: { min_kg: number; max_kg: number | null; base_price: number; sort_order: number }[]
): number | null {
  if (!brackets.length || !(weightKg > 0)) return null
  const sorted = [...brackets].sort((a, b) => (a.sort_order - b.sort_order) || (a.min_kg - b.min_kg))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (weightKg < first.min_kg) return first.base_price
  for (const b of sorted) {
    if (weightKg >= b.min_kg && (b.max_kg == null || weightKg <= b.max_kg)) return b.base_price
  }
  return last.base_price
}

export function resolveVehicleBasePrice(
  type: string,
  weightKg: number | null,
  brackets: { min_kg: number; max_kg: number | null; base_price: number; sort_order: number }[],
  flatPrices: Record<string, number>
): number {
  if (type === 'van' && weightKg != null && weightKg > 0) {
    return resolveWeightBracketBase(weightKg, brackets) ?? 0
  }
  if (
    type === 'private' ||
    type === 'motorcycle' ||
    type === 'heavy' ||
    type === 'machinery' ||
    type === 'personal_import'
  ) {
    return flatPrices[type] ?? flatPrices.private ?? 0
  }
  return flatPrices.private ?? 0
}
