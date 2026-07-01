import Link from 'next/link'
import CartAddButton from '@/components/buy/CartAddButton'

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
}: BuyListingCardProps) {
  const thumb = thumbnailUrl?.trim()
  const nameLine = [productName?.trim(), spec?.trim()].filter(Boolean).join(' · ')
  const showSavings =
    originalPrice != null && originalPrice > commercePrice

  const imageArea = (
    <div
      style={{
        width: 100,
        minWidth: 100,
        background: '#fff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          style={{ width: '100%', height: 100, objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: 100,
            height: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#ccc', fontSize: 11 }}>이미지 없음</span>
        </div>
      )}
    </div>
  )

  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        background: '#fff',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {detailHref ? (
        <Link href={detailHref} style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
          {imageArea}
        </Link>
      ) : (
        imageArea
      )}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: '#f7f6f2',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {nameLine ? (
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 2px', lineHeight: 1.4 }}>
              {nameLine}
            </p>
          ) : null}
          <p style={{ fontSize: 19, fontWeight: 500, color: '#1a1a1a', margin: '0 0 2px', lineHeight: 1.2 }}>
            {commercePrice.toLocaleString()}원
          </p>
          {showSavings ? (
            <p style={{ fontSize: 12, color: '#1f5d3a', margin: 0 }}>
              시중가 대비 {(originalPrice! - commercePrice).toLocaleString()}원 절감
            </p>
          ) : null}
        </div>
        {buyable ? (
          <div style={{ marginTop: 10, width: '100%' }}>
            <CartAddButton
              listingId={listingId}
              quantity={1}
              label={addLabel}
              listingCard
              fullWidth
              primary
            />
          </div>
        ) : (
          <p style={{ fontSize: 12, color: '#6b7280', margin: '10px 0 0' }}>현재 담을 수 없음</p>
        )}
      </div>
    </div>
  )
}
