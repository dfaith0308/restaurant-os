import type { CSSProperties } from 'react'
import type { TodayOperationHubData } from '@/actions/menus'

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '0.5px solid #ece8df',
  borderRadius: 16,
  padding: 14,
}

const valueStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#1f5d3a',
}

export function TodayOperationInsights(
  props: Pick<
    TodayOperationHubData,
    | 'risk_menu_count'
    | 'spike_ingredient_count'
    | 'ocr_recent_count'
    | 'avg_margin_rate'
  >,
) {
  const marginLabel =
    props.avg_margin_rate == null ? '—' : `${props.avg_margin_rate}%`

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
        marginBottom: 16,
      }}
    >
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
          오늘 위험 메뉴
        </div>
        <div style={valueStyle}>{props.risk_menu_count}</div>
      </div>
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
          최근 급등 식자재
        </div>
        <div style={valueStyle}>{props.spike_ingredient_count}</div>
      </div>
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
          최근 OCR 등록
        </div>
        <div style={valueStyle}>{props.ocr_recent_count}</div>
      </div>
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
          평균 예상 마진율
        </div>
        <div style={valueStyle}>{marginLabel}</div>
      </div>
    </div>
  )
}
