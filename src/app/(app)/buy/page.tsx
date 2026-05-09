import Link from 'next/link'
import { getCart, getListings, getRecentOrderItems } from '@/actions/buy'
import { BUY_CATEGORY_CHIPS, categoryIdForCatParam, isValidCatSlug } from '@/lib/buy-category-chips'
import { formatKRW } from '@/lib/utils'
import CartAddButton from '@/components/buy/CartAddButton'

const shell = { maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' } as const

const card = {
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  background: '#fff',
  padding: 12,
} as const

function listingTitle(name: string | null | undefined) {
  const t = name?.trim()
  return t && t.length > 0 ? t : '\u2014'
}

function listingDescriptionLine(desc: string | null | undefined): string | null {
  const t = desc?.trim()
  if (!t) return null
  return t.replace(/\s+/g, ' ')
}

function buyHref(search?: string, catSlug?: string) {
  const p = new URLSearchParams()
  if (search?.trim()) p.set('search', search.trim())
  if (catSlug && catSlug !== 'all') p.set('cat', catSlug)
  const q = p.toString()
  return q ? `/buy?${q}` : '/buy'
}

function CartHeaderIcon({ count }: { count: number }) {
  return (
    <Link
      href="/buy/cart"
      aria-label={count > 0 ? `장바구니, 상품 ${count}건` : '장바구니'}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        color: '#111',
        textDecoration: 'none',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path
          d="M7 7h14l-1.5 9h-12L7 7zm0 0L5.5 3H2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9.5" cy="19" r="1.35" fill="currentColor" />
        <circle cx="17.5" cy="19" r="1.35" fill="currentColor" />
      </svg>
      {count > 0 ? (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 9,
            background: '#111',
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            lineHeight: '18px',
            textAlign: 'center',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  )
}

export default async function BuyHomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[]; cat?: string | string[] }>
}) {
  const sp = await searchParams
  const rawSearch = Array.isArray(sp.search) ? sp.search[0] : sp.search
  const search = rawSearch?.trim() || undefined

  const rawCat = Array.isArray(sp.cat) ? sp.cat[0] : sp.cat
  let catSlug = rawCat?.trim() || undefined
  if (catSlug && !isValidCatSlug(catSlug)) catSlug = undefined

  const category_id = categoryIdForCatParam(catSlug)

  const [listRes, recentRes, cartRes] = await Promise.all([
    getListings({ search, category_id }),
    getRecentOrderItems(),
    getCart(),
  ])

  const listings = listRes.success ? listRes.data?.listings ?? [] : []
  const recent = recentRes.success ? recentRes.data?.items ?? [] : []
  const listError = listRes.success ? null : listRes.error
  const recentError = recentRes.success ? null : recentRes.error
  const cartError = cartRes.success ? null : cartRes.error

  const cartItems = cartRes.success ? cartRes.data?.items ?? [] : []
  const cartLineCount = cartItems.length
  const cartTotal = cartItems.reduce((s, it) => s + it.commerce_price * it.quantity, 0)

  return (
    <main style={shell}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111', margin: 0 }}>구매하기</h1>
        <CartHeaderIcon count={cartLineCount} />
      </header>

      {cartLineCount > 0 ? (
        <section
          style={{
            background: '#f8f8f8',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, color: '#374151', marginBottom: 10 }}>
            담은 상품 {cartLineCount}개 · <span style={{ fontWeight: 700, color: '#111' }}>합계 {formatKRW(cartTotal)}</span>
          </div>
          <Link
            href="/buy/cart"
            style={{
              display: 'inline-block',
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #e0e0e0',
              background: '#fff',
              color: '#111',
              fontSize: 14,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            장바구니 보기 →
          </Link>
        </section>
      ) : null}

      {(listError || recentError || cartError) && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: '#FEF2F2',
            color: '#b91c1c',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {listError || recentError || cartError}
        </div>
      )}

      <section style={{ marginBottom: 20 }}>
        {recent.length === 0 ? (
          <p
            style={{
              fontSize: 13,
              color: '#6b7280',
              lineHeight: 1.5,
              margin: '0 0 10px',
            }}
          >
            자주 구매하는 식자재를
            <br />
            한 번에 다시 주문할 수 있어요
          </p>
        ) : null}
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: '0 0 12px' }}>다시 사기</h2>
        {recent.length > 0 ? (
          <div
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 4,
              margin: '0 -16px',
              paddingLeft: 16,
              paddingRight: 16,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {recent.map((it) => (
              <div
                key={it.listing_id}
                style={{
                  ...card,
                  flex: '0 0 auto',
                  width: 168,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  boxSizing: 'border-box',
                }}
              >
                {it.thumbnail_url ? (
                  <img
                    src={it.thumbnail_url}
                    alt=""
                    width={144}
                    height={100}
                    style={{
                      width: '100%',
                      height: 100,
                      objectFit: 'cover',
                      borderRadius: 8,
                      background: '#e5e7eb',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: 100,
                      borderRadius: 8,
                      background: '#e5e7eb',
                    }}
                    aria-hidden
                  />
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.35, minHeight: 36 }}>
                  {it.listing_title}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>최근 구매가(참고) {formatKRW(it.unit_price)}</div>
                {it.listing_buyable && it.current_price != null ? (
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>현재 {formatKRW(it.current_price)}</div>
                ) : (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>현재 담을 수 없음</div>
                )}
                {it.listing_buyable ? (
                  <CartAddButton listingId={it.listing_id} quantity={1} label="다시 담기" compact fullWidth />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              ...card,
              fontSize: 14,
              color: '#6b7280',
              lineHeight: 1.55,
            }}
          >
            구매 이력이 생기면 이곳에서 빠르게 다시 담을 수 있어요.
          </div>
        )}
      </section>

      <form action="/buy" method="get" style={{ marginBottom: 12 }}>
        {catSlug && catSlug !== 'all' ? <input type="hidden" name="cat" value={catSlug} /> : null}
        <input
          name="search"
          defaultValue={search ?? ''}
          placeholder="상품명 검색"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            fontSize: 14,
          }}
        />
      </form>

      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          marginBottom: 20,
          paddingBottom: 4,
          marginLeft: -16,
          marginRight: -16,
          paddingLeft: 16,
          paddingRight: 16,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {BUY_CATEGORY_CHIPS.map((c) => {
          const selected =
            c.slug === 'all'
              ? !catSlug || catSlug === 'all'
              : catSlug === c.slug
          const href = buyHref(search, c.slug === 'all' ? undefined : c.slug)
          return (
            <Link
              key={c.slug}
              href={href}
              scroll={false}
              style={{
                flex: '0 0 auto',
                borderRadius: 20,
                padding: '6px 14px',
                fontSize: 14,
                textDecoration: 'none',
                fontWeight: 600,
                background: selected ? '#111' : '#f5f5f5',
                color: selected ? '#fff' : '#333',
                border: selected ? 'none' : '1px solid transparent',
              }}
            >
              {c.label}
            </Link>
          )
        })}
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: '0 0 12px' }}>전체 상품</h2>

      {listings.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '24px 16px' }}>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.55, margin: '0 0 16px' }}>
            아직 구매 가능한 상품이 없습니다
            <br />
            원하는 상품을 요청하면 확인 후 등록해드릴게요
          </p>
          <Link
            href="/rfq/new"
            style={{
              display: 'inline-block',
              padding: '12px 18px',
              borderRadius: 8,
              background: '#111',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            상품 요청하기
          </Link>
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {listings.map((p) => {
            const descLine = listingDescriptionLine(p.description)
            return (
              <li key={p.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
                <Link href={`/buy/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {p.thumbnail_url?.trim() ? (
                    <img
                      src={p.thumbnail_url.trim()}
                      alt=""
                      width={200}
                      height={120}
                      style={{
                        width: '100%',
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 8,
                        background: '#e5e7eb',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 120,
                        borderRadius: 8,
                        background: '#e5e7eb',
                      }}
                      aria-hidden
                    />
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginTop: 8, lineHeight: 1.35, minHeight: 36 }}>
                    {listingTitle(p.product_name)}
                  </div>
                  {descLine ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#6b7280',
                        lineHeight: 1.35,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: 2,
                      }}
                    >
                      {descLine}
                    </div>
                  ) : null}
                </Link>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{formatKRW(p.commerce_price)}</div>
                <CartAddButton listingId={p.id} quantity={1} label="담기" compact fullWidth />
              </li>
            )
          })}
        </ul>
      )}

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <Link href="/buy/orders" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'underline' }}>
          구매 내역 보기
        </Link>
      </div>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          background: '#fff',
          borderTop: '1px solid #eee',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 10px' }}>원하는 상품이 없으신가요?</p>
          <Link
            href="/rfq/new"
            style={{
              display: 'block',
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #e0e0e0',
              background: '#fff',
              color: '#111',
              fontSize: 14,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            상품 요청하기
          </Link>
        </div>
      </div>
    </main>
  )
}
