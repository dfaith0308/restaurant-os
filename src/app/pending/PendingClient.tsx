'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase-browser'

const actionLinkStyle = {
  display: 'block',
  textAlign: 'center' as const,
  background: '#F97316',
  color: '#ffffff',
  border: 'none',
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 14,
  padding: '13px 16px',
  textDecoration: 'none',
  boxShadow: '0 4px 14px rgba(249,115,22,0.25)',
  transition: 'opacity 0.15s ease',
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
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f6f2',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#ffffff',
          borderRadius: 24,
          padding: '48px 32px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.10)',
          textAlign: 'center',
        }}
      >
        <img
          src="/logo.png"
          alt="식식이OS"
          style={{
            height: 56,
            width: 'auto',
            objectFit: 'contain',
            marginBottom: 24,
          }}
          onError={e => {
            e.currentTarget.style.display = 'none'
          }}
        />

        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#2b2b2b',
            lineHeight: 1.3,
            margin: '0 0 12px',
          }}
        >
          담당자가 곧 안내드리겠습니다
        </h1>

        <p
          style={{
            fontSize: 16,
            color: '#2b2b2b',
            fontWeight: 500,
            margin: '0 0 10px',
            lineHeight: 1.5,
          }}
        >
          담당자 안내 후
          <br />
          더 많은 것을 사용하실 수 있습니다
        </p>

        <p
          style={{
            fontSize: 15,
            color: '#2b2b2b',
            fontWeight: 500,
            margin: '0 0 24px',
            lineHeight: 1.55,
          }}
        >
          더 빨리 사용하고 싶으시면
          <br />
          <a
            href="tel:01049456662"
            style={{
              color: '#F97316',
              fontWeight: 800,
              fontSize: 16,
              textDecoration: 'none',
            }}
          >
            010-4945-6662
          </a>
          로 연락주세요
        </p>

        <div
          style={{
            background: '#1f5d3a',
            borderRadius: 18,
            padding: '18px 20px',
            color: '#f7f6f2',
            marginBottom: 24,
            textAlign: 'left',
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#ffffff',
              margin: '0 0 8px',
            }}
          >
            지금 바로 쓸 수 있는 기능
          </p>
          <p
            style={{
              fontSize: 13,
              color: '#d1fae5',
              margin: '0 0 16px',
              lineHeight: 1.55,
            }}
          >
            메뉴 입력, 원가 계산, 쇼핑몰은
            <br />
            지금 바로 사용 가능합니다.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link
              href="/settings/menus"
              style={actionLinkStyle}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.88'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              메뉴 관리
            </Link>
            <Link
              href="/settings/ingredients"
              style={actionLinkStyle}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.88'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              재료 · 원가
            </Link>
            <Link
              href="/buy"
              style={actionLinkStyle}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.88'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              쇼핑몰
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          style={{
            width: '100%',
            padding: '12px',
            background: 'transparent',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            fontSize: 13,
            color: '#9ca3af',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}