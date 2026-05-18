// 향후 구현 방향:
//
// 1. Open Graph 메타데이터 파싱
// 2. 서버 API 기반 parser 연결
// 3. 외부 provider 연결
// 4. 메뉴/가격 hydrate 확장
//
// 현재는 onboarding UX 구조만 구현.
// parser는 추후 교체 가능 구조 유지.

export interface NaverPlaceInfo {
  name: string | null
  address: string | null
  phone: string | null
  business_hours_text: string | null
  menus?: Array<{
    name: string
    price?: string
  }>
}

const ALLOWED_HOSTS = ['map.naver.com', 'place.naver.com', 'naver.me'] as const

function isAllowedNaverPlaceUrl(url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase()
    return ALLOWED_HOSTS.some(
      allowed => host === allowed || host.endsWith(`.${allowed}`),
    )
  } catch {
    return false
  }
}

export async function fetchNaverPlaceInfo(
  url: string,
): Promise<NaverPlaceInfo | null> {
  if (!isAllowedNaverPlaceUrl(url)) return null
  return null
}
