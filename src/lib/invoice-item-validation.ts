/** 거래명세서 OCR 품목명 후처리 — 표 헤더·합계·placeholder 제거 */

const HEADER_ROW_NAMES = new Set([
  '품목',
  '품명',
  '제품명',
  '상품명',
  '품목명',
  '수량',
  '단위',
  '단가',
  '공급가',
  '공급가액',
  '금액',
  '비고',
  '규격',
  '번호',
  'no',
  'no.',
  '합계',
  '총계',
  '소계',
  '부가세',
  'vat',
  '세액',
  '청구금액',
  '총금액',
  '합계금액',
  '거래금액',
  '공급가합계',
  '전표번호',
  '일자',
  '날짜',
])

const INVALID_NAME_PATTERNS: RegExp[] = [
  /^품목\s*\d+$/i,
  /^item\s*\d+$/i,
  /^no\.?$/i,
  /^n\/a$/i,
  /^없음$/,
  /^미상$/,
  /^합계$/,
  /^총계$/,
  /^소계$/,
  /^부가세$/,
  /^공급가액$/,
  /^청구금액$/,
  /^총금액$/,
  /^합계금액$/,
  /^거래금액$/,
  /^공급가합계$/,
  /^전표$/,
  /^\d+$/,
  /^[a-z]{1,3}$/i,
  /^(ea|box|pk|ea|kg|g|l|ml)$/i,
  /^[-–—./]+$/,
]

function normalizeItemName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

function hasKoreanSyllable(name: string): boolean {
  return /[\uAC00-\uD7A3]/.test(name)
}

function isMostlyDigits(name: string): boolean {
  const digits = name.replace(/\s/g, '').length
  if (digits === 0) return true
  const digitCount = (name.match(/\d/g) ?? []).length
  return digitCount / digits >= 0.85
}

export function isValidInvoiceItemName(rawName: string): boolean {
  const name = normalizeItemName(rawName)
  if (name.length < 2) return false
  if (!hasKoreanSyllable(name)) return false
  if (isMostlyDigits(name)) return false

  const lower = name.toLowerCase()
  if (HEADER_ROW_NAMES.has(lower) || HEADER_ROW_NAMES.has(name)) {
    return false
  }

  for (const pattern of INVALID_NAME_PATTERNS) {
    if (pattern.test(name)) return false
  }

  if (/합계|총계|부가세|공급가액|청구|전표번호/.test(name) && name.length <= 12) {
    return false
  }

  return true
}
