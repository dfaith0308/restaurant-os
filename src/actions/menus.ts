'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase-server'
import { getTenantId } from '@/lib/get-restaurant'
import { getIngredientPriceAtDate } from '@/actions/ingredients'
import type { ActionResult } from '@/types'

export interface MenuIngredientRow {
  id: string
  ingredient_id: string
  ingredient_name: string
  ingredient_unit: string | null
  ingredient_current_price: number | null
  quantity: number
  unit: string | null
}

export interface MenuWithCost {
  id: string
  tenant_id: string
  name: string
  price: number
  category: string | null
  memo: string | null
  is_representative: boolean
  is_active: boolean
  created_at: string
  updated_at: string | null
  ingredients: MenuIngredientRow[]
  calculated_cost: number
  margin_rate: number | null
}

function isValidCalculationDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  )
}

function resolveMenuCalculationDate(calculationDate?: string): string {
  if (calculationDate && isValidCalculationDate(calculationDate)) {
    return calculationDate
  }
  return new Date().toISOString().slice(0, 10)
}

function computeCost(rows: MenuIngredientRow[]): number {
  let sum = 0
  for (const r of rows) {
    const p = r.ingredient_current_price
    if (p == null) continue
    const q = Number.isFinite(r.quantity) ? r.quantity : 0
    sum += Math.round(p * q)
  }
  return sum
}

function computeMarginRate(price: number, cost: number): number | null {
  if (!Number.isFinite(price) || price <= 0) return null
  return ((price - cost) / price) * 100
}

type MenuIngredientJoinRow = {
  id: string
  menu_id: string
  ingredient_id: string
  quantity: number | string | null
  unit: string | null
  ingredients:
    | { name?: string | null; unit?: string | null }
    | Array<{ name?: string | null; unit?: string | null }>
    | null
}

async function buildMenuIngredientsWithPrices(
  miRaw: MenuIngredientJoinRow[] | null | undefined,
  calculationDate: string,
): Promise<Map<string, MenuIngredientRow[]>> {
  const drafts: Array<{
    menu_id: string
    row: Omit<MenuIngredientRow, 'ingredient_current_price'>
  }> = []

  for (const row of miRaw ?? []) {
    const ingRaw = row.ingredients
    const ing = (Array.isArray(ingRaw) ? ingRaw[0] : ingRaw) as {
      name?: string | null
      unit?: string | null
    } | null
    const quantityNum =
      typeof row.quantity === 'number' ? row.quantity : Number(row.quantity ?? 0)
    const quantity = Number.isFinite(quantityNum) ? quantityNum : 0
    if (!(quantity > 0)) continue

    drafts.push({
      menu_id: row.menu_id,
      row: {
        id: row.id,
        ingredient_id: row.ingredient_id,
        ingredient_name: ing?.name ?? '(삭제됨)',
        ingredient_unit: ing?.unit ?? null,
        quantity,
        unit: row.unit ?? null,
      },
    })
  }

  const uniqueIngredientIds = [
    ...new Set(drafts.map((d) => d.row.ingredient_id).filter(Boolean)),
  ]
  const priceByIngredient = new Map<string, number | null>()
  await Promise.all(
    uniqueIngredientIds.map(async (ingredientId) => {
      const price = await getIngredientPriceAtDate(ingredientId, calculationDate)
      priceByIngredient.set(ingredientId, price)
    }),
  )

  const byMenu = new Map<string, MenuIngredientRow[]>()
  for (const { menu_id, row } of drafts) {
    const item: MenuIngredientRow = {
      ...row,
      ingredient_current_price:
        priceByIngredient.get(row.ingredient_id) ?? null,
    }
    const arr = byMenu.get(menu_id) ?? []
    arr.push(item)
    byMenu.set(menu_id, arr)
  }

  return byMenu
}

async function assertRepresentativeLimit(supabase: any, tenant_id: string, nextIsRepresentative: boolean, excludingMenuId?: string) {
  if (!nextIsRepresentative) return

  const q = supabase
    .from('menus')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id)
    .eq('is_active', true)
    .eq('is_representative', true)

  const { count, error } = excludingMenuId
    ? await q.neq('id', excludingMenuId)
    : await q

  if (error) throw new Error(error.message)
  if ((count ?? 0) >= 3) throw new Error('대표메뉴는 최대 3개까지 선택할 수 있습니다.')
}

