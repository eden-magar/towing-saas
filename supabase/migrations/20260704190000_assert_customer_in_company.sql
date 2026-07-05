-- Portal users cannot SELECT customer_company directly (RLS). Verify linkage server-side
-- for tow-request submit guards, using the same customer_users → customer_company model
-- as get_my_company_id_for_customer (caller may only assert their own customer_id).

CREATE OR REPLACE FUNCTION public.assert_customer_in_company(
  p_company_id uuid,
  p_customer_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_users cu
    INNER JOIN public.customer_company cc
      ON cc.customer_id = cu.customer_id
      AND cc.is_active = true
    WHERE cu.user_id = auth.uid()
      AND cu.is_active = true
      AND cu.customer_id = p_customer_id
      AND cc.company_id = p_company_id
      AND cc.customer_id = p_customer_id
  );
$$;

COMMENT ON FUNCTION public.assert_customer_in_company(uuid, uuid) IS
  'Returns true when an active customer_company row exists for p_company_id and p_customer_id '
  'and the caller is an active portal user linked to p_customer_id. '
  'SECURITY DEFINER: use instead of reading customer_company directly from the client.';

GRANT EXECUTE ON FUNCTION public.assert_customer_in_company(uuid, uuid) TO authenticated;
