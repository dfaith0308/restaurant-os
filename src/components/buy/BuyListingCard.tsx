import Link from 'next/link'
import CartAddButton from '@/components/buy/CartAddButton'
import WishlistButton from '@/components/buy/WishlistButton'

type BuyListingCardProps = {
  listingId: string
  thumbnailUrl: string | null
  commercePrice: number
  originalPrice: number | null
  productName: string | null
  spec: string | null
  detailHref?: string
  addLabel?: string
  buyable?: boolean
  /** sold_out 등 — 품절 배지 */
  status?: string | null
  /** 찜 여부. undefined 면 하트를 렌더하지 않는다 */
  wished?: boolean
}

function PhotoPlaceholderIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="#c4c4c4" strokeWidth="1.5" />
      <circle cx="9" cy="10" r="1.75" fill="#c4c4c4" />
      <path
        d="M4.5 16.5l4.2-4.2a1 1 0 011.4 0L14 16l2.1-2.1a1 1 0 011.4 0l2 2"
        stroke="#c4c4c4"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function BuyListingCard({
  listingId,
  thumbnailUrl,
  commercePrice,
  originalPrice,
  productName,
  spec,
  detailHref,
  addLabel = '장바구니 담기',
  buyable = true,
  status = null,
  wished,
}: BuyListingCardProps) {
  const thumb = thumbnailUrl?.trim()
  const nameLine = [productName?.trim(), spec?.trim()].filter(Boolean).join(' · ')
  const isSoldOut = status === 'sold_out'
  const canAdd = buyable && !isSoldOut
  const showSavings = !isSoldOut && originalPrice != null && originalPrice > commercePrice
  const discountRate = showSavings
    ? Math.max(1, Math.round(((originalPrice! - commercePrice) / originalPrice!) * 100))
    : 0

  const imageArea = (
    <div
      style={{
        position: 'relative',
        width: 56,
        height: 56,
        minWidth: 56,
        borderRadius: 10,
        overflow: 'hidden',
        background: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: isSoldOut ? 0.55 : 1,
          }}
        />
      ) : (
        <PhotoPlaceholderIcon />
      )}
      {isSoldOut ? (
        <span
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            background: '#6b7280',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            lineHeight: 1,
            padding: '3px 5px',
            borderRadius: 6,
          }}
        >
          품절
        </span>
      ) : showSavings ? (
        <span
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            background: '#E8701C',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            lineHeight: 1,
            padding: '3px 5px',
            borderRadius: 6,
          }}
        >
          {discountRate}%
        </span>
      ) : null}
    </div>
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        background: '#fff',
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 12px',
      }}
    >
      {detailHref ? (
        <Link href={detailHref} style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
          {imageArea}
        </Link>
      ) : (
        imageArea
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {nameLine ? (
          <p
            style={{
              fontSize: 13,
              color: '#374151',
              margin: '0 0 4px',
              lineHeight: 1.35,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {nameLine}
          </p>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0, lineHeight: 1.2 }}>
            {commercePrice.toLocaleString()}원
          </p>
          {showSavings ? (
            <span
              style={{
                fontSize: 12,
                color: '#9ca3af',
                textDecoration: 'line-through',
                lineHeight: 1.2,
              }}
            >
              {originalPrice!.toLocaleString()}원
            </span>
          ) : null}
        </div>
        {isSoldOut ? (
          <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0', fontWeight: 600 }}>품절</p>
        ) : showSavings ? (
          <p style={{ fontSize: 11, color: '#1f5d3a', margin: '3px 0 0', fontWeight: 600 }}>
            {(originalPrice! - commercePrice).toLocaleString()}원 절감
          </p>
        ) : null}
      </div>

      {wished === undefined ? null : (
        <WishlistButton listingId={listingId} initialWished={wished} />
      )}

      {canAdd ? (
        <div style={{ flexShrink: 0 }}>
          <CartAddButton listingId={listingId} quantity={1} label={addLabel} listingCard primary />
        </div>
      ) : (
        <p style={{ fontSize: 11, color: '#6b7280', margin: 0, flexShrink: 0 }}>
          {isSoldOut ? '품절' : '담기 불가'}
        </p>
      )}
    </div>
  )
}
