-- Extend customer_tow_requests staging to mirror production tow header + vehicles + points.
-- Legacy flat columns on customer_tow_requests are retained for backward compatibility;
-- new portal requests should populate customer_tow_request_vehicles / _points / _point_vehicles instead.

-- =============================================================================
-- A. Header alterations on customer_tow_requests
-- =============================================================================

-- order_number becomes internal-only (assigned on convert); pending requests have none yet.
ALTER TABLE public.customer_tow_requests
  ALTER COLUMN order_number DROP NOT NULL;

ALTER TABLE public.customer_tow_requests
  DROP CONSTRAINT IF EXISTS customer_tow_requests_order_number_check;

ALTER TABLE public.customer_tow_requests
  ADD CONSTRAINT customer_tow_requests_order_number_check CHECK (
    order_number IS NULL OR char_length(trim(order_number)) > 0
  );

ALTER TABLE public.customer_tow_requests
  ADD COLUMN IF NOT EXISTS tow_type TEXT NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS customer_order_number TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS start_from_base BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dropoff_to_storage BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS orderer_phone TEXT;

ALTER TABLE public.customer_tow_requests
  DROP CONSTRAINT IF EXISTS customer_tow_requests_tow_type_check;

ALTER TABLE public.customer_tow_requests
  ADD CONSTRAINT customer_tow_requests_tow_type_check CHECK (
    tow_type IN ('simple', 'exchange', 'custom')
  );

-- Legacy flat vehicle/route/contact columns: optional now that child tables hold the data.
ALTER TABLE public.customer_tow_requests
  ALTER COLUMN department DROP NOT NULL,
  ALTER COLUMN orderer DROP NOT NULL,
  ALTER COLUMN plate_number DROP NOT NULL,
  ALTER COLUMN defect_description DROP NOT NULL,
  ALTER COLUMN pickup_address DROP NOT NULL,
  ALTER COLUMN dropoff_address DROP NOT NULL,
  ALTER COLUMN pickup_contact_name DROP NOT NULL,
  ALTER COLUMN pickup_contact_phone DROP NOT NULL,
  ALTER COLUMN dropoff_contact_name DROP NOT NULL,
  ALTER COLUMN dropoff_contact_phone DROP NOT NULL;

ALTER TABLE public.customer_tow_requests
  DROP CONSTRAINT IF EXISTS customer_tow_requests_department_check,
  DROP CONSTRAINT IF EXISTS customer_tow_requests_orderer_check,
  DROP CONSTRAINT IF EXISTS customer_tow_requests_plate_number_check,
  DROP CONSTRAINT IF EXISTS customer_tow_requests_defect_description_check,
  DROP CONSTRAINT IF EXISTS customer_tow_requests_pickup_address_check,
  DROP CONSTRAINT IF EXISTS customer_tow_requests_dropoff_address_check,
  DROP CONSTRAINT IF EXISTS customer_tow_requests_pickup_contact_name_check,
  DROP CONSTRAINT IF EXISTS customer_tow_requests_pickup_contact_phone_check,
  DROP CONSTRAINT IF EXISTS customer_tow_requests_dropoff_contact_name_check,
  DROP CONSTRAINT IF EXISTS customer_tow_requests_dropoff_contact_phone_check;

ALTER TABLE public.customer_tow_requests
  ADD CONSTRAINT customer_tow_requests_department_check CHECK (
    department IS NULL OR char_length(trim(department)) > 0
  ),
  ADD CONSTRAINT customer_tow_requests_orderer_check CHECK (
    orderer IS NULL OR char_length(trim(orderer)) > 0
  ),
  ADD CONSTRAINT customer_tow_requests_plate_number_check CHECK (
    plate_number IS NULL OR char_length(trim(plate_number)) > 0
  ),
  ADD CONSTRAINT customer_tow_requests_defect_description_check CHECK (
    defect_description IS NULL OR char_length(trim(defect_description)) > 0
  ),
  ADD CONSTRAINT customer_tow_requests_pickup_address_check CHECK (
    pickup_address IS NULL OR char_length(trim(pickup_address)) > 0
  ),
  ADD CONSTRAINT customer_tow_requests_dropoff_address_check CHECK (
    dropoff_address IS NULL OR char_length(trim(dropoff_address)) > 0
  ),
  ADD CONSTRAINT customer_tow_requests_pickup_contact_name_check CHECK (
    pickup_contact_name IS NULL OR char_length(trim(pickup_contact_name)) > 0
  ),
  ADD CONSTRAINT customer_tow_requests_pickup_contact_phone_check CHECK (
    pickup_contact_phone IS NULL OR char_length(trim(pickup_contact_phone)) > 0
  ),
  ADD CONSTRAINT customer_tow_requests_dropoff_contact_name_check CHECK (
    dropoff_contact_name IS NULL OR char_length(trim(dropoff_contact_name)) > 0
  ),
  ADD CONSTRAINT customer_tow_requests_dropoff_contact_phone_check CHECK (
    dropoff_contact_phone IS NULL OR char_length(trim(dropoff_contact_phone)) > 0
  );

