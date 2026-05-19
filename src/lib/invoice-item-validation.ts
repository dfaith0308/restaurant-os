/** 거래명세서 OCR 품목명·규격 후처리 */

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
  /^(ea|box|pk|kg|g|l|ml)$/i,
  /^[-–—./]+$/,
]

const INVALID_SPEC_PATTERNS: RegExp[] = [
  /^품목\s*\d+$/i,
  /^item\s*\d+$/i,
  /^no\.?$/i,
  /^합계$/,
  /^총계$/,
  /^소계$/,
  /^부가세$/,
  /^공급가액$/,
  /^청구금액$/,
  /^총금액$/,
  /^전표$/,
  /^\d+$/,
  /^[-–—./]+$/,
]

/** 규격 문자열 패턴 (14KG, 1.8L/10, 270ml/12, 2KG/30 등) */
const SPEC_SHAPE_PATTERN =
  /(\d+(\.\d+)?\s*(kg|g|l|ml|mL|ℓ|리터|키로|킬로|박스|box|ea|개|팩|봉))|(\d+\s*ml\s*\/\s*\d+)|(\d+\s*kg\s*\/\s*\d+)/i

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function hasKoreanSyllable(text: string): boolean {
  return /[\uAC00-\uD7A3]/.test(text)
}

function isMostlyDigits(text: string): boolean {
  const compact = text.replace(/\s/g, '')
  if (compact.length === 0) return true
  const digitCount = (compact.match(/\d/g) ?? []).length
  return digitCount / compact.length >= 0.85
}

function isSummaryKeyword(text: string): boolean {
  return /합계|총계|부가세|공급가액|청구|전표번호/.test(text) && text.length <= 12
}

export function isValidInvoiceItemName(rawName: string): boolean {
  const name = normalizeText(rawName)
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

  if (isSummaryKeyword(name)) return false

  return true
}

export function isValidInvoiceItemSpec(rawSpec: string): boolean {
  const spec = normalizeText(rawSpec)
  if (!spec) return false
  if (spec.length > 40) return false

  const lower = spec.toLowerCase()
  if (HEADER_ROW_NAMES.has(lower) || HEADER_ROW_NAMES.has(spec)) {
    return false
  }

  for (const pattern of INVALID_SPEC_PATTERNS) {
    if (pattern.test(spec)) return false
  }

  if (isSummaryKeyword(spec)) return false
  if (isMostlyDigits(spec)) return false

  if (!SPEC_SHAPE_PATTERN.test(spec) && !/[\d]/.test(spec)) {
    return false
  }

  return true
}

export function normalizeInvoiceItemSpec(
  rawSpec: string | null | undefined,
): string | null {
  if (rawSpec == null) return null
  const spec = normalizeText(String(rawSpec))
  if (!spec) return null
  return isValidInvoiceItemSpec(spec) ? spec : null
}

export function formatInvoiceItemDisplayTitle(
  name: string,
  spec: string | null | undefined,
): string {
  const n = normalizeText(name)
  const s = spec ? normalizeInvoiceItemSpec(spec) : null
  if (!n) return '식자재명 입력'
  if (s) return `${n} ${s}`
  return n
}
