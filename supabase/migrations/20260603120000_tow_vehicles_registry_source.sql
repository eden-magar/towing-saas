-- MoT registry bucket for calendar "מאגר מידע" (private / motorcycle / heavy / machinery)
ALTER TABLE tow_vehicles ADD COLUMN IF NOT EXISTS registry_source text;
