/**
 * Tow-level predefined service-surcharge lines.
 *
 * These are catalog (service_surcharges table) selections chosen for the whole tow — parallel to
 * the per-leg (exchange working/defective) and per-point (custom) selections, and a sibling of the
 * order-only manual lines handled in `manual-surcharge.ts`.
 *
 * They live inside `tows.price_breakdown.service_surcharges[]` flagged with `is_tow_level: true`
 * so totals/display treat them like any other service surcharge, while edit hydration can read them
 * back out separately (per-point/working/defective lines must NOT be mistaken for tow-level ones).
 */

import type { SelectedService } from '../../components/tow-forms/shared'

/** A stored service-surcharge line, narrowed to the fields needed to detect tow-level lines. */
type StoredServiceLine = {
  id: string
  price: number
  units?: number
  amount: number
  is_tow_level?: boolean
}

/** Read tow-level catalog lines back out of a stored breakdown (for edit hydration). */
export function extractTowLevelServices(
  serviceSurcharges: StoredServiceLine[] | undefined,
): SelectedService[] {
  return (serviceSurcharges ?? [])
    .filter((s) => s.is_tow_level === true)
    .map((s) => ({
      id: s.id,
      quantity: s.units,
      manualPrice: s.units === undefined && s.amount !== s.price ? s.amount : undefined,
    }))
}

/** Catalog lines that are NOT tow-level (per-point/working/defective/ad-hoc are kept). */
export function excludeTowLevelServices<T extends { is_tow_level?: boolean }>(
  serviceSurcharges: T[] | undefined,
): T[] {
  return (serviceSurcharges ?? []).filter((s) => s.is_tow_level !== true)
}
