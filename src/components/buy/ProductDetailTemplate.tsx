interface Props {
  productName: string
  brandName?: string | null
  spec?: string | null
  manufacturer?: string | null
  usageDesc?: string | null
  aiStrengths?: string | null
  aiUsage?: string | null
  aiSummary?: string | null
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
  spec,
  aiStrengths,
  aiUsage,
  aiSummary,
  price,
}: Props) {
  const grams = parseWeightGrams(spec)
  const pricePerHundredG = grams && grams > 0 ? Math.round((price / grams) * 100) : null

  const hasAiContent = Boolean(aiSummary || aiStrengths || aiUsage)

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

      <div style={{ padding: '20px 28px' }}>
        {pricePerHundredG && (
          <div
            style={{
              padding: '16px 20px',
              background: '#f0f7f3',
              borderRadius: 10,
              border: '1px solid #bbf7d0',
              marginBottom: 12,
            }}
          >
            <p style={{ fontSize: 12, color: '#1f5d3a', fontWeight: 500, margin: '0 0 4px', letterSpacing: '.04em' }}>
              100g당 단가
            </p>
            <p style={{ fontSize: 28, fontWeight: 500, color: '#1f5d3a', margin: 0, lineHeight: 1 }}>
              {pricePerHundredG.toLocaleString()}원
            </p>
          </div>
        )}

        {aiSummary && (
          <div style={{ padding: '16px 20px', background: '#1f5d3a', borderRadius: 10, marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '0 0 4px', letterSpacing: '.04em' }}>
              식식이 한줄평
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.6 }}>{aiSummary}</p>
          </div>
        )}

        {aiStrengths && (
          <div
            style={{
              padding: '16px 20px',
              background: '#f0f7f3',
              borderRadius: 10,
              border: '1px solid #bbf7d0',
              marginBottom: 12,
            }}
          >
            <p style={{ fontSize: 11, color: '#1f5d3a', fontWeight: 700, margin: '0 0 8px', letterSpacing: '.04em' }}>
              🔬 원재료 분석 리포트
            </p>
            <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.8 }}>{aiStrengths}</p>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 0', textAlign: 'right' }}>
              ※ 원재료명 및 함량 기반 분석
            </p>
          </div>
        )}

        {aiUsage && (
          <div style={{ padding: '14px 20px', background: '#f7f6f2', borderRadius: 10, border: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, margin: '0 0 6px', letterSpacing: '.04em' }}>
              이런 메뉴에 쓰세요
            </p>
            <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.7 }}>{aiUsage}</p>
          </div>
        )}

        {!hasAiContent && !pricePerHundredG && (
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>상품 정보를 입력하면 여기에 표시됩니다</p>
        )}
      </div>
    </div>
  )
}
