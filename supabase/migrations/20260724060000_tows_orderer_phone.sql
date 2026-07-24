ALTER TABLE public.tows
  ADD COLUMN IF NOT EXISTS orderer_phone text NULL;

COMMENT ON COLUMN public.tows.orderer_phone IS
  'Phone of the person who ordered the tow. Carried from customer_tow_requests.orderer_phone on convert; staff may fill it directly.';
