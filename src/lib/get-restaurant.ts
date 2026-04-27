import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

// tenant_id 해석 순서
//   1. env override (NEXT_PUBLIC_TENANT_ID) — 개발/데모용 (승인 체크 스킵)
//   2. 로그인 유저 기반 users.tenant_id 조회 (realmyos DB 단일화 구조)
//   3. 둘 다 없으면 /login 또는 /onboarding
export async function getTenantId(): Promise<string> {
  const envId = process.env.NEXT_PUBLIC_TENANT_ID
  if (envId) return envId  // 개발 환경 — 승인 체크 스킵

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('users')
    .select('tenant_id, tenants(id, is_approved, role)')
    .eq('id', user.id)
    .maybeSingle()

  if (!data?.tenant_id) redirect('/onboarding')

  const rawTenant = data.tenants
  const tenant = (Array.isArray(rawTenant) ? rawTenant[0] : rawTenant) as { id: string; is_approved: boolean; role: string } | null
  if (!tenant) redirect('/onboarding')

  const isAdmin = !!(
    process.env.ADMIN_EMAIL &&
    user?.email &&
    user.email === process.env.ADMIN_EMAIL
  )
  if (!isAdmin && !tenant.is_approved) redirect('/pending')

  return data.tenant_id
}

export function getTenantIdFallback(): string {
  return process.env.NEXT_PUBLIC_TENANT_ID ?? ''
}
