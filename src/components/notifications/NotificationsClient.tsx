'use client'

import { useMemo, useState, useTransition } from 'react'
import type { Notification } from '@/types'
import { markNotificationRead } from '@/actions/notifications'

interface Props {
  tenant_id: string
  initial: Notification[]
}

const PRIORITY_CFG: Record<
  Notification['priority'],
  { icon: string; color: string; bg: string; border: string }
> = {
  urgent: { icon: '🔴', color: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5' },
  important: { icon: '🟡', color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
  normal: { icon: '🔵', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
}

export default function NotificationsClient({ tenant_id, initial }: Props) {
  const [isPending, startTransition] = useTransition()
  const [items, setItems] = useState<Notification[]>(initial)

  const { unread, read } = useMemo(() => {
    const u = items.filter((n) => !n.is_read)
    const r = items.filter((n) => n.is_read)
    return { unread: u, read: r }
  }, [items])

  const list = [...unread, ...read]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 4px',
        }}
      >
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          미읽음 <b style={{ color: 'var(--color-text)' }}>{unread.length}</b> · 전체{' '}
          <b style={{ color: 'var(--color-text)' }}>{items.length}</b>
        </div>
        {isPending && <div style={{ fontSize: 12, color: '#9ca3af' }}>처리 중...</div>}
      </div>

      {list.length === 0 ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            border: '1px solid #E5E7EB',
            padding: '18px 16px',
            color: '#6b7280',
            fontSize: 13,
          }}
        >
          아직 알림이 없어요.
        </div>
      ) : (
        list.map((n) => {
          const cfg = PRIORITY_CFG[n.priority]
          return (
            <div
              key={n.id}
              style={{
                background: '#fff',
                borderRadius: 16,
                border: `1px solid ${n.is_read ? '#E5E7EB' : cfg.border}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderLeft: `3px solid ${n.is_read ? '#E5E7EB' : cfg.border}`,
                  opacity: n.is_read ? 0.75 : 1,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background: n.is_read ? '#F3F4F6' : cfg.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)' }}>
                        {n.title}
                      </div>
                      {!n.is_read && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 999,
                            background: 'var(--color-primary)',
                            color: '#fff',
                          }}
                        >
                          NEW
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 1.4 }}>
                      {n.message}
                    </div>

                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                      {new Date(n.created_at).toLocaleString('ko-KR')}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {n.action_link && (
                        <a
                          href={n.action_link}
                          style={{
                            padding: '9px 10px',
                            borderRadius: 12,
                            border: `1px solid ${cfg.border}`,
                            background: '#fff',
                            color: cfg.color,
                            textDecoration: 'none',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {n.action_label ?? '바로가기'} →
                        </a>
                      )}

                      {!n.is_read && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              const r = await markNotificationRead(n.id, tenant_id)
                              if (!r.success) alert(r.error ?? '처리에 실패했어요')
                              else setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
                            })
                          }}
                          style={{
                            padding: '9px 10px',
                            borderRadius: 12,
                            border: '1px solid #E5E7EB',
                            background: '#F9FAFB',
                            color: '#374151',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: isPending ? 'not-allowed' : 'pointer',
                          }}
                        >
                          읽음 처리
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

