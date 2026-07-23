-- Portal org contacts (shared across all portal users of a customer).
-- Separate from staff public.customer_contacts so staff notes never leak and
-- portal RLS can be designed without filtering a shared table.
--
-- Phone uniqueness: partial unique index on (company_id, customer_id, phone)
-- WHERE phone IS NOT NULL. The index compares RAW TEXT — '050-1234567' and
-- '0501234567' are different keys. The app MUST normalize via normalizePhone
-- (app/lib/utils/phone.ts) before every insert/update. See Phase 2.

CREATE TABLE public.customer_portal_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  role_or_title TEXT,
  created_by_user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_portal_contacts_name_check CHECK (char_length(trim(name)) > 0),
  CONSTRAINT customer_portal_contacts_phone_check CHECK (phone IS NULL OR char_length(trim(phone)) > 0)
);

COMMENT ON TABLE public.customer_portal_contacts IS
  'Customer-org saved contacts for the portal; shared by customer_id; no notes column';

COMMENT ON COLUMN public.customer_portal_contacts.phone IS
  'Identity key when non-null; store app-normalized local digits (e.g. 0501234567). Never empty string.';

COMMENT ON COLUMN public.customer_portal_contacts.created_by_user_id IS
  'Portal user who created the row; NULL only if that user is later removed';

CREATE INDEX customer_portal_contacts_company_id_customer_id_idx
  ON public.customer_portal_contacts (company_id, customer_id);

CREATE UNIQUE INDEX customer_portal_contacts_company_customer_phone_uidx
  ON public.customer_portal_contacts (company_id, customer_id, phone)
  WHERE phone IS NOT NULL;

ALTER TABLE public.customer_portal_contacts ENABLE ROW LEVEL SECURITY;

-- Shared predicate: caller is an active portal user of THIS row's customer,
-- with edit rights. Deliberately does NOT call get_my_customer_id(): that
-- helper is LIMIT 1 over customer_users, so a user with two active
-- memberships would be scoped to an arbitrary one. The membership check below
-- is exact and is the only scoping that matters.
CREATE OR REPLACE FUNCTION public.portal_user_may_edit_customer(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.customer_users cu ON cu.user_id = u.id
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role = 'customer'::public.user_role
      AND cu.customer_id = p_customer_id
      AND cu.is_active = true
      AND cu.role IN ('admin', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.portal_user_may_read_customer(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.customer_users cu ON cu.user_id = u.id
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role = 'customer'::public.user_role
      AND cu.customer_id = p_customer_id
      AND cu.is_active = true
  );
$$;

-- ---------- Portal SELECT: any active portal user of this customer ----------
CREATE POLICY customer_portal_contacts_select_customer_portal
  ON public.customer_portal_contacts
  FOR SELECT
  TO authenticated
  USING (public.portal_user_may_read_customer(customer_id));

-- ---------- Portal INSERT: admin / manager only ----------
CREATE POLICY customer_portal_contacts_insert_customer_portal
  ON public.customer_portal_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND public.assert_customer_in_company(company_id, customer_id)
    AND public.portal_user_may_edit_customer(customer_id)
  );

-- ---------- Portal UPDATE: admin / manager only ----------
CREATE POLICY customer_portal_contacts_update_customer_portal
  ON public.customer_portal_contacts
  FOR UPDATE
  TO authenticated
  USING (public.portal_user_may_edit_customer(customer_id))
  WITH CHECK (
    public.assert_customer_in_company(company_id, customer_id)
    AND public.portal_user_may_edit_customer(customer_id)
  );

-- ---------- Portal DELETE: admin / manager only ----------
CREATE POLICY customer_portal_contacts_delete_customer_portal
  ON public.customer_portal_contacts
  FOR DELETE
  TO authenticated
  USING (public.portal_user_may_edit_customer(customer_id));

-- ---------- Staff SELECT only (support); no staff write ----------
CREATE POLICY customer_portal_contacts_select_company_staff
  ON public.customer_portal_contacts
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_portal_contacts TO authenticated;
