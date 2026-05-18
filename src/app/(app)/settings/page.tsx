import { getTenantId } from '@/lib/get-restaurant'
import { getRestaurant, getMenus } from '@/actions/restaurant'
import { getFixedCosts, getIngredients } from '@/actions/settings'
import SettingsHub from '@/components/settings/SettingsHub'

function emptyRestaurant(id: string) {
  return {
    id,
    name: '',
    region: null,
    owner_name: null,
    phone: null,
    business_number: null,
    address: null,
    address_detail: null,
    opening_time: null,
    closing_time: null,
    working_days_per_month: 25,
    table_2p: 0,
    table_4p: 0,
    seating_config: null,
  }
}

export default async function SettingsPage() {
  const tenantId = await getTenantId()
  const [restaurantRes, fixedCostsRes, ingredientsRes, menusRes] = await Promise.all([
    getRestaurant(tenantId),
    getFixedCosts(tenantId),
    getIngredients(tenantId),
    getMenus(tenantId),
  ])

  return (
    <SettingsHub
      restaurant={restaurantRes.data ?? emptyRestaurant(tenantId)}
      fixedCosts={fixedCostsRes.data ?? []}
      ingredients={ingredientsRes.data ?? []}
      menus={menusRes.data ?? []}
    />
  )
}
