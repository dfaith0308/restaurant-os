'use server'

import { createServerClient, createSupabaseAdmin, getAuthCtx } from '@/lib/supabase-server'
import type { ActionResult } from '@/types'

export type SubscriptionPlan = 'free' | 'earlybird' | 'pro' | 'annual'

export async function getSubscriptionStatus(): Promise<{
  plan: SubscriptionPlan
  subscribed_at: string | null
  plan_expires_at: string | null
  is_active: boolean
}> {
  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return { plan: 'free', subscribed_at: null, plan_expires_at: null, is_active: false }

  const { data } = await supabase
    .from('tenants')
    .select('subscription_plan, subscribed_at, plan_expires_at')
    .eq('id', ctx.tenant_id)
    .single()

  const plan = (data?.subscription_plan ?? 'free') as SubscriptionPlan
  const is_active = plan !== 'free'

  return {
    plan,
    subscribed_at: data?.subscribed_at ?? null,
    plan_expires_at: data?.plan_expires_at ?? null,
    is_active,
  }
}

function normalizeCouponCode(raw: string): string {
  return raw.toUpperCase().trim().replace(/^SIKSIKI-/, '')
}

export async function redeemCoupon(code: string): Promise<
  ActionResult<{
    plan: string
    free_months: number
    plan_expires_at: string
  }>
> {
  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return { success: false, error: '로그인이 필요합니다' }

  const normalized = normalizeCouponCode(code)
  if (!normalized) return { success: false, error: '유효하지 않은 쿠폰 코드입니다' }

  const adminSupabase = await createSupabaseAdmin()

  const { data: coupon, error: couponError } = await adminSupabase
    .from('coupons')
    .select('*')
    .eq('code', normalized)
    .single()

  if (couponError || !coupon) return { success: false, error: '유효하지 않은 쿠폰 코드입니다' }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { success: false, error: '만료된 쿠폰입니다' }
  }

  if (coupon.max_uses != null && (coupon.used_count ?? 0) >= coupon.max_uses) {
    return { success: false, error: '이미 모두 사용된 쿠폰입니다' }
  }

  const { data: existing } = await adminSupabase
    .from('coupon_uses')
    .select('id')
    .eq('coupon_id', coupon.id)
    .eq('tenant_id', ctx.tenant_id)
    .maybeSingle()

  if (existing) return { success: false, error: '이미 사용한 쿠폰입니다' }

  const now = new Date()
  const plan_expires_at = new Date(now)
  plan_expires_at.setMonth(plan_expires_at.getMonth() + coupon.free_months)

  const { error: useErr } = await adminSupabase.from('coupon_uses').insert({
    coupon_id: coupon.id,
    tenant_id: ctx.tenant_id,
    plan_expires_at: plan_expires_at.toISOString(),
  })

  if (useErr) return { success: false, error: useErr.message }

  const { error: countErr } = await adminSupabase
    .from('coupons')
    .update({ used_count: (coupon.used_count ?? 0) + 1 })
    .eq('id', coupon.id)

  if (countErr) return { success: false, error: countErr.message }

  const { error: tenantErr } = await adminSupabase
    .from('tenants')
    .update({
      subscription_plan: coupon.plan,
      subscribed_at: now.toISOString(),
      plan_expires_at: plan_expires_at.toISOString(),
      is_approved: true,
    })
    .eq('id', ctx.tenant_id)

  if (tenantErr) return { success: false, error: tenantErr.message }

  return {
    success: true,
    data: {
      plan: coupon.plan as string,
      free_months: coupon.free_months as number,
      plan_expires_at: plan_expires_at.toISOString(),
    },
  }
}
