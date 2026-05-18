'use server'

const MAX_FILE_BYTES = 5 * 1024 * 1024

export type OrderImageOcrResult = {
  order_text: string
  counterparty_hint: string | null
}

const SYSTEM_PROMPT = `당신은 한국 식당 주문 화면 분석 AI입니다.

사용자가 업로드한 이미지는 카카오톡 주문 채팅 캡처, 주문 메모 사진, 전화 후 메모 캡처 등일 수 있습니다.

추출 대상:
- 주문 품목과 수량이 담긴 본문 텍스트 (줄 단위로 그대로)
- 거래처/공급업체명 힌트(보이면)

주의:
- 보이는 것만 추출
- 추측 금지
- 주문과 무관한 UI·시간·이모지는 제외
- order_text는 한국어 주문 줄만 (예: "양파 1박스\\n대파 2단")
- counterparty_hint가 없으면 null
- JSON 외 다른 텍스트 금지

반드시 아래 형식:

{
  "order_text": "양파 1박스\\n대파 2단",
  "counterparty_hint": "대한유통"
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

function stripJsonFence(text: string): string {
  const t = text.trim()
  if (t.startsWith('```')) {
    return t.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '').trim()
  }
  return t
}

function parseOrderImageObject(text: string): OrderImageOcrResult | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>
    const order_text =
      raw.order_text != null ? String(raw.order_text).trim() : ''
    if (order_text.length < 2) return null
    const hintRaw = raw.counterparty_hint
    const counterparty_hint =
      hintRaw == null || hintRaw === ''
        ? null
        : String(hintRaw).trim() || null
    return { order_text, counterparty_hint }
  } catch {
    return null
  }
}

/**
 * 카카오/주문 캡처 이미지 → 주문 텍스트. 실패 시 null (throw 없음).
 */
export async function analyzeOrderImage(
  file: File,
): Promise<OrderImageOcrResult | null> {
  if (!isImageFile(file)) return null
  if (file.size > MAX_FILE_BYTES) return null

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  const dataUrl = await fileToDataUrl(file)
  if (!dataUrl) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)

  let res: Response | null = null
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 600,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              {
                type: 'text',
                text: '이미지에서 식당 주문 내용을 추출해 주세요. JSON만 반환하세요.',
              },
            ],
          },
        ],
      }),
    })
  } catch {
    res = null
  } finally {
    clearTimeout(timeout)
  }

  if (!res?.ok) return null

  const body = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>
  } | null

  const content = body?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') return null

  return parseOrderImageObject(stripJsonFence(content))
}
