-- MEDIUM: cancelOrder() 취소 사유 저장
-- DB 실행 금지 (migration 제안 파일)
-- 운영 DB 적용 완료 (2026-05-08)

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE INDEX IF NOT EXISTS orders_cancel_reason_idx
  ON public.orders (buyer_tenant_id, created_at DESC)
  WHERE cancel_reason IS NOT NULL;

