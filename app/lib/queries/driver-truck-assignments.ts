import { supabase } from '../supabase'

/** Postgres unique_violation — benign here (row already exists as current). */
const UNIQUE_VIOLATION = '23505'

/**
 * Whether a driver currently has ANY active truck assignment (server-side check).
 * Use this instead of possibly-stale client state before seeding a permanent assignment.
 */
export async function driverHasCurrentAssignment(driverId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('driver_truck_assignments')
    .select('id')
    .eq('driver_id', driverId)
    .eq('is_current', true)
    .limit(1)

  if (error) {
    console.error('Error checking driver truck assignments:', error)
    throw error
  }
  return (data?.length ?? 0) > 0
}

/**
 * Sync current truck assignments for a driver (diff add/remove, leave unchanged).
 */
export async function syncDriverTruckAssignments(
  driverId: string,
  truckIds: string[]
): Promise<void> {
  const { data: current, error: fetchError } = await supabase
    .from('driver_truck_assignments')
    .select('truck_id')
    .eq('driver_id', driverId)
    .eq('is_current', true)

  if (fetchError) {
    console.error('Error fetching driver truck assignments:', fetchError)
    throw fetchError
  }

  const currentIds = new Set((current || []).map((r) => r.truck_id))
  const newIds = new Set(truckIds)
  const toRemove = [...currentIds].filter((id) => !newIds.has(id))
  const toAdd = [...newIds].filter((id) => !currentIds.has(id))
  const now = new Date().toISOString()

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('driver_truck_assignments')
      .update({ is_current: false, unassigned_at: now })
      .eq('driver_id', driverId)
      .eq('is_current', true)
      .in('truck_id', toRemove)

    if (error) {
      console.error('Error removing driver truck assignments:', error)
      throw error
    }
  }

  if (toAdd.length > 0) {
    const { error } = await supabase.from('driver_truck_assignments').insert(
      toAdd.map((truck_id) => ({
        driver_id: driverId,
        truck_id,
        is_current: true,
        assigned_at: now,
      }))
    )

    if (error) {
      console.error('Error adding driver truck assignments:', error)
      throw error
    }
  }
}

/**
 * Sync current driver assignments for a truck (diff add/remove, leave unchanged).
 */
export async function syncTruckDriverAssignments(
  truckId: string,
  driverIds: string[]
): Promise<void> {
  const { data: current, error: fetchError } = await supabase
    .from('driver_truck_assignments')
    .select('driver_id')
    .eq('truck_id', truckId)
    .eq('is_current', true)

  if (fetchError) {
    console.error('Error fetching truck driver assignments:', fetchError)
    throw fetchError
  }

  const currentIds = new Set((current || []).map((r) => r.driver_id))
  const newIds = new Set(driverIds)
  const toRemove = [...currentIds].filter((id) => !newIds.has(id))
  const toAdd = [...newIds].filter((id) => !currentIds.has(id))
  const now = new Date().toISOString()

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('driver_truck_assignments')
      .update({ is_current: false, unassigned_at: now })
      .eq('truck_id', truckId)
      .eq('is_current', true)
      .in('driver_id', toRemove)

    if (error) {
      console.error('Error removing truck driver assignments:', error)
      throw error
    }
  }

  if (toAdd.length > 0) {
    const { error } = await supabase.from('driver_truck_assignments').insert(
      toAdd.map((driver_id) => ({
        driver_id,
        truck_id: truckId,
        is_current: true,
        assigned_at: now,
      }))
    )

    if (error) {
      console.error('Error adding truck driver assignments:', error)
      throw error
    }
  }
}

export async function insertDriverTruckAssignments(
  driverId: string,
  truckIds: string[]
): Promise<void> {
  if (truckIds.length === 0) return
  const now = new Date().toISOString()
  // Insert per-row so a benign duplicate (unique_violation from the partial index
  // driver_truck_assignments_current_uniq) is skipped without aborting the batch.
  for (const truck_id of truckIds) {
    const { error } = await supabase.from('driver_truck_assignments').insert({
      driver_id: driverId,
      truck_id,
      is_current: true,
      assigned_at: now,
    })
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        console.warn(
          '[driver-truck] current assignment already exists, skipping insert',
          { driverId, truck_id }
        )
        continue
      }
      console.error('Error inserting driver truck assignments:', error)
      throw error
    }
  }
}

export async function insertTruckDriverAssignments(
  truckId: string,
  driverIds: string[]
): Promise<void> {
  if (driverIds.length === 0) return
  const now = new Date().toISOString()
  for (const driver_id of driverIds) {
    const { error } = await supabase.from('driver_truck_assignments').insert({
      driver_id,
      truck_id: truckId,
      is_current: true,
      assigned_at: now,
    })
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        console.warn(
          '[driver-truck] current assignment already exists, skipping insert',
          { driver_id, truckId }
        )
        continue
      }
      console.error('Error inserting truck driver assignments:', error)
      throw error
    }
  }
}
