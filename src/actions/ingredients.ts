'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase-server'
import { getTenantId } from '@/lib/get-restaurant'
import type { ActionResult } from '@/types'

export interface IngredientRow {
  id: string
  tenant_id: string
  name: string
  unit: string
  current_price: number | null
  target_price: number | null
  category: string | null
  memo: string | null
  barcode: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

const INGREDIENT_SELECT =
  'id, tenant_id, name, unit, current_price, target_price, category, memo, barcode, is_active, created_at, updated_at'

// 거래명세서 식자재명은 업체마다 표현이 다르다.
// OCR 중복 폭발 방지를 위해 canonical normalize 사용.
const CANONICAL_STRIP_TOKENS = [
  '국내산',
  '수입산',
  '상품',
  '박스',
  'box',
  '깐',
  '특',
  'kg',
  'ea',
  '개',
  'g',
] as const

function normalizeIngredientName(name: string): string {
  let s = name
    .trim()
    .toLowerCase()
    .replace(/[\s()[\]{}·.,\-_/\\|"'`~!@#$%^&*+=?:;<>]/g, '')

  for (const token of CANONICAL_STRIP_TOKENS) {
    s = s.split(token).join('')
  }

  s = s.replace(/\d+/g, '')
  return s
}

function isLikelySameIngredient(a: string, b: string): boolean {
  const left = normalizeIngredientName(a)
  const right = normalizeIngredientName(b)
  if (!left || !right) return false
  return left === right
}

function findCanonicalIngredient(
  pool: IngredientRow[],
  ocrName: string,
): IngredientRow | undefined {
  return pool.find((row) => isLikelySameIngredient(row.name, ocrName))
}

function todayDateString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isValidEffectiveDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  )
}

const UNIT_ALIASES: Record<string, string> = {
  kilogram: 'kg',
  kilograms: 'kg',
  박스: 'box',
  개: 'ea',
}

function normalizeIngredientUnit(unit: string): string {
  const base = unit.trim().toLowerCase()
  if (!base) return ''
  return UNIT_ALIASES[base] ?? base
}

function sanitizeIngredientUnitInput(unit: string | null | undefined): string | null {
  if (unit == null) return null
  const trimmed = unit.trim()
  if (!trimmed || trimmed.length > 20) return null
  const normalized = normalizeIngredientUnit(trimmed)
  return normalized || null
}

function resolveIngredientUnit(unit: string | null | undefined): string {
  return sanitizeIngredientUnitInput(unit) ?? '개'
}

function unitsAreEquivalent(a: string, b: string): boolean {
  return normalizeIngredientUnit(a) === normalizeIngredientUnit(b)
}

// 식자재 가격/unit은 overwrite보다 append-only history 보존이 우선이다.
// 과거 운영 데이터 보호 목적.
async function insertIngredientPriceHistory(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  tenant_id: string,
  ingredient_id: string,
  price: number,
  effective_from: string,
): Promise<void> {
  await supabase.from('ingredient_price_history').insert({
    tenant_id,
    ingredient_id,
    price,
    effective_from,
  })
}

async function insertIngredientUnitHistory(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  tenant_id: string,
  ingredient_id: string,
  unit: string,
  effective_from: string,
): Promise<void> {
  const resolved = resolveIngredientUnit(unit)
  await supabase.from('ingredient_unit_history').insert({
    tenant_id,
    ingredient_id,
    unit: resolved,
    effective_from,
  })
}

async function appendUnitHistoryIfChanged(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  tenant_id: string,
  ingredient_id: string,
  previousUnit: string,
  nextUnit: string,
  effective_from: string,
): Promise<void> {
  if (unitsAreEquivalent(previousUnit, nextUnit)) return
  await insertIngredientUnitHistory(
    supabase,
    tenant_id,
    ingredient_id,
    nextUnit,
    effective_from,
  )
}

// 메뉴 원가는 현재 가격이 아니라
// 계산 기준일 당시 가격 기준으로 계산한다.
// 과거 원가 분석 보호 목적.
export async function getIngredientPriceAtDate(
  ingredientId: string,
  targetDate: string,
): Promise<number | null> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id || !ingredientId) return null
  if (!isValidEffectiveDate(targetDate)) return null

  const { data: historyRow, error: historyError } = await supabase
    .from('ingredient_price_history')
    .select('price')
    .eq('tenant_id', tenant_id)
    .eq('ingredient_id', ingredientId)
    .lte('effective_from', targetDate)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!historyError && historyRow?.price != null) {
    const historyPrice = Number(historyRow.price)
    return Number.isFinite(historyPrice) ? historyPrice : null
  }

  const { data: ingredient, error: ingredientError } = await supabase
    .from('ingredients')
    .select('current_price')
    .eq('tenant_id', tenant_id)
    .eq('id', ingredientId)
    .maybeSingle()

  if (ingredientError || !ingredient) return null
  if (ingredient.current_price == null) return null

  const fallbackPrice = Number(ingredient.current_price)
  return Number.isFinite(fallbackPrice) ? fallbackPrice : null
}

