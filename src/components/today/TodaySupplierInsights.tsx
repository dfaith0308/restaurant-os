import type { TodaySupplierOperationInsights } from '@/lib/order-capture'

const cardStyle = {
  background: '#ffffff',
  border: '0.5px solid #ece8df',
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
} as const

export default function TodaySupplierInsights({
  insights,
}: {
  insights: TodaySupplierOperationInsights
}) {
  const { summary } = insights
  const hasFlows =
    insights.top_combined.length > 0 ||
    insights.top_ocr.length > 0 ||
    insights.top_order_linked.length > 0
  const hasAny =
    summary.active_supplier_count > 0 ||
    summary.price_risk_supplier_count > 0 ||
    summary.repeat_connection_supplier_count > 0 ||
    summary.dependency_ingredient_count > 0 ||
    hasFlows

  if (!hasAny) return null

  return (
    <section style={cardStyle}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px' }}>
        공급업체 운영
      </h2>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px', lineHeight: 1.45 }}>
        최근 거래 흐름과 공급가 변화를 기준으로 운영 흐름을 보여드려요.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <SummaryMetric label="최근 활동 공급업체" value={summary.active_supplier_count} />
        <SummaryMetric
          label="가격 위험 업체"
          value={summary.price_risk_supplier_count}
          accent="#F97316"
        />
        <SummaryMetric
          label="반복 연결 업체"
          value={summary.repeat_connection_supplier_count}
          accent="#6D28D9"
        />
        <SummaryMetric
          label="업체 의존 식자재"
          value={summary.dependency_ingredient_count}
          accent="#2563eb"
        />
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 10px' }}>
        최근 공급업체 흐름
      </h3>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px', lineHeight: 1.45 }}>
        최근 30일 OCR과 주문 흐름을 합쳐 봤어요.
      </p>

      {insights.top_combined.length > 0 ? (
        <FlowBlock
          title="가장 많이 등장한 공급업체"
          rows={insights.top_combined}
          accent="#1f5d3a"
        />
      ) : null}

      {insights.top_ocr.length > 0 ? (
        <FlowBlock title="OCR 거래가 많은 업체" rows={insights.top_ocr} accent="#2563eb" />
      ) : null}

      {insights.top_order_linked.length > 0 ? (
        <FlowBlock
          title="주문 연결이 많은 업체"
          rows={insights.top_order_linked}
          accent="#6D28D9"
        />
      ) : null}
    </section>
  )
}

function SummaryMetric({
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

function FlowBlock({
  title,
  rows,
  accent,
}: {
  title: string
  rows: { supplier_name: string; count: number }[]
  accent: string
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>
        {title}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {rows.map((row, idx) => (
          <li
            key={row.supplier_name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderTop: idx === 0 ? 'none' : '1px solid #f3f4f6',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
              {row.supplier_name}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: accent,
                background: '#f9fafb',
                padding: '3px 8px',
                borderRadius: 999,
              }}
            >
              {row.count}회
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
