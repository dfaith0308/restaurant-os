-- ============================================================
-- 식당OS DB 스키마 v1
-- 완전 독립 Supabase 프로젝트
-- ============================================================

-- ── 테넌트 (식당) ─────────────────────────────────────────────
CREATE TABLE restaurants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  region       text,                    -- "인천 부평구"
  owner_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name   text,
  phone        text,
  created_at   timestamptz DEFAULT now()
);

-- 기존 DB에 owner_id 없을 때 마이그레이션용
-- ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 식자재 ────────────────────────────────────────────────────
-- name 은 "raw_name" 역할 — 사용자가 입력한/명세서에서 읽힌 원본 문구.
-- parsed_name/brand/barcode/manufacturer 는 OCR 또는 제품 뒷면 사진에서 추출된 SKU 정보.
CREATE TABLE ingredients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            text NOT NULL,                -- raw_name
  category        text,
  unit            text DEFAULT 'kg',
  current_price   integer,
  supplier_name   text,
  is_active       boolean DEFAULT true,
  parsed_name     text,                         -- SKU 정식 품목명
  brand           text,                         -- 브랜드
  barcode         text,                         -- 1순위 SKU 식별자
  manufacturer    text,                         -- 제조사
  possible_duplicate_group_id uuid,             -- 같은 SKU 로 묶일 후보 그룹 (병합 준비용)
  group_confirmed_same_at     timestamptz,      -- 사용자가 "바코드 달라도 같은 상품" 확인한 시점 (null = 미확인)
  created_at      timestamptz DEFAULT now()
);

-- 기존 DB 마이그레이션용
-- ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS parsed_name text;
-- ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS brand text;
-- ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS barcode text;
-- ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS manufacturer text;
-- ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS possible_duplicate_group_id uuid;
-- ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS group_confirmed_same_at timestamptz;

CREATE INDEX idx_ingredients_barcode
  ON ingredients(tenant_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_ingredients_dup_group
  ON ingredients(tenant_id, possible_duplicate_group_id)
  WHERE possible_duplicate_group_id IS NOT NULL;

-- ── 고정비 ────────────────────────────────────────────────────
CREATE TABLE fixed_costs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          text NOT NULL,         -- "월세", "인건비", "전기세"
  amount        integer NOT NULL,
  cycle         text DEFAULT 'monthly', -- monthly / weekly
  created_at    timestamptz DEFAULT now()
);

-- ── 공급업체 (거래처) ─────────────────────────────────────────
CREATE TABLE suppliers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  contact       text,
  region        text,
  memo          text,
  rating        integer CHECK (rating BETWEEN 1 AND 5),
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ── 발주요청 (RFQ) ─────────────────────────────────────────────
CREATE TABLE rfq_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  ingredient_id   uuid REFERENCES ingredients(id) ON DELETE SET NULL,
  product_name    text NOT NULL,
  quantity        integer NOT NULL,
  unit            text DEFAULT 'kg',
  current_price   integer,             -- 현재 구매가 (비교 기준)
  target_price    integer,             -- 목표가 (선택)
  request_note    text,
  deadline        timestamptz,
  region          text,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('draft','open','closed','ordered','cancelled')),
  closed_reason   text,                -- "기존 거래 유지", "가격 미충족" 등
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── 입찰 (Bid) — 관리자가 대신 입력 ───────────────────────────
CREATE TABLE rfq_bids (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id          uuid NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
  supplier_id     uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name   text NOT NULL,       -- supplier_id 없을 때 직접 입력
  price           integer NOT NULL,    -- 제안 단가
  delivery_days   integer,             -- 납기 (일)
  note            text,
  status          text NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted','accepted','rejected')),
  created_at      timestamptz DEFAULT now()
);

-- ── 발주 확정 ─────────────────────────────────────────────────
CREATE TABLE orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_tenant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  rfq_id          uuid REFERENCES rfq_requests(id) ON DELETE SET NULL,
  bid_id          uuid REFERENCES rfq_bids(id) ON DELETE SET NULL,
  supplier_id     uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name   text NOT NULL,
  product_name    text NOT NULL,
  quantity        integer NOT NULL,
  unit            text DEFAULT 'kg',
  unit_price      integer NOT NULL,
  total_amount    integer NOT NULL,    -- quantity × unit_price
  saving_amount   integer DEFAULT 0,  -- (기존가 - unit_price) × quantity
  status          text NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed','completed','cancelled')),
  created_at      timestamptz DEFAULT now()
);

