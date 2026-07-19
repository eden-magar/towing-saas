-- Log silent storage misses from the shared RPCs (Expo + web both call these).
-- Logging is in NORMAL control flow only (no EXCEPTION / re-raise) so the
-- attention row commits with the same transaction as a soft-miss RETURN FALSE
-- or continues alongside a rare null upsert id. Bodies otherwise unchanged.

CREATE OR REPLACE FUNCTION public.add_vehicle_to_storage(
  p_company_id uuid,
  p_customer_id uuid DEFAULT NULL::uuid,
  p_plate_number text DEFAULT NULL::text,
  p_vehicle_data jsonb DEFAULT NULL::jsonb,
  p_location text DEFAULT NULL::text,
  p_tow_id uuid DEFAULT NULL::uuid,
  p_performed_by uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text,
  p_vehicle_condition text DEFAULT 'operational'::text,
  p_vehicle_code text DEFAULT NULL::text,
  p_defects text[] DEFAULT NULL::text[],
  p_entry_customer_order_number text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_stored_vehicle_id UUID;
BEGIN
  INSERT INTO stored_vehicles (
    company_id, customer_id, plate_number, vehicle_data, location, notes,
    last_stored_at, vehicle_condition, vehicle_code, defects, entry_customer_order_number
  )
  VALUES (
    p_company_id, p_customer_id, p_plate_number, p_vehicle_data, p_location, p_notes,
    NOW(), p_vehicle_condition, p_vehicle_code, p_defects, p_entry_customer_order_number
  )
  ON CONFLICT (company_id, plate_number)
  DO UPDATE SET
    current_status = 'stored',
    customer_id = COALESCE(EXCLUDED.customer_id, stored_vehicles.customer_id),
    vehicle_data = COALESCE(EXCLUDED.vehicle_data, stored_vehicles.vehicle_data),
    location = COALESCE(EXCLUDED.location, stored_vehicles.location),
    notes = EXCLUDED.notes,
    last_stored_at = NOW(),
    vehicle_condition = EXCLUDED.vehicle_condition,
    vehicle_code = COALESCE(EXCLUDED.vehicle_code, stored_vehicles.vehicle_code),
    defects = EXCLUDED.defects,
    entry_customer_order_number = COALESCE(EXCLUDED.entry_customer_order_number, stored_vehicles.entry_customer_order_number)
  RETURNING id INTO v_stored_vehicle_id;

  IF v_stored_vehicle_id IS NULL THEN
    INSERT INTO manual_action_items (
      company_id, type, severity, status, message, tow_id, related_entity, details
    )
    VALUES (
      p_company_id,
      'storage_add_failed',
      'high',
      'open',
      'רכב ' || COALESCE(p_plate_number, '?') || ' לא נכנס לאחסנה (הכנסה לא יצרה רשומה) — נדרש טיפול ידני',
      p_tow_id,
      p_plate_number,
      jsonb_build_object(
        'source', 'add_vehicle_to_storage',
        'plate', p_plate_number,
        'tow_id', p_tow_id
      )
    );
  END IF;

  INSERT INTO storage_history (stored_vehicle_id, action, tow_id, performed_by, notes)
  VALUES (v_stored_vehicle_id, 'in', p_tow_id, p_performed_by, p_notes);

  RETURN v_stored_vehicle_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_vehicle_from_storage(
  p_stored_vehicle_id uuid,
  p_tow_id uuid DEFAULT NULL::uuid,
  p_performed_by uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_company_id uuid;
  v_plate text;
BEGIN
  UPDATE stored_vehicles
  SET current_status = 'released', reserved_for_tow_id = NULL
  WHERE id = p_stored_vehicle_id
    AND current_status IN ('stored', 'reserved_for_tow');

  IF NOT FOUND THEN
    SELECT company_id, plate_number INTO v_company_id, v_plate
    FROM stored_vehicles
    WHERE id = p_stored_vehicle_id;

    IF v_company_id IS NOT NULL THEN
      INSERT INTO manual_action_items (
        company_id, type, severity, status, message, tow_id, related_entity, details
      )
      VALUES (
        v_company_id,
        'storage_release_failed',
        'high',
        'open',
        'שחרור רכב מהאחסנה נכשל (הרכב לא במצב המתאים לשחרור) — נדרש טיפול ידני',
        p_tow_id,
        v_plate,
        jsonb_build_object(
          'source', 'release_vehicle_from_storage',
          'stored_vehicle_id', p_stored_vehicle_id,
          'tow_id', p_tow_id
        )
      );
    END IF;

    RETURN FALSE;
  END IF;

  INSERT INTO storage_history (stored_vehicle_id, action, tow_id, performed_by, notes)
  VALUES (p_stored_vehicle_id, 'out', p_tow_id, p_performed_by, p_notes);

  RETURN TRUE;
END;
$function$;
