'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase-browser'

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  border: '0.5px solid #e8e5de',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  background: '#f7f6f2',
}

export default function AccountSettingsClient() {
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    if (password.length < 6) {
      setError('비밀번호는 6자리 이상이어야 합니다')
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createBrowserSupabase()
      const { error: updateErr } = await supabase.auth.updateUser({ password })

      if (updateErr) {
        setError(updateErr.message)
        return
      }

      setPassword('')
      setPasswordConfirm('')
      setSuccess(true)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = password.length >= 6 && password === passwordConfirm && !loading

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <Link href="/settings" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
        ← 설정
      </Link>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '16px 0 8px' }}>
        계정
      </h1>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 24px', lineHeight: 1.5 }}>
        로그인 비밀번호를 변경합니다.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="새 비밀번호">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setSuccess(false) }}
            placeholder="6자리 이상"
            autoComplete="new-password"
            style={INPUT_STYLE}
          />
        </Field>

        <Field label="새 비밀번호 확인">
          <input
            type="password"
            value={passwordConfirm}
            onChange={e => { setPasswordConfirm(e.target.value); setSuccess(false) }}
            placeholder="비밀번호 재입력"
            autoComplete="new-password"
            style={INPUT_STYLE}
          />
        </Field>
      </div>

      {error && (
        <div
          style={{
            marginTop: 14,
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

      {success && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: '#f0fdf4',
            border: '1px solid #BBF7D0',
            borderRadius: 8,
            fontSize: 13,
            color: '#166534',
          }}
        >
          비밀번호가 변경되었습니다.
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: '100%',
          marginTop: 20,
          padding: '14px',
          border: 'none',
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          fontFamily: 'inherit',
          background: canSubmit ? 'var(--color-primary)' : '#d1d5db',
          color: '#fff',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        {loading ? '변경 중...' : '비밀번호 변경'}
      </button>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
