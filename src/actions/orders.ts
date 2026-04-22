'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

// ── 납품확인 완료 ─────────────────────────────────────────────
// orders.status = 'completed'
// ingredients.current_price 업데이트 (연결된 ingredient 있을 때)
// price_history source='delivery' 기록

export async function markOrderDelivered(
  order_id: string,
): Promise<ActionResult> {
  const supabase = await createServerClient()

  // 주문 조회 (rfq_id 통해 ingredient 연결 찾기 위해)
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, rfq_requests(ingredient_id, product_name)')
    .eq('id', order_id)
    .single()

  if (orderErr || !order) {
    return { success: false, error: '주문 정보를 찾을 수 없어요' }
  }

  if (order.status !== 'confirmed') {
    return { success: false, error: '이미 처리된 주문이에요' }
  }

  // 1. 주문 완료 처리
  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      status:       'completed',
      delivered_at: new Date().toISOString(),
    })
    .eq('id', order_id)

  if (updateErr) {
    return { success: false, error: '납품 처리에 실패했어요' }
  }

  // 2. ingredient 업데이트 (rfq.ingredient_id 있을 때만)
  const ingredientId = (order.rfq_requests as { ingredient_id: string | null } | null)?.ingredient_id ?? null

  if (ingredientId) {
    await supabase
      .from('ingredients')
      .update({
        current_price: order.unit_price,
        supplier_name: order.supplier_name,
      })
      .eq('id', ingredientId)
  }

  // 3. price_history: 실 납품가 기록 (AI 개인화 피드백 데이터)
  let barcode: string | null = null
  if (ingredientId) {
    const { data: ing } = await supabase
      .from('ingredients')
      .select('barcode')
      .eq('id', ingredientId)
      .maybeSingle()
    barcode = ing?.barcode ?? null
  }

  await supabase.from('price_history').insert({
    restaurant_id:   order.restaurant_id,
    ingredient_name: order.product_name,
    barcode,
    price:           order.unit_price,
    unit:            order.unit,
    supplier_name:   order.supplier_name,
    source:          'delivery',
    source_ref_id:   order_id,
  })

  revalidatePath('/today')
  revalidatePath('/rfq')

  return { success: true }
}

// ── 주문 취소 ─────────────────────────────────────────────────
// orders.status = 'cancelled'
// 연결된 payments_outgoing planned → cancelled

export async function cancelOrder(
  order_id: string,
  reason?: string,
): Promise<ActionResult> {
  const supabase = await createServerClient()

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', order_id)
    .single()

  if (orderErr || !order) {
    return { success: false, error: '주문 정보를 찾을 수 없어요' }
  }

  if (order.status === 'cancelled') {
    return { success: false, error: '이미 취소된 주문이에요' }
  }

  // 1. 주문 취소
  const { error: updateErr } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', order_id)

  if (updateErr) {
    return { success: false, error: '취소 처리에 실패했어요' }
  }

  // 2. 연결된 planned 지급 취소 (paid는 건드리지 않음 — 이미 나간 돈)
  await supabase
    .from('payments_outgoing')
    .update({ status: 'cancelled' })
    .eq('order_id', order_id)
    .eq('status', 'planned')

  revalidatePath('/today')
  revalidatePath('/rfq')
  revalidatePath('/money')

  return { success: true }
}

// ── 납품 대기 중인 주문 목록 ──────────────────────────────────
// orders.status = 'confirmed' 인 것들

export interface PendingDelivery {
  order_id:      string
  rfq_id:        string | null
  supplier_name: string
  product_name:  string
  quantity:      number
  unit:          string
  unit_price:    number
  total_amount:  number
  saving_amount: number
  ordered_at:    string
  expected_date: string | null
}

export async function getPendingDeliveries(
  restaurant_id: string,
): Promise<ActionResult<PendingDelivery[]>> {
  const supabase = await createServerClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, rfq_id, bid_id, supplier_name, product_name, quantity, unit, unit_price, total_amount, saving_amount, created_at')
    .eq('restaurant_id', restaurant_id)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: true })  // 오래된 순 (먼저 확인해야 할 것부터)

  if (error) return { success: false, error: error.message }
  if (!orders || orders.length === 0) return { success: true, data: [] }

  // delivery_days 조회 (bid_id 있는 것들만 — N+1 피하기 위해 in절)
  const bidIds = orders.map(o => o.bid_id).filter((id): id is string => !!id)
  const bidDeliveryMap = new Map<string, number | null>()

  if (bidIds.length > 0) {
    const { data: bids } = await supabase
      .from('rfq_bids')
      .select('id, delivery_days')
      .in('id', bidIds)

    for (const b of bids ?? []) {
      bidDeliveryMap.set(b.id, b.delivery_days ?? null)
    }
  }

  const list: PendingDelivery[] = orders.map(o => {
    const deliveryDays = o.bid_id ? (bidDeliveryMap.get(o.bid_id) ?? null) : null
    let expected_date: string | null = null
    if (deliveryDays !== null) {
      const d = new Date(o.created_at)
      d.setDate(d.getDate() + deliveryDays)
      expected_date = d.toISOString().slice(0, 10)
    }

    return {
      order_id:      o.id,
      rfq_id:        o.rfq_id ?? null,
      supplier_name: o.supplier_name,
      product_name:  o.product_name,
      quantity:      o.quantity,
      unit:          o.unit,
      unit_price:    o.unit_price,
      total_amount:  o.total_amount,
      saving_amount: o.saving_amount ?? 0,
      ordered_at:    o.created_at,
      expected_date,
    }
  })

  return { success: true, data: list }
}
