'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase-browser'

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
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#F9FAFB', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: '#fff', borderRadius: 20, padding: '48px 32px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>⏳</div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 12px' }}>
          승인 대기 중입니다
        </h1>

        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px' }}>
          승인되면 바로 사용하실 수 있습니다
        </p>

        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>
          보통 하루 안에 승인됩니다
        </p>

        <div
          style={{
            padding: '14px 16px',
            background: '#F3F4F6',
            borderRadius: 12,
            marginBottom: 20,
            textAlign: 'left',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
            지금 바로 쓸 수 있는 기능
          </p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.55 }}>
            메뉴 입력, 원가 계산, 쇼핑몰은
            <br />
            지금 바로 사용 가능합니다.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link
              href="/settings/menus"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '11px 14px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-primary)',
                textDecoration: 'none',
              }}
            >
              메뉴 관리
            </Link>
            <Link
              href="/settings/ingredients"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '11px 14px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-primary)',
                textDecoration: 'none',
              }}
            >
              재료 · 원가
            </Link>
            <Link
              href="/buy"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '11px 14px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-primary)',
                textDecoration: 'none',
              }}
            >
              쇼핑몰
            </Link>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          style={{
            width: '100%', padding: '12px',
            background: 'transparent', border: '1px solid #e5e7eb',
            borderRadius: 10, fontSize: 13, color: '#6b7280',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
