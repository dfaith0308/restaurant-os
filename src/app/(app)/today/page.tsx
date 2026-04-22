import { getTodayDashboard } from '@/actions/today'
import { formatKRW } from '@/lib/utils'
import TodayDate from '@/components/today/TodayDate'
import { aiEvaluatePrice } from '@/lib/ai-evaluate'
import type { SavingOpportunity, TodayDashboard, PaymentOutgoing, Notification } from '@/types'
import TodayPaymentCard from '@/components/today/TodayPaymentCard'
import TodayLoopCard from '@/components/today/TodayLoopCard'
import TodayRfqCard from '@/components/today/TodayRfqCard'
import TodayNotifications from '@/components/today/TodayNotifications'
import TodayStrip from '@/components/today/TodayStrip'
import TodayImportCard from '@/components/today/TodayImportCard'
import TodayTracker from '@/components/today/TodayTracker'
import TodayDeliveryCard from '@/components/today/TodayDeliveryCard'
import type {
  PressureType,
  DecisionType,
  SkuPrecisionStr,
  PersonalizationType,
} from '@/actions/today-events'
import { aiEvaluatePrice as aiEval } from '@/lib/ai-evaluate'
import {
  isSimpleModeCandidate,
  shouldDampenPressure,
  preferredPressureOf,
} from '@/lib/behavior-profile'

// MVP: restaurant_id를 세션/쿠키에서 가져오는 구조 (임시 상수)
const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? ''

export default async function TodayPage() {
  const result = await getTodayDashboard(RESTAURANT_ID).catch(() => ({
    success: false as const,
    data: undefined,
  }))

  const d = result.data

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <Header
        monthlySaving={d?.monthly_saving ?? 0}
        rfqTotal={d?.rfq_total ?? 0}
        pendingCount={d?.pending_deliveries.length ?? 0}
        openRfqs={d?.open_rfqs ?? 0}
        totalSavingEver={d?.total_saving_ever ?? 0}
        totalOrdersEver={d?.total_orders_ever ?? 0}
      />

      {!d ? <FatalError /> : <MainAndStrip d={d} />}
    </main>
  )
}

// ── 메인 카드 선택 + 하단 strip ──────────────────────────────

function MainAndStrip({ d }: { d: TodayDashboard }) {
  const primary = pickPrimaryAction(d)
  const strip   = buildStrip(d, primary.kind)
  const tracker = buildTrackerContext(primary, d)

  // 메인 카드가 loop/saving 계열이고 해당 식자재가 SKU 정보 (barcode/brand) 없음 →
  // ImportCard 를 "정확도 올리기" 강조 버전으로 메인 바로 아래 노출
  const activeIngredient = getPrimaryIngredient(primary)
  const needsSku = !!activeIngredient
    && !activeIngredient.barcode
    && !activeIngredient.brand

  // 자동 수집 진입점 노출 규칙:
  //   - 완전 신규(loop_input) / SKU 부족 → 메인 바로 아래 강조 카드
  //   - 그 외엔 "1가지 행동" 원칙상 숨김. quiet 상태일 때만 보조로 노출.
  const showImportPrimary   = primary.kind === 'loop_input' || needsSku
  const showImportSecondary = !showImportPrimary
    && primary.kind === 'quiet'
    && d.ingredient_count > 0

  // "오늘 처리할 1가지" 앵커 — quiet / loop_input 외의 실질적 행동 카드에만 표시
  const showTodoAnchor = primary.kind !== 'quiet' && primary.kind !== 'loop_input'

  return (
    <div>
      <TodayTracker
        restaurantId={RESTAURANT_ID}
        pressureType={tracker.pressureType}
        decisionType={tracker.decisionType}
        skuPrecision={tracker.skuPrecision}
        hasConflict={tracker.hasConflict}
        personalizationApplied={tracker.personalizationApplied}
        personalizationType={tracker.personalizationType}
      />

      {showTodoAnchor && (
        <div style={{
          fontSize: 12, color: '#6b7280', fontWeight: 700,
          marginBottom: 8, letterSpacing: '-0.01em',
        }}>
          지금 할 일
        </div>
      )}

      <MainCard
        primary={primary}
        behaviorProfile={d.behavior_profile}
        paymentTotal={d.payment_total}
        paymentThisWeek={d.payment_due_3days}
        monthlySaving={d.monthly_saving}
        pendingCount={d.pending_deliveries.length}
        openRfqs={d.open_rfqs}
      />

      {showImportPrimary && (
        <div style={{ marginTop: 12 }}>
          <TodayImportCard restaurantId={RESTAURANT_ID} emphasize={needsSku} />
        </div>
      )}

      <TodayStrip chips={strip} />

      {showImportSecondary && (
        <div style={{ marginTop: 12 }}>
          <TodayImportCard restaurantId={RESTAURANT_ID} />
        </div>
      )}
    </div>
  )
}

