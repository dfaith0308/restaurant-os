'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase-browser'

type Mode = 'login' | 'signup'

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  border: '1.5px solid #e5e7eb', borderRadius: 10,
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', background: '#fff',
}

const BTN: React.CSSProperties = {
  width: '100%', padding: '14px',
  border: 'none', borderRadius: 12,
  fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
  cursor: 'pointer',
}

export default function LoginPage() {
  const router = useRouter()

  const [mode,      setMode]     = useState<Mode>('login')
  const [email,     setEmail]    = useState('')
  const [password,  setPassword] = useState('')
  const [storeName, setStoreName] = useState('')
  const [loading,   setLoading]  = useState(false)
  const [error,     setError]    = useState<string | null>(null)
  const [done,      setDone]     = useState(false)   // 회원가입 완료

  const isReady = email.trim() && password.length >= 6 &&
    (mode === 'login' || storeName.trim())

  async function handleSubmit() {
    if (!isReady || loading) return
    setLoading(true)
    setError(null)

    const supabase = createBrowserSupabase()

    if (mode === 'signup') {
      // 1. 회원가입
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (signUpErr || !data.user) {
        setError(signUpErr?.message ?? '회원가입 실패')
        setLoading(false)
        return
      }

      // 2. tenants 생성 (realmyos DB 단일화 구조)
      const { data: tenant, error: tErr } = await supabase
        .from('tenants')
        .insert({ name: storeName.trim(), role: 'restaurant', is_approved: false })
        .select('id').single()
      if (tErr || !tenant) {
        setError('매장 등록 실패: ' + tErr?.message)
        setLoading(false)
        return
      }

      // 3. users에 tenant 연결
      const { error: uErr } = await supabase
        .from('users')
        .insert({ id: data.user.id, tenant_id: tenant.id, role: 'restaurant' })
      if (uErr) {
        setError('계정 연결 실패: ' + uErr.message)
        setLoading(false)
        return
      }

      setDone(true)
      setLoading(false)
      return
    }

    // 로그인
    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (signInErr || !data.user) {
      setError(signInErr?.message ?? '로그인 실패. 이메일/비밀번호를 확인해주세요.')
      setLoading(false)
      return
    }

    // 승인 체크 (users → tenants 조인)
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id, tenants(is_approved)')
      .eq('id', data.user.id)
      .maybeSingle()

    const rawTenant = userData?.tenants
    const tenant = (Array.isArray(rawTenant) ? rawTenant[0] : rawTenant) as { is_approved: boolean } | null
    if (!userData?.tenant_id) {
      router.replace('/onboarding')
    } else if (!tenant?.is_approved) {
      router.replace('/pending')
    } else {
      router.replace('/today')
    }
  }

  // 회원가입 완료 화면
  if (done) {
    return (
      <Wrapper>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
            가입 완료
          </div>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, margin: '0 0 24px' }}>
            담당자 승인 후 사용할 수 있습니다.<br />
            로그인 후 승인을 기다려주세요.
          </p>
          <button
            onClick={() => { setDone(false); setMode('login') }}
            style={{ ...BTN, background: '#111827', color: '#fff' }}
          >
            로그인하러 가기
          </button>
        </div>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🍽️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
          식당OS
        </h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '6px 0 0' }}>
          사장님과 함께 장사하는 파트너
        </p>
      </div>

      {/* 모드 탭 */}
      <div style={{
        display: 'flex', background: '#F3F4F6', borderRadius: 10,
        padding: 4, marginBottom: 24, gap: 4,
      }}>
        {(['login', 'signup'] as Mode[]).map(m => (
          <button key={m} onClick={() => { setMode(m); setError(null) }} style={{
            flex: 1, padding: '8px',
            border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            background: mode === m ? '#fff' : 'transparent',
            color: mode === m ? '#111827' : '#6b7280',
            boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          }}>
            {m === 'login' ? '로그인' : '회원가입'}
          </button>
        ))}
      </div>

      {/* 폼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mode === 'signup' && (
          <Field label="매장 이름">
            <input
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="예: 행복분식"
              style={INPUT_STYLE}
            />
          </Field>
        )}

        <Field label="이메일">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="owner@restaurant.com"
            autoComplete="email"
            style={INPUT_STYLE}
          />
        </Field>

        <Field label="비밀번호">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="6자리 이상"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            style={INPUT_STYLE}
          />
        </Field>
      </div>

      {error && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: '#FEF2F2', border: '1px solid #FCA5A5',
          borderRadius: 8, fontSize: 13, color: '#B91C1C',
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isReady || loading}
        style={{
          ...BTN, marginTop: 20,
          background: (!isReady || loading) ? '#d1d5db' : '#111827',
          color: '#fff',
          cursor: (!isReady || loading) ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
      </button>

      {mode === 'login' && (
        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 }}>
          계정이 없으신가요?{' '}
          <button
            onClick={() => { setMode('signup'); setError(null) }}
            style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: 0 }}
          >
            회원가입
          </button>
        </p>
      )}
    </Wrapper>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#F9FAFB', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: '#fff', borderRadius: 20, padding: '40px 32px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
