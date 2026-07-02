-- Negative cache for vehicle registry lookups (plates confirmed not in MoT registries).
-- TTL is enforced in application logic via expires_at; stale rows may be overwritten on re-check.

CREATE TABLE IF NOT EXISTS vehicle_lookup_misses (
  license_number text PRIMARY KEY,
  checked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS vehicle_lookup_misses_expires_at_idx
  ON vehicle_lookup_misses (expires_at);

ALTER TABLE vehicle_lookup_misses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_lookup_misses_select_authenticated ON vehicle_lookup_misses;
CREATE POLICY vehicle_lookup_misses_select_authenticated
  ON vehicle_lookup_misses
  FOR SELECT
  TO authenticated
  USING (true);
