import Link from 'next/link'
import type { OrderRecentActivityItem } from '@/lib/order-capture'

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

export default function RecentOrderActivity({
  items,
  heading = '최근 주문 활동',
  compact = false,
}: {
  items: OrderRecentActivityItem[]
  heading?: string
  compact?: boolean
}) {
  if (items.length === 0) return null

  return (
    <section
      style={{
        background: '#ffffff',
        border: '0.5px solid #ece8df',
        borderRadius: 16,
        padding: compact ? 12 : 14,
        marginBottom: compact ? 10 : 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <h2 style={{ fontSize: compact ? 13 : 14, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
          {heading}
        </h2>
        <Link
          href="/orders"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-primary)',
            textDecoration: 'none',
          }}
        >
          전체 보기
        </Link>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((row, idx) => (
          <li
            key={row.id}
            style={{
              padding: '10px 0',
              borderTop: idx === 0 ? 'none' : '1px solid #f3f4f6',
              fontSize: compact ? 12 : 13,
              color: '#374151',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{row.counterparty_name}</div>
            <div style={{ color: '#6b7280', marginTop: 2 }}>
              {row.source_label} · {formatRelativeTimeShort(row.created_at)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
