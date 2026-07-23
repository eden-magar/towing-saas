ALTER TABLE public.customer_users
  DROP CONSTRAINT customer_users_role_check;

ALTER TABLE public.customer_users
  ADD CONSTRAINT customer_users_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'viewer'::text, 'accountant'::text]));
