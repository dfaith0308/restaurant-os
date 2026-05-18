ALTER TABLE tenants
  DROP COLUMN IF EXISTS opening_time,
  DROP COLUMN IF EXISTS closing_time,
  ADD COLUMN IF NOT EXISTS business_hours_text text;
