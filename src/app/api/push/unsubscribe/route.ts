import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSupabaseAdmin, getAuthCtx } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint || typeof endpoint !== 'string') {
    return NextResponse.json({ error: 'endpoint 필요' }, { status: 400 })
  }

  const adminSupabase = await createSupabaseAdmin()

  const { error } = await adminSupabase
    .from('push_subscriptions')
    .delete()
    .eq('tenant_id', ctx.tenant_id)
    .eq('endpoint', endpoint)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
