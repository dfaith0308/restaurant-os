-- fix: RULE-10 (fixed_costs soft delete)
-- 운영 DB 적용 완료 (2026-05-08)

ALTER TABLE public.fixed_costs
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS fixed_costs_tenant_active_idx
  ON public.fixed_costs (tenant_id, created_at DESC)
  WHERE is_active = true;

