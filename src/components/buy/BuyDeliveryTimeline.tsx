import type { BuyDeliveryTimeline as TimelineData } from '@/actions/buy-delivery'
import {
  DELIVERY_PROGRESS_STATUSES,
  DELIVERY_STATUS_LABEL,
  isDeliveryException,
} from '@/lib/delivery-status'

const BRAND = '#1f5d3a'
const LINE = '#e5e7eb'
const MUTED = '#9ca3af'
const INK = '#1a1a1a'

function fmt(iso: string | undefined | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

/**
 * 배송 타임라인 (진행 6단계 + 예외 안내).
 *
 * 기존 3단계 타임라인(BuyOrderTimeline — 주문접수/결제완료/완료)은 결제 흐름을 보여주므로 그대로 두고,
 * 이 컴포넌트는 그 아래에 **배송 추적이 시작된 주문에만** 나란히 붙는다.
 * 세로 목록으로 둔 이유: 6단계를 가로로 놓으면 480px 폭에서 라벨이 겹친다.
 */
export default function BuyDeliveryTimeline({ data }: { data: TimelineData }) {
  const exception = isDeliveryException(data.delivery_status)

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 14px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', margin: 0, letterSpacing: '.06em' }}>배송 상태</p>
        <span style={{ fontSize: 12, fontWeight: 700, color: exception ? '#b91c1c' : BRAND }}>
          {DELIVERY_STATUS_LABEL[data.delivery_status]}
        </span>
      </div>

      {exception ? (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 14,
            fontSize: 13,
            color: '#991b1b',
            lineHeight: 1.5,
          }}
        >
          {data.delivery_status === 'attention'
            ? '배송에 확인이 필요한 일이 생겼습니다. 담당자가 확인 중이며, 궁금하시면 아래 주문 문의로 알려주세요.'
            : '배송 정보를 확인하지 못했습니다. 담당자가 확인 중입니다.'}
          {fmt(data.exception_since) ? <span style={{ color: '#b91c1c' }}> ({fmt(data.exception_since)})</span> : null}
        </div>
      ) : null}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {DELIVERY_PROGRESS_STATUSES.map((st, i) => {
          const reached = i <= data.max_reached_rank
          const isCurrent = !exception && st === data.delivery_status
          const last = i === DELIVERY_PROGRESS_STATUSES.length - 1
          const when = fmt(data.reached_at[st])
          return (
            <li key={st} style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
                <span
                  aria-hidden
                  style={{
                    width: isCurrent ? 14 : 10,
                    height: isCurrent ? 14 : 10,
                    borderRadius: 999,
                    marginTop: isCurrent ? 2 : 4,
                    background: reached ? BRAND : '#fff',
                    border: `2px solid ${reached ? BRAND : LINE}`,
                    boxSizing: 'border-box',
                    flexShrink: 0,
                  }}
                />
                {!last ? (
                  <span
                    aria-hidden
                    style={{ width: 2, flex: 1, minHeight: 14, background: i < data.max_reached_rank ? BRAND : LINE }}
                  />
                ) : null}
              </div>
              <div style={{ paddingBottom: last ? 0 : 10, display: 'flex', justifyContent: 'space-between', flex: 1, gap: 8 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? INK : reached ? BRAND : MUTED,
                  }}
                >
                  {DELIVERY_STATUS_LABEL[st]}
                </span>
                {reached && when ? <span style={{ fontSize: 12, color: MUTED }}>{when}</span> : null}
              </div>
            </li>
          )
        })}
      </ol>

      {data.delivery_carrier || data.delivery_tracking_no ? (
        <p style={{ fontSize: 12, color: '#6b7280', margin: '12px 0 0', borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
          {data.delivery_carrier ?? '택배'}
          {data.delivery_tracking_no ? ` · 송장번호 ${data.delivery_tracking_no}` : ''}
        </p>
      ) : null}
    </div>
  )
}
