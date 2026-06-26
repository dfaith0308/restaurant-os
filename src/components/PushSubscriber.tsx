'use client'

import { useEffect, useState } from 'react'

export default function PushSubscriber() {
  const [logs, setLogs] = useState<string[]>([])

  function addLog(msg: string, isError = false) {
    if (isError) console.error(msg)
    else console.log(msg)
    setLogs((prev) => [...prev, msg])
  }

  useEffect(() => {
    addLog('[Push] PushSubscriber 마운트됨')

    if (!('serviceWorker' in navigator)) {
      addLog('[Push] ❌ serviceWorker 미지원', true)
      return
    }
    if (!('PushManager' in window)) {
      addLog('[Push] ❌ PushManager 미지원', true)
      return
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    addLog(`[Push] VAPID 키: ${vapidKey ? '있음' : '없음'}`)
    if (!vapidKey) {
      addLog('[Push] ❌ NEXT_PUBLIC_VAPID_PUBLIC_KEY 없음', true)
      return
    }

    async function syncSubscriptionToServer(subscription: PushSubscription) {
      try {
        addLog(`[Push] 서버 동기화 시도: ${subscription.endpoint.slice(0, 50)}`)
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        })
        addLog(`[Push] 서버 응답: ${res.status}`)
        if (!res.ok) {
          const data = await res.json()
          addLog(`[Push] ❌ 구독 등록 실패: ${res.status} ${JSON.stringify(data)}`, true)
        } else {
          addLog('[Push] ✅ 구독 등록 성공')
        }
      } catch (err) {
        addLog(`[Push] ❌ fetch 오류: ${err}`, true)
      }
    }

    async function subscribe() {
      try {
        let reg = await navigator.serviceWorker.getRegistration('/')
        addLog(`[Push] SW 등록 상태: ${reg ? reg.active?.state ?? '대기중' : '없음'}`)

        if (!reg) {
          addLog('[Push] SW 수동 등록 시도...')
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
          addLog('[Push] SW 수동 등록 완료')
        }

        if (!reg.active) {
          addLog('[Push] SW active 대기 중...')
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('SW activate 타임아웃')), 10000)

            if (reg!.installing) {
              reg!.installing.addEventListener('statechange', function (this: ServiceWorker) {
                if (this.state === 'activated') {
                  clearTimeout(timeout)
                  resolve()
                }
              })
            } else if (reg!.waiting) {
              reg!.waiting.addEventListener('statechange', function (this: ServiceWorker) {
                if (this.state === 'activated') {
                  clearTimeout(timeout)
                  resolve()
                }
              })
            } else {
              clearTimeout(timeout)
              resolve()
            }
          })
        }

        addLog('[Push] SW 준비됨')

        const existing = await reg.pushManager.getSubscription()
        addLog(`[Push] 기존 구독: ${existing ? '있음' : '없음'}`)

        if (existing) {
          await syncSubscriptionToServer(existing)
          return
        }

        const permission = await Notification.requestPermission()
        addLog(`[Push] 알림 권한: ${permission}`)
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
        addLog('[Push] ✅ 신규 구독 완료')
        await syncSubscriptionToServer(subscription)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        addLog(`[Push] ❌ 오류: ${message}`, true)
      }
    }

    subscribe()
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: 16,
        right: 16,
        zIndex: 9999,
        background: '#1a1a1a',
        borderRadius: 10,
        padding: 12,
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#fff',
        maxHeight: 200,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: '#1f5d3a' }}>Push Debug</span>
      </div>
      {logs.length === 0 ? (
        <div style={{ color: '#9ca3af' }}>초기화 중...</div>
      ) : (
        logs.map((l, i) => (
          <div
            key={i}
            style={{
              color: l.includes('❌') ? '#f87171' : l.includes('✅') ? '#4ade80' : '#e5e7eb',
              marginBottom: 2,
            }}
          >
            {l}
          </div>
        ))
      )}
    </div>
  )
}
