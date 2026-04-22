// ============================================================
// AI 판단 레이어
//
// 이 파일은 evaluatePrice() 위에 얹혀지는 상위 레이어다.
// evaluatePrice는 "수치" (high/normal/low/unknown)를 돌려주고,
// aiEvaluatePrice는 "행동"을 돌려준다.
//
// 현재는 규칙 기반 문장 생성 (프롬프트 엔지니어링 이전 스캐폴드).
// 이후 LLM 호출로 교체 가능 — 동일한 AiEvaluation 타입만 유지하면 된다.
// ============================================================

import { evaluatePrice, type PriceEvaluation } from '@/lib/market-reference'
import {
  personalizedEvaluate,
  PERSONAL_MIN_SAMPLES,
  type PersonalEvaluation,
} from '@/lib/personalized-price'
import {
  isAggressive,
  isConservative,
  isFastActor,
  isSlowActor,
  type BehaviorProfile,
} from '@/lib/behavior-profile'
import { skuConfidence, type SkuPrecision } from '@/lib/sku'
import type { PricePoint } from '@/types'

export type Recommendation =
  | 'switch_now'          // 지금 바꿔야 함
  | 'explore'             // 받아볼 만함
  | 'keep'                // 유지
  | 'insufficient_data'   // 판단 불가

// ── 결정 엔진 레이어 (신규) ────────────────────────────────
// 3상 결정 — UI/자동실행 분기에 쓰임
export type Decision = 'KEEP' | 'SWITCH' | 'REVIEW'

// 자동 실행 임계값 (변경 가능 상수)
export const AUTO_READY_MIN_CONFIDENCE      = 0.8
export const AUTO_READY_MIN_SAVING          = 1000   // 단위당 원 — 너무 작은 차이는 자동 실행 안 함
// 확장 규칙 — 개인화 시그널이 있을 때 임계값 낮춤
export const AUTO_READY_RISING_CONFIDENCE   = 0.7    // 상승 추세면 0.7 에서 자동 실행
export const AUTO_READY_REPEAT_CONFIDENCE   = 0.7    // 반복 구매 품목이면 0.7 에서 자동 실행
export const AUTO_READY_REPEAT_MIN_SAMPLES  = 5      // "반복 구매"로 볼 최소 히스토리 수
export const AUTO_READY_REPEAT_MIN_SAVING   = 500    // 반복 구매 케이스의 최소 절약
// 강제 결정 임계값 — REVIEW 를 SWITCH 로 승격
export const FORCE_DECISION_CONFIDENCE      = 0.7

// 성향별 auto_ready 임계 조정 + SKU 정확도 + 속도 반영
//   안정화: 모든 보정의 총합 delta 를 ±AUTO_READY_DELTA_CAP (0.15) 로 제한
//   → 어떤 사용자도 극단 모드로 빠지지 않음
const AUTO_READY_DELTA_CAP = 0.15

function adjustAutoReadyThresholds(
  profile?:      BehaviorProfile,
  skuPrecision?: SkuPrecision,
) {
  // 각 축에서 나오는 delta 를 단순 합산 후 하나로 clamp
  let delta = 0
  if (isAggressive(profile))    delta -= 0.15
  if (isConservative(profile))  delta += 0.05
  if (skuPrecision === 'exact') delta -= 0.05
  if (isFastActor(profile))     delta -= 0.05
  if (isSlowActor(profile))     delta += 0.05

  // ±0.15 cap — extreme 누적 방지
  delta = Math.max(-AUTO_READY_DELTA_CAP, Math.min(AUTO_READY_DELTA_CAP, delta))

  return {
    min_conf:    AUTO_READY_MIN_CONFIDENCE    + delta,
    rising_conf: AUTO_READY_RISING_CONFIDENCE + delta,
    repeat_conf: AUTO_READY_REPEAT_CONFIDENCE + delta,
  }
}

