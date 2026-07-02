'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  getPushPreference,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push-client'

export default function NotificationsSettingsClient() {
  const [enabled, setEnabled] = useState(true)
  const [supported, setSupported] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSupported(isPushSupported())
    setEnabled(getPushPreference())
  }, [])

  async function handleToggle(next: boolean) {
    setLoading(true)
    setError(null)

    try {
      if (next) {
        await subscribeToPush()
        setEnabled(true)
      } else {
        await unsubscribeFromPush()
        setEnabled(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '설정 변경에 실패했습니다')
      setEnabled(getPushPreference())
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <Link href="/settings" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
        ← 설정
      </Link>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '16px 0 8px' }}>
        알림 설정
      </h1>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 24px', lineHeight: 1.5 }}>
        시세·발주 등 푸시 알림을 받을지 설정합니다.
      </p>

      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '0.5px solid #e8e5de',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#2b2b2b', margin: '0 0 4px' }}>
            푸시 알림
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
            {supported
              ? '앱 알림을 켜면 시세·발주 알림을 받을 수 있어요'
              : '이 기기 또는 환경에서는 푸시 알림을 사용할 수 없습니다'}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!supported || loading}
          onClick={() => handleToggle(!enabled)}
          style={{
            flexShrink: 0,
            width: 52,
            height: 30,
            borderRadius: 999,
            border: 'none',
            padding: 3,
            cursor: !supported || loading ? 'not-allowed' : 'pointer',
            background: enabled && supported ? '#1f5d3a' : '#d1d5db',
            opacity: !supported || loading ? 0.6 : 1,
            transition: 'background 0.2s',
          }}
        >
          <span
            style={{
              display: 'block',
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#fff',
              transform: enabled ? 'translateX(22px)' : 'translateX(0)',
              transition: 'transform 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }}
          />
        </button>
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

      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 16, lineHeight: 1.5 }}>
        알림 설정은 이 기기에만 저장됩니다. 다른 기기에서도 끄려면 해당 기기에서 설정해주세요.
      </p>
    </main>
  )
}