-- ── 지급 예정 ─────────────────────────────────────────────────
CREATE TABLE payments_outgoing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_tenant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id        uuid REFERENCES orders(id) ON DELETE SET NULL,
  supplier_id     uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name   text NOT NULL,
  amount          integer NOT NULL,
  due_date        date NOT NULL,
  status          text NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','paid')),
  paid_at         timestamptz,
  memo            text,
  created_at      timestamptz DEFAULT now()
);

-- ── 알림 ──────────────────────────────────────────────────────
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type            text NOT NULL,       -- 'price_high', 'payment_due', 'rfq_bid'
  priority        text NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('urgent','important','normal')),
  title           text NOT NULL,
  message         text NOT NULL,
  action_link     text,
  action_label    text,
  is_read         boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- ── 누적 절약 통계 (월별) ──────────────────────────────────────
CREATE TABLE savings_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  month           text NOT NULL,       -- "2026-04"
  total_saving    integer DEFAULT 0,
  order_count     integer DEFAULT 0,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(tenant_id, month)
);

-- ── 가격 히스토리 (AI 개인화 기반 데이터) ────────────────────
-- import / rfq 요청 / 주문 등 가격이 확인될 때마다 누적.
-- 이후 AI가 시장 평균 대신 "이 식당의 실 구매가 히스토리"로 판단하는 재료.
CREATE TABLE price_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  ingredient_name text NOT NULL,        -- raw_name fallback 조회용
  barcode         text,                 -- SKU 1순위 조회 키
  price           integer NOT NULL,
  unit            text,
  supplier_name   text,
  source          text NOT NULL,        -- 'import' | 'rfq_request' | 'order' | 'manual'
  source_ref_id   uuid,                 -- 연결된 엔티티 id (선택)
  created_at      timestamptz DEFAULT now()
);

-- 기존 DB 마이그레이션용
-- ALTER TABLE price_history ADD COLUMN IF NOT EXISTS barcode text;

CREATE INDEX idx_price_history_barcode
  ON price_history(tenant_id, barcode, created_at DESC) WHERE barcode IS NOT NULL;

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON price_history FOR ALL USING (auth.role() = 'authenticated');

-- ── Today 이벤트 로그 (행동 유도 측정용) ──────────────────────
-- 최소 세 가지 이벤트만 기록:
--   today_enter        — 페이지 진입
--   primary_card_click — 메인 카드 버튼 눌림 (의도 시점)
--   action_complete    — 서버가 액션 성공 반환 (완료 시점)
-- time_to_action_ms / exit_without_action / sessions_per_day 는 이 세 이벤트로 다 유도 가능.
CREATE TABLE today_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id           text NOT NULL,
  event_type           text NOT NULL CHECK (event_type IN ('today_enter','primary_card_click','action_complete')),
  decision_type        text CHECK (decision_type IS NULL OR decision_type IN ('SWITCH','KEEP','REVIEW')),
  sku_precision        text CHECK (sku_precision IS NULL OR sku_precision IN ('exact','grouped','branded','name_only')),
  has_conflict         boolean,
  shown_pressure_type  text CHECK (shown_pressure_type IS NULL OR shown_pressure_type IN ('loss','time','none')),
  action_kind          text CHECK (action_kind IS NULL OR action_kind IN ('payment','rfq','sku')),
  time_to_action_ms    integer,
  -- 안정화 레이어: 이 진입에 어떤 개인화가 적용됐는지 기록
  personalization_applied boolean,
  personalization_type    text CHECK (personalization_type IS NULL OR personalization_type IN ('loss_pref','time_pref','dampened','simple','none')),
  created_at           timestamptz DEFAULT now()
);

-- 기존 DB 마이그레이션용
-- ALTER TABLE today_events ADD COLUMN IF NOT EXISTS personalization_applied boolean;
-- ALTER TABLE today_events ADD COLUMN IF NOT EXISTS personalization_type text;

ALTER TABLE today_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON today_events FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX idx_today_events_tenant ON today_events(tenant_id, created_at DESC);
CREATE INDEX idx_today_events_session    ON today_events(session_id);

