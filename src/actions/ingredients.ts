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
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export async function getIngredients(): Promise<ActionResult<IngredientRow[]>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요', data: [] }

  const { data, error } = await supabase
    .from('ingredients')
    .select('id, tenant_id, name, unit, current_price, target_price, category, memo, is_active, created_at, updated_at')
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
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const name = (input.name ?? '').trim()
  const unit = (input.unit ?? '').trim()
  if (!name) return { success: false, error: '식자재명은 필수입니다.' }
  if (!unit) return { success: false, error: '단위는 필수입니다.' }

  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      tenant_id,
      name,
      unit,
      category: input.category?.trim() || null,
      current_price: input.current_price ?? null,
      target_price: input.target_price ?? null,
      memo: input.memo?.trim() || null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

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
  },
): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const name = (input.name ?? '').trim()
  const unit = (input.unit ?? '').trim()
  if (!name) return { success: false, error: '식자재명은 필수입니다.' }
  if (!unit) return { success: false, error: '단위는 필수입니다.' }

  const { error } = await supabase
    .from('ingredients')
    .update({
      name,
      unit,
      category: input.category?.trim() || null,
      current_price: input.current_price ?? null,
      target_price: input.target_price ?? null,
      memo: input.memo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/ingredients')
  revalidatePath('/today')
  return { success: true }
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