export async function getIngredients(): Promise<ActionResult<IngredientRow[]>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요', data: [] }

  const { data, error } = await supabase
    .from('ingredients')
    .select(INGREDIENT_SELECT)
    .eq('tenant_id', tenant_id)
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data: (data ?? []) as IngredientRow[] }
}

export async function createIngredient(input: {
  name: string
  unit: string
  category?: string | null
  current_price?: number | null
  target_price?: number | null
  memo?: string | null
  barcode?: string | null
  effective_from?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const name = (input.name ?? '').trim()
  const unit = resolveIngredientUnit(input.unit)
  if (!name) return { success: false, error: '식자재명은 필수입니다.' }

  const current_price = input.current_price ?? null
  const effective_from =
    input.effective_from && isValidEffectiveDate(input.effective_from)
      ? input.effective_from
      : todayDateString()

  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      tenant_id,
      name,
      unit,
      category: input.category?.trim() || null,
      current_price,
      target_price: input.target_price ?? null,
      memo: input.memo?.trim() || null,
      barcode: input.barcode?.replace(/\D/g, '').trim() || null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

  if (current_price != null && current_price > 0) {
    await insertIngredientPriceHistory(
      supabase,
      tenant_id,
      data.id,
      current_price,
      effective_from,
    )
  }
  await insertIngredientUnitHistory(
    supabase,
    tenant_id,
    data.id,
    unit,
    effective_from,
  )

  revalidatePath('/settings/ingredients')
  revalidatePath('/today')
  return { success: true, data: { id: data.id } }
}

export async function updateIngredient(
  id: string,
  input: {
    name: string
    unit: string
    category?: string | null
    current_price?: number | null
    target_price?: number | null
    memo?: string | null
    barcode?: string | null
  },
): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const name = (input.name ?? '').trim()
  const unit = resolveIngredientUnit(input.unit)
  if (!name) return { success: false, error: '식자재명은 필수입니다.' }

  const { data: currentRow } = await supabase
    .from('ingredients')
    .select('unit, current_price')
    .eq('id', id)
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  const previousUnit = currentRow?.unit ?? ''
  const previousPrice =
    currentRow?.current_price != null
      ? Number(currentRow.current_price)
      : null
  const nextPrice = input.current_price ?? null
  const effective_from = todayDateString()

  const patch: Record<string, unknown> = {
    name,
    unit,
    category: input.category?.trim() || null,
    current_price: input.current_price ?? null,
    target_price: input.target_price ?? null,
    memo: input.memo?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  if (input.barcode !== undefined) {
    patch.barcode = (input.barcode ?? '').replace(/\D/g, '').trim() || null
  }

  const { error } = await supabase
    .from('ingredients')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }

  await appendUnitHistoryIfChanged(
    supabase,
    tenant_id,
    id,
    previousUnit,
    unit,
    effective_from,
  )

  const priceChanged =
    nextPrice != null &&
    nextPrice > 0 &&
    (previousPrice == null || previousPrice !== nextPrice)
  if (priceChanged) {
    await insertIngredientPriceHistory(
      supabase,
      tenant_id,
      id,
      nextPrice,
      effective_from,
    )
  }

  revalidatePath('/settings/ingredients')
  revalidatePath('/today')
  return { success: true }
}

export type IngredientPriceHistoryEntry = {
  effective_from: string
  price: number
  created_at: string
  supplier_name: string | null
}

export type SupplierPriceComparisonEntry = {
  supplier_name: string
  price: number
  effective_from: string
}

export type OcrActivityEntry = {
  supplier_name: string
  ingredient_name: string
  occurred_at: string
}

