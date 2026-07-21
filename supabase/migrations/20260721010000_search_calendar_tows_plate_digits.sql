-- Applied MANUALLY via the Supabase SQL editor (not by CLI / supabase db push).
-- Plate search: strip non-digits from p_query before ILIKE so "12-345-67" matches
-- digit-stored tow_vehicles.plate_number. Other fields keep raw trim(p_query) pattern.
-- CREATE OR REPLACE only - same signature, columns, ORDER BY, vehicle_type as
-- 20260714190000_search_calendar_tows_vehicle_type.sql.

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
  driver_name text,
  order_number text,
  customer_order_number text,
  pickup_address text,
  dropoff_address text,
  vehicle_type text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH pattern AS (
    SELECT
      '%' || trim(p_query) || '%' AS p,
      nullif(regexp_replace(trim(p_query), '\D', '', 'g'), '') AS plate_digits
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
        OR (
          pattern.plate_digits IS NOT NULL
          AND tv.plate_number ILIKE ('%' || pattern.plate_digits || '%')
        )
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
    u.full_name AS driver_name,
    t.order_number,
    t.customer_order_number,
    (
      SELECT trim(tl_pick.from_address)
      FROM public.tow_legs tl_pick
      WHERE tl_pick.tow_id = t.id
        AND tl_pick.from_address IS NOT NULL
        AND trim(tl_pick.from_address) <> ''
      ORDER BY tl_pick.leg_order ASC NULLS LAST
      LIMIT 1
    ) AS pickup_address,
    (
      SELECT trim(tl_drop.to_address)
      FROM public.tow_legs tl_drop
      WHERE tl_drop.tow_id = t.id
        AND tl_drop.to_address IS NOT NULL
        AND trim(tl_drop.to_address) <> ''
      ORDER BY tl_drop.leg_order DESC NULLS LAST
      LIMIT 1
    ) AS dropoff_address,
    (
      SELECT tv3.vehicle_type::text
      FROM public.tow_vehicles tv3
      WHERE tv3.tow_id = t.id
      ORDER BY tv3.order_index ASC NULLS LAST
      LIMIT 1
    ) AS vehicle_type
  FROM public.tows t
  INNER JOIN matched m ON m.id = t.id
  LEFT JOIN public.customers c ON c.id = t.customer_id
  LEFT JOIN public.drivers d ON d.id = t.driver_id
  LEFT JOIN public.users u ON u.id = d.user_id
  ORDER BY t.scheduled_at DESC NULLS LAST, t.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;

COMMENT ON FUNCTION public.search_calendar_tows(uuid, text, int) IS
  'Company-scoped calendar/dashboard tow search across order numbers, customer name, plate, '
  'addresses, and driver name. Plate match uses digits-only query strip; other fields use raw '
  'trim(p_query). Returns one row per tow with order numbers, pickup/dropoff leg addresses, '
  'and first vehicle type by order_index, ordered by scheduled_at desc.';

GRANT EXECUTE ON FUNCTION public.search_calendar_tows(uuid, text, int) TO authenticated;
