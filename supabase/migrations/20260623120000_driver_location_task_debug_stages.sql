-- Expand driver_location_task_debug stage enum for full pipeline telemetry.

ALTER TABLE public.driver_location_task_debug
  DROP CONSTRAINT IF EXISTS driver_location_task_debug_stage_check;

ALTER TABLE public.driver_location_task_debug
  ADD CONSTRAINT driver_location_task_debug_stage_check CHECK (
    stage IN (
      'task_wake',
      'task_error',
      'task_complete',
      'no_locations',
      'locations_received',
      'context_read_start',
      'context_loaded',
      'no_context',
      'save_start',
      'session_ok',
      'session_missing',
      'session_refresh_ok',
      'session_refresh_fail',
      'insert_ok',
      'insert_fail',
      'update_ok',
      'update_fail',
      'tracking_start_requested',
      'tracking_stop_requested'
    )
  );
