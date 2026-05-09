'use client'

import { useState } from 'react'
import Link from 'next/link'
import CartAddButton from '@/components/buy/CartAddButton'
import { formatKRW } from '@/lib/utils'

export default function BuyProductDetailClient({ listingId, price }: { listingId: string; price: number }) {
  const [qty, setQty] = useState(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>수량</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 18 }}
          >
            −
          </button>
          <span style={{ fontSize: 16, fontWeight: 800, minWidth: 28, textAlign: 'center' }}>{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 18 }}
          >
            +
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 14, color: '#374151' }}>
          소계 <strong>{formatKRW(price * qty)}</strong>
        </div>
      </div>
      <CartAddButton listingId={listingId} quantity={qty} label="장바구니 담기" primary />
      <Link href="/rfq/new" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'underline' }}>
        원하는 상품이 없으신가요? 발주요청하기
      </Link>
    </div>
  )
}
