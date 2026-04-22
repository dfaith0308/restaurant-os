import { getRestaurantId } from '@/lib/get-restaurant'
import { getIngredients } from '@/actions/settings'
import IngredientsClient from '@/components/settings/IngredientsClient'

export default async function IngredientsPage() {
  const restaurantId = await getRestaurantId()
  const result = await getIngredients(restaurantId)
  return <IngredientsClient ingredients={result.data ?? []} restaurantId={restaurantId} />
}
