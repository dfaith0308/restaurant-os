'use client'

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createCommerceOrder } from '@/actions/buy'
import { formatKRW } from '@/lib/utils'
import { shareTextViaKakao } from '@/lib/kakao-share'
import type { CartRow } from '@/lib/buy-types'

type DoneState = {
  orderNumber: string
  payment: 'bank_transfer' | 'kakao_manual'
  kakaoHint: string | null
}

export default function BuyCheckoutClient({ items }: { items: CartRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<DoneState | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [memo, setMemo] = useState('')
  const [payment, setPayment] = useState<'bank_transfer' | 'kakao_manual' | 'card'>('bank_transfer')

  const subtotal = items.reduce((s, it) => s + it.commerce_price * it.quantity, 0)

  function submit() {
    setError(null)

    if (payment === 'card') {
      setError('카드 결제는 준비 중입니다. 무통장 또는 카카오 주문전달을 이용해 주세요.')
      return
    }

    const pm = payment

    start(async () => {
      const res = await createCommerceOrder({
        shipping_name: name,
        shipping_phone: phone,
        shipping_address: address,
        delivery_memo: memo || null,
        payment_method: pm,
      })

      if (!res.success || !res.data) {
        setError(res.error ?? '주문에 실패했습니다')
        return
      }

      const summary = res.data.kakao_summary
      const orderNumber = res.data.order_number ?? '—'

      setDone({
        orderNumber,
        payment: pm,
        kakaoHint: null,
      })

      if (summary) {
        shareTextViaKakao(summary, (msg) => {
          setDone((prev) => (prev ? { ...prev, kakaoHint: msg } : prev))
        })
      }

      router.refresh()
    })
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            background: '#fff',
            padding: 20,
          }}
        >
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111' }}>주문이 접수됐습니다 ✓</p>
          <p style={{ margin: '14px 0 0', fontSize: 14, color: '#374151' }}>
            주문번호: <span style={{ fontWeight: 700, color: '#111' }}>{done.orderNumber}</span>
          </p>

          {done.payment === 'bank_transfer' ? (
            <div style={{ marginTop: 16, fontSize: 14, color: '#374151', lineHeight: 1.55 }}>
              <p style={{ margin: 0 }}>계좌로 입금해 주시면 배송이 시작됩니다</p>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: '#9ca3af' }}>(계좌 정보는 추후 운영자 설정)</p>
            </div>
          ) : (
            <p style={{ marginTop: 16, fontSize: 14, color: '#374151', lineHeight: 1.55, marginBottom: 0 }}>
              카카오톡으로 주문 내용이 전달됐습니다
              <br />
              담당자 확인 후 연락드립니다
            </p>
          )}

          {done.kakaoHint ? (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: '#EFF6FF', color: '#1d4ed8', fontSize: 13 }}>
              {done.kakaoHint}
            </div>
          ) : null}
        </div>

        <Link
          href="/buy/orders"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '14px 16px',
            borderRadius: 8,
            background: '#111',
            color: '#fff',
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          구매내역 보기
        </Link>
        <Link
          href="/buy"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '14px 16px',
            borderRadius: 8,
            border: '1px solid #ddd',
            background: '#fff',
            color: '#111',
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          쇼핑 계속하기
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error ? (
        <div style={{ padding: 12, borderRadius: 10, background: '#FEF2F2', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      <section
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          background: '#fff',
          padding: 14,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>주문 상품</div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => (
            <li key={it.id} style={{ fontSize: 13, color: '#374151' }}>
              {(it.product_name?.trim() || '상품')} × {it.quantity} — {formatKRW(it.commerce_price * it.quantity)}
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 12, fontSize: 15, fontWeight: 800 }}>합계 {formatKRW(subtotal)}</div>
      </section>

      <section
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          background: '#fff',
          padding: 14,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>배송지</div>
        <Field label="수령인 이름">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inp} placeholder="홍길동" />
        </Field>
        <Field label="연락처">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inp} placeholder="010-0000-0000" />
        </Field>
        <Field label="주소">
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} style={{ ...inp, minHeight: 72 }} placeholder="도로명 주소" />
        </Field>
        <Field label="배송 메모 (선택)">
          <input value={memo} onChange={(e) => setMemo(e.target.value)} style={inp} placeholder="부재 시 경비실" />
        </Field>
      </section>

      <section
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          background: '#fff',
          padding: 14,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>결제 방식</div>
        <label style={radioRow}>
          <input type="radio" name="pay" checked={payment === 'bank_transfer'} onChange={() => setPayment('bank_transfer')} />
          <span>무통장입금 (주문 후 카카오톡으로 요약 전달)</span>
        </label>
        <label style={radioRow}>
          <input type="radio" name="pay" checked={payment === 'kakao_manual'} onChange={() => setPayment('kakao_manual')} />
          <span>카카오 주문전달 (주문 후 카카오톡으로 요약 전달)</span>
        </label>
        <label style={{ ...radioRow, opacity: 0.55 }}>
          <input type="radio" name="pay" checked={payment === 'card'} onChange={() => setPayment('card')} disabled />
          <span>카드결제 — 준비 중</span>
        </label>
      </section>

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        style={{
          padding: '14px 16px',
          borderRadius: 8,
          border: 'none',
          background: '#111',
          color: '#fff',
          fontSize: 15,
          fontWeight: 700,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? '처리 중…' : '주문 완료'}
      </button>

      <Link href="/buy/cart" style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
        장바구니로 돌아가기
      </Link>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  )
}

const inp: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
}

const radioRow: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  fontSize: 13,
  color: '#374151',
  marginBottom: 10,
  cursor: 'pointer',
}
