import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PendingClient from './PendingClient'

export default async function PendingPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('restaurants')
    .select('is_approved')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (data?.is_approved) redirect('/today')
  if (!data) redirect('/onboarding')

  return <PendingClient />
}
