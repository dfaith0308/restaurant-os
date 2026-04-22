import { getRestaurantId } from '@/lib/get-restaurant'
import { getMoneyDashboard } from '@/actions/money'
import MoneyClient from '@/components/money/MoneyClient'

export default async function MoneyPage() {
  const restaurantId = await getRestaurantId()
  const result = await getMoneyDashboard(restaurantId)
  const data   = result.data ?? { due_this_week: 0, due_this_month: 0, total_unpaid: 0, payments: [], is_tight: false }

  return <MoneyClient data={data} restaurantId={restaurantId} />
}
