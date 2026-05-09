import type { CSSProperties } from 'react'

/** 중앙 앱 컬럼 너비 — BottomNav·고정 푸터와 동일 */
export const APP_SHELL_MAX_WIDTH_PX = 560

export const BOTTOM_NAV_HEIGHT_PX = 64

/** 하단 탭바: 뷰포트 기준 가운데 정렬 (모바일은 max-width: 100vw) */
export const bottomNavFixedBox: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  width: '100%',
  maxWidth: `min(${APP_SHELL_MAX_WIDTH_PX}px, 100vw)`,
  zIndex: 50,
}

/** BottomNav 위에 붙는 고정 스트라이프(합계·CTA 등) */
export function fixedStripeAboveBottomNav(extra: CSSProperties, zIndex = 40): CSSProperties {
  return {
    position: 'fixed',
    bottom: BOTTOM_NAV_HEIGHT_PX,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: `min(${APP_SHELL_MAX_WIDTH_PX}px, 100vw)`,
    zIndex,
    ...extra,
  }
}
