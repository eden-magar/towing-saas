-- Expose the current customer-portal user's own stored vehicles (אחסנה).
-- No customer_id / company_id arguments — both are derived server-side from auth.uid()
-- to prevent IDOR. Returns a narrow column set (no notes / internal fields).

CREATE OR REPLACE FUNCTION public.get_my_stored_vehicles()
RETURNS TABLE (
  id uuid,
  plate_number text,
  vehicle_data jsonb,
  vehicle_condition text,
  current_status text,
  defects text[],
  location text,
  last_stored_at timestamptz
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
    sv.last_stored_at
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
  'Exposes only id, plate_number, vehicle_data, vehicle_condition, current_status, '
  'defects, location, last_stored_at — no notes or other internal fields.';

GRANT EXECUTE ON FUNCTION public.get_my_stored_vehicles() TO authenticated;
