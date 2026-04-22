import { getRfqDetail, getOrderByRfqId } from '@/actions/rfq'
import BidCompareClient from '@/components/rfq/BidCompareClient'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RfqDetailPage({ params }: Props) {
  const { id } = await params
  const result = await getRfqDetail(id)

  if (!result.success || !result.data) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        <p style={{ color: '#9ca3af' }}>요청을 찾을 수 없어요</p>
        <Link href="/rfq">← 목록으로</Link>
      </main>
    )
  }

  const { rfq, bids } = result.data

  // 확정 후 상태 표시용 — ordered/cancelled 상태일 때만 실제로 쿼리가 의미 있음
  const orderResult = rfq.status === 'ordered' || rfq.status === 'cancelled'
    ? await getOrderByRfqId(id)
    : null
  const linkedOrder = orderResult?.data ?? null

  // 헤더 텍스트: 상태에 따라 다르게
  const headerTitle = linkedOrder
    ? linkedOrder.status === 'completed' ? '납품 완료'
    : linkedOrder.status === 'cancelled' ? '취소된 주문'
    : '납품 대기 중'
    : bids.length === 0 ? '견적 기다리는 중'
    : '견적 비교'

  const headerSub = linkedOrder
    ? linkedOrder.status === 'completed' ? '납품이 완료됐어요 ✓'
    : linkedOrder.status === 'cancelled' ? '이 주문은 취소됐어요'
    : '주문 확정 후 납품을 기다리고 있어요'
    : bids.length > 0
      ? `${bids.length}개 조건이 들어왔어요. 골라볼까요?`
      : '입찰 조건을 확인 중이에요'

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/rfq" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
          ← 발주요청 목록
        </Link>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
          {headerTitle}
        </h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0 0' }}>
          {headerSub}
        </p>
      </div>

      <BidCompareClient rfq={rfq} bids={bids} linkedOrder={linkedOrder} />
    </main>
  )
}
