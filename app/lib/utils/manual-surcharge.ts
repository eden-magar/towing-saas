/**
 * Manual (ad-hoc) add-on lines on a single order.
 *
 * These are NOT catalog items (service_surcharges table). They live only on the order they were
 * created on, stored inside `tows.price_breakdown.service_surcharges[]` with `is_ad_hoc: true` so
 * that totals and display treat them identically to predefined service surcharges.
 *
 * This module is the single source of truth for converting manual lines into:
 *   - price-calculator input  (manualSurchargesToCalcInput)
 *   - stored breakdown lines  (manualSurchargesToBreakdown)
 * and for reading them back from a stored breakdown (extractManualSurcharges).
 */

export interface ManualSurcharge {
  id: string
  label: string
  amount: number
  /** When true, added after VAT; not taxed or customer-discounted. */
  isVatExempt?: boolean
}

/** A stored service-surcharge line, narrowed to the fields we need to detect ad-hoc lines. */
type StoredServiceLine = {
  id: string
  label: string
  amount: number
  is_ad_hoc?: boolean
  is_vat_exempt?: boolean
}

/** Trim labels, coerce amounts, and drop incomplete lines (empty name or amount <= 0). */
export function sanitizeManualSurcharges(list: ManualSurcharge[] | undefined): ManualSurcharge[] {
  return (list ?? [])
    .map((m) => ({
      id: m.id,
      label: (m.label ?? '').trim(),
      amount: Number(m.amount) || 0,
      isVatExempt: m.isVatExempt === true,
    }))
    .filter((m) => m.label.length > 0 && m.amount > 0)
}

/** Manual lines as flat ₪ inputs for calculateTowPrice (uniform with service surcharges). */
export function manualSurchargesToCalcInput(
  list: ManualSurcharge[] | undefined,
): { amount: number; label: string; vatExempt?: boolean }[] {
  return sanitizeManualSurcharges(list).map((m) => ({
    amount: m.amount,
    label: `${m.label} (שירות אחר)`,
    ...(m.isVatExempt ? { vatExempt: true as const } : {}),
  }))
}

/** Manual lines in the stored `price_breakdown.service_surcharges` / vat_exempt shape. */
export function manualSurchargesToBreakdown(list: ManualSurcharge[] | undefined): {
  id: string
  label: string
  price: number
  amount: number
  is_ad_hoc: true
  is_vat_exempt?: true
}[] {
  return sanitizeManualSurcharges(list).map((m) => ({
    id: m.id,
    label: m.label,
    price: m.amount,
    amount: m.amount,
    is_ad_hoc: true as const,
    ...(m.isVatExempt ? { is_vat_exempt: true as const } : {}),
  }))
}

/** Read ad-hoc lines back out of a stored breakdown (taxable + exempt arrays). */
export function extractManualSurcharges(
  serviceSurcharges: StoredServiceLine[] | undefined,
  vatExemptSurcharges?: StoredServiceLine[] | undefined,
): ManualSurcharge[] {
  const fromTaxable = (serviceSurcharges ?? [])
    .filter((s) => s.is_ad_hoc === true)
    .map((s) => ({
      id: s.id,
      label: s.label,
      amount: s.amount,
      isVatExempt: s.is_vat_exempt === true,
    }))
  const fromExempt = (vatExemptSurcharges ?? [])
    .filter((s) => s.is_ad_hoc === true)
    .map((s) => ({
      id: s.id,
      label: s.label,
      amount: s.amount,
      isVatExempt: true as const,
    }))
  return [...fromTaxable, ...fromExempt]
}

/** Catalog-backed lines only (everything that is NOT an ad-hoc manual line). */
export function excludeManualSurcharges<T extends StoredServiceLine>(
  serviceSurcharges: T[] | undefined,
): T[] {
  return (serviceSurcharges ?? []).filter((s) => s.is_ad_hoc !== true)
}

export function newManualSurchargeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `adhoc-${crypto.randomUUID()}`
  }
  return `adhoc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
