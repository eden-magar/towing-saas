-- Portal request vehicles: chassis + total_weight (kg), matching tow_vehicles.
-- Also updates create_full_customer_tow_request to persist them from the jsonb payload.
-- No backfill.

ALTER TABLE public.customer_tow_request_vehicles
  ADD COLUMN IF NOT EXISTS chassis text NULL;

ALTER TABLE public.customer_tow_request_vehicles
  ADD COLUMN IF NOT EXISTS total_weight numeric NULL;

COMMENT ON COLUMN public.customer_tow_request_vehicles.chassis IS
  'Optional chassis / VIN from portal manual vehicle entry.';

COMMENT ON COLUMN public.customer_tow_request_vehicles.total_weight IS
  'Optional gross weight in kg, mirroring tow_vehicles.total_weight.';

-- Atomic portal tow-request create: header + vehicles + points + point_vehicles in one transaction.
--
-- SECURITY INVOKER (not DEFINER): inserts run as the calling authenticated user, so existing
-- RLS INSERT policies on customer_tow_requests and child tables remain the enforcement layer.
-- A plpgsql function body is a single transaction — any error rolls back ALL rows (no partial
-- parent/child state). This replaces multi-call client inserts + best-effort parent delete,
-- which could not roll back because portal users have no DELETE policy on the parent table.
--
-- Payload shape (jsonb, snake_case keys):
-- {
--   "company_id": uuid,
--   "customer_id": uuid,
--   "submitted_by_user_id": uuid,
--   "tow_type": "simple"|"exchange"|"custom",
--   "customer_order_number": text|null,
--   "scheduled_at": timestamptz,
--   "scheduled_end_at": timestamptz|null,
--   "start_from_base": boolean,
--   "dropoff_to_storage": boolean,
--   "department": text|null,
--   "orderer": text|null,
--   "orderer_phone": text|null,
--   "notes": text|null,
--   "vehicles": [ { "plate_number", "vehicle_type", "manufacturer", "model", "year", "color",
--                   "chassis", "total_weight", "is_working", "tow_reason", "notes", "order_index" } ],
--   "points": [ { "point_order", "point_type", "address", "lat", "lng", "contact_name",
--                "contact_phone", "recipient_name", "recipient_phone", "notes", "order_notes",
--                "is_storage", "stop_subtype" } ],
--   "point_vehicles": [ { "point_index": 0-based, "vehicle_index": 0-based, "action" } ]
-- }

