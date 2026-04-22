'use client'

import { useState } from 'react'
import type { Notification } from '@/types'

interface Props {
  notifications: Notification[]
}

const PRIORITY_CFG = {
  urgent:    { icon: '🔴', color: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5' },
  important: { icon: '🟡', color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
  normal:    { icon: '🔵', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
}

export default function TodayNotifications({ notifications }: Props) {
  const [shown, setShown] = useState(true)
  if (!shown || notifications.length === 0) return null

  const top = notifications.slice(0, 3)

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1px solid #e5e7eb', overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #f3f4f6',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
          알림 {notifications.length}건
        </span>
        <button onClick={() => setShown(false)}
          style={{ border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
          ×
        </button>
      </div>

      {top.map(n => {
        const cfg = PRIORITY_CFG[n.priority]
        return (
          <div key={n.id} style={{
            padding: '12px 18px',
            borderBottom: '1px solid #f9fafb',
            borderLeft: `3px solid ${cfg.border}`,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span>{cfg.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{n.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{n.message}</div>
              </div>
              {n.action_link && (
                <a href={n.action_link} style={{
                  fontSize: 11, fontWeight: 600,
                  color: cfg.color, textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                  {n.action_label ?? '확인'} →
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
