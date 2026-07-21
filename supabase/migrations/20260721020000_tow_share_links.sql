-- Applied MANUALLY via the Supabase SQL editor (not by CLI / supabase db push).
-- Tow photo share links (token + expiry) and company default expiry setting.
-- Multiple links per tow allowed. Valid when revoked_at IS NULL AND expires_at > now().
-- No anon RLS — public gallery (later) will use service role after token validation.

-- ---------------------------------------------------------------------------
-- company_settings: default share-link lifetime (days)
-- ---------------------------------------------------------------------------
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS share_link_default_expiry_days integer NOT NULL DEFAULT 7;

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_share_link_default_expiry_days_check;

ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_share_link_default_expiry_days_check
  CHECK (share_link_default_expiry_days >= 1 AND share_link_default_expiry_days <= 90);

COMMENT ON COLUMN public.company_settings.share_link_default_expiry_days IS
  'Default lifetime in days for new tow photo share links (1-90; default 7)';

-- ---------------------------------------------------------------------------
-- tow_share_links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tow_share_links (
  token text PRIMARY KEY,
  tow_id uuid NOT NULL REFERENCES public.tows (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL
);

COMMENT ON TABLE public.tow_share_links IS
  'Unguessable tokens for public tow photo galleries; multiple per tow; '
  'valid when revoked_at IS NULL AND expires_at > now(). No anon RLS.';

CREATE INDEX IF NOT EXISTS tow_share_links_tow_id_created_at_idx
  ON public.tow_share_links (tow_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tow_share_links_company_id_idx
  ON public.tow_share_links (company_id);

-- token is PRIMARY KEY (unique + indexed)

ALTER TABLE public.tow_share_links ENABLE ROW LEVEL SECURITY;

-- Company staff only (mirror tow_internal_notes / customer_contacts via get_my_company_id)
CREATE POLICY tow_share_links_select_company_staff
  ON public.tow_share_links
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

CREATE POLICY tow_share_links_insert_company_staff
  ON public.tow_share_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND (created_by IS NULL OR created_by = auth.uid())
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
      FROM public.tows t
      WHERE t.id = tow_id
        AND t.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY tow_share_links_update_company_staff
  ON public.tow_share_links
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
  );

GRANT SELECT, INSERT, UPDATE ON public.tow_share_links TO authenticated;
