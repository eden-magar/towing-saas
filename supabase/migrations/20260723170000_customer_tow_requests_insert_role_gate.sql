-- Gate portal tow-request INSERT on customer_users.role IN ('admin','manager')
-- alongside existing portal_settings.can_submit_orders.
-- Child-table INSERT policies mirror the same role check so viewers/accountants
-- cannot attach rows to another user's pending request.

-- ---------- customer_tow_requests ----------

DROP POLICY IF EXISTS customer_tow_requests_insert_customer_portal
  ON public.customer_tow_requests;

CREATE POLICY customer_tow_requests_insert_customer_portal
  ON public.customer_tow_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = public.get_my_customer_id()
    AND submitted_by_user_id = auth.uid()
    AND status = 'pending'
    AND converted_tow_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND u.role = 'customer'::public.user_role
    )
    AND public.assert_customer_in_company(company_id, customer_id)
    AND EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_tow_requests.customer_id
        AND COALESCE((c.portal_settings->>'can_submit_orders')::boolean, false) = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.customer_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.customer_id = customer_tow_requests.customer_id
        AND cu.is_active = true
        AND cu.role IN ('admin', 'manager')
    )
  );

COMMENT ON POLICY customer_tow_requests_insert_customer_portal ON public.customer_tow_requests IS
  'Portal submit: can_submit_orders AND customer_users.role IN (admin, manager).';

-- ---------- customer_tow_request_vehicles ----------

DROP POLICY IF EXISTS customer_tow_request_vehicles_insert_customer_portal
  ON public.customer_tow_request_vehicles;

CREATE POLICY customer_tow_request_vehicles_insert_customer_portal
  ON public.customer_tow_request_vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.customer_id = public.get_my_customer_id()
        AND r.status = 'pending'
        AND r.converted_tow_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.is_active = true
            AND u.role = 'customer'::public.user_role
        )
        AND public.assert_customer_in_company(r.company_id, r.customer_id)
        AND EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = r.customer_id
            AND COALESCE((c.portal_settings->>'can_submit_orders')::boolean, false) = true
        )
        AND EXISTS (
          SELECT 1
          FROM public.customer_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.customer_id = r.customer_id
            AND cu.is_active = true
            AND cu.role IN ('admin', 'manager')
        )
    )
  );

-- ---------- customer_tow_request_points ----------

DROP POLICY IF EXISTS customer_tow_request_points_insert_customer_portal
  ON public.customer_tow_request_points;

CREATE POLICY customer_tow_request_points_insert_customer_portal
  ON public.customer_tow_request_points
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.customer_id = public.get_my_customer_id()
        AND r.status = 'pending'
        AND r.converted_tow_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.is_active = true
            AND u.role = 'customer'::public.user_role
        )
        AND public.assert_customer_in_company(r.company_id, r.customer_id)
        AND EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = r.customer_id
            AND COALESCE((c.portal_settings->>'can_submit_orders')::boolean, false) = true
        )
        AND EXISTS (
          SELECT 1
          FROM public.customer_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.customer_id = r.customer_id
            AND cu.is_active = true
            AND cu.role IN ('admin', 'manager')
        )
    )
  );

-- ---------- customer_tow_request_point_vehicles ----------

DROP POLICY IF EXISTS customer_tow_request_point_vehicles_insert_customer_portal
  ON public.customer_tow_request_point_vehicles;

CREATE POLICY customer_tow_request_point_vehicles_insert_customer_portal
  ON public.customer_tow_request_point_vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = customer_tow_request_point_vehicles.request_id
        AND r.customer_id = public.get_my_customer_id()
        AND r.status = 'pending'
        AND r.converted_tow_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.is_active = true
            AND u.role = 'customer'::public.user_role
        )
        AND public.assert_customer_in_company(r.company_id, r.customer_id)
        AND EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = r.customer_id
            AND COALESCE((c.portal_settings->>'can_submit_orders')::boolean, false) = true
        )
        AND EXISTS (
          SELECT 1
          FROM public.customer_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.customer_id = r.customer_id
            AND cu.is_active = true
            AND cu.role IN ('admin', 'manager')
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.customer_tow_request_points p
      WHERE p.id = customer_tow_request_point_vehicles.point_id
        AND p.request_id = customer_tow_request_point_vehicles.request_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.customer_tow_request_vehicles v
      WHERE v.id = customer_tow_request_point_vehicles.vehicle_id
        AND v.request_id = customer_tow_request_point_vehicles.request_id
    )
  );
