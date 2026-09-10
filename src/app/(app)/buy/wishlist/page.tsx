import Link from 'next/link'
import { getWishlist } from '@/actions/buy'
import BuyListingCard from '@/components/buy/BuyListingCard'

const shell = { maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' } as const

export default async function BuyWishlistPage() {
  const res = await getWishlist()
  const listings = res.success ? res.data?.listings ?? [] : []

  return (
    <main style={shell}>
      <Link
        href="/buy"
        style={{
          fontSize: 13,
          color: '#6b7280',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 14,
        }}
      >
        ← 구매하기
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 16px' }}>
        찜한 상품
      </h1>

      {!res.success ? (
        <p style={{ color: '#b91c1c', fontSize: 14 }}>{res.error}</p>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 12px' }}>
          <p style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>찜한 상품이 없습니다</p>
          <Link
            href="/buy"
            style={{
              display: 'inline-block',
              padding: '14px 24px',
              borderRadius: 8,
              background: 'var(--color-primary)',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            상품 둘러보기
          </Link>
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {listings.map((p) => (
            <li key={p.id}>
              <BuyListingCard
                listingId={p.id}
                thumbnailUrl={p.thumbnail_url}
                commercePrice={p.commerce_price}
                originalPrice={p.original_price}
                productName={p.product_name}
                spec={p.spec ?? null}
                detailHref={`/buy/products/${p.id}`}
                status={p.status}
                buyable={p.status === 'visible'}
                wished
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
