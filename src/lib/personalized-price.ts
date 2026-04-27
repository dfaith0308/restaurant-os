// ============================================================
// 개인화 AI 평가 레이어
//
// market-reference.ts 의 evaluatePrice() 는 그대로 둔다 (시장 평균 기반 폴백).
// 이 파일은 "이 식당의 실제 구매 히스토리" 기반 평가를 추가한다.
//
// ── 레이어 관계 ──
//   evaluatePrice(name, unit, current)                                   → market 평균 기준
//   personalizedEvaluate(current, history[])                             → 동기, 히스토리 주입형
//   personalizedEvaluatePrice(name, unit, current, tenant_id)            → 비동기, 서버에서 DB 조회
//
// aiEvaluatePrice 는 ctx.personal_history 가 있으면 personalizedEvaluate 를 쓰고,
// 없으면 evaluatePrice 로 폴백한다 — 인터페이스 유지.
// ============================================================

import type { PriceEvaluation, Verdict } from '@/lib/market-reference'
import type { PricePoint } from '@/types'

export const PERSONAL_MIN_SAMPLES = 3   // 이 건수 미만이면 시장 평균으로 폴백

export interface PersonalEvaluation extends PriceEvaluation {
  // ── 개인화 전용 필드 ──
  personal_avg_price:    number
  personal_median:       number
  personal_diff_pct:     number                       // 현재가 vs 개인 평균
  trend:                 'rising' | 'falling' | 'stable'
  volatility:            number                       // 표준편차 / 평균 (0~)
  sample_size:           number
  supplier_stability:    number                       // 최근 3건 동일 공급자 비율 (0~1)
  recent_switch_count:   number                       // 최근 히스토리 중 rfq_request 건수 (사용자 SWITCH 학습 신호)
  recent_order_count:    number                       // 실제 주문 건수 (반복 구매 여부 판단)
}

// ── 동기: 히스토리를 주입받아 계산 (client/server 양쪽에서 호출 가능) ──

export function personalizedEvaluate(
  current: number | null,
  history: PricePoint[],
): PersonalEvaluation | null {
  if (!current || current <= 0)                    return null
  if (!history || history.length < PERSONAL_MIN_SAMPLES) return null

  // 최신순 가정 — price_history 쿼리 시 DESC 로 받음
  const prices = history.map(h => h.price)
  const avg    = mean(prices)
  const med    = median(prices)
  const std    = stddev(prices, avg)
  const vol    = avg > 0 ? std / avg : 0

  const diffPct = avg > 0 ? Math.round(((current - avg) / avg) * 100) : 0

  // 추세 — 최근 절반 평균 vs 오래된 절반 평균 비교
  const half   = Math.max(1, Math.floor(history.length / 2))
  const recent = mean(prices.slice(0, half))
  const older  = mean(prices.slice(half))
  const trendDiff = older > 0 ? (recent - older) / older : 0
  const trend: PersonalEvaluation['trend'] =
    trendDiff >  0.05 ? 'rising'  :
    trendDiff < -0.05 ? 'falling' :
                         'stable'

  // 공급자 일관성 — 최근 3건 중 얼마나 같은 곳인지
  const recentSup = history.slice(0, 3)
    .map(h => h.supplier_name)
    .filter((s): s is string => !!s)
  const uniqSup   = new Set(recentSup).size
  const supplier_stability = recentSup.length === 0
    ? 0
    : 1 - (uniqSup - 1) / recentSup.length   // 3건 다 다르면 0.33, 다 같으면 1

  // verdict — PriceEvaluation 호환 (downstream 유지)
  const verdict: Verdict =
    diffPct >  10 ? 'high'   :
    diffPct < -10 ? 'low'    :
                    'normal'

  const refUnit = history[0]?.unit ?? null

  // 반복 학습 시그널 — 사용자가 과거에 이 품목을 얼마나 SWITCH/주문했는지
  const recent_switch_count = history.filter(h => h.source === 'rfq_request').length
  const recent_order_count  = history.filter(h => h.source === 'order').length

  return {
    // PriceEvaluation 필드 — 동일 shape 유지
    verdict,
    diff_pct:        diffPct,
    avg_price:       Math.round(avg),                 // downstream이 avg_price 로 시장 평균을 기대 → 개인 평균으로 교체
    saving_per_unit: Math.max(0, current - Math.round(avg)),
    ref_key:         `personal:${history.length}건`,
    ref_unit:        refUnit,
    // PersonalEvaluation 전용
    personal_avg_price:  Math.round(avg),
    personal_median:     Math.round(med),
    personal_diff_pct:   diffPct,
    trend,
    volatility:          round2(vol),
    sample_size:         history.length,
    supplier_stability:  round2(supplier_stability),
    recent_switch_count,
    recent_order_count,
  }
}

