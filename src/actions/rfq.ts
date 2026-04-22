'use server'

import { createServerClient } from '@/lib/supabase-server'
import type { ActionResult, RfqRequest, RfqBid } from '@/types'
import { revalidatePath } from 'next/cache'

// ── 발주요청 생성 ─────────────────────────────────────────────

export interface CreateRfqInput {
  restaurant_id:  string
  product_name:   string
  quantity:       number
  unit:           string
  current_price?: number | null
  request_note?:  string
  deadline?:      string
  region?:        string
  ingredient_id?: string | null
}

export async function createRfqRequest(
  input: CreateRfqInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('rfq_requests')
    .insert({
      restaurant_id:  input.restaurant_id,
      product_name:   input.product_name,
      quantity:       input.quantity,
      unit:           input.unit,
      current_price:  input.current_price ?? null,
      request_note:   input.request_note ?? null,
      deadline:       input.deadline ?? null,
      region:         input.region ?? null,
      ingredient_id:  input.ingredient_id ?? null,
      status:         'open',
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[createRfqRequest]', error)
    return { success: false, error: error?.message ?? '발주요청 생성 실패' }
  }

  // 가격 히스토리에 "현재 구매가" 기록 — AI 개인화 판단용
  if (input.current_price && input.current_price > 0) {
    // ingredient 에 barcode 있으면 같이 넣어 SKU 기준 조회에 쓰이게
    let barcode: string | null = null
    if (input.ingredient_id) {
      const { data: ing } = await supabase
        .from('ingredients')
        .select('barcode')
        .eq('id', input.ingredient_id)
        .maybeSingle()
      barcode = ing?.barcode ?? null
    }
    await supabase.from('price_history').insert({
      restaurant_id:   input.restaurant_id,
      ingredient_name: input.product_name,
      barcode,
      price:           input.current_price,
      unit:            input.unit,
      supplier_name:   null,
      source:          'rfq_request',
      source_ref_id:   data.id,
    })
  }

  revalidatePath('/rfq')
  revalidatePath('/today')
  return { success: true, data: { id: data.id } }
}

// ── 발주요청 목록 ─────────────────────────────────────────────

export async function getRfqList(
  restaurant_id: string,
  status?: string,
): Promise<ActionResult<RfqRequest[]>> {
  const supabase = await createServerClient()

  let query = supabase
    .from('rfq_requests')
    .select('*')
    .eq('restaurant_id', restaurant_id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

// ── 발주요청 상세 (입찰 포함) ─────────────────────────────────

export async function getRfqDetail(
  rfq_id: string,
): Promise<ActionResult<{ rfq: RfqRequest; bids: RfqBid[] }>> {
  const supabase = await createServerClient()

  const [{ data: rfq, error: rfqErr }, { data: bids, error: bidErr }] = await Promise.all([
    supabase.from('rfq_requests').select('*').eq('id', rfq_id).single(),
    supabase.from('rfq_bids').select('*').eq('rfq_id', rfq_id)
      .order('price', { ascending: true }),
  ])

  if (rfqErr || !rfq) return { success: false, error: rfqErr?.message ?? '요청 없음' }
  if (bidErr) return { success: false, error: bidErr.message }

  // 절약금액 계산
  const bidsWithSaving: RfqBid[] = (bids ?? []).map(b => ({
    ...b,
    saving_amount: rfq.current_price
      ? Math.max(0, (rfq.current_price - b.price) * rfq.quantity)
      : 0,
    saving_pct: rfq.current_price
      ? Math.round(((rfq.current_price - b.price) / rfq.current_price) * 100)
      : 0,
  }))

  return { success: true, data: { rfq, bids: bidsWithSaving } }
}

// ── 입찰 등록 (관리자가 대신 입력) ───────────────────────────

export interface CreateBidInput {
  rfq_id:         string
  supplier_name:  string
  supplier_id?:   string
  price:          number
  delivery_days?: number
  note?:          string
}

export async function createBid(
  input: CreateBidInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('rfq_bids')
    .insert({
      rfq_id:        input.rfq_id,
      supplier_name: input.supplier_name,
      supplier_id:   input.supplier_id ?? null,
      price:         input.price,
      delivery_days: input.delivery_days ?? null,
      note:          input.note ?? null,
      status:        'submitted',
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[createBid]', error)
    return { success: false, error: error?.message ?? '입찰 등록 실패' }
  }

  revalidatePath(`/rfq/${input.rfq_id}`)
  return { success: true, data: { id: data.id } }
}

// ── 입찰 선택 → 발주 확정 ────────────────────────────────────

export async function acceptBidAndCreateOrder(
  rfq_id: string,
  bid_id: string,
  restaurant_id: string,
  session_id?: string,
): Promise<ActionResult<{ order_id: string }>> {
  const supabase = await createServerClient()

  // 1. 입찰 정보 조회
  const { data: bid } = await supabase
    .from('rfq_bids').select('*').eq('id', bid_id).single()
  const { data: rfq } = await supabase
    .from('rfq_requests').select('*').eq('id', rfq_id).single()

  if (!bid || !rfq) return { success: false, error: '데이터 없음' }

  const totalAmount   = bid.price * rfq.quantity
  const savingAmount  = rfq.current_price
    ? Math.max(0, (rfq.current_price - bid.price) * rfq.quantity)
    : 0

  // 2. 주문 생성
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      restaurant_id: restaurant_id,
      rfq_id:        rfq_id,
      bid_id:        bid_id,
      supplier_id:   bid.supplier_id,
      supplier_name: bid.supplier_name,
      product_name:  rfq.product_name,
      quantity:      rfq.quantity,
      unit:          rfq.unit,
      unit_price:    bid.price,
      total_amount:  totalAmount,
      saving_amount: savingAmount,
      status:        'confirmed',
    })
    .select('id')
    .single()

  if (orderErr || !order) {
    console.error('[acceptBid] order error:', orderErr)
    return { success: false, error: '발주 확정 실패' }
  }

  // 3. 지급 예정 자동 생성 (30일 후 기본)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  await supabase.from('payments_outgoing').insert({
    restaurant_id: restaurant_id,
    order_id:      order.id,
    supplier_id:   bid.supplier_id,
    supplier_name: bid.supplier_name,
    amount:        totalAmount,
    due_date:      dueDate.toISOString().slice(0, 10),
    status:        'planned',
  })

  // 4. 입찰 상태 업데이트
  await supabase.from('rfq_bids').update({ status: 'accepted' }).eq('id', bid_id)
  await supabase.from('rfq_bids').update({ status: 'rejected' }).eq('rfq_id', rfq_id).neq('id', bid_id)

  // 5. RFQ 상태 ordered로 변경
  await supabase.from('rfq_requests').update({ status: 'ordered' }).eq('id', rfq_id)

  // 6. 절약 통계 업데이트 (RPC 없어도 주문은 완료)
  if (savingAmount > 0) {
    const month = new Date().toISOString().slice(0, 7)
    try {
      await supabase.rpc('upsert_savings_stat', {
        p_restaurant_id: restaurant_id,
        p_month:         month,
        p_saving:        savingAmount,
      })
    } catch { /* noop */ }
  }

  // 7. 가격 히스토리에 "성사 단가" 기록 (SKU 기준 조회용 barcode 포함)
  let orderBarcode: string | null = null
  if (rfq.ingredient_id) {
    const { data: ing } = await supabase
      .from('ingredients')
      .select('barcode')
      .eq('id', rfq.ingredient_id)
      .maybeSingle()
    orderBarcode = ing?.barcode ?? null
  }
  await supabase.from('price_history').insert({
    restaurant_id,
    ingredient_name: rfq.product_name,
    barcode:         orderBarcode,
    price:           bid.price,
    unit:            rfq.unit,
    supplier_name:   bid.supplier_name,
    source:          'order',
    source_ref_id:   order.id,
  })

  revalidatePath('/rfq')
  revalidatePath('/money')
  revalidatePath('/today')

  // 전환 이벤트 — 주문 생성 성공 직후 (실패 시 여기 도달 안 함)
  if (session_id) {
    const { logTodayEvent } = await import('@/actions/today-events')
    logTodayEvent({
      restaurant_id,
      session_id,
      event_type:  'action_complete',
      action_kind: 'order_create',
    })
  }

  return { success: true, data: { order_id: order.id } }
}

// ── RFQ에 연결된 주문 조회 ─────────────────────────────────────
// rfq/[id] 상세 페이지에서 확정 후 상태를 보여주기 위해 사용

export interface LinkedOrder {
  id:              string
  status:          'confirmed' | 'completed' | 'cancelled'
  supplier_name:   string
  product_name:    string
  quantity:        number
  unit:            string
  unit_price:      number
  total_amount:    number
  saving_amount:   number
  delivered_at:    string | null
  delivery_note:   string | null
  created_at:      string
}

export async function getOrderByRfqId(
  rfq_id: string,
): Promise<ActionResult<LinkedOrder | null>> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('orders')
    .select('id, status, supplier_name, product_name, quantity, unit, unit_price, total_amount, saving_amount, delivered_at, delivery_note, created_at')
    .eq('rfq_id', rfq_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  return { success: true, data: data as LinkedOrder | null }
}


export async function closeRfq(
  rfq_id: string,
  reason: string,
): Promise<ActionResult> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('rfq_requests')
    .update({ status: 'closed', closed_reason: reason })
    .eq('id', rfq_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/rfq')
  revalidatePath('/today')
  return { success: true }
}
