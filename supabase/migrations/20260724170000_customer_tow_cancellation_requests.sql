-- Customer-initiated cancellation requests for portal-origin tows that are not
-- yet assigned to a driver. Mirror tow_rejection_requests shape; approval
-- cancels the tow (app Phase 2) rather than unassigning a driver.
--
-- APPLY NOTE: the UNIQUE index on customer_tow_requests.converted_tow_id fails
-- if any duplicate non-null converted_tow_id values already exist — inspect and
-- dedupe before APPLY if needed.

-- =============================================================================
-- A. Index: reverse lookup portal-origin tows
-- =============================================================================

CREATE UNIQUE INDEX customer_tow_requests_converted_tow_id_uidx
  ON public.customer_tow_requests (converted_tow_id)
  WHERE converted_tow_id IS NOT NULL;

COMMENT ON INDEX public.customer_tow_requests_converted_tow_id_uidx IS
  'One converted request per tow; speeds portal-origin checks by converted_tow_id';

-- =============================================================================
-- B. Table
-- =============================================================================

CREATE TABLE public.customer_tow_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  tow_id UUID NOT NULL REFERENCES public.tows (id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  reason_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  staff_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_tow_cancellation_requests_status_check CHECK (
    status IN ('pending', 'approved', 'rejected', 'cancelled')
  ),
  CONSTRAINT customer_tow_cancellation_requests_reason_note_check CHECK (
    reason_note IS NULL OR char_length(trim(reason_note)) > 0
  ),
  CONSTRAINT customer_tow_cancellation_requests_staff_note_check CHECK (
    staff_note IS NULL OR char_length(trim(staff_note)) > 0
  )
);

COMMENT ON TABLE public.customer_tow_cancellation_requests IS
  'Portal cancel requests for unassigned portal-origin tows; staff approve → cancel tow '
  '(cancelled or cancelled_charged in app); customer may withdraw (status=cancelled)';

COMMENT ON COLUMN public.customer_tow_cancellation_requests.requested_by_user_id IS
  'Portal user who submitted the request; INSERT requires = auth.uid()';

COMMENT ON COLUMN public.customer_tow_cancellation_requests.reason_note IS
  'Optional customer free text; on approve, app copies into tows.cancellation_customer_note';

COMMENT ON COLUMN public.customer_tow_cancellation_requests.status IS
  'pending → approved|rejected (staff) or cancelled (customer withdraw)';

COMMENT ON COLUMN public.customer_tow_cancellation_requests.staff_note IS
  'Optional staff-only note; never shown in the portal';

-- At most one open request per tow
CREATE UNIQUE INDEX customer_tow_cancellation_requests_one_pending_uidx
  ON public.customer_tow_cancellation_requests (tow_id)
  WHERE status = 'pending';

CREATE INDEX customer_tow_cancellation_requests_company_pending_idx
  ON public.customer_tow_cancellation_requests (company_id, created_at)
  WHERE status = 'pending';

CREATE INDEX customer_tow_cancellation_requests_tow_id_idx
  ON public.customer_tow_cancellation_requests (tow_id);

ALTER TABLE public.customer_tow_cancellation_requests ENABLE ROW LEVEL SECURITY;

-- Reuse portal_user_may_read_customer / portal_user_may_edit_customer from
-- 20260723140000_customer_portal_contacts.sql — do not redefine.

-- =============================================================================
-- C. Portal RLS
-- =============================================================================

-- SELECT: any active portal user of this customer (viewer may see state)
CREATE POLICY customer_tow_cancellation_requests_select_customer_portal
  ON public.customer_tow_cancellation_requests
  FOR SELECT
  TO authenticated
  USING (
    public.portal_user_may_read_customer(
      customer_tow_cancellation_requests.customer_id
    )
  );

-- INSERT: admin|manager; self as requester; portal-origin + unassigned tow
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
  );

