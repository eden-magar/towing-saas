-- Machinery (צמ"ה) weight fields — tons, separate from total_weight (kg).
-- APPLY MANUALLY in the Supabase SQL editor (this repo's migrations are not auto-applied).
-- After running, execute: NOTIFY pgrst, 'reload schema';

ALTER TABLE tow_vehicles ADD COLUMN IF NOT EXISTS self_weight_ton numeric;
ALTER TABLE tow_vehicles ADD COLUMN IF NOT EXISTS total_weight_ton numeric;
ALTER TABLE tow_vehicles ADD COLUMN IF NOT EXISTS machinery_type text;
