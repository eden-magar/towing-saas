-- Portal users (role=customer) have no users.company_id; company is only via customer_users → customer_company.
-- Direct client SELECT on customer_company is blocked by RLS — resolve server-side for portal flows.

CREATE OR REPLACE FUNCTION public.get_my_company_id_for_customer()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cc.company_id
  FROM public.customer_users cu
  INNER JOIN public.customer_company cc
    ON cc.customer_id = cu.customer_id
    AND cc.is_active = true
  WHERE cu.user_id = auth.uid()
    AND cu.is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_company_id_for_customer() IS
  'Returns company_id for the current portal user via customer_users → customer_company. '
  'Portal users lack users.company_id; use this instead of reading customer_company directly from the client.';

GRANT EXECUTE ON FUNCTION public.get_my_company_id_for_customer() TO authenticated;
