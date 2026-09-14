'use server'

import { createServerClient, createSupabaseAdmin, getAuthCtx } from '@/lib/supabase-server'
import {
  deliveryProgressRank,
  isDeliveryStatus,
  type DeliveryProgressStatus,
  type DeliveryStatus,
} from '@/lib/delivery-status'

/**
 * 식당OS — 내 storefront 주문의 배송 타임라인 (읽기 전용).
 *
 * 배송 이벤트 테이블은 RLS 가 관리자 전용이다(내부 메모·입력자 id 가 PostgREST 로 식당에 노출되지 않게).
 * 그래서 service role 로 읽되 **주문·이벤트 모두 tenant_id = 로그인 식당**으로 스코프를 걸고,
 * 화면에 필요한 컬럼(상태·시각)만 가져온다. 메모·입력자·원본 값은 읽지 않는다.
 *
 * 마이그레이션(20260915100000) 전이거나 추적을 시작하지 않은 주문은 null — 화면은 기존 3단계만 보여준다.
 */

export type BuyDeliveryTimeline = {
  delivery_status: DeliveryStatus
  delivery_carrier: string | null
  delivery_tracking_no: string | null
  /** 진행 단계별 처음 반영된 시각 (없으면 해당 키 없음) */
  reached_at: Partial<Record<DeliveryProgressStatus, string>>
  /** 도달한 가장 높은 진행 단계 순위 — 예외 상태여도 과거 도달은 유지해 보여준다 */
  max_reached_rank: number
  /** 현재가 예외 상태면 그 상태에 들어간 시각 */
  exception_since: string | null
}

export async function getBuyOrderDeliveryTimeline(orderId: string): Promise<BuyDeliveryTimeline | null> {
  const oid = String(orderId ?? '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(oid)) return null

  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return null

  const admin = await createSupabaseAdmin()

  const { data: order, error: orderErr } = await admin
    .from('commerce_orders')
    .select('id, delivery_status, delivery_carrier, delivery_tracking_no')
    .eq('id', oid)
    .eq('tenant_id', ctx.tenant_id)
    .maybeSingle()

  // 컬럼이 아직 없으면(마이그레이션 전) 조용히 기존 화면으로 둔다
  if (orderErr || !order) return null
  const o = order as Record<string, unknown>
  if (!isDeliveryStatus(o.delivery_status)) return null

  const { data: events, error: evErr } = await admin
    .from('commerce_order_delivery_events')
    .select('mapped_status, occurred_at')
    .eq('commerce_order_id', oid)
    .eq('tenant_id', ctx.tenant_id)
    .eq('outcome', 'applied')
    .order('occurred_at', { ascending: true })

  if (evErr) return null

  const reached_at: Partial<Record<DeliveryProgressStatus, string>> = {}
  let maxRank = deliveryProgressRank(o.delivery_status) ?? -1
  let exceptionSince: string | null = null

  for (const e of (events ?? []) as { mapped_status: string; occurred_at: string }[]) {
    const rank = deliveryProgressRank(e.mapped_status)
    if (rank != null) {
      const key = e.mapped_status as DeliveryProgressStatus
      if (!reached_at[key]) reached_at[key] = e.occurred_at
      if (rank > maxRank) maxRank = rank
    }
    if (e.mapped_status === o.delivery_status && rank == null) exceptionSince = e.occurred_at
  }

  return {
    delivery_status: o.delivery_status,
    delivery_carrier: (o.delivery_carrier as string | null) ?? null,
    delivery_tracking_no: (o.delivery_tracking_no as string | null) ?? null,
    reached_at,
    max_reached_rank: maxRank,
    exception_since: exceptionSince,
  }
}
