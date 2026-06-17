'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { bottomNavFixedBox } from '@/lib/app-shell'

const NAV = [
  { href: '/today',  icon: '🏠', label: '홈'    },
  { href: '/buy',    icon: '🛒', label: '구매'  },
  { href: '/rfq',    icon: '📋', label: '발주'  },
  { href: '/orders', icon: '📦', label: '내역'  },
  { href: '/more',   icon: '☰',  label: '더보기' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        ...bottomNavFixedBox,
        background: '#fff',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        height: 64,
        boxSizing: 'border-box',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
      }}
    >
      {NAV.map(({ href, icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3, textDecoration: 'none',
            color: active ? 'var(--color-primary)' : '#6b7280',
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