COMMENT ON COLUMN public.customer_tow_requests.order_number IS
  'Internal tow order number — set when converted to tows.order_number; NULL while pending';
COMMENT ON COLUMN public.customer_tow_requests.customer_order_number IS
  'Customer-supplied order reference — maps to tows.customer_order_number on convert';
COMMENT ON COLUMN public.customer_tow_requests.plate_number IS
  'LEGACY flat field — superseded by customer_tow_request_vehicles; kept for backward compatibility';
COMMENT ON COLUMN public.customer_tow_requests.defect_description IS
  'LEGACY flat field — superseded by customer_tow_request_vehicles.tow_reason; kept for backward compatibility';
COMMENT ON COLUMN public.customer_tow_requests.pickup_address IS
  'LEGACY flat field — superseded by customer_tow_request_points; kept for backward compatibility';
COMMENT ON COLUMN public.customer_tow_requests.dropoff_address IS
  'LEGACY flat field — superseded by customer_tow_request_points; kept for backward compatibility';
COMMENT ON COLUMN public.customer_tow_requests.pickup_contact_name IS
  'LEGACY optional flat field — superseded by customer_tow_request_points.contact_name';
COMMENT ON COLUMN public.customer_tow_requests.pickup_contact_phone IS
  'LEGACY optional flat field — superseded by customer_tow_request_points.contact_phone';
COMMENT ON COLUMN public.customer_tow_requests.dropoff_contact_name IS
  'LEGACY optional flat field — superseded by customer_tow_request_points (dropoff contact/recipient)';
COMMENT ON COLUMN public.customer_tow_requests.dropoff_contact_phone IS
  'LEGACY optional flat field — superseded by customer_tow_request_points (dropoff contact/recipient)';
COMMENT ON COLUMN public.customer_tow_requests.department IS
  'Optional header field — may be omitted when child tables carry full request data';
COMMENT ON COLUMN public.customer_tow_requests.orderer IS
  'Optional header field — may be omitted when child tables carry full request data';

-- =============================================================================
-- B. customer_tow_request_vehicles (mirrors tow_vehicles essentials)
-- =============================================================================

CREATE TABLE public.customer_tow_request_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.customer_tow_requests (id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  vehicle_type public.vehicle_type,
  manufacturer TEXT,
  model TEXT,
  year INTEGER,
  color TEXT,
  is_working BOOLEAN NOT NULL DEFAULT true,
  tow_reason TEXT,
  notes TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_tow_request_vehicles_plate_check CHECK (char_length(trim(plate_number)) > 0)
);

COMMENT ON TABLE public.customer_tow_request_vehicles IS
  'Vehicles on a portal tow request — maps to tow_vehicles on convert';

CREATE INDEX customer_tow_request_vehicles_request_id_idx
  ON public.customer_tow_request_vehicles (request_id);

-- =============================================================================
-- C. customer_tow_request_points (mirrors tow_points essentials)
-- =============================================================================

CREATE TABLE public.customer_tow_request_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.customer_tow_requests (id) ON DELETE CASCADE,
  point_order INTEGER NOT NULL,
  point_type TEXT NOT NULL,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  contact_name TEXT,
  contact_phone TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  notes TEXT,
  order_notes TEXT,
  is_storage BOOLEAN NOT NULL DEFAULT false,
  stop_subtype TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_tow_request_points_point_type_check CHECK (
    point_type IN ('pickup', 'dropoff', 'exchange', 'stop')
  )
);

COMMENT ON TABLE public.customer_tow_request_points IS
  'Route points on a portal tow request — maps to tow_points on convert';

CREATE INDEX customer_tow_request_points_request_id_point_order_idx
  ON public.customer_tow_request_points (request_id, point_order);

-- =============================================================================
-- D. customer_tow_request_point_vehicles (mirrors tow_point_vehicles junction)
-- =============================================================================

