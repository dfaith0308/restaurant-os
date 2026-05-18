// 향후 구현 방향:
//
// 1. Vision API / OCR provider 연결 (플레이스 화면 캡쳐)
// 2. 서버 API 기반 parser (이미지 → 구조화 JSON)
// 3. 메뉴판·가격 hydrate 확장
// 4. 거래명세서·영수증·포스 화면 OCR과 동일 파이프라인 공유
//
// 현재는 onboarding UX + mock OCR 구조만 구현.
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

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export async function parseNaverPlaceImage(
  file: File,
): Promise<NaverPlaceInfo | null> {
  if (!isImageFile(file)) return null

  // mock OCR — 실제 Vision/OCR API 연결 시 이 블록만 교체
  return {
    name: '정엔식탁',
    address: '인천 중구 ...',
    phone: '010-1234-1234',
    business_hours_text: '매일 11:00~22:00 / 월요일 휴무',
  }
}
