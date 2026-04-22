'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptBidAndCreateOrder, closeRfq } from '@/actions/rfq'
import { markOrderDelivered, cancelOrder } from '@/actions/orders'
import { getOrCreateSessionId } from '@/lib/today-events'
import type { RfqBid, RfqRequest } from '@/types'
import type { LinkedOrder } from '@/actions/rfq'
import { formatKRW } from '@/lib/utils'

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? ''

interface Props {
  rfq:         RfqRequest
  bids:        RfqBid[]
  linkedOrder: LinkedOrder | null
}

export default function BidCompareClient({ rfq, bids, linkedOrder }: Props) {
  const router = useRouter()
  const [isPending, startTr] = useTransition()
  const [done,      setDone] = useState(false)
  const [closing,   setClosing] = useState(false)

  const bestBid    = bids[0]
  const bestSaving = bestBid?.saving_amount ?? 0
  const bestTotal  = bestBid ? bestBid.price * rfq.quantity : 0

  // 발주 완료 시 납기 예상일 계산
  const [acceptedBid, setAcceptedBid] = useState<typeof bids[0] | null>(null)

  function handleAccept(bidId: string) {
    const bid = bids.find(b => b.id === bidId) ?? null
    startTr(async () => {
      const sid = getOrCreateSessionId()
      const res = await acceptBidAndCreateOrder(rfq.id, bidId, RESTAURANT_ID, sid || undefined)
      if (res.success) {
        setAcceptedBid(bid)
        setDone(true)
        // 자동 이동 제거 — 사용자가 직접 버튼으로 이동
      }
    })
  }

  function handleClose(reason: string) {
    startTr(async () => {
      await closeRfq(rfq.id, reason)
      router.push('/rfq')
    })
  }

  if (linkedOrder) {
    return <LinkedOrderPanel order={linkedOrder} rfq={rfq} />
  }

  if (done) {
    const deliveryDays = acceptedBid?.delivery_days ?? null
    const expectedDate = deliveryDays
      ? (() => {
          const d = new Date()
          d.setDate(d.getDate() + deliveryDays)
          return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
        })()
      : null
    const saving = acceptedBid?.saving_amount ?? bestSaving

    return (
      <div style={{
        background: '#F0FDF4', borderRadius: 16,
        border: '1px solid #BBF7D0', overflow: 'hidden',
      }}>
        <div style={{ padding: '28px 20px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#15803D', marginBottom: 4 }}>
            발주됐어요!
          </div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
            {rfq.product_name} · {rfq.quantity}{rfq.unit}
          </div>

          <div style={{
            background: '#fff', borderRadius: 12, padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left',
          }}>
            {expectedDate && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>납품 예상일</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  {expectedDate}
                </span>
              </div>
            )}
            {saving > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>기대 절약액</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#15803D' }}>
                  {formatKRW(saving)}
                </span>
              </div>
            )}
          </div>

          {expectedDate && (
            <div style={{ fontSize: 12, color: '#16A34A', marginTop: 12 }}>
              납품 받으면 Today에서 바로 확인하세요 · 거래 기록이 쌓여 다음엔 더 정확해져요
            </div>
          )}
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          <a href="/today" style={{
            display: 'block', padding: '14px',
            background: '#15803D', color: '#fff',
            borderRadius: 12, fontSize: 15, fontWeight: 700,
            textDecoration: 'none', textAlign: 'center',
          }}>
            오늘운영 보기
          </a>
        </div>
      </div>
    )
  }

  // ── 입찰 없음 ──────────────────────────────────────────────
  if (bids.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '48px 24px',
        background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
          견적 확인 중이에요
        </div>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          도착하면 바로 알려드릴게요
        </div>
      </div>
    )
  }

  // ── 입찰 1개: 비교 없이 즉시 발주 ──────────────────────────
  if (bids.length === 1) {
    const bid = bids[0]
    const total = bid.price * rfq.quantity
    return (
      <div>
        {/* 헤더 */}
        <div style={{
          background: '#F0FDF4', border: '1px solid #BBF7D0',
          borderRadius: 14, padding: '16px 18px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, color: '#15803D', fontWeight: 700, marginBottom: 4 }}>
            견적이 도착했어요
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
            {bid.supplier_name}
          </div>
          {bid.delivery_days && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              납기 {bid.delivery_days}일
            </div>
          )}
        </div>

        {/* 가격 */}
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 14, padding: '18px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>단가</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
                {formatKRW(bid.price)}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {rfq.quantity}{rfq.unit} · 합계 {formatKRW(total)}
              </div>
            </div>
            {(bid.saving_amount ?? 0) > 0 && (
              <div style={{
                background: '#DCFCE7', borderRadius: 10, padding: '8px 12px',
                textAlign: 'right',
              }}>
                <div style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>절약</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#15803D' }}>
                  {formatKRW(bid.saving_amount)}
                </div>
              </div>
            )}
          </div>
          {bid.note && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
              💬 {bid.note}
            </div>
          )}
        </div>

        {/* 즉시 발주 버튼 */}
        <button
          onClick={() => handleAccept(bid.id)}
          disabled={isPending}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          style={{
            width: '100%', padding: '16px',
            background: isPending ? '#6B7280' : '#111827',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 16, fontWeight: 700, cursor: isPending ? 'not-allowed' : 'pointer',
            marginBottom: 12,
            transition: 'transform 0.08s ease',
          }}
        >
          {isPending ? '처리 중...' : `지금 ${formatKRW(total)}에 발주하기`}
        </button>

        {/* 기존 거래 유지 — 텍스트만 */}
        {rfq.status === 'open' && !closing && (
          <button
            onClick={() => setClosing(true)}
            style={{
              width: '100%', padding: '10px',
              background: 'transparent', border: 'none',
              fontSize: 12, color: '#9ca3af', cursor: 'pointer',
            }}
          >
            기존 거래 유지할게요
          </button>
        )}

        {closing && <CloseReasonPanel onClose={handleClose} isPending={isPending} />}
      </div>
    )
  }

  // ── 입찰 2개 이상: 최선 강조 + 나머지 보조 ─────────────────
  return (
    <div>
      {/* 최선 입찰 — 즉시 발주 강조 */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: '2px solid #111827',
        padding: '18px', marginBottom: 12,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -11, left: 14,
          background: '#111827', color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
        }}>
          ✓ 가장 싼 조건
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
              {bestBid.supplier_name}
            </div>
            {bestBid.delivery_days && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                납기 {bestBid.delivery_days}일
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
              {formatKRW(bestBid.price)}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>단가</div>
          </div>
        </div>

        {bestSaving > 0 && (
          <div style={{
            background: '#DCFCE7', borderRadius: 8,
            padding: '8px 12px', marginBottom: 14,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: '#15803D', fontWeight: 600 }}>
              지금보다 아끼는 금액
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#15803D' }}>
              {formatKRW(bestSaving)}
            </span>
          </div>
        )}

        {bestBid.note && (
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            💬 {bestBid.note}
          </div>
        )}

        <button
          onClick={() => handleAccept(bestBid.id)}
          disabled={isPending}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          style={{
            width: '100%', padding: '15px',
            background: isPending ? '#6B7280' : '#111827',
            color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 700, cursor: isPending ? 'not-allowed' : 'pointer',
            transition: 'transform 0.08s ease',
          }}
        >
          {isPending ? '처리 중...' : `지금 ${formatKRW(bestTotal)}에 발주하기`}
        </button>
      </div>

      {/* 나머지 입찰 — 보조 */}
      {bids.slice(1).map(bid => {
        const total = bid.price * rfq.quantity
        return (
          <div key={bid.id} style={{
            background: '#F9FAFB', borderRadius: 12,
            border: '1px solid #e5e7eb', padding: '14px 16px',
            marginBottom: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                {bid.supplier_name}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                {formatKRW(bid.price)} · 합계 {formatKRW(total)}
                {bid.delivery_days ? ` · 납기 ${bid.delivery_days}일` : ''}
              </div>
            </div>
            <button
              onClick={() => handleAccept(bid.id)}
              disabled={isPending}
              style={{
                padding: '8px 14px',
                background: '#fff', color: '#374151',
                border: '1px solid #e5e7eb', borderRadius: 8,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              이 조건으로
            </button>
          </div>
        )
      })}

      {/* 기존 거래 유지 — 텍스트만 */}
      {rfq.status === 'open' && !closing && (
        <button
          onClick={() => setClosing(true)}
          style={{
            width: '100%', padding: '12px',
            background: 'transparent', border: 'none',
            fontSize: 12, color: '#9ca3af', cursor: 'pointer',
            marginTop: 4,
          }}
        >
          기존 거래 유지할게요
        </button>
      )}

      {closing && <CloseReasonPanel onClose={handleClose} isPending={isPending} />}
    </div>
  )
}

// ── 기존 거래 유지 이유 선택 ────────────────────────────────
function CloseReasonPanel({ onClose, isPending }: { onClose: (r: string) => void; isPending: boolean }) {
  return (
    <div style={{
      background: '#F9FAFB', border: '1px solid #e5e7eb',
      borderRadius: 12, padding: '14px', marginTop: 6,
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
        이유를 알려주시면 다음에 더 잘 도와드릴 수 있어요
      </div>
      {[
        { key: '기존 거래처 유지',  label: '기존 거래처가 더 믿을 수 있어요' },
        { key: '가격 조건 미충족',  label: '원하는 가격이 안 나왔어요' },
        { key: '납기 조건 미충족',  label: '납기 조건이 안 맞아요' },
        { key: '기타',             label: '다른 이유예요' },
      ].map(r => (
        <button key={r.key}
          onClick={() => onClose(r.key)}
          disabled={isPending}
          style={{
            display: 'block', width: '100%', padding: '10px 12px',
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 8, fontSize: 13, color: '#374151',
            cursor: 'pointer', textAlign: 'left', marginBottom: 6,
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

// ── 주문 확정 이후 상태 패널 ──────────────────────────────────
function LinkedOrderPanel({ order, rfq }: { order: LinkedOrder; rfq: RfqRequest }) {
  const router = useRouter()
  const [isPending, startTr] = useTransition()
  const [localStatus, setLocalStatus] = useState(order.status)
  const [cancelling,  setCancelling]  = useState(false)

  const daysAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 86400000)

  function handleDelivered() {
    startTr(async () => {
      const res = await markOrderDelivered(order.id)
      if (res.success) setLocalStatus('completed')
    })
  }

  function handleCancel() {
    startTr(async () => {
      const res = await cancelOrder(order.id)
      if (res.success) { setLocalStatus('cancelled'); setCancelling(false) }
    })
  }

  if (localStatus === 'completed') {
    return (
      <div style={{
        background: '#F0FDF4', borderRadius: 16,
        border: '1px solid #BBF7D0', padding: '28px 20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#15803D', marginBottom: 6 }}>
          납품 완료됐어요
        </div>
        <div style={{ fontSize: 13, color: '#16A34A', marginBottom: 4 }}>
          {order.product_name} · {order.quantity}{order.unit}
        </div>
        {order.saving_amount > 0 && (
          <div style={{
            marginTop: 12, display: 'inline-block',
            background: '#DCFCE7', borderRadius: 10, padding: '6px 14px',
            fontSize: 13, fontWeight: 700, color: '#15803D',
          }}>
            이번 발주로 {formatKRW(order.saving_amount)} 절약 👍
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            구매가가 {formatKRW(order.unit_price)}으로 업데이트됐어요
          </div>
        </div>
        <a href="/today" style={{
          display: 'inline-block', marginTop: 20,
          fontSize: 13, color: '#15803D', fontWeight: 600, textDecoration: 'none',
        }}>
          오늘운영으로 돌아가기 →
        </a>
      </div>
    )
  }

  if (localStatus === 'cancelled') {
    return (
      <div style={{
        background: '#F9FAFB', borderRadius: 16,
        border: '1px solid #E5E7EB', padding: '28px 20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
          취소된 주문이에요
        </div>
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>
          연결된 지급 예정도 함께 취소됐어요
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        background: '#EFF6FF', borderRadius: 14,
        border: '1px solid #BFDBFE', padding: '16px 18px',
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 600, marginBottom: 6 }}>
          🚚 납품 대기 중
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
          {order.product_name}
        </div>
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 2 }}>
          {order.supplier_name} · {order.quantity}{order.unit} · {formatKRW(order.unit_price)}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
          {daysAgo === 0 ? '오늘' : `${daysAgo}일 전`} 주문 확정
          {rfq.deadline && ` · 마감 ${rfq.deadline.slice(0, 10)}`}
        </div>
        {order.saving_amount > 0 && (
          <div style={{
            marginTop: 10, fontSize: 12, fontWeight: 600, color: '#15803D',
            background: '#DCFCE7', borderRadius: 8, padding: '4px 10px', display: 'inline-block',
          }}>
            기존보다 {formatKRW(order.saving_amount)} 절약 예정
          </div>
        )}
      </div>

      <button
        onClick={handleDelivered}
        disabled={isPending}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        style={{
          width: '100%', padding: '15px',
          background: isPending ? '#6B7280' : '#111827',
          color: '#fff', border: 'none',
          borderRadius: 12, fontSize: 15, fontWeight: 700,
          cursor: isPending ? 'not-allowed' : 'pointer',
          marginBottom: 10,
          transition: 'transform 0.08s ease',
        }}
      >
        {isPending ? '처리 중...' : '받았어요 — 납품 완료'}
      </button>

      {!cancelling ? (
        <button
          onClick={() => setCancelling(true)}
          style={{
            width: '100%', padding: '10px',
            background: 'transparent', color: '#9CA3AF',
            border: 'none', fontSize: 12, cursor: 'pointer',
          }}
        >
          이 주문 취소하기
        </button>
      ) : (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5',
          borderRadius: 12, padding: '16px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#B91C1C', marginBottom: 10 }}>
            주문을 취소하면 지급 예정도 함께 취소돼요. 계속할까요?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCancel}
              disabled={isPending}
              style={{
                flex: 1, padding: '10px',
                background: '#EF4444', color: '#fff', border: 'none',
                borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {isPending ? '처리 중...' : '네, 취소할게요'}
            </button>
            <button
              onClick={() => setCancelling(false)}
              style={{
                flex: 1, padding: '10px',
                background: '#fff', color: '#374151',
                border: '1px solid #E5E7EB',
                borderRadius: 10, fontSize: 13, cursor: 'pointer',
              }}
            >
              아니요
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