export async function getMenus(): Promise<ActionResult<MenuWithCost[]>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요', data: [] }

  // menus
  const { data: menusRaw, error: menusErr } = await supabase
    .from('menus')
    .select('id, tenant_id, name, price, category, memo, is_representative, is_active, created_at, updated_at')
    .eq('tenant_id', tenant_id)
    .eq('is_active', true)
    .order('is_representative', { ascending: false })
    .order('created_at', { ascending: false })

  if (menusErr) return { success: false, error: menusErr.message, data: [] }
  const menus = (menusRaw ?? []) as any[]
  const ids = menus.map((m) => m.id).filter(Boolean)
  if (ids.length === 0) return { success: true, data: [] }

  const calculationDate = resolveMenuCalculationDate()

  const { data: miRaw, error: miErr } = await supabase
    .from('menu_ingredients')
    .select('id, menu_id, ingredient_id, quantity, unit, ingredients(name, unit)')
    .eq('tenant_id', tenant_id)
    .in('menu_id', ids)

  if (miErr) return { success: false, error: miErr.message, data: [] }

  const byMenu = await buildMenuIngredientsWithPrices(
    (miRaw ?? []) as MenuIngredientJoinRow[],
    calculationDate,
  )

  const result: MenuWithCost[] = menus.map((m) => {
    const ingredients = byMenu.get(m.id) ?? []
    const calculated_cost = computeCost(ingredients)
    const margin_rate = computeMarginRate(m.price ?? 0, calculated_cost)
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      name: m.name,
      price: m.price ?? 0,
      category: m.category ?? null,
      memo: m.memo ?? null,
      is_representative: !!m.is_representative,
      is_active: !!m.is_active,
      created_at: m.created_at,
      updated_at: m.updated_at ?? null,
      ingredients,
      calculated_cost,
      margin_rate,
    }
  })

  return { success: true, data: result }
}

export async function getInactiveMenus(): Promise<ActionResult<MenuWithCost[]>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요', data: [] }

  const { data: menusRaw, error: menusErr } = await supabase
    .from('menus')
    .select('id, tenant_id, name, price, category, memo, is_representative, is_active, created_at, updated_at')
    .eq('tenant_id', tenant_id)
    .eq('is_active', false)
    .order('is_representative', { ascending: false })
    .order('created_at', { ascending: false })

  if (menusErr) return { success: false, error: menusErr.message, data: [] }
  const menus = (menusRaw ?? []) as any[]
  const ids = menus.map((m) => m.id).filter(Boolean)
  if (ids.length === 0) return { success: true, data: [] }

  const calculationDate = resolveMenuCalculationDate()

  const { data: miRaw, error: miErr } = await supabase
    .from('menu_ingredients')
    .select('id, menu_id, ingredient_id, quantity, unit, ingredients(name, unit)')
    .eq('tenant_id', tenant_id)
    .in('menu_id', ids)

  if (miErr) return { success: false, error: miErr.message, data: [] }

  const byMenu = await buildMenuIngredientsWithPrices(
    (miRaw ?? []) as MenuIngredientJoinRow[],
    calculationDate,
  )

  const result: MenuWithCost[] = menus.map((m) => {
    const ingredients = byMenu.get(m.id) ?? []
    const calculated_cost = computeCost(ingredients)
    const margin_rate = computeMarginRate(m.price ?? 0, calculated_cost)
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      name: m.name,
      price: m.price ?? 0,
      category: m.category ?? null,
      memo: m.memo ?? null,
      is_representative: !!m.is_representative,
      is_active: !!m.is_active,
      created_at: m.created_at,
      updated_at: m.updated_at ?? null,
      ingredients,
      calculated_cost,
      margin_rate,
    }
  })

  return { success: true, data: result }
}