export type IngredientOperationMeta = {
  last_price_change_date: string | null
  is_spike_risk: boolean
  price_change_percent: number | null
  price_change_direction: 'up' | 'down' | null
}

export type IngredientsOperationInsights = {
  changed_last_7_days: number
  spike_count: number
  ocr_last_7_days: number
}

export type IngredientsOperationData = {
  priceHistoryByIngredient: Record<string, IngredientPriceHistoryEntry[]>
  supplierComparisonByIngredient: Record<string, SupplierPriceComparisonEntry[]>
  metaByIngredient: Record<string, IngredientOperationMeta>
  invoiceSupplierNames: string[]
  recentOcrActivities: OcrActivityEntry[]
  insights: IngredientsOperationInsights
}

const SUPPLIER_SNAPSHOT_RE = /;공급:([^,]+),(\d{4}-\d{2}-\d{2}),(\d+(?:\.\d+)?)/g

function parseSupplierFromMemo(memo: string | null): string | null {
  if (!memo) return null
  const explicit = memo.match(/공급[:：]\s*([^·\n]+)/)
  if (explicit?.[1]) {
    const name = explicit[1].trim()
    if (name) return name
  }
  if (!memo.includes('거래명세서 OCR')) return null
  const parts = memo.split('·').map((s) => s.trim())
  if (parts.length >= 2) {
    const seg = parts[1]
    if (seg && !seg.startsWith('수량')) return seg
  }
  return null
}

function parseSupplierPriceSnapshots(
  memo: string | null,
): SupplierPriceComparisonEntry[] {
  if (!memo) return []
  const entries: SupplierPriceComparisonEntry[] = []
  const re = new RegExp(SUPPLIER_SNAPSHOT_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(memo)) !== null) {
    const price = Number(match[3])
    if (!Number.isFinite(price)) continue
    entries.push({
      supplier_name: match[1].trim(),
      effective_from: match[2],
      price,
    })
  }
  return entries
}

function appendSupplierPriceSnapshot(
  memo: string,
  supplierName: string,
  effectiveFrom: string,
  price: number,
): string {
  const supplier = supplierName.trim()
  const roundedPrice = Math.round(price)
  const withoutSupplier = memo.replace(
    new RegExp(`;공급:${supplier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\d{4}-\\d{2}-\\d{2},\\d+(?:\\.\\d+)?`, 'g'),
    '',
  )
  return `${withoutSupplier};공급:${supplier},${effectiveFrom},${roundedPrice}`
}

function finalizeIngredientMemoWithSnapshot(
  memo: string | null,
  effectiveFrom: string,
  price: number | null,
): string | null {
  if (!memo) return null
  const supplier = parseSupplierFromMemo(memo)
  if (supplier && price != null && price > 0) {
    return appendSupplierPriceSnapshot(memo, supplier, effectiveFrom, price)
  }
  return memo
}

function isWithinDays(dateStr: string, days: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - days)
  return target >= cutoff
}

function buildSupplierComparison(
  memo: string | null,
  histories: IngredientPriceHistoryEntry[],
): SupplierPriceComparisonEntry[] {
  const bySupplier = new Map<string, SupplierPriceComparisonEntry>()
  for (const snap of parseSupplierPriceSnapshots(memo)) {
    const key = snap.supplier_name.toLowerCase()
    const prev = bySupplier.get(key)
    if (!prev || snap.effective_from > prev.effective_from) {
      bySupplier.set(key, snap)
    }
  }

  const recentSupplier = parseSupplierFromMemo(memo)
  if (recentSupplier && histories.length > 0) {
    const latest = histories[0]
    const key = recentSupplier.toLowerCase()
    const prev = bySupplier.get(key)
    if (!prev || latest.effective_from > prev.effective_from) {
      bySupplier.set(key, {
        supplier_name: recentSupplier,
        price: latest.price,
        effective_from: latest.effective_from,
      })
    }
  }

  return Array.from(bySupplier.values()).sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  )
}

