import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getAuthCtx } from '@/lib/supabase-server'

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
    .select('id, total_amount, payment_status, status')
    .eq('id', orderId)
    .eq('tenant_id', ctx.tenant_id)
    .maybeSingle()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })
  if (!order) return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 })

  if (order.payment_status === 'paid') {
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

  const { error: updateErr } = await supabase
    .from('commerce_orders')
    .update({
      payment_status: 'paid',
      status: 'preparing',
    })
    .eq('id', orderId)
    .eq('tenant_id', ctx.tenant_id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: tossData })
}
