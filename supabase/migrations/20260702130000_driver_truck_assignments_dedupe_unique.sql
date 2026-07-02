-- Fix duplicate current driver-truck assignments, then enforce uniqueness.
-- Root cause: check-then-insert races across tow flows created multiple rows
-- with the same (driver_id, truck_id) and is_current = true, with no constraint
-- to prevent it. This retires duplicates (audit-preserving) and adds a partial
-- unique index so only one current assignment can exist per (driver_id, truck_id).

-- 1) Dedupe existing data: for each (driver_id, truck_id) group that currently
--    has more than one is_current row, keep only the EARLIEST row (by assigned_at,
--    id as deterministic tiebreaker) and retire the rest by flipping is_current
--    to false + stamping unassigned_at. History rows are preserved (no hard delete).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY driver_id, truck_id
      ORDER BY assigned_at ASC, id ASC
    ) AS rn
  FROM public.driver_truck_assignments
  WHERE is_current = true
)
UPDATE public.driver_truck_assignments AS dta
SET
  is_current = false,
  unassigned_at = now()
FROM ranked
WHERE dta.id = ranked.id
  AND ranked.rn > 1;

-- 2) Enforce uniqueness going forward: at most one current row per
--    (driver_id, truck_id). Partial index so retired/historical rows are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS driver_truck_assignments_current_uniq
  ON public.driver_truck_assignments (driver_id, truck_id)
  WHERE is_current = true;
