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

  return (
    <main style={shell}>
      <Link href="/buy" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← 목록
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>{p.product_name ?? '상품'}</h1>
      <p style={{ fontSize: 18, fontWeight: 900, color: '#111827', margin: '0 0 20px' }}>{formatKRW(p.commerce_price)}</p>

      <BuyProductDetailClient listingId={p.id} price={p.commerce_price} />
    </main>
  )
}
