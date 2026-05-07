import Link from 'next/link'
import { getTenantId } from '@/lib/get-restaurant'
import { createServerClient } from '@/lib/supabase-server'
import { formatKRW } from '@/lib/utils'
import type { RfqBid, RfqRequest } from '@/types'

type RfqRow = Pick<
  RfqRequest,
  'id' | 'product_name' | 'quantity' | 'unit' | 'current_price' | 'status' | 'created_at'
>

type BidRow = Pick<RfqBid, 'id' | 'rfq_id' | 'supplier_name' | 'price' | 'delivery_days' | 'status' | 'created_at'>

export default async function OrderResultsPage() {
  const tenant_id = await getTenantId()
  const supabase = await createServerClient()

  const { data: rfqs, error: rfqErr } = await supabase
    .from('rfq_requests')
    .select('id, product_name, quantity, unit, current_price, status, created_at')
    .eq('tenant_id', tenant_id)
    .in('status', ['ordered', 'closed'])
    .order('created_at', { ascending: false })
    .limit(30)

  if (rfqErr) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>입찰 결과</h1>
        <p style={{ marginTop: 10, fontSize: 13, color: '#b91c1c' }}>
          데이터를 불러오지 못했어요: {rfqErr.message}
        </p>
      </main>
    )
  }

  const rfqList = (rfqs ?? []) as RfqRow[]
  const rfqIds = rfqList.map((r) => r.id)

  const bidsByRfq = new Map<string, BidRow[]>()
  if (rfqIds.length > 0) {
    const { data: bids } = await supabase
      .from('rfq_bids')
      .select('id, rfq_id, supplier_name, price, delivery_days, status, created_at')
      .in('rfq_id', rfqIds)
      .order('price', { ascending: true })

    for (const b of (bids ?? []) as BidRow[]) {
      const arr = bidsByRfq.get(b.rfq_id) ?? []
      arr.push(b)
      bidsByRfq.set(b.rfq_id, arr)
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
          입찰 결과
        </h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0 0' }}>
          상태가 ordered/closed 인 RFQ 기준
        </p>
      </div>

      {rfqList.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rfqList.map((r) => (
            <ResultCard key={r.id} rfq={r} bids={bidsByRfq.get(r.id) ?? []} />
          ))}
        </div>
      )}
    </main>
  )
}

function ResultCard({ rfq, bids }: { rfq: RfqRow; bids: BidRow[] }) {
  const accepted = bids.find((b) => b.status === 'accepted') ?? null
  const best = bids[0] ?? null
  const show = accepted ?? best

  const statusLabel =
    rfq.status === 'ordered' ? '발주됨' :
    rfq.status === 'closed'  ? '마감' :
    rfq.status

  const savings =
    rfq.current_price && show
      ? Math.max(0, (rfq.current_price - show.price) * rfq.quantity)
      : 0

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
              {rfq.product_name}
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 999,
              background: rfq.status === 'ordered' ? '#ECFDF5' : '#F3F4F6',
              color: rfq.status === 'ordered' ? '#059669' : '#6b7280',
            }}>
              {statusLabel}
            </span>
          </div>

          <div style={{ fontSize: 13, color: '#6b7280' }}>
            수량 {rfq.quantity}{rfq.unit} · 입찰 {bids.length}건
          </div>

          {show ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
                {accepted ? '낙찰' : '최저가'}: {show.supplier_name} · {formatKRW(show.price * rfq.quantity)}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                단가 {formatKRW(show.price)} / {rfq.unit}
                {typeof show.delivery_days === 'number' && ` · ${show.delivery_days}일`}
              </div>
              {rfq.current_price && (
                <div style={{ fontSize: 12, color: savings > 0 ? '#059669' : '#9ca3af', marginTop: 6 }}>
                  기준 단가 {formatKRW(rfq.current_price)} → 예상 절약 {formatKRW(savings)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 13, color: '#9ca3af' }}>
              아직 입찰 정보가 없어요.
            </div>
          )}
        </div>

        <Link
          href={`/rfq/${rfq.id}`}
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: '#111827',
            color: '#fff',
            fontSize: 12,
            fontWeight: 800,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          RFQ 보기 →
        </Link>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: '28px 18px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🏁</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
        입찰 결과가 없어요
      </div>
      <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>
        RFQ를 만들고 입찰을 받으면 여기에서 낙찰 결과를 볼 수 있어요.
      </div>
      <div style={{ marginTop: 16 }}>
        <Link href="/rfq" style={{ display: 'inline-block', padding: '12px 18px', background: '#111827', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          RFQ로 이동
        </Link>
      </div>
    </div>
  )
}

