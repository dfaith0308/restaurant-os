'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { quickAddIngredient } from '@/actions/today'
import { upsertIngredient } from '@/actions/settings'
import { createRfqRequest } from '@/actions/rfq'
import { logAiDecision } from '@/actions/ai-logs'
import { logTodayEvent } from '@/actions/today-events'
import { getOrCreateSessionId, timeSinceEnter, resetEnterTs } from '@/lib/today-events'
import {
  mergeIngredients,
  promoteGroupToExact,
  confirmSameProduct,
  splitFromGroup,
} from '@/actions/import'
import { evaluatePrice, verdictCopy } from '@/lib/market-reference'
import { aiEvaluatePrice, toneOf, decisionLabel, decisionTone } from '@/lib/ai-evaluate'
import {
  profileLabel,
  shouldDampenPressure,
  preferredPressureOf,
  isSimpleModeCandidate,
} from '@/lib/behavior-profile'
import type { BehaviorProfile } from '@/lib/behavior-profile'
import { formatKRW } from '@/lib/utils'
import type { PricePoint } from '@/types'

// ── 핵심 루프: 입력 → 가격 → 판단 → 발주요청 (페이지 이동 0회) ──
//   기존 phase 유지, rfq_confirm + auto_ready 만 추가로 얹음

type Phase = 'input' | 'no_price' | 'priced' | 'rfq_draft' | 'rfq_confirm' | 'auto_ready' | 'rfq_done'

interface Seed {
  id:             string
  name:           string                // raw_name
  unit:           string
  current_price:  number | null
  supplier_name:  string | null
  // SKU 레이어 (선택) — AI 에 barcode 주입하면 personal_history 도 이미 SKU 스코프
  barcode?:       string | null
  brand?:         string | null
  parsed_name?:   string | null
  // 그룹 레이어 (선택)
  possible_duplicate_group_id?: string | null
  group_member_count?: number
  group_representative_barcode?: string | null     // 그룹 내 유일 barcode (승급 후보, 충돌 시 null)
  group_barcodes?: string[]                        // 그룹 내 모든 고유 barcode
  has_barcode_conflict?: boolean
  group_confirmed_same?: boolean
  merge_candidate?: {
    id:            string
    name:          string
    brand:         string | null
    supplier_name: string | null
  } | null
}

interface Props {
  restaurantId:     string
  seed:             Seed | null    // null이면 'input' 단계
  startPhase:       'input' | 'no_price' | 'priced'
  personalHistory?: PricePoint[]   // 서버에서 조회해 내려준 개인 히스토리
  behaviorProfile?: BehaviorProfile  // 사장 성향 — AI decision/threshold/메시지 변형
}

const UNITS = ['kg', 'g', '개', '봉', 'L', '박스', '팩', '모', '판']

