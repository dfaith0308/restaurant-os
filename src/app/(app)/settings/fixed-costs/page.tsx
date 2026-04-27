import { getTenantId } from '@/lib/get-restaurant'
import { getFixedCosts } from '@/actions/settings'
import FixedCostsClient from '@/components/settings/FixedCostsClient'

export default async function FixedCostsPage() {
  const tenantId = await getTenantId()
  const result = await getFixedCosts(tenantId)
  return <FixedCostsClient costs={result.data ?? []} restaurantId={tenantId} />
}
