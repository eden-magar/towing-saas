-- Customer-facing cancellation free-text (separate from staff-only cancellation_details).
-- Historical rows stay NULL — no backfill.

ALTER TABLE public.tows
  ADD COLUMN IF NOT EXISTS cancellation_customer_note TEXT NULL;

COMMENT ON COLUMN public.tows.cancellation_customer_note IS
  'Optional note shown to the customer portal on cancelled tows; never copy from cancellation_details';