CREATE TABLE public.customer_tow_request_point_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.customer_tow_requests (id) ON DELETE CASCADE,
  point_id UUID NOT NULL REFERENCES public.customer_tow_request_points (id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.customer_tow_request_vehicles (id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_tow_request_point_vehicles_action_check CHECK (
    action IN ('pickup', 'dropoff', 'exchange', 'stop')
  )
);

COMMENT ON TABLE public.customer_tow_request_point_vehicles IS
  'Links vehicles to points on a portal tow request — maps to tow_point_vehicles on convert';

CREATE INDEX customer_tow_request_point_vehicles_request_id_idx
  ON public.customer_tow_request_point_vehicles (request_id);

CREATE INDEX customer_tow_request_point_vehicles_point_id_idx
  ON public.customer_tow_request_point_vehicles (point_id);

CREATE INDEX customer_tow_request_point_vehicles_vehicle_id_idx
  ON public.customer_tow_request_point_vehicles (vehicle_id);

-- =============================================================================
-- E. RLS — mirror customer_tow_requests policies via parent request join
-- =============================================================================

ALTER TABLE public.customer_tow_request_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tow_request_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tow_request_point_vehicles ENABLE ROW LEVEL SECURITY;

-- ---------- customer_tow_request_vehicles ----------

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
        AND EXISTS (
          SELECT 1
          FROM public.customer_company cc
          WHERE cc.company_id = r.company_id
            AND cc.customer_id = r.customer_id
            AND cc.is_active = true
        )
        AND EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = r.customer_id
            AND COALESCE((c.portal_settings->>'can_submit_orders')::boolean, false) = true
        )
    )
  );

CREATE POLICY customer_tow_request_vehicles_select_customer_portal
  ON public.customer_tow_request_vehicles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.customer_id = public.get_my_customer_id()
        AND EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.is_active = true
            AND u.role = 'customer'::public.user_role
        )
    )
  );

CREATE POLICY customer_tow_request_vehicles_select_company_staff
  ON public.customer_tow_request_vehicles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.company_id = public.get_my_company_id()
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
  );

CREATE POLICY customer_tow_request_vehicles_update_company_staff
  ON public.customer_tow_request_vehicles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.company_id = public.get_my_company_id()
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.company_id = public.get_my_company_id()
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
          WHERE cc.company_id = r.company_id
            AND cc.customer_id = r.customer_id
            AND cc.is_active = true
        )
    )
  );

-- ---------- customer_tow_request_points ----------

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
        AND EXISTS (
          SELECT 1
          FROM public.customer_company cc
          WHERE cc.company_id = r.company_id
            AND cc.customer_id = r.customer_id
            AND cc.is_active = true
        )
        AND EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = r.customer_id
            AND COALESCE((c.portal_settings->>'can_submit_orders')::boolean, false) = true
        )
    )
  );

CREATE POLICY customer_tow_request_points_select_customer_portal
  ON public.customer_tow_request_points
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.customer_id = public.get_my_customer_id()
        AND EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.is_active = true
            AND u.role = 'customer'::public.user_role
        )
    )
  );

CREATE POLICY customer_tow_request_points_select_company_staff
  ON public.customer_tow_request_points
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.company_id = public.get_my_company_id()
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
  );

CREATE POLICY customer_tow_request_points_update_company_staff
  ON public.customer_tow_request_points
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.company_id = public.get_my_company_id()
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.company_id = public.get_my_company_id()
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
          WHERE cc.company_id = r.company_id
            AND cc.customer_id = r.customer_id
            AND cc.is_active = true
        )
    )
  );

-- ---------- customer_tow_request_point_vehicles ----------

CREATE POLICY customer_tow_request_point_vehicles_insert_customer_portal
  ON public.customer_tow_request_point_vehicles
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
        AND EXISTS (
          SELECT 1
          FROM public.customer_company cc
          WHERE cc.company_id = r.company_id
            AND cc.customer_id = r.customer_id
            AND cc.is_active = true
        )
        AND EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = r.customer_id
            AND COALESCE((c.portal_settings->>'can_submit_orders')::boolean, false) = true
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.customer_tow_request_points p
      WHERE p.id = point_id AND p.request_id = request_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.customer_tow_request_vehicles v
      WHERE v.id = vehicle_id AND v.request_id = request_id
    )
  );

CREATE POLICY customer_tow_request_point_vehicles_select_customer_portal
  ON public.customer_tow_request_point_vehicles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.customer_id = public.get_my_customer_id()
        AND EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.is_active = true
            AND u.role = 'customer'::public.user_role
        )
    )
  );

CREATE POLICY customer_tow_request_point_vehicles_select_company_staff
  ON public.customer_tow_request_point_vehicles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.company_id = public.get_my_company_id()
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
  );

CREATE POLICY customer_tow_request_point_vehicles_update_company_staff
  ON public.customer_tow_request_point_vehicles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.company_id = public.get_my_company_id()
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customer_tow_requests r
      WHERE r.id = request_id
        AND r.company_id = public.get_my_company_id()
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
          WHERE cc.company_id = r.company_id
            AND cc.customer_id = r.customer_id
            AND cc.is_active = true
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.customer_tow_request_points p
      WHERE p.id = point_id AND p.request_id = request_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.customer_tow_request_vehicles v
      WHERE v.id = vehicle_id AND v.request_id = request_id
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.customer_tow_request_vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customer_tow_request_points TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customer_tow_request_point_vehicles TO authenticated;
