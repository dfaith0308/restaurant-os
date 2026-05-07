'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase-server'
import { getTenantId } from '@/lib/get-restaurant'
import type { ActionResult } from '@/types'

export interface MenuIngredientRow {
  id: string
  ingredient_id: string
  ingredient_name: string
  ingredient_unit: string | null
  ingredient_current_price: number | null
  quantity: number
  unit: string | null
}

export interface MenuWithCost {
  id: string
  tenant_id: string
  name: string
  price: number
  category: string | null
  memo: string | null
  is_representative: boolean
  is_active: boolean
  created_at: string
  updated_at: string | null
  ingredients: MenuIngredientRow[]
  calculated_cost: number
  margin_rate: number | null
}

function computeCost(rows: MenuIngredientRow[]): number {
  let sum = 0
  for (const r of rows) {
    const p = r.ingredient_current_price ?? 0
    const q = Number.isFinite(r.quantity) ? r.quantity : 0
    sum += Math.round(p * q)
  }
  return sum
}

function computeMarginRate(price: number, cost: number): number | null {
  if (!Number.isFinite(price) || price <= 0) return null
  return ((price - cost) / price) * 100
}

async function assertRepresentativeLimit(supabase: any, tenant_id: string, nextIsRepresentative: boolean, excludingMenuId?: string) {
  if (!nextIsRepresentative) return

  const q = supabase
    .from('menus')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id)
    .eq('is_active', true)
    .eq('is_representative', true)

  const { count, error } = excludingMenuId
    ? await q.neq('id', excludingMenuId)
    : await q

  if (error) throw new Error(error.message)
  if ((count ?? 0) >= 3) throw new Error('대표메뉴는 최대 3개까지 선택할 수 있습니다.')
}

export async function getMenus(): Promise<ActionResult<MenuWithCost[]>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요', data: [] }

  // menus
  const { data: menusRaw, error: menusErr } = await supabase
    .from('menus')
    .select('id, tenant_id, name, price, category, memo, is_representative, is_active, created_at, updated_at')
    .eq('tenant_id', tenant_id)
    .eq('is_active', true)
    .order('is_representative', { ascending: false })
    .order('created_at', { ascending: false })

  if (menusErr) return { success: false, error: menusErr.message, data: [] }
  const menus = (menusRaw ?? []) as any[]
  const ids = menus.map((m) => m.id).filter(Boolean)
  if (ids.length === 0) return { success: true, data: [] }

  // menu_ingredients join ingredients (current_price)
  const { data: miRaw, error: miErr } = await supabase
    .from('menu_ingredients')
    .select('id, menu_id, ingredient_id, quantity, unit, ingredients(name, unit, current_price)')
    .eq('tenant_id', tenant_id)
    .in('menu_id', ids)

  if (miErr) return { success: false, error: miErr.message, data: [] }

  const byMenu = new Map<string, MenuIngredientRow[]>()
  for (const row of (miRaw ?? []) as any[]) {
    const ingRaw = row.ingredients
    const ing = (Array.isArray(ingRaw) ? ingRaw[0] : ingRaw) as any | null
    const quantityNum = typeof row.quantity === 'number' ? row.quantity : Number(row.quantity ?? 0)
    const item: MenuIngredientRow = {
      id: row.id,
      ingredient_id: row.ingredient_id,
      ingredient_name: ing?.name ?? '(삭제됨)',
      ingredient_unit: ing?.unit ?? null,
      ingredient_current_price: ing?.current_price ?? null,
      quantity: Number.isFinite(quantityNum) ? quantityNum : 0,
      unit: row.unit ?? null,
    }
    const arr = byMenu.get(row.menu_id) ?? []
    // RULE-10 대체: quantity=0인 행은 "삭제 처리"로 간주
    if (item.quantity > 0) arr.push(item)
    byMenu.set(row.menu_id, arr)
  }

  const result: MenuWithCost[] = menus.map((m) => {
    const ingredients = byMenu.get(m.id) ?? []
    const calculated_cost = computeCost(ingredients)
    const margin_rate = computeMarginRate(m.price ?? 0, calculated_cost)
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      name: m.name,
      price: m.price ?? 0,
      category: m.category ?? null,
      memo: m.memo ?? null,
      is_representative: !!m.is_representative,
      is_active: !!m.is_active,
      created_at: m.created_at,
      updated_at: m.updated_at ?? null,
      ingredients,
      calculated_cost,
      margin_rate,
    }
  })

  return { success: true, data: result }
}

