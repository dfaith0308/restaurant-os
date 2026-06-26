'use client'

import { useEffect } from 'react'

export default function PushSubscriber() {
  useEffect(() => {
    console.log('[Push] PushSubscriber 마운트됨')

    if (!('serviceWorker' in navigator)) {
      console.error('[Push] serviceWorker 미지원')
      return
    }
    if (!('PushManager' in window)) {
      console.error('[Push] PushManager 미지원')
      return
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    console.log('[Push] VAPID 키:', vapidKey ? '있음' : '없음')
    if (!vapidKey) {
      console.error('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY 없음')
      return
    }

    async function syncSubscriptionToServer(subscription: PushSubscription) {
      try {
        console.log('[Push] 서버 동기화 시도:', subscription.endpoint.slice(0, 50))
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        })
        console.log('[Push] 서버 응답:', res.status)
        if (!res.ok) {
          const data = await res.json()
          console.error('[Push] 구독 등록 실패:', res.status, data)
        } else {
          console.log('[Push] 구독 등록 성공')
        }
      } catch (err) {
        console.error('[Push] fetch 오류:', err)
      }
    }

    async function subscribe() {
      try {
        const reg = await navigator.serviceWorker.ready
        console.log('[Push] SW 준비됨')

        const existing = await reg.pushManager.getSubscription()
        console.log('[Push] 기존 구독:', existing ? '있음' : '없음')

        if (existing) {
          await syncSubscriptionToServer(existing)
          return
        }

        const permission = await Notification.requestPermission()
        console.log('[Push] 알림 권한:', permission)
        if (permission !== 'granted') return

        function urlBase64ToUint8Array(base64String: string) {
          const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
          const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
          const rawData = window.atob(base64)
          return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
        }

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!),
        })
        console.log('[Push] 신규 구독 완료')
        await syncSubscriptionToServer(subscription)
      } catch (err) {
        console.error('[Push] 구독 오류:', err)
      }
    }

    subscribe()
  }, [])

  return null
}
