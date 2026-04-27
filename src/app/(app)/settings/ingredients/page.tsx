import { getTenantId } from '@/lib/get-restaurant'
import { getIngredients } from '@/actions/settings'
import IngredientsClient from '@/components/settings/IngredientsClient'

export default async function IngredientsPage() {
  const tenantId = await getTenantId()
  const result = await getIngredients(tenantId)
  return <IngredientsClient ingredients={result.data ?? []} restaurantId={tenantId} />
}
