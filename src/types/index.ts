// ============================================================
// 식당OS 핵심 타입
// ============================================================

export interface Restaurant {
  id:         string
  name:       string
  region:     string | null
  owner_name: string | null
}

export interface Ingredient {
  id:             string
  tenant_id:      string
  name:           string               // raw_name — 기존 필드, 절대 삭제 금지
  category:       string | null
  unit:           string
  current_price:  number | null
  supplier_name:  string | null
  // ── SKU 레이어 (선택) ──
  parsed_name:    string | null
  brand:          string | null
  barcode:        string | null
  manufacturer:   string | null
}

// ── 발주요청 ──────────────────────────────────────────────────

export type RfqStatus = 'draft' | 'open' | 'closed' | 'ordered' | 'cancelled'

export interface RfqRequest {
  id:             string
  tenant_id:      string
  ingredient_id:  string | null
  product_name:   string
  quantity:       number
  unit:           string
  current_price:  number | null   // 현재 구매가 (비교 기준)
  target_price:   number | null
  request_note:   string | null
  deadline:       string | null
  region:         string | null
  status:         RfqStatus
  closed_reason:  string | null
  created_at:     string
}

export interface RfqBid {
  id:             string
  rfq_id:         string
  supplier_id:    string | null
  supplier_name:  string
  price:          number          // 단가
  delivery_days:  number | null
  note:           string | null
  status:         'submitted' | 'accepted' | 'rejected'
  created_at:     string
  // 계산값
  saving_amount?: number          // (current_price - price) × quantity
  saving_pct?:    number          // 절약 %
}

// ── 발주/지급 ─────────────────────────────────────────────────

export interface Order {
  id:            string
  buyer_tenant_id: string
  rfq_id:        string | null
  bid_id:        string | null
  counterparty_name: string  // payments 테이블 컬럼명 (supplier_name 아님)
  product_name:  string
  quantity:      number
  unit:          string
  unit_price:    number
  total_amount:  number
  saving_amount: number
  status:        'confirmed' | 'completed' | 'cancelled'
  created_at:    string
}

export interface PaymentOutgoing {
  id:            string
  payer_tenant_id: string
  order_id:      string | null
  counterparty_name: string  // payments 테이블 컬럼명 (supplier_name 아님)
  amount:        number
  due_date:      string
  status:        'planned' | 'paid'
  paid_at:       string | null
  memo:          string | null
}

// ── 알림 ──────────────────────────────────────────────────────

export type NotificationPriority = 'urgent' | 'important' | 'normal'

export interface Notification {
  id:           string
  type:         string
  priority:     NotificationPriority
  title:        string
  message:      string
  action_link:  string | null
  action_label: string | null
  is_read:      boolean
  created_at:   string
}

// ── 오늘운영 데이터 ───────────────────────────────────────────

export interface TodayDashboard {
  // 돈 흐름
  payment_due_3days:  number   // 3일 내 나갈 돈
  payment_total:      number   // 이번 달 지급 예정 합계
  payment_urgent:     PaymentOutgoing[]

  // 절약 기회 (아직 비교 안 해본 식자재)
  saving_opportunities: SavingOpportunity[]

  // 이번 달 누적 절약
  monthly_saving: number

  // 알림
  notifications: Notification[]

  // 진행중 발주요청
  open_rfqs: number

  // 온보딩 상태 판단용
  ingredient_count:    number   // 입력된 식자재 수
  ingredient_priced:   number   // 현재가 입력된 식자재 수
  fixed_cost_count:    number
  rfq_total:           number   // 지금까지 만든 발주요청 총수

  // 납품 대기 주문 (status='confirmed')
  pending_deliveries: {
    order_id:      string
    rfq_id:        string | null
    counterparty_name: string  // payments 테이블 컬럼명 (supplier_name 아님)
    product_name:  string
    quantity:      number
    unit:          string
    unit_price:    number
    total_amount:  number
    saving_amount: number
    ordered_at:    string
    expected_date: string | null
  }[]

  // 전체 누적 절약액 + 완료 횟수
  total_saving_ever: number
  total_orders_ever: number

  // 사장 성향 프로파일 — AI 개인화 (데이터 부족 시 중립값)
  behavior_profile: {
    switch_preference: number
    auto_accept_rate:  number
    risk_tolerance:    number
    sample_size:       number
    // pressure 반응 메트릭 (today_events 기반)
    loss_conversion_rate:  number
    time_conversion_rate:  number
    avg_time_to_action_ms: number
    exit_rate:             number
    preferred_pressure:    'loss' | 'time' | 'none'
    pressure_sample_size:  number
  }
}

export interface SavingOpportunity {
  ingredient_id:   string
  ingredient_name: string           // raw_name
  unit:            string
  current_price:   number
  supplier_name:   string | null
  personal_history?: PricePoint[]   // 개인화 AI 입력용 (선택)
  // ── SKU 레이어 (선택) ──
  barcode?:        string | null
  brand?:          string | null
  parsed_name?:    string | null
  // ── 그룹 레이어 (선택) ──
  possible_duplicate_group_id?: string | null
  group_member_count?: number                    // 같은 그룹의 다른 형제 수
  group_representative_barcode?: string | null   // 그룹 안에 유일한 barcode 일 때만 (충돌 시 null)
  group_barcodes?: string[]                      // 그룹 안에 존재하는 모든 고유 barcode
  has_barcode_conflict?: boolean                 // 그룹 내 barcode 2개 이상
  group_confirmed_same?: boolean                 // 사용자가 "바코드 달라도 같은 상품" 확인함
  merge_candidate?: {                            // 자동/수동 병합 후보 (별도 그룹에 속한 유사 상품)
    id:            string
    name:          string
    brand:         string | null
    counterparty_name: string  // payments 테이블 컬럼명 (supplier_name 아님) | null
  } | null
}

// ── 가격 히스토리 포인트 (AI 개인화 레이어 입력) ──────────────
// price_history 테이블 한 행을 UI/평가 레이어로 전달할 때 쓰는 형태.
// 서버에서 읽어서 그대로 client 에 prop 으로 넘길 수 있게 직렬화 가능.
export interface PricePoint {
  price:          number
  unit:           string | null
  supplier_name:  string | null
  created_at:     string
  source:         string
  barcode?:       string | null   // SKU 정확 조회 결과일 때 채워짐
}

// ── 공통 ──────────────────────────────────────────────────────

export interface ActionResult<T = null> {
  success: boolean
  data?:   T
  error?:  string
}
