interface Props {
  productName: string
  brandName?: string | null
  spec?: string | null
  manufacturer?: string | null
  usageDesc?: string | null
  aiStrengths?: string | null
  ingredients?: string | null
  price: number
  weightGrams?: number | null
}

function parseWeightGrams(spec?: string | null): number | null {
  if (!spec) return null
  const kg = spec.match(/(\d+(?:\.\d+)?)\s*kg/i)
  if (kg) return Math.round(parseFloat(kg[1]) * 1000)
  const g = spec.match(/(\d+(?:\.\d+)?)\s*g/i)
  if (g) return Math.round(parseFloat(g[1]))
  return null
}

export default function ProductDetailTemplate({
  productName,
  brandName,
  spec,
  usageDesc,
  aiStrengths,
  price,
}: Props) {
  const grams = parseWeightGrams(spec)
  const pricePerHundredG = grams && grams > 0 ? Math.round((price / grams) * 100) : null

  const strengths = aiStrengths ? aiStrengths.split('\n').filter(Boolean) : []

  const usageList = usageDesc ? usageDesc.split(/[,·]/).map((s) => s.trim()).filter(Boolean) : []

  return (
    <div
      style={{
        width: '100%',
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
      }}
    >
      <div style={{ background: '#f7f6f2', padding: '24px 28px', borderBottom: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', letterSpacing: '.04em' }}>바쁜 사장님을 위한</p>
        <p style={{ fontSize: 36, fontWeight: 500, color: '#1a1a1a', margin: 0, lineHeight: 1.1 }}>
          핵심 <span style={{ color: '#1f5d3a' }}>포인트!</span>
        </p>
      </div>

      <div
        style={{
          background: '#1f5d3a',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <p style={{ fontSize: 20, fontWeight: 500, color: '#fff', margin: 0 }}>
          {brandName ? `${brandName} ` : ''}
          {productName}
        </p>
        {spec && (
          <span
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: 13,
              padding: '4px 14px',
              borderRadius: 20,
            }}
          >
            {spec}
          </span>
        )}
      </div>

      <div
        style={{
          padding: '24px 28px',
          display: 'grid',
          gridTemplateColumns: pricePerHundredG || usageList.length > 0 ? '1fr 1fr' : '1fr',
          gap: 28,
        }}
      >
        {(pricePerHundredG || usageList.length > 0) && (
          <div>
            {pricePerHundredG && (
              <div
                style={{
                  padding: '18px 20px',
                  background: '#f0f7f3',
                  borderRadius: 10,
                  border: '1px solid #bbf7d0',
                  marginBottom: 20,
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: '#1f5d3a',
                    fontWeight: 500,
                    margin: '0 0 4px',
                    letterSpacing: '.04em',
                  }}
                >
                  100g당 단가
                </p>
                <p style={{ fontSize: 32, fontWeight: 500, color: '#1f5d3a', margin: 0, lineHeight: 1 }}>
                  {pricePerHundredG.toLocaleString()}원
                </p>
              </div>
            )}

            {usageList.length > 0 && (
              <>
                <p
                  style={{
                    fontSize: 11,
                    color: '#6b7280',
                    fontWeight: 500,
                    margin: '0 0 10px',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  이런 메뉴에 쓰세요
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {usageList.slice(0, 3).map((u, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        background: '#f7f6f2',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <span style={{ color: '#1f5d3a', fontSize: 15, fontWeight: 500 }}>✓</span>
                      <p style={{ fontSize: 14, color: '#1a1a1a', margin: 0, fontWeight: 500 }}>{u}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {strengths.length > 0 && (
          <div>
            <p
              style={{
                fontSize: 11,
                color: '#6b7280',
                fontWeight: 500,
                margin: '0 0 12px',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}
            >
              이 제품의 강점
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {strengths.slice(0, 3).map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: '16px 18px',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      background: '#f0f7f3',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: '#1f5d3a', fontSize: 14, fontWeight: 500 }}>✓</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a', margin: 0, lineHeight: 1.5 }}>{s}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {strengths.length === 0 && usageList.length === 0 && !pricePerHundredG && (
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>상품 정보를 입력하면 여기에 표시됩니다</p>
        )}
      </div>
    </div>
  )
}
