/**
 * Unified tow price calculator.
 * Single source of truth for all price calculations (UI, save, breakdown).
 *
 * Formula (client-confirmed):
 *   subtotal = base_price + (km × price_per_km)
 *   before_vat = subtotal × (1 + max(time surcharge %)) + sum(location % of subtotal) + sum(service ₪)
 *   before_discount = before_vat × (1 + vat_percent)
 *   final_price = before_discount × (1 - discount_percent/100)
 *   total = max(final_price, minimum_price)
 */

import { VehicleType } from '../types'
import { TimeSurcharge, getActiveTimeSurcharges } from '../queries/price-lists'

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

export interface TowPriceInput {
  // base pricing
  priceList: TowPriceListInput
  vehicleType: VehicleType
  distanceKm: number
  /** Override base price (e.g. for custom route with multiple vehicles) */
  basePriceOverride?: number

  // surcharges
  timeSurcharges: TimeSurcharge[]
  towDate: string // YYYY-MM-DD
  towTime: string // HH:MM
  isHoliday: boolean
  activeTimeSurchargeIds?: string[] // IDs manually toggled by dispatcher (override)
  hasManualTimeSurchargeOverride?: boolean

  locationSurcharges: { percent: number }[]
  serviceSurcharges: { amount: number; label?: string }[]

  // price mode
  priceMode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  fixedPrice?: number
  customPrice?: number
  customPriceIncludesVat?: boolean

  // discount
  discountPercent: number
  manualAdjustmentPercent?: number

  // vat
  vatPercent?: number // default 0.18
}

// ==================== Output ====================

export interface PriceBreakdownItem {
  label: string
  amount: number
  type: 'base' | 'distance' | 'time' | 'location' | 'service' | 'discount' | 'vat'
  bold?: boolean
}

export interface TowPriceResult {
  basePrice: number
  distancePrice: number
  subtotal: number
  maxTimeSurchargePercent: number
  maxTimeSurchargeLabel: string
  locationSurchargePercent: number
  locationSurchargeAmount: number
  serviceSurchargeAmount: number
  beforeVat: number
  vatAmount: number
  beforeDiscount: number
  discountAmount: number
  finalPrice: number
  minimumApplied: boolean
  total: number
  breakdown: PriceBreakdownItem[]
}

// ==================== Main function ====================

