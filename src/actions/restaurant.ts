'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

// ── 매장 정보 (tenants 테이블 기반 — realmyos DB 단일화 구조) ──

export interface RestaurantInfo {
  id:               string
  name:             string
  region:           string | null
  owner_name:       string | null
  phone:            string | null
  business_number:  string | null
  address:          string | null
  address_detail:   string | null
  table_2p:         number
  table_4p:         number
  seating_config:   SeatingConfig | null
}

export interface SeatingConfig {
  table_2p: number
  table_4p: number
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
    .select(
      'id, name, region, address, address_detail, representative_name, contact_phone, business_number, seating_config',
    )
    .eq('id', tenant_id)
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '조회 실패' }

  const addressParts = [data.address, data.address_detail].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  )
  const location =
    addressParts.length > 0
      ? addressParts.join(' ')
      : (data.region ?? null)

  return {
    success: true,
    data: {
      id:               data.id,
      name:             data.name,
      region:           location,
      owner_name:       data.representative_name ?? null,
      phone:            data.contact_phone ?? null,
      business_number:  data.business_number ?? null,
      address:          data.address ?? null,
      address_detail:   data.address_detail ?? null,
      table_2p:         (data.seating_config as SeatingConfig | null)?.table_2p ?? 0,
      table_4p:         (data.seating_config as SeatingConfig | null)?.table_4p ?? 0,
      seating_config:   (data.seating_config as SeatingConfig | null) ?? null,
    },
  }
}

export interface UpdateRestaurantInput {
  id:              string
  name?:           string
  region?:         string | null
  owner_name?:     string | null
  phone?:          string | null
  business_number?: string | null
  table_2p?:       number
  table_4p?:       number
  seating_config?: SeatingConfig | null
}

export async function updateRestaurant(
  input: UpdateRestaurantInput,
): Promise<ActionResult> {
  const supabase = await createServerClient()
  const payload: Record<string, unknown> = {}
  if (input.name !== undefined) payload.name = input.name
  if (input.region !== undefined) {
    payload.address = input.region
    payload.region = input.region
  }
  if (input.owner_name !== undefined) payload.representative_name = input.owner_name
  if (input.phone !== undefined) payload.contact_phone = input.phone
  if (input.business_number !== undefined) payload.business_number = input.business_number

  if (input.table_2p !== undefined || input.table_4p !== undefined) {
    payload.seating_config = {
      table_2p: input.table_2p ?? 0,
      table_4p: input.table_4p ?? 0,
    }
  } else if (input.seating_config !== undefined) {
    payload.seating_config = input.seating_config
  }

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

  if (error) return { success: false, error: error.message }
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
