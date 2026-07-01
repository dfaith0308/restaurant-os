'use client'

import { useEffect } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

async function waitForServiceWorkerActive(reg: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (reg.active) return reg

  const worker = reg.installing ?? reg.waiting
  if (worker) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('SW activate 타임아웃 (15초)')), 15000)

      const done = () => {
        clearTimeout(timeout)
        resolve()
      }

      const check = () => {
        if (reg.active || worker.state === 'activated') done()
      }

      worker.addEventListener('statechange', check)
      check()
    })
    return reg
  }

  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('SW ready 타임아웃 (15초)')), 15000),
    ),
  ])
  return reg
}

export default function PushSubscriber() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (!('PushManager' in window)) return

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    const vapidPublicKey = vapidKey

    async function syncSubscriptionToServer(subscription: PushSubscription) {
      try {
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        })
        if (!res.ok) {
          const data = await res.json()
          console.error('[Push] 구독 등록 실패:', res.status, data)
        }
      } catch (err) {
        console.error('[Push] fetch 오류:', err)
      }
    }

    async function subscribe() {
      try {
        const staleRegs = await navigator.serviceWorker.getRegistrations()
        for (const stale of staleRegs) {
          const script = stale.active?.scriptURL ?? stale.installing?.scriptURL ?? stale.waiting?.scriptURL ?? ''
          if (script && !script.endsWith('/sw.js')) {
            await stale.unregister()
          }
        }

        let reg = await navigator.serviceWorker.getRegistration('/')

        if (!reg) {
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        }

        reg = await waitForServiceWorkerActive(reg)

        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          await syncSubscriptionToServer(existing)
          return
        }

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
        await syncSubscriptionToServer(subscription)
      } catch (err) {
        console.error('[Push] 오류:', err)
      }
    }

    subscribe()
  }, [])

  return null
}
