'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
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
  boxQty?: number
  origin?: string | null
  storageMethod?: string | null
  minOrderQty?: number
  packageUnit?: string | null
  usageDesc?: string | null
  allergen?: string | null
  ingredients?: string | null
  manufacturer?: string | null
}

export default function BuyProductDetailClient({
  listingId,
  productName,
  brandName,
  price,
  thumbnailUrl,
  imageUrls,
  baseShippingFee,
  freeShippingQty,
  bulkQty,
  bulkDiscountRate,
  boxQty = 1,
  origin,
  storageMethod,
  allergen,
  ingredients,
  usageDesc,
}: Props) {
  const [qty, setQty] = useState(1)
  const [showCartPopup, setShowCartPopup] = useState(false)
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCartSuccess() {
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
    setShowCartPopup(true)
    popupTimerRef.current = setTimeout(() => setShowCartPopup(false), 3000)
  }

  const calcShippingCost = useCallback(
    (orderQty: number): number => {
      if (!freeShippingQty || orderQty >= freeShippingQty) return 0
      const boxes = Math.ceil(orderQty / (boxQty || 1))
      return boxes * baseShippingFee
    },
    [freeShippingQty, boxQty, baseShippingFee],
  )

  const currentUnitPrice = useMemo(() => {
    if (bulkQty && bulkDiscountRate && qty >= bulkQty) {
      return Math.round(price * (1 - bulkDiscountRate / 100))
    }
    return price
  }, [qty, price, bulkQty, bulkDiscountRate])

  const currentShippingCost = useMemo(() => calcShippingCost(qty), [qty, calcShippingCost])

  const subtotal = currentUnitPrice * qty

  const nudgeBanner = useMemo(() => {
    if (!freeShippingQty) return null
    if (qty >= freeShippingQty) return null
    const remaining = freeShippingQty - qty
    return {
      type: 'free_shipping' as const,
      msg: `${remaining}개만 더 담으면 무료배송!`,
      sub: `지금 배송비 ${formatKRW(currentShippingCost)} → ${freeShippingQty}개 이상이면 무료`,
    }
  }, [qty, freeShippingQty, currentShippingCost])

  return (
    <div style={{ background: '#f7f6f2', minHeight: '100vh', paddingBottom: 'calc(100px + env(safe-area-inset-bottom))', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* 상단 헤더 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#f7f6f2', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #ece9e3' }}>
        <Link href="/buy" style={{ fontSize: 22, color: '#2b2b2b', textDecoration: 'none', lineHeight: 1 }}>←</Link>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#2b2b2b' }}>상품 상세</span>
      </div>

      {/* 대표 이미지 */}
      <div style={{ background: '#fff', marginBottom: 8, position: 'relative' }}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={productName} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'contain', display: 'block', background: '#f8f8f8' }} />
        ) : (
          <div style={{ width: '100%', aspectRatio: '1/1', background: '#f0f4f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🛒</div>
        )}
      </div>

      {/* 상품 기본 정보 */}
      <div style={{ background: '#fff', padding: '18px 16px', marginBottom: 8 }}>
        {brandName && <p style={{ fontSize: 11, color: '#1f5d3a', fontWeight: 700, margin: '0 0 6px', letterSpacing: '0.04em' }}>{brandName}</p>}
        <h1 style={{ fontSize: 19, fontWeight: 700, color: '#1a1a1a', margin: '0 0 6px', lineHeight: 1.35 }}>{productName}</h1>
        {(origin || storageMethod || allergen || usageDesc || ingredients) && (
          <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {origin && <div style={{ display: 'flex', gap: 10, fontSize: 12 }}><span style={{ color: '#6b7280', minWidth: 56, flexShrink: 0 }}>원산지</span><span style={{ color: '#1a1a1a' }}>{origin}</span></div>}
            {storageMethod && <div style={{ display: 'flex', gap: 10, fontSize: 12 }}><span style={{ color: '#6b7280', minWidth: 56, flexShrink: 0 }}>보관방법</span><span style={{ color: '#1a1a1a' }}>{storageMethod}</span></div>}
            {allergen && <div style={{ display: 'flex', gap: 10, fontSize: 12 }}><span style={{ color: '#6b7280', minWidth: 56, flexShrink: 0 }}>알레르기</span><span style={{ color: '#1a1a1a' }}>{allergen}</span></div>}
            {usageDesc && <div style={{ display: 'flex', gap: 10, fontSize: 12 }}><span style={{ color: '#6b7280', minWidth: 56, flexShrink: 0 }}>용도</span><span style={{ color: '#1a1a1a' }}>{usageDesc}</span></div>}
            {ingredients && <div style={{ display: 'flex', gap: 10, fontSize: 12 }}><span style={{ color: '#6b7280', minWidth: 56, flexShrink: 0 }}>원재료</span><span style={{ color: '#1a1a1a', lineHeight: 1.6 }}>{ingredients}</span></div>}
          </div>
        )}
      </div>

      {/* 구매 옵션 3단계 */}
      <div style={{ background: '#fff', padding: '16px', marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', margin: '0 0 12px', letterSpacing: '.06em' }}>구매 옵션</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* 낱개 */}
          <div
            onClick={() => { if (!freeShippingQty || qty < freeShippingQty) return; setQty(1) }}
            style={{
              border: `2px solid ${(!freeShippingQty || qty < freeShippingQty) && (!bulkQty || qty < bulkQty) ? '#1f5d3a' : '#e5e7eb'}`,
              borderRadius: 12,
              padding: '14px',
              background: (!freeShippingQty || qty < freeShippingQty) && (!bulkQty || qty < bulkQty) ? '#f0f7f3' : '#fff',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>낱개 구매</span>
              {freeShippingQty && <span style={{ fontSize: 11, color: '#6b7280' }}>1~{freeShippingQty - 1}개</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>{formatKRW(price)}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>+ 배송비 {formatKRW(baseShippingFee)}</span>
            </div>
          </div>

          {/* 무료배송 */}
          {freeShippingQty && (
            <div
              onClick={() => setQty(freeShippingQty)}
              style={{
                border: `2px solid ${qty >= freeShippingQty && (!bulkQty || qty < bulkQty) ? '#1f5d3a' : '#e5e7eb'}`,
                borderRadius: 12,
                padding: '14px',
                background: qty >= freeShippingQty && (!bulkQty || qty < bulkQty) ? '#f0f7f3' : '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>📦 무료배송</span>
                  <span style={{ fontSize: 11, color: '#1f5d3a', background: '#f0f7f3', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{freeShippingQty}개 이상</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>{formatKRW(price)}</span>
                <span style={{ fontSize: 12, color: '#1f5d3a', fontWeight: 600 }}>배송비 무료</span>
              </div>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0' }}>최소 주문 {formatKRW(price * freeShippingQty)} · {freeShippingQty}개부터</p>
            </div>
          )}

          {/* 대량구매 */}
          {bulkQty && bulkDiscountRate && (
            <div
              onClick={() => setQty(bulkQty)}
              style={{
                border: `2px solid ${qty >= bulkQty ? '#e85c2a' : '#e5e7eb'}`,
                borderRadius: 12,
                padding: '14px',
                background: qty >= bulkQty ? '#fff8f5' : '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>🔥 대량구매</span>
                  <span style={{ fontSize: 11, color: '#e85c2a', background: '#fff5f0', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{bulkQty}개 이상 {bulkDiscountRate}% 추가할인</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#e85c2a' }}>{formatKRW(Math.round(price * (1 - bulkDiscountRate / 100)))}</span>
                <span style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'line-through' }}>{formatKRW(price)}</span>
              </div>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0' }}>배송비 무료 · {bulkQty}개 총 {formatKRW(Math.round(price * (1 - bulkDiscountRate / 100)) * bulkQty)}</p>
            </div>
          )}
        </div>
      </div>

      {/* 수량 선택 + 구매 유도 배너 */}
      <div style={{ background: '#fff', padding: '16px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#2b2b2b' }}>수량</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: '8px 0 0 8px', border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 18, cursor: 'pointer' }}>−</button>
            <div style={{ width: 48, height: 36, borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>{qty}</div>
            <button type="button" onClick={() => setQty(q => q + 1)} style={{ width: 36, height: 36, borderRadius: '0 8px 8px 0', border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 18, cursor: 'pointer' }}>+</button>
          </div>
        </div>

        {/* 구매 유도 배너 */}
        {nudgeBanner && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>💡</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>{nudgeBanner.msg}</p>
              <p style={{ fontSize: 11, color: '#92400e', margin: 0 }}>{nudgeBanner.sub}</p>
            </div>
          </div>
        )}

        {/* 대량구매 유도 */}
        {bulkQty && qty >= (freeShippingQty || 0) && qty < bulkQty && (
          <div style={{ background: '#fff5f0', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔥</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', margin: '0 0 2px' }}>{bulkQty - qty}개만 더 담으면 {bulkDiscountRate}% 추가할인!</p>
              <p style={{ fontSize: 11, color: '#c2410c', margin: 0 }}>{formatKRW(price)} → {formatKRW(Math.round(price * (1 - (bulkDiscountRate || 0) / 100)))} 으로 낮아져요</p>
            </div>
          </div>
        )}

        {/* 소계 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f0f7f3', borderRadius: 10 }}>
          <span style={{ fontSize: 13, color: '#374151' }}>소계 ({qty}개)</span>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#1f5d3a', margin: 0 }}>{formatKRW(subtotal)}</p>
            {currentShippingCost > 0 && <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>+ 배송비 {formatKRW(currentShippingCost)}</p>}
            {currentShippingCost === 0 && <p style={{ fontSize: 11, color: '#1f5d3a', margin: 0, fontWeight: 600 }}>배송비 무료 🚚</p>}
          </div>
        </div>
      </div>

      {/* 상세 이미지 */}
      {imageUrls.length > 0 && (
        <div style={{ background: '#fff', marginBottom: 8 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#2b2b2b', margin: 0 }}>상품 상세</p>
          </div>
          {imageUrls.map((url, i) => (
            <img key={i} src={url} alt="" style={{ width: '100%', display: 'block', objectFit: 'contain' }} />
          ))}
        </div>
      )}

      <div style={{ padding: '16px', textAlign: 'center' }}>
        <Link href="/rfq/new" style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'underline' }}>원하는 상품이 없으신가요? 발주요청하기</Link>
      </div>

      {/* 하단 고정 장바구니 버튼 */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', background: '#fff', borderTop: '1px solid #ece9e3', boxSizing: 'border-box', zIndex: 10 }}>
        <CartAddButton listingId={listingId} quantity={qty} label={`${formatKRW(subtotal)} 장바구니 담기`} primary fullWidth onSuccess={handleCartSuccess} />
      </div>

      {/* 장바구니 담기 성공 팝업 */}
      {showCartPopup && (
        <div style={{ position: 'fixed', bottom: 'calc(76px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 448, background: '#1f5d3a', borderRadius: 14, padding: '16px 20px', zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
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
