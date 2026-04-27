'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

// ── 매장 정보 (tenants 테이블 기반 — realmyos DB 단일화 구조) ──

export interface RestaurantInfo {
  id:             string
  name:           string
  region:         string | null
  owner_name:     string | null
  phone:          string | null
  table_2p:       number
  table_4p:       number
  seating_config: SeatingType[] | null
}

export interface SeatingType {
  name:  string
  seats: number
  count: number
}

export async function getRestaurant(
  tenant_id: string,
): Promise<ActionResult<RestaurantInfo>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, region, name_id, phone')
    .eq('id', tenant_id)
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '조회 실패' }

  return {
    success: true,
    data: {
      id:             data.id,
      name:           data.name,
      region:         data.region ?? null,
      owner_name:     data.name_id ?? null,   // name_id → owner_name 매핑
      phone:          data.phone ?? null,
      table_2p:       0,
      table_4p:       0,
      seating_config: null,
    }
  }
}

export interface UpdateRestaurantInput {
  id:          string
  name?:       string
  region?:     string | null
  owner_name?: string | null
  phone?:      string | null
}

export async function updateRestaurant(
  input: UpdateRestaurantInput,
): Promise<ActionResult> {
  const supabase = await createServerClient()
  const payload: Record<string, unknown> = {}
  if (input.name       !== undefined) payload.name    = input.name
  if (input.region     !== undefined) payload.region  = input.region
  if (input.owner_name !== undefined) payload.name_id = input.owner_name  // owner_name → name_id
  if (input.phone      !== undefined) payload.phone   = input.phone

  const { error } = await supabase
    .from('tenants')
    .update(payload)
    .eq('id', input.id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ── 메뉴 ──────────────────────────────────────────────────────

export interface MenuRow {
  id:          string
  name:        string
  price:       number
  is_featured: boolean
}

export async function getMenus(
  tenant_id: string,
): Promise<ActionResult<MenuRow[]>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('menus')
    .select('id, name, price, is_featured')
    .eq('tenant_id', tenant_id)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return { success: true, data: [] }
  return { success: true, data: data ?? [] }
}

export interface CreateMenuInput {
  tenant_id:    string
  name:         string
  price:        number
  is_featured?: boolean
}

export async function createMenu(
  input: CreateMenuInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('menus')
    .insert({
      tenant_id:   input.tenant_id,
      name:        input.name,
      price:       input.price,
      is_featured: input.is_featured ?? false,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }
  revalidatePath('/settings')
  return { success: true, data: { id: data.id } }
}
