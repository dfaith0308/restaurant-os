'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase-browser'

const contactRowStyle = {
  display: 'flex',
  alignItems: 'center' as const,
  gap: 12,
  padding: '14px 16px',
  borderRadius: 14,
  textDecoration: 'none',
  marginBottom: 10,
}

const greenActionLinkStyle = {
  display: 'block',
  textAlign: 'center' as const,
  background: 'rgba(255,255,255,0.12)',
  border: '0.5px solid rgba(255,255,255,0.2)',
  borderRadius: 10,
  padding: '13px 16px',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
}

export default function PendingClient() {
  const router = useRouter()

  useEffect(() => {
    // 3초마다 승인 여부 polling (users → tenants 조인)
    const supabase = createBrowserSupabase()
    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('users')
        .select('tenant_id, tenants(is_approved)')
        .eq('id', user.id)
        .maybeSingle()

      const rawTenant = data?.tenants
      const tenant = (Array.isArray(rawTenant) ? rawTenant[0] : rawTenant) as { is_approved: boolean } | null
      if (tenant?.is_approved) {
        clearInterval(interval)
        router.replace('/today')
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [router])

  async function handleSignOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f6f2',
        padding: '32px 24px 40px',
        fontFamily: 'inherit',
      }}
    >
      <img
        src="/logo.png"
        alt="식식이OS"
        style={{
          height: 44,
          width: 'auto',
          objectFit: 'contain',
          marginBottom: 32,
        }}
        onError={e => {
          e.currentTarget.style.display = 'none'
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#ffffff',
          borderRadius: 24,
          padding: '36px 28px 28px',
          border: '0.5px solid #e8e5de',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#edf7f1',
            color: '#1f5d3a',
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#1f5d3a',
              flexShrink: 0,
            }}
          />
          검토 중
        </div>

        <h1
          style={{
            fontSize: 26,
            fontWeight: 500,
            color: '#2b2b2b',
            letterSpacing: '-0.5px',
            lineHeight: 1.35,
            margin: '0 0 10px',
          }}
        >
          담당자가 곧 안내드리겠습니다
        </h1>

        <p
          style={{
            fontSize: 14,
            color: '#6b6b6b',
            lineHeight: 1.55,
            margin: '0 0 24px',
          }}
        >
          담당자 안내 후 공급자 연결,
          <br />
          발주, 정산 기능을 사용하실 수 있습니다
        </p>

        <div
          style={{
            height: 1,
            background: '#ebe8e1',
            marginBottom: 20,
          }}
        />

        <p
          style={{
            fontSize: 14,
            color: '#2b2b2b',
            fontWeight: 500,
            margin: '0 0 12px',
          }}
        >
          더 빠른 시작을 원하시면
        </p>

        <a
          href="tel:01049456662"
          style={{
            ...contactRowStyle,
            background: '#fff8f3',
            border: '1px solid #ffe4cc',
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#F97316',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.85 21 3 13.15 3 3a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"
                fill="#ffffff"
              />
            </svg>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                color: '#F97316',
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1.3,
              }}
            >
              010-4945-6662
            </span>
            <span style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
              전화 연결
            </span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
            <path d="M9 6l6 6-6 6" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        <a
          href="sms:01049456662"
          style={{
            ...contactRowStyle,
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M20 2H4a2 2 0 00-2 2v12a2 2 0 002 2h3l4 4 4-4h5a2 2 0 002-2V4a2 2 0 00-2-2z"
                fill="#ffffff"
              />
            </svg>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                color: '#3b82f6',
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1.3,
              }}
            >
              010-4945-6662
            </span>
            <span style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
              문자 보내기
            </span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
            <path d="M9 6l6 6-6 6" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        <a
          href="http://pf.kakao.com/_IMXeK/chat"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 14,
            textDecoration: 'none',
            marginBottom: 24,
            background: '#fffde8',
            border: '1px solid #f5e642',
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#FAE100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="18" viewBox="0 0 24 22" fill="none" aria-hidden>
              <path
                d="M12 2C6.48 2 2 5.58 2 10.02c0 2.91 1.92 5.47 4.84 6.96L5.5 21l4.28-2.35c.7.1 1.42.15 2.22.15 5.52 0 10-3.58 10-8.02S17.52 2 12 2z"
                fill="#3A1D1D"
              />
            </svg>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                color: '#5a4a00',
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1.3,
              }}
            >
              카카오톡 상담
            </span>
            <span style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
              채널 채팅으로 연결
            </span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
            <path d="M9 6l6 6-6 6" stroke="#b8a200" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        <div
          style={{
            background: '#1f5d3a',
            borderRadius: 18,
            padding: '20px 20px 16px',
          }}
        >
          <p
            style={{
              fontSize: 14,
              color: '#ffffff',
              fontWeight: 600,
              margin: '0 0 8px',
            }}
          >
            지금 바로 사용 가능
          </p>
          <p
            style={{
              fontSize: 14,
              color: '#ffffff',
              fontWeight: 500,
              lineHeight: 1.55,
              margin: '0 0 16px',
            }}
          >
            메뉴 입력부터 원가 계산,
            <br />
            쇼핑몰 구매까지 시작하세요
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/settings/menus" style={greenActionLinkStyle}>
              메뉴 원가 자동 계산
            </Link>
            <Link href="/settings/ingredients" style={greenActionLinkStyle}>
              현재 사용 식자재 등록
            </Link>
            <Link href="/buy" style={greenActionLinkStyle}>
              쇼핑몰
            </Link>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        style={{
          background: 'transparent',
          border: 'none',
          fontSize: 13,
          color: '#b0b0b0',
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: '8px 12px',
        }}
      >
        로그아웃
      </button>
    </div>
  )
}
