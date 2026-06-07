import { normalizePlate } from './plate-number'

function normalizedNonEmpty(plate: string | null | undefined): string | null {
  const normalized = normalizePlate(plate ?? '')
  return normalized.length > 0 ? normalized : null
}

export interface ReconcileVehicleInput {
  id?: string
  plateNumber: string
}

export interface ReconcileVehicleExisting {
  id: string
  plateNumber?: string | null
  orderIndex?: number | null
}

/**
 * Match incoming vehicles to existing DB rows without reusing the same row twice.
 * Fallback order: explicit id → non-empty plate → order_index → positional index (same count).
 */
export function assignExistingVehicleIds<T extends ReconcileVehicleInput>(
  incoming: T[],
  existing?: ReconcileVehicleExisting[]
): T[] {
  if (!existing?.length) return incoming

  const used = new Set<string>()
  const existingIds = new Set(existing.map((row) => row.id))
  const sorted = [...existing].sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
  )

  return incoming.map((vehicle, index) => {
    if (vehicle.id && existingIds.has(vehicle.id) && !used.has(vehicle.id)) {
      used.add(vehicle.id)
      return vehicle
    }

    const plate = normalizedNonEmpty(vehicle.plateNumber)
    if (plate) {
      const plateMatch = existing.find(
        (row) =>
          !used.has(row.id) &&
          normalizedNonEmpty(row.plateNumber) === plate
      )
      if (plateMatch) {
        used.add(plateMatch.id)
        return { ...vehicle, id: plateMatch.id }
      }
    }

    if (incoming.length === existing.length) {
      const orderMatch = existing.find(
        (row) => !used.has(row.id) && row.orderIndex === index
      )
      if (orderMatch) {
        used.add(orderMatch.id)
        return { ...vehicle, id: orderMatch.id }
      }

      const unusedSorted = sorted.filter((row) => !used.has(row.id))
      if (unusedSorted[index]) {
        used.add(unusedSorted[index].id)
        return { ...vehicle, id: unusedSorted[index].id }
      }
    }

    return vehicle
  })
}

export interface ReconcilePointInput {
  id?: string
  point_order: number
  point_type: string
}

export interface ReconcilePointExisting {
  id: string
  point_order: number
  point_type: string
}

/**
 * Match incoming points to existing DB rows without reusing the same row twice.
 * Fallback order: explicit id → (order + type) → unique order → positional index (same count).
 */
export function assignExistingPointIds<T extends ReconcilePointInput>(
  incoming: T[],
  existing?: ReconcilePointExisting[]
): T[] {
  if (!existing?.length) return incoming

  const used = new Set<string>()
  const existingIds = new Set(existing.map((row) => row.id))
  const sorted = [...existing].sort((a, b) => a.point_order - b.point_order)

  return incoming.map((point, index) => {
    if (point.id && existingIds.has(point.id) && !used.has(point.id)) {
      used.add(point.id)
      return point
    }

    const orderTypeMatch = existing.find(
      (row) =>
        !used.has(row.id) &&
        row.point_order === point.point_order &&
        row.point_type === point.point_type
    )
    if (orderTypeMatch) {
      used.add(orderTypeMatch.id)
      return { ...point, id: orderTypeMatch.id }
    }

    const orderCandidates = existing.filter(
      (row) => !used.has(row.id) && row.point_order === point.point_order
    )
    if (orderCandidates.length === 1) {
      used.add(orderCandidates[0].id)
      return { ...point, id: orderCandidates[0].id }
    }

    if (incoming.length === existing.length) {
      const unusedSorted = sorted.filter((row) => !used.has(row.id))
      if (unusedSorted[index]) {
        used.add(unusedSorted[index].id)
        return { ...point, id: unusedSorted[index].id }
      }
    }

    return point
  })
}
