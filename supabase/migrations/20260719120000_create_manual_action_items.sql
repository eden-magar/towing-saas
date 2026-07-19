-- Generic "needs manual attention" queue for swallowed failures that leave
-- inconsistent state a human must fix (e.g. storage point completed but no
-- stored_vehicles row). type / severity / status stay free text (TS-controlled).

CREATE TABLE public.manual_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high',
  status TEXT NOT NULL DEFAULT 'open',
  message TEXT NOT NULL,
  tow_id UUID REFERENCES public.tows (id) ON DELETE SET NULL,
  related_entity TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.manual_action_items IS
  'Queue of silent-failure / inconsistent-state items for company staff to resolve or dismiss; type/severity/status are free text controlled in app code';

CREATE INDEX manual_action_items_company_id_status_idx
  ON public.manual_action_items (company_id, status);

CREATE INDEX manual_action_items_tow_id_idx
  ON public.manual_action_items (tow_id);

CREATE INDEX manual_action_items_created_at_desc_idx
  ON public.manual_action_items (created_at DESC);

ALTER TABLE public.manual_action_items ENABLE ROW LEVEL SECURITY;

-- SELECT: managers see their company's items; super_admin sees all.
-- (Repo uses public.get_my_company_id() — there is no get_user_company_id / is_super_admin helper.)
CREATE POLICY manual_action_items_select_company_staff
  ON public.manual_action_items
  FOR SELECT
  TO authenticated
  USING (
    (
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
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND u.role = 'super_admin'::public.user_role
    )
  );

-- UPDATE: resolve/dismiss — same audience as SELECT
CREATE POLICY manual_action_items_update_company_staff
  ON public.manual_action_items
  FOR UPDATE
  TO authenticated
  USING (
    (
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
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND u.role = 'super_admin'::public.user_role
    )
  )
  WITH CHECK (
    (
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
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND u.role = 'super_admin'::public.user_role
    )
  );

-- INSERT: any authenticated user of the company (incl. drivers reporting
-- swallowed failures) or super_admin. No DELETE policy — resolve/dismiss only.
CREATE POLICY manual_action_items_insert_company_member
  ON public.manual_action_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      company_id = public.get_my_company_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.is_active = true
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND u.role = 'super_admin'::public.user_role
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.manual_action_items TO authenticated;
