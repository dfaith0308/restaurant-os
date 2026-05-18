-- tenants 영업시간·월 영업일수 (additive only)

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS opening_time text,
  ADD COLUMN IF NOT EXISTS closing_time text,
  ADD COLUMN IF NOT EXISTS working_days_per_month integer DEFAULT 25;
