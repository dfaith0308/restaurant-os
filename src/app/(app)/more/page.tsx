import Link from 'next/link'

const ITEMS = [
  { href: '/subscribe', icon: '⭐', label: '구독 관리', desc: '플랜 변경 및 구독 현황 확인' },
  { href: '/suppliers', icon: '🤝', label: '거래처 관리', desc: '거래처 정보와 가격을 관리합니다' },
  { href: '/money', icon: '💰', label: '돈관리', desc: '매출·원가·지출을 확인합니다' },
  { href: '/settings', icon: '⚙️', label: '설정', desc: '계정·알림·앱 설정' },
]

export default function MorePage() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 96px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: '0 0 20px' }}>더보기</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 18px',
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 24 }}>{item.icon}</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' }}>{item.label}</p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{item.desc}</p>
            </div>
            <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 16 }}>›</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
