-- 식자재 가격·단위 이력 RLS 정책 복구
--
-- [배경]
-- 20260518120000_create_ingredient_price_history.sql 은 한 파일 안에서
--   CREATE TABLE → ✅ 적용됨
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY → ✅ 적용됨
--   CREATE POLICY "ingredient_price_history_tenant" → ❌ 적용 안 됨
-- 이 상태로 남아 있었다. (마이그레이션 부분 적용)
--
-- ingredient_unit_history 는 운영 DB 에만 있고 마이그레이션 파일 자체가 없다.
-- 역시 RLS 는 켜져 있고 정책은 0개다.
--
-- [결과]
-- RLS ON + 정책 0개 = 사용자 세션에서 INSERT/SELECT 가 무조건 막힌다.
-- createIngredient() 의 insertIngredientPriceHistory / insertIngredientUnitHistory 가
-- error 를 읽지 않고 버리기 때문에 화면에는 아무 오류도 안 뜨고,
-- 설정>식자재의 「최근 가격 변동」이 영원히 0 으로 남는다.
--
-- 2026-09-09 실측:
--   ingredients 저장 ✅ 1행  /  ingredient_price_history 0행  /  ingredient_unit_history 0행
--
-- [이 파일이 하는 일]
-- 다른 테이블(ingredients.tenant_isolation, invoice_suppliers_tenant 등)과 동일한
-- tenant 격리 정책을 두 이력 테이블에 추가한다. 새 컬럼·새 테이블·데이터 변경 없음.
--
-- 멱등하다. 이미 있으면 건너뛴다.

-- ── ingredient_price_history ──────────────────────────────────────────
ALTER TABLE public.ingredient_price_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'ingredient_price_history'
       AND policyname = 'ingredient_price_history_tenant'
  ) THEN
    CREATE POLICY "ingredient_price_history_tenant"
      ON public.ingredient_price_history FOR ALL
      USING (tenant_id = get_my_tenant_id())
      WITH CHECK (tenant_id = get_my_tenant_id());
  END IF;
END $$;

-- ── ingredient_unit_history ───────────────────────────────────────────
-- 운영에만 있고 파일이 없던 테이블. 구조를 여기 기록해 둔다(재생성 아님).
--   id uuid PK / tenant_id uuid / ingredient_id uuid FK→ingredients(id)
--   unit text / effective_from date / created_at timestamptz
ALTER TABLE public.ingredient_unit_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'ingredient_unit_history'
       AND policyname = 'ingredient_unit_history_tenant'
  ) THEN
    CREATE POLICY "ingredient_unit_history_tenant"
      ON public.ingredient_unit_history FOR ALL
      USING (tenant_id = get_my_tenant_id())
      WITH CHECK (tenant_id = get_my_tenant_id());
  END IF;
END $$;

-- ── 확인용 (실행 후 이 두 줄이 각각 1을 돌려주면 성공) ────────────────
-- select count(*) from pg_policies
--  where schemaname='public' and tablename='ingredient_price_history';
-- select count(*) from pg_policies
--  where schemaname='public' and tablename='ingredient_unit_history';