COMMENT ON POLICY customer_tow_cancellation_requests_insert_customer_portal
  ON public.customer_tow_cancellation_requests IS
  'Portal admin|manager: insert pending cancel only for portal-origin tows with driver_id IS NULL';

-- UPDATE: admin|manager withdraw only (pending → cancelled)
CREATE POLICY customer_tow_cancellation_requests_update_customer_portal
  ON public.customer_tow_cancellation_requests
  FOR UPDATE
  TO authenticated
  USING (
    customer_tow_cancellation_requests.status = 'pending'
    AND public.portal_user_may_edit_customer(
      customer_tow_cancellation_requests.customer_id
    )
  )
  WITH CHECK (
    customer_tow_cancellation_requests.status = 'cancelled'
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
  );

COMMENT ON POLICY customer_tow_cancellation_requests_update_customer_portal
  ON public.customer_tow_cancellation_requests IS
  'Portal admin|manager: withdraw only — pending → cancelled; cannot approve/reject';

-- =============================================================================
-- D. Staff RLS (company_admin | dispatcher)
-- =============================================================================

CREATE POLICY customer_tow_cancellation_requests_select_company_staff
  ON public.customer_tow_cancellation_requests
  FOR SELECT
  TO authenticated
  USING (
    customer_tow_cancellation_requests.company_id = public.get_my_company_id()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND u.role IN (
          'company_admin'::public.user_role,
          'dispatcher'::public.user_role
        )
    )
  );

-- Approve: approve or reject a pending request
CREATE POLICY customer_tow_cancellation_requests_update_company_staff
  ON public.customer_tow_cancellation_requests
  FOR UPDATE
  TO authenticated
  USING (
    customer_tow_cancellation_requests.status = 'pending'
    AND customer_tow_cancellation_requests.company_id = public.get_my_company_id()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND u.role IN (
          'company_admin'::public.user_role,
          'dispatcher'::public.user_role
        )
    )
  )
  WITH CHECK (
    customer_tow_cancellation_requests.status IN ('approved', 'rejected')
    AND customer_tow_cancellation_requests.reviewed_by = auth.uid()
    AND customer_tow_cancellation_requests.company_id = public.get_my_company_id()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND u.role IN (
          'company_admin'::public.user_role,
          'dispatcher'::public.user_role
        )
    )
  );

COMMENT ON POLICY customer_tow_cancellation_requests_update_company_staff
  ON public.customer_tow_cancellation_requests IS
  'Staff: pending → approved|rejected with reviewed_by = auth.uid(); tow cancel is app-side';

GRANT SELECT, INSERT, UPDATE ON public.customer_tow_cancellation_requests TO authenticated;

-- =============================================================================
-- E. Block assigning a driver while a cancel request is pending
-- =============================================================================
-- Chosen over "re-check at approve": makes the stale assigned+pending state
-- impossible. Trigger raises a clear exception for the dispatcher.

CREATE OR REPLACE FUNCTION public.prevent_assign_while_cancel_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL
     AND (OLD.driver_id IS NULL OR NEW.driver_id IS DISTINCT FROM OLD.driver_id)
  THEN
    IF EXISTS (
      SELECT 1
      FROM public.customer_tow_cancellation_requests c
      WHERE c.tow_id = NEW.id
        AND c.status = 'pending'
    ) THEN
      RAISE EXCEPTION
        'לא ניתן לשבץ נהג — יש בקשת ביטול ממתינה מהלקוח (tow_id=%)',
        NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_assign_while_cancel_pending() IS
  'BEFORE UPDATE on tows: reject setting/changing driver_id while a customer '
  'cancellation request is pending';

DROP TRIGGER IF EXISTS tows_prevent_assign_while_cancel_pending ON public.tows;

CREATE TRIGGER tows_prevent_assign_while_cancel_pending
  BEFORE UPDATE OF driver_id ON public.tows
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_assign_while_cancel_pending();
