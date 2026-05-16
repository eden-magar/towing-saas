/**
 * Returns a Hebrew display label for a truck type code (`TruckType` / `required_truck_types`).
 *
 * Unknown non-empty values are returned unchanged so stored data is never dropped silently.
 */
export function getTruckTypeLabel(value: string | null | undefined): string {
  if (!value) return ''

  const labels: Record<string, string> = {
    carrier: 'מוביל',
    carrier_large: 'מוביל גדול',
    crane_tow: 'מנוף',
    dolly: 'דולי',
    flatbed: 'רמסע',
    heavy_equipment: 'ציוד כבד',
    heavy_rescue: 'חילוץ כבד',
    wheel_lift_cradle: 'משקפיים',
  }

  return labels[value] ?? value
}
