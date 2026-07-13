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

/**
 * Fold legacy exchange vehicle-role catalog lines into tow-level selections for the unified
 * footer "תוספות" UI. Preserves every line (including the same catalog id twice — e.g. once on
 * working and once on defective) so the charged total stays identical. Does not mutate DB;
 * callers also clear working/defective selection state after hydrate.
 */
export function mergeExchangeVehicleServicesIntoTowLevel(
  serviceSurcharges:
    | {
        id: string
        price: number
        units?: number
        amount: number
        vehicle_role?: string
        is_tow_level?: boolean
        is_ad_hoc?: boolean
      }[]
    | undefined,
): SelectedService[] {
  const lines = (serviceSurcharges ?? []).filter((s) => s.is_ad_hoc !== true)
  const mapLine = (s: {
    id: string
    price: number
    units?: number
    amount: number
  }): SelectedService => ({
    id: s.id,
    quantity: s.units,
    manualPrice: s.units === undefined && s.amount !== s.price ? s.amount : undefined,
  })
  const towLevel = lines.filter((s) => s.is_tow_level === true).map(mapLine)
  const vehicleLevel = lines
    .filter((s) => s.vehicle_role === 'working' || s.vehicle_role === 'defective')
    .map(mapLine)
  return [...towLevel, ...vehicleLevel]
}