export default function TodayLoopCard({
  restaurantId, seed, startPhase, personalHistory, behaviorProfile,
}: Props) {
  const router = useRouter()
  const [isPending, startTr] = useTransition()
  const [phase, setPhase] = useState<Phase>(startPhase)
  const [ing,   setIng]   = useState<Seed | null>(seed)
  const [error, setError] = useState<string | null>(null)

  // 폼 상태
  const [name,  setName]  = useState('')
  const [unit,  setUnit]  = useState('kg')
  const [price, setPrice] = useState('')
  const [qty,   setQty]   = useState('')
  const [rfqId, setRfqId] = useState<string | null>(null)

  const priceNum = parseInt(price.replace(/,/g, ''), 10) || 0
  const qtyNum   = parseInt(qty, 10) || 0

  function fmtPriceInput(v: string) {
    const n = v.replace(/[^0-9]/g, '')
    setPrice(n ? Number(n).toLocaleString() : '')
  }

  // ── 액션 핸들러 ─────────────────────────────────────────────

  function handleInputSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('품목명을 입력해주세요'); return }
    setError(null)
    startTr(async () => {
      const res = await quickAddIngredient({
        tenant_id:     restaurantId,
        name:          name.trim(),
        unit,
        current_price: priceNum || null,
      })
      if (!res.success || !res.data) { setError(res.error ?? '저장 실패'); return }
      // 낙관적 전환 — 같은 자리에서 다음 상태로
      setIng({ id: res.data.id, name: name.trim(), unit, current_price: priceNum || null, supplier_name: null })
      setPhase(priceNum > 0 ? 'priced' : 'no_price')
      setPrice('')
    })
  }

  function handleAddPrice() {
    if (!ing)       return
    if (!priceNum)  { setError('가격을 입력해주세요'); return }
    setError(null)
    startTr(async () => {
      const res = await upsertIngredient({
        id:            ing.id,
        tenant_id:     restaurantId,
        name:          ing.name,
        unit:          ing.unit,
        current_price: priceNum,
        supplier_name: ing.supplier_name,
      })
      if (!res.success) { setError(res.error ?? '저장 실패'); return }
      setIng({ ...ing, current_price: priceNum })
      setPhase('priced')
      setPrice('')
    })
  }

  function handleRfqSubmit() {
    if (!ing)    return
    if (!qtyNum) { setError('수량을 입력해주세요'); return }
    setError(null)
    startTr(async () => {
      const res = await createRfqRequest({
        tenant_id:     restaurantId,
        product_name:  ing.name,
        quantity:      qtyNum,
        unit:          ing.unit,
        current_price: ing.current_price,
        ingredient_id: ing.id,
      })
      if (!res.success || !res.data) { setError(res.error ?? '오류'); return }

      // 행동 로그 — 이 판단에 대한 사용자 반응 (SWITCH 선택)
      if (ing.current_price != null) {
        const ai = aiEvaluatePrice(ing.name, ing.unit, ing.current_price, {
          monthly_qty:      qtyNum,
          supplier_name:    ing.supplier_name,
          personal_history: personalHistory,
          behavior_profile: behaviorProfile,
          barcode:          ing.barcode ?? null,
          brand:            ing.brand ?? null,
          parsed_name:      ing.parsed_name ?? null,
          possible_duplicate_group_id: ing.possible_duplicate_group_id ?? null,
          group_representative_barcode: ing.group_representative_barcode ?? null,
          has_barcode_conflict: ing.has_barcode_conflict ?? false,
          group_confirmed_same: ing.group_confirmed_same ?? false,
        })
        // REVIEW 케이스는 SWITCH 로 매핑 (스키마 KEEP | SWITCH 만 허용)
        const loggedDecision = ai.decision === 'KEEP' ? 'KEEP' : 'SWITCH'
        logAiDecision({
          tenant_id:       restaurantId,
          ingredient_name: ing.name,
          ai_decision:     loggedDecision,
          user_action:     'SWITCH',
          confidence:      ai.confidence,
        })

        // Today 이벤트 — action_complete (rfq)
        const sid = getOrCreateSessionId()
        if (sid) {
          logTodayEvent({
            tenant_id:           restaurantId,
            session_id:          sid,
            event_type:          'action_complete',
            action_kind:         'rfq',
            decision_type:       ai.decision,
            sku_precision:       ai.sku_precision,
            has_conflict:        ing.has_barcode_conflict ?? false,
            shown_pressure_type: ai.base.saving_per_unit > 0 ? 'loss' : 'none',
            time_to_action_ms:   timeSinceEnter(),
          })
          resetEnterTs()
        }
      }

      setRfqId(res.data.id)
      setPhase('rfq_done')
      setQty('')
      router.refresh()
    })
  }

  // auto_ready 에서 사용자가 명시적으로 취소 → CANCEL 로그
  function handleAutoCancel() {
    if (ing?.current_price != null) {
      const ai = aiEvaluatePrice(ing.name, ing.unit, ing.current_price, {
        monthly_qty:      qtyNum,
        supplier_name:    ing.supplier_name,
        personal_history: personalHistory,
        behavior_profile: behaviorProfile,
        barcode:          ing.barcode ?? null,
        brand:            ing.brand ?? null,
        parsed_name:      ing.parsed_name ?? null,
        possible_duplicate_group_id: ing.possible_duplicate_group_id ?? null,
        group_representative_barcode: ing.group_representative_barcode ?? null,
        has_barcode_conflict: ing.has_barcode_conflict ?? false,
        group_confirmed_same: ing.group_confirmed_same ?? false,
      })
      logAiDecision({
        tenant_id:       restaurantId,
        ingredient_name: ing.name,
        ai_decision:     'SWITCH',  // auto_ready 는 항상 SWITCH 결정에서만 진입
        user_action:     'CANCEL',
        confidence:      ai.confidence,
      })
    }
    setPhase('rfq_confirm')
  }

  // ── 렌더 ────────────────────────────────────────────────────

  return (
    <div style={card}>
      {phase === 'input' && (
        <form onSubmit={handleInputSave}>
          <Tag>오늘 시작하기</Tag>
          <Headline>자주 사는 식자재 1개만 알려주세요</Headline>
          <Sub>저장하자마자 평균 가격 대비 비싼지 바로 알려드려요</Sub>

          <div style={{ marginTop: 14 }}>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 고춧가루"
              style={input}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <div style={{ flex: 2, position: 'relative' }}>
              <input
                value={price}
                onChange={e => fmtPriceInput(e.target.value)}
                placeholder="지금 구매가 (선택)"
                inputMode="numeric"
                style={{ ...input, paddingRight: 32 }}
              />
              <span style={won}>원</span>
            </div>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...input, flex: 1, cursor: 'pointer' }}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>

          {error && <ErrorMsg>{error}</ErrorMsg>}
          <PrimaryBtn disabled={isPending || !name.trim()} type="submit">
            {isPending ? '저장 중...' : '시작하기 →'}
          </PrimaryBtn>
        </form>
      )}

      {phase === 'no_price' && ing && (
        <div>
          <Tag>한 발짝 더</Tag>
          <Headline>{ing.name} 지금 얼마에 사세요?</Headline>
          <Sub>입력하자마자 평균 대비 위치를 알려드려요</Sub>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                autoFocus
                value={price}
                onChange={e => fmtPriceInput(e.target.value)}
                placeholder="예: 12,000"
                inputMode="numeric"
                style={{ ...input, paddingRight: 32 }}
              />
              <span style={won}>원 / {ing.unit}</span>
            </div>
          </div>

          {error && <ErrorMsg>{error}</ErrorMsg>}
          <PrimaryBtn disabled={isPending || !priceNum} onClick={handleAddPrice}>
            {isPending ? '저장 중...' : '비교해보기 →'}
          </PrimaryBtn>
        </div>
      )}

      {phase === 'priced' && ing && ing.current_price != null && (
        <VerdictView
          restaurantId={restaurantId}
          ingredient={{ ...ing, current_price: ing.current_price }}
          personalHistory={personalHistory}
          behaviorProfile={behaviorProfile}
          onStartRfq={() => { setError(null); setPhase('rfq_draft') }}
        />
      )}

      {phase === 'rfq_draft' && ing && (
        <div>
          <Tag>수량 입력</Tag>
          <Headline>{ing.name}, 얼마나 필요하세요?</Headline>
          <Sub>다음 화면에서 조건을 한 번 더 확인해요</Sub>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              autoFocus
              value={qty}
              onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={`수량 (${ing.unit})`}
              inputMode="numeric"
              style={input}
            />
          </div>

          {error && <ErrorMsg>{error}</ErrorMsg>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setPhase('priced')} style={secondaryBtn} type="button">
              뒤로
            </button>
            <button
              onClick={() => {
                if (!qtyNum) { setError('수량을 입력해주세요'); return }
                // AI 결정 엔진이 자동 실행 조건을 충족하면 auto_ready로 바로 진입
                const ai = ing?.current_price
                  ? aiEvaluatePrice(ing.name, ing.unit, ing.current_price, {
                      monthly_qty:      qtyNum,
                      personal_history: personalHistory,
                      behavior_profile: behaviorProfile,
                      barcode:          ing.barcode ?? null,
                      brand:            ing.brand ?? null,
                      parsed_name:      ing.parsed_name ?? null,
                      possible_duplicate_group_id: ing.possible_duplicate_group_id ?? null,
                      group_representative_barcode: ing.group_representative_barcode ?? null,
                      has_barcode_conflict: ing.has_barcode_conflict ?? false,
                      group_confirmed_same: ing.group_confirmed_same ?? false,
                    })
                  : null
                setPhase(ai?.auto_ready_eligible ? 'auto_ready' : 'rfq_confirm')
              }}
              disabled={!qtyNum}
              style={{
                ...primaryBtnStyle,
                flex: 2,
                background: !qtyNum ? '#d1d5db' : '#111827',
              }} type="button">
              견적 요청하기 →
            </button>
          </div>
        </div>
      )}

      {phase === 'rfq_confirm' && ing && (
        <RfqConfirmView
          ingredient={ing}
          qty={qtyNum}
          isPending={isPending}
          error={error}
          personalHistory={personalHistory}
          behaviorProfile={behaviorProfile}
          onBack={() => setPhase('rfq_draft')}
          onSubmit={handleRfqSubmit}
        />
      )}

      {phase === 'auto_ready' && ing && (
        <AutoReadyView
          ingredient={ing}
          qty={qtyNum}
          isPending={isPending}
          error={error}
          personalHistory={personalHistory}
          behaviorProfile={behaviorProfile}
          onCancel={handleAutoCancel}
          onFire={handleRfqSubmit}
        />
      )}

      {phase === 'rfq_done' && ing && (
        <div>
          <Tag tone="good">완료</Tag>
          <Headline>견적 요청했어요</Headline>
          <Sub>{ing.name} 요청이 접수됐어요. 결과가 오면 Today에서 바로 확인하세요.</Sub>
          <div style={{ marginTop: 14 }}>
            <button onClick={() => { setPhase('priced'); setRfqId(null) }} style={{
              ...primaryBtnStyle, width: '100%',
            }} type="button">
              다른 품목도 견적 받기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── VerdictView: AI 결정 엔진 메시지 + 행동 1개 ─────────────
// 기존 레이어 (evaluatePrice / verdictCopy / toneOf / recommendation) 는 유지된 채로
// 상단 메시지만 결정 엔진(decision/confidence/expected_saving) 기준으로 구성

function VerdictView({
  restaurantId,
  ingredient,
  personalHistory,
  behaviorProfile,
  onStartRfq,
}: {
  restaurantId:     string
  ingredient:       Seed & { current_price: number }
  personalHistory?: PricePoint[]
  behaviorProfile?: BehaviorProfile
  onStartRfq:       () => void
}) {
  // 하위 레이어 — 시장 평균 판정 (보존)
  const ev = evaluatePrice(ingredient.name, ingredient.unit, ingredient.current_price)
  // 상위 레이어 — AI 결정 엔진 (개인화 + 성향 + SKU)
  const ai = aiEvaluatePrice(
    ingredient.name, ingredient.unit, ingredient.current_price,
    {
      supplier_name:    ingredient.supplier_name,
      personal_history: personalHistory,
      behavior_profile: behaviorProfile,
      barcode:          ingredient.barcode ?? null,
      brand:            ingredient.brand ?? null,
      parsed_name:      ingredient.parsed_name ?? null,
      possible_duplicate_group_id: ingredient.possible_duplicate_group_id ?? null,
      group_representative_barcode: ingredient.group_representative_barcode ?? null,
      has_barcode_conflict: ingredient.has_barcode_conflict ?? false,
      group_confirmed_same: ingredient.group_confirmed_same ?? false,
    },
  )

  const dec     = ai.decision
  const dTone   = decisionTone(dec)
  const btnLabel = ai.action_label

  // 개인화 게이팅 — 구조 유지
  const MONTHLY_UNITS_ESTIMATE = 4
  const estMonthlyLoss = ai.decision === 'SWITCH' && ai.base.saving_per_unit > 0
    ? ai.base.saving_per_unit * MONTHLY_UNITS_ESTIMATE
    : 0
  const simple  = isSimpleModeCandidate(behaviorProfile)
  const dampen  = simple || shouldDampenPressure(behaviorProfile)
  const prefers = preferredPressureOf(behaviorProfile)
  const showLossBanner   = estMonthlyLoss > 0 && !dampen && prefers !== 'time' && !simple
  const showMinLossLine  = estMonthlyLoss > 0 && !showLossBanner && !simple

  // 가격 비교 데이터 — 메인 근거
  const currentPrice  = ingredient.current_price
  const hasPersonal   = ai.reasoning_source === 'personal' && ai.personal != null
  const hasMarket     = ai.reasoning_source === 'market' && ev.verdict !== 'unknown'
  const refPrice      = hasPersonal
    ? ai.personal!.personal_avg_price
    : hasMarket ? ev.avg_price : null
  const refLabel      = hasPersonal
    ? `최근 ${ai.personal!.sample_size}건 평균`
    : hasMarket ? '시장 평균' : null
  const priceDiff     = refPrice != null ? currentPrice - refPrice : null
  const isExpensive   = priceDiff != null && priceDiff > 0

  return (
    <div>
      {/* ── LOSS BANNER ── */}
      {showLossBanner && (
        <div style={{
          marginBottom: 12, padding: '10px 14px',
          background: '#FEF2F2', border: '1.5px solid #FCA5A5',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 700, marginBottom: 2 }}>
            지금보다 더 비싸게 사고 있어요
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#B91C1C', letterSpacing: '-0.01em' }}>
            {formatKRW(ai.base.saving_per_unit)} / {ingredient.unit} 차이
          </div>
        </div>
      )}
      {showMinLossLine && (
        <div style={{ marginBottom: 10, fontSize: 12, color: '#6b7280' }}>
          → {ingredient.unit}당 {formatKRW(ai.base.saving_per_unit)} 더 비싸게 사고 있어요
        </div>
      )}

      {/* ── 결정 뱃지 ── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-block', padding: '3px 10px',
          background: dTone.bg, color: dTone.fg,
          borderRadius: 20, fontSize: 11, fontWeight: 700,
        }}>
          {dTone.short}
        </div>
        <ReasoningSourceTag source={ai.reasoning_source} sampleSize={ai.personal?.sample_size} />
      </div>

      {/* ── 헤드라인 ── */}
      <div style={{ fontSize: 19, fontWeight: 800, color: '#111827', lineHeight: 1.3, marginBottom: 12 }}>
        {ai.headline}
      </div>

      {/* ── 가격 비교 카드 — 핵심 근거 ── */}
      {refPrice != null && (
        <div style={{
          background: '#F9FAFB', border: '1px solid #e5e7eb',
          borderRadius: 12, padding: '12px 14px', marginBottom: 12,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>지금 사는 가격</span>
            <span style={{
              fontSize: 16, fontWeight: 800,
              color: isExpensive ? '#B91C1C' : '#111827',
            }}>
              {formatKRW(currentPrice)}
              <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', marginLeft: 2 }}>/ {ingredient.unit}</span>
            </span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{refLabel}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
              {formatKRW(refPrice)}
              <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', marginLeft: 2 }}>/ {ingredient.unit}</span>
            </span>
          </div>
          {priceDiff != null && Math.abs(priceDiff) > 0 && (
            <div style={{
              marginTop: 8, paddingTop: 8,
              borderTop: '1px solid #e5e7eb',
              fontSize: 12, fontWeight: 700,
              color: isExpensive ? '#B91C1C' : '#15803D',
            }}>
              {isExpensive
                ? `→ ${formatKRW(Math.abs(priceDiff))} 더 비싸게 사고 있어요`
                : `→ ${formatKRW(Math.abs(priceDiff))} 잘 사고 있어요`}
              {hasPersonal && ai.personal!.trend !== 'stable' && (
                <span style={{ marginLeft: 8, fontWeight: 600 }}>
                  {ai.personal!.trend === 'rising' ? '↑ 오르는 중' : '↓ 내려가는 중'}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* refPrice 없을 때 — 시장 데이터도 없는 경우 간단히 */}
      {refPrice == null && (
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          현재 {formatKRW(currentPrice)} / {ingredient.unit}
          {ai.reason ? ` · ${ai.reason}` : ''}
        </div>
      )}

      {/* ── SKU / 그룹 관련 보조 정보 ── */}
      {ai.sku_precision === 'name_only' && (
        dampen ? (
          <div style={{ marginBottom: 10, fontSize: 11, color: '#9ca3af' }}>
            제품 정보 적음 · 뒷면 사진 올리면 더 정확해짐
          </div>
        ) : (
          <div style={{
            marginBottom: 10, padding: '8px 12px',
            background: '#F9FAFB', border: '1px dashed #9ca3af',
            borderRadius: 10, fontSize: 12, color: '#6b7280',
          }}>
            제품 정보가 부족해 판단 정확도가 낮아요 · 뒷면 사진을 올리면 더 정확해져요
          </div>
        )
      )}

      {(ingredient.group_member_count ?? 0) > 0 && !ingredient.has_barcode_conflict && (
        <div style={{
          marginBottom: 10, padding: '6px 12px',
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: 10, fontSize: 12, color: '#1D4ED8',
        }}>
          같은 상품 {ingredient.group_member_count}개와 가격 통합 조회 중
        </div>
      )}

      {ingredient.has_barcode_conflict && !ingredient.group_confirmed_same && ingredient.possible_duplicate_group_id && (
        <ConflictBox
          restaurantId={restaurantId}
          groupId={ingredient.possible_duplicate_group_id}
          selfId={ingredient.id}
          selfBarcode={ingredient.barcode ?? null}
          barcodes={ingredient.group_barcodes ?? []}
        />
      )}

      {ingredient.has_barcode_conflict && ingredient.group_confirmed_same && (
        <div style={{
          marginBottom: 10, padding: '6px 12px',
          background: '#F0FDF4', border: '1px solid #BBF7D0',
          borderRadius: 10, fontSize: 12, color: '#15803D',
        }}>
          바코드 다양 · 사용자 확정 — 같은 상품으로 처리 중
        </div>
      )}

      {ai.sku_precision === 'grouped' && !ingredient.has_barcode_conflict
        && ingredient.possible_duplicate_group_id && ingredient.group_representative_barcode && (
        <PromotionBox
          restaurantId={restaurantId}
          groupId={ingredient.possible_duplicate_group_id}
          targetBarcode={ingredient.group_representative_barcode}
        />
      )}

      {ingredient.merge_candidate && (
        <MergeCandidateBox
          restaurantId={restaurantId}
          selfId={ingredient.id}
          candidate={ingredient.merge_candidate}
        />
      )}

      {/* ── 버튼 직전 — 이유 1줄 ── */}
      {dec === 'SWITCH' && ai.base.saving_per_unit > 0 && !simple && (
        <div style={{
          fontSize: 13, color: '#374151', fontWeight: 600,
          marginBottom: 8, marginTop: 4,
        }}>
          더 싼 거래처 찾으면 {formatKRW(ai.base.saving_per_unit)} 아낄 수 있어요
        </div>
      )}
      {dec === 'KEEP' && (
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, marginTop: 4 }}>
          지금 가격이 적정해요 · 유지하셔도 됩니다
        </div>
      )}

      {ai.auto_ready_eligible && !dampen && (
        <div style={{
          marginBottom: 8, padding: '6px 12px',
          background: '#FEF2F2', border: '1px solid #FCA5A5',
          borderRadius: 10, fontSize: 12, color: '#B91C1C', fontWeight: 600,
        }}>
          수량만 넣으면 바로 요청돼요
        </div>
      )}

      {/* ── 메인 버튼 ── */}
      <PrimaryBtn onClick={() => {
        const sid = getOrCreateSessionId()
        if (sid) {
          logTodayEvent({
            tenant_id:           restaurantId,
            session_id:          sid,
            event_type:          'primary_card_click',
            decision_type:       ai.decision,
            sku_precision:       ai.sku_precision,
            has_conflict:        ingredient.has_barcode_conflict ?? false,
            shown_pressure_type: estMonthlyLoss > 0 ? 'loss' : 'none',
          })
        }
        onStartRfq()
      }}>
        {btnLabel} →
      </PrimaryBtn>

      {/* 기존 레거시 톤 — 삭제 금지 */}
      <div style={{ display: 'none' }}>
        <LegacyVerdictTag recommendation={ai.recommendation} />
      </div>
    </div>
  )
}

// 완료 피드백 박스 — 모든 액션 성공 시 일관된 표현으로 재사용
function DoneBox({
  headline, sub, tone = 'good',
}: {
  headline: string
  sub:      string
  tone?:    'good' | 'neutral'
}) {
  const c = tone === 'good'
    ? { bg: '#F0FDF4', border: '#BBF7D0', fg: '#15803D', subFg: '#166534' }
    : { bg: '#F9FAFB', border: '#e5e7eb', fg: '#374151', subFg: '#6b7280' }
  return (
    <div style={{
      marginTop: 10, padding: '10px 12px',
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 13, color: c.fg, fontWeight: 700 }}>
        ✓ {headline}
      </div>
      <div style={{ fontSize: 12, color: c.subFg, marginTop: 2, lineHeight: 1.5 }}>
        {sub}
      </div>
    </div>
  )
}

// 바코드 충돌 — 같은 그룹에 서로 다른 barcode 가 2개 이상 있을 때.
// 3가지 선택지:
//   1) 같은 상품으로 묶기 (grouped 유지, barcode 여러 개 허용)
//   2) 이 바코드로 통일 (선택적, 본인 barcode 있을 때만 노출)
//   3) 다른 상품으로 유지 (group 분리)
function ConflictBox({
  restaurantId, groupId, selfId, selfBarcode, barcodes,
}: {
  restaurantId: string
  groupId:      string
  selfId:       string
  selfBarcode:  string | null
  barcodes:     string[]
}) {
  type Action = null | 'confirm' | 'unify' | 'split'
  const [isPending, startTr] = useTransition()
  const [done, setDone] = useState<null | 'confirmed' | 'unified' | 'split'>(null)
  const [error, setError] = useState<string | null>(null)

  function dispatch(action: Action) {
    if (!action) return
    setError(null)
    startTr(async () => {
      let ok = false
      if (action === 'confirm') {
        const res = await confirmSameProduct(restaurantId, groupId)
        if (!res.success) { setError(res.error ?? '실패'); return }
        setDone('confirmed'); ok = true
      } else if (action === 'unify' && selfBarcode) {
        const res = await promoteGroupToExact(restaurantId, groupId, selfBarcode)
        if (!res.success) { setError(res.error ?? '실패'); return }
        setDone('unified'); ok = true
      } else if (action === 'split') {
        const res = await splitFromGroup(restaurantId, selfId)
        if (!res.success) { setError(res.error ?? '실패'); return }
        setDone('split'); ok = true
      }
      // SKU 액션 완료 로그
      if (ok) {
        const sid = getOrCreateSessionId()
        if (sid) {
          logTodayEvent({
            tenant_id:         restaurantId,
            session_id:        sid,
            event_type:        'action_complete',
            action_kind:       'sku',
            time_to_action_ms: timeSinceEnter(),
          })
          resetEnterTs()
        }
      }
    })
  }

  if (done === 'confirmed') {
    return <DoneBox headline="완료됐어요"
                    sub="같은 상품으로 묶였습니다. 바코드는 여러 개 그대로 두고 가격만 통합합니다." />
  }
  if (done === 'unified') {
    return <DoneBox headline="완료됐어요"
                    sub="이 바코드로 통일됐습니다. 이제 SKU 기준으로 판단합니다." />
  }
  if (done === 'split') {
    return <DoneBox headline="완료됐어요" tone="neutral"
                    sub="별도 상품으로 분리됐습니다. 독립 그룹으로 관리됩니다." />
  }

  return (
    <div style={{
      marginTop: 10, padding: '12px 14px',
      background: '#FFFBEB', border: '1.5px solid #FCD34D',
      borderRadius: 10, fontSize: 12, color: '#92400E',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 13 }}>
        여러 바코드가 감지되었습니다
      </div>
      <div style={{ color: '#78350F', marginBottom: 8, lineHeight: 1.55 }}>
        같은 상품일 수도, 다른 상품일 수도 있습니다. 사장님이 골라주세요.
      </div>

      {/* 감지된 바코드 목록 */}
      <div style={{
        background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 10,
        fontFamily: 'monospace', fontSize: 11, color: '#374151', lineHeight: 1.7,
      }}>
        {barcodes.map(bc => (
          <div key={bc} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>• {bc}</span>
            {bc === selfBarcode && (
              <span style={{ fontFamily: 'inherit', fontSize: 10, color: '#1D4ED8', fontWeight: 600 }}>
                내 항목
              </span>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ color: '#B91C1C', fontSize: 11, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* 1차 선택 — 묶기 / 분리 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: selfBarcode ? 6 : 0 }}>
        <button
          type="button"
          onClick={() => dispatch('confirm')}
          disabled={isPending}
          style={{
            flex: 1, padding: '8px 10px',
            background: isPending ? '#d1d5db' : '#111827',
            color: '#fff', border: 'none',
            borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}>
          같은 상품으로 묶기
        </button>
        <button
          type="button"
          onClick={() => dispatch('split')}
          disabled={isPending}
          style={{
            flex: 1, padding: '8px 10px',
            background: '#fff', color: '#374151',
            border: '1px solid #e5e7eb',
            borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}>
          다른 상품으로 유지
        </button>
      </div>

      {/* 보조 옵션 — 본인이 barcode 가진 경우만 노출 */}
      {selfBarcode && (
        <button
          type="button"
          onClick={() => dispatch('unify')}
          disabled={isPending}
          style={{
            width: '100%', padding: '6px 10px',
            background: 'transparent', color: '#1D4ED8',
            border: '1px dashed #93C5FD',
            borderRadius: 8, fontSize: 11, fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}>
          이 바코드({selfBarcode})로 전체 통일하기
        </button>
      )}
    </div>
  )
}

// 그룹 → 정확 SKU 승급 — 같은 그룹에 이미 barcode 가 있는 sibling 이 있으면
// 사용자가 한 번 승인해서 이 항목에도 그 barcode 를 복사.
function PromotionBox({
  restaurantId, groupId, targetBarcode,
}: {
  restaurantId:  string
  groupId:       string
  targetBarcode: string
}) {
  const [isPending, startTr] = useTransition()
  const [done,      setDone]  = useState(false)
  const [error,     setError] = useState<string | null>(null)

  function handlePromote() {
    setError(null)
    startTr(async () => {
      const res = await promoteGroupToExact(restaurantId, groupId, targetBarcode)
      if (!res.success) { setError(res.error ?? '실패'); return }
      setDone(true)
      const sid = getOrCreateSessionId()
      if (sid) {
        logTodayEvent({
          tenant_id:         restaurantId,
          session_id:        sid,
          event_type:        'action_complete',
          action_kind:       'sku',
          time_to_action_ms: timeSinceEnter(),
        })
        resetEnterTs()
      }
    })
  }

  if (done) {
    return <DoneBox
      headline="완료됐어요"
      sub="같은 상품으로 확정됐습니다. 이제 정확 매칭(SKU) 기준으로 판단합니다."
    />
  }

  return (
    <div style={{
      marginTop: 10, padding: '10px 12px',
      background: '#EFF6FF', border: '1px dashed #60A5FA',
      borderRadius: 10, fontSize: 12, color: '#1E3A8A',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>
        같은 상품으로 확정할 수 있습니다
      </div>
      <div style={{ color: '#1D4ED8', marginBottom: 8, lineHeight: 1.5, fontFamily: 'monospace', fontSize: 11 }}>
        대표 바코드 {targetBarcode}
      </div>
      {error && (
        <div style={{ color: '#B91C1C', fontSize: 11, marginBottom: 6 }}>
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handlePromote}
        disabled={isPending}
        style={{
          padding: '6px 12px',
          background: isPending ? '#d1d5db' : '#1D4ED8',
          color: '#fff', border: 'none',
          borderRadius: 8, fontSize: 12, fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
        {isPending ? '확정 중...' : '이 상품으로 통일하기'}
      </button>
    </div>
  )
}

// 같은 상품으로 보이는 후보 — 아직 같은 그룹에 없음. 사용자가 버튼으로 수동 병합.
function MergeCandidateBox({
  restaurantId, selfId, candidate,
}: {
  restaurantId: string
  selfId:       string
  candidate:    { id: string; name: string; brand: string | null; supplier_name: string | null }
}) {
  const [isPending, startTr] = useTransition()
  const [merged,    setMerged]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  function handleMerge() {
    setError(null)
    startTr(async () => {
      const res = await mergeIngredients(restaurantId, [selfId, candidate.id])
      if (!res.success) { setError(res.error ?? '실패'); return }
      setMerged(true)
      const sid = getOrCreateSessionId()
      if (sid) {
        logTodayEvent({
          tenant_id:         restaurantId,
          session_id:        sid,
          event_type:        'action_complete',
          action_kind:       'sku',
          time_to_action_ms: timeSinceEnter(),
        })
        resetEnterTs()
      }
    })
  }

  if (merged) {
    return <DoneBox
      headline="완료됐어요"
      sub="같은 상품으로 묶였습니다. 이제 가격이 함께 비교됩니다."
    />
  }

  return (
    <div style={{
      marginTop: 10, padding: '10px 12px',
      background: '#FFFBEB', border: '1px dashed #FCD34D',
      borderRadius: 10, fontSize: 12, color: '#92400E',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>
        같은 상품으로 보입니다
      </div>
      <div style={{ color: '#6b7280', marginBottom: 8, lineHeight: 1.5 }}>
        {candidate.brand ? `${candidate.brand} · ` : ''}{candidate.name}
        {candidate.supplier_name && ` (${candidate.supplier_name})`}
      </div>
      {error && (
        <div style={{ color: '#B91C1C', fontSize: 11, marginBottom: 6 }}>
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleMerge}
        disabled={isPending}
        style={{
          padding: '6px 12px',
          background: isPending ? '#d1d5db' : '#111827',
          color: '#fff', border: 'none',
          borderRadius: 8, fontSize: 12, fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
        {isPending ? '묶는 중...' : '같은 상품으로 묶기'}
      </button>
    </div>
  )
}

// 판단 근거 출처 뱃지 — "내 거래 기준" / "시장 기준"
function ReasoningSourceTag({
  source, sampleSize,
}: {
  source:     'personal' | 'market' | 'none'
  sampleSize?: number
}) {
  if (source === 'none') return null
  const cfg = source === 'personal'
    ? { bg: '#EFF6FF', fg: '#1D4ED8', text: `내 거래 기준${sampleSize ? ` · ${sampleSize}건` : ''}` }
    : { bg: '#F3F4F6', fg: '#6b7280', text: '시장 기준' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 8px',
      background: cfg.bg, color: cfg.fg,
      borderRadius: 20, fontSize: 10, fontWeight: 600,
    }}>
      {cfg.text}
    </span>
  )
}

// 기존 recommendation/tone 레이어가 사라지지 않도록 미세 노출
function LegacyVerdictTag({ recommendation }: { recommendation: Parameters<typeof toneOf>[0] }) {
  const t = toneOf(recommendation)
  return (
    <div style={{
      marginTop: 10, fontSize: 10, color: '#9ca3af',
    }}>
      <span style={{
        display: 'inline-block', padding: '1px 6px',
        background: t.bg, color: t.fg,
        borderRadius: 10, fontWeight: 600, marginRight: 4,
      }}>
        {t.label}
      </span>
      하위 판정 보조
    </div>
  )
}

// ── AutoReadyView: 3초 카운트다운 후 자동 실행 ───────────────

function AutoReadyView({
  ingredient,
  qty,
  isPending,
  error,
  personalHistory,
  behaviorProfile,
  onCancel,
  onFire,
}: {
  ingredient:       Seed
  qty:              number
  isPending:        boolean
  error:            string | null
  personalHistory?: PricePoint[]
  behaviorProfile?: BehaviorProfile
  onCancel:         () => void
  onFire:           () => void
}) {
  const AUTO_SECONDS = 3
  const [left, setLeft] = useState(AUTO_SECONDS)
  const firedRef = useRef(false)

  // 카운트다운 + 0 되면 자동 발주
  useEffect(() => {
    if (left <= 0) {
      if (!firedRef.current && !isPending) {
        firedRef.current = true
        onFire()
      }
      return
    }
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  const ai = ingredient.current_price
    ? aiEvaluatePrice(ingredient.name, ingredient.unit, ingredient.current_price, {
        monthly_qty:      qty,
        personal_history: personalHistory,
        behavior_profile: behaviorProfile,
        barcode:          ingredient.barcode ?? null,
        brand:            ingredient.brand ?? null,
        parsed_name:      ingredient.parsed_name ?? null,
        possible_duplicate_group_id: ingredient.possible_duplicate_group_id ?? null,
        group_representative_barcode: ingredient.group_representative_barcode ?? null,
        has_barcode_conflict: ingredient.has_barcode_conflict ?? false,
        group_confirmed_same: ingredient.group_confirmed_same ?? false,
      })
    : null

  const progressPct = Math.round(((AUTO_SECONDS - left) / AUTO_SECONDS) * 100)

  return (
    <div>
      <Tag tone="good">AI 자동 실행</Tag>
      <Headline>AI가 조건을 확인했고, 자동으로 진행합니다</Headline>
      <Sub>
        {firedRef.current || left <= 0
          ? '실행 중...'
          : `${left}초 후 실행`}
      </Sub>

      {/* 진행 바 */}
      <div style={{
        marginTop: 14, height: 6,
        background: '#F3F4F6', borderRadius: 6, overflow: 'hidden',
      }}>
        <div style={{
          width: `${progressPct}%`,
          height: '100%',
          background: '#111827',
          transition: 'width 1s linear',
        }} />
      </div>

      {/* 요약 */}
      <div style={{
        marginTop: 12, padding: '10px 12px',
        background: '#F9FAFB', border: '1px solid #e5e7eb',
        borderRadius: 10, fontSize: 12, color: '#374151',
      }}>
        {ingredient.name} · {qty} {ingredient.unit}
        {ingredient.current_price && <> · 단가 {formatKRW(ingredient.current_price)}</>}
        {ai && ai.expected_saving > 0 && (
          <div style={{ marginTop: 2, color: '#B91C1C', fontWeight: 600 }}>
            예상 절약 {formatKRW(ai.expected_saving)}
          </div>
        )}
      </div>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending || firedRef.current}
          style={secondaryBtn}>
          취소
        </button>
        <button
          type="button"
          onClick={() => {
            if (firedRef.current || isPending) return
            firedRef.current = true
            onFire()
          }}
          disabled={isPending || firedRef.current}
          style={{
            ...primaryBtnStyle,
            flex: 2,
            background: (isPending || firedRef.current) ? '#d1d5db' : '#111827',
          }}>
          {isPending ? '요청 중...' : '지금 실행'}
        </button>
      </div>
    </div>
  )
}

// ── RfqConfirmView: "이 조건으로 진행할까요?" ────────────────
// 자동 행동 준비 단계 — 미래에 auto-submit을 붙일 같은 레이어

function RfqConfirmView({
  ingredient,
  qty,
  isPending,
  error,
  personalHistory,
  behaviorProfile,
  onBack,
  onSubmit,
}: {
  ingredient:       Seed
  qty:              number
  isPending:        boolean
  error:            string | null
  personalHistory?: PricePoint[]
  behaviorProfile?: BehaviorProfile
  onBack:           () => void
  onSubmit:         () => void
}) {
  const ai = ingredient.current_price
    ? aiEvaluatePrice(
        ingredient.name, ingredient.unit, ingredient.current_price,
        {
          monthly_qty:      qty,
          supplier_name:    ingredient.supplier_name,
          personal_history: personalHistory,
          behavior_profile: behaviorProfile,
          barcode:          ingredient.barcode ?? null,
          brand:            ingredient.brand ?? null,
          parsed_name:      ingredient.parsed_name ?? null,
          possible_duplicate_group_id: ingredient.possible_duplicate_group_id ?? null,
          group_representative_barcode: ingredient.group_representative_barcode ?? null,
          has_barcode_conflict: ingredient.has_barcode_conflict ?? false,
          group_confirmed_same: ingredient.group_confirmed_same ?? false,
        },
      )
    : null

  const estTotal = (ingredient.current_price ?? 0) * qty

  return (
    <div>
      <Tag>확인</Tag>
      <Headline>이 조건으로 진행할까요?</Headline>
      <Sub>보내기 전에 한 번 더 확인해주세요</Sub>

      {/* 조건 요약 */}
      <div style={{
        marginTop: 12, padding: '12px 14px',
        background: '#F9FAFB', border: '1px solid #e5e7eb',
        borderRadius: 10, fontSize: 13, color: '#111827', lineHeight: 1.8,
      }}>
        <div><span style={label}>품목</span> <strong>{ingredient.name}</strong></div>
        <div><span style={label}>수량</span> <strong>{qty} {ingredient.unit}</strong></div>
        {ingredient.current_price && (
          <div><span style={label}>현재 단가</span> {formatKRW(ingredient.current_price)}</div>
        )}
        {estTotal > 0 && (
          <div><span style={label}>현재 기준 합계</span> {formatKRW(estTotal)}</div>
        )}
      </div>

      {/* AI 판단 재확인 */}
      {ai && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          borderRadius: 10, fontSize: 12, fontWeight: 500,
          background: toneOf(ai.recommendation).bg,
          color:      toneOf(ai.recommendation).fg,
        }}>
          {ai.headline} · {ai.reason}
        </div>
      )}

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={onBack} style={secondaryBtn} type="button" disabled={isPending}>
          수량 다시 입력
        </button>
        <button onClick={onSubmit} disabled={isPending} style={{
          ...primaryBtnStyle,
          flex: 2,
          background: isPending ? '#d1d5db' : '#111827',
        }} type="button">
          {isPending ? '요청 중...' : '견적 요청 보내기'}
        </button>
      </div>
    </div>
  )
}

const label: React.CSSProperties = {
  display: 'inline-block', width: 88, color: '#6b7280', fontSize: 12,
}

// ── 공통 UI 조각 ─────────────────────────────────────────────

function Tag({ children, tone }: { children: React.ReactNode; tone?: 'good' }) {
  const c = tone === 'good'
    ? { bg: '#ECFDF5', fg: '#059669' }
    : { bg: '#F3F4F6', fg: '#374151' }
  return (
    <div style={{
      display: 'inline-block', padding: '3px 10px',
      background: c.bg, color: c.fg,
      borderRadius: 20, fontSize: 11, fontWeight: 600, marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', lineHeight: 1.35 }}>
      {children}
    </div>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 10, padding: '8px 12px',
      background: '#FEF2F2', border: '1px solid #FCA5A5',
      borderRadius: 8, fontSize: 12, color: '#B91C1C',
    }}>{children}</div>
  )
}

function PrimaryBtn(props: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      type={props.type ?? 'button'}
      style={{
        ...primaryBtnStyle,
        marginTop: 14,
        width: '100%',
        background: props.disabled ? '#d1d5db' : '#111827',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
      }}>
      {props.children}
    </button>
  )
}

// ── 스타일 ──────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16,
  border: '1.5px solid #111827', padding: '20px 20px',
}

const input: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  border: '1.5px solid #e5e7eb', borderRadius: 10,
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
  background: '#fff', color: '#111827', fontFamily: 'inherit',
}

const won: React.CSSProperties = {
  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
  fontSize: 13, color: '#9ca3af', pointerEvents: 'none',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '13px', color: '#fff',
  border: 'none', borderRadius: 12,
  fontSize: 15, fontWeight: 700,
  fontFamily: 'inherit', cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  flex: 1, padding: '13px',
  background: '#fff', color: '#374151',
  border: '1px solid #e5e7eb', borderRadius: 12,
  fontSize: 14, fontWeight: 600,
  fontFamily: 'inherit', cursor: 'pointer',
}
