import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PendingClient from './PendingClient'

export default async function PendingPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('users')
    .select('tenant_id, tenants(is_approved)')
    .eq('id', user.id)
    .maybeSingle()

  const rawTenant = data?.tenants
  const tenant = (Array.isArray(rawTenant) ? rawTenant[0] : rawTenant) as { is_approved: boolean } | null
  if (tenant?.is_approved) redirect('/today')
  if (!data?.tenant_id) redirect('/onboarding')

  return <PendingClient />
}
