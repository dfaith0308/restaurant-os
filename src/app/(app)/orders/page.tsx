import Link from 'next/link'
import { getTenantId } from '@/lib/get-restaurant'
import { getOrdersList, type OrderStatus } from '@/actions/orders'
import type { Order } from '@/types'
import { formatKRW } from '@/lib/utils'

const ALLOWED_STATUS = new Set<OrderStatus>(['confirmed', 'completed', 'cancelled'])

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>
}) {
  const tenant_id = await getTenantId()
  const sp = (await searchParams) ?? {}

  const status = sp.status && ALLOWED_STATUS.has(sp.status as OrderStatus)
    ? (sp.status as OrderStatus)
    : undefined

  const [allRes, filteredRes] = await Promise.all([
    getOrdersList(tenant_id),
    getOrdersList(tenant_id, status),
  ])

  const allOrders = allRes.data ?? []
  const orders    = filteredRes.data ?? []

  const counts = {
    confirmed: allOrders.filter(o => o.status === 'confirmed').length,
    completed: allOrders.filter(o => o.status === 'completed').length,
    cancelled: allOrders.filter(o => o.status === 'cancelled').length,
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 18,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
            실제 주문
          </h1>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0 0' }}>
            orders 기준 (RFQ와 분리)
          </p>
        </div>
      </div>

      <StatusTabs
        active={status ?? 'all'}
        counts={counts}
      />

      {orders.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(o => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </main>
  )
}

function StatusTabs({
  active,
  counts,
}: {
  active: 'all' | OrderStatus
  counts: Record<OrderStatus, number>
}) {
  const tabs: Array<{ key: 'all' | OrderStatus; label: string; tone?: 'urgent' | 'normal' }> = [
    { key: 'all',       label: '전체' },
    { key: 'confirmed', label: '납품 대기', tone: 'urgent' },
    { key: 'completed', label: '완료' },
    { key: 'cancelled', label: '취소' },
  ]

  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
      {tabs.map(t => {
        const isActive = active === t.key
        const href = t.key === 'all' ? '/orders' : `/orders?status=${t.key}`
        const badgeCount =
          t.key === 'all' ? (counts.confirmed + counts.completed + counts.cancelled) : counts[t.key]

        const badgeBg = t.tone === 'urgent' ? '#EF4444' : '#111827'

        return (
          <Link
            key={t.key}
            href={href}
            style={{
              padding: '6px 14px', borderRadius: 20,
              background: isActive ? '#111827' : '#fff',
              color:      isActive ? '#fff' : '#6b7280',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              boxShadow: isActive ? 'none' : '0 0 0 1px #e5e7eb',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {t.label}
            {badgeCount > 0 && t.key !== 'completed' && t.key !== 'cancelled' && (
              <span style={{
                marginLeft: 6,
                background: isActive ? '#fff' : badgeBg,
                color:      isActive ? '#111827' : '#fff',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 700,
              }}>
                {badgeCount}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

function OrderCard({ order }: { order: Order }) {
  const statusCfg: Record<OrderStatus, { label: string; color: string; bg: string }> = {
    confirmed: { label: '납품 대기', color: '#6D28D9', bg: '#EDE9FE' },
    completed: { label: '완료',     color: '#059669', bg: '#ECFDF5' },
    cancelled: { label: '취소',     color: '#9ca3af', bg: '#F3F4F6' },
  }
  const cfg = statusCfg[order.status]
  const daysAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 86400000)

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid #e5e7eb', padding: '14px 16px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
            {order.product_name}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            color: cfg.color, background: cfg.bg,
          }}>
            {cfg.label}
          </span>
        </div>

        <div style={{ fontSize: 13, color: '#6b7280' }}>
          {order.supplier_name} · {order.quantity}{order.unit}
        </div>
        <div style={{ fontSize: 13, color: '#111827', fontWeight: 700, marginTop: 6 }}>
          {formatKRW(order.total_amount)}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          {daysAgo === 0 ? '오늘' : `${daysAgo}일 전`}
        </div>
      </div>
      {/* TODO: 주문 상세 페이지가 필요하면 /orders/[id] 추가 */}
      <span style={{ fontSize: 18, color: '#9ca3af', marginLeft: 8 }}>›</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 24px',
      background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
        아직 실제 주문이 없어요
      </div>
      <div style={{ fontSize: 13, color: '#9ca3af' }}>
        RFQ에서 입찰을 선택하면 주문이 생성됩니다.
      </div>
      <div style={{ marginTop: 18 }}>
        <Link href="/rfq" style={{
          display: 'inline-block', padding: '12px 18px',
          background: '#111827', color: '#fff', borderRadius: 10,
          fontSize: 14, fontWeight: 600, textDecoration: 'none',
        }}>
          RFQ로 이동
        </Link>
      </div>
    </div>
  )
}

