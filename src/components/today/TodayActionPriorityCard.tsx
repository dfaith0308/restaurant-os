import Link from 'next/link'
import type { TodayActionPriorityView } from '@/lib/order-capture'

const cardStyle = {
  background: 'linear-gradient(180deg, #fff7ed 0%, #ffffff 48%)',
  border: '0.5px solid #FED7AA',
  borderRadius: 16,
  padding: '16px 14px',
  marginBottom: 16,
} as const

function toneColor(tone: 'danger' | 'warning' | 'normal'): string {
  if (tone === 'danger') return '#B91C1C'
  if (tone === 'warning') return '#C2410C'
  return '#374151'
}

export default function TodayActionPriorityCard({
  priority,
}: {
  priority: TodayActionPriorityView
}) {
  if (priority.items.length === 0) {
    return (
      <section style={cardStyle}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px' }}>
          {'\uc624\ub298 \uc6b4\uc601 \ud310\ub2e8'}
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
          {priority.summary}
        </p>
      </section>
    )
  }

  return (
    <section style={cardStyle}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#F97316', margin: '0 0 6px' }}>
        {'\uc624\ub298 \uba3c\uc800 \ud655\uc778\ud560 \uac83'}
      </p>
      <p
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--color-text)',
          margin: '0 0 12px',
          lineHeight: 1.45,
        }}
      >
        {priority.summary}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {priority.items.map((item, idx) => (
          <li
            key={`${item.kind}-${item.label}`}
            style={{
              padding: idx === 0 ? '0 0 10px' : '10px 0',
              borderTop: idx === 0 ? 'none' : '1px solid #f3f4f6',
            }}
          >
            <Link href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: toneColor(item.tone), marginBottom: 4 }}>
                {item.label}
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280', lineHeight: 1.45 }}>
                {item.why}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>
                {item.actionHint}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
