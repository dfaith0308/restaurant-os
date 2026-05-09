import type { ReactNode } from 'react'
import BottomNav from '@/components/layout/BottomNav'
import LegalFooter from '@/components/layout/LegalFooter'
import { APP_SHELL_MAX_WIDTH_PX, BOTTOM_NAV_HEIGHT_PX } from '@/lib/app-shell'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: `min(${APP_SHELL_MAX_WIDTH_PX}px, 100vw)`,
        margin: '0 auto',
        minHeight: '100vh',
        background: '#fff',
        position: 'relative',
        fontFamily: "'Pretendard', -apple-system, sans-serif",
        boxSizing: 'border-box',
      }}
    >
      <div style={{ paddingBottom: BOTTOM_NAV_HEIGHT_PX + 8 }}>{children}</div>
      <LegalFooter />
      <BottomNav />
    </div>
  )
}
