import Link from 'next/link'

interface Chip {
  label: string
  href?: string
  tone?: 'urgent' | 'normal'
}

interface Props {
  chips: Chip[]
}

// 하단 상태 strip — 메인 카드가 1개일 때 나머지 대기 중인 것들을 한 줄 요약
export default function TodayStrip({ chips }: Props) {
  if (chips.length === 0) return null
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      padding: '12px 4px 0',
    }}>
      {chips.map((c, i) => {
        const bg = c.tone === 'urgent' ? '#FEF2F2' : '#F3F4F6'
        const fg = c.tone === 'urgent' ? '#B91C1C' : '#374151'
        const content = (
          <span style={{
            display: 'inline-block',
            padding: '5px 11px',
            background: bg, color: fg,
            borderRadius: 20, fontSize: 12, fontWeight: 600,
            textDecoration: 'none',
          }}>
            {c.label}
          </span>
        )
        return c.href
          ? <Link key={i} href={c.href} style={{ textDecoration: 'none' }}>{content}</Link>
          : <span key={i}>{content}</span>
      })}
    </div>
  )
}
