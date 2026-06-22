import Link from 'next/link'
import { getCart, getListings, getRecentOrderItems, getStoreCategories } from '@/actions/buy'
import { fixedStripeAboveBottomNav } from '@/lib/app-shell'
import { formatKRW } from '@/lib/utils'
import CartAddButton from '@/components/buy/CartAddButton'

const shell = { width: '100%', boxSizing: 'border-box' as const, padding: '20px 16px 80px' }

const card = {
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  background: '#fff',
  padding: 12,
} as const

const gridCardShell = {
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  background: '#fff',
  overflow: 'hidden' as const,
}

const thumbImageStyle = {
  width: '100%',
  aspectRatio: '1 / 1',
  objectFit: 'contain' as const,
  display: 'block',
  background: '#f5f5f5',
}

const thumbPlaceholderStyle = {
  width: '100%',
  aspectRatio: '1 / 1',
  background: '#eef4f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 28,
  color: 'var(--color-primary)',
  lineHeight: 1,
}
const GRID_GAP = 10
const INFO_PAD = 12
const INFO_GAP = 6
const PRICE_TO_BTN = 10

const BRAND_GENERIC = new Set([
  '업소용',
  '프리미엄',
  '국산',
  '일반',
  '특급',
  '대용량',
])

function brandHintFromTitle(title: string): string | null {
  const t = title.trim()
  if (!t) return null
  const first = t.split(/\s+/)[0]
  if (!first || BRAND_GENERIC.has(first)) return null
  return first
}

function shippingBadgeLabel(listing: { shipping_free?: boolean | null }): string | null {
  if (listing.shipping_free === false) return null
  return '무료배송'
}

function productNameInitial(name: string | null | undefined): string {
  const t = name?.trim()
  if (!t) return '?'
  return t[0] ?? '?'
}

function buyHref(search?: string, catSlug?: string, subCatSlug?: string) {
  const p = new URLSearchParams()
  if (search?.trim()) p.set('search', search.trim())
  if (catSlug && catSlug !== 'all') p.set('cat', catSlug)
  if (subCatSlug) p.set('subcat', subCatSlug)
  const q = p.toString()
  return q ? `/buy?${q}` : '/buy'
}

const chipRowStyle = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto' as const,
  paddingBottom: 4,
  marginLeft: -16,
  marginRight: -16,
  paddingLeft: 16,
  paddingRight: 16,
  WebkitOverflowScrolling: 'touch' as const,
}

function PriceAidStack({
  commercePrice,
  originalPrice,
}: {
  commercePrice: number
  originalPrice: number | null
}) {
  const savings =
    originalPrice != null && originalPrice > commercePrice ? originalPrice - commercePrice : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: '#888' }}>식식이가</span>
      <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>{formatKRW(commercePrice)}</span>
      {savings != null && savings > 0 ? (
        <span style={{ fontSize: 12, color: 'var(--color-primary)' }}>{formatKRW(savings)} 절감</span>
      ) : null}
    </div>
  )
}

