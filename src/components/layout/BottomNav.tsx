'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/today',     icon: '🏠', label: '오늘운영' },
  { href: '/rfq',       icon: '📋', label: '주문관리' },
  { href: '/money',     icon: '💰', label: '돈관리'   },
  { href: '/suppliers', icon: '🤝', label: '거래처'   },
  { href: '/settings',  icon: '⚙️', label: '설정'    },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '1px solid #e5e7eb',
      display: 'flex', height: 64, zIndex: 50,
      boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
    }}>
      {NAV.map(({ href, icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3, textDecoration: 'none',
            color: active ? '#111827' : '#6b7280',
            fontSize: 10, fontWeight: active ? 700 : 500,
          }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
