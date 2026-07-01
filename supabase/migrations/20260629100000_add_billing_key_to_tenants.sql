-- 운영 DB 직접 실행 필요
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS billing_key text,
ADD COLUMN IF NOT EXISTS toss_customer_key text;
