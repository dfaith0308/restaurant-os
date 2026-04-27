import Link from 'next/link'
import { getTenantId } from '@/lib/get-restaurant'
import { getOrderDetail, type OrderStatus } from '@/actions/orders'
import { formatKRW } from '@/lib/utils'
import OrderCompleteButton from '@/components/orders/OrderCompleteButton'

interface Props {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params
  const tenant_id = await getTenantId()

  const result = await getOrderDetail(tenant_id, id)
  if (!result.success || !result.data) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        <p style={{ color: '#9ca3af' }}>{result.error ?? '주문을 찾을 수 없어요'}</p>
        <Link href="/orders">← 목록으로</Link>
      </main>
    )
  }

  const { order, order_lines } = result.data

  const cfg: Record<OrderStatus, { label: string; color: string; bg: string }> = {
    confirmed: { label: '납품 대기', color: '#6D28D9', bg: '#EDE9FE' },
    completed: { label: '완료',     color: '#059669', bg: '#ECFDF5' },
    cancelled: { label: '취소',     color: '#9ca3af', bg: '#F3F4F6' },
  }

  const s = cfg[order.status]
  const createdLabel = new Date(order.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/orders" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
          ← 주문 목록
        </Link>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>
            {order.product_name}
          </h1>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            color: s.color, background: s.bg,
          }}>
            {s.label}
          </span>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          {order.supplier_name} · {createdLabel}
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
        padding: '14px 16px', marginBottom: 12,
      }}>
        <Row label="총 금액" value={formatKRW(order.total_amount)} strong />
        <Row label="수량" value={`${order.quantity}${order.unit}`} />
        <Row label="단가" value={`${formatKRW(order.unit_price)} / ${order.unit}`} />
        <Row label="절약" value={order.saving_amount > 0 ? formatKRW(order.saving_amount) : '-'} color={order.saving_amount > 0 ? '#059669' : '#9ca3af'} />
      </div>

      {order.status === 'confirmed' && (
        <div style={{ marginBottom: 12 }}>
          <OrderCompleteButton tenantId={tenant_id} orderId={order.id} />
        </div>
      )}

      {/* 라인 목록 */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
        padding: '14px 16px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>
          주문 품목
        </div>

        {result.error && (
          <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 700, marginBottom: 10 }}>
            {result.error}
          </div>
        )}

        {order_lines.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9ca3af' }}>
            주문 품목이 없습니다.
            <div style={{ marginTop: 6, fontSize: 12 }}>
              {/* 스키마에 order_items는 있지만 기존 데이터가 안 쌓일 수 있음 */}
              TODO: 주문 생성 시 `order_items`가 채워지도록 생성 로직 점검
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {order_lines.map(l => (
              <div key={l.id} style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid #f3f4f6',
                background: '#FAFAFA',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.product_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {l.quantity}{l.unit} · {formatKRW(l.unit_price)} / {l.unit}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>
                      {formatKRW(l.unit_price * l.quantity)}
                    </div>
                    {l.saving > 0 && (
                      <div style={{ fontSize: 11, color: '#059669', fontWeight: 800, marginTop: 2 }}>
                        절약 {formatKRW(l.saving)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function Row({
  label,
  value,
  strong,
  color,
}: {
  label: string
  value: string
  strong?: boolean
  color?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0' }}>
      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>{label}</span>
      <span style={{
        fontSize: strong ? 14 : 13,
        color: color ?? '#111827',
        fontWeight: strong ? 900 : 700,
      }}>
        {value}
      </span>
    </div>
  )
}

