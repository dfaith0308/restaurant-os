import { getTenantId } from '@/lib/get-restaurant'
import { getMoneyDashboard } from '@/actions/money'
import MoneyClient from '@/components/money/MoneyClient'

export default async function MoneyPage() {
  const tenantId = await getTenantId()
  const result = await getMoneyDashboard(tenantId)
  const data   = result.data ?? { due_this_week: 0, due_this_month: 0, total_unpaid: 0, payments: [], is_tight: false }

  return <MoneyClient data={data} restaurantId={tenantId} />
}
