const BRAND = '#1f5d3a'
const LINE = '#e5e7eb'
const MUTED = '#9ca3af'
const INK = '#1a1a1a'

/**
 * 주문 진행 단계.
 *
 * 지금은 운영에서 preparing/shipped 중간 단계를 쓰는지 확인되지 않아
 * 3단계로만 보여준다. 중간 단계를 실제로 쓰기 시작하면
 * STEPS 배열에 추가하고 resolveStepIndex 의 매핑만 늘리면 된다.
 */
const STEPS = [
  { key: 'ordered', label: '주문접수' },
  { key: 'paid', label: '결제완료' },
  { key: 'completed', label: '완료' },
] as const

/** 주문 status → 현재 단계 인덱스. 알 수 없는 값은 첫 단계로 본다. */
function resolveStepIndex(status: string): number {
  switch (status) {
    case 'pending_payment':
      return 0
    case 'paid':
    case 'preparing':
    case 'shipped':
      return 1
    case 'completed':
      return 2
    default:
      return 0
  }
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function BuyOrderTimeline({ status }: { status: string }) {
  // 취소·환불은 진행 단계가 아니라 종료 상태 — 타임라인 대신 상태만 알린다
  if (status === 'cancelled' || status === 'refunded') {
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', margin: '0 0 10px', letterSpacing: '.06em' }}>
          진행 상태
        </p>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', margin: 0 }}>
          {status === 'cancelled' ? '취소된 주문입니다' : '환불이 완료된 주문입니다'}
        </p>
      </div>
    )
  }

  const current = resolveStepIndex(status)

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 10 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', margin: '0 0 16px', letterSpacing: '.06em' }}>
        진행 상태
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {STEPS.map((step, i) => {
          const done = i < current
          const active = i === current
          const reached = done || active
          return (
            <div key={step.key} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    flexShrink: 0,
                    background: reached ? BRAND : '#fff',
                    border: `2px solid ${reached ? BRAND : LINE}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                  }}
                  aria-hidden
                >
                  {done ? (
                    <CheckIcon />
                  ) : active ? (
                    <span style={{ width: 7, height: 7, borderRadius: 4, background: '#fff' }} />
                  ) : null}
                </div>
                {i < STEPS.length - 1 ? (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: i < current ? BRAND : LINE,
                      marginLeft: 2,
                      marginRight: 2,
                    }}
                    aria-hidden
                  />
                ) : null}
              </div>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  color: active ? INK : reached ? BRAND : MUTED,
                  margin: '8px 0 0',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
