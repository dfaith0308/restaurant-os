'use client'

import { useState, useTransition } from 'react'
import { markPaymentPaid } from '@/actions/today'
import { formatKRW } from '@/lib/utils'
import type { PaymentOutgoing } from '@/types'
import { logTodayEvent } from '@/actions/today-events'
import { getOrCreateSessionId, timeSinceEnter, resetEnterTs } from '@/lib/today-events'

interface Props {
  urgentPayments: PaymentOutgoing[]
  totalDue:       number
}

export default function TodayPaymentCard({ urgentPayments, totalDue }: Props) {
  // 낙관적 업데이트 — 클릭 즉시 완료, 실패 시 롤백
  const [paid, setPaid]     = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const [, startTr]         = useTransition()

  function handlePay(id: string) {
    // 즉시 완료 처리
    setPaid(prev => new Set([...prev, id]))
    setFailed(prev => { const n = new Set(prev); n.delete(id); return n })

    const target = urgentPayments.find(p => p.id === id)
    const restaurantId = target?.restaurant_id ?? ''
    const sid = getOrCreateSessionId()

    if (restaurantId && sid) {
      logTodayEvent({
        restaurant_id:       restaurantId,
        session_id:          sid,
        event_type:          'primary_card_click',
        shown_pressure_type: 'time',
        action_kind:         'payment',
      })
    }

    startTr(async () => {
      const res = await markPaymentPaid(id)
      if (res.success) {
        if (restaurantId && sid) {
          logTodayEvent({
            restaurant_id:       restaurantId,
            session_id:          sid,
            event_type:          'action_complete',
            action_kind:         'payment',
            shown_pressure_type: 'time',
            time_to_action_ms:   timeSinceEnter(),
          })
          resetEnterTs()
        }
      } else {
        // 실패 시 롤백
        setPaid(prev => { const n = new Set(prev); n.delete(id); return n })
        setFailed(prev => new Set([...prev, id]))
      }
    })
  }

  const remaining = urgentPayments.filter(p => !paid.has(p.id))

  const daysLabel = (due: string) => {
    const diff = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000)
    if (diff < 0)   return { text: `${Math.abs(diff)}일 연체`, urgent: true }
    if (diff === 0) return { text: '오늘',  urgent: true }
    if (diff === 1) return { text: '내일',  urgent: true }
    return { text: `${diff}일 후`, urgent: false }
  }

  const soonest = remaining[0]
    ? Math.ceil((new Date(remaining[0].due_date).getTime() - Date.now()) / 86400000)
    : Infinity
  const headerSub =
    soonest < 0    ? '⚠️ 연체 중 — 지금 바로 처리하세요' :
    soonest === 0  ? '오늘 안에 처리하세요' :
    soonest === 1  ? '내일까지 처리하세요' :
    soonest <= 3   ? `${soonest}일 안에 처리하세요` : null

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1.5px solid #FCA5A5', overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px', background: '#FFF1F2',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600, marginBottom: 2 }}>
            💸 지금 내야 할 돈
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#B91C1C' }}>
            {formatKRW(totalDue)}
          </div>
          {headerSub && (
            <div style={{ fontSize: 11, color: '#991B1B', fontWeight: 600, marginTop: 2 }}>
              {headerSub}
            </div>
          )}
        </div>
        <a href="/money" style={{
          fontSize: 12, color: '#EF4444', textDecoration: 'none', fontWeight: 600,
        }}>
          전체 보기 →
        </a>
      </div>

      <div style={{ padding: '8px 0' }}>
        {/* 완료된 항목 — 즉시 체크 표시 */}
        {urgentPayments.filter(p => paid.has(p.id)).map(p => (
          <div key={`done-${p.id}`} style={{
            padding: '10px 18px',
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: 0.5,
          }}>
            <span style={{ color: '#15803D', fontSize: 16, fontWeight: 700 }}>✓</span>
            <span style={{ fontSize: 14, color: '#6b7280', textDecoration: 'line-through' }}>
              {p.supplier_name} {formatKRW(p.amount)}
            </span>
          </div>
        ))}

        {remaining.map(p => {
          const day = daysLabel(p.due_date)
          const isFailed = failed.has(p.id)
          return (
            <div key={p.id} style={{ padding: '10px 16px' }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                  {p.supplier_name}
                </div>
                <div style={{ fontSize: 12, color: day.urgent ? '#EF4444' : '#9ca3af', marginTop: 2 }}>
                  {formatKRW(p.amount)} · {day.text}
                </div>
                {isFailed && (
                  <div style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>
                    처리 실패 · 다시 눌러주세요
                  </div>
                )}
              </div>
              <button
                onClick={() => handlePay(p.id)}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; e.currentTarget.style.background = '#374151' }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = isFailed ? '#EF4444' : '#111827' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = isFailed ? '#EF4444' : '#111827' }}
                style={{
                  width: '100%', padding: '13px',
                  background: isFailed ? '#EF4444' : '#111827',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  transition: 'transform 0.08s ease, background 0.1s ease',
                }}
              >
                지금 지급
              </button>
            </div>
          )
        })}

        {remaining.length === 0 && (
          <div style={{ padding: '16px 16px' }}>
            <div style={{ fontSize: 14, color: '#15803D', fontWeight: 700, marginBottom: 4 }}>
              ✓ 모두 처리했어요
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              지급 기록이 쌓일수록 더 좋은 거래 조건을 찾기 쉬워져요
            </div>
            <a href="/rfq/new" style={{
              display: 'block', padding: '13px',
              background: '#111827', color: '#fff',
              borderRadius: 10, fontSize: 14, fontWeight: 700,
              textDecoration: 'none', textAlign: 'center',
            }}>
              더 싼 곳 찾기
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