export default async function BuyHomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[]; cat?: string | string[]; subcat?: string | string[] }>
}) {
  const sp = await searchParams
  const rawSearch = Array.isArray(sp.search) ? sp.search[0] : sp.search
  const search = rawSearch?.trim() || undefined

  const rawCat = Array.isArray(sp.cat) ? sp.cat[0] : sp.cat
  let catSlug = rawCat?.trim() || undefined

  const rawSubCat = Array.isArray(sp.subcat) ? sp.subcat[0] : sp.subcat
  let subCatSlug = rawSubCat?.trim() || undefined

  const categoriesRes = await getStoreCategories()
  const storeCategories = categoriesRes.success ? categoriesRes.data?.categories ?? [] : []

  if (catSlug && catSlug !== 'all') {
    const valid = storeCategories.some((c) => c.slug === catSlug || c.id === catSlug)
    if (!valid) catSlug = undefined
  }

  const selectedParent =
    catSlug && catSlug !== 'all'
      ? storeCategories.find((c) => c.slug === catSlug || c.id === catSlug)
      : null

  if (subCatSlug && selectedParent) {
    const validSub = selectedParent.children.some((c) => c.slug === subCatSlug || c.id === subCatSlug)
    if (!validSub) subCatSlug = undefined
  } else if (subCatSlug) {
    subCatSlug = undefined
  }

  const selectedSub =
    subCatSlug && selectedParent
      ? selectedParent.children.find((c) => c.slug === subCatSlug || c.id === subCatSlug)
      : null

  const category_id = selectedSub?.id ?? selectedParent?.id ?? undefined

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
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0)
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
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary)', margin: 0 }}>구매하기</h1>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Link href="/buy/cart" style={{ fontSize: 24, textDecoration: 'none' }} aria-label={cartCount > 0 ? `장바구니, 상품 ${cartCount}개` : '장바구니'}>
            🛒
          </Link>
          {cartCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: -8,
                background: '#dc2626',
                color: '#fff',
                fontSize: 10,
                fontWeight: 800,
                width: 18,
                height: 18,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </div>
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
            담은 상품 {cartLineCount}개 · <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>합계 {formatKRW(cartTotal)}</span>
          </div>
          <Link
            href="/buy/cart"
            style={{
              display: 'inline-block',
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #e0e0e0',
              background: '#fff',
              color: 'var(--color-text)',
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
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 12px' }}>다시 사기</h2>
        {recent.length > 0 ? (
          <div
            style={{
              display: 'flex',
              gap: GRID_GAP,
              overflowX: 'auto',
              paddingBottom: 4,
              margin: '0 -16px',
              paddingLeft: 16,
              paddingRight: 16,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {recent.map((it) => {
              const title = it.listing_title?.trim() ?? ''
              const brand = brandHintFromTitle(title)
              const badge = shippingBadgeLabel(it)
              const thumb = it.thumbnail_url?.trim()
              return (
                <div
                  key={it.listing_id}
                  style={{
                    ...gridCardShell,
                    flex: '0 0 auto',
                    width: 168,
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ position: 'relative', width: '100%' }}>
                    {badge ? (
                      <span
                        style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          zIndex: 1,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--color-primary)',
                          color: '#fff',
                          lineHeight: 1.25,
                        }}
                      >
                        {badge}
                      </span>
                    ) : null}
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        style={thumbImageStyle}
                      />
                    ) : (
                      <div
                        style={thumbPlaceholderStyle}
                        aria-hidden
                      >
                        {productNameInitial(it.listing_title)}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: `${INFO_PAD}px ${INFO_PAD}px 0`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: INFO_GAP,
                      flex: 1,
                    }}
                  >
                    {brand ? (
                      <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, lineHeight: 1.25 }}>
                        {brand}
                      </div>
                    ) : null}
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        lineHeight: 1.35,
                        minHeight: 36,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {title}
                    </div>
                    {it.listing_buyable && it.current_price != null ? (
                      <PriceAidStack commercePrice={it.current_price} originalPrice={it.original_price} />
                    ) : (
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>현재 담을 수 없음</div>
                    )}
                  </div>
                  {it.listing_buyable ? (
                    <div style={{ padding: `${PRICE_TO_BTN}px ${INFO_PAD}px ${INFO_PAD}px` }}>
                      <CartAddButton listingId={it.listing_id} quantity={1} label="다시 담기" listingCard fullWidth primary />
                    </div>
                  ) : (
                    <div style={{ height: INFO_PAD }} aria-hidden />
                  )}
                </div>
              )
            })}
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
        {subCatSlug ? <input type="hidden" name="subcat" value={subCatSlug} /> : null}
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
          ...chipRowStyle,
          marginBottom: selectedParent && selectedParent.children.length > 0 ? 0 : 20,
        }}
      >
        <Link
          href={buyHref(search, 'all')}
          scroll={false}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 16px',
            borderRadius: 20,
            fontSize: 14,
            fontWeight: !catSlug || catSlug === 'all' ? 600 : 400,
            background: !catSlug || catSlug === 'all' ? '#1f5d3a' : 'var(--color-background-primary)',
            color: !catSlug || catSlug === 'all' ? '#fff' : 'var(--color-text-primary)',
            border: `1px solid ${!catSlug || catSlug === 'all' ? '#1f5d3a' : 'var(--color-border-default)'}`,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
          전체
        </Link>

        {storeCategories.map((c) => {
          const isActive = catSlug === c.slug || catSlug === c.id
          return (
            <Link
              key={c.id}
              href={buyHref(search, c.slug ?? c.id)}
              scroll={false}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                background: isActive ? '#1f5d3a' : 'var(--color-background-primary)',
                color: isActive ? '#fff' : 'var(--color-text-primary)',
                border: `1px solid ${isActive ? '#1f5d3a' : 'var(--color-border-default)'}`,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
              }}
            >
              {c.name}
            </Link>
          )
        })}
      </div>

      {selectedParent && selectedParent.children.length > 0 ? (
        <div
          style={{
            background: '#f3f7f5',
            borderRadius: 10,
            padding: '10px 0',
            marginBottom: 20,
            marginLeft: -16,
            marginRight: -16,
          }}
        >
          <div style={chipRowStyle}>
            <Link
              href={buyHref(search, catSlug)}
              scroll={false}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 14px',
                borderRadius: 16,
                fontSize: 13,
                fontWeight: !subCatSlug ? 600 : 400,
                background: !subCatSlug ? '#f0f7f3' : '#fff',
                color: !subCatSlug ? '#1f5d3a' : '#374151',
                border: `1px solid ${!subCatSlug ? '#1f5d3a' : '#e5e7eb'}`,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
              }}
            >
              {selectedParent.name} 전체
            </Link>

            {selectedParent.children.map((sub) => {
              const isActive = subCatSlug === sub.slug || subCatSlug === sub.id
              return (
                <Link
                  key={sub.id}
                  href={buyHref(search, catSlug, sub.slug ?? sub.id)}
                  scroll={false}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 14px',
                    borderRadius: 16,
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? '#f0f7f3' : '#fff',
                    color: isActive ? '#1f5d3a' : '#374151',
                    border: `1px solid ${isActive ? '#1f5d3a' : '#e5e7eb'}`,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    flex: '0 0 auto',
                  }}
                >
                  {sub.name}
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}

      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 12px' }}>전체 상품</h2>

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
              background: 'var(--color-primary)',
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
            gap: GRID_GAP,
          }}
        >
          {listings.map((p) => {
            const title = p.product_name?.trim() ?? ''
            const brand = brandHintFromTitle(title)
            const badge = shippingBadgeLabel(p)
            const thumb = p.thumbnail_url?.trim()
            return (
              <li key={p.id} style={{ ...gridCardShell, display: 'flex', flexDirection: 'column' }}>
                <Link href={`/buy/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    {badge ? (
                      <span
                        style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          zIndex: 1,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--color-primary)',
                          color: '#fff',
                          lineHeight: 1.25,
                        }}
                      >
                        {badge}
                      </span>
                    ) : null}
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        style={thumbImageStyle}
                      />
                    ) : (
                      <div
                        style={thumbPlaceholderStyle}
                        aria-hidden
                      >
                        {productNameInitial(p.product_name)}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: `${INFO_PAD}px ${INFO_PAD}px 0`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: INFO_GAP,
                    }}
                  >
                    {brand ? (
                      <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, lineHeight: 1.25 }}>
                        {brand}
                      </div>
                    ) : null}
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        lineHeight: 1.35,
                        minHeight: 36,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {title}
                    </div>
                    <PriceAidStack commercePrice={p.commerce_price} originalPrice={p.original_price} />
                  </div>
                </Link>
                <div style={{ padding: `${PRICE_TO_BTN}px ${INFO_PAD}px ${INFO_PAD}px` }}>
                  <CartAddButton listingId={p.id} quantity={1} label="담기" listingCard fullWidth primary />
                </div>
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
        style={fixedStripeAboveBottomNav({
          background: '#fff',
          borderTop: '1px solid #eee',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
        })}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 10px' }}>원하는 상품이 없으신가요?</p>
          <Link
            href="/rfq/new"
            style={{
              display: 'block',
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #e0e0e0',
              background: '#fff',
              color: 'var(--color-text)',
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