// ── 비동기: 서버에서 DB 조회 후 계산 ──────────────────────────

export async function personalizedEvaluatePrice(
  name:          string,
  unit:          string,
  current:       number | null,
  tenant_id:     string,
  barcode?:      string | null,
): Promise<PersonalEvaluation | null> {
  if (!current || !tenant_id) return null

  // 서버 전용 import (client bundle 오염 방지)
  const { createServerClient } = await import('@/lib/supabase-server')
  const supabase = await createServerClient()

  // barcode 가 있으면 SKU 기준, 없으면 raw_name fallback
  let query = supabase
    .from('price_history')
    .select('price, unit, supplier_name, created_at, source, barcode')
    .eq('tenant_id', tenant_id)

  query = barcode
    ? query.eq('barcode', barcode)
    : query.eq('ingredient_name', name)

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !data) return null
  return personalizedEvaluate(current, data as PricePoint[])
}

// ── 동일 restaurant 의 여러 식자재 히스토리를 한 번에 조회 ────
//   - barcode 가 있는 ref 는 SKU 기준으로 조회 (정확한 비교)
//   - 없는 ref 는 raw_name 으로 조회 (기존 동작 보존)
//   반환은 항상 ref.name 을 키로 함 — caller 가 name 으로 찾게.

export interface HistoryRef {
  name:      string
  barcode?:  string | null
  group_id?: string | null      // possible_duplicate_group_id — barcode 없을 때 fallback
}

type PriceHistoryRow = {
  id:              string
  ingredient_name: string
  barcode:         string | null
  price:           number
  unit:            string | null
  supplier_name:   string | null
  created_at:      string
  source:          string
}