// MainCard 에 쓰이는 식자재(있으면)를 추출 — needsSku 판단용
function getPrimaryIngredient(p: PrimaryAction):
  (SavingOpportunity | null) {
  switch (p.kind) {
    case 'saving_high':   return p.opportunity
    case 'loop_priced':
    case 'loop_no_price': return p.ingredient
    default:              return null
  }
}

// today_enter 이벤트에 같이 실을 컨텍스트
function buildTrackerContext(p: PrimaryAction, d: TodayDashboard): {
  pressureType:           PressureType
  decisionType:           DecisionType | null
  skuPrecision:           SkuPrecisionStr | null
  hasConflict:            boolean
  personalizationApplied: boolean
  personalizationType:    PersonalizationType
} {
  // 개인화 유형 판정 — 우선순위: simple > dampened > loss_pref / time_pref > none
  const pt: PersonalizationType =
    isSimpleModeCandidate(d.behavior_profile)  ? 'simple'    :
    shouldDampenPressure(d.behavior_profile)   ? 'dampened'  :
    preferredPressureOf(d.behavior_profile) === 'loss' ? 'loss_pref' :
    preferredPressureOf(d.behavior_profile) === 'time' ? 'time_pref' :
                                                         'none'
  const personalizationApplied = pt !== 'none'

  // 압박 유형 매핑
  let pressureType: PressureType = 'none'
  if (p.kind === 'payment')           pressureType = 'time'
  else if (p.kind === 'pending_delivery') pressureType = 'time'
  else if (p.kind === 'rfq_progress') pressureType = 'time'
  else if (p.kind === 'saving_high')  pressureType = 'loss'

  // simple 모드면 실질 표시되는 압박이 없으므로 'none' 으로 기록
  if (pt === 'simple') pressureType = 'none'

  // AI 평가에서 결정/정밀도/충돌 뽑기 (메인 카드가 식자재 기반일 때만)
  const ing = getPrimaryIngredient(p)
  if (!ing) return {
    pressureType, decisionType: null, skuPrecision: null, hasConflict: false,
    personalizationApplied, personalizationType: pt,
  }

  const ai = aiEval(ing.ingredient_name, ing.unit, ing.current_price, {
    supplier_name:                ing.supplier_name,
    personal_history:             ing.personal_history,
    behavior_profile:             d.behavior_profile,
    barcode:                      ing.barcode ?? null,
    brand:                        ing.brand ?? null,
    parsed_name:                  ing.parsed_name ?? null,
    possible_duplicate_group_id:  ing.possible_duplicate_group_id ?? null,
    group_representative_barcode: ing.group_representative_barcode ?? null,
    has_barcode_conflict:         ing.has_barcode_conflict ?? false,
    group_confirmed_same:         ing.group_confirmed_same ?? false,
  })
  return {
    pressureType,
    decisionType:           ai.decision,
    skuPrecision:           ai.sku_precision,
    hasConflict:            ing.has_barcode_conflict ?? false,
    personalizationApplied,
    personalizationType:    pt,
  }
}

// ── 우선순위 선택 로직 ───────────────────────────────────────
// 1. 지급 임박  2. 납품대기  3. RFQ 진행중  4. 절약 기회  5. 알림  6. 루프

