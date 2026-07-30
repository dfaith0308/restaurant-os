import Link from 'next/link'
import { BOTTOM_NAV_HEIGHT_PX } from '@/lib/app-shell'

/** 전자상거래법 고지용 — 클릭 없이 상시 노출 */
export default function LegalFooter({
  reserveBottomNav = false,
}: {
  /** (app) 레이아웃처럼 하단 고정 네비가 있을 때 푸터 하단 여백 */
  reserveBottomNav?: boolean
}) {
  return (
    <footer
      style={{
        padding: '20px 16px',
        paddingBottom: reserveBottomNav
          ? `calc(20px + ${BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`
          : 20,
        borderTop: '1px solid #e5e7eb',
        background: '#f7f6f2',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.85 }}>
        <p style={{ margin: '0 0 10px' }}>
          <Link href="/terms" style={{ color: '#4b5563', textDecoration: 'underline', marginRight: 12 }}>
            이용약관
          </Link>
          <Link href="/privacy" style={{ color: '#4b5563', textDecoration: 'underline' }}>
            개인정보처리방침
          </Link>
        </p>
        <p style={{ margin: 0 }}>상호명: 디닷페이스 · 대표자: 김정무 · 사업자등록번호: 728-02-02513</p>
        <p style={{ margin: 0 }}>통신판매업 신고번호: 제2026-인천부평-0405호</p>
        <p style={{ margin: 0 }}>주소: 인천광역시 부평구 장제로155번길 24, 1층</p>
        <p style={{ margin: 0 }}>이메일: dfaith0308@gmail.com · 전화번호: 032-215-3207</p>
      </div>
    </footer>
  )
}
