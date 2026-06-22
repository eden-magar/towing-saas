-- Per-customer orderer details (מזמין) for business customers, scoped by tenant (company_id)

CREATE TABLE public.customer_orderers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  department TEXT,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_orderers_name_check CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE public.customer_orderers IS 'Recurring orderer (מזמין) records per business customer per tenant';

CREATE INDEX customer_orderers_company_id_customer_id_idx
  ON public.customer_orderers (company_id, customer_id);

-- Dedupe on (department + name) enforced in app (nullable department makes a strict UNIQUE awkward in PostgreSQL)

ALTER TABLE public.customer_orderers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_orderers_select_company_staff
  ON public.customer_orderers
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

CREATE POLICY customer_orderers_insert_company_staff
  ON public.customer_orderers
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
      WHERE cc.company_id = customer_orderers.company_id
        AND cc.customer_id = customer_orderers.customer_id
        AND cc.is_active = true
    )
  );

CREATE POLICY customer_orderers_update_company_staff
  ON public.customer_orderers
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
      WHERE cc.company_id = customer_orderers.company_id
        AND cc.customer_id = customer_orderers.customer_id
        AND cc.is_active = true
    )
  );

CREATE POLICY customer_orderers_delete_company_staff
  ON public.customer_orderers
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_orderers TO authenticated;
