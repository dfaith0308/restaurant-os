import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

// restaurant_id 해석 순서
//   1. env override (NEXT_PUBLIC_RESTAURANT_ID) — 개발/데모용 (승인 체크 스킵)
//   2. 로그인 유저 기반 restaurants.owner_id 조회
//   3. 둘 다 없으면 /login 또는 /onboarding
export async function getRestaurantId(): Promise<string> {
  const envId = process.env.NEXT_PUBLIC_RESTAURANT_ID
  if (envId) return envId  // 개발 환경 — 승인 체크 스킵

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('restaurants')
    .select('id, is_approved')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!data) redirect('/onboarding')

  const isAdmin = !!(
    process.env.ADMIN_EMAIL &&
    user?.email &&
    user.email === process.env.ADMIN_EMAIL
  )
  if (!isAdmin && !data.is_approved) redirect('/pending')

  return data.id
}

export function getRestaurantIdFallback(): string {
  return process.env.NEXT_PUBLIC_RESTAURANT_ID ?? ''
}
