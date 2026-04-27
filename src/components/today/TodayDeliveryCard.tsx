'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markOrderDelivered } from '@/actions/orders'
import { logTodayEvent } from '@/actions/today-events'
import { getOrCreateSessionId, timeSinceEnter, resetEnterTs } from '@/lib/today-events'
import { formatKRW } from '@/lib/utils'

interface Props {
  restaurantId: string
  order: {
    order_id:      string
    supplier_name: string
    product_name:  string
    quantity:      number
    unit:          string
    unit_price:    number
    total_amount:  number
    saving_amount: number
    ordered_at:    string
    expected_date: string | null
  }
  otherCount: number
}

export default function TodayDeliveryCard({ restaurantId, order, otherCount }: Props) {
  const router = useRouter()
  const [optimisticDone, setOptimisticDone] = useState(false)
  const [failed,         setFailed]         = useState(false)
  const [snoozed,        setSnoozed]        = useState(false)
  const [, startTr]                         = useTransition()

  const today       = new Date().toISOString().slice(0, 10)
  const daysAgo     = Math.floor((Date.now() - new Date(order.ordered_at).getTime()) / 86400000)
  const isOverdue   = !!(order.expected_date && order.expected_date < today)
  const isDueToday  = !!(order.expected_date && order.expected_date === today)
  const daysUntil   = order.expected_date
    ? Math.ceil((new Date(order.expected_date).getTime() - Date.now()) / 86400000)
    : null

  // 상단 상태 레이블
  const statusLabel = isOverdue
    ? { text: '⚠️ 납기가 지났어요', color: '#B91C1C' }
    : isDueToday
    ? { text: '📦 오늘 도착 예정', color: '#15803D' }
    : daysUntil === 1
    ? { text: '📦 내일 도착 예정', color: '#4F46E5' }
    : daysUntil != null && daysUntil > 1
    ? { text: `📦 ${daysUntil}일 후 도착 예정`, color: '#4F46E5' }
    : { text: '📦 주문한 물건 확인', color: '#4F46E5' }

  function handleDelivered() {
    const sid = getOrCreateSessionId()
    if (sid && restaurantId) {
      logTodayEvent({
        tenant_id:           restaurantId,
        session_id:          sid,
        event_type:          'primary_card_click',
        shown_pressure_type: 'none',
        action_kind:         'delivery',
      })
    }

    setOptimisticDone(true)
    setFailed(false)

    startTr(async () => {
      const res = await markOrderDelivered(order.order_id)
      if (res.success) {
        const ms = timeSinceEnter()
        if (sid && restaurantId) {
          logTodayEvent({
            tenant_id:         restaurantId,
            session_id:        sid,
            event_type:        'action_complete',
            action_kind:       'delivery',
            time_to_action_ms: ms ?? undefined,
          })
        }
        resetEnterTs()
        router.refresh()
      } else {
        setOptimisticDone(false)
        setFailed(true)
      }
    })
  }

  function handleSnooze() {
    setSnoozed(true)
    setTimeout(() => {
      setSnoozed(false)
      router.refresh()
    }, 1200)
  }

  // ── 납품 완료 화면 ──────────────────────────────────────────
  if (optimisticDone) {
    return (
      <div style={{
        background: '#F0FDF4', borderRadius: 16,
        border: '1px solid #BBF7D0', overflow: 'hidden',
      }}>
        <div style={{ padding: '22px 18px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          {order.saving_amount > 0 ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#15803D', marginBottom: 4 }}>
                이번 거래로 {formatKRW(order.saving_amount)} 아꼈습니다
              </div>
              <div style={{ fontSize: 12, color: '#16A34A' }}>
                다음엔 더 정확하게 비교됩니다
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#15803D', marginBottom: 4 }}>
                받았어요!
              </div>
              <div style={{ fontSize: 12, color: '#16A34A' }}>
                이 데이터로 더 좋은 조건을 찾을 수 있습니다
              </div>
            </>
          )}
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <a href="/rfq/new" style={{
            display: 'block', padding: '13px',
            background: '#15803D', color: '#fff',
            borderRadius: 10, fontSize: 14, fontWeight: 700,
            textDecoration: 'none', textAlign: 'center',
          }}>
            다른 품목도 비교해보세요
          </a>
          <div style={{ fontSize: 11, color: '#16A34A', textAlign: 'center', marginTop: 8 }}>
            지금 비교하면 더 좋은 조건을 찾을 수 있습니다
          </div>
        </div>
      </div>
    )
  }

  // ── 스누즈 메시지 ───────────────────────────────────────────
  if (snoozed) {
    return (
      <div style={{
        background: '#F9FAFB', borderRadius: 16,
        border: '1px solid #e5e7eb', padding: '24px 20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 14, color: '#6b7280', fontWeight: 600 }}>
          알겠어요. 내일 다시 확인할게요.
        </div>
      </div>
    )
  }

  // ── 납품 대기 카드 ──────────────────────────────────────────
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: isOverdue ? '1px solid #FCA5A5' : '1px solid #E0E7FF',
      overflow: 'hidden',
    }}>
      {/* 상단 상태 */}
      <div style={{
        padding: '12px 18px 0',
        fontSize: 12, fontWeight: 700,
        color: statusLabel.color,
      }}>
        {statusLabel.text}
      </div>

      {/* 주문 내용 */}
      <div style={{ padding: '10px 18px 0' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
          {order.product_name}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 2 }}>
          {order.supplier_name} · {order.quantity}{order.unit}
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          {daysAgo === 0 ? '오늘' : `${daysAgo}일 전`} 주문
          {order.expected_date && (
            <span style={{ color: isOverdue ? '#EF4444' : '#9ca3af' }}>
              {' · '}{order.expected_date.slice(5).replace('-', '/')} 예정
            </span>
          )}
        </div>
        {otherCount > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
            외 {otherCount}건 대기 중
          </div>
        )}
        {failed && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#EF4444', fontWeight: 600 }}>
            처리 실패 · 다시 눌러주세요
          </div>
        )}
      </div>

      {/* 버튼 */}
      <div style={{ padding: '14px 16px' }}>
        <button
          onClick={handleDelivered}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          style={{
            width: '100%', padding: '15px',
            background: '#111827', color: '#fff', border: 'none',
            borderRadius: 12, fontSize: 16, fontWeight: 700,
            cursor: 'pointer', marginBottom: 8,
            transition: 'transform 0.08s ease',
          }}
        >
          받았어요
        </button>
        <button
          onClick={handleSnooze}
          style={{
            width: '100%', padding: '10px',
            background: 'transparent', color: '#9ca3af',
            border: 'none', fontSize: 12, cursor: 'pointer',
          }}
        >
          아직 안 왔어요
        </button>
      </div>
    </div>
  )
}
