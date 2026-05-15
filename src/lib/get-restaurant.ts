import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
// tenant_id 해석 순서
//   1. 로그인 유저 기반 users.tenant_id 조회 (realmyos DB 단일화 구조)
//   2. 없으면 /login 또는 /onboarding
//   미승인(is_approved=false)이어도 tenant_id 반환 — 네트워크 기능만 별도 게이트(requireNetworkApprovedPage 등)
export async function getTenantId(): Promise<string> {
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

  return data.tenant_id
}

export function getTenantIdFallback(): string {
  return ''
}

export const NETWORK_APPROVAL_REQUIRED_MESSAGE =
  '해당 기능은 승인 후 사용 가능합니다.\n담당자가 곧 연락드립니다.'

export async function isTenantApprovedForNetwork(): Promise<boolean> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const isAdmin = !!(
    process.env.ADMIN_EMAIL &&
    user.email &&
    user.email === process.env.ADMIN_EMAIL
  )
  if (isAdmin) return true

  const { data } = await supabase
    .from('users')
    .select('tenants(is_approved)')
    .eq('id', user.id)
    .maybeSingle()

  const raw = data?.tenants
  const tenant = (Array.isArray(raw) ? raw[0] : raw) as { is_approved: boolean } | null
  return tenant?.is_approved === true
}

/** 서버 페이지: 미승인 → /pending */
export async function requireNetworkApprovedPage(): Promise<void> {
  if (await isTenantApprovedForNetwork()) return
  redirect('/pending')
}

/** 서버 액션용: 승인 전이면 사용자 메시지, 승인 시 undefined */
export async function networkApprovalErrorIfBlocked(): Promise<string | undefined> {
  if (await isTenantApprovedForNetwork()) return undefined
  return NETWORK_APPROVAL_REQUIRED_MESSAGE
}
