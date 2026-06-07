-- Commercial vehicle weight→base-price brackets (company-wide, per tenant)

CREATE TABLE public.weight_base_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  min_kg NUMERIC NOT NULL,
  max_kg NUMERIC,
  base_price NUMERIC NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.weight_base_brackets IS 'Commercial vehicle weight brackets mapping min/max kg to base tow price per company';

CREATE INDEX weight_base_brackets_company_id_sort_order_idx ON public.weight_base_brackets (company_id, sort_order);

ALTER TABLE public.weight_base_brackets ENABLE ROW LEVEL SECURITY;

-- Company admins: read bracket rows for their company
CREATE POLICY weight_base_brackets_select_company_admin
  ON public.weight_base_brackets
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'company_admin'::public.user_role
        AND u.is_active = true
    )
  );

-- Company admins: insert bracket rows for their company
CREATE POLICY weight_base_brackets_insert_company_admin
  ON public.weight_base_brackets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'company_admin'::public.user_role
        AND u.is_active = true
    )
  );

-- Company admins: update bracket rows for their company
CREATE POLICY weight_base_brackets_update_company_admin
  ON public.weight_base_brackets
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'company_admin'::public.user_role
        AND u.is_active = true
    )
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'company_admin'::public.user_role
        AND u.is_active = true
    )
  );

-- Company admins: delete bracket rows for their company (delete-all-then-insert save)
CREATE POLICY weight_base_brackets_delete_company_admin
  ON public.weight_base_brackets
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'company_admin'::public.user_role
        AND u.is_active = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_base_brackets TO authenticated;
