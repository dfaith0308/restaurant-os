import type {
  ActiveSupplierRow,
  SupplierDependencyRow,
  SupplierPriceRiskView,
} from '@/lib/order-capture'

const sectionStyle = {
  background: '#ffffff',
  border: '0.5px solid #ece8df',
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
} as const

export default function SupplierRiskSection({
  priceRisks,
  activeSuppliers,
  dependencies,
}: {
  priceRisks: SupplierPriceRiskView[]
  activeSuppliers: ActiveSupplierRow[]
  dependencies: SupplierDependencyRow[]
}) {
  const hasPrice = priceRisks.length > 0
  const hasActive = activeSuppliers.length > 0
  const hasDep = dependencies.length > 0

  if (!hasPrice && !hasActive && !hasDep) return null

  return (
    <section style={sectionStyle}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 12px' }}>
        공급업체 운영 위험
      </h2>

      {hasPrice ? (
        <Block title="가격 위험 공급업체">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {priceRisks.map((row) => (
              <li
                key={row.supplier_name}
                style={{
                  padding: '10px 0',
                  borderTop: '1px solid #f3f4f6',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>
                  {row.supplier_name}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F97316', marginTop: 4 }}>
                  가격 변동 주의
                </div>
                {row.ingredients.length > 0 ? (
                  <>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: 1.45 }}>
                      {row.ingredients
                        .map((ing) => `${ing.name} +${ing.change_percent}%`)
                        .join(' · ')}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                      {`최근 30일 기준 ${row.ingredients[0].name} 공급가가 ${row.ingredients[0].change_percent}% 이상 변동됐어요.`}
                    </p>
                  </>
                ) : (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                    최근 거래명세서·OCR 기록에서 공급가 상승 흐름이 확인됐어요.
                  </p>
                )}
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>
                  공급업체 가격 흐름을 확인해보세요.
                </p>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {hasActive ? (
        <Block title="최근 활동 많은 공급업체">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {activeSuppliers.map((row) => (
              <li
                key={row.supplier_name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 0',
                  borderTop: '1px solid #f3f4f6',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                  {row.supplier_name}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {row.is_recently_active ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: '#ecfdf5',
                        color: '#1f5d3a',
                      }}
                    >
                      최근 거래 활발
                    </span>
                  ) : null}
                  <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                    {row.count}회
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {hasDep ? (
        <Block title="특정 업체 의존 식자재">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {dependencies.map((row) => (
              <li
                key={`${row.ingredient_name}-${row.supplier_name}`}
                style={{
                  padding: '10px 0',
                  borderTop: '1px solid #f3f4f6',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>
                  {row.ingredient_name}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 1.45 }}>
                  → {row.supplier_name} 의존 · OCR {row.ocr_count}회
                </div>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
    </section>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}
