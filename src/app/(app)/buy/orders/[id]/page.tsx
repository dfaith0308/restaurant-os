import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCommerceOrderDetail } from '@/actions/buy'
import { formatKRW } from '@/lib/utils'

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: '결제대기', color: '#92400e', bg: '#fffbeb' },
  paid: { label: '결제완료', color: '#1f5d3a', bg: '#f0fdf4' },
  preparing: { label: '준비중', color: '#1d4ed8', bg: '#eff6ff' },
  shipped: { label: '배송중', color: '#7c3aed', bg: '#f5f3ff' },
  completed: { label: '완료', color: '#374151', bg: '#f3f4f6' },
  cancelled: { label: '취소', color: '#dc2626', bg: '#fef2f2' },
  refunded: { label: '환불', color: '#dc2626', bg: '#fef2f2' },
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  card: '카드결제',
  bank_transfer: '무통장입금',
  kakao_manual: '카카오 수동',
}

export default async function CommerceOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await getCommerceOrderDetail(id)
  if (!res.success || !res.data?.order) notFound()
  const o = res.data.order
  const status = STATUS_LABEL[o.status] ?? { label: o.status, color: '#374151', bg: '#f3f4f6' }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 96px', background: '#f7f6f2', minHeight: '100vh' }}>

      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f7f6f2', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #ece9e3' }}>
        <Link href="/orders" style={{ fontSize: 22, color: '#2b2b2b', textDecoration: 'none', lineHeight: 1 }}>←</Link>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#2b2b2b' }}>주문 상세</span>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
              {o.order_number ?? o.id.slice(0, 8).toUpperCase()}
            </span>
            <span style={{
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              color: status.color,
              background: status.bg,
            }}>{status.label}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>주문일시</span>
              <span style={{ color: '#1a1a1a' }}>{new Date(o.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>결제수단</span>
              <span style={{ color: '#1a1a1a' }}>{PAYMENT_METHOD_LABEL[o.payment_method] ?? o.payment_method}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>결제상태</span>
              <span style={{ color: o.payment_status === 'paid' ? '#1f5d3a' : '#92400e', fontWeight: 600 }}>
                {o.payment_status === 'paid' ? '결제완료' : o.payment_status === 'refunded' ? '환불' : '미결제'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', margin: '0 0 12px', letterSpacing: '.06em', textTransform: 'uppercase' as const }}>주문 품목</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {o.items.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a', margin: '0 0 3px', lineHeight: 1.35 }}>{item.listing_title}</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{formatKRW(item.unit_price)} × {item.quantity}개</p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginLeft: 12 }}>{formatKRW(item.total_price)}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 14, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>총 결제금액</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1f5d3a' }}>{formatKRW(o.total_amount)}</span>
          </div>
        </div>

        {(o.shipping_name || o.shipping_address) && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', margin: '0 0 12px', letterSpacing: '.06em', textTransform: 'uppercase' as const }}>배송 정보</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {o.shipping_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>수령인</span>
                  <span style={{ color: '#1a1a1a' }}>{o.shipping_name}</span>
                </div>
              )}
              {o.shipping_phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>연락처</span>
                  <span style={{ color: '#1a1a1a' }}>{o.shipping_phone}</span>
                </div>
              )}
              {o.shipping_address && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ color: '#6b7280', flexShrink: 0 }}>주소</span>
                  <span style={{ color: '#1a1a1a', textAlign: 'right' }}>{o.shipping_address}</span>
                </div>
              )}
              {o.delivery_memo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>배송메모</span>
                  <span style={{ color: '#1a1a1a' }}>{o.delivery_memo}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <Link href="/buy" style={{
          display: 'block',
          padding: '14px',
          background: '#1f5d3a',
          borderRadius: 12,
          textAlign: 'center',
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 700,
          color: '#fff',
        }}>
          다시 구매하기
        </Link>
      </div>
    </main>
  )
}
