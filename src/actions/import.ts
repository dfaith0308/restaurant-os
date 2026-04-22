'use server'

// ============================================================
// 자동 수집 레이어
//
// 파일 업로드(거래명세표/제품 뒷면)에서 파싱된 결과를 ingredients 로 반영.
// SKU 매칭 우선순위: barcode → brand+parsed_name+unit → raw_name (matchSku 참고)
// ============================================================

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { matchSku, isSimilarForGrouping, type SkuIdentity } from '@/lib/sku'
import type { ActionResult } from '@/types'

export interface ImportIngredientRow {
  name:          string               // raw_name
  unit:          string
  current_price: number
  supplier_name: string
  // SKU 레이어 (선택)
  parsed_name?:  string | null
  brand?:        string | null
  barcode?:      string | null
  manufacturer?: string | null
}

export interface ImportResult {
  created:         number
  updated:         number
  failed:          number
  created_ids:     string[]
  supplier_seeded: boolean   // 거래처도 자동 생성했는지
}

export async function importIngredients(
  restaurant_id: string,
  rows:          ImportIngredientRow[],
): Promise<ActionResult<ImportResult>> {
  const cleanRows = rows.filter(r => r.name.trim() && r.unit && r.current_price > 0)
  if (cleanRows.length === 0) {
    return { success: false, error: '가져올 항목이 없어요' }
  }

  const supabase = await createServerClient()

  let created = 0
  let updated = 0
  let failed  = 0
  const created_ids: string[] = []
  const supplierNames = new Set<string>()

  // price_history 누적용 버퍼 — 한 번에 INSERT
  const historyRows: {
    restaurant_id:   string
    ingredient_name: string
    price:           number
    unit:            string
    supplier_name:   string
    source:          string
    barcode:         string | null
  }[] = []

  // ── SKU 매칭용: 같은 식당의 active 식자재 목록 한 번에 조회 ──
  const { data: existingAll } = await supabase
    .from('ingredients')
    .select('id, name, parsed_name, brand, unit, barcode, manufacturer, possible_duplicate_group_id')
    .eq('restaurant_id', restaurant_id)
    .eq('is_active', true)

  const existingList = (existingAll ?? []) as Array<SkuIdentity & { id: string }>
  const touchedIds: string[] = []

  for (const row of cleanRows) {
    supplierNames.add(row.supplier_name)

    const candidate: SkuIdentity = {
      name:         row.name.trim(),
      parsed_name:  row.parsed_name ?? null,
      brand:        row.brand ?? null,
      unit:         row.unit,
      barcode:      row.barcode ?? null,
      manufacturer: row.manufacturer ?? null,
    }
    const existing = matchSku(candidate, existingList)

    if (existing) {
      // SKU 필드는 COALESCE 스타일 — 신규 값이 있으면 채우고, 없으면 기존값 보존
      const patch: Record<string, unknown> = {
        unit:          row.unit,
        current_price: row.current_price,
        supplier_name: row.supplier_name,
      }
      if (row.parsed_name  != null) patch.parsed_name  = row.parsed_name
      if (row.brand        != null) patch.brand        = row.brand
      if (row.barcode      != null) patch.barcode      = row.barcode
      if (row.manufacturer != null) patch.manufacturer = row.manufacturer

      const { error } = await supabase.from('ingredients').update(patch).eq('id', existing.id)
      if (error) failed++
      else       { updated++; touchedIds.push(existing.id) }
    } else {
      const { data: inserted, error } = await supabase
        .from('ingredients')
        .insert({
          restaurant_id,
          name:          row.name.trim(),
          unit:          row.unit,
          current_price: row.current_price,
          supplier_name: row.supplier_name,
          parsed_name:   row.parsed_name  ?? null,
          brand:         row.brand        ?? null,
          barcode:       row.barcode      ?? null,
          manufacturer:  row.manufacturer ?? null,
          is_active:     true,
        })
        .select('id, name, parsed_name, brand, unit, barcode, manufacturer')
        .single()
      if (error || !inserted) failed++
      else {
        created++
        created_ids.push(inserted.id)
        touchedIds.push(inserted.id)
        // 같은 import 안에서 뒤따르는 행이 이 row 와 같은 SKU 일 수 있으므로 existingList 에 추가
        existingList.push(inserted as SkuIdentity & { id: string })
      }
    }

    // price_history — barcode 가 있으면 같이 기록 (SKU 기준 조회용)
    historyRows.push({
      restaurant_id,
      ingredient_name: row.name.trim(),
      price:           row.current_price,
      unit:            row.unit,
      supplier_name:   row.supplier_name,
      source:          'import',
      barcode:         row.barcode ?? null,
    })
  }

  // price_history 일괄 insert — 실패해도 ingredient 반영은 유지
  if (historyRows.length > 0) {
    await supabase.from('price_history').insert(historyRows)
  }

  // ── 자동 그룹핑 패스 — 방금 건드린 항목과 유사한 다른 항목을 그룹으로 묶음 ──
  if (touchedIds.length > 0) {
    await applyAutoGrouping(supabase, restaurant_id, touchedIds)
  }

  // 거래처도 자동 시드 (없는 경우만)
  let supplier_seeded = false
  for (const sname of supplierNames) {
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .eq('name', sname)
      .eq('is_active', true)
      .maybeSingle()
    if (!existing) {
      await supabase.from('suppliers').insert({
        restaurant_id,
        name:      sname,
        is_active: true,
      })
      supplier_seeded = true
    }
  }

  revalidatePath('/today')
  revalidatePath('/settings/ingredients')
  revalidatePath('/suppliers')

  return {
    success: true,
    data: { created, updated, failed, created_ids, supplier_seeded },
  }
}

