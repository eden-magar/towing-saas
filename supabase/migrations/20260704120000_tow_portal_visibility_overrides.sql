-- Per-tow nullable overrides for customer-portal visibility flags.
-- NULL = inherit customers.portal_settings for that flag.
-- Additive only: does not alter existing columns or data.

ALTER TABLE public.tows
  ADD COLUMN IF NOT EXISTS show_photos_override boolean,
  ADD COLUMN IF NOT EXISTS show_price_override boolean,
  ADD COLUMN IF NOT EXISTS show_driver_info_override boolean,
  ADD COLUMN IF NOT EXISTS show_driver_phone_override boolean,
  ADD COLUMN IF NOT EXISTS show_status_history_override boolean,
  ADD COLUMN IF NOT EXISTS show_vehicles_override boolean,
  ADD COLUMN IF NOT EXISTS show_notes_override boolean;

COMMENT ON COLUMN public.tows.show_photos_override IS 'Portal visibility override for show_photos; NULL inherits customers.portal_settings';
COMMENT ON COLUMN public.tows.show_price_override IS 'Portal visibility override for show_price; NULL inherits customers.portal_settings';
COMMENT ON COLUMN public.tows.show_driver_info_override IS 'Portal visibility override for show_driver_info; NULL inherits customers.portal_settings';
COMMENT ON COLUMN public.tows.show_driver_phone_override IS 'Portal visibility override for show_driver_phone; NULL inherits customers.portal_settings';
COMMENT ON COLUMN public.tows.show_status_history_override IS 'Portal visibility override for show_status_history; NULL inherits customers.portal_settings';
COMMENT ON COLUMN public.tows.show_vehicles_override IS 'Portal visibility override for show_vehicles; NULL inherits customers.portal_settings';
COMMENT ON COLUMN public.tows.show_notes_override IS 'Portal visibility override for show_notes; NULL inherits customers.portal_settings';
