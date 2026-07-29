import CartAddButton from '@/components/buy/CartAddButton'
import type { RecentOrderItemRow } from '@/lib/buy-types'
import { formatKRW } from '@/lib/utils'

/** BuyCatalogShell chipRowStyle과 동일 — 가로 스크롤 칩/카드 행 */
const horizontalScrollRow = {
  display: 'flex',
  gap: 10,
  overflowX: 'auto' as const,
  paddingBottom: 4,
  marginLeft: -16,
  marginRight: -16,
  paddingLeft: 16,
  paddingRight: 16,
  WebkitOverflowScrolling: 'touch' as const,
}

/** getRecentOrderItems는 최대 10개 — UI는 8개로 제한 */
const RECENT_UI_LIMIT = 8

function PhotoPlaceholder() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

export default function BuyRecentReorderRow({ items }: { items: RecentOrderItemRow[] }) {
  if (items.length === 0) return null

  const list = items.slice(0, RECENT_UI_LIMIT)

  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 12px' }}>
        최근 주문한 상품
      </h2>
      <div style={horizontalScrollRow}>
        {list.map((it) => {
          const thumb = it.thumbnail_url?.trim()
          const hasCurrent = it.current_price != null
          const price = hasCurrent ? it.current_price! : it.unit_price
          const buyable = it.listing_buyable && hasCurrent

          return (
            <div
              key={it.listing_id}
              style={{
                flex: '0 0 auto',
                width: 132,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 10,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: 88,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <PhotoPlaceholder />
                )}
              </div>

              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1a1a1a',
                  margin: 0,
                  lineHeight: 1.35,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const,
                  minHeight: '2.7em',
                }}
              >
                {it.listing_title}
              </p>

              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{formatKRW(price)}</p>
                {!it.listing_buyable ? (
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>현재 판매하지 않음</p>
                ) : !hasCurrent ? (
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>가격 변동 있을 수 있음</p>
                ) : null}
              </div>

              {buyable ? (
                <CartAddButton listingId={it.listing_id} quantity={1} label="다시 담기" primary compact fullWidth />
              ) : (
                <button
                  type="button"
                  disabled
                  aria-label="다시 담기"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    background: '#f3f4f6',
                    color: '#9ca3af',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'not-allowed',
                    fontFamily: 'inherit',
                  }}
                >
                  다시 담기
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
