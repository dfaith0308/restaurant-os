'use client'

import { useState, type ReactNode } from 'react'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { fixedStripeAboveBottomNav } from '@/lib/app-shell'
import { redeemCoupon, type SubscriptionPlan } from '@/actions/subscribe'

type SelectablePlan = 'earlybird' | 'annual' | 'pro'

const EARLYBIRD_DESC = (
  <>
    <span
      style={{
        display: 'inline-block',
        background: '#1f5d3a',
        color: '#fff',
        fontSize: 13,
        fontWeight: 800,
        padding: '3px 10px',
        borderRadius: 6,
        marginBottom: 6,
        letterSpacing: '.02em',
      }}
    >
      🎁 평생 혜택
    </span>
    <br />
    선착순 100명에게만 드리는 특별 혜택입니다.
    <br />
    월 9,900원으로 <strong style={{ color: '#1f5d3a' }}>영구적으로</strong> 모든 기능을 이용하세요.
  </>
)

const PLANS: Array<{
  id: SelectablePlan
  label: string
  badge: string | null
  price: number
  unit: string
  period: string
  desc: string | ReactNode
  detail: string
  summaryNote: string
  firstPayment: number
  firstPaymentLabel: string
  buttonText: string
}> = [
  {
    id: 'earlybird',
    label: '얼리버드',
    badge: '선착순 100명 한정',
    price: 9900,
    unit: '월',
    period: '평생 혜택',
    desc: EARLYBIRD_DESC,
    detail: '해지 전까지 월 9,900원 유지',
    summaryNote: '평생 월 9,900원 유지',
    firstPayment: 9900,
    firstPaymentLabel: '9,900원',
    buttonText: '얼리버드 9,900원/월 시작하기 (준비 중)',
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
    summaryNote: '연 348,000원 일시결제',
    firstPayment: 348000,
    firstPaymentLabel: '348,000원',
    buttonText: '연간 348,000원 시작하기 (준비 중)',
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
    summaryNote: '매월 자동결제',
    firstPayment: 39000,
    firstPaymentLabel: '39,000원',
    buttonText: '월간 39,000원/월 시작하기 (준비 중)',
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

function planLabel(plan: SubscriptionPlan): string {
  if (plan === 'earlybird') return '얼리버드'
  if (plan === 'annual') return '연간'
  if (plan === 'pro') return '월간'
  return '무료'
}

export type SubscriptionStatusProps = {
  plan: SubscriptionPlan
  subscribed_at: string | null
  plan_expires_at: string | null
  is_active: boolean
}

const tossEnabled = Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY)

function subscribeAmount(plan: SelectablePlan): number {
  if (plan === 'annual') return 348000
  if (plan === 'earlybird') return 9900
  return 39000
}

export default function SubscribeClient({ status }: { status: SubscriptionStatusProps }) {
  const [selectedPlan, setSelectedPlan] = useState<SelectablePlan>('earlybird')
  const selected = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[0]
  const amount = subscribeAmount(selectedPlan)

  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponResult, setCouponResult] = useState<{ success: boolean; message: string } | null>(null)
  const [pending, setPending] = useState(false)

  async function handleCoupon() {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponResult(null)
    try {
      const res = await redeemCoupon(couponCode.trim())
      if (res.success) {
        setCouponResult({
          success: true,
          message: `${res.data?.free_months}개월 무료 구독이 적용됐습니다! 🎉`,
        })
        setTimeout(() => window.location.reload(), 3000)
      } else {
        setCouponResult({ success: false, message: res.error ?? '쿠폰 적용 실패' })
      }
    } finally {
      setCouponLoading(false)
    }
  }

  async function handleSubscribe() {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
    if (!clientKey) {
      alert('결제 준비 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    const planInfo = PLANS.find((p) => p.id === selectedPlan)
    if (!planInfo) return

    const paymentAmount = subscribeAmount(selectedPlan)
    const customerKey = crypto.randomUUID()

    setPending(true)
    try {
      const tossPayments = await loadTossPayments(clientKey)
      const payment = tossPayments.payment({ customerKey })
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: `${window.location.origin}/subscribe/billing/success?plan=${selectedPlan}&amount=${paymentAmount}&customerKey=${customerKey}`,
        failUrl: `${window.location.origin}/subscribe/billing/fail`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('USER_CANCEL') && !message.includes('취소')) {
        alert(message || '결제 요청에 실패했습니다.')
      }
    } finally {
      setPending(false)
    }
  }

  const subscribeButtonLabel = tossEnabled
    ? `${selected.label} ${amount.toLocaleString()}원 구독 시작`
    : `${selected.label} 시작하기 (준비 중)`

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        background: '#f7f6f2',
        minHeight: '100vh',
        paddingBottom: 'calc(76px + env(safe-area-inset-bottom))',
      }}
    >
      {/* 헤더 */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: '#1f5d3a',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontSize: 16 }}>✓</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>식식이</span>
        </div>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', letterSpacing: '.04em' }}>
          구독 플랜 선택
        </p>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#1a1a1a',
            margin: '0 0 6px',
            lineHeight: 1.3,
          }}
        >
          사장님께 맞는
          <br />
          플랜을 선택하세요.
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>언제든 해지 가능 · 위약금 없음</p>
      </div>

      {/* 현재 구독 중 */}
      {status.is_active && (
        <div
          style={{
            margin: '16px 20px 0',
            padding: '12px 16px',
            background: '#f0f7f3',
            borderRadius: 10,
            border: '1px solid #bbf7d0',
          }}
        >
          <p style={{ fontSize: 13, color: '#1f5d3a', fontWeight: 600, margin: 0 }}>
            ✓ 현재 {planLabel(status.plan)} 플랜 이용 중
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
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlan(plan.id)}
              style={{
                background: isSelected ? '#f0f7f3' : '#fff',
                borderRadius: 14,
                padding: '20px',
                border: isSelected ? '2px solid #1f5d3a' : '1px solid #e5e7eb',
                position: 'relative',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                width: '100%',
              }}
            >
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 24,
                    height: 24,
                    background: '#1f5d3a',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ color: '#fff', fontSize: 14, lineHeight: 1 }}>✓</span>
                </div>
              )}

              {plan.badge && (
                <div
                  style={{
                    position: 'absolute',
                    top: -10,
                    left: 20,
                    background: plan.id === 'earlybird' ? '#1f5d3a' : '#E8701C',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 20,
                  }}
                >
                  {plan.badge}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 8,
                  paddingRight: isSelected ? 28 : 0,
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{plan.label}</span>
                <div style={{ textAlign: 'right' }}>
                  <div>
                    <span style={{ fontSize: 26, fontWeight: 800, color: '#1a1a1a' }}>
                      {plan.price.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>원/{plan.unit}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{plan.period}</p>
                </div>
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: '#374151',
                  margin: '0 0 10px',
                  lineHeight: 1.6,
                  ...(typeof plan.desc === 'string' ? { whiteSpace: 'pre-line' as const } : {}),
                }}
              >
                {plan.desc}
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  background: isSelected ? '#e8f3ec' : '#f7f6f2',
                  borderRadius: 8,
                  fontSize: 13,
                  color: plan.id === 'annual' ? '#1f5d3a' : '#374151',
                  fontWeight: plan.id === 'annual' ? 600 : 400,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{plan.id === 'annual' ? '연간 결제 금액' : plan.detail}</span>
                {plan.id === 'annual' && <span>348,000원</span>}
              </div>
            </button>
          )
        })}
      </div>

      {/* 쿠폰 코드 입력 */}
      <div style={{ margin: '16px 20px 0', padding: '16px 20px', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', margin: '0 0 10px' }}>🎟 쿠폰 코드 입력</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="쿠폰 코드 입력 (예: ABCD1234)"
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              letterSpacing: '.08em',
            }}
          />
          <button
            type="button"
            onClick={handleCoupon}
            disabled={couponLoading || !couponCode.trim()}
            style={{
              padding: '10px 16px',
              background: '#1f5d3a',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: couponLoading || !couponCode.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
              opacity: couponLoading || !couponCode.trim() ? 0.7 : 1,
            }}
          >
            {couponLoading ? '확인 중...' : '적용'}
          </button>
        </div>
        {couponResult && (
          <p
            style={{
              fontSize: 13,
              color: couponResult.success ? '#1f5d3a' : '#dc2626',
              fontWeight: 600,
              margin: '8px 0 0',
            }}
          >
            {couponResult.success ? '✓' : '✗'} {couponResult.message}
          </p>
        )}
      </div>

      {/* 얼리버드 마감 임박 배너 */}
      <div
        style={{
          margin: '16px 20px 0',
          padding: '14px 16px',
          background: '#fff8f0',
          border: '1px solid #fed7aa',
          borderRadius: 12,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ color: '#E8701C', fontSize: 18 }}>✓</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', margin: '0 0 3px' }}>
            얼리버드 마감 임박.
          </p>
          <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>
            선착순 100명만 월 9,900원으로 평생 이용할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 선택한 플랜 요약 + 혜택 */}
      <div
        style={{
          margin: '16px 20px 0',
          padding: '20px',
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #e5e7eb',
        }}
      >
        <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px', letterSpacing: '.04em' }}>
          선택한 플랜
        </p>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' }}>
          {selected.label}
        </p>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>{selected.summaryNote}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {BENEFITS.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  background: '#1f5d3a',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ color: '#fff', fontSize: 12 }}>✓</span>
              </div>
              <span style={{ fontSize: 14, color: '#1a1a1a' }}>{b}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: '1px solid #f3f4f6',
            paddingTop: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, color: '#6b7280' }}>첫 결제 금액</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a' }}>{selected.firstPaymentLabel}</span>
        </div>
      </div>

      {/* 하단 안내 */}
      <div style={{ padding: '16px 20px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>언제든 해지 가능 · 위약금 없음</p>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>결제 후 즉시 이용 가능합니다</p>
      </div>

      {/* 하단 고정 결제 버튼 — BottomNav(64px) 위 */}
      <div
        style={fixedStripeAboveBottomNav({
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          background: '#fff',
          borderTop: '1px solid #ece9e3',
          boxSizing: 'border-box',
        })}
      >
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={pending || !tossEnabled}
          style={{
            width: '100%',
            padding: 16,
            border: 'none',
            borderRadius: 12,
            background: '#1f5d3a',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: pending || !tossEnabled ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: pending || !tossEnabled ? 0.85 : 1,
          }}
        >
          {pending ? '결제창 여는 중...' : subscribeButtonLabel}
        </button>
      </div>
    </main>
  )
}
