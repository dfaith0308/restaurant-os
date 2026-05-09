import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getListing } from '@/actions/buy'
import { formatKRW } from '@/lib/utils'
import BuyProductDetailClient from '@/components/buy/BuyProductDetailClient'

const shell = { maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' } as const

export default async function BuyProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getListing(id)
  if (!res.success || !res.data?.listing) notFound()

  const p = res.data.listing
  const thumb = p.thumbnail_url?.trim()

  return (
    <main style={shell}>
      <Link href="/buy" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← 목록
      </Link>
      {thumb ? (
        <img
          src={thumb}
          alt=""
          width={480}
          height={240}
          style={{
            width: '100%',
            maxHeight: 240,
            objectFit: 'cover',
            borderRadius: 14,
            background: '#f3f4f6',
            marginBottom: 16,
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: 180,
            borderRadius: 14,
            background: '#e5e7eb',
            marginBottom: 16,
          }}
          aria-hidden
        />
      )}
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
        {p.product_name?.trim() ? p.product_name.trim() : '\u2014'}
      </h1>
      <p style={{ fontSize: 18, fontWeight: 900, color: '#111827', margin: '0 0 12px' }}>{formatKRW(p.commerce_price)}</p>
      {p.description?.trim() ? (
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.55, margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>
          {p.description.trim()}
        </p>
      ) : null}

      <BuyProductDetailClient listingId={p.id} price={p.commerce_price} />
    </main>
  )
}
