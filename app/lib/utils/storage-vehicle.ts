import type { StoredVehicle } from '../queries/storage'

export type StoredVehicleConditionFields = {
  isFaulty: boolean
  defects: string[]
}

export type StoredVehicleHydrationSlot =
  | 'single'
  | 'exchange-working'
  | 'exchange-defective'

export type StoredPlateResolveResult =
  | { status: 'not-in-storage' }
  | { status: 'blocked'; message: string }
  | { status: 'hydrated' }

export const STORAGE_TAKE_OUT_CONFIRM_MESSAGE =
  'הרכב נמצא באחסנה — להוציא מהאחסנה?'

export const STORAGE_OTHER_CUSTOMER_MESSAGE =
  'הרכב שייך ללקוח אחר ונמצא באחסנה'

export const STORAGE_TAKE_OUT_CANCELLED_MESSAGE =
  'הרכב נמצא באחסנה — לא ניתן להמשיך ללא הוצאה מהאחסנה'

/** Map stored_vehicles row → form defect/condition fields (pure, no side effects). */
export function storedVehicleToCondition(
  stored: Pick<StoredVehicle, 'vehicle_condition' | 'defects'>
): StoredVehicleConditionFields {
  return {
    isFaulty: stored.vehicle_condition === 'faulty',
    defects: stored.defects ?? [],
  }
}
