import Link from 'next/link'
import { getListings, getRecentOrderItems } from '@/actions/buy'
import { formatKRW } from '@/lib/utils'
import CartAddButton from '@/components/buy/CartAddButton'

const shell = { maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' } as const

export default async function BuyHomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>
}) {
  const sp = await searchParams
  const raw = Array.isArray(sp.search) ? sp.search[0] : sp.search
  const search = raw?.trim() || undefined

  const [listRes, recentRes] = await Promise.all([
    getListings({ search }),
    getRecentOrderItems(),
  ])

  const listings = listRes.success ? listRes.data?.listings ?? [] : []
  const recent = recentRes.success ? recentRes.data?.items ?? [] : []
  const listError = listRes.success ? null : listRes.error
  const recentError = recentRes.success ? null : recentRes.error

  return (
    <main style={shell}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>구매하기</h1>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>플랫폼에서 바로 살 수 있는 상품이에요</p>

      {(listError || recentError) && (
        <div style={{ padding: 12, borderRadius: 10, background: '#FEF2F2', color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>
          {listError || recentError}
        </div>
      )}

      {recent.length > 0 ? (
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 14, fontWeight: 900, color: '#111827', margin: '0 0 10px' }}>최근 구매 상품</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recent.map((it) => (
              <li
                key={it.listing_id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{it.listing_title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{formatKRW(it.unit_price)} (참고가)</div>
                </div>
                <CartAddButton listingId={it.listing_id} quantity={1} label="다시 담기" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form action="/buy" method="get" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input
          name="search"
          defaultValue={search ?? ''}
          placeholder="상품명 검색"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: '#111827',
            color: '#fff',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          검색
        </button>
      </form>

      <h2 style={{ fontSize: 14, fontWeight: 900, color: '#111827', margin: '0 0 10px' }}>전체 상품</h2>

      {listings.length === 0 ? (
        <div style={{ padding: '28px 16px', borderRadius: 14, border: '1px dashed #e5e7eb', background: '#fff', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5, margin: '0 0 14px' }}>
            현재 구매 가능한 상품이 없습니다.
            <br />
            발주요청을 통해 원하는 상품을 요청해보세요.
          </p>
          <Link
            href="/rfq/new"
            style={{
              display: 'inline-block',
              padding: '10px 14px',
              borderRadius: 10,
              background: '#111827',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            발주요청 하기
          </Link>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {listings.map((p) => (
            <li
              key={p.id}
              style={{
                padding: 14,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {p.thumbnail_url?.trim() ? (
                <img
                  src={p.thumbnail_url.trim()}
                  alt=""
                  width={72}
                  height={72}
                  style={{
                    flexShrink: 0,
                    objectFit: 'cover',
                    borderRadius: 10,
                    background: '#f3f4f6',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    flexShrink: 0,
                    borderRadius: 10,
                    background: '#e5e7eb',
                  }}
                  aria-hidden
                />
              )}
              <Link href={`/buy/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{p.product_name ?? '상품'}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#374151', marginTop: 6 }}>{formatKRW(p.commerce_price)}</div>
              </Link>
              <CartAddButton listingId={p.id} quantity={1} />
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Link href="/buy/orders" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'underline' }}>
          구매 내역 보기
        </Link>
      </div>
    </main>
  )
}
