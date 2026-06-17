import Link from 'next/link'
import { getTenantId, requireNetworkApprovedPage } from '@/lib/get-restaurant'
import {
  buildOrderOperationInsights,
  buildRecentOrderActivities,
} from '@/lib/order-capture'
import { getOrdersList, type OrderStatus } from '@/actions/orders'
import { getMyCommerceOrders } from '@/actions/buy'
import type { CommerceOrderListRow } from '@/lib/buy-types'
import type { Order } from '@/types'
import { formatKRW } from '@/lib/utils'
import OrderCaptureCard from '@/components/orders/OrderCaptureCard'
import OrderImageCaptureCard from '@/components/orders/OrderImageCaptureCard'
import RecentOrderActivity from '@/components/orders/RecentOrderActivity'
import OrderRiskSummary from '@/components/orders/OrderRiskSummary'

const ALLOWED_STATUS = new Set<OrderStatus>(['confirmed', 'completed', 'cancelled'])

const COMMERCE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: '결제대기', color: '#92400e', bg: '#fffbeb' },
  paid: { label: '결제완료', color: '#1f5d3a', bg: '#ecfdf5' },
  preparing: { label: '준비중', color: '#1d4ed8', bg: '#eff6ff' },
  shipped: { label: '배송중', color: '#1d4ed8', bg: '#eff6ff' },
  completed: { label: '완료', color: '#059669', bg: '#ecfdf5' },
  cancelled: { label: '취소', color: '#6b7280', bg: '#f3f4f6' },
  refunded: { label: '환불', color: '#6b7280', bg: '#f3f4f6' },
}

function orderNo(row: { order_number: string | null }) {
  const n = row.order_number?.trim()
  return n || '주문번호 준비중'
}

