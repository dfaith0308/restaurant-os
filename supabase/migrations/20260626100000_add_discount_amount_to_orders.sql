-- 운영 DB 적용 완료
ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS discount_amount integer DEFAULT 0;