export function calculateTowPrice(input: TowPriceInput): TowPriceResult {
  const vatRate = input.vatPercent ?? 0.18

  // Fixed / customer / custom modes
  if (input.priceMode === 'fixed' && input.fixedPrice != null) {
    const discountAmount = input.fixedPrice * (input.discountPercent / 100)
    const total = input.fixedPrice - discountAmount
    const vatAmount = total - (total / (1 + vatRate))
    const beforeVat = total - vatAmount
    return {
      basePrice: 0,
      distancePrice: 0,
      subtotal: 0,
      maxTimeSurchargePercent: 0,
      maxTimeSurchargeLabel: '',
      locationSurchargePercent: 0,
      locationSurchargeAmount: 0,
      serviceSurchargeAmount: 0,
      beforeVat,
      vatAmount,
      beforeDiscount: total,
      discountAmount,
      finalPrice: total,
      minimumApplied: false,
      total,
      breakdown: [
        { label: 'לפני מע״מ', amount: beforeVat, type: 'base' },
        { label: `מע"מ ${Math.round(vatRate * 100)}%`, amount: vatAmount, type: 'vat' },
      ]
    }
  }

  if (input.priceMode === 'customer' && input.fixedPrice != null) {
    const beforeDiscount = input.fixedPrice * (1 - input.discountPercent / 100)
    const vatAmount = beforeDiscount * vatRate
    const total = Math.max(beforeDiscount + vatAmount, input.priceList.minimum_price)
    return {
      basePrice: 0,
      distancePrice: 0,
      subtotal: 0,
      maxTimeSurchargePercent: 0,
      maxTimeSurchargeLabel: '',
      locationSurchargePercent: 0,
      locationSurchargeAmount: 0,
      serviceSurchargeAmount: 0,
      beforeVat: beforeDiscount,
      vatAmount,
      beforeDiscount: beforeDiscount + vatAmount,
      discountAmount: input.fixedPrice * (input.discountPercent / 100),
      finalPrice: beforeDiscount + vatAmount,
      minimumApplied: total > beforeDiscount + vatAmount,
      total,
      breakdown: [{ label: 'מחיר לקוח', amount: input.fixedPrice, type: 'base' }]
    }
  }

  if (input.priceMode === 'custom' && input.customPrice != null) {
    const price = input.customPrice
    const beforeVat = input.customPriceIncludesVat ? price / (1 + vatRate) : price
    const vatAmount = input.customPriceIncludesVat ? price - beforeVat : price * vatRate
    const total = input.customPriceIncludesVat ? price : price + vatAmount
    return {
      basePrice: 0,
      distancePrice: 0,
      subtotal: 0,
      maxTimeSurchargePercent: 0,
      maxTimeSurchargeLabel: '',
      locationSurchargePercent: 0,
      locationSurchargeAmount: 0,
      serviceSurchargeAmount: 0,
      beforeVat,
      vatAmount,
      beforeDiscount: total,
      discountAmount: 0,
      finalPrice: total,
      minimumApplied: false,
      total,
      breakdown: [
        { label: 'לפני מע״מ', amount: beforeVat, type: 'base' },
        { label: `מע"מ ${Math.round(vatRate * 100)}%`, amount: vatAmount, type: 'vat' },
      ]
    }
  }

  // Recommended mode
  const basePrice = input.basePriceOverride ?? (input.priceList.base_prices[input.vehicleType] ?? 0)
  const pricePerKm = resolvePricePerKm(input.vehicleType, input.priceList)
  const minimumPrice = input.priceList.minimum_price

  const distancePrice = input.distanceKm * pricePerKm
  const subtotal = basePrice + distancePrice

  // Time surcharge: max of active ones (or use override IDs)
  let activeTime: TimeSurcharge[] = []
  if (input.hasManualTimeSurchargeOverride) {
    activeTime = input.activeTimeSurchargeIds
      ? input.timeSurcharges.filter(s => input.activeTimeSurchargeIds!.includes(s.id))
      : []
  } else {
    activeTime = getActiveTimeSurcharges(
      input.timeSurcharges,
      input.towTime,
      input.towDate,
      input.isHoliday
    )
  }
  const maxTimePercent = activeTime.length > 0
    ? Math.max(...activeTime.map(s => s.surcharge_percent), 0)
    : 0
  const maxTimeLabel = activeTime.length > 0
    ? activeTime.reduce((max, s) => (s.surcharge_percent > max.surcharge_percent ? s : max), activeTime[0]).label
    : ''

  // Location surcharges stack
  const locationPercent = input.locationSurcharges.reduce((sum, s) => sum + s.percent, 0)
  const locationAmount = subtotal * (locationPercent / 100)

  // Service surcharges in ₪
  const serviceAmount = input.serviceSurcharges.reduce((sum, s) => sum + s.amount, 0)

  // before_vat = subtotal × (1 + max time %) + location + services
  const preVatSubtotal = subtotal * (1 + maxTimePercent / 100) + locationAmount + serviceAmount

  const beforeDiscount = preVatSubtotal
  const discountAmount = beforeDiscount * (input.discountPercent / 100)

  const beforeVat = beforeDiscount - discountAmount
  const vatAmount = Math.round(beforeVat * vatRate)
  const totalBeforeManual = beforeVat + vatAmount
  const manualAdjBase = input.manualAdjustmentPercent ?? 0
  const manualAdjAmountCalc = Math.round(Math.abs(totalBeforeManual * manualAdjBase / 100))
  const total = totalBeforeManual + (manualAdjBase > 0 ? manualAdjAmountCalc : manualAdjBase < 0 ? -manualAdjAmountCalc : 0)
  const totalBeforeVat = Math.round(total / (1 + vatRate))
  const finalVatAmount = total - totalBeforeVat

  const finalPrice = total
  const minimumApplied = Math.max(Math.round(total), minimumPrice) > Math.round(total)
  const cappedTotal = Math.max(Math.round(total), minimumPrice)

  const breakdown: PriceBreakdownItem[] = [
    { label: 'מחיר בסיס', amount: basePrice, type: 'base' },
    { label: `מרחק (${input.distanceKm} ק״מ)`, amount: distancePrice, type: 'distance' }
  ]
  if (maxTimePercent > 0) {
    breakdown.push({
      label: maxTimeLabel,
      amount: subtotal * (maxTimePercent / 100),
      type: 'time'
    })
  }
  input.locationSurcharges.forEach(s => {
    if (s.percent > 0) {
      breakdown.push({
        label: `תוספת מיקום (${s.percent}%)`,
        amount: subtotal * (s.percent / 100),
        type: 'location'
      })
    }
  })
  input.serviceSurcharges.forEach(s => {
    if (s.amount > 0) {
      breakdown.push({ label: s.label || 'שירות', amount: s.amount, type: 'service' })
    }
  })
  if (input.discountPercent > 0) {
    breakdown.push({
      label: `הנחה (${input.discountPercent}%)`,
      amount: -discountAmount,
      type: 'discount'
    })
  }
  // subtotal before VAT
  breakdown.push({ label: 'סה״כ לפני מע״מ', amount: beforeVat, type: 'base' })
  // VAT on original total
  breakdown.push({ label: `מע״מ (${Math.round(vatRate * 100)}%)`, amount: vatAmount, type: 'vat' })
  // total before manual adjustment (bold marker — amount = totalBeforeManual)
  breakdown.push({ label: 'סה״כ', amount: totalBeforeManual, type: 'base', bold: true })

  // manual adjustment
  const manualAdj = input.manualAdjustmentPercent ?? 0
  const manualAdjAmount = Math.round(Math.abs(totalBeforeManual * manualAdj / 100))
  if (manualAdj !== 0) {
    breakdown.push({
      label: manualAdj > 0 ? `תוספת (${manualAdj}%)` : `הנחה ידנית (${Math.abs(manualAdj)}%)`,
      amount: manualAdj > 0 ? manualAdjAmount : -manualAdjAmount,
      type: manualAdj > 0 ? 'service' : 'discount'
    })
    // breakdown after manual adj
    breakdown.push({ label: 'לפני מע״מ', amount: totalBeforeVat, type: 'base' })
    breakdown.push({ label: `מע״מ (${Math.round(vatRate * 100)}%)`, amount: finalVatAmount, type: 'vat' })
    breakdown.push({ label: manualAdj > 0 ? 'סך הכל אחרי תוספת' : 'סך הכל אחרי הנחה', amount: total, type: 'base', bold: true })
  }

  return {
    basePrice,
    distancePrice,
    subtotal,
    maxTimeSurchargePercent: maxTimePercent,
    maxTimeSurchargeLabel: maxTimeLabel,
    locationSurchargePercent: locationPercent,
    locationSurchargeAmount: locationAmount,
    serviceSurchargeAmount: serviceAmount,
    beforeVat,
    vatAmount,
    beforeDiscount,
    discountAmount,
    finalPrice,
    minimumApplied,
    total: cappedTotal,
    breakdown
  }
}

// ==================== Helpers for callers ====================

export type MergeablePriceList = Record<string, any> | object | null | undefined

/** Treat '' as unset; preserve 0 as an explicit value. */
export function normalizeNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizeNullableString(value: unknown): string | null {
  if (value === '' || value === null || value === undefined) return null
  return String(value)
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
  'minimum_price',
  'base_lat',
  'base_lng',
] as const

const PER_TYPE_KM_TYPES = ['private', 'motorcycle', 'heavy', 'machinery'] as const
type PerTypeKmVehicleType = (typeof PER_TYPE_KM_TYPES)[number]

/** Per-type km when set (private/motorcycle/heavy/machinery only); else global price_per_km; else 12. */
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

/**
 * Per-field merge: customer value when set (including 0), else company.
 * Does not merge surcharges — base list scalars only.
 */
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

/**
 * Build base_prices from a price list (DB format).
 */
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
  if (type === 'private' || type === 'motorcycle' || type === 'heavy' || type === 'machinery' || type === 'personal_import') {
    return flatPrices[type] ?? flatPrices.private ?? 0
  }
  return flatPrices.private ?? 0
}
