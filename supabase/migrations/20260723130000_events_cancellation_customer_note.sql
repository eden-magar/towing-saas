-- Customer-facing cancellation free-text (separate from staff-only cancellation_details).
-- Historical rows stay NULL — no backfill.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cancellation_customer_note TEXT NULL;

COMMENT ON COLUMN public.events.cancellation_customer_note IS
  'Optional note shown to the customer portal on cancelled events; never copy from cancellation_details';
