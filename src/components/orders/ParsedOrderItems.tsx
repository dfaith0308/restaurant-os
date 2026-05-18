import type { OrderParsedLine } from '@/types'

export default function ParsedOrderItems({ items }: { items: OrderParsedLine[] }) {
  if (items.length === 0) return null

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #e5e7eb',
        padding: '14px 16px',
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)', marginBottom: 10 }}>
        주문 인식 결과
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((line, idx) => {
          const linked = !!line.ingredient_match
          return (
            <li
              key={`${line.raw_name}-${line.quantity_text}-${idx}`}
              style={{
                padding: '10px 0',
                borderTop: idx === 0 ? 'none' : '1px solid #f3f4f6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>
                  {line.normalized_name}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {line.raw_name} · {line.quantity_text}
                </div>
              </div>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: linked ? '#ecfdf5' : '#f3f4f6',
                  color: linked ? '#1f5d3a' : '#9ca3af',
                }}
              >
                {linked ? '식자재 연결됨' : '미연결'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
