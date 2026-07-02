export const PUSH_PREF_KEY = 'push_notifications_enabled'

export function getPushPreference(): boolean {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(PUSH_PREF_KEY)
  if (stored === null) return true
  return stored === 'true'
}

export function setPushPreference(enabled: boolean): void {
  localStorage.setItem(PUSH_PREF_KEY, enabled ? 'true' : 'false')
}

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

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
}

async function syncSubscriptionToServer(subscription: PushSubscription) {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? '구독 등록 실패')
  }
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
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

  return waitForServiceWorkerActive(reg)
}

export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error('이 기기에서는 푸시 알림을 지원하지 않습니다')
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
  const reg = await getServiceWorkerRegistration()
  if (!reg) throw new Error('서비스 워커를 등록할 수 없습니다')

  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    await syncSubscriptionToServer(existing)
    setPushPreference(true)
    return
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('알림 권한이 필요합니다')
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })
  await syncSubscriptionToServer(subscription)
  setPushPreference(true)
}

export async function unsubscribeFromPush(): Promise<void> {
  setPushPreference(false)

  if (!('serviceWorker' in navigator)) return

  const reg = await navigator.serviceWorker.getRegistration('/')
  if (!reg) return

  const subscription = await reg.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()

  try {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    })
  } catch {
    // 클라이언트 구독 해제는 완료됨
  }
}

export async function ensurePushSubscriptionIfEnabled(): Promise<void> {
  if (!getPushPreference()) return
  if (!isPushSupported()) return

  try {
    await subscribeToPush()
  } catch (err) {
    console.error('[Push] 오류:', err)
  }
}
