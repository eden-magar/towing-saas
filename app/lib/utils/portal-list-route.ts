/**
 * Shared portal list helpers for deriving route endpoints and plates
 * from either tows or customer_tow_request child rows.
 */

export function getFirstPickupLastDropoffAddress(
  points: { point_type: string; address?: string | null }[]
): { from: string | null; to: string | null } {
  const pickup = points.find((p) => p.point_type === 'pickup')
  const dropoff = [...points].reverse().find((p) => p.point_type === 'dropoff')
  return {
    from: pickup?.address?.trim() || null,
    to: dropoff?.address?.trim() || null,
  }
}

type PlateVehicle = {
  plate_number: string
  is_working?: boolean | null
  order_index?: number | null
}

/** Prefer faulty then working on exchange; otherwise first by order_index. */
export function getPortalListPlates(
  towType: string | null | undefined,
  vehicles: PlateVehicle[]
): string[] {
  if (!vehicles.length) return []

  const sorted = [...vehicles].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  )

  const plateOf = (v: PlateVehicle | undefined) => v?.plate_number?.trim() || null

  if (towType === 'exchange') {
    const faulty = sorted.find((v) => v.is_working === false)
    const working = sorted.find((v) => v.is_working === true)
    const plates: string[] = []
    const faultyPlate = plateOf(faulty)
    const workingPlate = plateOf(working)
    if (faultyPlate) plates.push(faultyPlate)
    if (workingPlate && workingPlate !== faultyPlate) plates.push(workingPlate)
    for (const v of sorted) {
      const p = plateOf(v)
      if (p && !plates.includes(p)) plates.push(p)
    }
    return plates
  }

  const first = plateOf(sorted[0])
  return first ? [first] : []
}
