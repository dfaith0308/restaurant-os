'use client'

import Link from 'next/link'

export default function LegalFooter() {
  return (
    <footer style={{ padding: '18px 16px', borderTop: '1px solid rgba(0,0,0,0.06)', background: '#fff', color: '#6b7280', fontSize: 12 }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/terms" style={{ color: '#374151', textDecoration: 'none', fontWeight: 700 }}>
          이용약관
        </Link>
        <span style={{ opacity: 0.6 }}>|</span>
        <Link href="/privacy" style={{ color: '#374151', textDecoration: 'none', fontWeight: 700 }}>
          개인정보처리방침
        </Link>
        <span style={{ opacity: 0.6 }}>|</span>
        <span>운영자: 디닷페이스 · 대표: 김정무 · 연락처: 032-215-3207 · 이메일: dfaith0308@gmail.com</span>
      </div>
    </footer>
  )
}

