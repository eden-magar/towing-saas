-- Speed up tenant-scoped active customer lookups (price-lists, customer lists, RLS checks)

CREATE INDEX IF NOT EXISTS customer_company_company_id_is_active_idx
  ON public.customer_company (company_id, is_active);
