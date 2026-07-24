-- Applied MANUALLY via the Supabase SQL editor (not by CLI / supabase db push).
-- Portal tow search: return ONLY matching tow IDs, scoped to the caller's own
-- customer. The row payload is fetched separately through the existing
-- getCustomerTows select (CUSTOMER_TOW_LIST_SELECT) under .eq('customer_id', …)
-- plus the portal visibility strip, so this path exposes no new columns.
--
-- SECURITY DEFINER: customer_id is resolved server-side from auth.uid() via
-- customer_users -> customer_company (same pattern as
-- get_company_base_address_for_customer). It is NEVER taken from a client value.
--
-- Reuses the trigram GIN indexes created by 20260706120000_search_calendar_tows
-- (tows.order_number, tows.customer_order_number, tow_vehicles.plate_number,
-- tow_points.address) — no new indexes required.
--
-- Search fields match the portal list's prior client-side filter exactly:
-- order_number, customer_order_number, plate (digits-normalized), point address.
-- Deliberately excludes customer name (always the caller's own customer) and
-- driver name (visibility-gated; searching it would leak hidden driver identities).
--
-- total_matches is the full DISTINCT match count BEFORE the limit, so the caller
-- can detect truncation (total_matches > returned rows) and warn the user.

CREATE OR REPLACE FUNCTION public.search_customer_tow_ids(
  p_query text,
  p_limit int DEFAULT 300
)
RETURNS TABLE (
  tow_id uuid,
  total_matches bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT cc.customer_id
    FROM public.users u
    INNER JOIN public.customer_users cu
      ON cu.user_id = u.id
      AND cu.is_active = true
    INNER JOIN public.customer_company cc
      ON cc.customer_id = cu.customer_id
      AND cc.is_active = true
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role = 'customer'::public.user_role
    LIMIT 1
  ),
  pattern AS (
    SELECT
      '%' || trim(p_query) || '%' AS p,
      nullif(regexp_replace(trim(p_query), '\D', '', 'g'), '') AS plate_digits
  ),
  matched AS (
    SELECT DISTINCT t.id, t.scheduled_at, t.created_at
    FROM public.tows t
    CROSS JOIN pattern
    LEFT JOIN public.tow_vehicles tv ON tv.tow_id = t.id
    LEFT JOIN public.tow_points tp ON tp.tow_id = t.id
    WHERE t.customer_id = (SELECT customer_id FROM me)
      AND length(trim(p_query)) >= 2
      AND (
        t.order_number ILIKE pattern.p
        OR t.customer_order_number ILIKE pattern.p
        OR (
          pattern.plate_digits IS NOT NULL
          AND tv.plate_number ILIKE ('%' || pattern.plate_digits || '%')
        )
        OR tp.address ILIKE pattern.p
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM matched
  )
  SELECT
    m.id AS tow_id,
    (SELECT total FROM counted) AS total_matches
  FROM matched m
  ORDER BY m.scheduled_at DESC NULLS LAST, m.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 300), 1), 300);
$$;

COMMENT ON FUNCTION public.search_customer_tow_ids(text, int) IS
  'Portal tow search. Resolves the caller''s customer_id from auth.uid() '
  '(SECURITY DEFINER, never a client argument) and returns matching tow IDs '
  'across order_number, customer_order_number, plate (digits-normalized) and '
  'tow_points.address. Returns total_matches (full DISTINCT count before LIMIT) '
  'so callers can detect truncation. Row payload is fetched separately through '
  'the existing customer list select; this function exposes only IDs.';

GRANT EXECUTE ON FUNCTION public.search_customer_tow_ids(text, int) TO authenticated;
