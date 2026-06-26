'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadPaymentWidget, type PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk'
import { createCommerceOrder } from '@/actions/buy'
import { formatKRW } from '@/lib/utils'
import { shareTextViaKakao } from '@/lib/kakao-share'
import type { StorefrontBankTransferSettings } from '@/lib/storefront-bank-transfer'
import type { CartRow } from '@/lib/buy-types'

type DoneState = {
  order_number: string | null
  order_id: string
  payment: 'bank_transfer' | 'kakao_manual'
  kakao_summary: string | null
  kakaoHint: string | null
  total: number
}

export default function BuyCheckoutClient({
  items,
  bankTransfer,
  discountAmount = 0,
  tossEnabled = false,
}: {
  items: CartRow[]
  bankTransfer: StorefrontBankTransferSettings | null
  discountAmount?: number
  tossEnabled?: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<DoneState | null>(null)
  const checkoutSubmissionIdRef = useRef<string | null>(null)
  const paymentWidgetRef = useRef<PaymentWidgetInstance | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [memo, setMemo] = useState('')
  const [pm, setPm] = useState<'bank_transfer' | 'kakao_manual' | 'card'>('bank_transfer')

  const subtotal = items.reduce((s, it) => s + it.commerce_price * it.quantity, 0)
  const total = subtotal - discountAmount

  useEffect(() => {
    if (pm !== 'card' || !tossEnabled) {
      paymentWidgetRef.current = null
      return
    }

    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
    if (!clientKey) return

    if (!checkoutSubmissionIdRef.current) {
      checkoutSubmissionIdRef.current = crypto.randomUUID()
    }

    let cancelled = false

    ;(async () => {
      try {
        const widget = await loadPaymentWidget(clientKey, checkoutSubmissionIdRef.current!)
        if (cancelled) return
        paymentWidgetRef.current = widget
        await widget.renderPaymentMethods('#payment-widget', { value: total })
        await widget.renderAgreement('#agreement')
      } catch (e) {
        if (!cancelled) {
          console.error('[BuyCheckoutClient] payment widget init failed', e)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pm, tossEnabled, total])

  async function handleCardPayment() {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
    if (!clientKey) {
      setError('카드 결제가 준비 중입니다.')
      return
    }

    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError('배송 정보를 모두 입력해 주세요')
      return
    }

    if (!checkoutSubmissionIdRef.current) {
      checkoutSubmissionIdRef.current = crypto.randomUUID()
    }
    const checkout_submission_id = checkoutSubmissionIdRef.current

    const orderRes = await createCommerceOrder({
      checkout_submission_id,
      shipping_name: name,
      shipping_phone: phone,
      shipping_address: address,
      delivery_memo: memo || null,
      payment_method: 'card',
      discount_amount: discountAmount,
    })

    if (!orderRes.success || !orderRes.data) {
      setError(orderRes.error ?? '주문 생성 실패')
      return
    }

    const orderId = orderRes.data.order_id
    const orderAmount = orderRes.data.total_amount

    let paymentWidget = paymentWidgetRef.current
    if (!paymentWidget) {
      paymentWidget = await loadPaymentWidget(clientKey, checkout_submission_id)
      paymentWidgetRef.current = paymentWidget
      await paymentWidget.renderPaymentMethods('#payment-widget', { value: orderAmount })
      await paymentWidget.renderAgreement('#agreement')
    } else {
      await paymentWidget.renderPaymentMethods('#payment-widget', { value: orderAmount })
    }

    const phoneDigits = phone.replace(/\D/g, '')
    const orderName =
      items.length === 1
        ? (items[0].product_name?.trim() ?? '식자재')
        : `${items[0].product_name?.trim() ?? '식자재'} 외 ${items.length - 1}건`

    await paymentWidget.requestPayment({
      orderId,
      orderName,
      successUrl: `${window.location.origin}/buy/checkout/success`,
      failUrl: `${window.location.origin}/buy/checkout/fail`,
      customerName: name.trim(),
      customerMobilePhone: phoneDigits,
    })
  }

  function handleSubmit() {
    setError(null)

    if (pm === 'card') {
      start(async () => {
        try {
          await handleCardPayment()
        } catch (e) {
          setError(e instanceof Error ? e.message : '카드 결제에 실패했습니다')
        }
      })
      return
    }

    const paymentMethod = pm

    start(async () => {
      if (!checkoutSubmissionIdRef.current) {
        checkoutSubmissionIdRef.current = crypto.randomUUID()
      }
      const checkout_submission_id = checkoutSubmissionIdRef.current

      const res = await createCommerceOrder({
        checkout_submission_id,
        shipping_name: name,
        shipping_phone: phone,
        shipping_address: address,
        delivery_memo: memo || null,
        payment_method: paymentMethod,
        discount_amount: discountAmount,
      })

      if (!res.success || !res.data) {
        setError(res.error ?? '주문에 실패했습니다')
        return
      }

      checkoutSubmissionIdRef.current = null

      const summary = res.data.kakao_summary

      setDone({
        order_number: res.data.order_number,
        order_id: res.data.order_id,
        payment: paymentMethod,
        kakao_summary: summary,
        kakaoHint: null,
        total,
      })

      if (summary) {
        shareTextViaKakao(summary, (msg) => {
          setDone((prev) => (prev ? { ...prev, kakaoHint: msg } : prev))
        })
      }

      router.refresh()
    })
  }

  if (done !== null) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 96px', minHeight: '100vh', background: '#f7f6f2' }}>
        <div style={{ padding: '20px 0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#2b2b2b' }}>주문 완료</span>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: '24px 20px', marginBottom: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', margin: '0 0 6px' }}>주문이 접수됐습니다</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>{done.order_number ?? done.order_id}</p>
          {bankTransfer && done.payment === 'bank_transfer' && (
            <div style={{ background: '#f0f7f3', borderRadius: 10, padding: '16px', textAlign: 'left', marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1f5d3a', margin: '0 0 10px' }}>무통장 입금 안내</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>은행</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 600 }}>{bankTransfer.bank_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>계좌번호</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 600 }}>{bankTransfer.account_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>예금주</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 600 }}>{bankTransfer.account_holder}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>입금액</span>
                  <span style={{ color: '#1f5d3a', fontWeight: 800 }}>{formatKRW(done.total)}</span>
                </div>
              </div>
              {bankTransfer.notice && (
                <p style={{ fontSize: 12, color: '#6b7280', margin: '10px 0 0', lineHeight: 1.6 }}>{bankTransfer.notice}</p>
              )}
            </div>
          )}
          {done.payment === 'kakao_manual' && done.kakao_summary && (
            <div style={{ background: '#fffbeb', borderRadius: 10, padding: '14px', textAlign: 'left', marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: '0 0 8px' }}>카카오톡 주문 내용</p>
              <pre style={{ fontSize: 12, color: '#374151', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{done.kakao_summary}</pre>
            </div>
          )}
          {done.kakaoHint ? (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: '#EFF6FF', color: '#1d4ed8', fontSize: 13, textAlign: 'left' }}>
              {done.kakaoHint}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href="/orders" style={{ display: 'block', padding: '14px', background: '#1f5d3a', borderRadius: 12, textAlign: 'center', textDecoration: 'none', fontSize: 14, fontWeight: 700, color: '#fff' }}>
            주문 내역 보기
          </a>
          <a href="/buy" style={{ display: 'block', padding: '14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, textAlign: 'center', textDecoration: 'none', fontSize: 14, fontWeight: 600, color: '#374151' }}>
            쇼핑 계속하기
          </a>
        </div>
      </div>
    )
  }

  const paymentOptions = [
    { value: 'bank_transfer' as const, label: '무통장 입금', desc: '입금 확인 후 출고됩니다', available: true },
    { value: 'kakao_manual' as const, label: '카카오 주문전달', desc: '카카오톡으로 주문 내용을 전달합니다', available: true },
    {
      value: 'card' as const,
      label: '카드결제',
      desc: tossEnabled ? '신용카드·체크카드 결제' : '준비 중입니다',
      available: tossEnabled,
    },
  ]

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', background: '#f7f6f2', minHeight: '100vh', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

      {/* 헤더 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#f7f6f2', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #ece9e3' }}>
        <a href="/buy/cart" style={{ fontSize: 22, color: '#2b2b2b', textDecoration: 'none', lineHeight: 1 }}>←</a>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#2b2b2b' }}>결제</span>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* 에러 */}
        {error && (
          <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#b91c1c' }}>
            {error}
          </div>
        )}

        {/* 주문 상품 */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', margin: '0 0 12px', letterSpacing: '.06em', textTransform: 'uppercase' }}>주문 상품</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((it) => (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a', margin: '0 0 2px', lineHeight: 1.35 }}>
                    {it.product_name?.trim() || it.listing_id}
                  </p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{formatKRW(it.commerce_price)} × {it.quantity}개</p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', flexShrink: 0 }}>{formatKRW(it.commerce_price * it.quantity)}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 14, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280' }}>
              <span>상품 합계</span>
              <span>{formatKRW(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#1f5d3a', fontWeight: 600 }}>
                <span>장바구니 할인</span>
                <span>- {formatKRW(discountAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: '#1a1a1a', paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
              <span>최종 결제금액</span>
              <span style={{ color: '#1f5d3a' }}>{formatKRW(total)}</span>
            </div>
          </div>
        </div>

        {/* 배송지 */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', margin: '0 0 14px', letterSpacing: '.06em', textTransform: 'uppercase' }}>배송지</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>수령인 이름 *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', background: '#fff', color: '#1a1a1a', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>연락처 *</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                inputMode="tel"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', background: '#fff', color: '#1a1a1a', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>주소 *</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="도로명 주소"
                rows={2}
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', background: '#fff', color: '#1a1a1a', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>배송 메모 (선택)</label>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="부재 시 경비실"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', background: '#fff', color: '#1a1a1a', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
          </div>
        </div>

        {/* 결제 방식 */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', margin: '0 0 14px', letterSpacing: '.06em', textTransform: 'uppercase' }}>결제 방식</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paymentOptions.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px',
                  border: `1px solid ${pm === opt.value ? '#1f5d3a' : '#e5e7eb'}`,
                  borderRadius: 10,
                  cursor: opt.available ? 'pointer' : 'not-allowed',
                  opacity: opt.available ? 1 : 0.5,
                  background: pm === opt.value ? '#f0f7f3' : '#fff',
                }}
              >
                <input
                  type="radio"
                  name="pm"
                  value={opt.value}
                  checked={pm === opt.value}
                  disabled={!opt.available}
                  onChange={() => opt.available && setPm(opt.value)}
                  style={{ accentColor: '#1f5d3a', width: 16, height: 16, flexShrink: 0 }}
                />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px' }}>{opt.label}</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          {pm === 'card' && tossEnabled && (
            <>
              <div id="payment-widget" style={{ marginTop: 12 }} />
              <div id="agreement" style={{ marginTop: 12 }} />
            </>
          )}
        </div>

        {/* 최종 금액 요약 */}
        <div style={{ background: '#1f5d3a', borderRadius: 14, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>최종 결제금액</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{formatKRW(total)}</span>
        </div>

      </div>

      {/* 하단 고정 주문 버튼 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        padding: 'calc(12px) 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        background: '#fff',
        borderTop: '1px solid #ece9e3',
        boxSizing: 'border-box',
        zIndex: 10,
      }}>
        <button
          type="button"
          disabled={pending}
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '15px',
            border: 'none',
            borderRadius: 12,
            background: pending ? '#9ca3af' : '#1f5d3a',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: pending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '.02em',
          }}
        >
          {pending ? '처리 중...' : pm === 'card' ? `${formatKRW(total)} 결제하기` : `${formatKRW(total)} 주문하기`}
        </button>
      </div>
    </div>
  )
}
