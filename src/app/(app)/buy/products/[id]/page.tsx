import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getListing } from '@/actions/buy'
import { formatKRW } from '@/lib/utils'
import BuyProductDetailClient from '@/components/buy/BuyProductDetailClient'

const shell = { maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' } as const

const thumbImageStyle = {
  width: '100%',
  aspectRatio: '1 / 1',
  objectFit: 'contain' as const,
  display: 'block',
  background: '#f3f4f6',
  borderRadius: 14,
  marginBottom: 16,
}

const thumbPlaceholderStyle = {
  width: '100%',
  aspectRatio: '1 / 1',
  borderRadius: 14,
  background: '#e5e7eb',
  marginBottom: 16,
}

const detailImageStyle = {
  width: '100%',
  objectFit: 'contain' as const,
  marginBottom: 8,
  display: 'block',
  background: '#f5f5f5',
  borderRadius: 8,
}

export default async function BuyProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getListing(id)
  if (!res.success || !res.data?.listing) notFound()

  const p = res.data.listing
  const thumb = p.thumbnail_url?.trim()
  const detailImages = (p.image_urls ?? []).map((url) => url?.trim()).filter((url): url is string => Boolean(url))

  return (
    <main style={shell}>
      <Link href="/buy" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← 목록
      </Link>
      {thumb ? (
        <img src={thumb} alt="" style={thumbImageStyle} />
      ) : (
        <div style={thumbPlaceholderStyle} aria-hidden />
      )}

      {detailImages.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          {detailImages.map((url, index) => (
            <img key={`${url}-${index}`} src={url} alt="" style={detailImageStyle} />
          ))}
        </div>
      ) : null}

      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px' }}>
        {p.product_name?.trim() ?? ''}
      </h1>
      <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--color-text)', margin: '0 0 12px' }}>{formatKRW(p.commerce_price)}</p>
      {p.description?.trim() ? (
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.55, margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>
          {p.description.trim()}
        </p>
      ) : null}

      <BuyProductDetailClient listingId={p.id} price={p.commerce_price} />
    </main>
  )
}