type PrimaryAction =
  | { kind: 'payment',          urgent: PaymentOutgoing[]; totalDue: number }
  | { kind: 'pending_delivery', delivery: TodayDashboard['pending_deliveries'][0]; otherCount: number }
  | { kind: 'saving_high',      opportunity: SavingOpportunity; saving_per_unit: number }
  | { kind: 'rfq_progress',     openCount: number }
  | { kind: 'rfq_no_price' }
  | { kind: 'alert',            notifications: Notification[] }
  | { kind: 'loop_input' }
  | { kind: 'loop_no_price',    ingredient: SavingOpportunity }
  | { kind: 'loop_priced',      ingredient: SavingOpportunity }
  | { kind: 'quiet' }

function pickPrimaryAction(d: TodayDashboard): PrimaryAction {
  // 1. 지급 임박
  if (d.payment_urgent.length > 0) {
    return { kind: 'payment', urgent: d.payment_urgent, totalDue: d.payment_due_3days }
  }

  // 2. 납품 대기 (주문 확정됐는데 받았는지 확인 안 된 것)
  if (d.pending_deliveries.length > 0) {
    return {
      kind:       'pending_delivery',
      delivery:   d.pending_deliveries[0],
      otherCount: d.pending_deliveries.length - 1,
    }
  }

  // 3. RFQ 진행중 — saving보다 우선 (초기 사용자 포함)
  if (d.open_rfqs > 0) {
    return { kind: 'rfq_progress', openCount: d.open_rfqs }
  }

  // 4. 절약 기회 — AI 결정 엔진 기준
  const switchOpps = d.saving_opportunities
    .map(o => ({
      o,
      ai: aiEvaluatePrice(o.ingredient_name, o.unit, o.current_price, {
        supplier_name:    o.supplier_name,
        personal_history: o.personal_history,
        behavior_profile: d.behavior_profile,
        barcode:          o.barcode ?? null,
        brand:            o.brand ?? null,
        parsed_name:      o.parsed_name ?? null,
      }),
    }))
    .filter(x => x.ai.decision === 'SWITCH')
    .sort((a, b) => {
      const pa = a.ai.reasoning_source === 'personal' ? 1 : 0
      const pb = b.ai.reasoning_source === 'personal' ? 1 : 0
      if (pa !== pb) return pb - pa
      if (a.ai.confidence !== b.ai.confidence) return b.ai.confidence - a.ai.confidence
      return b.ai.base.saving_per_unit - a.ai.base.saving_per_unit
    })

  if (switchOpps.length > 0) {
    return {
      kind: 'saving_high',
      opportunity: switchOpps[0].o,
      saving_per_unit: switchOpps[0].ai.base.saving_per_unit,
    }
  }

  // 5. 알림
  if (d.notifications.length > 0) {
    return { kind: 'alert', notifications: d.notifications }
  }

  // 6. 루프 진입점
  if (d.ingredient_count === 0) return { kind: 'loop_input' }

  // 가격 입력된 식자재 없음 → 견적 먼저 유도
  if (d.ingredient_priced === 0) {
    return { kind: 'rfq_no_price' }
  }

  // 가격 있는 식자재 있는데 SWITCH가 아니라면 priced 상태
  if (d.saving_opportunities.length > 0) {
    return { kind: 'loop_priced', ingredient: d.saving_opportunities[0] }
  }

  return { kind: 'quiet' }
}

// ── 메인 카드 렌더 ───────────────────────────────────────────

