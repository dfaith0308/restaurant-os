import Link from 'next/link'
import type { TodayOperationHubData } from '@/actions/menus'
import type { TodayRiskFlowChain } from '@/lib/order-capture'

type Props = Pick<
  TodayOperationHubData,
  'top_risk_menus' | 'top_spike_ingredients' | 'recent_ocr'
> & {
  flowChains: TodayRiskFlowChain[]
}

const RISK_ORDER = { danger: 0, warning: 1, normal: 2 } as const

const panelStyle = {
  background: '#ffffff',
  border: '0.5px solid #ece8df',
  borderRadius: 16,
  padding: 14,
  marginBottom: 10,
} as const

function formatRelativeTimeShort(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diffMs = Date.now() - t
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '\ubc29\uae08 \uc804'
  if (minutes < 60) return `${minutes}\ubd84 \uc804`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}\uc2dc\uac04 \uc804`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}\uc77c \uc804`
  return new Date(iso).toLocaleDateString('ko-KR')
}

function riskTone(level: keyof typeof RISK_ORDER): { color: string; label: string } {
  if (level === 'danger') return { color: '#dc2626', label: '\uc704\ud5d8' }
  if (level === 'warning') return { color: '#F97316', label: '\uc8fc\uc758' }
  return { color: '#6b7280', label: '\ubcf4\ud1b5' }
}

function ActionHint({ children }: { children: string }) {
  return (
    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>{children}</p>
  )
}

export function TodayRiskSection(props: Props) {
  const sortedMenus = [...props.top_risk_menus].sort(
    (a, b) =>
      RISK_ORDER[a.operation_risk_level] - RISK_ORDER[b.operation_risk_level],
  )
  const sortedSpikes = [...props.top_spike_ingredients]

  return (
    <section style={{ marginBottom: 16 }}>
      <h2
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--color-text)',
          margin: '0 0 12px',
        }}
      >
        {'\uc6b4\uc601 \uc704\ud5d8 \uc0c1\ud669'}
      </h2>

      {props.flowChains.length > 0 ? (
        <div style={{ ...panelStyle, background: '#fafafa' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', marginBottom: 10 }}>
            {'\uc704\ud5d8 \ud750\ub984 \uc5f0\uacb0'}
          </div>
          {props.flowChains.map((chain) => (
            <div key={chain.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {chain.steps.map((step, idx) => (
                  <div key={`${chain.id}-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>
                      {idx === 0 ? '\u25cf' : '\u2193'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: idx === 0 ? 800 : 600, color: 'var(--color-text)' }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <ActionHint>{chain.actionHint}</ActionHint>
            </div>
          ))}
        </div>
      ) : null}

      <div style={panelStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
            {'\uc6d0\uac00\u00b7\ub9c8\uc9c4 \uc704\ud5d8 \uba54\ub274'}
          </span>
          <Link
            href="/settings/menus"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
          >
            {'\uba54\ub274 \uc124\uc815'}
          </Link>
        </div>
        {sortedMenus.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
            {'\uc9c0\uae08\uc740 \uc704\ud5d8 \ub2e8\uacc4\uc5d0 \uc788\ub294 \uba54\ub274\uac00 \uc5c6\uc5b4\uc694.'}
          </p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
            {sortedMenus.map((m) => {
              const tone = riskTone(m.operation_risk_level)
              return (
                <li key={m.id} style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{m.name}</span>
                  <span style={{ color: tone.color, fontWeight: 700, marginLeft: 6 }}>
                    {tone.label}
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                    {'\uc2dd\uc790\uc7ac \uacf5\uae09\uacfc \ud310\uc774 \ubc18\uc601\ub418\uc5b4 \uc6d0\uac00 \ubd80\ub2f4\uc774 \ucee4\uc84c\uc5b4\uc694.'}
                  </p>
                </li>
              )
            })}
          </ol>
        )}
        <ActionHint>{'\uba54\ub274 \uc6d0\uac00\uc640 \uc2dd\uc790\uc7ac \uad6c\uc131\uc744 \ud655\uc778\ud574\ubcf4\uc138\uc694.'}</ActionHint>
      </div>

      <div style={panelStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
            {'\uac00\uaca9 \uae09\ub4f1 \uc2dd\uc790\uc7ac'}
          </span>
          <Link
            href="/settings/ingredients"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
          >
            {'\uc2dd\uc790\uc7ac'}
          </Link>
        </div>
        {sortedSpikes.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
            {'\ucd5c\uadfc \uae09\ub4f1\uc73c\ub85c \uc7a1\ud78e \uc2dd\uc790\uc7ac\uac00 \uc5c6\uc5b4\uc694.'}
          </p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
            {sortedSpikes.map((row) => (
              <li key={row.ingredient_id} style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{row.name}</span>
                <span style={{ color: '#F97316', fontWeight: 700, marginLeft: 6 }}>
                  +{row.change_percent}%
                </span>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                  {`\ucd5c\uadfc 30\uc77c \ub3d9\uc548 \uacf5\uae09\uac00\uac00 ${row.change_percent}%\uc0c1\uc2b9\ud588\uc5b4\uc694.`}
                </p>
              </li>
            ))}
          </ol>
        )}
        <ActionHint>{'\uacf5\uae09\uc5c5\uccb4 \uac00\uaca9 \ud750\ub984\uc744 \ud655\uc778\ud574\ubcf4\uc138\uc694.'}</ActionHint>
      </div>

      <div style={panelStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>
          {'\ucd5c\uadfc \uac70\ub798\uba85\uc138\uc11c OCR'}
        </div>
        {props.recent_ocr.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
            {'\ucd5c\uadfc \uac70\ub798\uba85\uc138\uc11c OCR \ub4f1\ub85d \ub0b4\uc5ed\uc774 \uc5c6\uc5b4\uc694.'}
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
            {props.recent_ocr.map((entry, idx) => (
              <li key={`${entry.supplier_name}-${entry.ingredient_name}-${entry.occurred_at}-${idx}`}>
                {entry.supplier_name} {'\uac70\ub798\uba85\uc138\uc11c \ub4f1\ub85d'} ·{' '}
                {formatRelativeTimeShort(entry.occurred_at)}
              </li>
            ))}
          </ul>
        )}
        <ActionHint>
          {'\uac70\ub798\uba85\uc138\uc11c\ub294 \uac80\ud1a0 \ud6c4 \uc800\uc7a5\ub429\ub2c8\ub2e4. \uc790\ub3d9\uc73c\ub85c \ubc14\ub85c \ubc18\uc601\ub418\uc9c0 \uc54a\uc544\uc694.'}
        </ActionHint>
      </div>
    </section>
  )
}
