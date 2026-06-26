import Link from 'next/link'
import { getSubscriptionStatus } from '@/actions/subscribe'

const PLANS = [
  {
    id: 'earlybird',
    label: '얼리버드',
    badge: '선착순 100개 식당',
    price: 9900,
    unit: '월',
    period: '3개월 한정',
    desc: '3개월 동안 특별 가격으로 시작하세요.\n이후 선택하신 플랜으로 자동 전환됩니다.',
    detail: '3개월 × 9,900원 = 29,700원',
    highlight: true,
    color: '#1f5d3a',
  },
  {
    id: 'annual',
    label: '연간',
    badge: '가장 인기',
    price: 29000,
    unit: '월',
    period: '연 348,000원 일시결제',
    desc: '1년치 한 번에 결제. 월간 대비 26% 저렴합니다.',
    detail: '연간 결제 금액 348,000원',
    highlight: false,
    color: '#1f5d3a',
  },
  {
    id: 'pro',
    label: '월간',
    badge: null,
    price: 39000,
    unit: '월',
    period: '매월 자동결제',
    desc: '매월 자동결제. 언제든 해지할 수 있습니다.',
    detail: '자유롭게',
    highlight: false,
    color: '#1f5d3a',
  },
]

const BENEFITS = [
  '식자재 소싱 및 공급업체 연결',
  '메뉴별 원가 자동 계산',
  '발주 통합 관리',
  '거래처 가격 협상 대행',
  '초기 식자재 세팅 대행',
  '구독자 전용가로 식자재 구매',
]

export default async function SubscribePage() {
  const status = await getSubscriptionStatus()

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', background: '#f7f6f2', minHeight: '100vh', paddingBottom: 96 }}>

      {/* 헤더 */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, background: '#1f5d3a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 16 }}>✓</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>식식이</span>
        </div>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', letterSpacing: '.04em' }}>구독 플랜 선택</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1a1a1a', margin: '0 0 6px', lineHeight: 1.3 }}>
          사장님께 맞는<br />플랜을 선택하세요.
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>언제든 해지 가능 · 위약금 없음</p>
      </div>

      {/* 현재 구독 중 */}
      {status.is_active && (
        <div style={{ margin: '16px 20px 0', padding: '12px 16px', background: '#f0f7f3', borderRadius: 10, border: '1px solid #bbf7d0' }}>
          <p style={{ fontSize: 13, color: '#1f5d3a', fontWeight: 600, margin: 0 }}>
            ✓ 현재 {status.plan === 'earlybird' ? '얼리버드' : status.plan === 'annual' ? '연간' : '월간'} 플랜 이용 중
          </p>
          {status.plan_expires_at && (
            <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
              만료일: {new Date(status.plan_expires_at).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>
      )}

      {/* 플랜 카드 */}
      <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PLANS.map(plan => (
          <div
            key={plan.id}
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: '20px',
              border: status.plan === plan.id ? '2px solid #1f5d3a' : '1px solid #e5e7eb',
              position: 'relative',
            }}
          >
            {plan.badge && (
              <div style={{
                position: 'absolute',
                top: -10,
                left: 20,
                background: plan.id === 'earlybird' ? '#1f5d3a' : '#E8701C',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 20,
              }}>
                {plan.badge}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{plan.label}</span>
              <div style={{ textAlign: 'right' }}>
                <div>
                  <span style={{ fontSize: 26, fontWeight: 800, color: '#1a1a1a' }}>{plan.price.toLocaleString()}</span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>원/{plan.unit}</span>
                </div>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{plan.period}</p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: '#374151', margin: '0 0 10px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{plan.desc}</p>

            <div style={{ padding: '10px 14px', background: '#f7f6f2', borderRadius: 8, fontSize: 13, color: plan.id === 'annual' ? '#1f5d3a' : '#374151', fontWeight: plan.id === 'annual' ? 600 : 400, display: 'flex', justifyContent: 'space-between' }}>
              <span>{plan.id === 'annual' ? '연간 결제 금액' : plan.detail}</span>
              {plan.id === 'annual' && <span>348,000원</span>}
            </div>
          </div>
        ))}
      </div>

      {/* 얼리버드 마감 임박 배너 */}
      <div style={{ margin: '16px 20px 0', padding: '14px 16px', background: '#fff8f0', border: '1px solid #fed7aa', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ color: '#E8701C', fontSize: 18 }}>✓</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', margin: '0 0 3px' }}>얼리버드 마감 임박.</p>
          <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>선착순 100개 식당만 월 9,900원으로 시작할 수 있습니다.</p>
        </div>
      </div>

      {/* 선택한 플랜 요약 + 혜택 */}
      <div style={{ margin: '16px 20px 0', padding: '20px', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px', letterSpacing: '.04em' }}>선택한 플랜</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' }}>얼리버드</p>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>3개월 후 자동 전환</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {BENEFITS.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 20, height: 20, background: '#1f5d3a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: 12 }}>✓</span>
              </div>
              <span style={{ fontSize: 14, color: '#1a1a1a' }}>{b}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>첫 결제 금액</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a' }}>9,900원</span>
        </div>
      </div>

      {/* 하단 안내 */}
      <div style={{ padding: '16px 20px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>언제든 해지 가능 · 위약금 없음</p>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>결제 후 즉시 이용 가능합니다</p>
      </div>

      {/* 하단 고정 결제 버튼 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        background: '#fff',
        borderTop: '1px solid #ece9e3',
        boxSizing: 'border-box',
        zIndex: 10,
      }}>
        <button
          style={{
            width: '100%',
            padding: 16,
            border: 'none',
            borderRadius: 12,
            background: '#1f5d3a',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
          disabled
        >
          구독 시작하기 (결제 준비 중)
        </button>
      </div>
    </main>
  )
}
