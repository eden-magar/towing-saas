-- Optional admin-entered planned end time for calendar block duration
ALTER TABLE tows ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz NULL;

COMMENT ON COLUMN tows.scheduled_end_at IS 'Optional admin-entered planned end time; used for calendar block duration when set.';
