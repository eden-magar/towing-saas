-- Optional business-customer fields on tows
ALTER TABLE tows ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE tows ADD COLUMN IF NOT EXISTS ordered_by text;
