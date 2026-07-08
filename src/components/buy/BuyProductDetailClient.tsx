'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import CartAddButton from '@/components/buy/CartAddButton'
import { BOTTOM_NAV_HEIGHT_PX, fixedStripeAboveBottomNav } from '@/lib/app-shell'

interface Props {
  listingId: string
  productName: string
  price: number
  thumbnailUrl: string | null
  baseShippingFee: number
  freeShippingQty: number | null
  bulkQty: number | null
  bulkDiscountRate: number | null
  origin?: string | null
  allergen?: string | null
  ingredients?: string | null
  categoryName?: string | null
  detailTemplate?: React.ReactNode
}

export default function BuyProductDetailClient({
  listingId,
  productName,
  price,
  thumbnailUrl,
  baseShippingFee,
  freeShippingQty,
  bulkQty,
  bulkDiscountRate,
  origin,
  allergen,
  ingredients,
  categoryName,
  detailTemplate,
}: Props) {
  const [qty, setQty] = useState(1)
  const [selectedOption, setSelectedOption] = useState<'single' | 'free' | 'bulk'>('single')
  const [showIngredients, setShowIngredients] = useState(false)
  const [showCartPopup, setShowCartPopup] = useState(false)
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCartSuccess() {
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
    setShowCartPopup(true)
    popupTimerRef.current = setTimeout(() => setShowCartPopup(false), 3000)
  }

  const currentUnitPrice = useMemo(() => {
    if (bulkQty && bulkDiscountRate && qty >= bulkQty) {
      return Math.round(price * (1 - bulkDiscountRate / 100))
    }
    return price
  }, [qty, price, bulkQty, bulkDiscountRate])

  const subtotal = currentUnitPrice * qty

  const bulkPrice = bulkQty && bulkDiscountRate
    ? price * (1 - bulkDiscountRate / 100)
    : null
  const bulkTotal = bulkPrice && bulkQty ? bulkPrice * bulkQty : null
  const bulkSaving = bulkPrice && bulkQty ? (price - bulkPrice) * bulkQty : null

  function syncOptionFromQty(nextQty: number) {
    if (bulkQty && bulkDiscountRate && nextQty >= bulkQty) {
      setSelectedOption('bulk')
    } else if (freeShippingQty && nextQty >= freeShippingQty) {
      setSelectedOption('free')
    } else {
      setSelectedOption('single')
    }
  }

  function applyQty(nextQty: number) {
    const q = Math.max(1, nextQty)
    setQty(q)
    syncOptionFromQty(q)
  }

  return (
    <div style={{ background: '#f7f6f2', minHeight: '100vh', paddingBottom: `calc(${BOTTOM_NAV_HEIGHT_PX}px + 88px + env(safe-area-inset-bottom))`, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#f7f6f2', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #ece9e3' }}>
        <Link href="/buy" style={{ fontSize: 22, color: '#2b2b2b', textDecoration: 'none', lineHeight: 1 }}>←</Link>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#2b2b2b' }}>상품 상세</span>
      </div>

      <div style={{ background: '#fff', marginBottom: 8, padding: '12px 16px' }}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={productName}
            style={{ width: '100%', maxHeight: 240, objectFit: 'contain', display: 'block', background: '#f7f6f2', borderRadius: 12 }}
          />
        ) : (
          <div style={{ width: '100%', height: 200, background: '#f7f6f2', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🛒</div>
        )}
      </div>

      <div style={{ background: '#fff', padding: '18px 16px', marginBottom: 8 }}>
        {categoryName ? (
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>{categoryName}</p>
        ) : null}
        <h1 style={{ fontSize: 19, fontWeight: 700, color: '#1a1a1a', margin: '0 0 12px', lineHeight: 1.35 }}>{productName}</h1>

        {(origin || allergen) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {origin && (
              <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                <span style={{ color: '#6b7280', minWidth: 56, flexShrink: 0 }}>원산지</span>
                <span style={{ color: '#1a1a1a' }}>{origin}</span>
              </div>
            )}
            {allergen && (
              <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                <span style={{ color: '#6b7280', minWidth: 56, flexShrink: 0 }}>알레르기</span>
                <span style={{ color: '#1a1a1a' }}>{allergen}</span>
              </div>
            )}
          </div>
        )}

        {ingredients ? (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setShowIngredients(!showIngredients)}
              style={{ width: '100%', padding: '12px 16px', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>원재료명 및 함량 보기</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{showIngredients ? '▲' : '▼'}</span>
            </button>
            {showIngredients && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#f7f6f2' }}>
                <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>{ingredients}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div style={{ background: '#fff', padding: '16px', marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', margin: '0 0 12px', letterSpacing: '.06em' }}>구매 옵션</p>

        <div
          role="button"
          tabIndex={0}
          onClick={() => { setQty(1); setSelectedOption('single') }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setQty(1); setSelectedOption('single') } }}
          style={{ position: 'relative', border: selectedOption === 'single' ? '2px solid #1a1a1a' : '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 8, background: '#fff', cursor: 'pointer' }}
        >
          {selectedOption === 'single' && (
            <span style={{ position: 'absolute', top: 12, right: 16, fontSize: 12, color: '#1a1a1a', fontWeight: 700 }}>✓ 선택됨</span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>낱개 구매</span>
            <span style={{ fontSize: 16, fontWeight: 500, color: '#1a1a1a', paddingRight: selectedOption === 'single' ? 56 : 0 }}>{price.toLocaleString()}원</span>
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>배송비 {baseShippingFee.toLocaleString()}원 별도</p>
        </div>

        {freeShippingQty ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setQty(freeShippingQty); setSelectedOption('free') }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setQty(freeShippingQty); setSelectedOption('free') } }}
            style={{ position: 'relative', border: selectedOption === 'free' ? '2px solid #1f5d3a' : '2px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 8, background: selectedOption === 'free' ? '#f0f7f3' : '#fff', cursor: 'pointer' }}
          >
            {selectedOption === 'free' && (
              <span style={{ position: 'absolute', top: 12, right: 16, fontSize: 12, color: '#1f5d3a', fontWeight: 700 }}>✓ 선택됨</span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1f5d3a' }}>{freeShippingQty}개 이상 구매</span>
                <span style={{ fontSize: 11, background: '#1f5d3a', color: '#fff', padding: '2px 7px', borderRadius: 20 }}>무료배송</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 500, color: '#1f5d3a', paddingRight: selectedOption === 'free' ? 56 : 0 }}>{(price * freeShippingQty).toLocaleString()}원~</span>
            </div>
            <p style={{ fontSize: 12, color: '#52B788', margin: 0 }}>배송비 {baseShippingFee.toLocaleString()}원 절약</p>
          </div>
        ) : null}

        {bulkQty && bulkDiscountRate && bulkTotal != null && bulkSaving != null ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setQty(bulkQty); setSelectedOption('bulk') }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setQty(bulkQty); setSelectedOption('bulk') } }}
            style={{ position: 'relative', border: selectedOption === 'bulk' ? '2px solid #E8701C' : '2px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', background: selectedOption === 'bulk' ? '#fff8f5' : '#fff', cursor: 'pointer' }}
          >
            {selectedOption === 'bulk' && (
              <span style={{ position: 'absolute', top: 12, right: 16, fontSize: 12, color: '#E8701C', fontWeight: 700 }}>✓ 선택됨</span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#E8701C' }}>{bulkQty}개 이상 구매</span>
                <span style={{ fontSize: 11, background: '#E8701C', color: '#fff', padding: '2px 7px', borderRadius: 20 }}>{bulkDiscountRate}% 할인</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 500, color: '#E8701C', paddingRight: selectedOption === 'bulk' ? 56 : 0 }}>{Math.round(bulkTotal).toLocaleString()}원~</span>
            </div>
            <p style={{ fontSize: 12, color: '#E8701C', margin: 0 }}>
              정가 대비 {Math.round(bulkSaving).toLocaleString()}원 절약 + 무료배송
            </p>
          </div>
        ) : null}
      </div>

      {detailTemplate}

      <div style={{ padding: '16px', textAlign: 'center' }}>
        <Link href="/rfq/new" style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'underline' }}>원하는 상품이 없으신가요? 발주요청하기</Link>
      </div>

      <div
        style={fixedStripeAboveBottomNav({
          background: '#fff',
          borderTop: '1px solid #ece9e3',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
        })}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => applyQty(qty - 1)}
              style={{ width: 36, height: 44, background: '#f7f6f2', border: 'none', fontSize: 18, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}
            >
              −
            </button>
            <span style={{ width: 44, textAlign: 'center', fontSize: 15, fontWeight: 500 }}>{qty}</span>
            <button
              type="button"
              onClick={() => applyQty(qty + 1)}
              style={{ width: 36, height: 44, background: '#f7f6f2', border: 'none', fontSize: 18, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}
            >
              +
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <CartAddButton
              listingId={listingId}
              quantity={qty}
              label={`장바구니 담기 · ${subtotal.toLocaleString()}원`}
              primary
              fullWidth
              listingCard
              onSuccess={handleCartSuccess}
            />
          </div>
        </div>
      </div>

      {showCartPopup && (
        <div style={{ position: 'fixed', bottom: `calc(${BOTTOM_NAV_HEIGHT_PX}px + 80px + env(safe-area-inset-bottom))`, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 448, background: '#1f5d3a', borderRadius: 14, padding: '16px 20px', zIndex: 45, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>✓ 장바구니에 담겼습니다</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/buy/cart" style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: '#fff', color: '#1f5d3a', fontSize: 13, fontWeight: 700, textAlign: 'center', textDecoration: 'none', display: 'block' }}>장바구니 보기</Link>
            <button type="button" onClick={() => setShowCartPopup(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>계속 쇼핑</button>
          </div>
        </div>
      )}
    </div>
  )
}
