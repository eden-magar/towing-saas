-- Add stop-specific office/driver note fields
ALTER TABLE public.tow_points
  ADD COLUMN IF NOT EXISTS order_notes text,
  ADD COLUMN IF NOT EXISTS driver_visited_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_notes text;
