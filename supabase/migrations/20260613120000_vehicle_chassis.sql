-- Chassis / VIN (מספר שלדה) on tow vehicles and MoT vehicles cache.
-- APPLY MANUALLY in the Supabase SQL editor (this repo's migrations are not auto-applied).
-- After running, execute: NOTIFY pgrst, 'reload schema';

ALTER TABLE tow_vehicles ADD COLUMN IF NOT EXISTS chassis text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS chassis text;
