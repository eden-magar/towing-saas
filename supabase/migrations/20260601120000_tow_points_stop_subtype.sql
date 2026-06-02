-- Nullable stop subtype for waypoint (stop) points on regular tows.
-- Enforced in app code: 'key' | 'customer' | 'general'
ALTER TABLE tow_points
  ADD COLUMN IF NOT EXISTS stop_subtype text;

COMMENT ON COLUMN tow_points.stop_subtype IS 'Subtype for point_type=stop: key, customer, or general';
