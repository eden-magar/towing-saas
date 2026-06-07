-- Extend public.vehicle_type enum with all categories the tow form UI can select manually.
-- Registry lookup types (private, motorcycle, heavy, machinery) are assumed already present.
-- 'van' may already exist from 20260607180000_add_van_to_vehicle_type_enum.sql — IF NOT EXISTS is safe.
--
-- APPLY MANUALLY in the Supabase SQL editor. Do NOT wrap in BEGIN/COMMIT.

-- Optional: list current values before/after
-- SELECT e.enumlabel FROM pg_type t
-- JOIN pg_enum e ON e.enumtypid = t.oid
-- WHERE t.typname = 'vehicle_type' ORDER BY e.enumsortorder;

ALTER TYPE public.vehicle_type ADD VALUE IF NOT EXISTS 'van';
ALTER TYPE public.vehicle_type ADD VALUE IF NOT EXISTS 'suv';
ALTER TYPE public.vehicle_type ADD VALUE IF NOT EXISTS 'truck';
ALTER TYPE public.vehicle_type ADD VALUE IF NOT EXISTS 'bus';
ALTER TYPE public.vehicle_type ADD VALUE IF NOT EXISTS 'other';