export async function createMenu(input: {
  name: string
  category?: string | null
  price: number
  is_representative?: boolean
  memo?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const name = (input.name ?? '').trim()
  if (!name) return { success: false, error: '메뉴명은 필수입니다.' }

  const price = Number.isFinite(input.price) ? Math.max(0, Math.floor(input.price)) : 0
  const isRep = !!input.is_representative

  try {
    await assertRepresentativeLimit(supabase, tenant_id, isRep)
  } catch (e: any) {
    return { success: false, error: e?.message ?? '대표메뉴 제한 오류' }
  }

  const { data, error } = await supabase
    .from('menus')
    .insert({
      tenant_id,
      name,
      price,
      category: input.category?.trim() || null,
      is_representative: isRep,
      is_active: true,
      memo: input.memo?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

  revalidatePath('/settings/menus')
  return { success: true, data: { id: data.id } }
}

export async function updateMenu(
  id: string,
  input: {
    name: string
    category?: string | null
    price: number
    is_representative?: boolean
    memo?: string | null
  },
): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const name = (input.name ?? '').trim()
  if (!name) return { success: false, error: '메뉴명은 필수입니다.' }

  const price = Number.isFinite(input.price) ? Math.max(0, Math.floor(input.price)) : 0
  const isRep = !!input.is_representative

  try {
    await assertRepresentativeLimit(supabase, tenant_id, isRep, id)
  } catch (e: any) {
    return { success: false, error: e?.message ?? '대표메뉴 제한 오류' }
  }

  const { error } = await supabase
    .from('menus')
    .update({
      name,
      price,
      category: input.category?.trim() || null,
      is_representative: isRep,
      memo: input.memo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/settings/menus')
  return { success: true }
}

export async function deactivateMenu(id: string): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const { error } = await supabase
    .from('menus')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/settings/menus')
  return { success: true }
}

export async function activateMenu(id: string): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const { error } = await supabase
    .from('menus')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/settings/menus')
  return { success: true }
}

export async function addMenuIngredient(input: {
  menu_id: string
  ingredient_id: string
  quantity: number
  unit?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const quantity = Number.isFinite(input.quantity) ? Number(input.quantity) : 0
  if (!input.menu_id) return { success: false, error: 'menu_id가 필요합니다.' }
  if (!input.ingredient_id) return { success: false, error: 'ingredient_id가 필요합니다.' }
  if (!(quantity > 0)) return { success: false, error: '수량은 0보다 커야 합니다.' }

  const { data, error } = await supabase
    .from('menu_ingredients')
    .insert({
      tenant_id,
      menu_id: input.menu_id,
      ingredient_id: input.ingredient_id,
      quantity,
      unit: input.unit?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }
  revalidatePath('/settings/menus')
  return { success: true, data: { id: data.id } }
}

// RULE-10 준수: 물리 삭제 대신 quantity=0으로 "제외" 처리
export async function removeMenuIngredient(id: string): Promise<ActionResult> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요' }

  const { error } = await supabase
    .from('menu_ingredients')
    .update({ quantity: 0 })
    .eq('id', id)
    .eq('tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/settings/menus')
  return { success: true }
}

export interface MenuCostEstimateIngredients {
  cost_range_min?: number | null
  cost_range_max?: number | null
  main_ingredients?: string[]
  hidden_cost_note?: string | null
}

export interface MenuCostEstimateData {
  menu_name: string
  estimated_cost: number | null
  estimated_ingredients: MenuCostEstimateIngredients | null
  source: 'gpt' | 'internal'
  confidence_level: number | null
  updated_at: string
  cost_range_min: number | null
  cost_range_max: number | null
  main_ingredients: string[]
  hidden_cost_note: string | null
}

type MenuCostCacheRow = {
  menu_name: string
  estimated_cost: number | null
  estimated_ingredients: unknown
  source: 'gpt' | 'internal'
  confidence_level: number | null
  updated_at: string
}

interface GptMenuCostPayload {
  estimated_cost: number
  cost_range_min: number
  cost_range_max: number
  main_ingredients: string[]
  hidden_cost_note: string
}

const MENU_COST_GPT_SYSTEM_PROMPT = `당신은 한국 외식업에서 10년 이상 메뉴 원가·메뉴판을 다뤄온 운영자 관점의 원가 감각 전문가입니다. 레시피 계산기·영양사·일반 음식 설명 AI가 아닙니다.

목표: 사장님이 "이 메뉴 1인분, 대충 얼마 나가지?"를 현장에서 믿을 만한 수준으로 감 잡게 돕습니다. 정확도 100%보다 현실감·신뢰가 우선입니다.

[메뉴명 전체 해석 — 반드시 수행]
메뉴명의 모든 단어·형태를 합쳐 해석하세요. 단어 하나만 보지 마세요.
- 정식/세트/곱빼기/대·중·소/1인분/2인분
- 탕·찌개·국밥·덮밥·볶음·구이·조림·전·안주·배달·포장
- 특수부위·프리미엄(가브리살, 한우, 활어 등)
예: "가브리살 보쌈정식" → 보쌈 한 접시가 아니라 1인 정식(고기+쌈+밥+반찬 구조).
예: "갈치조림" → 갈치(핵심 단백질), 무·양념은 부재료, 밥·반찬 포함 가능성.

[판매가가 주어지면 — 현실 보정 필수]
판매가 대비 원가는 일반 한국 식당에서 대체로 판매가의 30~50% 중심(원가율 30~50%)으로 운영 가능해야 합니다.
판매가 15,000원인데 원가 14,000원처럼 비현실적으로 높게 잡지 마세요.
프리미엄·특수부위·정식·세트는 상한을 넓혀도 되나, "이 가격에 이 메뉴를 파는 식당"이 성립해야 합니다.

[main_ingredients 규칙]
원가 비중이 큰 핵심 재료만 3~6개, 짧은 한글명.
양념·조미료·소금·마늘·식용유만 나열하지 마세요. 배추만 있는 보쌈도 피하세요.
예: 가브리살 보쌈정식 → 가브리살, 쌈채소, 공깃밥 (O) / 배추, 마늘, 소금 (X)
예: 갈치조림 → 갈치, 무 (O)

[hidden_cost_note 규칙]
메뉴 유형에 맞는 한 줄. 너무 일반적인 문구 금지.
- 정식/한상 → 공깃밥·국·기본반찬·반찬 리필
- 고기/보쌈/삼겹 → 쌈채소·소스·밑반찬
- 탕/찌개/국밥 → 육수·반찬·공깃밥
- 배달/포장 → 용기·뚜껑·배달 수수료 감안
- 안주 → 술집 마진·곁들임 반찬

[추정 방식]
- 중소형 일반 한국 식당 1인분 기준
- 지역·등급 편차는 cost_range로 표현
- 레시피 g 단위 정밀 계산 금지

응답은 JSON 객체 하나만. 다른 텍스트·마크다운 금지.

JSON 스키마:
{
  "estimated_cost": number,
  "cost_range_min": number,
  "cost_range_max": number,
  "main_ingredients": string[],
  "hidden_cost_note": string
}`

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value))
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Math.max(0, parseInt(value.trim(), 10))
  return null
}

