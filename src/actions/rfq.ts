'use server'

import { createServerClient } from '@/lib/supabase-server'
import { getAdminSettingNumber } from '@/lib/admin-settings-read'
import type { ActionResult, RfqRequest, RfqBid } from '@/types'
import { getTenantId, networkApprovalErrorIfBlocked } from '@/lib/get-restaurant'
import { getAuthCtx } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// ── 발주요청 생성 ─────────────────────────────────────────────

export interface CreateRfqInput {
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
  const deny = await networkApprovalErrorIfBlocked()
  if (deny) return { success: false, error: deny }

  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return { success: false, error: '인증 필요' }

  const windowHours = await getAdminSettingNumber('rfq_open_duration_hours', { min: 1, max: 720 })
  const repeatLimit = await getAdminSettingNumber('rfq_repeat_limit', { min: 1, max: 50 })

  const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
  const productName = input.product_name.trim()

  const { count: recentRepeatCount, error: repeatErr } = await supabase
    .from('rfq_requests')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenant_id)
    .eq('product_name', productName)
    .gte('created_at', sinceIso)

  if (repeatErr) {
    return { success: false, error: repeatErr.message }
  }
  if ((recentRepeatCount ?? 0) >= repeatLimit) {
    return {
      success: false,
      error: `동일 품목 RFQ는 최근 ${windowHours}시간 안에 최대 ${repeatLimit}회까지 생성할 수 있습니다.`,
    }
  }

  const deadline =
    input.deadline?.trim() ||
    new Date(Date.now() + windowHours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('rfq_requests')
    .insert({
      tenant_id:      ctx.tenant_id,
      product_name:   input.product_name,
      quantity:       input.quantity,
      unit:           input.unit,
      current_price:  input.current_price ?? null,
      request_note:   input.request_note ?? null,
      deadline,
      region:         input.region ?? null,
      ingredient_id:  input.ingredient_id ?? null,
      status:         'open',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? '발주요청 생성 실패' }
  }

  // 가격 히스토리에 "현재 구매가" 기록 — AI 개인화 판단용
  // price_history.barcode 는 비워 둔다. ingredients 에 barcode 컬럼이 없어 SKU 값을
  // 가져올 출처가 없기 때문이다. personalized-price 는 barcode 가 null 인 행을
  // ingredient_name 으로 조회하므로 이 경로는 이름 기준 매칭으로 동작한다.
  if (input.current_price && input.current_price > 0) {
    await supabase.from('price_history').insert({
      tenant_id:       ctx.tenant_id,
      ingredient_name: input.product_name,
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
  tenant_id: string,
  status?: string,
): Promise<ActionResult<RfqRequest[]>> {
  const deny = await networkApprovalErrorIfBlocked()
  if (deny) return { success: false, error: deny, data: [] }

  const supabase = await createServerClient()

  let query = supabase
    .from('rfq_requests')
    .select('*')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

// ── 발주요청 상세 (입찰 포함) ─────────────────────────────────

export async function getRfqDetail(
  rfq_id: string,
  tenant_id: string,
): Promise<ActionResult<{ rfq: RfqRequest; bids: RfqBid[] }>> {
  const deny = await networkApprovalErrorIfBlocked()
  if (deny) return { success: false, error: deny }

  const supabase = await createServerClient()

  // rfq_bids 에는 tenant 컬럼이 없다. 입찰의 소유권은 부모 RFQ 가 정한다
  // (rfq_bids.rfq_id 는 NOT NULL + rfq_requests FK 라 입찰 1건은 RFQ 1건에만 속한다).
  // 그래서 RFQ 소유권을 먼저 확정하고, 그 뒤 rfq_id 로만 입찰을 읽으면 스코핑이 성립한다.
  const { data: rfq, error: rfqErr } = await supabase
    .from('rfq_requests')
    .select('*')
    .eq('id', rfq_id)
    .eq('tenant_id', tenant_id)
    .single()

  if (rfqErr || !rfq) return { success: false, error: rfqErr?.message ?? '요청 없음' }

  const { data: bids, error: bidErr } = await supabase
    .from('rfq_bids')
    .select('*')
    .eq('rfq_id', rfq_id)
    .order('price', { ascending: true })

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
  supplier_tenant_id?: string
  price:          number
  delivery_days?: number
  note?:          string
}

export async function createBid(
  input: CreateBidInput,
): Promise<ActionResult<{ id: string }>> {
  const deny = await networkApprovalErrorIfBlocked()
  if (deny) return { success: false, error: deny }

  const supabase = await createServerClient()

  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const { data, error } = await supabase
    .from('rfq_bids')
    .insert({
      rfq_id:             input.rfq_id,
      supplier_name:      input.supplier_name,
      supplier_tenant_id: input.supplier_tenant_id ?? null,
      price:              input.price,
      delivery_days:      input.delivery_days ?? null,
      note:               input.note ?? null,
      status:             'submitted',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? '입찰 등록 실패' }
  }

  revalidatePath(`/rfq/${input.rfq_id}`)
  return { success: true, data: { id: data.id } }
}

// ── 입찰 선택 → 발주 확정 ────────────────────────────────────

export async function acceptBidAndCreateOrder(
  rfq_id: string,
  bid_id: string,
  tenant_id: string,
  session_id?: string,
): Promise<ActionResult<{ order_id: string }>> {
  const deny = await networkApprovalErrorIfBlocked()
  if (deny) return { success: false, error: deny }

  const supabase = await createServerClient()

  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('accept_bid_and_create_order_atomic', {
      p_tenant_id:        tenant_id,
      p_rfq_id:           rfq_id,
      p_bid_id:           bid_id,
      p_payment_due_days: 30,
    })

  if (rpcErr || !rpcData) {
    return { success: false, error: rpcErr?.message ?? '발주 확정 실패' }
  }

  const order_id = (rpcData as { order_id?: string }).order_id
  const savingAmount = Number((rpcData as { saving_amount?: number | string }).saving_amount ?? 0)

  if (!order_id) {
    return { success: false, error: '주문 생성에 실패했어요' }
  }

  // 6. 절약 통계 업데이트 (RPC 없어도 주문은 완료)
  if (savingAmount > 0) {
    const month = new Date().toISOString().slice(0, 7)
    try {
      await supabase.rpc('upsert_savings_stat', {
        p_tenant_id: tenant_id,
        p_month:         month,
        p_saving:        savingAmount,
      })
    } catch { /* noop */ }
  }

  revalidatePath('/rfq')
  revalidatePath('/money')
  revalidatePath('/today')

  // 전환 이벤트 — 주문 생성 성공 직후 (실패 시 여기 도달 안 함)
  if (session_id) {
    const { logTodayEvent } = await import('@/actions/today-events')
    logTodayEvent({
      tenant_id,
      session_id,
      event_type:  'action_complete',
      action_kind: 'order_create',
    })
  }

  try {
    const { notifyRfqBidOutcomesAfterAccept } = await import('@/lib/rfq-notify-suppliers')
    await notifyRfqBidOutcomesAfterAccept(supabase, rfq_id, tenant_id)
  } catch { /* 알림 실패는 주문 확정 결과에 영향 없음 */ }

  return { success: true, data: { order_id } }
}

// ── RFQ에 연결된 주문 조회 ─────────────────────────────────────
// rfq/[id] 상세 페이지에서 확정 후 상태를 보여주기 위해 사용

export interface LinkedOrder {
  id:              string
  status:          'confirmed' | 'completed' | 'cancelled'
  supplier_name:   string | null
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
  const deny = await networkApprovalErrorIfBlocked()
  if (deny) return { success: false, error: deny }

  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const { data, error } = await supabase
    .from('orders')
    .select('id, status, supplier_name, product_name, quantity, unit, unit_price, total_amount, saving_amount, delivered_at, delivery_note, created_at')
    .eq('rfq_id', rfq_id)
    .eq('buyer_tenant_id', tenant_id)
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
  const deny = await networkApprovalErrorIfBlocked()
  if (deny) return { success: false, error: deny }

  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const { error } = await supabase
    .from('rfq_requests')
    .update({ status: 'closed', closed_reason: reason })
    .eq('tenant_id', tenant_id)
    .eq('id', rfq_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/rfq')
  revalidatePath('/today')
  return { success: true }
}
