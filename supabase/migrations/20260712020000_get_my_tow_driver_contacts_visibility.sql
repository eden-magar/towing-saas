-- Gate get_my_tow_driver_contacts by portal visibility flags (server-side).
-- Name only when show_driver_info resolves true; phone only when show_driver_phone resolves true.
-- Resolution matches app/lib/utils/portal-visibility.ts:
--   tow column override → legacy visibility_overrides JSONB → customer portal_settings (opt-in).

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
    CASE
      WHEN (
        CASE
          WHEN t.show_driver_info_override IS NOT NULL THEN t.show_driver_info_override
          WHEN jsonb_typeof(t.visibility_overrides->'show_driver_info') = 'boolean'
            THEN (t.visibility_overrides->>'show_driver_info')::boolean
          ELSE (c.portal_settings->>'show_driver_info') = 'true'
        END
      ) THEN u.full_name
      ELSE NULL
    END AS full_name,
    CASE
      WHEN (
        CASE
          WHEN t.show_driver_phone_override IS NOT NULL THEN t.show_driver_phone_override
          WHEN jsonb_typeof(t.visibility_overrides->'show_driver_phone') = 'boolean'
            THEN (t.visibility_overrides->>'show_driver_phone')::boolean
          ELSE (c.portal_settings->>'show_driver_phone') = 'true'
        END
      ) THEN u.phone
      ELSE NULL
    END AS phone
  FROM public.tows t
  INNER JOIN public.customers c ON c.id = t.customer_id
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
  'Returns driver full_name / phone for the caller''s own tows only, gated by portal '
  'visibility (show_driver_info / show_driver_phone). SECURITY DEFINER: scopes by '
  'get_my_customer_id() and p_tow_ids; requires users.role = customer.';

GRANT EXECUTE ON FUNCTION public.get_my_tow_driver_contacts(uuid[]) TO authenticated;