function MainCard({
  primary, behaviorProfile, paymentTotal, paymentThisWeek, monthlySaving, pendingCount, openRfqs,
}: {
  primary: PrimaryAction
  behaviorProfile: TodayDashboard['behavior_profile']
  paymentTotal: number
  paymentThisWeek: number
  monthlySaving: number
  pendingCount: number
  openRfqs: number
}) {
  switch (primary.kind) {
    case 'payment':
      return <TodayPaymentCard urgentPayments={primary.urgent} totalDue={primary.totalDue} />

    case 'pending_delivery':
      return (
        <TodayDeliveryCard
          restaurantId={RESTAURANT_ID}
          order={primary.delivery}
          otherCount={primary.otherCount}
        />
      )

    case 'saving_high':
      return (
        <TodayLoopCard
          restaurantId={RESTAURANT_ID}
          seed={{
            id:            primary.opportunity.ingredient_id,
            name:          primary.opportunity.ingredient_name,
            unit:          primary.opportunity.unit,
            current_price: primary.opportunity.current_price,
            supplier_name: primary.opportunity.supplier_name,
            barcode:       primary.opportunity.barcode ?? null,
            brand:         primary.opportunity.brand ?? null,
            parsed_name:   primary.opportunity.parsed_name ?? null,
            possible_duplicate_group_id: primary.opportunity.possible_duplicate_group_id ?? null,
            group_member_count: primary.opportunity.group_member_count ?? 0,
            group_representative_barcode: primary.opportunity.group_representative_barcode ?? null,
            group_barcodes: primary.opportunity.group_barcodes ?? [],
            has_barcode_conflict: primary.opportunity.has_barcode_conflict ?? false,
            group_confirmed_same: primary.opportunity.group_confirmed_same ?? false,
            merge_candidate: primary.opportunity.merge_candidate ?? null,
          }}
          startPhase="priced"
          personalHistory={primary.opportunity.personal_history}
          behaviorProfile={behaviorProfile}
        />
      )

    case 'rfq_progress':
      return <TodayRfqCard openCount={primary.openCount} />

    case 'rfq_no_price':
      return <TodayRfqCard openCount={0} noPrice />

    case 'alert':
      return <TodayNotifications notifications={primary.notifications} />

    case 'loop_input':
      return (
        <TodayLoopCard
          restaurantId={RESTAURANT_ID}
          seed={null}
          startPhase="input"
          behaviorProfile={behaviorProfile}
        />
      )

    case 'loop_priced':
      return (
        <TodayLoopCard
          restaurantId={RESTAURANT_ID}
          seed={{
            id:            primary.ingredient.ingredient_id,
            name:          primary.ingredient.ingredient_name,
            unit:          primary.ingredient.unit,
            current_price: primary.ingredient.current_price,
            supplier_name: primary.ingredient.supplier_name,
            barcode:       primary.ingredient.barcode ?? null,
            brand:         primary.ingredient.brand ?? null,
            parsed_name:   primary.ingredient.parsed_name ?? null,
            possible_duplicate_group_id: primary.ingredient.possible_duplicate_group_id ?? null,
            group_member_count: primary.ingredient.group_member_count ?? 0,
            group_representative_barcode: primary.ingredient.group_representative_barcode ?? null,
            group_barcodes: primary.ingredient.group_barcodes ?? [],
            has_barcode_conflict: primary.ingredient.has_barcode_conflict ?? false,
            group_confirmed_same: primary.ingredient.group_confirmed_same ?? false,
            merge_candidate: primary.ingredient.merge_candidate ?? null,
          }}
          startPhase="priced"
          personalHistory={primary.ingredient.personal_history}
          behaviorProfile={behaviorProfile}
        />
      )

    case 'loop_no_price':
      return (
        <TodayLoopCard
          restaurantId={RESTAURANT_ID}
          seed={{
            id:            primary.ingredient.ingredient_id,
            name:          primary.ingredient.ingredient_name,
            unit:          primary.ingredient.unit,
            current_price: null,
            supplier_name: primary.ingredient.supplier_name,
            barcode:       primary.ingredient.barcode ?? null,
            brand:         primary.ingredient.brand ?? null,
            parsed_name:   primary.ingredient.parsed_name ?? null,
            possible_duplicate_group_id: primary.ingredient.possible_duplicate_group_id ?? null,
            group_member_count: primary.ingredient.group_member_count ?? 0,
            group_representative_barcode: primary.ingredient.group_representative_barcode ?? null,
            group_barcodes: primary.ingredient.group_barcodes ?? [],
            has_barcode_conflict: primary.ingredient.has_barcode_conflict ?? false,
            group_confirmed_same: primary.ingredient.group_confirmed_same ?? false,
            merge_candidate: primary.ingredient.merge_candidate ?? null,
          }}
          startPhase="no_price"
          personalHistory={primary.ingredient.personal_history}
          behaviorProfile={behaviorProfile}
        />
      )

    case 'quiet':
      return (
        <QuietCard
          paymentTotal={paymentTotal}
          paymentThisWeek={paymentThisWeek}
          monthlySaving={monthlySaving}
          pendingCount={pendingCount}
          openRfqs={openRfqs}
        />
      )
  }
}

