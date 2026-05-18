import { getTenantId } from '@/lib/get-restaurant'
import { getRestaurant } from '@/actions/restaurant'
import RestaurantSettingsClient from './RestaurantSettingsClient'

export default async function RestaurantSettingsPage() {
  const tenantId = await getTenantId()
  const result = await getRestaurant(tenantId)
  const restaurant = result.data ?? {
    id: tenantId, name: '', region: null, owner_name: null, phone: null,
    business_number: null, address: null, address_detail: null,
    business_hours_text: null, working_days_per_month: 25,
    table_2p: 0, table_4p: 0, seating_config: null,
  }

  return <RestaurantSettingsClient restaurant={restaurant} />
}
