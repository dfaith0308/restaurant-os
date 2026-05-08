import type { ReactNode } from 'react'
import LegalFooter from '@/components/layout/LegalFooter'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      {children}
      <LegalFooter />
    </div>
  )
}

