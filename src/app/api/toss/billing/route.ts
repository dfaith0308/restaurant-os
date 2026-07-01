import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSupabaseAdmin, getAuthCtx } from '@/lib/supabase-server'

const PLAN_AMOUNTS: Record<string, number> = {
  annual: 348000,
  earlybird: 9900,
  pro: 39000,
}

const VALID_PLANS = new Set(['annual', 'earlybird', 'pro'])

function orderNameForPlan(plan: string): string {
  if (plan === 'annual') return '식식이 연간 구독'
  if (plan === 'earlybird') return '식식이 얼리버드 구독'
  return '식식이 월간 구독'
}

function planExpiresAt(plan: string): string | null {
  const now = new Date()
  if (plan === 'annual') {
    const expires = new Date(now)
    expires.setFullYear(expires.getFullYear() + 1)
    return expires.toISOString()
  }
  if (plan === 'earlybird') return null
  const expires = new Date(now)
  expires.setMonth(expires.getMonth() + 1)
  return expires.toISOString()
}

export async function POST(req: NextRequest) {
  const { authKey, customerKey, plan, amount, orderName } = await req.json()

  if (!authKey || !customerKey || !plan) {
    return NextResponse.json({ error: '결제 정보가 올바르지 않습니다' }, { status: 400 })
  }

  if (!VALID_PLANS.has(plan)) {
    return NextResponse.json({ error: '플랜이 올바르지 않습니다' }, { status: 400 })
  }

  const expectedAmount = PLAN_AMOUNTS[plan]
  if (Number(amount) !== expectedAmount) {
    return NextResponse.json({ error: '결제 금액이 플랜 금액과 일치하지 않습니다' }, { status: 400 })
  }

  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: '결제 키 미설정' }, { status: 500 })
  }

  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const encoded = Buffer.from(`${secretKey}:`).toString('base64')

  const billingRes = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authKey, customerKey }),
  })
  const billingData = await billingRes.json()
  if (!billingRes.ok) {
    return NextResponse.json({ error: billingData.message ?? '빌링키 발급 실패' }, { status: 400 })
  }

  const billingKey = billingData.billingKey as string

  const orderId = crypto.randomUUID()
  const payRes = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerKey,
      amount: expectedAmount,
      orderId,
      orderName: orderName ?? orderNameForPlan(plan),
    }),
  })
  const payData = await payRes.json()
  if (!payRes.ok) {
    return NextResponse.json({ error: payData.message ?? '결제 승인 실패' }, { status: 400 })
  }

  const adminSupabase = await createSupabaseAdmin()
  const subscribedAt = new Date().toISOString()

  const { error: tenantErr } = await adminSupabase
    .from('tenants')
    .update({
      subscription_plan: plan,
      subscribed_at: subscribedAt,
      plan_expires_at: planExpiresAt(plan),
      billing_key: billingKey,
      toss_customer_key: customerKey,
      is_approved: true,
    })
    .eq('id', ctx.tenant_id)

  if (tenantErr) {
    console.error('[toss/billing] tenant update failed after payment', tenantErr)
    return NextResponse.json({ error: '구독 정보 저장에 실패했습니다. 고객센터에 문의해 주세요.' }, { status: 500 })
  }

  revalidatePath('/subscribe')
  revalidatePath('/today')

  return NextResponse.json({ success: true, orderId, paymentKey: payData.paymentKey })
}
