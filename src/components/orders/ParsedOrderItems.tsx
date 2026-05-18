import type { OrderParsedLine } from '@/types'

export default function ParsedOrderItems({
  items,
  showRepeatUnlinkedWarning,
}: {
  items: OrderParsedLine[]
  showRepeatUnlinkedWarning?: boolean
}) {
  if (items.length === 0) return null

  const hasUnlinked = items.some((line) => !line.ingredient_match)

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
        {'\uc8fc\ubb38 \uc778\uc2dd \uacb0\uacfc'}
      </div>

      {showRepeatUnlinkedWarning && hasUnlinked ? (
        <div
          style={{
            background: '#fff7ed',
            border: '1px solid #F97316',
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 10,
            fontSize: 12,
            fontWeight: 700,
            color: '#9a3412',
            lineHeight: 1.45,
          }}
        >
          {'\ubc18\ubcf5 \uc8fc\ubb38\ub418\uc9c0\ub9cc \uc544\uc9c1 \uc2dd\uc790\uc7ac \ub4f1\ub85d\uc774 \uc548 \ub41c \ud488\ubaa9\uc774 \uc788\uc5b4\uc694.'}
        </div>
      ) : null}

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
                  {line.raw_name} {'\u00b7'} {line.quantity_text}
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
                {linked ? '\uc2dd\uc790\uc7ac \uc5f0\uacb0\ub428' : '\ubbf8\uc5f0\uacb0'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
