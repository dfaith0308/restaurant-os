import Link from 'next/link'
import type { TodayOperationHubData } from '@/actions/menus'

type Props = Pick<
  TodayOperationHubData,
  'top_risk_menus' | 'top_spike_ingredients' | 'recent_ocr'
>

const RISK_ORDER = { danger: 0, warning: 1, normal: 2 } as const

function formatRelativeTimeShort(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diffMs = Date.now() - t
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return new Date(iso).toLocaleDateString('ko-KR')
}

function riskTone(level: keyof typeof RISK_ORDER): { color: string; label: string } {
  if (level === 'danger') return { color: '#dc2626', label: '위험' }
  if (level === 'warning') return { color: '#F97316', label: '주의' }
  return { color: '#6b7280', label: '보통' }
}

export function TodayRiskSection(props: Props) {
  const sortedMenus = [...props.top_risk_menus].sort(
    (a, b) =>
      RISK_ORDER[a.operation_risk_level] - RISK_ORDER[b.operation_risk_level],
  )
  const sortedSpikes = [...props.top_spike_ingredients]

  return (
    <section style={{ marginBottom: 20 }}>
      <h2
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--color-text)',
          margin: '0 0 12px',
        }}
      >
        오늘 집중 확인
      </h2>

      <div
        style={{
          background: '#ffffff',
          border: '0.5px solid #ece8df',
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
            원가·마진 위험 메뉴 TOP 5
          </span>
          <Link
            href="/settings/menus"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
          >
            메뉴 설정
          </Link>
        </div>
        {sortedMenus.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
            지금은 위험 단계에 있는 메뉴가 없어요.
          </p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
            {sortedMenus.map((m) => {
              const tone = riskTone(m.operation_risk_level)
              return (
                <li key={m.id} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{m.name}</span>
                  <span style={{ color: tone.color, fontWeight: 700, marginLeft: 6 }}>
                    {tone.label}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div
        style={{
          background: '#ffffff',
          border: '0.5px solid #ece8df',
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
            최근 급등 식자재 TOP 5
          </span>
          <Link
            href="/settings/ingredients"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
          >
            식자재
          </Link>
        </div>
        {sortedSpikes.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
            최근 급등으로 잡힌 식자재가 없어요.
          </p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
            {sortedSpikes.map((row) => (
              <li key={row.ingredient_id} style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{row.name}</span>
                <span style={{ color: '#F97316', fontWeight: 700, marginLeft: 6 }}>
                  +{row.change_percent}%
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div
        style={{
          background: '#ffffff',
          border: '0.5px solid #ece8df',
          borderRadius: 16,
          padding: 14,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>
          최근 OCR 활동
        </div>
        {props.recent_ocr.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
            최근 거래명세서 OCR 등록 내역이 없어요.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
            {props.recent_ocr.map((entry, idx) => (
              <li key={`${entry.supplier_name}-${entry.ingredient_name}-${entry.occurred_at}-${idx}`}>
                {entry.supplier_name} 거래명세서 등록 · {formatRelativeTimeShort(entry.occurred_at)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
