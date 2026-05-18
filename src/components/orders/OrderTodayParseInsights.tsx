import type { TodayOrderParseInsights } from '@/lib/order-capture'

export default function OrderTodayParseInsights({
  insights,
}: {
  insights: TodayOrderParseInsights
}) {
  const hasRepeat = insights.repeat_unlinked.length > 0
  const hasTop = insights.recent_top_labels.length > 0
  const hasRepeatItems = insights.repeat_order_items.length > 0
  const hasCandidates = insights.registration_candidates.length > 0

  return (
    <section
      style={{
        background: '#ffffff',
        border: '0.5px solid #ece8df',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 10px' }}>
        {'\uc8fc\ubb38 \uc6b4\uc601'}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <Metric label={'\uc624\ub298 \uce74\uce74\uc624 \uc8fc\ubb38 \uc218'} value={insights.kakao_orders_today} />
        <Metric
          label={'\ubbf8\uc5f0\uacb0 \uc8fc\ubb38 \ud488\ubaa9 \uc218'}
          value={insights.unmatched_lines_today}
          accent="#F97316"
        />
        <Metric
          label={'\ubc18\ubcf5 \uc8fc\ubb38 \ud488\ubaa9 \uc218'}
          value={insights.repeat_order_item_distinct_count}
        />
        <Metric
          label={'\ubc1c\uc8fc \uc900\ube44 \ud544\uc694 \uc8fc\ubb38 \uc218'}
          value={insights.preparation_needed_order_count}
          accent="#6D28D9"
        />
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px' }}>
        {'\uc8fc\ubb38 \ud488\ubaa9 \uc778\uc0ac\uc774\ud2b8'}
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <Metric label={'\uc624\ub298 \uce74\uce74\uc624 \uc904 \uc218'} value={insights.kakao_line_count_today} />
        <Metric
          label={'\uc624\ub298 \ubbf8\uc5f0\uacb0 \ud488\ubaa9'}
          value={insights.unmatched_lines_today}
          accent="#F97316"
        />
      </div>

      {hasRepeatItems ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>
            {'\ucd5c\uadfc \ubc18\ubcf5 \uc8fc\ubb38 \ud488\ubaa9'}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
            {insights.repeat_order_items.map((row) => (
              <li key={row.label}>
                {row.label} ({row.count})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasTop ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>
            {'\ucd5c\uadfc \uc8fc\ubb38 \uc8fc\uc694 \ud488\ubaa9'}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
            {insights.recent_top_labels.map((row) => (
              <li key={row.label}>
                {row.label} ({row.count})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasCandidates ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>
            {'\ub4f1\ub85d \ucd94\ucc9c \uc2dd\uc790\uc7ac'}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
            {insights.registration_candidates.map((row) => (
              <li key={row.name}>
                {row.name} {'\u00b7'} {'\ucd5c\uadfc 7\uc77c'} {row.count}
                {'\ud68c'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasRepeat ? (
        <div
          style={{
            background: '#fffbeb',
            borderRadius: 12,
            padding: 10,
            border: '1px solid #FCD34D',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', marginBottom: 6 }}>
            {'\uc790\uc8fc \uc8fc\ubb38\ub418\uc9c0\ub9cc \ub4f1\ub85d\ub418\uc9c0 \uc54a\uc740 \uc2dd\uc790\uc7ac'}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#78350f', lineHeight: 1.45 }}>
            {insights.repeat_unlinked.map((row) => (
              <li key={row.name} style={{ marginBottom: 6 }}>
                {row.name} {'\u00b7'} {'\ucd5c\uadfc 7\uc77c'} {row.count}
                {'\ud68c \uc778\uc2dd'}
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#92400e', lineHeight: 1.4 }}>
                  {`\ucd5c\uadfc \uc8fc\ubb38\uc5d0 ${row.count}\ud68c \ub4f1\uc7a5\ud588\uc9c0\ub9cc \uc544\uc9c1 \uc2dd\uc790\uc7ac \ub4f1\ub85d\uc774 \uc548 \ub410\uc5b4\uc694.`}
                </p>
              </li>
            ))}
          </ul>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>
            {'\uc2dd\uc790\uc7ac \ub4f1\ub85d \ud6c4 \uc8fc\ubb38 \uc5f0\uacb0\ub960\uc744 \ub192\uc77c \uc218 \uc788\uc5b4\uc694.'}
          </p>
        </div>
      ) : null}

      <p style={{ fontSize: 11, color: '#9ca3af', margin: '12px 0 0', lineHeight: 1.45 }}>
        {
          '\uac70\ub798\uba85\uc138\uc11c OCR\uacfc \uce74\uce74\uc624 \uc8fc\ubb38\uc740 \uac19\uc740 \uc6b4\uc601 \ud750\ub984\uc73c\ub85c \uc313\uc785\ub2c8\ub2e4. \ubbf8\uc5f0\uacb0\uc740 \uc2dd\uc790\uc7ac \ub4f1\ub85d \ud6c4 \uc790\ub3d9\uc73c\ub85c \ub9de\ucdb0\uc838\uc694.'
        }
      </p>
    </section>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: string
}) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ?? '#1f5d3a' }}>{value}</div>
    </div>
  )
}