export interface AiEvaluation {
  // ── 기존 레이어 (유지) ────────────────────────────────────
  base:             PriceEvaluation   // 하위 수치 판정 (personal 우선, 없으면 market)
  recommendation:   Recommendation
  headline:         string             // 1줄 판단
  reason:           string             // 숫자 근거 (주 근거)
  action_label:     string             // 버튼 텍스트
  impact_if_kept:   string | null      // 안 바꿨을 때 영향
  confidence_tier:  'high' | 'medium' | 'low'   // (기존 enum 명칭만 변경)

  // ── 결정 엔진 레이어 ──────────────────────────────────────
  decision:             Decision
  confidence:           number       // 0~1
  expected_saving:      number       // 원 — 컨텍스트 있으면 월간, 없으면 단위당
  auto_ready_eligible:  boolean

  // ── 개인화 레이어 (신규) ──────────────────────────────────
  reasoning_source:  'personal' | 'market' | 'none'   // 판단 근거 출처
  reason_secondary:  string | null                     // 보조 근거 (ex: "시장 평균 대비 +18%")
  personal?:         PersonalEvaluation                // 개인 히스토리가 쓰였을 때만
  market_snapshot?:  PriceEvaluation                   // 시장 기준 스냅샷 (개인 사용 시에도 보존)

  // ── SKU 레이어 ──
  sku_precision:     SkuPrecision                      // exact | branded | name_only
}

export interface AiContext {
  monthly_qty?:      number    // 월 추정 사용량 (있으면 영향 계산)
  supplier_name?:    string | null
  personal_history?: PricePoint[]       // 주입 시 개인화 평가 사용 (3건 미만이면 무시)
  behavior_profile?: BehaviorProfile    // 사장 성향 — decision / threshold / 메시지에 반영
  // ── SKU 레이어 ──
  barcode?:          string | null      // 있으면 personal_history 는 이미 SKU 스코프로 조회된 것으로 간주
  brand?:            string | null
  parsed_name?:      string | null
  possible_duplicate_group_id?: string | null         // 같은 상품 그룹 (barcode 없을 때 fallback)
  group_representative_barcode?: string | null        // 그룹 안에 이미 존재하는 barcode (승급 후보)
  // ── 바코드 충돌 상태 ──
  has_barcode_conflict?:  boolean   // 그룹 내 서로 다른 barcode 2개 이상
  group_confirmed_same?:  boolean   // 사용자가 "같은 상품" 확인한 그룹
}

