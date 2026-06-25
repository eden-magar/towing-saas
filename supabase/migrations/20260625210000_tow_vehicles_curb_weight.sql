-- משקל עצמי (curb / unladen weight) for HEAVY vehicles — kg, from the gov registry field mishkal_azmi.
-- Separate from self_weight_ton (machinery, tons) and total_weight (kg, gross). A value of 0 means
-- "not available" and is stored as NULL by the app layer.
-- APPLY MANUALLY in the Supabase SQL editor (this repo's migrations are not auto-applied).
-- After running, execute: NOTIFY pgrst, 'reload schema';

ALTER TABLE tow_vehicles ADD COLUMN IF NOT EXISTS curb_weight_kg numeric;
