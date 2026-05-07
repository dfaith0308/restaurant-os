import { getTenantId } from '@/lib/get-restaurant'
import { getIngredients } from '@/actions/ingredients'
import IngredientsClient from '@/components/settings/IngredientsClient'

export default async function IngredientsPage() {
  const tenantId = await getTenantId()
  const result = await getIngredients()
  return <IngredientsClient ingredients={result.data ?? []} restaurantId={tenantId} />
}