export function aiEvaluatePrice(
  name:     string,
  unit:     string,
  current:  number | null,
  ctx:      AiContext = {},
): AiEvaluation {
  // ── 1. 두 레이어 모두 계산 ──
  //   market 은 항상 계산 — reason_secondary/market_snapshot 에 써서 UI가 양쪽 다 참조 가능
  //   personal 은 충분한 히스토리가 있을 때만
  const market = evaluatePrice(name, unit, current)
  const personal = ctx.personal_history
    ? personalizedEvaluate(current, ctx.personal_history)
    : null

  // ── 2. base 선정 — personal 우선, 없으면 market ──
  const base: PriceEvaluation = personal ?? market
  const reasoning_source: AiEvaluation['reasoning_source'] =
    personal ? 'personal' : market.verdict === 'unknown' ? 'none' : 'market'

  // ── 2-1. SKU 정밀도 (decide/threshold 로 같이 주입) ──
  const sku_precision = skuConfidence({
    name:        name,
    parsed_name: ctx.parsed_name,
    brand:       ctx.brand,
    unit,
    barcode:     ctx.barcode,
    possible_duplicate_group_id: ctx.possible_duplicate_group_id,
  })

  // ── 3. 결정 엔진 — personal + 성향 + SKU + 그룹 승급 후보 + 충돌 보정 ──
  const groupHasExactSibling =
    sku_precision === 'grouped' && !!ctx.group_representative_barcode
  const hasConflict       = !!ctx.has_barcode_conflict
  const confirmedSame     = !!ctx.group_confirmed_same
  const engine = decide(
    base, ctx.behavior_profile, sku_precision,
    groupHasExactSibling, hasConflict, confirmedSame,
  )

  // ── 4. 절약 예상액 ──
  const saving = computeSaving(base, ctx)

  // ── 5. 자동 실행 적격 — 성향별 + SKU 정확도별 임계값 ──
  //   바코드 충돌이 아직 미확인 상태면 자동 실행을 완전 차단 (안전장치)
  const th = adjustAutoReadyThresholds(ctx.behavior_profile, sku_precision)
  const rawEligible =
    engine.decision === 'SWITCH' && (
      // A. 기본 — 고확신 + 의미있는 절약
      (engine.confidence >= th.min_conf &&
       base.saving_per_unit >= AUTO_READY_MIN_SAVING)
      ||
      // B. 상승 추세 — 지금 안 바꾸면 더 오를 상황
      (engine.confidence >= th.rising_conf &&
       !!personal && personal.trend === 'rising')
      ||
      // C. 반복 구매 품목 — 이미 자주 사는 품목이면 임계값 낮춤
      (engine.confidence >= th.repeat_conf &&
       !!personal && personal.sample_size >= AUTO_READY_REPEAT_MIN_SAMPLES &&
       base.saving_per_unit >= AUTO_READY_REPEAT_MIN_SAVING)
    )
  const auto_ready_eligible =
    (hasConflict && !confirmedSame) ? false : rawEligible

  // ── 6. 메시지 생성 (개인/시장/성향 반영) ──
  const legacy = buildLegacyMessage(
    base, market, personal, name, ctx, engine.decision, auto_ready_eligible,
  )

  return {
    base,
    recommendation:  legacy.recommendation,
    headline:        legacy.headline,
    reason:          legacy.reason,
    action_label:    legacy.action_label,
    impact_if_kept:  legacy.impact_if_kept,
    confidence_tier: legacy.confidence_tier,

    decision:            engine.decision,
    confidence:          engine.confidence,
    expected_saving:     saving,
    auto_ready_eligible,

    reasoning_source,
    reason_secondary:    legacy.reason_secondary,
    personal:            personal ?? undefined,
    market_snapshot:     market,

    sku_precision,
  }
}

// 히스토리 최소 건수 (외부 노출용)
export { PERSONAL_MIN_SAMPLES }

