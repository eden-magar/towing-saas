-- Import subtype (sug_yevu) for personal-import vehicles.
-- APPLY MANUALLY in the Supabase SQL editor (this repo's migrations are not auto-applied).
-- After running, execute: NOTIFY pgrst, 'reload schema';

ALTER TABLE tow_vehicles ADD COLUMN IF NOT EXISTS import_type text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS import_type text;
