-- Atomic replace of customer-scoped time/location/service surcharges for one price_list.
-- Replaces the client-side delete-then-insert sequence in saveCustomerSurcharges
-- (app/lib/queries/price-lists.ts), which could wipe rows if a delete committed and an
-- insert failed.
--
-- SECURITY INVOKER (not DEFINER):
--   These tables already carry company_id and are mutated today via sequential client
--   supabase.from(...).delete/insert under the caller's JWT — RLS is the live enforcement
--   layer for company staff. Prefer INVOKER so policies keep applying to every DELETE/INSERT
--   (same rationale as create_full_customer_tow_request). We still assert that
--   price_lists.company_id = get_my_company_id() before mutating, so a caller cannot
--   retarget another company's price_list_id (and we stamp company_id from that row,
--   never from the jsonb payload).

CREATE OR REPLACE FUNCTION public.replace_customer_surcharges(
  p_price_list_id uuid,
  p_time jsonb DEFAULT '[]'::jsonb,
  p_location jsonb DEFAULT '[]'::jsonb,
  p_service jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF p_price_list_id IS NULL THEN
    RAISE EXCEPTION 'p_price_list_id is required';
  END IF;

  SELECT pl.company_id
  INTO v_company_id
  FROM public.price_lists pl
  WHERE pl.id = p_price_list_id
    AND pl.company_id = public.get_my_company_id();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION
      'price_list % not found or not owned by caller company',
      p_price_list_id;
  END IF;

  -- Normalize null payloads to empty arrays (clear all surcharges for this list).
  p_time := COALESCE(p_time, '[]'::jsonb);
  p_location := COALESCE(p_location, '[]'::jsonb);
  p_service := COALESCE(p_service, '[]'::jsonb);

  IF jsonb_typeof(p_time) <> 'array'
     OR jsonb_typeof(p_location) <> 'array'
     OR jsonb_typeof(p_service) <> 'array' THEN
    RAISE EXCEPTION 'p_time, p_location, and p_service must be jsonb arrays';
  END IF;

  DELETE FROM public.time_surcharges
  WHERE price_list_id = p_price_list_id;

  DELETE FROM public.location_surcharges
  WHERE price_list_id = p_price_list_id;

  DELETE FROM public.service_surcharges
  WHERE price_list_id = p_price_list_id;

  INSERT INTO public.time_surcharges (
    company_id,
    price_list_id,
    name,
    label,
    time_description,
    time_start,
    time_end,
    surcharge_percent,
    day_type,
    sort_order,
    is_active
  )
  SELECT
    v_company_id,
    p_price_list_id,
    r.name,
    r.label,
    r.time_description,
    -- UI may send "" ; coerce empty → NULL. Column is time-like (client sends "HH:MM").
    NULLIF(r.time_start, '')::time,
    NULLIF(r.time_end, '')::time,
    r.surcharge_percent,
    COALESCE(r.day_type, 'weekday'),
    COALESCE(r.sort_order, 0),
    COALESCE(r.is_active, true)
  FROM jsonb_to_recordset(p_time) AS r(
    name text,
    label text,
    time_description text,
    time_start text,
    time_end text,
    surcharge_percent numeric,
    day_type text,
    sort_order integer,
    is_active boolean
  );

  INSERT INTO public.location_surcharges (
    company_id,
    price_list_id,
    label,
    surcharge_percent,
    is_active
  )
  SELECT
    v_company_id,
    p_price_list_id,
    r.label,
    r.surcharge_percent,
    COALESCE(r.is_active, true)
  FROM jsonb_to_recordset(p_location) AS r(
    label text,
    surcharge_percent numeric,
    is_active boolean
  );

  INSERT INTO public.service_surcharges (
    company_id,
    price_list_id,
    label,
    price,
    price_type,
    unit_label,
    is_active,
    is_vat_exempt
  )
  SELECT
    v_company_id,
    p_price_list_id,
    r.label,
    r.price,
    r.price_type,
    r.unit_label,
    COALESCE(r.is_active, true),
    COALESCE(r.is_vat_exempt, false)
  FROM jsonb_to_recordset(p_service) AS r(
    label text,
    price numeric,
    price_type text,
    unit_label text,
    is_active boolean,
    is_vat_exempt boolean
  );
END;
$$;

COMMENT ON FUNCTION public.replace_customer_surcharges(uuid, jsonb, jsonb, jsonb) IS
  'Atomically replaces time/location/service surcharges for a customer price_list '
  '(delete all for price_list_id, then insert from jsonb arrays). '
  'SECURITY INVOKER: RLS enforces mutations; ownership checked via '
  'price_lists.company_id = get_my_company_id().';

GRANT EXECUTE ON FUNCTION public.replace_customer_surcharges(uuid, jsonb, jsonb, jsonb)
  TO authenticated;
