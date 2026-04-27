import { getTenantId } from '@/lib/get-restaurant'
import { getRestaurant, updateRestaurant } from '@/actions/restaurant'
import RestaurantSettingsClient from './restaurant/RestaurantSettingsClient'

export default async function RestaurantSettingsPage() {
  const tenantId = await getTenantId()
  const result = await getRestaurant(tenantId)
  const restaurant = result.data ?? {
    id: tenantId, name: '', region: null, owner_name: null, phone: null,
    table_2p: 0, table_4p: 0, seating_config: null,
  }

  return <RestaurantSettingsClient restaurant={restaurant} />
}
