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

const SYSTEM_PROMPT = `당신은 한국 식자재 거래명세서 분석 AI입니다.

사용자가 업로드한 거래명세서 이미지를 보고
거래명세서 날짜, 공급업체 정보, 식자재 목록을 추출하세요.

추출 대상:
- 거래명세서 날짜
- 공급업체명
- 전화번호
- 사업자번호
- 주소
- 식자재명
- 수량
- 단위
- 공급가

날짜 형식:
YYYY-MM-DD

주의:
- 보이는 것만 추출
- 추측 금지
- 없으면 null
- 날짜가 없으면 invoice_date는 null
- 공급업체 정보가 없으면 supplier는 null
- 여러 품목 가능
- JSON 외 다른 텍스트 금지

반드시 아래 형식:

{
  "invoice_date": "2026-05-18",
  "supplier": {
    "supplier_name": "대한유통",
    "phone": "02-1234-5678",
    "business_number": "123-45-67890",
    "address": "서울시 강남구 ..."
  },
  "items": [
    {
      "name": "양파",
      "quantity": 1,
      "unit": "망",
      "price": 12000
    }
  ]
}`

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

function parseInvoiceObject(text: string): InvoiceOcrResult | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>
    const items = parseItemsArray(raw.items)
    if (!items) return null
    return finalizeInvoiceOcrResult({
      invoice_date: parseInvoiceDate(raw.invoice_date),
      supplier: parseSupplier(raw.supplier),
      items,
    })
  } catch {
    return null
  }
}

function parseLegacyArray(text: string): InvoiceOcrResult | null {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[0]) as unknown
    const items = parseItemsArray(raw)
    if (!items) return null
    return finalizeInvoiceOcrResult({
      invoice_date: null,
      supplier: null,
      items,
    })
  } catch {
    return null
  }
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
      max_tokens: 750,
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
              text: '첨부한 거래명세서 이미지에서 거래 날짜, 공급업체 정보, 식자재 목록을 추출해 주세요.',
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

  return parseInvoiceObject(content) ?? parseLegacyArray(content)
}
