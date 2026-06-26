import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createSupabaseAdmin } from '@/lib/supabase-server'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('x-internal-key')
  if (authHeader !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: '권한 없음' }, { status: 401 })
  }

  const { tenant_id, title, body, url } = await req.json()
  if (!tenant_id || !title) {
    return NextResponse.json({ error: 'tenant_id와 title이 필요합니다' }, { status: 400 })
  }

  const adminSupabase = await createSupabaseAdmin()

  const { data: subscriptions, error } = await adminSupabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('tenant_id', tenant_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ success: true, sent: 0 })
  }

  const payload = JSON.stringify({ title, body, url: url ?? '/' })

  let sent = 0
  const failed: string[] = []

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      sent++
    } catch (err: unknown) {
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err
          ? (err as { statusCode?: number }).statusCode
          : undefined
      if (statusCode === 410 || statusCode === 404) {
        await adminSupabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
      failed.push(sub.endpoint)
    }
  }

  return NextResponse.json({ success: true, sent, failed: failed.length })
}
