// 식자재명 canonical 정규화 — OCR/주문 매칭 공통 (ingredients 액션과 동일 규칙 유지)
const CANONICAL_STRIP_TOKENS = [
  '국내산',
  '수입산',
  '상품',
  '박스',
  'box',
  '깐',
  '특',
  'kg',
  'ea',
  '개',
  'g',
] as const

export function normalizeIngredientName(name: string): string {
  let s = name
    .trim()
    .toLowerCase()
    .replace(/[\s()[\]{}·.,\-_/\\|"'`~!@#$%^&*+=?:;<>]/g, '')

  for (const token of CANONICAL_STRIP_TOKENS) {
    s = s.split(token).join('')
  }

  s = s.replace(/\d+/g, '')
  return s
}
