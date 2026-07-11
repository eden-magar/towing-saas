-- Portal: expose assigned driver full_name + phone for the caller's OWN tows only.
-- Replaces the PostgREST drivers→users embed, which fails under customer RLS
-- (no customer-portal SELECT on drivers/users).

CREATE OR REPLACE FUNCTION public.get_my_tow_driver_contacts(p_tow_ids uuid[])
RETURNS TABLE (
  tow_id uuid,
  full_name text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id AS tow_id,
    u.full_name,
    u.phone
  FROM public.tows t
  INNER JOIN public.drivers d ON d.id = t.driver_id
  INNER JOIN public.users u ON u.id = d.user_id
  WHERE public.get_my_customer_id() IS NOT NULL
    AND t.customer_id = public.get_my_customer_id()
    AND t.id = ANY (p_tow_ids)
    AND t.driver_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users me
      WHERE me.id = auth.uid()
        AND me.is_active = true
        AND me.role = 'customer'::public.user_role
    );
$$;

COMMENT ON FUNCTION public.get_my_tow_driver_contacts(uuid[]) IS
  'Returns full_name + phone for drivers assigned to the caller''s own tows only. '
  'SECURITY DEFINER: scopes by get_my_customer_id() and p_tow_ids; requires users.role = customer. '
  'Does not expose other driver/user fields or drivers for other customers'' tows.';

GRANT EXECUTE ON FUNCTION public.get_my_tow_driver_contacts(uuid[]) TO authenticated;
