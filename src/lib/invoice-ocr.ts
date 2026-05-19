'use server'

// 거래명세서 화면 → Vision OCR → 날짜·공급업체·다량 식자재 추출

export type InvoiceIngredient = {
  name: string
  quantity: number | null
  unit: string | null
  price: number | null
}

export type InvoiceSupplier = {
  supplier_name: string | null
  phone: string | null
  business_number: string | null
  address: string | null
}

export type InvoiceOcrResult = {
  invoice_date: string | null
  supplier: InvoiceSupplier | null
  items: InvoiceIngredient[]
}

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_OCR_ITEMS = 80
const OPENAI_MAX_TOKENS = 2200

const SYSTEM_PROMPT = `한국 식자재 거래명세서 이미지에서 날짜·공급업체·품목을 추출하세요.

규칙:
- 보이는 것만, 추측 금지, 없으면 null
- invoice_date: YYYY-MM-DD 또는 null
- supplier 없으면 null (있으면 supplier_name만 넣어도 됨)
- items: name 필수, quantity/unit/price는 없으면 null
- JSON만 출력, 설명·마크다운·코드펜스 금지

형식:
{"invoice_date":"2026-05-18","supplier":{"supplier_name":"대한유통"},"items":[{"name":"양파","quantity":1,"unit":"망","price":12000}]}`

type InvoiceParseFailure =
  | 'no_json_candidate'
  | 'json_parse_failed'
  | 'items_empty'

type InvoiceParseSuccess = {
  kind: 'success'
  result: InvoiceOcrResult
}

type InvoiceParseAttempt =
  | InvoiceParseSuccess
  | { kind: 'failure'; reason: InvoiceParseFailure }

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

async function fileToDataUrl(file: File): Promise<string | null> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const mime = file.type.startsWith('image/') ? file.type : 'image/jpeg'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

function parsePositiveNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  const s = String(value).replace(/,/g, '').trim()
  if (!s) return null
  const n = parseFloat(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseOptionalString(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s || null
}

function parseInvoiceDate(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null
  }
  return s
}

function parseSupplier(raw: unknown): InvoiceSupplier | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const supplier: InvoiceSupplier = {
    supplier_name: parseOptionalString(row.supplier_name),
    phone: parseOptionalString(row.phone),
    business_number: parseOptionalString(row.business_number),
    address: parseOptionalString(row.address),
  }
  if (
    !supplier.supplier_name &&
    !supplier.phone &&
    !supplier.business_number &&
    !supplier.address
  ) {
    return null
  }
  return supplier
}

function sanitizeOcrItems(items: InvoiceIngredient[]): InvoiceIngredient[] {
  return items.filter((item) => item.name.trim().length > 0)
}

function sortOcrItems(items: InvoiceIngredient[]): InvoiceIngredient[] {
  return [...items].sort((a, b) => {
    const aHasPrice = a.price != null ? 1 : 0
    const bHasPrice = b.price != null ? 1 : 0
    if (aHasPrice !== bHasPrice) return bHasPrice - aHasPrice
    return a.name.localeCompare(b.name, 'ko')
  })
}

function finalizeInvoiceOcrResult(result: InvoiceOcrResult): InvoiceOcrResult | null {
  const items = sortOcrItems(sanitizeOcrItems(result.items))
  if (items.length === 0) return null
  return { ...result, items }
}

function parseItemsArray(raw: unknown): InvoiceIngredient[] | null {
  if (!Array.isArray(raw)) return null
  const items: InvoiceIngredient[] = []
  for (const entry of raw) {
    if (items.length >= MAX_OCR_ITEMS) break
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const name = row.name != null ? String(row.name).trim() : ''
    if (!name) continue
    items.push({
      name,
      quantity: parsePositiveNumber(row.quantity),
      unit: row.unit != null ? String(row.unit).trim() || null : null,
      price: parsePositiveNumber(row.price),
    })
  }
  const sanitized = sanitizeOcrItems(items)
  return sanitized.length > 0 ? sanitized : null
}

function stripMarkdownFence(text: string): string {
  const t = text.trim()
  if (!t.startsWith('```')) return t
  return t.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '').trim()
}

function removeTrailingCommas(json: string): string {
  return json.replace(/,(\s*[}\]])/g, '$1')
}

