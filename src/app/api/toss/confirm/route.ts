import { NextRequest, NextResponse } from 'next/server'
import { runCommerceOrderPaidErpPostProcessing } from '@/lib/commerce-order-erp'
import { createServerClient, createSupabaseAdmin, getAuthCtx } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount } = await req.json()

  if (!paymentKey || !orderId || amount == null) {
    return NextResponse.json({ error: '결제 정보가 올바르지 않습니다' }, { status: 400 })
  }

  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: '결제 키가 설정되지 않았습니다' }, { status: 500 })
  }

  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: order, error: orderErr } = await supabase
    .from('commerce_orders')
    .select('id, tenant_id, order_number, total_amount, payment_status, status, payment_method')
    .eq('id', orderId)
    .eq('tenant_id', ctx.tenant_id)
    .maybeSingle()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })
  if (!order) return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 })

  if (order.payment_status === 'paid') {
    if (order.status === 'paid') {
      try {
        const adminSupabase = await createSupabaseAdmin()
        await runCommerceOrderPaidErpPostProcessing(adminSupabase, ctx.user_id, {
          id: order.id as string,
          tenant_id: order.tenant_id as string,
          order_number: (order.order_number as string | null) ?? null,
          total_amount: Number(order.total_amount),
          payment_method: String(order.payment_method ?? 'card'),
        })
        await supabase
          .from('commerce_orders')
          .update({ status: 'preparing', updated_at: new Date().toISOString() })
          .eq('id', orderId)
          .eq('tenant_id', ctx.tenant_id)
          .eq('status', 'paid')
      } catch (e) {
        console.error('[toss/confirm] ERP retry on paid order failed', e)
      }
    }
    return NextResponse.json({ success: true, alreadyPaid: true })
  }

  const expectedAmount = order.total_amount as number
  if (Number(amount) !== expectedAmount) {
    return NextResponse.json({ error: '결제 금액이 주문 금액과 일치하지 않습니다' }, { status: 400 })
  }

  const encoded = Buffer.from(`${secretKey}:`).toString('base64')

  const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
  })

  const tossData = await tossRes.json()

  if (!tossRes.ok) {
    return NextResponse.json({ error: tossData.message ?? '결제 승인 실패' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const orderRef = {
    id: order.id as string,
    tenant_id: order.tenant_id as string,
    order_number: (order.order_number as string | null) ?? null,
    total_amount: Number(order.total_amount),
    payment_method: String(order.payment_method ?? 'card'),
  }

  const { data: paidRow, error: paidErr } = await supabase
    .from('commerce_orders')
    .update({
      payment_status: 'paid',
      status: 'paid',
      updated_at: now,
    })
    .eq('id', orderId)
    .eq('tenant_id', ctx.tenant_id)
    .eq('status', 'pending_payment')
    .select('id')
    .maybeSingle()

  if (paidErr) {
    return NextResponse.json({ error: paidErr.message }, { status: 500 })
  }

  if (!paidRow) {
    const { data: current } = await supabase
      .from('commerce_orders')
      .select('payment_status, status')
      .eq('id', orderId)
      .eq('tenant_id', ctx.tenant_id)
      .maybeSingle()
    if (current?.payment_status === 'paid') {
      return NextResponse.json({ success: true, alreadyPaid: true })
    }
    return NextResponse.json({ error: '주문 상태가 변경되었습니다. 새로고침 후 다시 시도해주세요.' }, { status: 409 })
  }

  try {
    const adminSupabase = await createSupabaseAdmin()
    await runCommerceOrderPaidErpPostProcessing(adminSupabase, ctx.user_id, orderRef)
  } catch (e) {
    console.error('[toss/confirm] ERP post-processing failed (order remains paid)', e)
  }

  const { error: preparingErr } = await supabase
    .from('commerce_orders')
    .update({ status: 'preparing', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('tenant_id', ctx.tenant_id)
    .eq('status', 'paid')

  if (preparingErr) {
    console.error('[toss/confirm] preparing transition failed (order remains paid)', preparingErr.message)
  }

  return NextResponse.json({ success: true, data: tossData })
}
