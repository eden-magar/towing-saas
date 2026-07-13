-- VAT-exempt catalog flag for service surcharges (pilot pricing formula).
-- Exempt lines are multiplied into neither VAT nor customer discount;
-- they are added after VAT/discount/manual adjustment.

ALTER TABLE service_surcharges
  ADD COLUMN IF NOT EXISTS is_vat_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN service_surcharges.is_vat_exempt IS
  'When true, this service is added after VAT and is not taxed or customer-discounted.';
