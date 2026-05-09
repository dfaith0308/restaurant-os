'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { removeFromCart, type CartRow } from '@/actions/buy'
import { formatKRW } from '@/lib/utils'

export default function BuyCartClient({ items }: { items: CartRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const total = items.reduce((s, it) => s + it.commerce_price * it.quantity, 0)

  if (items.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>장바구니가 비어있습니다</p>
    )
  }

  return (
    <>
      {error ? <p style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((it) => (
          <li
            key={it.id}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{it.product_name ?? '상품'}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                {formatKRW(it.commerce_price)} × {it.quantity}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>{formatKRW(it.commerce_price * it.quantity)}</div>
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
                border: '1px solid #e5e7eb',
                background: '#fff',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 700,
                color: '#6b7280',
                cursor: 'pointer',
              }}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 16,
          padding: 16,
          background: '#F9FAFB',
          borderRadius: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800 }}>총 금액</span>
        <span style={{ fontSize: 18, fontWeight: 900 }}>{formatKRW(total)}</span>
      </div>
      <Link
        href="/buy/checkout"
        style={{
          display: 'block',
          marginTop: 16,
          textAlign: 'center',
          padding: '14px 16px',
          borderRadius: 12,
          background: '#111827',
          color: '#fff',
          textDecoration: 'none',
          fontSize: 15,
          fontWeight: 900,
        }}
      >
        주문하기
      </Link>
    </>
  )
}
