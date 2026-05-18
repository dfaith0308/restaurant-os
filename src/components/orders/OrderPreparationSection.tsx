import type { OrderPreparationLineView, OrderPreparationSummary } from '@/lib/order-capture'
import OrderIngredientLinkCard from '@/components/orders/OrderIngredientLinkCard'

export default function OrderPreparationSection({
  summary,
  lineViews,
  showUnlinkedWarning,
}: {
  summary: OrderPreparationSummary
  lineViews: OrderPreparationLineView[]
  showUnlinkedWarning: boolean
}) {
  if (lineViews.length === 0) return null

  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #e5e7eb',
        padding: '14px 16px',
        marginBottom: 12,
      }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 12px' }}>
        발주 준비 상태
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <Stat label="연결된 식자재" value={summary.linked_count} tone="ok" />
        <Stat label="미연결" value={summary.unlinked_count} tone="warn" />
        <Stat label="발주 준비 품목" value={summary.preparation_item_count} tone="neutral" />
      </div>

      {showUnlinkedWarning ? (
        <div
          style={{
            background: '#fff7ed',
            border: '1px solid #F97316',
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 12,
            fontSize: 12,
            fontWeight: 700,
            color: '#9a3412',
            lineHeight: 1.45,
          }}
        >
          반복 주문되지만 아직 식자재 등록이 안 된 품목이 있어요.
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lineViews.map((view, idx) => (
          <OrderIngredientLinkCard
            key={`${view.line.raw_name}-${view.line.quantity_text}-${idx}`}
            view={view}
          />
        ))}
      </div>

      <p style={{ fontSize: 11, color: '#9ca3af', margin: '12px 0 0', lineHeight: 1.45 }}>
        주문 흐름은 식자재·공급업체 운영 데이터와 연결돼요.
      </p>
    </section>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'ok' | 'warn' | 'neutral'
}) {
  const color =
    tone === 'ok' ? '#1f5d3a' : tone === 'warn' ? '#F97316' : 'var(--color-text)'
  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}
