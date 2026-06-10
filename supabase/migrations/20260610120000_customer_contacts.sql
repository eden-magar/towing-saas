-- Per-customer operational contacts (dispatch), scoped by tenant (company_id)

CREATE TABLE public.customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  role_or_title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_contacts_name_check CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE public.customer_contacts IS 'Recurring operational contacts per customer per tenant (dispatch use; not portal logins)';

CREATE INDEX customer_contacts_company_id_customer_id_idx
  ON public.customer_contacts (company_id, customer_id);

-- Phone dedupe enforced in app (nullable phone makes a strict UNIQUE awkward in PostgreSQL)

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

-- Mirrored from weight_base_brackets_* policies; role scope includes dispatcher for operational use
CREATE POLICY customer_contacts_select_company_staff
  ON public.customer_contacts
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

CREATE POLICY customer_contacts_insert_company_staff
  ON public.customer_contacts
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
      WHERE cc.company_id = customer_contacts.company_id
        AND cc.customer_id = customer_contacts.customer_id
        AND cc.is_active = true
    )
  );

CREATE POLICY customer_contacts_update_company_staff
  ON public.customer_contacts
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
      WHERE cc.company_id = customer_contacts.company_id
        AND cc.customer_id = customer_contacts.customer_id
        AND cc.is_active = true
    )
  );

CREATE POLICY customer_contacts_delete_company_staff
  ON public.customer_contacts
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_contacts TO authenticated;
