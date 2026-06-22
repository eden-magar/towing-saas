-- TEMPORARY: Phase 0 telemetry for driver background location task debugging.
-- Drop after root cause is confirmed and production fix is verified.

CREATE TABLE public.driver_location_task_debug (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  driver_id UUID REFERENCES public.drivers (id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies (id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.driver_shifts (id) ON DELETE SET NULL,
  stage TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT driver_location_task_debug_stage_check CHECK (
    stage IN (
      'task_wake',
      'no_locations',
      'context_loaded',
      'no_context',
      'session_ok',
      'session_missing',
      'session_refresh_ok',
      'session_refresh_fail',
      'insert_ok',
      'insert_fail',
      'update_ok',
      'update_fail'
    )
  )
);

COMMENT ON TABLE public.driver_location_task_debug IS
  'TEMPORARY telemetry for Expo background location task chain (remove after fix verified).';

CREATE INDEX driver_location_task_debug_created_at_idx
  ON public.driver_location_task_debug (created_at DESC);

CREATE INDEX driver_location_task_debug_driver_id_created_at_idx
  ON public.driver_location_task_debug (driver_id, created_at DESC)
  WHERE driver_id IS NOT NULL;

ALTER TABLE public.driver_location_task_debug ENABLE ROW LEVEL SECURITY;

-- Drivers may insert their own debug rows (driver_id null allowed for early pipeline stages).
CREATE POLICY driver_location_task_debug_insert_own_driver
  ON public.driver_location_task_debug
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_id
        AND d.user_id = auth.uid()
    )
  );

-- Drivers can read their own rows; company staff can read company rows for support.
CREATE POLICY driver_location_task_debug_select_own_driver
  ON public.driver_location_task_debug
  FOR SELECT
  TO authenticated
  USING (
    (
      driver_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.id = driver_id
          AND d.user_id = auth.uid()
      )
    )
    OR (
      company_id IS NOT NULL
      AND company_id = public.get_my_company_id()
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
  );
