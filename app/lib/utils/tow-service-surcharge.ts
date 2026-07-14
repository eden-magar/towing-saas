/**
 * Tow-level predefined service-surcharge lines.
 *
 * These are catalog (service_surcharges table) selections chosen for the whole tow — parallel to
 * the per-leg (exchange working/defective) and per-point (custom) selections, and a sibling of the
 * order-only manual lines handled in `manual-surcharge.ts`.
 *
 * They live inside `tows.price_breakdown.service_surcharges[]` flagged with `is_tow_level: true`
 * (taxable) or `price_breakdown.vat_exempt_surcharges[]` (VAT-exempt catalog), so totals/display
 * treat them like any other service surcharge, while edit hydration can read them back out
 * separately (per-point/working/defective lines must NOT be mistaken for tow-level ones).
 */

import type { SelectedService } from '../../components/tow-forms/shared'

/** A stored service-surcharge line, narrowed to the fields needed to detect tow-level lines. */
type StoredServiceLine = {
  id: string
  price: number
  units?: number
  amount: number
  is_tow_level?: boolean
  is_ad_hoc?: boolean
  vehicle_role?: string
}

function mapCatalogLineToSelected(s: {
  id: string
  price: number
  units?: number
  amount: number
}): SelectedService {
  return {
    id: s.id,
    quantity: s.units,
    manualPrice: s.units === undefined && s.amount !== s.price ? s.amount : undefined,
  }
}

/** Read tow-level catalog lines back out of a stored breakdown (for edit hydration). */
export function extractTowLevelServices(
  serviceSurcharges: StoredServiceLine[] | undefined,
): SelectedService[] {
  return (serviceSurcharges ?? [])
    .filter((s) => s.is_tow_level === true && s.is_ad_hoc !== true)
    .map(mapCatalogLineToSelected)
}

/** Tow-level catalog from taxable + VAT-exempt stored arrays. */
export function extractTowLevelServicesFromBreakdown(
  serviceSurcharges: StoredServiceLine[] | undefined,
  vatExemptSurcharges?: StoredServiceLine[] | undefined,
): SelectedService[] {
  return [
    ...extractTowLevelServices(serviceSurcharges),
    ...extractTowLevelServices(vatExemptSurcharges),
  ]
}

/** Catalog lines that are NOT tow-level (per-point/working/defective/ad-hoc are kept). */
export function excludeTowLevelServices<T extends { is_tow_level?: boolean }>(
  serviceSurcharges: T[] | undefined,
): T[] {
  return (serviceSurcharges ?? []).filter((s) => s.is_tow_level !== true)
}

/**
 * Single-form catalog selections (non-tow-level, non-ad-hoc) from taxable + VAT-exempt arrays.
 * VAT-exempt catalog lines live only in `vat_exempt_surcharges` after save — without this they
 * vanish on edit hydrate and get blanked on re-save.
 */
export function hydrateSelectedServicesFromBreakdown(
  serviceSurcharges: StoredServiceLine[] | undefined,
  vatExemptSurcharges?: StoredServiceLine[] | undefined,
): SelectedService[] {
  const fromArray = (lines: StoredServiceLine[] | undefined) =>
    excludeTowLevelServices(
      (lines ?? []).filter((s) => s.is_ad_hoc !== true),
    ).map(mapCatalogLineToSelected)

  return [...fromArray(serviceSurcharges), ...fromArray(vatExemptSurcharges)]
}

/**
 * Fold legacy exchange vehicle-role catalog lines into tow-level selections for the unified
 * footer "תוספות" UI. Preserves every line (including the same catalog id twice — e.g. once on
 * working and once on defective) so the charged total stays identical. Does not mutate DB;
 * callers also clear working/defective selection state after hydrate.
 *
 * Also folds VAT-exempt catalog lines from `vat_exempt_surcharges`.
 */
export function mergeExchangeVehicleServicesIntoTowLevel(
  serviceSurcharges:
    | StoredServiceLine[]
    | undefined,
  vatExemptSurcharges?: StoredServiceLine[] | undefined,
): SelectedService[] {
  const mergeOne = (lines: StoredServiceLine[] | undefined): SelectedService[] => {
    const catalog = (lines ?? []).filter((s) => s.is_ad_hoc !== true)
    const towLevel = catalog.filter((s) => s.is_tow_level === true).map(mapCatalogLineToSelected)
    const vehicleLevel = catalog
      .filter((s) => s.vehicle_role === 'working' || s.vehicle_role === 'defective')
      .map(mapCatalogLineToSelected)
    // Footer-era tows store unified selections as is_tow_level; plain catalog rows (no role /
    // tow flag) still belong in the footer so they round-trip on edit.
    const plainCatalog = catalog
      .filter(
        (s) =>
          s.is_tow_level !== true &&
          s.vehicle_role !== 'working' &&
          s.vehicle_role !== 'defective',
      )
      .map(mapCatalogLineToSelected)
    return [...towLevel, ...vehicleLevel, ...plainCatalog]
  }

  return [...mergeOne(serviceSurcharges), ...mergeOne(vatExemptSurcharges)]
}
