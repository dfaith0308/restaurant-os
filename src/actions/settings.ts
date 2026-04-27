'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

// ── 식자재 ────────────────────────────────────────────────────

export interface IngredientRow {
  id:             string
  name:           string               // raw_name
  unit:           string
  current_price:  number | null
  supplier_name:  string | null
  // SKU 레이어 (선택)
  parsed_name?:   string | null
  brand?:         string | null
  barcode?:       string | null
  manufacturer?:  string | null
}

export async function getIngredients(
  tenant_id: string,
): Promise<ActionResult<IngredientRow[]>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, unit, current_price, supplier_name, parsed_name, brand, barcode, manufacturer')
    .eq('tenant_id', tenant_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data: data ?? [] }
}

export interface UpsertIngredientInput {
  id?:            string
  tenant_id:      string
  name:           string
  unit:           string
  current_price:  number | null
  supplier_name:  string | null
  // SKU 레이어 (선택) — 있을 때만 DB 에 반영 (기존 값 덮지 않음)
  parsed_name?:   string | null
  brand?:         string | null
  barcode?:       string | null
  manufacturer?:  string | null
}

export async function upsertIngredient(
  input: UpsertIngredientInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()

  // 기본 payload — SKU 필드는 undefined 가 아닌 경우에만 포함 (기존값 보존)
  const payload: Record<string, unknown> = {
    tenant_id:      input.tenant_id,
    name:           input.name,
    unit:           input.unit,
    current_price:  input.current_price,
    supplier_name:  input.supplier_name,
    is_active:      true,
  }
  if (input.parsed_name  !== undefined) payload.parsed_name  = input.parsed_name
  if (input.brand        !== undefined) payload.brand        = input.brand
  if (input.barcode      !== undefined) payload.barcode      = input.barcode
  if (input.manufacturer !== undefined) payload.manufacturer = input.manufacturer

  const query = input.id
    ? supabase.from('ingredients').update(payload).eq('id', input.id).select('id').single()
    : supabase.from('ingredients').insert(payload).select('id').single()

  const { data, error } = await query
  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

  revalidatePath('/settings/ingredients')
  revalidatePath('/today')
  return { success: true, data: { id: data.id } }
}

export async function deleteIngredient(id: string): Promise<ActionResult> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('ingredients')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/ingredients')
  revalidatePath('/today')
  return { success: true }
}

// ── 고정비 ────────────────────────────────────────────────────

export interface FixedCostRow {
  id:     string
  name:   string
  amount: number
  cycle:  string
}

export async function getFixedCosts(
  tenant_id: string,
): Promise<ActionResult<FixedCostRow[]>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('fixed_costs')
    .select('id, name, amount, cycle')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data: data ?? [] }
}

export interface UpsertFixedCostInput {
  id?:           string
  tenant_id:     string
  name:          string
  amount:        number
  cycle?:        string
}

export async function upsertFixedCost(
  input: UpsertFixedCostInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()

  const payload = {
    tenant_id:     input.tenant_id,
    name:          input.name,
    amount:        input.amount,
    cycle:         input.cycle ?? 'monthly',
  }

  const query = input.id
    ? supabase.from('fixed_costs').update(payload).eq('id', input.id).select('id').single()
    : supabase.from('fixed_costs').insert(payload).select('id').single()

  const { data, error } = await query
  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

  revalidatePath('/settings/fixed-costs')
  revalidatePath('/today')
  return { success: true, data: { id: data.id } }
}

export async function deleteFixedCost(id: string): Promise<ActionResult> {
  const supabase = await createServerClient()
  const { error } = await supabase.from('fixed_costs').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/fixed-costs')
  revalidatePath('/today')
  return { success: true }
}