export async function createMenu(input: {
  name: string
  category?: string | null
  price: number
  is_representative?: boolean
  memo?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const name = (input.name ?? '').trim()
  if (!name) return { success: false, error: '메뉴명은 필수입니다.' }

  const price = Number.isFinite(input.price) ? Math.max(0, Math.floor(input.price)) : 0
  const isRep = !!input.is_representative

  try {
    await assertRepresentativeLimit(supabase, tenant_id, isRep)
  } catch (e: any) {
    return { success: false, error: e?.message ?? '대표메뉴 제한 오류' }
  }

  const { data, error } = await supabase
    .from('menus')
    .insert({
      tenant_id,
      name,
      price,
      category: input.category?.trim() || null,
      is_representative: isRep,
      is_active: true,
      memo: input.memo?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

  revalidatePath('/settings/menus')
  return { success: true, data: { id: data.id } }
}

export async function updateMenu(
  id: string,
  input: {
    name: string
    category?: string | null
    price: number
    is_representative?: boolean
    memo?: string | null
  },
): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const name = (input.name ?? '').trim()
  if (!name) return { success: false, error: '메뉴명은 필수입니다.' }

  const price = Number.isFinite(input.price) ? Math.max(0, Math.floor(input.price)) : 0
  const isRep = !!input.is_representative

  try {
    await assertRepresentativeLimit(supabase, tenant_id, isRep, id)
  } catch (e: any) {
    return { success: false, error: e?.message ?? '대표메뉴 제한 오류' }
  }

  const { error } = await supabase
    .from('menus')
    .update({
      name,
      price,
      category: input.category?.trim() || null,
      is_representative: isRep,
      memo: input.memo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/settings/menus')
  return { success: true }
}

export async function deactivateMenu(id: string): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const { error } = await supabase
    .from('menus')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/settings/menus')
  return { success: true }
}

export async function addMenuIngredient(input: {
  menu_id: string
  ingredient_id: string
  quantity: number
  unit?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const quantity = Number.isFinite(input.quantity) ? Number(input.quantity) : 0
  if (!input.menu_id) return { success: false, error: 'menu_id가 필요합니다.' }
  if (!input.ingredient_id) return { success: false, error: 'ingredient_id가 필요합니다.' }
  if (!(quantity > 0)) return { success: false, error: '수량은 0보다 커야 합니다.' }

  const { data, error } = await supabase
    .from('menu_ingredients')
    .insert({
      tenant_id,
      menu_id: input.menu_id,
      ingredient_id: input.ingredient_id,
      quantity,
      unit: input.unit?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }
  revalidatePath('/settings/menus')
  return { success: true, data: { id: data.id } }
}

// RULE-10 준수: 물리 삭제 대신 quantity=0으로 "제외" 처리
export async function removeMenuIngredient(id: string): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const { error } = await supabase
    .from('menu_ingredients')
    .update({ quantity: 0 })
    .eq('id', id)
    .eq('tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/settings/menus')
  return { success: true }
}

export async function getMenuCostEstimate(menu_name: string): Promise<ActionResult<{
  menu_name: string
  estimated_cost: number | null
  estimated_ingredients: any | null
  source: 'gpt' | 'internal'
  confidence_level: number | null
  updated_at: string
} | null>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요', data: null }

  const name = (menu_name ?? '').trim()
  if (!name) return { success: true, data: null }

  // 1) exact match
  const { data: exact, error: e1 } = await supabase
    .from('menu_cost_cache')
    .select('menu_name, estimated_cost, estimated_ingredients, source, confidence_level, updated_at')
    .eq('tenant_id', tenant_id)
    .eq('menu_name', name)
    .maybeSingle()

  if (e1) return { success: false, error: e1.message, data: null }
  if (exact) return { success: true, data: exact as any }

  // 2) fallback: ilike first row
  const { data: like, error: e2 } = await supabase
    .from('menu_cost_cache')
    .select('menu_name, estimated_cost, estimated_ingredients, source, confidence_level, updated_at')
    .eq('tenant_id', tenant_id)
    .ilike('menu_name', `%${name}%`)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (e2) return { success: false, error: e2.message, data: null }
  return { success: true, data: (like?.[0] ?? null) as any }
}

