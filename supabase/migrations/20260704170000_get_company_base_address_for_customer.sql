-- Expose ONLY the towing company's yard/base address to customer-portal users.
-- price_lists contains sensitive pricing; portal users must not SELECT from it directly.
-- Company is resolved server-side from customer_users → customer_company (no caller-supplied company_id).

CREATE OR REPLACE FUNCTION public.get_company_base_address_for_customer()
RETURNS TABLE (
  base_address text,
  base_lat numeric,
  base_lng numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pl.base_address,
    pl.base_lat,
    pl.base_lng
  FROM public.users u
  INNER JOIN public.customer_users cu
    ON cu.user_id = u.id
    AND cu.is_active = true
  INNER JOIN public.customer_company cc
    ON cc.customer_id = cu.customer_id
    AND cc.is_active = true
  INNER JOIN public.price_lists pl
    ON pl.company_id = cc.company_id
    AND pl.customer_company_id IS NULL
    AND pl.is_active = true
  WHERE u.id = auth.uid()
    AND u.is_active = true
    AND u.role = 'customer'::public.user_role
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_company_base_address_for_customer() IS
  'Returns base_address, base_lat, base_lng from the caller''s linked company active base price list. '
  'SECURITY DEFINER: resolves company via customer_users → customer_company (no company_id argument). '
  'Exposes only yard/base location fields for portal storage auto-fill (מאחסנה/לאחסנה); no other price_lists columns. '
  'Returns zero rows when the caller is not an active customer portal user or no base price list exists.';

GRANT EXECUTE ON FUNCTION public.get_company_base_address_for_customer() TO authenticated;
