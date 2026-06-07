-- Add commercial (manual-weight) vehicle category to tow_vehicles.vehicle_type enum.
-- App code sends 'van' for רכב מסחרי; without this value inserts fail with 22P02.
--
-- APPLY MANUALLY in the Supabase SQL editor (this repo's migrations are not auto-applied).
-- Do NOT wrap in BEGIN/COMMIT — ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- block on some Postgres versions.
--
-- Verify enum name + current values before/after (optional):
--   SELECT e.enumlabel
--   FROM pg_type t
--   JOIN pg_enum e ON e.enumtypid = t.oid
--   WHERE t.typname = 'vehicle_type'
--   ORDER BY e.enumsortorder;

ALTER TYPE public.vehicle_type ADD VALUE IF NOT EXISTS 'van';
