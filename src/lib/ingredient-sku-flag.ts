// ============================================================
// 식자재 SKU/그룹 레이어 가용성 플래그
//
// 운영 ingredients 테이블의 실제 컬럼은 11개뿐이다.
//   id, tenant_id, name, unit, current_price, target_price,
//   category, memo, is_active, created_at, updated_at
//
// 코드가 읽고 쓰던 아래 7개 컬럼은 운영 DB 에 존재하지 않는다.
//   barcode, supplier_name, parsed_name, brand, manufacturer,
//   possible_duplicate_group_id, group_confirmed_same_at
//
// 이 컬럼들을 SELECT/INSERT/UPDATE 하면 Postgres 42703 이 나고,
// 식자재 목록·설정>식자재·오늘운영·엑셀 가져오기 화면이 통째로 열리지 않는다.
//
// 그래서 해당 컬럼을 건드리는 조회와 기록을 끊었다. 그 값을 입력받거나
// 보여주던 UI 는 지우지 않고 이 플래그로 렌더만 막는다. 그룹/바코드를
// 기록하는 서버액션도 지우지 않고 이 플래그로 진입만 막는다.
//
// 스키마가 갖춰지면 이 상수를 true 로 되돌리는 것만으로 복구된다.
// ============================================================

export const INGREDIENT_SKU_LAYER_ENABLED: boolean = false

/** SKU/그룹 조작 서버액션이 비활성 상태에서 호출됐을 때 돌려줄 사유. */
export const INGREDIENT_SKU_LAYER_DISABLED_REASON =
  '바코드·중복 상품 묶기 기능은 지금 사용할 수 없어요'
