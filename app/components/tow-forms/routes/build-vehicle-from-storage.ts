import type { StoredVehicleWithCustomer } from '../../../lib/queries/storage'
import { storedVehicleToCondition } from '../../../lib/utils/storage-vehicle'
import type { VehicleOnTruck } from './VehicleCard'

/** Build a route-point VehicleOnTruck from a stored_vehicles row (append or in-place replace). */
export function buildVehicleOnTruckFromStorage(
  storedVehicle: StoredVehicleWithCustomer,
  existingId?: string
): VehicleOnTruck {
  const { isFaulty, defects } = storedVehicleToCondition(storedVehicle)
  return {
    id: existingId ?? `vehicle_${Date.now()}`,
    plateNumber: storedVehicle.plate_number,
    isWorking: !isFaulty,
    defects: isFaulty ? defects : [],
    vehicleCode: storedVehicle.vehicle_code || '',
    isLoading: false,
    isFound: true,
    vehicleNotFound: false,
    fromStorage: true,
    storedVehicleId: storedVehicle.id,
    vehicleData: storedVehicle.vehicle_data || undefined,
  }
}