-- 분석 쿼리 예시 (참고용):
--   sessions_per_day:
--     SELECT date_trunc('day', created_at) AS d, COUNT(DISTINCT session_id)
--     FROM today_events WHERE event_type='today_enter' GROUP BY d;
--   actions_per_day:
--     SELECT date_trunc('day', created_at) AS d, action_kind, COUNT(*)
--     FROM today_events WHERE event_type='action_complete' GROUP BY d, action_kind;
--   exit_without_action_rate:
--     WITH s AS (SELECT session_id FROM today_events WHERE event_type='today_enter'),
--          a AS (SELECT DISTINCT session_id FROM today_events WHERE event_type='action_complete')
--     SELECT 1 - (SELECT COUNT(*) FROM a)::float / NULLIF((SELECT COUNT(*) FROM s),0);
--   p50 time_to_action:
--     SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY time_to_action_ms)
--     FROM today_events WHERE event_type='action_complete' AND time_to_action_ms IS NOT NULL;

-- ── AI 결정 로그 (식당 전체 성향 학습용) ──────────────────────
-- 사용자가 AI 판단에 어떻게 반응했는지 기록.
-- 이 데이터로 getRestaurantBehaviorProfile 이 switch_preference / auto_accept_rate / risk_tolerance 를 계산.
CREATE TABLE ai_decision_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  ingredient_name  text NOT NULL,
  ai_decision      text NOT NULL CHECK (ai_decision IN ('KEEP','SWITCH')),
  user_action      text NOT NULL CHECK (user_action IN ('KEEP','SWITCH','CANCEL')),
  confidence       real NOT NULL,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE ai_decision_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON ai_decision_logs FOR ALL USING (auth.role() = 'authenticated');

-- ── 인덱스 ────────────────────────────────────────────────────
CREATE INDEX idx_price_history_lookup
  ON price_history(tenant_id, ingredient_name, created_at DESC);

CREATE INDEX idx_ai_decision_logs_restaurant
  ON ai_decision_logs(tenant_id, created_at DESC);

CREATE INDEX idx_rfq_requests_tenant ON rfq_requests(tenant_id, status);
CREATE INDEX idx_rfq_bids_rfq_id         ON rfq_bids(rfq_id);
CREATE INDEX idx_orders_buyer_tenant      ON orders(buyer_tenant_id, status);
CREATE INDEX idx_payments_payer_tenant    ON payments_outgoing(payer_tenant_id, due_date);
CREATE INDEX idx_notifications_tenant     ON notifications(tenant_id, is_read, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE restaurants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_bids           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_outgoing  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_stats      ENABLE ROW LEVEL SECURITY;

-- 개발 단계: 인증된 사용자 전체 허용 (추후 tenant_id 기반으로 강화)
CREATE POLICY "auth_all" ON restaurants       FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON ingredients       FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON fixed_costs       FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON suppliers         FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON rfq_requests      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON rfq_bids          FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON orders            FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON payments_outgoing FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON notifications     FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON savings_stats     FOR ALL USING (auth.role() = 'authenticated');

-- ── order_items (단가 추적 — 개발 문서 필수 요구) ─────────────
-- orders 테이블이 품목 단위 추적을 지원
CREATE TABLE order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity     integer NOT NULL,
  unit         text DEFAULT 'kg',
  unit_price   integer NOT NULL,    -- 실제 성사 단가
  prev_price   integer,             -- 이전 구매 단가 (절약 계산 기준)
  saving       integer DEFAULT 0,   -- (prev_price - unit_price) * quantity
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON order_items FOR ALL USING (auth.role() = 'authenticated');

-- upsert_savings_stat RPC (절약 통계 누적)
CREATE OR REPLACE FUNCTION upsert_savings_stat(
  p_tenant_id uuid,
  p_month         text,
  p_saving        integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO savings_stats (tenant_id, month, total_saving, order_count)
  VALUES (p_tenant_id, p_month, p_saving, 1)
  ON CONFLICT (tenant_id, month)
  DO UPDATE SET
    total_saving = savings_stats.total_saving + EXCLUDED.total_saving,
    order_count  = savings_stats.order_count  + 1,
    updated_at   = now();
END;
$$;
