-- Keep drivers.last_* in sync when a breadcrumb is inserted.
-- Background mobile tasks can INSERT driver_locations under RLS but often cannot
-- UPDATE drivers (stricter/missing UPDATE policy or 0-row RLS filter). This
-- trigger updates drivers server-side so the dispatcher map stays live.

CREATE OR REPLACE FUNCTION public.sync_driver_last_location_on_breadcrumb()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.drivers d
  SET
    last_lat = NEW.lat,
    last_lng = NEW.lng,
    last_seen_at = COALESCE(NEW."timestamp", now())
  WHERE d.id = NEW.driver_id
    AND d.company_id = NEW.company_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_driver_last_location_on_breadcrumb() IS
  'After driver_locations INSERT, copy lat/lng/timestamp into drivers.last_* for live map.';

DROP TRIGGER IF EXISTS driver_locations_sync_driver_last_location ON public.driver_locations;

CREATE TRIGGER driver_locations_sync_driver_last_location
  AFTER INSERT ON public.driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_driver_last_location_on_breadcrumb();
