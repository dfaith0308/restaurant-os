// 거래명세서 OCR 상품명 correction — rule-based, local only (AI 재호출 없음)

/** 운영 축적용 dictionary 구조 (DB 연동 전) */
export type InvoiceOcrCorrectionDictionary = {
  /** 전체 구문 치환 */
  phrases: Array<{ from: string; to: string }>
  /** 부분 토큰 치환 */
  tokens: Record<string, string>
  /** 거래처별 override (향후) */
  supplierOverrides?: Record<string, Record<string, string>>
}

export const INVOICE_OCR_CORRECTION_DICTIONARY: InvoiceOcrCorrectionDictionary =
  {
    phrases: [
      { from: '에너지나 시골된장', to: '예나지나 시골된장' },
      { from: '에너지시골된장', to: '예나지나 시골된장' },
      { from: '에너지 나 시골된장', to: '예나지나 시골된장' },
    ],
    tokens: {
      에너지나: '예나지나',
    },
    supplierOverrides: {},
  }

const PHRASE_CORRECTIONS = INVOICE_OCR_CORRECTION_DICTIONARY.phrases
const TOKEN_CORRECTIONS = INVOICE_OCR_CORRECTION_DICTIONARY.tokens

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** OCR 직후·canonical 비교 전 상품명 correction */
export function applyInvoiceNameCorrection(name: string): string {
  let s = collapseWhitespace(name)
  if (!s) return s

  for (const { from, to } of PHRASE_CORRECTIONS) {
    if (s.includes(from)) {
      s = s.split(from).join(to)
    }
  }

  for (const [wrong, right] of Object.entries(TOKEN_CORRECTIONS)) {
    if (s.includes(wrong)) {
      s = s.split(wrong).join(right)
    }
  }

  return collapseWhitespace(s)
}

function ocrGroupKey(name: string): string {
  return applyInvoiceNameCorrection(name)
    .toLowerCase()
    .replace(/[\s()[\]{}·.,\-_/\\|"'`~!@#$%^&*+=?:;<>]/g, '')
    .replace(/\d+/g, '')
}

function hasAbnormalKoreanPattern(name: string): boolean {
  const s = collapseWhitespace(name)
  if (s.length < 2) return true
  if (/[a-zA-Z]{2,}/.test(s) && /[\uAC00-\uD7A3]/.test(s)) return true
  if (/(.)\1{4,}/.test(s)) return true
  return false
}

function hasSpecSiblingNameMismatch(
  row: { rowKey: string; name: string; spec: string | null },
  allRows: Array<{ rowKey: string; name: string; spec: string | null }>,
): boolean {
  const spec = row.spec?.trim().toLowerCase()
  if (!spec) return false
  const myKey = ocrGroupKey(row.name)
  if (!myKey) return false

  const siblings = allRows.filter(
    (r) => r.rowKey !== row.rowKey && (r.spec?.trim().toLowerCase() ?? '') === spec,
  )
  if (siblings.length === 0) return false

  return siblings.some((s) => ocrGroupKey(s.name) !== myKey)
}

export type OcrReviewSignals = {
  isNew: boolean
  canonicalMiss: boolean
  abnormalPattern: boolean
  specSiblingMismatch: boolean
  wasAutoCorrected: boolean
}

export function getOcrReviewSignals(
  row: {
    rowKey: string
    name: string
    spec: string | null
    ocr_name_raw?: string | null
  },
  allRows: Array<{
    rowKey: string
    name: string
    spec: string | null
    ocr_name_raw?: string | null
  }>,
  hasCanonicalMatch: boolean,
): OcrReviewSignals {
  const isNew = !hasCanonicalMatch
  const canonicalMiss = !hasCanonicalMatch
  const abnormalPattern = hasAbnormalKoreanPattern(row.name)
  const specSiblingMismatch = hasSpecSiblingNameMismatch(row, allRows)
  const wasAutoCorrected = Boolean(
    row.ocr_name_raw &&
      collapseWhitespace(row.ocr_name_raw) !== collapseWhitespace(row.name),
  )

  return {
    isNew,
    canonicalMiss,
    abnormalPattern,
    specSiblingMismatch,
    wasAutoCorrected,
  }
}

export function isOcrReviewRecommended(
  signals: OcrReviewSignals,
): boolean {
  if (signals.isNew) return true
  if (signals.canonicalMiss) return true
  if (signals.abnormalPattern) return true
  if (signals.specSiblingMismatch) return true
  if (signals.wasAutoCorrected) return true
  return false
}
