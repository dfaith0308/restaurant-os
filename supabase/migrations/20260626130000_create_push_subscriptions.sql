-- 운영 DB 적용 완료 (Supabase SQL Editor에서 직접 실행 필요)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant
  ON push_subscriptions(tenant_id);
