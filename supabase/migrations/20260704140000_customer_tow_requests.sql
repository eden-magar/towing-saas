-- Staging table for lean tow order requests submitted by customer portal users.
-- Does not modify public.tows.

CREATE OR REPLACE FUNCTION public.get_my_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cu.customer_id
  FROM public.customer_users cu
  WHERE cu.user_id = auth.uid()
    AND cu.is_active = true
  LIMIT 1
$$;

COMMENT ON FUNCTION public.get_my_customer_id() IS 'Active customer_id for the current portal user (customer_users.user_id = auth.uid())';

CREATE TABLE public.customer_tow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  submitted_by_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  department TEXT NOT NULL,
  orderer TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  defect_description TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC,
  pickup_lng NUMERIC,
  dropoff_address TEXT NOT NULL,
  dropoff_lat NUMERIC,
  dropoff_lng NUMERIC,
  pickup_contact_name TEXT NOT NULL,
  pickup_contact_phone TEXT NOT NULL,
  dropoff_contact_name TEXT NOT NULL,
  dropoff_contact_phone TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  converted_tow_id UUID REFERENCES public.tows (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_tow_requests_status_check CHECK (
    status IN ('pending', 'converted', 'dismissed')
  ),
  CONSTRAINT customer_tow_requests_order_number_check CHECK (char_length(trim(order_number)) > 0),
  CONSTRAINT customer_tow_requests_department_check CHECK (char_length(trim(department)) > 0),
  CONSTRAINT customer_tow_requests_orderer_check CHECK (char_length(trim(orderer)) > 0),
  CONSTRAINT customer_tow_requests_plate_number_check CHECK (char_length(trim(plate_number)) > 0),
  CONSTRAINT customer_tow_requests_defect_description_check CHECK (char_length(trim(defect_description)) > 0),
  CONSTRAINT customer_tow_requests_pickup_address_check CHECK (char_length(trim(pickup_address)) > 0),
  CONSTRAINT customer_tow_requests_dropoff_address_check CHECK (char_length(trim(dropoff_address)) > 0),
  CONSTRAINT customer_tow_requests_pickup_contact_name_check CHECK (char_length(trim(pickup_contact_name)) > 0),
  CONSTRAINT customer_tow_requests_pickup_contact_phone_check CHECK (char_length(trim(pickup_contact_phone)) > 0),
  CONSTRAINT customer_tow_requests_dropoff_contact_name_check CHECK (char_length(trim(dropoff_contact_name)) > 0),
  CONSTRAINT customer_tow_requests_dropoff_contact_phone_check CHECK (char_length(trim(dropoff_contact_phone)) > 0),
  CONSTRAINT customer_tow_requests_converted_tow_check CHECK (
    (status = 'converted' AND converted_tow_id IS NOT NULL)
    OR (status <> 'converted')
  )
);

COMMENT ON TABLE public.customer_tow_requests IS 'Lean tow order requests from customer portal; converted to tows by dispatcher';
COMMENT ON COLUMN public.customer_tow_requests.converted_tow_id IS 'Set when a dispatcher promotes this request into a real tow';

CREATE INDEX customer_tow_requests_company_id_status_idx
  ON public.customer_tow_requests (company_id, status);

CREATE INDEX customer_tow_requests_customer_id_created_at_idx
  ON public.customer_tow_requests (customer_id, created_at DESC);

ALTER TABLE public.customer_tow_requests ENABLE ROW LEVEL SECURITY;

-- Customer portal: submit requests for own customer + linked company
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
    AND EXISTS (
      SELECT 1
      FROM public.customer_company cc
      WHERE cc.company_id = customer_tow_requests.company_id
        AND cc.customer_id = customer_tow_requests.customer_id
        AND cc.is_active = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_tow_requests.customer_id
        AND COALESCE((c.portal_settings->>'can_submit_orders')::boolean, false) = true
    )
  );

-- Customer portal: read own customer requests
CREATE POLICY customer_tow_requests_select_customer_portal
  ON public.customer_tow_requests
  FOR SELECT
  TO authenticated
  USING (
    customer_id = public.get_my_customer_id()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND u.role = 'customer'::public.user_role
    )
  );

-- Company staff: read all requests for tenant (mirrors customer_orderers_select_company_staff)
CREATE POLICY customer_tow_requests_select_company_staff
  ON public.customer_tow_requests
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_my_company_id()
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

-- Company staff: convert or dismiss requests (mirrors customer_orderers_update_company_staff)
CREATE POLICY customer_tow_requests_update_company_staff
  ON public.customer_tow_requests
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_my_company_id()
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
    company_id = public.get_my_company_id()
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
    AND EXISTS (
      SELECT 1
      FROM public.customer_company cc
      WHERE cc.company_id = customer_tow_requests.company_id
        AND cc.customer_id = customer_tow_requests.customer_id
        AND cc.is_active = true
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.customer_tow_requests TO authenticated;
