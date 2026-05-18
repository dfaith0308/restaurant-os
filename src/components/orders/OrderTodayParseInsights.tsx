import type { TodayOrderParseInsights } from '@/lib/order-capture'

export default function OrderTodayParseInsights({
  insights,
}: {
  insights: TodayOrderParseInsights
}) {
  const hasRepeat = insights.repeat_unlinked.length > 0
  const hasTop = insights.recent_top_labels.length > 0

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
        주문 품목 인사이트
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>오늘 카카오 줄 수</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1f5d3a' }}>
            {insights.kakao_line_count_today}
          </div>
        </div>
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>오늘 미연결 품목</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#F97316' }}>
            {insights.unmatched_lines_today}
          </div>
        </div>
      </div>

      {hasTop ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>
            최근 주문 주요 품목
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
            자주 주문되지만 등록되지 않은 식자재
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#78350f', lineHeight: 1.45 }}>
            {insights.repeat_unlinked.map((row) => (
              <li key={row.name}>
                {row.name} · 최근 7일 {row.count}회 인식
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p style={{ fontSize: 11, color: '#9ca3af', margin: '12px 0 0', lineHeight: 1.45 }}>
        거래명세서 OCR과 카카오 주문은 같은 운영 흐름으로 쌓입니다. 미연결은 식자재 등록 후 자동으로
        맞춰져요.
      </p>
    </section>
  )
}
