'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { fetchHistoriesForIngredients } from '@/lib/personalized-price'
import { getRestaurantBehaviorProfile } from '@/lib/behavior-profile'
import { isSimilarForGrouping } from '@/lib/sku'
import type { ActionResult, TodayDashboard, SavingOpportunity } from '@/types'
import { getPendingDeliveries, type PendingDelivery } from '@/actions/orders'

// ── 오늘운영 대시보드 데이터 ──────────────────────────────────

export async function getTodayDashboard(
  restaurant_id: string,
): Promise<ActionResult<TodayDashboard>> {
  const supabase = await createServerClient()

  const in3days = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  const month   = new Date().toISOString().slice(0, 7)

  const [
    { data: payments3d },
    { data: allPayments },
    { data: notifications },
    { count: openRfqsCount },
    { count: rfqTotal },
    { data: savingsThisMonth },
    { data: ingredients },
    { data: openRfqIngredientIds },
    { count: fixedCostCount },
  ] = await Promise.all([
    supabase.from('payments_outgoing')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('status', 'planned')
      .lte('due_date', in3days)
      .order('due_date', { ascending: true }),

    supabase.from('payments_outgoing')
      .select('amount')
      .eq('restaurant_id', restaurant_id)
      .eq('status', 'planned')
      .gte('due_date', `${month}-01`),

    supabase.from('notifications')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase.from('rfq_requests')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant_id)
      .eq('status', 'open'),

    supabase.from('rfq_requests')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant_id),

    supabase.from('savings_stats')
      .select('total_saving')
      .eq('restaurant_id', restaurant_id)
      .eq('month', month)
      .maybeSingle(),

    supabase.from('ingredients')
      .select('id, name, unit, current_price, supplier_name, created_at, barcode, brand, parsed_name, possible_duplicate_group_id, group_confirmed_same_at')
      .eq('restaurant_id', restaurant_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),

    // 이미 open RFQ가 있는 식자재는 절약 제안에서 제외
    supabase.from('rfq_requests')
      .select('ingredient_id')
      .eq('restaurant_id', restaurant_id)
      .eq('status', 'open')
      .not('ingredient_id', 'is', null),

    supabase.from('fixed_costs')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant_id),
  ])

  const activeRfqIds = new Set(
    (openRfqIngredientIds ?? [])
      .map(r => r.ingredient_id)
      .filter((x): x is string => !!x),
  )

  const ingList = ingredients ?? []

  // 오늘 이미 판단한 식자재 제외 (ai_decision_logs 기준)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: todayDecided } = await supabase
    .from('ai_decision_logs')
    .select('ingredient_name')
    .eq('restaurant_id', restaurant_id)
    .gte('created_at', todayStart.toISOString())
  const decidedNames = new Set((todayDecided ?? []).map(r => r.ingredient_name))

  const savingCandidates = ingList
    .filter(i => i.current_price && !activeRfqIds.has(i.id) && !decidedNames.has(i.name))
    .slice(0, 3)

  // 개인화 AI 재료 — 각 후보의 price_history + 식당 성향 프로파일을 병렬 조회
  //   history 조회는 3단 fallback: barcode → possible_duplicate_group_id(siblings) → raw_name
  const [historyByName, behavior_profile] = await Promise.all([
    fetchHistoriesForIngredients(
      restaurant_id,
      savingCandidates.map(i => ({
        name:     i.name,
        barcode:  i.barcode ?? null,
        group_id: i.possible_duplicate_group_id ?? null,
      })),
      10,
    ),
    getRestaurantBehaviorProfile(restaurant_id),
  ])

  // 그룹별 메타 집계 — barcode 셋 / 대표 / 충돌 / 사용자 확정 여부
  const groupBarcodesMap = new Map<string, Set<string>>()
  const groupConfirmedMap = new Map<string, boolean>()
  for (const ing of ingList) {
    const gid = ing.possible_duplicate_group_id
    if (!gid) continue
    if (!groupBarcodesMap.has(gid)) groupBarcodesMap.set(gid, new Set<string>())
    if (ing.barcode) groupBarcodesMap.get(gid)!.add(ing.barcode)
    if (ing.group_confirmed_same_at) groupConfirmedMap.set(gid, true)
  }

  // 대표 barcode — 그룹 안에 barcode 가 "유일"할 때만 설정. 충돌 시 null.
  const groupRepBarcode = new Map<string, string>()
  for (const [gid, set] of groupBarcodesMap) {
    if (set.size === 1) groupRepBarcode.set(gid, Array.from(set)[0])
  }

  // 그룹 형제 수 + 병합 후보 감지
  // - group_member_count: 같은 그룹 ID 를 가진 다른 ingredient 수
  // - merge_candidate: 유사한데 아직 같은 그룹이 아닌 항목 (auto-grouping 이 놓친 경우)
  const savingOpportunities: SavingOpportunity[] = savingCandidates.map(i => {
    const gid = i.possible_duplicate_group_id ?? null
    const groupSiblings = gid
      ? ingList.filter(o => o.id !== i.id && o.possible_duplicate_group_id === gid)
      : []

    let merge_candidate: SavingOpportunity['merge_candidate'] = null
    if (i.brand && i.unit) {
      const cand = ingList.find(o =>
        o.id !== i.id &&
        (o.possible_duplicate_group_id ?? null) !== gid &&
        isSimilarForGrouping(i, o),
      )
      if (cand) {
        merge_candidate = {
          id:            cand.id,
          name:          cand.name,
          brand:         cand.brand ?? null,
          supplier_name: cand.supplier_name,
        }
      }
    }

    // 본인이 이미 barcode 있으면 승급 불필요 → null
    //   본인 barcode 없고 그룹에 유일한 barcode 가 있으면 그걸 대표로 (충돌 시 null)
    const repBarcode = !i.barcode && gid ? (groupRepBarcode.get(gid) ?? null) : null

    // 충돌 / 확정 상태
    const gbSet = gid ? (groupBarcodesMap.get(gid) ?? new Set<string>()) : new Set<string>()
    const group_barcodes = Array.from(gbSet)
    const has_barcode_conflict = group_barcodes.length >= 2
    const group_confirmed_same = gid ? !!groupConfirmedMap.get(gid) : false

    return {
      ingredient_id:    i.id,
      ingredient_name:  i.name,
      unit:             i.unit,
      current_price:    i.current_price!,
      supplier_name:    i.supplier_name,
      personal_history: historyByName[i.name] ?? [],
      barcode:          i.barcode ?? null,
      brand:            i.brand ?? null,
      parsed_name:      i.parsed_name ?? null,
      possible_duplicate_group_id: gid,
      group_member_count: groupSiblings.length,
      group_representative_barcode: repBarcode,
      group_barcodes,
      has_barcode_conflict,
      group_confirmed_same,
      merge_candidate,
    }
  })

  const paymentDue3days = (payments3d ?? []).reduce((s, p) => s + p.amount, 0)
  const paymentTotal    = (allPayments ?? []).reduce((s, p) => s + p.amount, 0)

  // 납품 대기 주문 (confirmed 상태) — 별도 조회
  const pendingDeliveriesResult = await getPendingDeliveries(restaurant_id)
  const pending_deliveries: PendingDelivery[] = pendingDeliveriesResult.data ?? []

  // 전체 누적 절약액 + 완료 횟수 (savings_stats 전월 합산)
  const { data: allStats } = await supabase
    .from('savings_stats')
    .select('total_saving, order_count')
    .eq('restaurant_id', restaurant_id)
  const total_saving_ever  = (allStats ?? []).reduce((s, r) => s + r.total_saving, 0)
  const total_orders_ever  = (allStats ?? []).reduce((s, r) => s + r.order_count, 0)

  return {
    success: true,
    data: {
      payment_due_3days:    paymentDue3days,
      payment_total:        paymentTotal,
      payment_urgent:       payments3d ?? [],
      saving_opportunities: savingOpportunities,
      monthly_saving:       savingsThisMonth?.total_saving ?? 0,
      notifications:        notifications ?? [],
      open_rfqs:            openRfqsCount ?? 0,
      behavior_profile,
      ingredient_count:     ingList.length,
      ingredient_priced:    ingList.filter(i => i.current_price).length,
      fixed_cost_count:     fixedCostCount ?? 0,
      rfq_total:            rfqTotal ?? 0,
      pending_deliveries,
      total_saving_ever,
      total_orders_ever,
    },
  }
}

// ── 지급 완료 처리 ────────────────────────────────────────────

export async function markPaymentPaid(payment_id: string): Promise<ActionResult> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('payments_outgoing')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', payment_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/today')
  revalidatePath('/money')
  return { success: true }
}

// ── 오늘 식자재 빠른 추가 (인라인 온보딩) ───────────────────────

export interface QuickAddIngredientInput {
  restaurant_id: string
  name:          string
  unit:          string
  current_price: number | null
}

export async function quickAddIngredient(
  input: QuickAddIngredientInput,
): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim()) return { success: false, error: '품목명을 입력해주세요' }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      restaurant_id: input.restaurant_id,
      name:          input.name.trim(),
      unit:          input.unit,
      current_price: input.current_price,
      is_active:     true,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

  revalidatePath('/today')
  revalidatePath('/settings/ingredients')
  return { success: true, data: { id: data.id } }
}
