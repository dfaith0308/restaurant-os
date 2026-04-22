import { getRestaurantId } from '@/lib/get-restaurant'
import { getRestaurant } from '@/actions/restaurant'
import RestaurantSettingsClient from './RestaurantSettingsClient'

export default async function RestaurantSettingsPage() {
  const restaurantId = await getRestaurantId()
  const result = await getRestaurant(restaurantId)
  const restaurant = result.data ?? {
    id: restaurantId, name: '', region: null, owner_name: null, phone: null,
    table_2p: 0, table_4p: 0, seating_config: null,
  }

  return <RestaurantSettingsClient restaurant={restaurant} />
}