// ── 결정 로직 ────────────────────────────────────────────
// SWITCH: 평균 +10% 이상
// KEEP:   ±5% 이내 (쌀 때도 포함)
// REVIEW: 그 사이 (5~10%) — 단 confidence >= 0.7 로 올라가면 SWITCH 로 강제 승격
//   → 목표: "결정 시스템" 이라 REVIEW 를 최소화
function decide(
  ev: PriceEvaluation,
  profile?: BehaviorProfile,
  skuPrecision?: SkuPrecision,
  groupHasExactSibling?: boolean,
  hasBarcodeConflict?: boolean,
  groupConfirmedSame?: boolean,
): { decision: Decision; confidence: number } {
  if (ev.verdict === 'unknown') {
    return { decision: 'REVIEW', confidence: 0.25 }
  }
  const d = ev.diff_pct   // 양수 = 비쌈
  let decision: Decision
  let conf: number

  if (d >= 10) {
    decision = 'SWITCH'
    conf = clamp(0.65 + (d - 10) / 50, 0.65, 0.95)
  } else if (d >= 5) {
    // 경계선 — 일단 REVIEW 로 시작하지만 아래 가중치로 승격 가능
    decision = 'REVIEW'
    conf = clamp(0.55 + (d - 5) / 15, 0.55, 0.68)
  } else {
    decision = 'KEEP'
    const closeness = 1 - Math.abs(d) / 5      // d=0 → 1, |d|=5 → 0
    conf = clamp(0.85 + closeness * 0.1, 0.85, 0.95)
  }

  // ── 개인 히스토리 가중치 ──
  if (isPersonalEvaluation(ev)) {
    // SWITCH 보정 — 기존 유지
    if (decision === 'SWITCH' && ev.trend === 'rising') {
      conf = clamp(conf + 0.05, 0.65, 0.97)
    }
    if (decision === 'SWITCH' && ev.supplier_stability >= 0.66) {
      conf = clamp(conf + 0.03, 0.65, 0.97)
    }
    // KEEP 보정 — 하락 추세면 유지 확신도 상승
    if (decision === 'KEEP' && ev.trend === 'falling') {
      conf = clamp(conf + 0.03, 0.85, 0.97)
    }
    // REVIEW 보정 — 개인 시그널이 강하면 확신도를 0.7 넘게 밀어 SWITCH 로 승격
    if (decision === 'REVIEW' && ev.trend === 'rising') {
      conf = clamp(conf + 0.15, 0.55, 0.88)
    }
    if (decision === 'REVIEW' && ev.supplier_stability >= 0.66) {
      conf = clamp(conf + 0.05, 0.55, 0.88)
    }
    if (decision === 'REVIEW' && ev.sample_size >= 5) {
      conf = clamp(conf + 0.03, 0.55, 0.88)
    }

    // 반복 학습 — 사용자가 과거에 이 품목을 SWITCH 한 이력 (source='rfq_request' 누적)
    if (ev.recent_switch_count >= 3) {
      if (decision === 'SWITCH') conf = clamp(conf + 0.05, 0.65, 0.97)
      if (decision === 'REVIEW') conf = clamp(conf + 0.08, 0.55, 0.88)
    }
    // 반복 주문 — 실제 구매 반복 = 이 품목은 중요한 고정 소모재
    if (ev.recent_order_count >= 3 && decision !== 'KEEP') {
      conf = clamp(conf + 0.03, 0.55, 0.97)
    }
  }

  // ── 사장 성향 가중치 ──
  //   공격형: SWITCH 우대 / KEEP 다이렉트 감쇠 / REVIEW 를 SWITCH 방향으로 밀기
  //   보수형: KEEP 우대 / SWITCH 확신 감쇠
  if (profile && profile.sample_size >= 3) {
    const rt = profile.risk_tolerance
    const sp = profile.switch_preference

    if (decision === 'SWITCH') {
      if (sp >= 0.6) conf = clamp(conf + 0.05, 0.65, 0.97)
      if (rt <= 0.35) conf = clamp(conf - 0.03, 0.60, 0.97)
    }
    if (decision === 'KEEP') {
      if (rt <= 0.35) conf = clamp(conf + 0.03, 0.85, 0.97)
    }
    if (decision === 'REVIEW') {
      if (sp >= 0.6) conf = clamp(conf + 0.05, 0.55, 0.90)   // 승격 가능성 ↑
      if (rt <= 0.35) conf = clamp(conf - 0.03, 0.50, 0.80)  // 보수형이면 REVIEW 유지
    }
  }

  // ── SKU 정밀도 가중치 ──
  // 같은 SKU 기준 비교 = 더 확신할 수 있음
  // 우선순위 = exact(+0.02) > grouped(+0.015) > branded(+0.01) > name_only(0)
  if (skuPrecision === 'exact') {
    conf = clamp(conf + 0.02, 0.25, 0.97)
  } else if (skuPrecision === 'grouped') {
    conf = clamp(conf + 0.015, 0.25, 0.97)
    // 같은 그룹에 이미 barcode 가진 형제가 있음 → 데이터 품질이 한 단계 높음
    if (groupHasExactSibling) {
      conf = clamp(conf + 0.01, 0.25, 0.97)
    }
  } else if (skuPrecision === 'branded') {
    conf = clamp(conf + 0.01, 0.25, 0.97)
  }

  // ── 바코드 충돌 보정 ──
  // 미확인 충돌 → 신중하게 (-0.03)
  // 사용자가 "같은 상품" 확정 → 신호 강화 (+0.01)
  if (hasBarcodeConflict && !groupConfirmedSame) {
    conf = clamp(conf - 0.03, 0.25, 0.97)
  } else if (hasBarcodeConflict && groupConfirmedSame) {
    conf = clamp(conf + 0.01, 0.25, 0.97)
  }

  // ── 강제 결정: REVIEW 는 confidence < 0.7 일 때만 허용 ──
  if (decision === 'REVIEW' && conf >= FORCE_DECISION_CONFIDENCE) {
    decision = 'SWITCH'
  }

  return { decision, confidence: round2(conf) }
}

