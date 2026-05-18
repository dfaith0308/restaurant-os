import type { IngredientRow } from '@/actions/ingredients'
import { normalizeIngredientName } from '@/lib/ingredient-canonical'
import type { OrderParsedLine } from '@/types'

export type ParsedOrderLineDraft = {
  raw_name: string
  normalized_name: string
  quantity_text: string
}

function stripJsonFence(text: string): string {
  const t = text.trim()
  if (t.startsWith('```')) {
    const without = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '')
    return without.trim()
  }
  return t
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function coerceDrafts(parsed: unknown): ParsedOrderLineDraft[] | null {
  if (!Array.isArray(parsed)) return null
  const out: ParsedOrderLineDraft[] = []
  for (const row of parsed) {
    if (!row || typeof row !== 'object') return null
    const o = row as Record<string, unknown>
    if (
      !isNonEmptyString(o.raw_name) ||
      !isNonEmptyString(o.normalized_name) ||
      !isNonEmptyString(o.quantity_text)
    ) {
      return null
    }
    out.push({
      raw_name: o.raw_name.trim(),
      normalized_name: o.normalized_name.trim(),
      quantity_text: o.quantity_text.trim(),
    })
  }
  return out.length > 0 ? out : null
}

/**
 * 주문 메모를 GPT로 최소 구조화. 실패 시 null (원문만 유지).
 * — temperature 0.1, 짧은 max_tokens, JSON 배열만.
 */
export async function parseOrderBodyWithMiniModel(
  orderText: string,
): Promise<ParsedOrderLineDraft[] | null> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return null

  const trimmed = orderText.trim()
  if (trimmed.length < 2) return null

  const system =
    'You extract purchase line items from Korean restaurant supplier chat text. ' +
    'Reply with ONLY a JSON array (no markdown, no prose). ' +
    'Each element must be an object with keys: raw_name (string), normalized_name (Korean product name only, no numbers/units), quantity_text (string, e.g. "1박스", "5kg"). ' +
    'If the text has no clear items, return [].'

  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 500,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: trimmed },
        ],
      }),
    })
  } catch {
    return null
  }

  if (!res.ok) return null

  let data: unknown
  try {
    data = await res.json()
  } catch {
    return null
  }

  const content = (data as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content
  if (typeof content !== 'string') return null

  const jsonText = stripJsonFence(content)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText) as unknown
  } catch {
    const i0 = jsonText.indexOf('[')
    const i1 = jsonText.lastIndexOf(']')
    if (i0 === -1 || i1 <= i0) return null
    try {
      parsed = JSON.parse(jsonText.slice(i0, i1 + 1)) as unknown
    } catch {
      return null
    }
  }

  return coerceDrafts(parsed)
}

function findIngredientMatchName(
  normalizedDisplay: string,
  pool: IngredientRow[],
): string | null {
  const key = normalizeIngredientName(normalizedDisplay)
  if (!key) return null
  for (const row of pool) {
    if (normalizeIngredientName(row.name) === key) {
      return row.name
    }
  }
  return null
}

export function attachIngredientMatches(
  drafts: ParsedOrderLineDraft[],
  pool: IngredientRow[],
): OrderParsedLine[] {
  return drafts.map((d) => ({
    raw_name: d.raw_name,
    normalized_name: d.normalized_name,
    quantity_text: d.quantity_text,
    ingredient_match: findIngredientMatchName(d.normalized_name, pool),
  }))
}
