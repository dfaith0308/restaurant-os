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

function normalizeIngredientName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s()[\]{}·.,\-_/\\|"'`~!@#$%^&*+=?:;<>]/g, '')
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

async function insertIngredientPriceHistory(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  tenant_id: string,
  ingredient_id: string,
  price: number,
  effective_from: string,
): Promise<boolean> {
  const { error } = await supabase.from('ingredient_price_history').insert({
    tenant_id,
    ingredient_id,
    price,
    effective_from,
  })
  return !error
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
  const unit = (input.unit ?? '').trim()
  if (!name) return { success: false, error: '식자재명은 필수입니다.' }
  if (!unit) return { success: false, error: '단위는 필수입니다.' }

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
  const unit = (input.unit ?? '').trim()
  if (!name) return { success: false, error: '식자재명은 필수입니다.' }
  if (!unit) return { success: false, error: '단위는 필수입니다.' }

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

  revalidatePath('/settings/ingredients')
  revalidatePath('/today')
  return { success: true }
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
    const unit = (input.unit ?? '').trim() || '개'
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

  const byNorm = new Map<string, IngredientRow>()
  for (const row of (existingRows ?? []) as IngredientRow[]) {
    byNorm.set(normalizeIngredientName(row.name), row)
  }

  const created: IngredientRow[] = []
  const updated: IngredientRow[] = []
  let successCount = 0

  for (const row of rows) {
    const name = (row.name ?? '').trim()
    const unit = (row.unit ?? '').trim() || '개'
    if (!name) continue

    const effective_from = isValidEffectiveDate(row.effective_from)
      ? row.effective_from
      : todayDateString()

    const norm = normalizeIngredientName(name)
    const existing = byNorm.get(norm)

    if (!existing) {
      const current_price = row.price
      const { data, error } = await supabase
        .from('ingredients')
        .insert({
          tenant_id,
          name,
          unit,
          current_price,
          memo: row.memo?.trim() || null,
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
        byNorm.set(norm, ing)
        created.push(ing)
        successCount += 1
      }
      continue
    }

    if (row.mode === 'keep') {
      successCount += 1
      continue
    }

    if (row.mode === 'apply' && row.price != null && row.price > 0) {
      const { data, error } = await supabase
        .from('ingredients')
        .update({
          current_price: row.price,
          updated_at: new Date().toISOString(),
        })
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
        const ing = data as IngredientRow
        byNorm.set(norm, ing)
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
