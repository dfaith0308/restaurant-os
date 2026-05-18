import { getTenantId } from '@/lib/get-restaurant'
import { getFixedCosts } from '@/actions/settings'
import { getRestaurant, getMenus } from '@/actions/restaurant'
import FixedCostsClient from '@/components/settings/FixedCostsClient'

export default async function FixedCostsPage() {
  const tenantId = await getTenantId()
  const [costsRes, restaurantRes, menusRes] = await Promise.all([
    getFixedCosts(tenantId),
    getRestaurant(tenantId),
    getMenus(tenantId),
  ])

  const menus = menusRes.data ?? []
  const averageMenuPrice =
    menus.length > 0
      ? Math.round(
          menus.reduce((sum, menu) => sum + (menu.price ?? 0), 0) / menus.length,
        )
      : null

  return (
    <FixedCostsClient
      costs={costsRes.data ?? []}
      restaurantId={tenantId}
      workingDaysPerMonth={restaurantRes.data?.working_days_per_month ?? 25}
      averageMenuPrice={averageMenuPrice}
    />
  )
}
