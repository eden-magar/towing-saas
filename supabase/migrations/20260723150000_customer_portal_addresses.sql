-- Portal org addresses (shared across all portal users of a customer).
-- Separate from staff public.customer_addresses so staff notes never leak and
-- portal RLS can be designed without filtering a shared table.
--
-- Coordinates are NOT NULL by construction: calculateDistance falls back to
-- address strings when lat/lng are missing, and those coords travel into
-- tow_points / pricing. A saved row without coords must be impossible.
--
-- Label uniqueness: expression unique index on (company_id, customer_id,
-- lower(btrim(label))). App should still persist trimmed labels in Phase 2.
-- place_id is nullable (absent for pin-drop and map-link resolve).

CREATE TABLE public.customer_portal_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  place_id TEXT,
  created_by_user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_portal_addresses_label_check CHECK (char_length(trim(label)) > 0),
  CONSTRAINT customer_portal_addresses_address_check CHECK (char_length(trim(address)) > 0),
  CONSTRAINT customer_portal_addresses_lat_range_check CHECK (lat >= -90::double precision AND lat <= 90::double precision),
  CONSTRAINT customer_portal_addresses_lng_range_check CHECK (lng >= -180::double precision AND lng <= 180::double precision),
  CONSTRAINT customer_portal_addresses_not_null_island_check CHECK (NOT (lat = 0 AND lng = 0))
);

COMMENT ON TABLE public.customer_portal_addresses IS
  'Customer-org saved addresses for the portal; shared by customer_id; no notes; lat/lng required';

COMMENT ON COLUMN public.customer_portal_addresses.label IS
  'User-facing identity key; unique per company+customer after lower(btrim(label))';

COMMENT ON COLUMN public.customer_portal_addresses.lat IS
  'Required WGS84 latitude — never null; feeds Distance Matrix / pricing';

COMMENT ON COLUMN public.customer_portal_addresses.lng IS
  'Required WGS84 longitude — never null; feeds Distance Matrix / pricing';

COMMENT ON COLUMN public.customer_portal_addresses.place_id IS
  'Google place_id when known (Places pick); NULL for pin-drop and map-link resolve';

COMMENT ON COLUMN public.customer_portal_addresses.created_by_user_id IS
  'Portal user who created the row; NULL only if that user is later removed';

CREATE INDEX customer_portal_addresses_company_id_customer_id_idx
  ON public.customer_portal_addresses (company_id, customer_id);

-- Duplicate key = label (not place_id / address string / coords).
-- lower(btrim(...)) folds trailing/leading spaces and Latin case; Hebrew is unaffected by lower.
CREATE UNIQUE INDEX customer_portal_addresses_company_customer_label_uidx
  ON public.customer_portal_addresses (company_id, customer_id, lower(btrim(label)));

ALTER TABLE public.customer_portal_addresses ENABLE ROW LEVEL SECURITY;

-- Reuse existing portal_user_may_read_customer / portal_user_may_edit_customer
-- from 20260723140000_customer_portal_contacts.sql — do not redefine.

-- ---------- Portal SELECT: any active portal user of this customer ----------
CREATE POLICY customer_portal_addresses_select_customer_portal
  ON public.customer_portal_addresses
  FOR SELECT
  TO authenticated
  USING (public.portal_user_may_read_customer(customer_id));

-- ---------- Portal INSERT: admin / manager only ----------
CREATE POLICY customer_portal_addresses_insert_customer_portal
  ON public.customer_portal_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND public.assert_customer_in_company(company_id, customer_id)
    AND public.portal_user_may_edit_customer(customer_id)
  );

-- ---------- Portal UPDATE: admin / manager only ----------
CREATE POLICY customer_portal_addresses_update_customer_portal
  ON public.customer_portal_addresses
  FOR UPDATE
  TO authenticated
  USING (public.portal_user_may_edit_customer(customer_id))
  WITH CHECK (
    public.assert_customer_in_company(company_id, customer_id)
    AND public.portal_user_may_edit_customer(customer_id)
  );

-- ---------- Portal DELETE: admin / manager only ----------
CREATE POLICY customer_portal_addresses_delete_customer_portal
  ON public.customer_portal_addresses
  FOR DELETE
  TO authenticated
  USING (public.portal_user_may_edit_customer(customer_id));

-- ---------- Staff SELECT only (support); no staff write ----------
CREATE POLICY customer_portal_addresses_select_company_staff
  ON public.customer_portal_addresses
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_portal_addresses TO authenticated;