function computeIngredientOperationMeta(
  histories: IngredientPriceHistoryEntry[],
): IngredientOperationMeta {
  const last_price_change_date = histories[0]?.effective_from ?? null
  let is_spike_risk = false
  let price_change_percent: number | null = null
  let price_change_direction: 'up' | 'down' | null = null

  if (histories.length >= 2) {
    const latest = histories[0]
    const prev = histories[1]
    if (prev.price > 0) {
      const delta = (latest.price - prev.price) / prev.price
      price_change_percent = Math.round(delta * 100)
      if (delta > 0) price_change_direction = 'up'
      if (delta < 0) price_change_direction = 'down'
      if (
        isWithinDays(latest.effective_from, 30) &&
        delta >= 0.3
      ) {
        is_spike_risk = true
      }
    }
  }

  return {
    last_price_change_date,
    is_spike_risk,
    price_change_percent,
    price_change_direction,
  }
}

export async function getIngredientsOperationData(): Promise<
  ActionResult<IngredientsOperationData>
> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) {
    return { success: false, error: '인증 필요', data: undefined }
  }

  const { data: ingredients, error: ingError } = await supabase
    .from('ingredients')
    .select('id, name, memo, updated_at')
    .eq('tenant_id', tenant_id)
    .eq('is_active', true)

  if (ingError) {
    return { success: false, error: ingError.message, data: undefined }
  }

  const memoById = new Map(
    (ingredients ?? []).map((row) => [row.id as string, (row.memo as string | null) ?? null]),
  )

  const { data: rawHistories, error: histError } = await supabase
    .from('ingredient_price_history')
    .select('ingredient_id, price, effective_from, created_at')
    .eq('tenant_id', tenant_id)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false })

  if (histError) {
    return { success: false, error: histError.message, data: undefined }
  }

  const fullHistoryByIngredient: Record<string, IngredientPriceHistoryEntry[]> = {}
  const changedLast7DayIds = new Set<string>()

  for (const row of rawHistories ?? []) {
    const ingredientId = row.ingredient_id as string
    const price = Number(row.price)
    if (!Number.isFinite(price)) continue
    const effective_from = row.effective_from as string
    const bucket = fullHistoryByIngredient[ingredientId] ?? []
    bucket.push({
      effective_from,
      price,
      created_at: row.created_at as string,
      supplier_name:
        bucket.length === 0
          ? parseSupplierFromMemo(memoById.get(ingredientId) ?? null)
          : null,
    })
    fullHistoryByIngredient[ingredientId] = bucket
    if (isWithinDays(effective_from, 7)) {
      changedLast7DayIds.add(ingredientId)
    }
  }

  const priceHistoryByIngredient: Record<string, IngredientPriceHistoryEntry[]> = {}
  const supplierComparisonByIngredient: Record<string, SupplierPriceComparisonEntry[]> = {}
  const metaByIngredient: Record<string, IngredientOperationMeta> = {}
  let spike_count = 0

  for (const [ingredientId, histories] of Object.entries(fullHistoryByIngredient)) {
    priceHistoryByIngredient[ingredientId] = histories.slice(0, 5)
    const memo = memoById.get(ingredientId) ?? null
    supplierComparisonByIngredient[ingredientId] = buildSupplierComparison(
      memo,
      histories,
    )
    const meta = computeIngredientOperationMeta(histories)
    metaByIngredient[ingredientId] = meta
    if (meta.is_spike_risk) spike_count += 1
  }

  const recentOcrActivities: OcrActivityEntry[] = (ingredients ?? [])
    .filter((row) => ((row.memo as string | null) ?? '').includes('거래명세서 OCR'))
    .map((row) => {
      const supplier = parseSupplierFromMemo((row.memo as string | null) ?? null)
      if (!supplier) return null
      return {
        supplier_name: supplier,
        ingredient_name: (row.name as string) ?? '',
        occurred_at: (row.updated_at as string | null) ?? '',
      }
    })
    .filter((row): row is OcrActivityEntry => !!row && !!row.occurred_at)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 5)

  let ocr_last_7_days = 0
  for (const row of ingredients ?? []) {
    const memo = (row.memo as string | null) ?? ''
    const updatedAt = row.updated_at as string | null
    if (!memo.includes('거래명세서 OCR') || !updatedAt) continue
    const updatedDate = updatedAt.slice(0, 10)
    if (isWithinDays(updatedDate, 7)) ocr_last_7_days += 1
  }

  const { data: supplierRows, error: supError } = await supabase
    .from('invoice_suppliers')
    .select('supplier_name')
    .eq('tenant_id', tenant_id)
    .order('last_seen_at', { ascending: false })

  if (supError) {
    return { success: false, error: supError.message, data: undefined }
  }

  const invoiceSupplierNames = (supplierRows ?? [])
    .map((r) => (r.supplier_name as string | null)?.trim())
    .filter((name): name is string => !!name)

  return {
    success: true,
    data: {
      priceHistoryByIngredient,
      supplierComparisonByIngredient,
      metaByIngredient,
      invoiceSupplierNames,
      recentOcrActivities,
      insights: {
        changed_last_7_days: changedLast7DayIds.size,
        spike_count,
        ocr_last_7_days,
      },
    },
  }
}