function parseEstimatedIngredients(raw: unknown): MenuCostEstimateIngredients {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const main = Array.isArray(o.main_ingredients)
    ? o.main_ingredients.map((x) => String(x).trim()).filter(Boolean)
    : undefined
  const note =
    o.hidden_cost_note != null ? String(o.hidden_cost_note).trim() || null : undefined
  return {
    cost_range_min: parsePositiveInt(o.cost_range_min),
    cost_range_max: parsePositiveInt(o.cost_range_max),
    main_ingredients: main,
    hidden_cost_note: note,
  }
}

function mapCacheRowToEstimate(row: MenuCostCacheRow): MenuCostEstimateData {
  const ing = parseEstimatedIngredients(row.estimated_ingredients)
  return {
    menu_name: row.menu_name,
    estimated_cost: row.estimated_cost,
    estimated_ingredients: Object.keys(ing).length > 0 ? ing : null,
    source: row.source,
    confidence_level: row.confidence_level,
    updated_at: row.updated_at,
    cost_range_min: ing.cost_range_min ?? null,
    cost_range_max: ing.cost_range_max ?? null,
    main_ingredients: ing.main_ingredients ?? [],
    hidden_cost_note: ing.hidden_cost_note ?? null,
  }
}

function parseGptMenuCostJson(text: string): GptMenuCostPayload | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const o = JSON.parse(match[0]) as Record<string, unknown>
    const estimated_cost = parsePositiveInt(o.estimated_cost)
    const cost_range_min = parsePositiveInt(o.cost_range_min)
    const cost_range_max = parsePositiveInt(o.cost_range_max)
    if (estimated_cost == null || estimated_cost <= 0) return null
    const main_ingredients = Array.isArray(o.main_ingredients)
      ? o.main_ingredients.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)
      : []
    const hidden_cost_note =
      (o.hidden_cost_note != null ? String(o.hidden_cost_note).trim() : '') ||
      '공깃밥·기본반찬 포함 시 실제 원가는 더 높을 수 있습니다.'
    const min = cost_range_min ?? estimated_cost
    const max = cost_range_max ?? estimated_cost
    return {
      estimated_cost,
      cost_range_min: Math.min(min, max),
      cost_range_max: Math.max(min, max),
      main_ingredients,
      hidden_cost_note,
    }
  } catch {
    return null
  }
}

