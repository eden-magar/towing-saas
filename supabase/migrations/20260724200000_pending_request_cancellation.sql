-- Path B revival: request-linked customer cancellation, XOR with Path A (tow).
--
-- Decision change: withdrawing an untouched portal order (status pending, no
-- tow yet) must ALSO go through staff approval instead of the customer flipping
-- customer_tow_requests.status straight to `dismissed`. A rep who already saw
-- the order in "בקשות נכנסות" has to learn it was withdrawn — approval is how.
--
-- This SUPERSEDES the slim version of this migration, which added a portal
-- UPDATE policy letting the customer dismiss unilaterally. That policy is
-- dropped below; the customer now only ever INSERTs a cancellation request.
--
-- customer_tow_cancellation_requests gains customer_tow_request_id and makes
-- tow_id nullable, with a CHECK that exactly one target is set:
--   * tow_id                  → Path A: a converted, unassigned portal tow
--   * customer_tow_request_id → Path B: a pending portal order (no tow yet)
--
-- APPLY by hand. Do not auto-apply.

-- =============================================================================
-- 0. Drop the now-obsolete unilateral dismiss policy
-- =============================================================================
-- The customer must not be able to set customer_tow_requests.status = dismissed
-- on their own any more. IF EXISTS: safe whether or not the slim version ran.

DROP POLICY IF EXISTS customer_tow_requests_update_customer_portal_dismiss
  ON public.customer_tow_requests;

-- =============================================================================
-- 1. XOR shape on customer_tow_cancellation_requests
-- =============================================================================

ALTER TABLE public.customer_tow_cancellation_requests
  ALTER COLUMN tow_id DROP NOT NULL;

ALTER TABLE public.customer_tow_cancellation_requests
  ADD COLUMN IF NOT EXISTS customer_tow_request_id UUID
    REFERENCES public.customer_tow_requests (id) ON DELETE CASCADE;

COMMENT ON COLUMN public.customer_tow_cancellation_requests.customer_tow_request_id IS
  'Path B: pending portal order being withdrawn (no tow yet). XOR with tow_id.';

COMMENT ON COLUMN public.customer_tow_cancellation_requests.tow_id IS
  'Path A: converted, unassigned portal tow being cancelled. XOR with customer_tow_request_id.';

-- Exactly one target set (idempotent re-add)
ALTER TABLE public.customer_tow_cancellation_requests
  DROP CONSTRAINT IF EXISTS customer_tow_cancellation_requests_target_xor_check;

ALTER TABLE public.customer_tow_cancellation_requests
  ADD CONSTRAINT customer_tow_cancellation_requests_target_xor_check CHECK (
    (tow_id IS NOT NULL) <> (customer_tow_request_id IS NOT NULL)
  );

-- Path A per-tow uniqueness: constrain to tow-linked rows only now that tow_id
-- is nullable (recreate to add the explicit NOT NULL guard).
DROP INDEX IF EXISTS public.customer_tow_cancellation_requests_one_pending_uidx;

CREATE UNIQUE INDEX customer_tow_cancellation_requests_one_pending_uidx
  ON public.customer_tow_cancellation_requests (tow_id)
  WHERE status = 'pending' AND tow_id IS NOT NULL;

-- Path B per-request uniqueness: one pending withdrawal per pending order.
CREATE UNIQUE INDEX IF NOT EXISTS customer_tow_cancellation_requests_one_pending_request_uidx
  ON public.customer_tow_cancellation_requests (customer_tow_request_id)
  WHERE status = 'pending' AND customer_tow_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customer_tow_cancellation_requests_request_id_idx
  ON public.customer_tow_cancellation_requests (customer_tow_request_id);

-- =============================================================================
-- 2. Portal INSERT RLS — add Path B, keep every Path A guard
-- =============================================================================
-- Base guards apply to both paths; the target-specific EXISTS lives in the
-- (Path A OR Path B) block, gated by the XOR so only one branch is relevant.

-- PERMISSIVE OR trap: INSERT policies OR together, so a leftover policy would
-- silently permit what this rewrite blocks. Assert there is exactly ONE INSERT
-- policy on the table (the Phase-1 portal policy we are about to replace) and
-- abort otherwise — inspect by hand before APPLY.
DO $$
DECLARE
  insert_policy_count integer;
