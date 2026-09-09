-- 관리자 대리 등록 표시용 컬럼
--
-- [배경]
-- 관리자가 거래처(식당) 대신 식자재를 등록하는 기능을 추가한다.
-- 식당 사장님이 나중에 목록을 봤을 때 "내가 넣은 게 아닌데?" 하고 헷갈리지 않도록
-- 어느 행이 대리 등록인지 행 자체에 표시가 있어야 한다.
--
-- admin_logs 에도 기록하지만, 그건 감사용이다.
-- 식자재 목록 화면에서 행마다 admin_logs 를 조회하면 N+1 이 되므로
-- (ARCH-01 전제 7: N+1 금지) ingredients 에 컬럼 하나를 둔다.
--
-- [설계]
-- created_by_admin_id : 대리 등록한 관리자의 users.id. 사장님이 직접 넣었으면 NULL.
--   - 계산값이 아니다(ARCH-01 전제 5 위배 아님). 누가 넣었는지는 사실 기록이다.
--   - FK 는 걸지 않는다. users 행이 지워져도 "관리자가 대신 등록했다"는 사실은 남아야 한다.
--     (admin_logs.admin_id 도 같은 이유로 FK 가 없다)
--   - NULL 허용. 기존 행과 사장님 직접 등록분은 전부 NULL 이다.
--
-- 새 컬럼 추가만 한다. 기존 컬럼 삭제·타입 변경 없음. 데이터 변경 없음.
-- 멱등하다.

ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS created_by_admin_id uuid;

COMMENT ON COLUMN public.ingredients.created_by_admin_id IS
  '관리자가 거래처 대신 등록한 경우 그 관리자의 users.id. 식당이 직접 등록했으면 NULL.';

-- 대리 등록분만 뽑아보는 조회를 위한 부분 인덱스 (NULL 이 대부분이므로 partial)
CREATE INDEX IF NOT EXISTS ingredients_created_by_admin_idx
  ON public.ingredients (created_by_admin_id)
  WHERE created_by_admin_id IS NOT NULL;

-- ── 확인용 ────────────────────────────────────────────────────────────
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema='public' and table_name='ingredients'
--    and column_name='created_by_admin_id';
