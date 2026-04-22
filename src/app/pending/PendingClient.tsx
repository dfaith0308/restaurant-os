'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase-browser'

export default function PendingClient() {
  const router = useRouter()

  useEffect(() => {
    // 3초마다 승인 여부 polling
    const supabase = createBrowserSupabase()
    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('restaurants')
        .select('is_approved')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (data?.is_approved) {
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

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>
          승인 대기 중입니다
        </h1>

        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px' }}>
          승인되면 바로 사용하실 수 있습니다
        </p>

        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 32px' }}>
          보통 하루 안에 승인됩니다
        </p>

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