// ── 제품 뒷면 사진에서 SKU 만 등록 (가격 없이) ────────────────
// 사용자가 제품 뒷면 사진을 올려 OCR 로 브랜드/바코드가 뽑혔을 때 사용.
// 같은 SKU 가 이미 있으면 SKU 메타만 보강, 없으면 current_price=null 스텁 생성.
export interface RegisterSkuInput {
  restaurant_id: string
  name:          string
  parsed_name:   string
  brand:         string
  unit:          string
  barcode:       string
  manufacturer:  string
}

export async function registerSku(
  input: RegisterSkuInput,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  if (!input.name.trim() || !input.barcode.trim()) {
    return { success: false, error: '제품 정보가 부족해요' }
  }

  const supabase = await createServerClient()

  // barcode 우선 — 같은 SKU 이미 있는지
  const { data: existingAll } = await supabase
    .from('ingredients')
    .select('id, name, parsed_name, brand, unit, barcode, manufacturer')
    .eq('restaurant_id', input.restaurant_id)
    .eq('is_active', true)

  const existing = matchSku(
    {
      name:         input.name,
      parsed_name:  input.parsed_name,
      brand:        input.brand,
      unit:         input.unit,
      barcode:      input.barcode,
      manufacturer: input.manufacturer,
    },
    (existingAll ?? []) as Array<SkuIdentity & { id: string }>,
  )

  if (existing) {
    // 기존 row 가 있으면 SKU 메타만 채움 (current_price 건드리지 않음)
    await supabase.from('ingredients').update({
      parsed_name:  input.parsed_name,
      brand:        input.brand,
      unit:         input.unit,
      barcode:      input.barcode,
      manufacturer: input.manufacturer,
    }).eq('id', existing.id)
    revalidatePath('/today')
    revalidatePath('/settings/ingredients')
    return { success: true, data: { id: existing.id, created: false } }
  }

  const { data: inserted, error } = await supabase
    .from('ingredients')
    .insert({
      restaurant_id: input.restaurant_id,
      name:          input.name.trim(),
      unit:          input.unit,
      current_price: null,
      supplier_name: null,
      parsed_name:   input.parsed_name,
      brand:         input.brand,
      barcode:       input.barcode,
      manufacturer:  input.manufacturer,
      is_active:     true,
    })
    .select('id')
    .single()

  if (error || !inserted) return { success: false, error: error?.message ?? 'SKU 등록 실패' }

  // 새 SKU 도 자동 그룹핑 시도
  await applyAutoGrouping(supabase, input.restaurant_id, [inserted.id])

  revalidatePath('/today')
  revalidatePath('/settings/ingredients')
  return { success: true, data: { id: inserted.id, created: true } }
}