function closeUnbalancedBrackets(json: string): string {
  let s = json
  const openBrackets = (s.match(/\[/g) ?? []).length
  const closeBrackets = (s.match(/\]/g) ?? []).length
  const openBraces = (s.match(/\{/g) ?? []).length
  const closeBraces = (s.match(/\}/g) ?? []).length
  if (openBrackets > closeBrackets) {
    s += ']'.repeat(openBrackets - closeBrackets)
  }
  if (openBraces > closeBraces) {
    s += '}'.repeat(openBraces - closeBraces)
  }
  return s
}

function repairJsonCandidate(json: string): string {
  const trimmed = json.trim()
  const noTrailingComma = removeTrailingCommas(trimmed)
  return closeUnbalancedBrackets(noTrailingComma)
}

function tryParseJsonValue(candidate: string): unknown | null {
  const attempts = [candidate, repairJsonCandidate(candidate)]
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as unknown
    } catch {
      // next repair attempt
    }
  }
  return null
}

function buildResultFromObject(raw: Record<string, unknown>): InvoiceParseAttempt {
  const items = parseItemsArray(raw.items)
  if (!items) {
    return { kind: 'failure', reason: 'items_empty' }
  }
  const finalized = finalizeInvoiceOcrResult({
    invoice_date: parseInvoiceDate(raw.invoice_date),
    supplier: parseSupplier(raw.supplier),
    items,
  })
  if (!finalized) {
    return { kind: 'failure', reason: 'items_empty' }
  }
  return { kind: 'success', result: finalized }
}

function buildResultFromItemsArray(raw: unknown): InvoiceParseAttempt {
  const items = parseItemsArray(raw)
  if (!items) {
    return { kind: 'failure', reason: 'items_empty' }
  }
  const finalized = finalizeInvoiceOcrResult({
    invoice_date: null,
    supplier: null,
    items,
  })
  if (!finalized) {
    return { kind: 'failure', reason: 'items_empty' }
  }
  return { kind: 'success', result: finalized }
}

function parseInvoiceObjectContent(text: string): InvoiceParseAttempt {
  const normalized = stripMarkdownFence(text.trim())
  const objectCandidate = normalized.match(/\{[\s\S]*/)?.[0]
  if (!objectCandidate) {
    return { kind: 'failure', reason: 'no_json_candidate' }
  }

  const parsed = tryParseJsonValue(objectCandidate)
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'failure', reason: 'json_parse_failed' }
  }

  return buildResultFromObject(parsed as Record<string, unknown>)
}

function parseLegacyArrayContent(text: string): InvoiceParseAttempt {
  const normalized = stripMarkdownFence(text.trim())
  const arrayCandidate = normalized.match(/\[[\s\S]*/)?.[0]
  if (!arrayCandidate) {
    return { kind: 'failure', reason: 'no_json_candidate' }
  }

  const parsed = tryParseJsonValue(arrayCandidate)
  if (parsed == null) {
    return { kind: 'failure', reason: 'json_parse_failed' }
  }

  return buildResultFromItemsArray(parsed)
}

function parseInvoiceContent(text: string): InvoiceParseAttempt {
  const objectAttempt = parseInvoiceObjectContent(text)
  if (objectAttempt.kind === 'success') {
    return objectAttempt
  }
  if (objectAttempt.reason === 'items_empty') {
    return objectAttempt
  }

  const arrayAttempt = parseLegacyArrayContent(text)
  if (arrayAttempt.kind === 'success') {
    return arrayAttempt
  }

  if (objectAttempt.reason === 'json_parse_failed') {
    return objectAttempt
  }
  return arrayAttempt
}

export async function analyzeInvoiceImage(
  file: File,
): Promise<InvoiceOcrResult | null> {
  if (!isImageFile(file)) return null
  if (file.size > MAX_FILE_BYTES) return null

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  const dataUrl = await fileToDataUrl(file)
  if (!dataUrl) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: OPENAI_MAX_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
            {
              type: 'text',
              text: '거래명세서에서 날짜·공급업체·품목을 추출하세요. JSON만 반환하세요. 설명 금지.',
            },
          ],
        },
      ],
    }),
  }).catch(() => null)

  clearTimeout(timeout)
  if (!res?.ok) return null

  const body = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>
  } | null

  const content = body?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') return null

  const parsed = parseInvoiceContent(content)
  if (parsed.kind === 'success') {
    return parsed.result
  }
  return null
}
