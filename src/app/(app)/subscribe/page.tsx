import { getSubscriptionStatus } from '@/actions/subscribe'
import SubscribeClient from '@/components/subscribe/SubscribeClient'

export default async function SubscribePage() {
  const status = await getSubscriptionStatus()
  return <SubscribeClient status={status} />
}
