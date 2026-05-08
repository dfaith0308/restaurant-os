'use server'

import { getTenantId } from '@/lib/get-restaurant'
import { lookupBarcodeChain } from '@/lib/barcode-lookup'
import type { BarcodeLookupParsed } from '@/lib/barcode-lookup'

export type BarcodeLookupResult = BarcodeLookupParsed & {
  ok: boolean
  error?: string
}

export type VisionProductHints = {
  name: string | null
  unit: string | null
  price_won: number | null
  barcode: string | null
  manufacturer: string | null
  ingredients_text: string | null
  raw_notes: string | null
}

function resolveKeys(): { foodSafety: string; nutrition: string } {
  const foodSafety = process.env.FOOD_SAFETY_API_KEY?.trim() ?? ''
  const nutrition = process.env.FOOD_NTR_API_KEY?.trim() || foodSafety
  return { foodSafety, nutrition }
}

function emptyResult(barcode: string): BarcodeLookupParsed {
  const bc = (barcode ?? '').replace(/\D/g, '')
  return {
    name: null,
    manufacturer: null,
    category: null,
    item_report_number: null,
    unit: null,
    barcode: bc,
    ingredients_text: null,
    source: 'none',
  }
}

export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { ok: false, error: '인증 필요', ...emptyResult(barcode) }

  const raw = (barcode ?? '').replace(/\D/g, '')
  if (!raw || raw.length < 8) {
    return { ok: false, error: '바코드 숫자를 8자리 이상 입력해 주세요.', ...emptyResult(barcode) }
  }

  const { foodSafety, nutrition } = resolveKeys()
  if (!foodSafety) {
    return {
      ok: false,
      error: 'FOOD_SAFETY_API_KEY 환경변수를 설정해 주세요.',
      ...emptyResult(raw),
    }
  }

  const parsed = await lookupBarcodeChain(foodSafety, nutrition, raw, { includeNutrition: true })
  if (!parsed.name && !parsed.item_report_number) {
    return {
      ok: false,
      error: '등록된 정보가 없습니다. 직접 입력해 주세요.',
      ...parsed,
      barcode: raw,
    }
  }

  return { ok: true, ...parsed, barcode: raw }
}

export async function recognizeProductFromImage(formData: FormData): Promise<{ ok: boolean; data?: VisionProductHints; error?: string }> {
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { ok: false, error: '인증 필요' }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY가 설정되어 있지 않습니다.' }

  const file = formData.get('image')
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return { ok: false, error: '이미지 파일을 선택해 주세요.' }
  }
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: '이미지는 4MB 이하만 지원합니다.' }

  const buf = Buffer.from(await file.arrayBuffer())
  const base64 = buf.toString('base64')
  const mime = (file as Blob).type && (file as Blob).type.startsWith('image/') ? (file as Blob).type : 'image/jpeg'

  const model = process.env.ANTHROPIC_VISION_MODEL?.trim() || 'claude-3-5-sonnet-20241022'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mime, data: base64 },
            },
            {
              type: 'text',
              text:
                '이 이미지는 식품 라벨/뒷면일 수 있습니다. 보이는 한글/숫자만 근거로 JSON 한 개만 출력하세요. 키: name(제품명), unit(용량·규격 문자열, 없으면 null), price_won(원 단위 가격 숫자, 없으면 null), barcode(바코드 숫자만, 없으면 null), manufacturer(제조사, 없으면 null), ingredients_text(원재료/성분 요약, 없으면 null). 확실하지 않으면 null.',
            },
          ],
        },
      ],
    }),
  }).catch(() => null)
  clearTimeout(timeout)
  if (!res) return { ok: false, error: 'Vision API 타임아웃' }

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    return { ok: false, error: `Vision API 오류: ${res.status} ${t.slice(0, 200)}` }
  }

  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = body.content?.find((c) => c.type === 'text')?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { ok: false, error: '이미지에서 JSON을 읽지 못했습니다.' }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
  } catch {
    return { ok: false, error: 'Vision 응답 파싱 실패' }
  }

  const name = parsed.name != null ? String(parsed.name).trim() || null : null
  const unit = parsed.unit != null ? String(parsed.unit).trim() || null : null
  const priceRaw = parsed.price_won
  const price_won =
    typeof priceRaw === 'number' && Number.isFinite(priceRaw)
      ? Math.round(priceRaw)
      : typeof priceRaw === 'string' && /^\d+$/.test(priceRaw.trim())
        ? parseInt(priceRaw.trim(), 10)
        : null

  const barcodeVision =
    parsed.barcode != null ? String(parsed.barcode).replace(/\D/g, '') || null : null
  const manufacturer = parsed.manufacturer != null ? String(parsed.manufacturer).trim() || null : null
  const ingredients_text =
    parsed.ingredients_text != null ? String(parsed.ingredients_text).trim() || null : null

  const raw_notes = [
    manufacturer ? `제조사: ${manufacturer}` : null,
    ingredients_text,
    barcodeVision ? `바코드: ${barcodeVision}` : null,
  ]
    .filter(Boolean)
    .join('\n') || null

  return {
    ok: true,
    data: { name, unit, price_won, barcode: barcodeVision, manufacturer, ingredients_text, raw_notes },
  }
}