function formatDateGroupLabel(dateKey: string): string {
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)
  if (dateKey === todayKey) return '오늘'
  if (dateKey === yesterdayKey) return '어제'
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function groupCommerceOrdersByDate(orders: CommerceOrderListRow[]) {
  const map = new Map<string, CommerceOrderListRow[]>()
  for (const o of orders) {
    const key = o.created_at.slice(0, 10)
    const bucket = map.get(key) ?? []
    bucket.push(o)
    map.set(key, bucket)
  }
  return [...map.entries()].sort(([a], [b]) => b.localeCompare(a))
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; tab?: string }>
}) {
  const tenant_id = await getTenantId()
  await requireNetworkApprovedPage()
  const sp = (await searchParams) ?? {}

  const tab = sp.tab === 'rfq' ? 'rfq' : 'purchase'

  if (tab === 'purchase') {
    const res = await getMyCommerceOrders()
    const orders = res.success ? res.data?.orders ?? [] : []
    const grouped = groupCommerceOrdersByDate(orders)

    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 96px', background: '#f7f6f2', minHeight: '100vh', boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 16px' }}>내역</h1>
        <MainTabs active="purchase" />

        {!res.success ? (
          <p style={{ color: '#b91c1c', fontSize: 14 }}>{res.error}</p>
        ) : orders.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px' }}>구매 내역이 없습니다</p>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px' }}>식자재를 구매하면 여기에 표시됩니다</p>
            <Link
              href="/buy"
              style={{
                display: 'inline-block',
                padding: '12px 18px',
                background: '#1f5d3a',
                color: '#fff',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              구매하러 가기
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {grouped.map(([dateKey, items]) => (
              <section key={dateKey}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', margin: '0 0 10px' }}>
                  {formatDateGroupLabel(dateKey)}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map((o) => {
                    const cfg = COMMERCE_STATUS[o.status] ?? {
                      label: o.status,
                      color: '#6b7280',
                      bg: '#f3f4f6',
                    }
                    return (
                      <Link
                        key={o.id}
                        href={`/buy/orders/${o.id}`}
                        style={{
                          display: 'block',
                          padding: '14px 16px',
                          background: '#fff',
                          borderRadius: 12,
                          border: '1px solid #e5e7eb',
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: 18 }} aria-hidden>
                              🛒
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{orderNo(o)}</span>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: 8,
                              color: cfg.color,
                              background: cfg.bg,
                              flexShrink: 0,
                            }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
                          {new Date(o.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>{formatKRW(o.total_amount)}</div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    )
  }

  const status = sp.status && ALLOWED_STATUS.has(sp.status as OrderStatus)
    ? (sp.status as OrderStatus)
    : undefined

  const [allRes, filteredRes] = await Promise.all([
    getOrdersList(tenant_id),
    getOrdersList(tenant_id, status),
  ])

  const allOrders = allRes.data ?? []
  const orders = filteredRes.data ?? []

  const counts = {
    confirmed: allOrders.filter((o) => o.status === 'confirmed').length,
    completed: allOrders.filter((o) => o.status === 'completed').length,
    cancelled: allOrders.filter((o) => o.status === 'cancelled').length,
  }

  const orderInsights = buildOrderOperationInsights(allOrders)
  const recentActivities = buildRecentOrderActivities(allOrders, 8)

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 96px', background: '#f7f6f2', minHeight: '100vh', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 16px' }}>내역</h1>
      <MainTabs active="rfq" />

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 18,
      }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            실제 주문
          </h2>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0 0' }}>
            orders 기준 (RFQ와 분리)
          </p>
        </div>
      </div>

      <OrderImageCaptureCard />
      <OrderCaptureCard />

      <OrderRiskSummary insights={orderInsights} />

      <RecentOrderActivity items={recentActivities} />

      <StatusTabs
        active={status ?? 'all'}
        counts={counts}
      />

      {orders.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </main>
  )
}

function MainTabs({ active }: { active: 'purchase' | 'rfq' }) {
  const tabs: Array<{ key: 'purchase' | 'rfq'; label: string; href: string }> = [
    { key: 'purchase', label: '구매내역', href: '/orders' },
    { key: 'rfq', label: '발주내역', href: '/orders?tab=rfq' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        marginBottom: 20,
        borderBottom: '1px solid #e5e7eb',
        background: '#f7f6f2',
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.key
        return (
          <Link
            key={t.key}
            href={t.href}
            style={{
              flex: 1,
              padding: '12px 8px',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#1f5d3a' : '#6b7280',
              textDecoration: 'none',
              borderBottom: isActive ? '2px solid #1f5d3a' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
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
        const href = t.key === 'all' ? '/orders?tab=rfq' : `/orders?tab=rfq&status=${t.key}`
        const badgeCount =
          t.key === 'all' ? (counts.confirmed + counts.completed + counts.cancelled) : counts[t.key]

        const badgeBg = t.tone === 'urgent' ? '#EF4444' : 'var(--color-primary)'

        return (
          <Link
            key={t.key}
            href={href}
            style={{
              padding: '6px 14px', borderRadius: 20,
              background: isActive ? 'var(--color-primary)' : '#fff',
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
                color:      isActive ? 'var(--color-primary)' : '#fff',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
            {order.product_name}
          </span>
          {order.operation_capture ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                background: '#ecfdf5',
                color: '#1f5d3a',
              }}
            >
              흡수
            </span>
          ) : null}
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            color: cfg.color, background: cfg.bg,
          }}>
            {cfg.label}
          </span>
        </div>

        <div style={{ fontSize: 13, color: '#6b7280' }}>
          {order.counterparty_name} · {order.quantity}{order.unit}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 700, marginTop: 6 }}>
          {order.total_amount > 0 ? formatKRW(order.total_amount) : '금액 미정'}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          {daysAgo === 0 ? '오늘' : `${daysAgo}일 전`}
        </div>
      </div>
      <Link
        href={`/orders/${order.id}`}
        aria-label="주문 상세"
        style={{ fontSize: 18, color: '#9ca3af', marginLeft: 8, textDecoration: 'none', lineHeight: 1 }}
      >
        ›
      </Link>
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
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
        아직 실제 주문이 없어요
      </div>
      <div style={{ fontSize: 13, color: '#9ca3af' }}>
        RFQ에서 입찰을 선택하면 주문이 생성되거나, 위 카드로 카카오·전화 주문을 바로 적을 수 있어요.
      </div>
      <div style={{ marginTop: 18 }}>
        <Link href="/rfq" style={{
          display: 'inline-block', padding: '12px 18px',
          background: 'var(--color-primary)', color: '#fff', borderRadius: 10,
          fontSize: 14, fontWeight: 600, textDecoration: 'none',
        }}>
          RFQ로 이동
        </Link>
      </div>
    </div>
  )
}
