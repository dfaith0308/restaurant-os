'use client'

import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import { KAKAO_CHANNEL_URL } from '@/lib/constants'

const ITEMS: Array<
  | { href: string; icon: string; label: string; desc: string; external?: false }
  | { href: string; icon: string; label: string; desc: string; external: true }
> = [
  {
    href: KAKAO_CHANNEL_URL,
    icon: '💬',
    label: '식자재 입력 대행 신청',
    desc: '전표 사진 보내주시면 직접 입력해드립니다',
    external: true,
  },
  { href: '/subscribe', icon: '⭐', label: '구독 관리', desc: '플랜 변경 및 구독 현황 확인' },
  { href: '/suppliers', icon: '🤝', label: '거래처 관리', desc: '거래처 정보와 가격을 관리합니다' },
  { href: '/money', icon: '💰', label: '돈관리', desc: '매출·원가·지출을 확인합니다' },
  { href: '/settings', icon: '⚙️', label: '설정', desc: '계정·알림·앱 설정' },
]

const itemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '16px 18px',
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  textDecoration: 'none',
} as const

export default function MoreClient() {
  async function handleSignOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 96px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: '0 0 20px' }}>더보기</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ITEMS.map((item) =>
          item.external ? (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              style={itemStyle}
            >
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' }}>{item.label}</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{item.desc}</p>
              </div>
              <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 16 }}>↗</span>
            </a>
          ) : (
            <Link key={item.href} href={item.href} style={itemStyle}>
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' }}>{item.label}</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{item.desc}</p>
              </div>
              <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 16 }}>›</span>
            </Link>
          ),
        )}
      </div>

      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f3f4f6' }}>
        <button
          type="button"
          onClick={handleSignOut}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '14px 18px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 12,
            color: '#DC2626',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          로그아웃
        </button>
      </div>
    </main>
  )
}
