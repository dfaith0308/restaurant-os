import { getTenantId } from '@/lib/get-restaurant'
import { getNotifications } from '@/actions/notifications'
import NotificationsClient from '@/components/notifications/NotificationsClient'

export default async function NotificationsPage() {
  const tenant_id = await getTenantId()
  const res = await getNotifications(tenant_id).catch(() => ({
    success: false as const,
    data: [],
  }))

  const list = res.data ?? []

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          알림
        </h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0 0' }}>
          최근 20개
        </p>
      </div>

      <NotificationsClient tenant_id={tenant_id} initial={list} />
    </main>
  )
}

