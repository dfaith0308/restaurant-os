import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 미로그인
  if (!user) redirect('/login')

  // 관리자 판별 — get-restaurant 의존 없음 (pending 리다이렉트 충돌 방지)
  const isAdmin = !!(
    process.env.ADMIN_EMAIL &&
    user?.email &&
    user.email === process.env.ADMIN_EMAIL
  )
  if (!isAdmin) redirect('/today')

  const [
    { data: restaurants },
    { data: rfqs },
    { data: orders },
  ] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, name, region, is_approved, created_at')
      .eq('role', 'restaurant')
      .order('created_at', { ascending: false }),
    supabase
      .from('rfq_requests')
      .select('id, tenant_id, product_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('orders')
      .select('id, buyer_tenant_id, product_name, supplier_name, status, total_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <AdminClient
      restaurants={restaurants ?? []}
      rfqs={rfqs ?? []}
      orders={orders ?? []}
    />
  )
}