function isPersonalEvaluation(ev: PriceEvaluation): ev is PersonalEvaluation {
  return 'trend' in ev && 'supplier_stability' in ev
}

function computeSaving(ev: PriceEvaluation, ctx: AiContext): number {
  if (ev.saving_per_unit <= 0) return 0
  if (ctx.monthly_qty && ctx.monthly_qty > 0) {
    return ev.saving_per_unit * ctx.monthly_qty
  }
  return ev.saving_per_unit
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── 기존 메시지 레이어 (분리만, 내용 유지 + 개인/시장 이중 근거 추가) ──
interface LegacyMessage {
  recommendation:   Recommendation
  headline:         string
  reason:           string                   // 주 근거 — personal 우선
  reason_secondary: string | null            // 보조 근거 — personal 사용 시 시장 평균 병기
  action_label:     string
  impact_if_kept:   string | null
  confidence_tier:  'high' | 'medium' | 'low'
}

function buildLegacyMessage(
  base:     PriceEvaluation,
  market:   PriceEvaluation,                 // 시장 평균 스냅샷 (항상 계산됨)
  personal: PersonalEvaluation | null,
  name:     string,
  ctx:      AiContext,
  decision: Decision,
  autoReadyEligible: boolean,                // 성향별 임계 반영된 자동 실행 여부
): LegacyMessage {
  const isPersonal  = !!personal
  const aggressive  = isAggressive(ctx.behavior_profile)
  const conservative = isConservative(ctx.behavior_profile)

  // 보조 근거 — 개인 기준을 썼으면 시장 평균을 병기
  const reason_secondary = isPersonal && market.verdict !== 'unknown'
    ? `(시장 평균 대비 ${market.diff_pct >= 0 ? '+' : ''}${market.diff_pct}%)`
    : null

  // 기준 라벨 — 문장 안에서 "평균" 대신 "최근 거래" 로 바꿀 때 사용
  const refLabel = isPersonal
    ? `최근 ${personal!.sample_size}건 거래`
    : '평균'

  // unknown — 판단 불가 (개인/시장 모두 없음)
  if (base.verdict === 'unknown') {
    return {
      recommendation: 'insufficient_data',
      headline:       `${name}, 비교 데이터가 아직 없어요`,
      reason:         '다른 거래처 조건을 받아보면 바로 판단해드려요',
      reason_secondary: null,
      action_label:   '다른 견적 받아보기',
      impact_if_kept: null,
      confidence_tier: 'low',
    }
  }

  // SWITCH 경로 — 성향에 따라 어조 전환
  if (decision === 'SWITCH') {
    const strong         = base.diff_pct > 20
    const monthlyImpact  = ctx.monthly_qty ? base.saving_per_unit * ctx.monthly_qty : 0
    const supplierSuffix = ctx.supplier_name ? ` · 현재 ${ctx.supplier_name}` : ''
    const trendSuffix    = isPersonal && personal!.trend === 'rising'
      ? ' · 최근 가격 상승 중'
      : ''

    // 성향별 headline + action_label
    let headline: string
    let action_label: string
    if (aggressive && autoReadyEligible) {
      headline     = '지금 바꾸는 게 맞습니다. 자동으로 진행합니다'
      action_label = '바로 진행'
    } else if (aggressive) {
      headline     = '지금 바꾸는 게 맞습니다'
      action_label = '바로 진행'
    } else if (conservative) {
      headline     = '조건이 좋아 보입니다. 확인 후 진행하시겠어요?'
      action_label = '확인하고 진행'
    } else {
      headline     = '지금 바꾸는 게 맞습니다'
      action_label = '바로 진행'
    }

    return {
      recommendation: 'switch_now',
      headline,
      reason:
        `${name}, ${refLabel}보다 ${base.diff_pct}% 비싸요 · ` +
        `단위당 약 ${base.saving_per_unit.toLocaleString()}원 절약 여지${supplierSuffix}${trendSuffix}`,
      reason_secondary,
      action_label,
      impact_if_kept: monthlyImpact > 0
        ? `지금 조건 유지 시 월 약 ${monthlyImpact.toLocaleString()}원 더 나가요`
        : null,
      confidence_tier: strong ? 'high' : 'medium',
    }
  }

  // REVIEW 경로 — confidence < 0.7 로 떨어진 경계 케이스에만 허용됨
  if (decision === 'REVIEW') {
    return {
      recommendation: 'explore',
      headline:       '판단하기엔 데이터가 부족합니다',
      reason:         `${name}, ${refLabel}보다 ${base.diff_pct}% 높지만 확신이 낮아요 · 견적 1건만 받아보면 바로 결정됩니다`,
      reason_secondary,
      action_label:   '견적 받아 확정하기',
      impact_if_kept: null,
      confidence_tier: 'low',
    }
  }

  // KEEP 경로 — 성향에 따라 어조 전환
  const keepHeadline = conservative
    ? '안정적인 조건입니다. 유지하는 게 맞습니다'
    : '이 거래 유지하는 게 맞습니다'

  if (base.verdict === 'low') {
    return {
      recommendation: 'keep',
      headline:       keepHeadline,
      reason:         `${name}, ${refLabel}보다 ${Math.abs(base.diff_pct)}% 싸요 · 지금 조건 우수`,
      reason_secondary,
      action_label:   '이대로 유지',
      impact_if_kept: null,
      confidence_tier: 'high',
    }
  }
  return {
    recommendation: 'keep',
    headline:       keepHeadline,
    reason:         `${name}, ${refLabel} 대비 ${base.diff_pct >= 0 ? '+' : ''}${base.diff_pct}% — 적정 범위 안`,
    reason_secondary,
    action_label:   '이대로 유지',
    impact_if_kept: null,
    confidence_tier: 'high',
  }
}

// ── 결정 표시용 헬퍼 (UI에서 쓰기 좋게) ──────────────────
// 확정적 표현만 — "괜찮습니다"/"만해요" 같은 애매한 표현 금지
export function decisionLabel(dec: Decision): string {
  switch (dec) {
    case 'SWITCH': return '지금 바꾸는 게 맞습니다'
    case 'KEEP':   return '이 거래 유지하는 게 맞습니다'
    case 'REVIEW': return '판단하기엔 데이터가 부족합니다'
  }
}

export function decisionTone(dec: Decision): { bg: string; fg: string; short: string } {
  switch (dec) {
    case 'SWITCH': return { bg: '#FEF2F2', fg: '#B91C1C', short: 'SWITCH' }
    case 'KEEP':   return { bg: '#F0FDF4', fg: '#15803D', short: 'KEEP'   }
    case 'REVIEW': return { bg: '#FFFBEB', fg: '#B45309', short: 'REVIEW' }
  }
}

// UI 톤 매핑 — recommendation → 색상
export function toneOf(rec: Recommendation): {
  bg: string
  fg: string
  label: string
} {
  switch (rec) {
    case 'switch_now':        return { bg: '#FEF2F2', fg: '#B91C1C', label: 'AI · 지금 바꿔요' }
    case 'explore':           return { bg: '#FFFBEB', fg: '#B45309', label: 'AI · 검토해봐요' }
    case 'keep':              return { bg: '#F0FDF4', fg: '#15803D', label: 'AI · 유지하세요' }
    case 'insufficient_data': return { bg: '#F3F4F6', fg: '#374151', label: 'AI · 데이터 필요' }
  }
}
