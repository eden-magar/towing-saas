-- Expose vehicle_code on portal stored-vehicle list so required קוד רכב
-- can be satisfied when picking a vehicle that already has a code.
-- DROP first: Postgres cannot change a function's return type via CREATE OR REPLACE.

DROP FUNCTION IF EXISTS public.get_my_stored_vehicles();

CREATE OR REPLACE FUNCTION public.get_my_stored_vehicles()
RETURNS TABLE (
  id uuid,
  plate_number text,
  vehicle_data jsonb,
  vehicle_condition text,
  current_status text,
  defects text[],
  location text,
  last_stored_at timestamptz,
  vehicle_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sv.id,
    sv.plate_number,
    sv.vehicle_data,
    sv.vehicle_condition,
    sv.current_status,
    sv.defects,
    sv.location,
    sv.last_stored_at,
    sv.vehicle_code
  FROM public.stored_vehicles sv
  WHERE public.get_my_customer_id() IS NOT NULL
    AND sv.customer_id = public.get_my_customer_id()
    AND sv.company_id = public.get_my_company_id_for_customer()
    AND sv.current_status IN ('stored', 'reserved_for_tow')
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND u.role = 'customer'::public.user_role
    )
  ORDER BY sv.last_stored_at DESC;
$$;

COMMENT ON FUNCTION public.get_my_stored_vehicles() IS
  'Returns the caller''s own stored_vehicles rows (stored + reserved_for_tow). '
  'SECURITY DEFINER: scopes by get_my_customer_id() and get_my_company_id_for_customer() '
  '(no caller-supplied ids). Requires users.role = customer. '
  'Exposes id, plate_number, vehicle_data, vehicle_condition, current_status, '
  'defects, location, last_stored_at, vehicle_code — no notes or other internal fields.';

GRANT EXECUTE ON FUNCTION public.get_my_stored_vehicles() TO authenticated;
