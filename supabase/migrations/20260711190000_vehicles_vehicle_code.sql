-- Company-internal vehicle code (קוד רכב) on the Mot lookup cache.
-- Constant per plate; filled when a tow/storage save includes a non-empty code.
-- APPLY MANUALLY in the Supabase SQL editor (this repo's migrations are not auto-applied).
-- After running, execute: NOTIFY pgrst, 'reload schema';

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_code text;

COMMENT ON COLUMN public.vehicles.vehicle_code IS
  'Company-internal vehicle code (קוד רכב). Distinct from MoT degem_cd.';
