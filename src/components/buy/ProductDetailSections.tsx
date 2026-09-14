import Link from 'next/link'
import type { ReactNode } from 'react'
import CopyTextButton from '@/components/buy/CopyTextButton'
import { DETAIL_SECTIONS, type BuyDetailPageView, type DetailSectionKey } from '@/lib/detail-template'

const BRAND = '#1f5d3a'
const INK = '#1a1a1a'
const BODY = '#374151'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'

function Section({
  sectionKey,
  action,
  children,
}: {
  sectionKey: DetailSectionKey
  action?: ReactNode
  children: ReactNode
}) {
  const meta = DETAIL_SECTIONS.find((s) => s.key === sectionKey)
  return (
    <section style={{ background: '#fff', borderRadius: 12, padding: '18px 18px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: INK, margin: 0, display: 'flex', gap: 8, alignItems: 'baseline' }}>
          {meta?.no ? <span style={{ fontSize: 12, fontWeight: 800, color: BRAND }}>{meta.no}</span> : null}
          {meta?.title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} style={{ borderTop: `1px solid ${LINE}` }}>
            <th style={{ textAlign: 'left', fontWeight: 500, color: MUTED, padding: '9px 8px 9px 0', width: 76, verticalAlign: 'top' }}>
              {r.label}
            </th>
            <td style={{ color: INK, padding: '9px 0', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** 옵션(규격) 칩 + 핵심 한 줄 — 첫 화면 제목 아래에 붙는다 */
export function ProductDetailHeaderExtra({ view }: { view: BuyDetailPageView }) {
  if (!view.headline && view.options.length === 0) return null
  return (
    <div style={{ marginBottom: 14 }}>
      {view.headline ? (
        <p style={{ fontSize: 14, fontWeight: 600, color: BRAND, margin: '0 0 10px', lineHeight: 1.5 }}>{view.headline}</p>
      ) : null}
      {view.options.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {view.options.map((o) =>
            o.current ? (
              <span
                key={o.listing_id}
                style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: `2px solid ${INK}`, color: INK }}
              >
                {o.spec_label}
              </span>
            ) : (
              <Link
                key={o.listing_id}
                href={`/buy/products/${o.listing_id}`}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                  border: `1px solid ${LINE}`,
                  color: o.sold_out ? '#9ca3af' : BODY,
                  textDecoration: o.sold_out ? 'line-through' : 'none',
                }}
              >
                {o.spec_label}
              </Link>
            ),
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * 새 상세페이지 방식(템플릿) 섹션 01~08.
 * **값이 없는 섹션은 제목까지 통째로 그리지 않는다** — 빈 제목만 남는 화면을 만들지 않는다.
 * 기존 상세 요소(핵심 포인트 카드·구매 옵션·상세 이미지)는 이 컴포넌트가 건드리지 않는다.
 */
export default function ProductDetailSections({ view }: { view: BuyDetailPageView }) {
  return (
    <div style={{ padding: '0 0 8px' }}>
      {view.why ? (
        <Section sectionKey="why" action={<CopyTextButton text={view.why.join('\n')} />}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {view.why.map((w, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 14, color: INK, lineHeight: 1.55 }}>
                <span style={{ color: BRAND, fontWeight: 800 }}>✓</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {view.fit ? (
        <Section sectionKey="fit">
          <Rows rows={view.fit} />
        </Section>
      ) : null}

      {view.story ? (
        <Section sectionKey="story">
          {view.story.points ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: view.story.body || view.story.images ? 12 : 0 }}>
              {view.story.points.map((p, i) => (
                <span key={i} style={{ fontSize: 12, fontWeight: 600, color: BRAND, background: '#f0f7f3', borderRadius: 999, padding: '5px 10px' }}>
                  {p}
                </span>
              ))}
            </div>
          ) : null}
          {view.story.body ? (
            <p style={{ fontSize: 14, color: BODY, margin: 0, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{view.story.body}</p>
          ) : null}
          {view.story.images ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: view.story.body ? 12 : 0 }}>
              {view.story.images.map((src, i) => (
                <img key={i} src={src} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 8 }} />
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      {view.menu ? (
        <Section sectionKey="menu">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {view.menu.map((m, i) => (
              <figure key={i} style={{ margin: 0 }}>
                {m.image_url ? (
                  <img src={m.image_url} alt={m.caption ?? ''} loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8 }} />
                ) : null}
                {m.caption ? (
                  <figcaption style={{ fontSize: 12, color: BODY, marginTop: 6, lineHeight: 1.45 }}>{m.caption}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </Section>
      ) : null}

      {view.price_table ? (
        <Section sectionKey="price_table">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 300 }}>
              <thead>
                <tr style={{ color: MUTED, fontSize: 12 }}>
                  <th style={{ textAlign: 'left', fontWeight: 500, padding: '0 6px 8px 0' }}>규격</th>
                  <th style={{ textAlign: 'right', fontWeight: 500, padding: '0 6px 8px' }}>1개</th>
                  <th style={{ textAlign: 'right', fontWeight: 500, padding: '0 0 8px 6px' }}>대량 구매</th>
                </tr>
              </thead>
              <tbody>
                {view.price_table.map((r) => (
                  <tr key={r.listing_id} style={{ borderTop: `1px solid ${LINE}`, color: r.sold_out ? '#9ca3af' : INK }}>
                    <td style={{ padding: '9px 6px 9px 0' }}>
                      {r.spec_label}
                      {r.sold_out ? ' (품절)' : ''}
                    </td>
                    <td style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 600 }}>{r.unit_price.toLocaleString('ko-KR')}원</td>
                    <td style={{ padding: '9px 0 9px 6px', textAlign: 'right', lineHeight: 1.45 }}>
                      {r.bulk ? (
                        <span>
                          {r.bulk.qty}개 이상 개당 <strong style={{ color: '#E8701C' }}>{r.bulk.unit_price.toLocaleString('ko-KR')}원</strong>
                        </span>
                      ) : (
                        <span style={{ color: MUTED }}>—</span>
                      )}
                      {r.free_shipping_qty ? (
                        <div style={{ fontSize: 11, color: BRAND }}>{r.free_shipping_qty}개 이상 무료배송</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>상품 등록 가격에서 자동으로 계산됩니다. 회원 할인 등 최종 금액은 장바구니에서 확인해 주세요.</p>
        </Section>
      ) : null}

      {view.order_guide && view.order_guide.length > 0 ? (
        <Section sectionKey="order_guide">
          <Rows rows={view.order_guide} />
        </Section>
      ) : null}

      {view.info ? (
        <Section
          sectionKey="info"
          action={<CopyTextButton label="표 복사" text={view.info.map((r) => `${r.label}\t${r.value.replace(/\s*\n\s*/g, ' ')}`).join('\n')} />}
        >
          <Rows rows={view.info} />
        </Section>
      ) : null}

      {view.faq ? (
        <Section sectionKey="faq">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {view.faq.map((f, i) => (
              <details key={i} style={{ borderTop: i ? `1px solid ${LINE}` : 'none', padding: '10px 0' }}>
                <summary style={{ fontSize: 14, fontWeight: 600, color: INK, cursor: 'pointer', lineHeight: 1.5 }}>{f.q}</summary>
                <p style={{ fontSize: 13, color: BODY, margin: '8px 0 0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  )
}
