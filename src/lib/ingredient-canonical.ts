// 식자재명 canonical 정규화 — OCR/주문 매칭 공통 (ingredients 액션과 동일 규칙 유지)

import { applyInvoiceNameCorrection } from '@/lib/invoice-ocr-correction'

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

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function normalizeIngredientName(name: string): string {
  let s = collapseWhitespace(applyInvoiceNameCorrection(name))
    .toLowerCase()
    .replace(/[\s()[\]{}·.,\-_/\\|"'`~!@#$%^&*+=?:;<>]/g, '')

  for (const token of CANONICAL_STRIP_TOKENS) {
    s = s.split(token).join('')
  }

  s = s.replace(/\d+/g, '')
  return s
}

/** OCR 상품명 그룹핑·canonical 매칭 공통 키 */
export function getIngredientNameGroupKey(name: string): string {
  return normalizeIngredientName(name)
}

export function assignIngredientNameGroupId(
  name: string,
  registry: Map<string, string>,
): string {
  const key = getIngredientNameGroupKey(name)
  if (!key) {
    return `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  }
  const existing = registry.get(key)
  if (existing) return existing
  const id = `grp_${registry.size}_${key.slice(0, 16)}`
  registry.set(key, id)
  return id
}
