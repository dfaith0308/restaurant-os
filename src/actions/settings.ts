'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'
import { getTenantId } from '@/lib/get-restaurant'

// ── 식자재 ────────────────────────────────────────────────────

export interface IngredientRow {
  id:             string
  name:           string               // raw_name
  unit:           string
  current_price:  number | null
  // 아래 필드는 운영 ingredients 에 컬럼이 없어 조회하지 않는다. 항상 undefined 다.
  // 값을 지어내지 않고 필드 자체를 비워 둔다. @see INGREDIENT_SKU_LAYER_ENABLED
  supplier_name?: string | null
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
    .select('id, name, unit, current_price')
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
  // 아래 필드는 운영 ingredients 에 컬럼이 없어 저장되지 않는다. 호출부 시그니처는
  // 유지하되 payload 에는 싣지 않는다. @see INGREDIENT_SKU_LAYER_ENABLED
  supplier_name?: string | null
  parsed_name?:   string | null
  brand?:         string | null
  barcode?:       string | null
  manufacturer?:  string | null
}

export async function upsertIngredient(
  input: UpsertIngredientInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()

  // 운영 ingredients 에 실제로 존재하는 컬럼만 싣는다.
  const payload: Record<string, unknown> = {
    tenant_id:      input.tenant_id,
    name:           input.name,
    unit:           input.unit,
    current_price:  input.current_price,
    is_active:      true,
  }

  const query = input.id
    ? supabase.from('ingredients').update(payload).eq('id', input.id).eq('tenant_id', input.tenant_id).select('id').single()
    : supabase.from('ingredients').insert(payload).select('id').single()

  const { data, error } = await query
  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

  revalidatePath('/settings/ingredients')
  revalidatePath('/today')
  return { success: true, data: { id: data.id } }
}

export async function deleteIngredient(id: string): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }
  const { error } = await supabase
    .from('ingredients')
    .update({ is_active: false })
    .eq('id', id)
    .eq('tenant_id', tenant_id)

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
    .eq('is_active', true)
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
    ? supabase.from('fixed_costs').update(payload).eq('id', input.id).eq('tenant_id', input.tenant_id).select('id').single()
    : supabase.from('fixed_costs').insert(payload).select('id').single()

  const { data, error } = await query
  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

  revalidatePath('/settings/fixed-costs')
  revalidatePath('/today')
  return { success: true, data: { id: data.id } }
}

export async function deleteFixedCost(id: string): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const { error } = await supabase
    .from('fixed_costs')
    .update({ is_active: false })
    .eq('tenant_id', tenant_id)
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/fixed-costs')
  revalidatePath('/today')
  return { success: true }
}
