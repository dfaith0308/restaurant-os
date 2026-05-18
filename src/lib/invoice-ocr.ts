'use server'

// 거래명세서 화면 → Vision OCR → 다량 식자재 추출
// 향후: 가격 히스토리·거래처·날짜 적용과 파이프라인 공유 가능

export type InvoiceIngredient = {
  name: string
  quantity: number | null
  unit: string | null
  price: number | null
}

const MAX_FILE_BYTES = 5 * 1024 * 1024

const SYSTEM_PROMPT = `당신은 한국 식자재 거래명세서 분석 AI입니다.

사용자가 업로드한 거래명세서 이미지를 보고
식자재 목록을 추출하세요.

추출 대상:
- 식자재명
- 수량
- 단위
- 공급가

주의:
- 보이는 것만 추출
- 추측 금지
- 여러 품목 가능
- JSON 외 다른 텍스트 금지

반드시 아래 형식:

[
  {
    "name": "양파",
    "quantity": 1,
    "unit": "망",
    "price": 12000
  }
]`

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

function parseInvoiceArray(text: string): InvoiceIngredient[] | null {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[0]) as unknown
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
    return items.length > 0 ? items : null
  } catch {
    return null
  }
}

export async function analyzeInvoiceImage(
  file: File,
): Promise<InvoiceIngredient[] | null> {
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
      max_tokens: 500,
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
              text: '첨부한 거래명세서 이미지에서 식자재 목록을 추출해 주세요.',
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

  return parseInvoiceArray(content)
}
