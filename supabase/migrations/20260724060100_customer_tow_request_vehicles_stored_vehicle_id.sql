ALTER TABLE public.customer_tow_request_vehicles
  ADD COLUMN IF NOT EXISTS stored_vehicle_id uuid NULL
    REFERENCES public.stored_vehicles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.customer_tow_request_vehicles.stored_vehicle_id IS
  'When set, the portal customer picked this yard vehicle; convert must set selectedStoredVehicleId / selectedWorkingVehicleId and run reserveVehicleForTow. NULL when only a storage address was entered with no pick.';

CREATE INDEX IF NOT EXISTS customer_tow_request_vehicles_stored_vehicle_id_idx
  ON public.customer_tow_request_vehicles (stored_vehicle_id)
  WHERE stored_vehicle_id IS NOT NULL;
