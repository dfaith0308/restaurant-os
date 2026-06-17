'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { removeFromCart, updateCartItemQuantity } from '@/actions/buy'
import { fixedStripeAboveBottomNav } from '@/lib/app-shell'
import type { CartRow } from '@/lib/buy-types'
import { formatKRW } from '@/lib/utils'

const card = {
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  background: '#fff',
  padding: 12,
} as const

export default function BuyCartClient({
  items,
  discountAmount = 0,
}: {
  items: CartRow[]
  discountAmount?: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const subtotal = items.reduce((s, it) => s + it.commerce_price * it.quantity, 0)
  const total = subtotal - discountAmount

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 12px' }}>
        <p style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>장바구니가 비어있습니다</p>
        <Link
          href="/buy"
          style={{
            display: 'inline-block',
            padding: '14px 24px',
            borderRadius: 8,
            background: 'var(--color-primary)',
            color: '#fff',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          쇼핑 계속하기
        </Link>
      </div>
    )
  }

  function setQty(id: string, next: number) {
    if (next < 1) return
    setError(null)
    start(async () => {
      const r = await updateCartItemQuantity(id, next)
      if (!r.success) {
        setError(r.error ?? '수량 변경 실패')
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      {error ? <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{error}</p> : null}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, paddingBottom: 140, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((it) => {
          const sub = it.commerce_price * it.quantity
          return (
            <li key={it.id} style={{ ...card }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {it.thumbnail_url ? (
                  <img
                    src={it.thumbnail_url}
                    alt=""
                    width={72}
                    height={72}
                    style={{
                      width: 72,
                      height: 72,
                      objectFit: 'cover',
                      borderRadius: 8,
                      background: '#e5e7eb',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 8,
                      background: '#e5e7eb',
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.35 }}>
                    {it.product_name?.trim() ?? ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>{formatKRW(it.commerce_price)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        disabled={pending || it.quantity <= 1}
                        onClick={() => setQty(it.id, it.quantity - 1)}
                        aria-label="수량 감소"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: '1px solid #ddd',
                          background: '#fff',
                          fontSize: 18,
                          lineHeight: 1,
                          cursor: it.quantity <= 1 || pending ? 'not-allowed' : 'pointer',
                          opacity: it.quantity <= 1 ? 0.4 : 1,
                        }}
                      >
                        −
                      </button>
                      <span style={{ fontSize: 15, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{it.quantity}</span>
                      <button
                        type="button"
                        disabled={pending || it.quantity >= 999}
                        onClick={() => setQty(it.id, it.quantity + 1)}
                        aria-label="수량 증가"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: '1px solid #ddd',
                          background: '#fff',
                          fontSize: 18,
                          lineHeight: 1,
                          cursor: pending ? 'wait' : 'pointer',
                        }}
                      >
                        +
                      </button>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{formatKRW(sub)}</div>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setError(null)
                      start(async () => {
                        const r = await removeFromCart(it.id)
                        if (!r.success) {
                          setError(r.error ?? '삭제 실패')
                          return
                        }
                        router.refresh()
                      })
                    }}
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: '#dc2626',
                      padding: '6px 14px',
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                      background: '#fef2f2',
                      cursor: pending ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 500,
                    }}
                  >
                    🗑 삭제
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div
        style={fixedStripeAboveBottomNav({
          background: '#fff',
          borderTop: '1px solid #eee',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
          padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
        })}
      >
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
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
            {discountAmount === 0 && items.length >= 2 && (
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, textAlign: 'right' }}>
                다른 상품을 함께 담으면 할인 혜택이 생길 수 있어요
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: '#1a1a1a', paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
              <span>최종 결제금액</span>
              <span>{formatKRW(total)}</span>
            </div>
          </div>
          <Link
            href="/buy/checkout"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '14px 16px',
              borderRadius: 8,
              background: 'var(--color-primary)',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            주문하기
          </Link>
        </div>
      </div>
    </>
  )
}
