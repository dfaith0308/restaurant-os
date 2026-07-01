import Link from 'next/link'
import CartAddButton from '@/components/buy/CartAddButton'

function savingsLabel(originalPrice: number, commercePrice: number): string | null {
  if (originalPrice <= commercePrice) return null
  const savings = originalPrice - commercePrice
  const rate = Math.round((savings / originalPrice) * 100)
  return `시중가 대비 ${savings.toLocaleString()}원 (${rate}%) 절감`
}

type BuyListingCardProps = {
  listingId: string
  thumbnailUrl: string | null
  commercePrice: number
  originalPrice: number | null
  spec: string | null
  detailHref?: string
  addLabel?: string
  buyable?: boolean
  width?: number
}

export default function BuyListingCard({
  listingId,
  thumbnailUrl,
  commercePrice,
  originalPrice,
  spec,
  detailHref,
  addLabel = '담기',
  buyable = true,
  width,
}: BuyListingCardProps) {
  const thumb = thumbnailUrl?.trim()
  const savings =
    originalPrice != null && originalPrice > commercePrice
      ? savingsLabel(originalPrice, commercePrice)
      : null

  const imageArea = (
    <div
      style={{
        background: '#f7f6f2',
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <span style={{ color: '#ccc', fontSize: 13 }}>이미지 없음</span>
      )}
    </div>
  )

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        width: width ?? '100%',
        boxSizing: 'border-box',
      }}
    >
      {detailHref ? (
        <Link href={detailHref} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          {imageArea}
        </Link>
      ) : (
        imageArea
      )}

      <div style={{ background: '#2b2b2b', padding: '12px 14px 14px' }}>
        <p style={{ fontSize: 20, fontWeight: 500, color: '#fff', margin: '0 0 2px', lineHeight: 1.2 }}>
          {commercePrice.toLocaleString()}원
        </p>
        {spec ? <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 6px' }}>{spec}</p> : null}
        {savings ? (
          <p style={{ fontSize: 12, color: '#52B788', margin: '0 0 10px' }}>{savings}</p>
        ) : (
          <div style={{ marginBottom: 10 }} />
        )}
        {buyable ? (
          <CartAddButton listingId={listingId} quantity={1} label={addLabel} listingCard fullWidth primary />
        ) : (
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>현재 담을 수 없음</p>
        )}
      </div>
    </div>
  )
}
