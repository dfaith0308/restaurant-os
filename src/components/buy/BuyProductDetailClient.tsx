'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import CartAddButton from '@/components/buy/CartAddButton'
import { formatKRW } from '@/lib/utils'

interface Props {
  listingId: string
  productName: string
  brandName: string
  price: number
  originalPrice: number | null
  thumbnailUrl: string | null
  imageUrls: string[]
  description: string | null
  shippingFree: boolean
  baseShippingFee: number
  freeShippingQty: number | null
  bulkQty: number | null
  bulkDiscountRate: number | null
}

export default function BuyProductDetailClient({
  listingId, productName, brandName, price, originalPrice,
  thumbnailUrl, imageUrls, description,
  baseShippingFee, freeShippingQty, bulkQty, bulkDiscountRate,
}: Props) {
  const [qty, setQty] = useState(1)

  const discountRate = originalPrice && originalPrice > price
    ? Math.round((originalPrice - price) / originalPrice * 100)
    : null

  const savings = originalPrice && originalPrice > price
    ? originalPrice - price
    : null

  const shippingNotice = useMemo(() => {
    if (!freeShippingQty) return null
    const remaining = freeShippingQty - qty
    if (remaining <= 0) return { type: 'free', msg: '🚚 무료배송 적용됩니다' }
    return { type: 'paid', msg: `${remaining}개 더 담으면 무료배송 (현재 배송비 ${formatKRW(baseShippingFee)})` }
  }, [qty, freeShippingQty, baseShippingFee])

  const bulkPrice = useMemo(() => {
    if (!bulkQty || !bulkDiscountRate || qty < bulkQty) return null
    return Math.round(price * (1 - bulkDiscountRate / 100))
  }, [qty, bulkQty, bulkDiscountRate, price])

  const effectivePrice = bulkPrice ?? price
  const subtotal = effectivePrice * qty

  return (
    <div style={{ background: '#f7f6f2', minHeight: '100vh', paddingBottom: 100, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#f7f6f2', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #ece9e3' }}>
        <Link href="/buy" style={{ fontSize: 22, color: '#2b2b2b', textDecoration: 'none', lineHeight: 1 }}>←</Link>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#2b2b2b' }}>상품 상세</span>
      </div>

      <div style={{ background: '#fff', marginBottom: 8, position: 'relative' }}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={productName}
            style={{ width: '100%', aspectRatio: '1/1', objectFit: 'contain', display: 'block', background: '#f8f8f8' }}
          />
        ) : (
          <div style={{ width: '100%', aspectRatio: '1/1', background: '#f0f4f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: '#1f5d3a' }}>
            🛒
          </div>
        )}
        {freeShippingQty && (
          <div style={{ position: 'absolute', top: 12, left: 12, background: '#1f5d3a', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
            무료배송
          </div>
        )}
      </div>

      <div style={{ background: '#fff', padding: '18px 16px', marginBottom: 8 }}>
        {brandName && (
          <p style={{ fontSize: 11, color: '#1f5d3a', fontWeight: 700, margin: '0 0 6px', letterSpacing: '0.04em' }}>{brandName}</p>
        )}
        <h1 style={{ fontSize: 19, fontWeight: 700, color: '#1a1a1a', margin: '0 0 14px', lineHeight: 1.35 }}>{productName}</h1>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#1a1a1a', lineHeight: 1 }}>{formatKRW(price)}</span>
          {originalPrice && originalPrice > price && (
            <>
              <span style={{ fontSize: 14, color: '#9ca3af', textDecoration: 'line-through', marginBottom: 3 }}>{formatKRW(originalPrice)}</span>
              <span style={{ fontSize: 13, color: '#e85c2a', fontWeight: 700, marginBottom: 3 }}>{discountRate}% 할인</span>
            </>
          )}
        </div>
        {savings && (
          <p style={{ fontSize: 12, color: '#1f5d3a', margin: '0 0 14px', fontWeight: 500 }}>✓ 시중가 대비 {formatKRW(savings)} 절감</p>
        )}

        <div style={{ display: 'flex', gap: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
          {freeShippingQty ? (
            <div>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px' }}>무료배송</p>
              <p style={{ fontSize: 13, color: '#2b2b2b', fontWeight: 600, margin: 0 }}>{freeShippingQty}개 이상</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px' }}>배송비</p>
              <p style={{ fontSize: 13, color: '#2b2b2b', fontWeight: 600, margin: 0 }}>{formatKRW(baseShippingFee)}</p>
            </div>
          )}
          {bulkQty && bulkDiscountRate && (
            <div>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px' }}>대량구매</p>
              <p style={{ fontSize: 13, color: '#2b2b2b', fontWeight: 600, margin: 0 }}>{bulkQty}개↑ 추가 {bulkDiscountRate}% 할인</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#fff', padding: '16px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#2b2b2b' }}>수량</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              style={{ width: 36, height: 36, borderRadius: '8px 0 0 8px', border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 18, cursor: 'pointer', color: '#374151' }}
            >−</button>
            <div style={{ width: 48, height: 36, borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
              {qty}
            </div>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              style={{ width: 36, height: 36, borderRadius: '0 8px 8px 0', border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 18, cursor: 'pointer', color: '#374151' }}
            >+</button>
          </div>
        </div>

        {bulkPrice && (
          <div style={{ padding: '8px 12px', background: '#fff8f0', borderRadius: 8, marginBottom: 8, fontSize: 12, color: '#e85c2a', fontWeight: 600 }}>
            🎉 대량구매 할인 적용 — {formatKRW(bulkPrice)}/개
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f0f7f3', borderRadius: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#374151' }}>소계</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1f5d3a' }}>{formatKRW(subtotal)}</span>
        </div>

        {shippingNotice && (
          <p style={{ fontSize: 12, color: shippingNotice.type === 'free' ? '#1f5d3a' : '#6b7280', margin: '0 0 4px', textAlign: 'center', fontWeight: shippingNotice.type === 'free' ? 600 : 400 }}>
            {shippingNotice.msg}
          </p>
        )}
        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, textAlign: 'center' }}>
          2종류 이상 담으면 장바구니 추가할인 적용
        </p>
      </div>

      {description && (
        <div style={{ background: '#fff', padding: '16px', marginBottom: 8 }}>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{description}</p>
        </div>
      )}

      {imageUrls.length > 0 && (
        <div style={{ background: '#fff', marginBottom: 8 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#2b2b2b', margin: 0 }}>상품 상세</p>
          </div>
          {imageUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              style={{ width: '100%', display: 'block', objectFit: 'contain' }}
            />
          ))}
        </div>
      )}

      <div style={{ padding: '16px', textAlign: 'center' }}>
        <Link href="/rfq/new" style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'underline' }}>
          원하는 상품이 없으신가요? 발주요청하기
        </Link>
      </div>

      <div style={{ position: 'fixed', bottom: 60, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '12px 16px', background: '#fff', borderTop: '1px solid #ece9e3', boxSizing: 'border-box' as const, zIndex: 10 }}>
        <CartAddButton listingId={listingId} quantity={qty} label="장바구니 담기" primary fullWidth />
      </div>
    </div>
  )
}