BEGIN
  SELECT count(*)::integer INTO insert_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'customer_tow_cancellation_requests'
    AND cmd = 'INSERT';

  IF insert_policy_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 INSERT policy on customer_tow_cancellation_requests before rewrite, found %. Inspect for a leftover PERMISSIVE policy before APPLY.',
      insert_policy_count;
  END IF;
END $$;

DROP POLICY IF EXISTS customer_tow_cancellation_requests_insert_customer_portal
  ON public.customer_tow_cancellation_requests;

CREATE POLICY customer_tow_cancellation_requests_insert_customer_portal
  ON public.customer_tow_cancellation_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_tow_cancellation_requests.requested_by_user_id = auth.uid()
    AND customer_tow_cancellation_requests.status = 'pending'
    AND customer_tow_cancellation_requests.reviewed_by IS NULL
    AND customer_tow_cancellation_requests.reviewed_at IS NULL
    AND customer_tow_cancellation_requests.staff_note IS NULL
    AND public.assert_customer_in_company(
      customer_tow_cancellation_requests.company_id,
      customer_tow_cancellation_requests.customer_id
    )
    AND public.portal_user_may_edit_customer(
      customer_tow_cancellation_requests.customer_id
    )
    AND (
      -- Path A: converted, unassigned portal-origin tow
      (
        customer_tow_cancellation_requests.tow_id IS NOT NULL
        AND customer_tow_cancellation_requests.customer_tow_request_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.tows t
          WHERE t.id = customer_tow_cancellation_requests.tow_id
            AND t.company_id = customer_tow_cancellation_requests.company_id
            AND t.customer_id = customer_tow_cancellation_requests.customer_id
            AND t.driver_id IS NULL
            AND t.status NOT IN (
              'cancelled',
              'cancelled_charged',
              'completed'
            )
        )
        AND EXISTS (
          SELECT 1
          FROM public.customer_tow_requests r
          WHERE r.converted_tow_id = customer_tow_cancellation_requests.tow_id
            AND r.company_id = customer_tow_cancellation_requests.company_id
            AND r.customer_id = customer_tow_cancellation_requests.customer_id
            AND r.status = 'converted'
        )
      )
      OR
      -- Path B: pending portal order, not yet converted
      (
        customer_tow_cancellation_requests.customer_tow_request_id IS NOT NULL
        AND customer_tow_cancellation_requests.tow_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.customer_tow_requests r
          WHERE r.id = customer_tow_cancellation_requests.customer_tow_request_id
            AND r.company_id = customer_tow_cancellation_requests.company_id
            AND r.customer_id = customer_tow_cancellation_requests.customer_id
            AND r.status = 'pending'
            AND r.converted_tow_id IS NULL
        )
      )
    )
  );

COMMENT ON POLICY customer_tow_cancellation_requests_insert_customer_portal
  ON public.customer_tow_cancellation_requests IS
  'Portal admin|manager: insert pending cancel for an unassigned portal-origin tow '
  '(Path A) OR a pending, not-yet-converted portal order (Path B). Exactly one target.';

-- =============================================================================
-- 3. Block converting an order while a cancel request is pending
-- =============================================================================
-- Same reasoning as the driver-assignment block on Path A: a rep must not be
-- able to convert something the customer is trying to withdraw. Enforced in the
-- database so the stale converted+pending state is impossible, not just guarded
-- in the UI.

CREATE OR REPLACE FUNCTION public.prevent_convert_while_cancel_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'converted'
     AND OLD.status IS DISTINCT FROM 'converted'
  THEN
    IF EXISTS (
      SELECT 1
      FROM public.customer_tow_cancellation_requests c
      WHERE c.customer_tow_request_id = NEW.id
        AND c.status = 'pending'
    ) THEN
      RAISE EXCEPTION
        'לא ניתן להמיר לגרירה — יש בקשת ביטול ממתינה מהלקוח (request_id=%)',
        NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_convert_while_cancel_pending() IS
  'BEFORE UPDATE on customer_tow_requests: reject status -> converted while a '
  'customer cancellation request (Path B) for this order is pending';

DROP TRIGGER IF EXISTS customer_tow_requests_prevent_convert_while_cancel_pending
  ON public.customer_tow_requests;

CREATE TRIGGER customer_tow_requests_prevent_convert_while_cancel_pending
  BEFORE UPDATE OF status ON public.customer_tow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_convert_while_cancel_pending();