// ── 하단 strip 구성 ──────────────────────────────────────────
// 메인에 올라간 항목은 strip에서 제외 (중복 방지)

function buildStrip(
  d: TodayDashboard,
  primaryKind: PrimaryAction['kind'],
) {
  const chips: { label: string; href?: string; tone?: 'urgent' | 'normal' }[] = []

  if (d.payment_urgent.length > 0 && primaryKind !== 'payment') {
    chips.push({ label: `지급 ${d.payment_urgent.length}건`, href: '/money', tone: 'urgent' })
  }

  if (d.pending_deliveries.length > 0 && primaryKind !== 'pending_delivery') {
    // 오늘 도착 예정인 건이 있으면 강조
    const today = new Date().toISOString().slice(0, 10)
    const dueToday = d.pending_deliveries.filter(p => p.expected_date === today).length
    const label = dueToday > 0
      ? `📦 오늘 도착 예정 ${dueToday}건`
      : `📦 납품 대기 ${d.pending_deliveries.length}건`
    chips.push({ label, href: '/rfq', tone: dueToday > 0 ? 'urgent' : 'normal' })
  }

  if (d.open_rfqs > 0 && primaryKind !== 'rfq_progress' && primaryKind !== 'rfq_no_price') {
    chips.push({ label: `견적 ${d.open_rfqs}건 도착`, href: '/rfq', tone: 'normal' })
  }

  if (d.notifications.length > 0 && primaryKind !== 'alert') {
    chips.push({ label: `알림 ${d.notifications.length}건` })
  }

  // saving_high가 메인이 아닐 때 — 절약 금액 표시
  const savingOpps = d.saving_opportunities
  const excludeOne = primaryKind === 'saving_high' || primaryKind === 'loop_priced' ? 1 : 0
  const remainingOpps = savingOpps.slice(excludeOne)
  if (remainingOpps.length > 0) {
    chips.push({ label: `절약 가능 품목 ${remainingOpps.length}개` })
  }

  if (d.fixed_cost_count === 0) {
    chips.push({ label: '고정비 미입력', href: '/settings/fixed-costs' })
  }

  return chips
}

// ── 헤더 / 조용한 상태 / 에러 ─────────────────────────────────