export async function fetchHistoriesForIngredients(
  tenant_id:     string,
  refs:          HistoryRef[] | string[],      // overload — 기존 string[] 호환
  perNameLimit:  number = 10,
): Promise<Record<string, PricePoint[]>> {
  if (refs.length === 0) return {}

  // string[] → HistoryRef[] 정규화
  const normalized: HistoryRef[] = refs.map(r =>
    typeof r === 'string' ? { name: r, barcode: null, group_id: null } : r,
  )

  const { createServerClient } = await import('@/lib/supabase-server')
  const supabase = await createServerClient()

  const withBarcode = normalized.filter(r => !!r.barcode)
  const withGroupId = normalized.filter(r => !r.barcode && !!r.group_id)
  const nameOnly    = normalized.filter(r => !r.barcode && !r.group_id)

  // ── group_id 가 있는 ref 는 "같은 그룹 형제들의 name/barcode" 를 먼저 수집 ──
  const groupIds = Array.from(new Set(withGroupId.map(r => r.group_id!)))
  const groupMembers: Record<string, { names: Set<string>; barcodes: Set<string> }> = {}
  if (groupIds.length > 0) {
    const { data: sibIngs } = await supabase
      .from('ingredients')
      .select('name, barcode, possible_duplicate_group_id')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .in('possible_duplicate_group_id', groupIds)

    for (const ing of (sibIngs ?? [])) {
      const gid = (ing as { possible_duplicate_group_id: string }).possible_duplicate_group_id
      if (!gid) continue
      if (!groupMembers[gid]) groupMembers[gid] = { names: new Set(), barcodes: new Set() }
      groupMembers[gid].names.add(ing.name)
      if (ing.barcode) groupMembers[gid].barcodes.add(ing.barcode)
    }
  }

  // ── 쿼리 키 집계 ──
  const allBarcodes = new Set<string>()
  for (const r of withBarcode) if (r.barcode) allBarcodes.add(r.barcode)
  for (const gid of Object.keys(groupMembers)) {
    for (const bc of groupMembers[gid].barcodes) allBarcodes.add(bc)
  }
  const allNames = new Set<string>()
  for (const r of nameOnly) allNames.add(r.name)
  for (const gid of Object.keys(groupMembers)) {
    for (const nm of groupMembers[gid].names) allNames.add(nm)
  }

  // ── 두 쿼리 병렬 실행 ──
  const [barcodeRowsRaw, nameRowsRaw] = await Promise.all([
    allBarcodes.size > 0
      ? supabase
          .from('price_history')
          .select('id, ingredient_name, barcode, price, unit, supplier_name, created_at, source')
          .eq('tenant_id', tenant_id)
          .in('barcode', Array.from(allBarcodes))
          .order('created_at', { ascending: false })
          .limit(perNameLimit * Math.max(1, allBarcodes.size))
          .then(r => r.data ?? [])
      : Promise.resolve([] as PriceHistoryRow[]),
    allNames.size > 0
      ? supabase
          .from('price_history')
          .select('id, ingredient_name, barcode, price, unit, supplier_name, created_at, source')
          .eq('tenant_id', tenant_id)
          .in('ingredient_name', Array.from(allNames))
          .order('created_at', { ascending: false })
          .limit(perNameLimit * Math.max(1, allNames.size))
          .then(r => r.data ?? [])
      : Promise.resolve([] as PriceHistoryRow[]),
  ])
  const barcodeRows = barcodeRowsRaw as PriceHistoryRow[]
  const nameRows    = nameRowsRaw    as PriceHistoryRow[]

  const bucket: Record<string, PricePoint[]> = {}

  const mapRow = (row: PriceHistoryRow): PricePoint => ({
    price:         row.price,
    unit:          row.unit,
    supplier_name: row.supplier_name,
    created_at:    row.created_at,
    source:        row.source,
    barcode:       row.barcode,
  })

  // 1. barcode 기반 ref
  for (const r of withBarcode) {
    bucket[r.name] = barcodeRows
      .filter(row => row.barcode === r.barcode)
      .slice(0, perNameLimit)
      .map(mapRow)
  }

  // 2. group_id 기반 ref — 형제들의 barcode OR name 에 매칭되는 모든 행 합쳐서
  for (const r of withGroupId) {
    const sib = groupMembers[r.group_id!] ?? { names: new Set<string>(), barcodes: new Set<string>() }
    const seen = new Set<string>()
    const combined: PriceHistoryRow[] = []
    for (const row of barcodeRows) {
      if (row.barcode && sib.barcodes.has(row.barcode) && !seen.has(row.id)) {
        combined.push(row); seen.add(row.id)
      }
    }
    for (const row of nameRows) {
      if (sib.names.has(row.ingredient_name) && !seen.has(row.id)) {
        combined.push(row); seen.add(row.id)
      }
    }
    combined.sort((a, b) => b.created_at.localeCompare(a.created_at))
    bucket[r.name] = combined.slice(0, perNameLimit).map(mapRow)
  }

  // 3. name only ref
  for (const r of nameOnly) {
    bucket[r.name] = nameRows
      .filter(row => row.ingredient_name === r.name)
      .slice(0, perNameLimit)
      .map(mapRow)
  }

  return bucket
}

// ── 유틸 ─────────────────────────────────────────────────────

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}
function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const m = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m]
}
function stddev(xs: number[], avg?: number): number {
  if (xs.length === 0) return 0
  const m  = avg ?? mean(xs)
  const v  = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length
  return Math.sqrt(v)
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