export type CreateIngredientInput = {
  name: string
  unit: string
  category?: string | null
  current_price?: number | null
  target_price?: number | null
  memo?: string | null
  barcode?: string | null
  effective_from?: string | null
}

export async function createIngredientsBatch(
  inputs: CreateIngredientInput[],
): Promise<ActionResult<{ successCount: number; created: IngredientRow[] }>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const created: IngredientRow[] = []
  let successCount = 0

  for (const input of inputs) {
    const name = (input.name ?? '').trim()
    const unit = resolveIngredientUnit(input.unit)
    if (!name) continue

    const current_price = input.current_price ?? null
    const effective_from =
      input.effective_from && isValidEffectiveDate(input.effective_from)
        ? input.effective_from
        : todayDateString()

    const { data, error } = await supabase
      .from('ingredients')
      .insert({
        tenant_id,
        name,
        unit,
        category: input.category?.trim() || null,
        current_price,
        target_price: input.target_price ?? null,
        memo: input.memo?.trim() || null,
        barcode: input.barcode?.replace(/\D/g, '').trim() || null,
        is_active: true,
      })
      .select(INGREDIENT_SELECT)
      .single()

    if (!error && data) {
      if (current_price != null && current_price > 0) {
        await insertIngredientPriceHistory(
          supabase,
          tenant_id,
          data.id,
          current_price,
          effective_from,
        )
      }
      await insertIngredientUnitHistory(
        supabase,
        tenant_id,
        data.id,
        unit,
        effective_from,
      )
      successCount += 1
      created.push(data as IngredientRow)
    }
  }

  if (successCount > 0) {
    revalidatePath('/settings/ingredients')
    revalidatePath('/today')
  }

  return { success: true, data: { successCount, created } }
}

export type InvoiceRegisterRowInput = {
  name: string
  unit: string
  price: number | null
  memo?: string | null
  mode: 'new' | 'apply' | 'keep'
  effective_from: string
}

export async function registerInvoiceIngredients(
  rows: InvoiceRegisterRowInput[],
): Promise<
  ActionResult<{
    successCount: number
    created: IngredientRow[]
    updated: IngredientRow[]
  }>
> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const { data: existingRows, error: loadError } = await supabase
    .from('ingredients')
    .select(INGREDIENT_SELECT)
    .eq('tenant_id', tenant_id)
    .eq('is_active', true)

  if (loadError) return { success: false, error: loadError.message }

  const ingredientPool: IngredientRow[] = [
    ...((existingRows ?? []) as IngredientRow[]),
  ]

  const created: IngredientRow[] = []
  const updated: IngredientRow[] = []
  let successCount = 0

  for (const row of rows) {
    const name = (row.name ?? '').trim()
    const unit = resolveIngredientUnit(row.unit)
    if (!name) continue

    const effective_from = isValidEffectiveDate(row.effective_from)
      ? row.effective_from
      : todayDateString()

    const existing = findCanonicalIngredient(ingredientPool, name)

    if (!existing) {
      const current_price = row.price
      const { data, error } = await supabase
        .from('ingredients')
        .insert({
          tenant_id,
          name,
          unit,
          current_price,
          memo: finalizeIngredientMemoWithSnapshot(
            row.memo?.trim() || null,
            effective_from,
            current_price,
          ),
          is_active: true,
        })
        .select(INGREDIENT_SELECT)
        .single()

      if (!error && data) {
        const ing = data as IngredientRow
        if (current_price != null && current_price > 0) {
          await insertIngredientPriceHistory(
            supabase,
            tenant_id,
            ing.id,
            current_price,
            effective_from,
          )
        }
        await insertIngredientUnitHistory(
          supabase,
          tenant_id,
          ing.id,
          unit,
          effective_from,
        )
        ingredientPool.push(ing)
        created.push(ing)
        successCount += 1
      }
      continue
    }

    const unitChanged = !unitsAreEquivalent(existing.unit, unit)

    if (row.mode === 'keep') {
      if (unitChanged) {
        const { data, error } = await supabase
          .from('ingredients')
          .update({
            unit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('tenant_id', tenant_id)
          .select(INGREDIENT_SELECT)
          .single()

        if (!error && data) {
          await appendUnitHistoryIfChanged(
            supabase,
            tenant_id,
            existing.id,
            existing.unit,
            unit,
            effective_from,
          )
          const ing = data as IngredientRow
          const poolIdx = ingredientPool.findIndex((r) => r.id === existing.id)
          if (poolIdx >= 0) {
            ingredientPool[poolIdx] = ing
          }
        }
      }
      successCount += 1
      continue
    }

    if (row.mode === 'apply' && row.price != null && row.price > 0) {
      const patch: Record<string, unknown> = {
        current_price: row.price,
        updated_at: new Date().toISOString(),
      }
      const baseMemo = row.memo?.trim() || existing.memo
      if (baseMemo) {
        patch.memo = finalizeIngredientMemoWithSnapshot(
          baseMemo,
          effective_from,
          row.price,
        )
      }
      if (unitChanged) {
        patch.unit = unit
      }

      const { data, error } = await supabase
        .from('ingredients')
        .update(patch)
        .eq('id', existing.id)
        .eq('tenant_id', tenant_id)
        .select(INGREDIENT_SELECT)
        .single()

      if (!error && data) {
        await insertIngredientPriceHistory(
          supabase,
          tenant_id,
          existing.id,
          row.price,
          effective_from,
        )
        if (unitChanged) {
          await appendUnitHistoryIfChanged(
            supabase,
            tenant_id,
            existing.id,
            existing.unit,
            unit,
            effective_from,
          )
        }
        const ing = data as IngredientRow
        const poolIdx = ingredientPool.findIndex((r) => r.id === existing.id)
        if (poolIdx >= 0) {
          ingredientPool[poolIdx] = ing
        } else {
          ingredientPool.push(ing)
        }
        updated.push(ing)
        successCount += 1
      }
    }
  }

  if (successCount > 0) {
    revalidatePath('/settings/ingredients')
    revalidatePath('/today')
  }

  return { success: true, data: { successCount, created, updated } }
}

export type InvoiceSupplierOcrInput = {
  supplier_name: string | null
  phone: string | null
  business_number: string | null
  address: string | null
}

function normalizeSupplierName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\(주\)|주식회사/g, '')
    .replace(/[\s()[\]{}·.,\-_/\\|"'`~!@#$%^&*+=?:;<>]/g, '')
}

export async function upsertInvoiceSupplierFromOcr(
  supplier: InvoiceSupplierOcrInput | null,
): Promise<void> {
  const supplierName = supplier?.supplier_name?.trim()
  if (!supplier || !supplierName) return

  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return

  const normalized_name = normalizeSupplierName(supplierName)
  if (!normalized_name) return

  const now = new Date().toISOString()
  const phone = supplier.phone?.trim() || null
  const business_number = supplier.business_number?.trim() || null
  const address = supplier.address?.trim() || null

  const { data: existing, error: loadError } = await supabase
    .from('invoice_suppliers')
    .select('id, supplier_name, phone, business_number, address, bank_info')
    .eq('tenant_id', tenant_id)
    .eq('normalized_name', normalized_name)
    .maybeSingle()

  if (loadError) return

  if (!existing) {
    await supabase.from('invoice_suppliers').insert({
      tenant_id,
      normalized_name,
      supplier_name: supplierName,
      phone,
      business_number,
      address,
      bank_info: null,
      first_seen_at: now,
      last_seen_at: now,
    })
    return
  }

  const patch: Record<string, string> = {
    last_seen_at: now,
  }
  if (!existing.supplier_name?.trim()) patch.supplier_name = supplierName
  if (!existing.phone?.trim() && phone) patch.phone = phone
  if (!existing.business_number?.trim() && business_number) {
    patch.business_number = business_number
  }
  if (!existing.address?.trim() && address) patch.address = address

  await supabase
    .from('invoice_suppliers')
    .update(patch)
    .eq('id', existing.id)
    .eq('tenant_id', tenant_id)
}

export async function deactivateIngredient(id: string): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const { error } = await supabase
    .from('ingredients')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/ingredients')
  revalidatePath('/today')
  return { success: true }
}
