import type { OrderPreparationLineView } from '@/lib/order-capture'

export default function OrderIngredientLinkCard({
  view,
}: {
  view: OrderPreparationLineView
}) {
  const { line, recent_supplier, is_repeat_unlinked } = view
  const linked = !!line.ingredient_match

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 12,
        border: is_repeat_unlinked ? '1px solid #F97316' : '1px solid #f3f4f6',
        background: is_repeat_unlinked ? '#fff7ed' : '#fafafa',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>
            {line.normalized_name}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {line.quantity_text}
            {line.ingredient_match ? ` \u00b7 ${line.ingredient_match}` : ''}
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
      </div>
      {recent_supplier ? (
        <div style={{ fontSize: 12, color: '#374151', marginTop: 6, fontWeight: 600 }}>
          {'\ucd5c\uadfc \uacf5\uae09\uc5c5\uccb4: '}
          {recent_supplier}
        </div>
      ) : linked ? (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
          {'\ucd5c\uadfc \uacf5\uae09\uc5c5\uccb4 \uae30\ub85d\uc774 \uc544\uc9c1 \uc5c6\uc5b4\uc694'}
        </div>
      ) : null}
    </div>
  )
}