CREATE OR REPLACE FUNCTION public.create_full_customer_tow_request(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid := gen_random_uuid();
  v_vehicle_ids uuid[] := ARRAY[]::uuid[];
  v_point_ids uuid[] := ARRAY[]::uuid[];
  v_vehicle jsonb;
  v_point jsonb;
  v_pv jsonb;
  i int;
  n_vehicles int;
  n_points int;
  n_point_vehicles int;
  v_point_idx int;
  v_vehicle_idx int;
  v_plate text;
  v_vehicle_id uuid;
  v_point_id uuid;
BEGIN
  IF payload IS NULL THEN
    RAISE EXCEPTION 'payload is required';
  END IF;

  n_vehicles := jsonb_array_length(COALESCE(payload->'vehicles', '[]'::jsonb));
  n_points := jsonb_array_length(COALESCE(payload->'points', '[]'::jsonb));

  IF n_vehicles < 1 THEN
    RAISE EXCEPTION 'vehicles array must contain at least one row';
  END IF;

  IF n_points < 1 THEN
    RAISE EXCEPTION 'points array must contain at least one row';
  END IF;

  IF payload->>'company_id' IS NULL OR payload->>'customer_id' IS NULL
     OR payload->>'submitted_by_user_id' IS NULL OR payload->>'scheduled_at' IS NULL THEN
    RAISE EXCEPTION 'company_id, customer_id, submitted_by_user_id, and scheduled_at are required';
  END IF;

  IF payload->>'tow_type' IS NOT NULL
     AND payload->>'tow_type' NOT IN ('simple', 'exchange', 'custom') THEN
    RAISE EXCEPTION 'invalid tow_type: %', payload->>'tow_type';
  END IF;

  INSERT INTO public.customer_tow_requests (
    id,
    company_id,
    customer_id,
    submitted_by_user_id,
    order_number,
    tow_type,
    customer_order_number,
    scheduled_at,
    scheduled_end_at,
    start_from_base,
    dropoff_to_storage,
    department,
    orderer,
    orderer_phone,
    notes,
    status
  ) VALUES (
    v_request_id,
    (payload->>'company_id')::uuid,
    (payload->>'customer_id')::uuid,
    (payload->>'submitted_by_user_id')::uuid,
    NULL,
    COALESCE(payload->>'tow_type', 'simple'),
    NULLIF(trim(payload->>'customer_order_number'), ''),
    (payload->>'scheduled_at')::timestamptz,
    CASE
      WHEN payload->>'scheduled_end_at' IS NOT NULL AND trim(payload->>'scheduled_end_at') <> ''
      THEN (payload->>'scheduled_end_at')::timestamptz
      ELSE NULL
    END,
    COALESCE((payload->>'start_from_base')::boolean, false),
    COALESCE((payload->>'dropoff_to_storage')::boolean, false),
    NULLIF(trim(payload->>'department'), ''),
    NULLIF(trim(payload->>'orderer'), ''),
    NULLIF(trim(payload->>'orderer_phone'), ''),
    NULLIF(trim(payload->>'notes'), ''),
    'pending'
  );

  FOR i IN 0 .. n_vehicles - 1 LOOP
    v_vehicle := payload->'vehicles'->i;
    v_plate := trim(v_vehicle->>'plate_number');

    IF v_plate IS NULL OR v_plate = '' THEN
      RAISE EXCEPTION 'vehicle at index %: plate_number is required', i;
    END IF;

    v_vehicle_id := gen_random_uuid();
    v_vehicle_ids := array_append(v_vehicle_ids, v_vehicle_id);

    INSERT INTO public.customer_tow_request_vehicles (
      id,
      request_id,
      plate_number,
      vehicle_type,
      manufacturer,
      model,
      year,
      color,
      chassis,
      total_weight,
      is_working,
      tow_reason,
      notes,
      order_index
    ) VALUES (
      v_vehicle_id,
      v_request_id,
      v_plate,
      CASE
        WHEN v_vehicle->>'vehicle_type' IS NOT NULL AND trim(v_vehicle->>'vehicle_type') <> ''
        THEN (v_vehicle->>'vehicle_type')::public.vehicle_type
        ELSE NULL
      END,
      NULLIF(trim(v_vehicle->>'manufacturer'), ''),
      NULLIF(trim(v_vehicle->>'model'), ''),
      CASE
        WHEN v_vehicle->>'year' IS NOT NULL AND trim(v_vehicle->>'year') <> ''
        THEN (v_vehicle->>'year')::integer
        ELSE NULL
      END,
      NULLIF(trim(v_vehicle->>'color'), ''),
      NULLIF(trim(v_vehicle->>'chassis'), ''),
      CASE
        WHEN v_vehicle->>'total_weight' IS NOT NULL AND trim(v_vehicle->>'total_weight') <> ''
        THEN (v_vehicle->>'total_weight')::numeric
        ELSE NULL
      END,
      COALESCE((v_vehicle->>'is_working')::boolean, true),
      NULLIF(trim(v_vehicle->>'tow_reason'), ''),
      NULLIF(trim(v_vehicle->>'notes'), ''),
      COALESCE(
        CASE
          WHEN v_vehicle->>'order_index' IS NOT NULL AND trim(v_vehicle->>'order_index') <> ''
          THEN (v_vehicle->>'order_index')::integer
          ELSE NULL
        END,
        i
      )
    );
  END LOOP;

  FOR i IN 0 .. n_points - 1 LOOP
    v_point := payload->'points'->i;

    IF v_point->>'point_type' IS NULL
       OR v_point->>'point_type' NOT IN ('pickup', 'dropoff', 'exchange', 'stop') THEN
      RAISE EXCEPTION 'point at index %: invalid point_type', i;
    END IF;

    IF v_point->>'point_order' IS NULL OR trim(v_point->>'point_order') = '' THEN
      RAISE EXCEPTION 'point at index %: point_order is required', i;
    END IF;

    v_point_id := gen_random_uuid();
    v_point_ids := array_append(v_point_ids, v_point_id);

    INSERT INTO public.customer_tow_request_points (
      id,
      request_id,
      point_order,
      point_type,
      address,
      lat,
      lng,
      contact_name,
      contact_phone,
      recipient_name,
      recipient_phone,
      notes,
      order_notes,
      is_storage,
      stop_subtype
    ) VALUES (
      v_point_id,
      v_request_id,
      (v_point->>'point_order')::integer,
      v_point->>'point_type',
      NULLIF(trim(v_point->>'address'), ''),
      CASE
        WHEN v_point->>'lat' IS NOT NULL AND trim(v_point->>'lat') <> ''
        THEN (v_point->>'lat')::numeric
        ELSE NULL
      END,
      CASE
        WHEN v_point->>'lng' IS NOT NULL AND trim(v_point->>'lng') <> ''
        THEN (v_point->>'lng')::numeric
        ELSE NULL
      END,
      NULLIF(trim(v_point->>'contact_name'), ''),
      NULLIF(trim(v_point->>'contact_phone'), ''),
      NULLIF(trim(v_point->>'recipient_name'), ''),
      NULLIF(trim(v_point->>'recipient_phone'), ''),
      NULLIF(trim(v_point->>'notes'), ''),
      NULLIF(trim(v_point->>'order_notes'), ''),
      COALESCE((v_point->>'is_storage')::boolean, false),
      NULLIF(trim(v_point->>'stop_subtype'), '')
    );
  END LOOP;

  IF payload ? 'point_vehicles' AND jsonb_typeof(payload->'point_vehicles') = 'array' THEN
    n_point_vehicles := jsonb_array_length(payload->'point_vehicles');

    FOR i IN 0 .. n_point_vehicles - 1 LOOP
      v_pv := payload->'point_vehicles'->i;

      IF v_pv->>'point_index' IS NULL OR trim(v_pv->>'point_index') = '' THEN
        RAISE EXCEPTION 'point_vehicles at index %: point_index is required', i;
      END IF;

      IF v_pv->>'vehicle_index' IS NULL OR trim(v_pv->>'vehicle_index') = '' THEN
        RAISE EXCEPTION 'point_vehicles at index %: vehicle_index is required', i;
      END IF;

      IF v_pv->>'action' IS NULL
         OR v_pv->>'action' NOT IN ('pickup', 'dropoff', 'exchange', 'stop') THEN
        RAISE EXCEPTION 'point_vehicles at index %: invalid action', i;
      END IF;

      v_point_idx := (v_pv->>'point_index')::integer;
      v_vehicle_idx := (v_pv->>'vehicle_index')::integer;

      IF v_point_idx < 0 OR v_point_idx >= n_points THEN
        RAISE EXCEPTION 'point_vehicles at index %: point_index % out of range (0..%)',
          i, v_point_idx, n_points - 1;
      END IF;

      IF v_vehicle_idx < 0 OR v_vehicle_idx >= n_vehicles THEN
        RAISE EXCEPTION 'point_vehicles at index %: vehicle_index % out of range (0..%)',
          i, v_vehicle_idx, n_vehicles - 1;
      END IF;

      INSERT INTO public.customer_tow_request_point_vehicles (
        request_id,
        point_id,
        vehicle_id,
        action
      ) VALUES (
        v_request_id,
        v_point_ids[v_point_idx + 1],
        v_vehicle_ids[v_vehicle_idx + 1],
        v_pv->>'action'
      );
    END LOOP;
  END IF;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.create_full_customer_tow_request(jsonb) IS
  'Atomically inserts a pending portal tow request (header + vehicles + points + junction rows). '
  'SECURITY INVOKER: RLS INSERT policies enforce caller identity; entire function rolls back on any error.';

GRANT EXECUTE ON FUNCTION public.create_full_customer_tow_request(jsonb) TO authenticated;
