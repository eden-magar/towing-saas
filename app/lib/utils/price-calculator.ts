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

export interface TowPriceInput {
  // base pricing
  priceList: {
    base_prices: Record<VehicleType, number>
    price_per_km: number
    minimum_price: number
  }
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

  locationSurcharges: { percent: number }[]
  serviceSurcharges: { amount: number }[]

  // price mode
  priceMode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  fixedPrice?: number
  customPrice?: number
  customPriceIncludesVat?: boolean

  // discount
  discountPercent: number

  // vat
  vatPercent?: number // default 0.18
}

// ==================== Output ====================

export interface PriceBreakdownItem {
  label: string
  amount: number
  type: 'base' | 'distance' | 'time' | 'location' | 'service' | 'discount' | 'vat'
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
    const beforeDiscount = input.fixedPrice
    const discountAmount = beforeDiscount * (input.discountPercent / 100)
    const finalPrice = beforeDiscount - discountAmount
    const vatAmount = finalPrice * vatRate
    const total = Math.max(finalPrice + vatAmount, input.priceList.minimum_price)
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
      beforeDiscount: finalPrice + vatAmount,
      discountAmount,
      finalPrice: finalPrice + vatAmount,
      minimumApplied: total > finalPrice + vatAmount,
      total,
      breakdown: [{ label: 'מחיר קבוע', amount: input.fixedPrice, type: 'base' }]
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
    const vatAmount = beforeVat * vatRate
    const total = input.customPriceIncludesVat ? price : beforeVat + vatAmount
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
      breakdown: [{ label: 'מחיר ידני', amount: price, type: 'base' }]
    }
  }

  // Recommended mode
  const basePrice = input.basePriceOverride ?? (input.priceList.base_prices[input.vehicleType] ?? 0)
  const pricePerKm = input.priceList.price_per_km
  const minimumPrice = input.priceList.minimum_price

  const distancePrice = input.distanceKm * pricePerKm
  const subtotal = basePrice + distancePrice

  // Time surcharge: max of active ones (or use override IDs)
  let activeTime: TimeSurcharge[] = []
  if (input.activeTimeSurchargeIds && input.activeTimeSurchargeIds.length > 0) {
    activeTime = input.timeSurcharges.filter(s => input.activeTimeSurchargeIds!.includes(s.id))
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
  const beforeVat = subtotal * (1 + maxTimePercent / 100) + locationAmount + serviceAmount

  // VAT
  const vatAmount = beforeVat * vatRate
  const beforeDiscount = beforeVat + vatAmount

  // Discount
  const discountAmount = beforeDiscount * (input.discountPercent / 100)
  const finalPrice = beforeDiscount * (1 - input.discountPercent / 100)

  // Minimum and round
  const total = Math.max(Math.round(finalPrice), minimumPrice)
  const minimumApplied = total > Math.round(finalPrice)

  // Breakdown for display
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
      breakdown.push({ label: 'שירות', amount: s.amount, type: 'service' })
    }
  })
  if (input.discountPercent > 0) {
    breakdown.push({
      label: `הנחה (${input.discountPercent}%)`,
      amount: -discountAmount,
      type: 'discount'
    })
  }
  breakdown.push({ label: `מע״מ (${Math.round(vatRate * 100)}%)`, amount: vatAmount, type: 'vat' })

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
    total,
    breakdown
  }
}

// ==================== Helpers for callers ====================

/**
 * Build base_prices from a price list (DB format).
 */
export function extractBasePrices(priceList: Record<string, any> | null): Record<VehicleType, number> {
  if (!priceList) {
    return { private: 180, motorcycle: 100, heavy: 350, machinery: 500 }
  }
  return {
    private: priceList.base_price_private ?? 180,
    motorcycle: priceList.base_price_motorcycle ?? 100,
    heavy: priceList.base_price_heavy ?? 350,
    machinery: priceList.base_price_machinery ?? 500
  }
}
