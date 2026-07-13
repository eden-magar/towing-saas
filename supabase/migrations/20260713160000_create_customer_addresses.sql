-- Per-customer saved addresses (dispatch), scoped by tenant (company_id)

CREATE TABLE public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  place_id TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_addresses_label_check CHECK (char_length(trim(label)) > 0),
  CONSTRAINT customer_addresses_address_check CHECK (char_length(trim(address)) > 0)
);

COMMENT ON TABLE public.customer_addresses IS
  'Recurring operational addresses per customer per tenant (dispatch use only; portal customers get a separate table later)';

CREATE INDEX customer_addresses_company_id_customer_id_idx
  ON public.customer_addresses (company_id, customer_id);

-- Label dedupe enforced in app (same pattern as customer_contacts phone)

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- Mirrored from customer_contacts_* policies; role scope includes dispatcher for operational use
CREATE POLICY customer_addresses_select_company_staff
  ON public.customer_addresses
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

CREATE POLICY customer_addresses_insert_company_staff
  ON public.customer_addresses
  FOR INSERT
  TO authenticated
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
      WHERE cc.company_id = customer_addresses.company_id
        AND cc.customer_id = customer_addresses.customer_id
        AND cc.is_active = true
    )
  );

CREATE POLICY customer_addresses_update_company_staff
  ON public.customer_addresses
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
      WHERE cc.company_id = customer_addresses.company_id
        AND cc.customer_id = customer_addresses.customer_id
        AND cc.is_active = true
    )
  );

CREATE POLICY customer_addresses_delete_company_staff
  ON public.customer_addresses
  FOR DELETE
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
