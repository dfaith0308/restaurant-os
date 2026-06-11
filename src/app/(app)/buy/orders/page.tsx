import { redirect } from 'next/navigation'

export default function BuyOrdersPage() {
  redirect('/buy')
}

/*
import Link from 'next/link'
import { getMyCommerceOrders } from '@/actions/buy'
import { formatKRW } from '@/lib/utils'

const shell = { maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' } as const

const STATUS_KO: Record<string, string> = {
  pending_payment: '결제대기',
  paid: '결제완료',
  preparing: '준비중',
  shipped: '배송중',
  completed: '완료',
  cancelled: '취소',
  refunded: '환불완료',
}

function orderNo(row: { order_number: string | null }) {
  const n = row.order_number?.trim()
  return n || '주문번호 준비중'
}

export default async function BuyOrdersPage() {
  const res = await getMyCommerceOrders()
  const orders = res.success ? res.data?.orders ?? [] : []

  return (
    <main style={shell}>
      <Link href="/buy" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← 구매하기
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 16px' }}>구매 내역</h1>

      {!res.success ? (
        <p style={{ color: '#b91c1c', fontSize: 14 }}>{res.error}</p>
      ) : orders.length === 0 ? (
        <p style={{ fontSize: 14, color: '#6b7280' }}>구매 내역이 없습니다</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map((o) => (
            <li
              key={o.id}
              style={{
                padding: 14,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 14,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--color-text)' }}>{orderNo(o)}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
                {STATUS_KO[o.status] ?? o.status} · {formatKRW(o.total_amount)}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                {new Date(o.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
*/
