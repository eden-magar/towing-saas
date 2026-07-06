-- Calendar global search: trigram indexes + single-RPC OR search scoped by company_id.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS tows_order_number_trgm_idx
  ON public.tows USING gin (order_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tows_customer_order_number_trgm_idx
  ON public.tows USING gin (customer_order_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS customers_name_trgm_idx
  ON public.customers USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tow_vehicles_plate_number_trgm_idx
  ON public.tow_vehicles USING gin (plate_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tow_points_address_trgm_idx
  ON public.tow_points USING gin (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tow_legs_from_address_trgm_idx
  ON public.tow_legs USING gin (from_address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tow_legs_to_address_trgm_idx
  ON public.tow_legs USING gin (to_address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS users_full_name_trgm_idx
  ON public.users USING gin (full_name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_calendar_tows(
  p_company_id uuid,
  p_query text,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  customer_name text,
  scheduled_at timestamptz,
  scheduled_end_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  status text,
  plate text,
  driver_name text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH pattern AS (
    SELECT '%' || trim(p_query) || '%' AS p
  ),
  matched AS (
    SELECT DISTINCT t.id
    FROM public.tows t
    CROSS JOIN pattern
    LEFT JOIN public.customers c ON c.id = t.customer_id
    LEFT JOIN public.tow_vehicles tv ON tv.tow_id = t.id
    LEFT JOIN public.tow_points tp ON tp.tow_id = t.id
    LEFT JOIN public.tow_legs tl ON tl.tow_id = t.id
    LEFT JOIN public.drivers d ON d.id = t.driver_id AND d.company_id = p_company_id
    LEFT JOIN public.users u ON u.id = d.user_id
    WHERE t.company_id = p_company_id
      AND length(trim(p_query)) >= 2
      AND (
        t.order_number ILIKE pattern.p
        OR t.customer_order_number ILIKE pattern.p
        OR c.name ILIKE pattern.p
        OR tv.plate_number ILIKE pattern.p
        OR tp.address ILIKE pattern.p
        OR tl.from_address ILIKE pattern.p
        OR tl.to_address ILIKE pattern.p
        OR u.full_name ILIKE pattern.p
      )
  )
  SELECT
    t.id,
    c.name AS customer_name,
    t.scheduled_at,
    t.scheduled_end_at,
    t.started_at,
    t.completed_at,
    t.created_at,
    t.status::text AS status,
    (
      SELECT tv2.plate_number
      FROM public.tow_vehicles tv2
      WHERE tv2.tow_id = t.id
      ORDER BY tv2.order_index ASC NULLS LAST
      LIMIT 1
    ) AS plate,
    u.full_name AS driver_name
  FROM public.tows t
  INNER JOIN matched m ON m.id = t.id
  LEFT JOIN public.customers c ON c.id = t.customer_id
  LEFT JOIN public.drivers d ON d.id = t.driver_id
  LEFT JOIN public.users u ON u.id = d.user_id
  ORDER BY t.scheduled_at DESC NULLS LAST, t.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;

COMMENT ON FUNCTION public.search_calendar_tows(uuid, text, int) IS
  'Company-scoped calendar tow search across order numbers, customer name, plate, '
  'addresses, and driver name. Returns one row per tow, ordered by scheduled_at desc.';

GRANT EXECUTE ON FUNCTION public.search_calendar_tows(uuid, text, int) TO authenticated;