// ── 자동 그룹핑: touched 항목들을 기준으로 유사 항목과 묶기 ─────
//   규칙 (isSimilarForGrouping): 같은 brand + 같은 unit + parsed_name/name 부분일치
//   동일 그룹 ID 이면 그대로, 다르거나 없으면 동일 ID 로 맞춤.
type IngRow = SkuIdentity & { id: string; possible_duplicate_group_id?: string | null }

async function applyAutoGrouping(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  restaurant_id: string,
  touchedIds:    string[],
): Promise<void> {
  const { data: all } = await supabase
    .from('ingredients')
    .select('id, name, parsed_name, brand, unit, barcode, possible_duplicate_group_id')
    .eq('restaurant_id', restaurant_id)
    .eq('is_active', true)

  const rows = (all ?? []) as IngRow[]
  const touched = rows.filter(r => touchedIds.includes(r.id))

  for (const t of touched) {
    // 그룹 조건의 최소값이 없으면 skip (브랜드 또는 단위 누락)
    if (!t.brand || !t.unit) continue
    const similar = rows.filter(other =>
      other.id !== t.id && isSimilarForGrouping(t, other),
    )
    if (similar.length === 0) continue

    const cluster = [t, ...similar]
    const existingGids = cluster
      .map(x => x.possible_duplicate_group_id)
      .filter((g): g is string => !!g)

    // 기존 group_id 가 있으면 첫 번째 사용, 없으면 신규 생성
    const groupId = existingGids[0] ?? crypto.randomUUID()
    const toUpdate = cluster
      .filter(x => x.possible_duplicate_group_id !== groupId)
      .map(x => x.id)

    if (toUpdate.length > 0) {
      await supabase
        .from('ingredients')
        .update({ possible_duplicate_group_id: groupId })
        .in('id', toUpdate)
      // 로컬 상태도 맞춰둠 (후속 touched 에 반영)
      for (const x of cluster) x.possible_duplicate_group_id = groupId
    }
  }
}

