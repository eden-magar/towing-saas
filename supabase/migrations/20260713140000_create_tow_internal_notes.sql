-- Internal dispatcher notes feed on a tow (company staff only; never drivers/customers)

CREATE TABLE public.tow_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  tow_id UUID NOT NULL REFERENCES public.tows (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users (id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tow_internal_notes_body_check CHECK (char_length(trim(body)) > 0)
);

COMMENT ON TABLE public.tow_internal_notes IS
  'Append-only internal notes on a tow; visible to company_admin/dispatcher only (not drivers or customer portal)';

CREATE INDEX tow_internal_notes_tow_id_created_at_idx
  ON public.tow_internal_notes (tow_id, created_at);

ALTER TABLE public.tow_internal_notes ENABLE ROW LEVEL SECURITY;

-- Full row images so Realtime RLS/filter evaluation has company_id / tow_id
ALTER TABLE public.tow_internal_notes REPLICA IDENTITY FULL;

CREATE POLICY tow_internal_notes_select_company_staff
  ON public.tow_internal_notes
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

CREATE POLICY tow_internal_notes_insert_company_staff
  ON public.tow_internal_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND author_id = auth.uid()
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

-- Append-only: no UPDATE or DELETE policies (mirror shift_edits)

GRANT SELECT, INSERT ON public.tow_internal_notes TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tow_internal_notes;
