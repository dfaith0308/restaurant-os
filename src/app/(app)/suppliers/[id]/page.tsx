import { getSupplierDetail } from '@/actions/suppliers'
import Link from 'next/link'
import { formatKRW } from '@/lib/utils'

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getSupplierDetail(id)
  if (!result.success || !result.data) {
    return <main style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>거래처를 찾을 수 없어요</main>
  }
  const s = result.data

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <Link href="/suppliers" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>← 거래처 목록</Link>

      <div style={{ marginTop: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{s.name}</h1>
        {s.region  && <div style={{ fontSize: 13, color: '#9ca3af' }}>{s.region}</div>}
        {s.contact && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>📞 {s.contact}</div>}
      </div>

      {/* 거래 요약 */}
      {(s.total_orders ?? 0) > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>총 거래 횟수</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{s.total_orders}회</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>총 거래 금액</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{formatKRW(s.total_amount)}</div>
          </div>
        </div>
      )}

      {/* 메모 */}
      {s.memo && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92400E' }}>
          📝 {s.memo}
        </div>
      )}

      {/* 행동 버튼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        <Link href={`/rfq/new?supplier=${encodeURIComponent(s.name)}`}
          style={{ display: 'block', padding: '13px', background: '#111827', color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
          이 거래처로 발주요청 하기
        </Link>
        <Link href="/rfq/new"
          style={{ display: 'block', padding: '11px', background: '#fff', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 12, fontSize: 13, fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>
          다른 곳과 비교해보기
        </Link>
      </div>

      {/* 최근 거래 */}
      {s.recent_order && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>최근 거래</div>
          <div style={{ fontSize: 13, color: '#111827' }}>{s.recent_order.product_name}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            {formatKRW(s.recent_order.total_amount)} · {s.recent_order.created_at.slice(0, 10)}
          </div>
        </div>
      )}
    </main>
  )
}
