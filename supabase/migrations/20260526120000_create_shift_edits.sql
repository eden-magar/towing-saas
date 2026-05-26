-- Audit log of admin edits to driver_shifts (started_at, ended_at)

CREATE TABLE public.shift_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.driver_shifts (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  field_name TEXT NOT NULL,
  old_value TIMESTAMPTZ,
  new_value TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  CONSTRAINT shift_edits_field_name_check CHECK (field_name IN ('started_at', 'ended_at')),
  CONSTRAINT shift_edits_reason_check CHECK (char_length(reason) >= 3)
);

COMMENT ON TABLE public.shift_edits IS 'Audit log of admin edits to driver_shifts (started_at, ended_at)';

CREATE INDEX shift_edits_shift_id_idx ON public.shift_edits (shift_id);

CREATE INDEX shift_edits_company_id_edited_at_idx ON public.shift_edits (company_id, edited_at DESC);

ALTER TABLE public.shift_edits ENABLE ROW LEVEL SECURITY;

-- Company admins: read audit rows for their company
CREATE POLICY shift_edits_select_company_admin
  ON public.shift_edits
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

-- Company admins: insert audit rows for their company as themselves
CREATE POLICY shift_edits_insert_company_admin
  ON public.shift_edits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND edited_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'company_admin'::public.user_role
        AND u.is_active = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.driver_shifts ds
      WHERE ds.id = shift_id
        AND ds.company_id = company_id
    )
  );

-- No UPDATE or DELETE policies: audit rows are immutable

GRANT SELECT, INSERT ON public.shift_edits TO authenticated;
