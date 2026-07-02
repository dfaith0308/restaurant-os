'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase-browser'

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '13px 14px',
  border: '1.5px solid #e5e7eb',
  borderRadius: 12,
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  background: '#f9fafb',
  color: '#374151',
}

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const trimmed = email.trim()
    if (!trimmed) {
      setError('이메일을 입력해주세요')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createBrowserSupabase()
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/settings/account')}`
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })

      if (resetErr) {
        setError(resetErr.message)
        return
      }

      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f7f3',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 375,
          background: '#ffffff',
          borderRadius: 28,
          padding: '44px 28px 36px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 40px rgba(31,93,58,0.08)',
        }}
      >
        <Link
          href="/login"
          style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}
        >
          ← 로그인
        </Link>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: '20px 0 8px' }}>
          비밀번호 재설정
        </h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 24px', lineHeight: 1.5 }}>
          가입하신 이메일로 재설정 링크를 보내드립니다.
        </p>

        {sent ? (
          <div
            style={{
              padding: '14px 16px',
              background: '#f0fdf4',
              border: '1px solid #BBF7D0',
              borderRadius: 12,
              fontSize: 14,
              color: '#166534',
              lineHeight: 1.5,
            }}
          >
            재설정 링크를 이메일로 보냈습니다.
            메일함을 확인해주세요.
          </div>
        ) : (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              autoComplete="email"
              style={INPUT_STYLE}
            />

            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#B91C1C',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%',
                marginTop: 20,
                padding: '15px',
                border: 'none',
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'inherit',
                background: loading ? '#d1d5db' : 'var(--color-primary)',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '전송 중...' : '재설정 링크 받기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