function buildMenuCostGptUserMessage(menuName: string, sellingPrice?: number | null): string {
  const priceLine =
    sellingPrice != null && sellingPrice > 0
      ? `\n판매가: ${Math.round(sellingPrice)}원`
      : ''
  return `다음 메뉴의 1인분 예상 원가 감을 JSON으로 알려주세요.\n메뉴명: ${menuName}${priceLine}`
}

async function fetchMenuCostFromGpt(
  menuName: string,
  sellingPrice?: number | null,
): Promise<GptMenuCostPayload | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: MENU_COST_GPT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildMenuCostGptUserMessage(menuName, sellingPrice),
        },
      ],
    }),
  }).catch(() => null)
  clearTimeout(timeout)
  if (!res?.ok) return null

  const body = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>
  } | null
  const content = body?.choices?.[0]?.message?.content ?? ''
  if (!content) return null
  return parseGptMenuCostJson(content)
}

export async function getMenuCostEstimate(
  menu_name: string,
  sellingPrice?: number | null,
): Promise<ActionResult<MenuCostEstimateData | null>> {
  const supabase = await createServerClient()
  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return { success: false, error: '인증 필요', data: null }

  const name = (menu_name ?? '').trim()
  if (!name) return { success: true, data: null }

  const selectCols =
    'menu_name, estimated_cost, estimated_ingredients, source, confidence_level, updated_at'

  const { data: exact, error: e1 } = await supabase
    .from('menu_cost_cache')
    .select(selectCols)
    .eq('tenant_id', tenant_id)
    .eq('menu_name', name)
    .maybeSingle()

  if (e1) return { success: false, error: e1.message, data: null }
  if (exact) return { success: true, data: mapCacheRowToEstimate(exact as MenuCostCacheRow) }

  const { data: like, error: e2 } = await supabase
    .from('menu_cost_cache')
    .select(selectCols)
    .eq('tenant_id', tenant_id)
    .ilike('menu_name', `%${name}%`)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (e2) return { success: false, error: e2.message, data: null }
  if (like?.[0]) return { success: true, data: mapCacheRowToEstimate(like[0] as MenuCostCacheRow) }

  const gpt = await fetchMenuCostFromGpt(name, sellingPrice)
  if (!gpt) return { success: true, data: null }

  const estimated_ingredients: MenuCostEstimateIngredients = {
    cost_range_min: gpt.cost_range_min,
    cost_range_max: gpt.cost_range_max,
    main_ingredients: gpt.main_ingredients,
    hidden_cost_note: gpt.hidden_cost_note,
  }
  const updated_at = new Date().toISOString()

  await supabase.from('menu_cost_cache').upsert(
    {
      tenant_id,
      menu_name: name,
      estimated_cost: gpt.estimated_cost,
      estimated_ingredients,
      source: 'gpt',
      confidence_level: 70,
      updated_at,
    },
    { onConflict: 'tenant_id,menu_name' },
  )

  return {
    success: true,
    data: {
      menu_name: name,
      estimated_cost: gpt.estimated_cost,
      estimated_ingredients,
      source: 'gpt',
      confidence_level: 70,
      updated_at,
      cost_range_min: gpt.cost_range_min,
      cost_range_max: gpt.cost_range_max,
      main_ingredients: gpt.main_ingredients,
      hidden_cost_note: gpt.hidden_cost_note,
    },
  }
}

