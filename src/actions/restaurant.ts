'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

// ── 매장 정보 ─────────────────────────────────────────────────

export interface SeatingType {
  name:  string   // 좌석 유형명 (예: "2인 테이블")
  seats: number   // 좌석당 수용 인원
  count: number   // 해당 유형 수량
}

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

export async function getRestaurant(
  restaurant_id: string,
): Promise<ActionResult<RestaurantInfo>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, region, owner_name, phone, table_2p, table_4p, seating_config')
    .eq('id', restaurant_id)
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '조회 실패' }
  return { success: true, data }
}

export interface UpdateRestaurantInput {
  id:              string
  name?:           string
  region?:         string | null
  owner_name?:     string | null
  phone?:          string | null
  table_2p?:       number
  table_4p?:       number
  seating_config?: SeatingType[] | null
}

export async function updateRestaurant(
  input: UpdateRestaurantInput,
): Promise<ActionResult> {
  const supabase = await createServerClient()
  const payload: Record<string, unknown> = {}
  if (input.name           !== undefined) payload.name           = input.name
  if (input.region         !== undefined) payload.region         = input.region
  if (input.owner_name     !== undefined) payload.owner_name     = input.owner_name
  if (input.phone          !== undefined) payload.phone          = input.phone
  if (input.table_2p       !== undefined) payload.table_2p       = input.table_2p
  if (input.table_4p       !== undefined) payload.table_4p       = input.table_4p
  if (input.seating_config !== undefined) payload.seating_config = input.seating_config

  const { error } = await supabase
    .from('restaurants')
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
  restaurant_id: string,
): Promise<ActionResult<MenuRow[]>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('menus')
    .select('id, name, price, is_featured')
    .eq('restaurant_id', restaurant_id)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    // menus 테이블 미생성 시 빈 배열 반환 (graceful)
    return { success: true, data: [] }
  }
  return { success: true, data: data ?? [] }
}

export interface CreateMenuInput {
  restaurant_id: string
  name:          string
  price:         number
  is_featured?:  boolean
}

export async function createMenu(
  input: CreateMenuInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('menus')
    .insert({
      restaurant_id: input.restaurant_id,
      name:          input.name,
      price:         input.price,
      is_featured:   input.is_featured ?? false,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }
  revalidatePath('/settings')
  return { success: true, data: { id: data.id } }
}
