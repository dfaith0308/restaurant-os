'use client'

import { useEffect } from 'react'
import { ensurePushSubscriptionIfEnabled } from '@/lib/push-client'

export default function PushSubscriber() {
  useEffect(() => {
    ensurePushSubscriptionIfEnabled()
  }, [])

  return null
}
