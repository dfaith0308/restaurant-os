'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

// ── 거래처 목록 (최근 거래 포함) ──────────────────────────────

export interface SupplierListItem {
  id:      string
  name:    string
  contact: string | null
  region:  string | null
  recent_order: {
    product_name: string
    total_amount: number
  } | null
}

export async function getSuppliers(
  restaurant_id: string,
): Promise<ActionResult<SupplierListItem[]>> {
  const supabase = await createServerClient()

  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('id, name, contact, region')
    .eq('restaurant_id', restaurant_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message, data: [] }
  const list = suppliers ?? []
  if (list.length === 0) return { success: true, data: [] }

  // 거래처별 최근 주문 1건 (supplier_name으로 매칭 — supplier_id는 optional)
  const names = list.map(s => s.name)
  const { data: orders } = await supabase
    .from('orders')
    .select('supplier_name, product_name, total_amount, created_at')
    .eq('restaurant_id', restaurant_id)
    .in('supplier_name', names)
    .order('created_at', { ascending: false })

  const recentByName = new Map<string, { product_name: string; total_amount: number }>()
  for (const o of (orders ?? [])) {
    if (!recentByName.has(o.supplier_name)) {
      recentByName.set(o.supplier_name, {
        product_name: o.product_name,
        total_amount: o.total_amount,
      })
    }
  }

  return {
    success: true,
    data: list.map(s => ({
      id:      s.id,
      name:    s.name,
      contact: s.contact,
      region:  s.region,
      recent_order: recentByName.get(s.name) ?? null,
    })),
  }
}

// ── 거래처 생성 ───────────────────────────────────────────────

export interface CreateSupplierInput {
  restaurant_id: string
  name:          string
  contact?:      string
  region?:       string
  memo?:         string
}

export async function createSupplier(
  input: CreateSupplierInput,
): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim()) return { success: false, error: '거래처명을 입력해주세요' }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      restaurant_id: input.restaurant_id,
      name:          input.name.trim(),
      contact:       input.contact ?? null,
      region:        input.region ?? null,
      memo:          input.memo ?? null,
      is_active:     true,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

  revalidatePath('/suppliers')
  return { success: true, data: { id: data.id } }
}

// ── 거래처 상세 ───────────────────────────────────────────────

export interface SupplierDetail {
  id:       string
  name:     string
  contact:  string | null
  region:   string | null
  memo:     string | null
  total_orders: number
  total_amount: number
  recent_order?: {
    product_name: string
    total_amount: number
    created_at:   string
  }
}

export async function getSupplierDetail(
  id: string,
): Promise<ActionResult<SupplierDetail>> {
  const supabase = await createServerClient()

  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('id, name, contact, region, memo, restaurant_id')
    .eq('id', id)
    .single()

  if (error || !supplier) return { success: false, error: '거래처를 찾을 수 없어요' }

  const { data: orders } = await supabase
    .from('orders')
    .select('product_name, total_amount, created_at')
    .eq('restaurant_id', supplier.restaurant_id)
    .eq('supplier_name', supplier.name)
    .order('created_at', { ascending: false })

  const list = orders ?? []
  const total_orders = list.length
  const total_amount = list.reduce((s, o) => s + o.total_amount, 0)
  const recent = list[0]

  return {
    success: true,
    data: {
      id:      supplier.id,
      name:    supplier.name,
      contact: supplier.contact,
      region:  supplier.region,
      memo:    supplier.memo,
      total_orders,
      total_amount,
      recent_order: recent
        ? { product_name: recent.product_name, total_amount: recent.total_amount, created_at: recent.created_at }
        : undefined,
    },
  }
}
