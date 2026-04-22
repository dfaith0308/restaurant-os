import type { ReactNode } from 'react'
import BottomNav from '@/components/layout/BottomNav'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <div style={{ paddingBottom: 72 }}>
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
