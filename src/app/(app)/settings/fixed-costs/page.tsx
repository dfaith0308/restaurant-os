import { getRestaurantId } from '@/lib/get-restaurant'
import { getFixedCosts } from '@/actions/settings'
import FixedCostsClient from '@/components/settings/FixedCostsClient'

export default async function FixedCostsPage() {
  const restaurantId = await getRestaurantId()
  const result = await getFixedCosts(restaurantId)
  return <FixedCostsClient costs={result.data ?? []} restaurantId={restaurantId} />
}
