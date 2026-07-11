-- Repo record of schema already applied manually in Supabase.
-- Column: nullable entering customer_order_number when a vehicle enters
-- storage via a tow (dropoff is_storage completion). No backfill.
--
-- The add_vehicle_to_storage RPC was also updated manually in Supabase to
-- accept optional p_entry_customer_order_number text DEFAULT NULL and write
-- it on INSERT/UPDATE (COALESCE so null never clears an existing value).
-- That RPC body is not managed in this migrations folder.

ALTER TABLE public.stored_vehicles
  ADD COLUMN IF NOT EXISTS entry_customer_order_number text NULL;

COMMENT ON COLUMN public.stored_vehicles.entry_customer_order_number IS
  'Dispatcher customer_order_number from the tow that put this vehicle into storage; null for manual adds and legacy rows.';