function Header({
  monthlySaving, rfqTotal, pendingCount, openRfqs, totalSavingEver, totalOrdersEver,
}: {
  monthlySaving:    number
  rfqTotal:         number
  pendingCount:     number
  openRfqs:         number
  totalSavingEver:  number
  totalOrdersEver:  number
}) {
  const chips: { label: string; tone: 'urgent' | 'good' | 'normal' }[] = []
  if (pendingCount > 0)       chips.push({ label: `📦 납품 대기 ${pendingCount}건`, tone: 'urgent' })
  if (openRfqs > 0)           chips.push({ label: `견적 확인 중 ${openRfqs}건`, tone: 'normal' })
  if (totalSavingEver > 0)    chips.push({ label: `지금까지 ${formatKRW(totalSavingEver)} 아꼈습니다 · 거래할수록 더 정확해집니다`, tone: 'good' })

  const toneStyle = (tone: 'urgent' | 'good' | 'normal') => ({
    urgent: { bg: '#FEF2F2', fg: '#B91C1C' },
    good:   { bg: '#ECFDF5', fg: '#059669' },
    normal: { bg: '#F3F4F6', fg: '#374151' },
  }[tone])

  // 누적 행동 요약 — 칩 없을 때 표시
  const cumulativeMsg = (() => {
    if (totalSavingEver > 0 && totalOrdersEver > 0)
      return `납품 ${totalOrdersEver}번 완료 · 쓸수록 더 정확해집니다`
    if (rfqTotal >= 10)
      return `견적 ${rfqTotal}번 요청 · 데이터가 쌓여 판단이 더 정확해지고 있어요`
    if (rfqTotal >= 3)
      return `견적 ${rfqTotal}번 기록됨 · 쓸수록 더 싸게 살 수 있어요`
    if (rfqTotal > 0)
      return `견적 ${rfqTotal}번 시작됨 · 계속 쓰면 더 정확해져요`
    return null
  })()

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500, marginBottom: 4 }}>
        <TodayDate />
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
        오늘 운영
      </h1>

      {chips.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {chips.map((c, i) => {
            const s = toneStyle(c.tone)
            return (
              <span key={i} style={{
                display: 'inline-block', padding: '4px 10px',
                background: s.bg, color: s.fg,
                borderRadius: 20, fontSize: 12, fontWeight: 600,
              }}>
                {c.label}
              </span>
            )
          })}
        </div>
      ) : cumulativeMsg ? (
        <div style={{ marginTop: 8, fontSize: 12, color: totalSavingEver > 0 ? '#059669' : '#6b7280', fontWeight: totalSavingEver > 0 ? 600 : 400 }}>
          {cumulativeMsg}
        </div>
      ) : (
        <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
          첫 견적 받으면 얼마나 아끼는지 보여드려요
        </div>
      )}
    </div>
  )
}

function QuietCard({
  paymentTotal, paymentThisWeek, monthlySaving, pendingCount, openRfqs,
}: {
  paymentTotal:   number
  paymentThisWeek: number
  monthlySaving:  number
  pendingCount:   number
  openRfqs:       number
}) {
  const rows: { label: string; value: string; color?: string }[] = [
    { label: '납품 대기',      value: pendingCount > 0 ? `${pendingCount}건` : '없음' },
    { label: '진행 중 견적',   value: openRfqs > 0 ? `${openRfqs}건` : '없음' },
    { label: '이번 달 지급',   value: paymentTotal > 0 ? formatKRW(paymentTotal) : '없음',
      color: paymentThisWeek > 0 ? '#B91C1C' : undefined },
    { label: '이번 달 절약',   value: monthlySaving > 0 ? formatKRW(monthlySaving) : '-',
      color: monthlySaving > 0 ? '#059669' : undefined },
  ]

  const trustMsg = monthlySaving > 0
    ? `지금까지 ${formatKRW(monthlySaving)} 절약 · 기록이 쌓일수록 더 정확해져요`
    : '거래 기록이 쌓일수록 더 싸게 살 수 있어요'

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1px solid #e5e7eb', overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 18px 4px' }}>
        <div style={{ fontSize: 12, color: '#059669', fontWeight: 700, marginBottom: 14 }}>
          ✓ 지금 잘 운영되고 있어요
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => (
            <div key={r.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{r.label}</span>
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: r.color ?? '#111827',
              }}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f4f6',
          fontSize: 12, color: '#6b7280',
        }}>
          {trustMsg}
        </div>
      </div>

      <div style={{ padding: '14px 16px 16px' }}>
        <a href="/rfq/new" style={{
          display: 'block', padding: '13px',
          background: '#111827', color: '#fff',
          borderRadius: 10, fontSize: 14, fontWeight: 700,
          textDecoration: 'none', textAlign: 'center',
        }}>
          더 싸게 살 수 있는지 확인하기
        </a>
      </div>
    </div>
  )
}

function FatalError() {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '24px 20px',
      border: '1px solid #FCA5A5',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#B91C1C', marginBottom: 6 }}>
        데이터를 불러올 수 없어요
      </div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>
        잠시 후 다시 시도해주세요.
      </div>
    </div>
  )
}
