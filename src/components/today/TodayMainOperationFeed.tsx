import Link from 'next/link'
import type { OperationFeedItem, OperationFeedTone } from '@/lib/order-capture'
import TodayTrustNotice from '@/components/today/TodayTrustNotice'

const cardStyle = {
  background: '#ffffff',
  border: '0.5px solid #ece8df',
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
} as const

function toneStyle(tone: OperationFeedTone): {
  border: string
  bg: string
  title: string
  badge: string
  badgeBg: string
} {
  if (tone === 'danger') {
    return {
      border: '#FCA5A5',
      bg: '#FFF1F2',
      title: '#B91C1C',
      badge: '#B91C1C',
      badgeBg: '#FEE2E2',
    }
  }
  if (tone === 'warning') {
    return {
      border: '#FED7AA',
      bg: '#FFF7ED',
      title: '#9A3412',
      badge: '#C2410C',
      badgeBg: '#FFEDD5',
    }
  }
  return {
    border: '#f3f4f6',
    bg: '#fafafa',
    title: 'var(--color-text)',
    badge: '#6b7280',
    badgeBg: '#f3f4f6',
  }
}

function formatRelativeTimeShort(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diffMs = Date.now() - t
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return new Date(iso).toLocaleDateString('ko-KR')
}

function toneLabel(tone: OperationFeedTone): string {
  if (tone === 'danger') return '긴급'
  if (tone === 'warning') return '주의'
  return '활동'
}

export default function TodayMainOperationFeed({
  items,
}: {
  items: OperationFeedItem[]
}) {
  if (items.length === 0) return null

  return (
    <section style={cardStyle}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px' }}>
        운영 메인 피드
      </h2>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px', lineHeight: 1.45 }}>
        최근 7일 OCR·주문·가격·공급 흐름을 시간순으로 모았어요.
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((item, idx) => {
          const tone = toneStyle(item.tone)
          const inner = (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${tone.border}`,
                background: tone.bg,
                borderTop: idx === 0 ? undefined : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: item.subtitle ? 4 : 0,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: tone.title, lineHeight: 1.35 }}>
                  {item.title}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: tone.badgeBg,
                      color: tone.badge,
                    }}
                  >
                    {toneLabel(item.tone)}
                  </span>
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>
                    {formatRelativeTimeShort(item.occurred_at)}
                  </span>
                </span>
              </div>
              {item.subtitle ? (
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{item.subtitle}</p>
              ) : null}
            </div>
          )

          return (
            <li key={item.id} style={{ marginBottom: idx === items.length - 1 ? 0 : 8 }}>
              {item.href ? (
                <Link href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          )
        })}
      </ul>
      <TodayTrustNotice />
    </section>
  )
}
