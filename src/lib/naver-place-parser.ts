'use server'

// 플레이스 화면 캡쳐 → Vision OCR → 매장 기본정보 자동입력
// 향후: 메뉴판·거래명세서·영수증 OCR과 파이프라인 공유 가능

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

const MAX_FILE_BYTES = 5 * 1024 * 1024

const SYSTEM_PROMPT = `당신은 한국 식당 네이버 플레이스 화면 분석 AI입니다.

사용자가 업로드한 네이버 플레이스 화면 이미지를 보고
다음 정보를 추출하세요:

- 매장명
- 주소
- 전화번호
- 영업시간

주의:
- 보이는 정보만 추출
- 없으면 null
- 추측 금지
- JSON 외 다른 텍스트 절대 금지

반드시 아래 형식:

{
  "name": string | null,
  "address": string | null,
  "phone": string | null,
  "business_hours_text": string | null
}`

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
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

function parseVisionJson(text: string): NaverPlaceInfo | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    return {
      name: toNullableString(parsed.name),
      address: toNullableString(parsed.address),
      phone: toNullableString(parsed.phone),
      business_hours_text: toNullableString(parsed.business_hours_text),
    }
  } catch {
    return null
  }
}

function hasAnyField(info: NaverPlaceInfo): boolean {
  return !!(
    info.name ||
    info.address ||
    info.phone ||
    info.business_hours_text
  )
}

export async function parseNaverPlaceImage(
  file: File,
): Promise<NaverPlaceInfo | null> {
  if (!isImageFile(file)) return null
  if (file.size > MAX_FILE_BYTES) return null

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  const dataUrl = await fileToDataUrl(file)
  if (!dataUrl) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

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
      max_tokens: 200,
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
              text: '첨부한 네이버 플레이스 화면 이미지에서 정보를 추출해 주세요.',
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

  const info = parseVisionJson(content)
  if (!info || !hasAnyField(info)) return null

  return info
}