// ── 사용자 수동 병합: 여러 ingredient 를 동일 그룹으로 ─────────
//   - 하나라도 group_id 가 있으면 그걸 재사용 (union-find 단순화)
//   - 없으면 신규 UUID 생성
export async function mergeIngredients(
  restaurant_id: string,
  ingredient_ids: string[],
): Promise<ActionResult<{ group_id: string; updated: number }>> {
  if (!restaurant_id || ingredient_ids.length < 2) {
    return { success: false, error: '병합할 항목이 2개 이상 필요해요' }
  }

  const supabase = await createServerClient()

  const { data: rows } = await supabase
    .from('ingredients')
    .select('id, possible_duplicate_group_id')
    .eq('restaurant_id', restaurant_id)
    .in('id', ingredient_ids)

  const list = (rows ?? []) as Array<{ id: string; possible_duplicate_group_id: string | null }>
  if (list.length < 2) return { success: false, error: '대상 항목을 찾지 못했어요' }

  const existingGid = list.map(r => r.possible_duplicate_group_id).find((g): g is string => !!g)
  const group_id   = existingGid ?? crypto.randomUUID()

  const toUpdate = list
    .filter(r => r.possible_duplicate_group_id !== group_id)
    .map(r => r.id)

  if (toUpdate.length > 0) {
    const { error } = await supabase
      .from('ingredients')
      .update({ possible_duplicate_group_id: group_id })
      .in('id', toUpdate)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/today')
  revalidatePath('/settings/ingredients')
  return { success: true, data: { group_id, updated: toUpdate.length } }
}

// ── 그룹 → 정확 SKU 승급 ────────────────────────────────────
//   - group_id 에 속한 항목 중 target_barcode 를 가진 항목이 실제로 있어야 함 (검증)
//   - 그룹 안 barcode 가 null 인 항목에만 target_barcode 복사 (기존 barcode 절대 덮지 않음)
//   - price_history 도 barcode=null AND ingredient_name IN (해당 항목들) 행을 target_barcode 로 백필
//   - 반드시 사용자 승인 뒤에만 호출 (UI 버튼)
export async function promoteGroupToExact(
  restaurant_id: string,
  group_id:      string,
  target_barcode: string,
): Promise<ActionResult<{ ingredients_updated: number; history_backfilled: boolean }>> {
  if (!restaurant_id || !group_id || !target_barcode.trim()) {
    return { success: false, error: '그룹 / 대표 바코드가 필요해요' }
  }

  const supabase = await createServerClient()

  // 1. 검증 — 그룹에 해당 barcode 실제로 존재하는지
  const { data: groupIngs } = await supabase
    .from('ingredients')
    .select('id, name, barcode')
    .eq('restaurant_id', restaurant_id)
    .eq('possible_duplicate_group_id', group_id)
    .eq('is_active', true)

  const list = (groupIngs ?? []) as Array<{ id: string; name: string; barcode: string | null }>
  const hasAnchor = list.some(i => i.barcode === target_barcode)
  if (!hasAnchor) {
    return { success: false, error: '그룹 안에 해당 바코드가 없어요' }
  }

  // 2. barcode 가 null 인 sibling 만 target 으로 통일 (기존 다른 barcode 보존)
  const toUpdate = list.filter(i => !i.barcode).map(i => i.id)
  let ingredients_updated = 0
  if (toUpdate.length > 0) {
    const { error } = await supabase
      .from('ingredients')
      .update({ barcode: target_barcode })
      .in('id', toUpdate)
    if (error) return { success: false, error: error.message }
    ingredients_updated = toUpdate.length
  }

  // 3. price_history 백필 — 같은 식당 + barcode IS NULL + ingredient_name 이 그룹 형제 이름이면 target 부여
  const namesToBackfill = list.filter(i => !i.barcode || i.barcode === target_barcode).map(i => i.name)
  let history_backfilled = false
  if (namesToBackfill.length > 0) {
    const { error } = await supabase
      .from('price_history')
      .update({ barcode: target_barcode })
      .eq('restaurant_id', restaurant_id)
      .is('barcode', null)
      .in('ingredient_name', namesToBackfill)
    history_backfilled = !error
  }

  revalidatePath('/today')
  revalidatePath('/settings/ingredients')
  return { success: true, data: { ingredients_updated, history_backfilled } }
}

// ── 바코드 충돌 확정 승인 ────────────────────────────────────
//   여러 barcode 가 있지만 사용자가 "같은 상품이다" 라고 승인 → group_confirmed_same_at 세팅
//   barcode 는 건드리지 않음. grouped 상태로 유지됨.
export async function confirmSameProduct(
  restaurant_id: string,
  group_id:      string,
): Promise<ActionResult<{ updated: number }>> {
  if (!restaurant_id || !group_id) {
    return { success: false, error: '그룹 ID 가 필요해요' }
  }
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('ingredients')
    .update({ group_confirmed_same_at: new Date().toISOString() })
    .eq('restaurant_id', restaurant_id)
    .eq('possible_duplicate_group_id', group_id)
    .eq('is_active', true)
    .select('id')
  if (error) return { success: false, error: error.message }

  revalidatePath('/today')
  revalidatePath('/settings/ingredients')
  return { success: true, data: { updated: (data ?? []).length } }
}

// ── 그룹 분리 — 충돌로 "다른 상품" 으로 판정한 경우 ─────────────
//   지정 ingredient 를 기존 그룹에서 떼어 새 group_id 부여.
//   분리된 항목도 group_confirmed_same_at 세팅 (이제 혼자이므로 "검토 완료" 상태).
export async function splitFromGroup(
  restaurant_id: string,
  ingredient_id: string,
): Promise<ActionResult<{ new_group_id: string }>> {
  if (!restaurant_id || !ingredient_id) {
    return { success: false, error: 'ingredient ID 가 필요해요' }
  }
  const supabase = await createServerClient()
  const new_group_id = crypto.randomUUID()
  const { error } = await supabase
    .from('ingredients')
    .update({
      possible_duplicate_group_id: new_group_id,
      group_confirmed_same_at:     new Date().toISOString(),
    })
    .eq('restaurant_id', restaurant_id)
    .eq('id', ingredient_id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/today')
  revalidatePath('/settings/ingredients')
  return { success: true, data: { new_group_id } }
}
