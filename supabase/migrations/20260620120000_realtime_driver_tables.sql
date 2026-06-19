-- Realtime postgres_changes for drivers / driver_locations / driver_shifts
-- Requires SELECT RLS to pass under Realtime's per-row check (not just PostgREST).
-- See: https://github.com/supabase/realtime/issues/213 (search_path + unqualified refs)

-- Full row images so Realtime RLS/filter evaluation has company_id on UPDATE
ALTER TABLE public.drivers REPLICA IDENTITY FULL;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;
ALTER TABLE public.driver_shifts REPLICA IDENTITY FULL;

-- Harden tenant helper: fixed search_path + fully qualified users table
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.company_id
  FROM public.users u
  WHERE u.id = auth.uid()
$$;

-- Additive Realtime-safe SELECT policies (permissive OR with existing policies).
-- All table refs fully qualified for Realtime RLS engine search_path.

DROP POLICY IF EXISTS drivers_select_company_staff_realtime ON public.drivers;
CREATE POLICY drivers_select_company_staff_realtime
  ON public.drivers
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

DROP POLICY IF EXISTS drivers_select_own_user ON public.drivers;
CREATE POLICY drivers_select_own_user
  ON public.drivers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS driver_locations_select_company_staff_realtime ON public.driver_locations;
CREATE POLICY driver_locations_select_company_staff_realtime
  ON public.driver_locations
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

DROP POLICY IF EXISTS driver_locations_select_own_driver ON public.driver_locations;
CREATE POLICY driver_locations_select_own_driver
  ON public.driver_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
        AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS driver_shifts_select_company_staff_realtime ON public.driver_shifts;
CREATE POLICY driver_shifts_select_company_staff_realtime
  ON public.driver_shifts
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

DROP POLICY IF EXISTS driver_shifts_select_own_driver ON public.driver_shifts;
CREATE POLICY driver_shifts_select_own_driver
  ON public.driver_shifts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_shifts.driver_id
        AND d.user_id = auth.uid()
    )
  );
