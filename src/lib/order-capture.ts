import type {
  Order,
  OrderOperationCapture,
  OrderOperationCaptureSource,
  OrderParsedLine,
} from '@/types'
import { normalizeIngredientName } from '@/lib/ingredient-canonical'

const ORDER_CAPTURE_PREFIX = '__ORDER_CAPTURE_V1__\n' as const

function coerceOrderParsedItems(raw: unknown): OrderParsedLine[] | null {
  if (raw === undefined || raw === null) return null
  if (!Array.isArray(raw)) return null
  const out: OrderParsedLine[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null
    const o = row as Record<string, unknown>
    const raw_name = typeof o.raw_name === 'string' ? o.raw_name.trim() : ''
    const normalized_name =
      typeof o.normalized_name === 'string' ? o.normalized_name.trim() : ''
    const quantity_text =
      typeof o.quantity_text === 'string' ? o.quantity_text.trim() : ''
    if (!raw_name || !normalized_name || !quantity_text) return null
    const im = o.ingredient_match
    const ingredient_match =
      im === null || im === undefined
        ? null
        : typeof im === 'string' && im.trim().length > 0
          ? im.trim()
          : null
    out.push({
      raw_name,
      normalized_name,
      quantity_text,
      ingredient_match,
    })
  }
  return out.length > 0 ? out : null
}

export function tryReuseParsedItemsFromProductNames(
  recentProductNames: string[],
  body: string,
): OrderParsedLine[] | null {
  const target = body.trim()
  if (!target) return null
  for (const pn of recentProductNames) {
    const cap = tryDecodeOrderCaptureFromProductName(pn)
    if (!cap) continue
    if (cap.body.trim() !== target) continue
    if (cap.parsed_items && cap.parsed_items.length > 0) {
      return cap.parsed_items
    }
  }
  return null
}

export interface TodayOrderParseInsights {
  kakao_line_count_today: number
  unmatched_lines_today: number
  recent_top_labels: { label: string; count: number }[]
  repeat_unlinked: { name: string; count: number }[]
  kakao_orders_today: number
  repeat_order_items: { label: string; count: number }[]
  registration_candidates: { name: string; count: number }[]
  preparation_needed_order_count: number
  repeat_order_item_distinct_count: number
}

export interface OrderPreparationSummary {
  linked_count: number
  unlinked_count: number
  preparation_item_count: number
}

export interface OrderPreparationLineView {
  line: OrderParsedLine
  recent_supplier: string | null
  is_repeat_unlinked: boolean
}

export function buildOrderPreparationSummary(
  items: OrderParsedLine[] | null | undefined,
): OrderPreparationSummary {
  if (!items?.length) {
    return { linked_count: 0, unlinked_count: 0, preparation_item_count: 0 }
  }
  let linked_count = 0
  let unlinked_count = 0
  for (const line of items) {
    if (line.ingredient_match) linked_count += 1
    else unlinked_count += 1
  }
  return {
    linked_count,
    unlinked_count,
    preparation_item_count: linked_count,
  }
}

export function resolveRecentSupplierForLine(
  line: OrderParsedLine,
  ocrSupplierByCanonical: Record<string, string>,
  ingredientSupplierByName: Record<string, string | null>,
): string | null {
  const keys: string[] = []
  if (line.ingredient_match) {
    keys.push(normalizeIngredientName(line.ingredient_match))
  }
  const norm = normalizeIngredientName(line.normalized_name)
  if (norm) keys.push(norm)
  for (const key of keys) {
    if (key && ocrSupplierByCanonical[key]) {
      return ocrSupplierByCanonical[key]
    }
  }
  if (line.ingredient_match) {
    const fromIng = ingredientSupplierByName[line.ingredient_match]
    if (fromIng) return fromIng
  }
  return null
}

export function buildOrderPreparationLineViews(
  items: OrderParsedLine[],
  ocrSupplierByCanonical: Record<string, string>,
  ingredientSupplierByName: Record<string, string | null>,
  repeatUnlinkedKeys: ReadonlySet<string>,
): OrderPreparationLineView[] {
  return items.map((line) => {
    const key =
      normalizeIngredientName(line.normalized_name) ||
      line.normalized_name.trim().toLowerCase()
    const is_repeat_unlinked =
      !line.ingredient_match && repeatUnlinkedKeys.has(key)
    return {
      line,
      recent_supplier: resolveRecentSupplierForLine(
        line,
        ocrSupplierByCanonical,
        ingredientSupplierByName,
      ),
      is_repeat_unlinked,
    }
  })
}

export function buildRepeatUnlinkedKeySet(
  orders: Order[],
): Set<string> {
  const unlinkedKeyCounts = new Map<string, number>()
  for (const o of orders) {
    const cap = o.operation_capture
    if (!cap?.parsed_items?.length) continue
    if (!isWithinDaysOrder(o.created_at, 7)) continue
    for (const line of cap.parsed_items) {
      if (line.ingredient_match) continue
      const key =
        normalizeIngredientName(line.normalized_name) ||
        line.normalized_name.trim().toLowerCase()
      if (!key) continue
      unlinkedKeyCounts.set(key, (unlinkedKeyCounts.get(key) ?? 0) + 1)
    }
  }
  const out = new Set<string>()
  for (const [key, count] of unlinkedKeyCounts) {
    if (count >= 3) out.add(key)
  }
  return out
}

function seoulYmd(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function isTodaySeoul(iso: string): boolean {
  return seoulYmd(iso) === seoulYmd(new Date().toISOString())
}

function isWithinDaysOrder(iso: string, days: number): boolean {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() - t <= days * 86400000
}

export function buildTodayOrderParseInsights(
  orders: Order[],
): TodayOrderParseInsights {
  const sorted = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at))

  let kakao_line_count_today = 0
  let unmatched_lines_today = 0
  let kakao_orders_today = 0
  let preparation_needed_order_count = 0

  const labelCounts7d = new Map<string, number>()
  const unlinkedKeyCounts = new Map<string, { display: string; count: number }>()

  for (const o of sorted) {
    const cap = o.operation_capture
    if (!cap?.parsed_items?.length) continue

    if (o.status === 'confirmed') {
      preparation_needed_order_count += 1
    }

    const isKakaoToday =
      cap.source === 'kakao' && isTodaySeoul(o.created_at)
    if (isKakaoToday) {
      kakao_orders_today += 1
    }

    const in7d = isWithinDaysOrder(o.created_at, 7)
    for (const line of cap.parsed_items) {
      const label = line.normalized_name.trim()
      if (!label) continue
      if (in7d) {
        labelCounts7d.set(label, (labelCounts7d.get(label) ?? 0) + 1)
      }
      if (isKakaoToday) {
        kakao_line_count_today += 1
        if (!line.ingredient_match) {
          unmatched_lines_today += 1
        }
      }
      if (!line.ingredient_match && in7d) {
        const key =
          normalizeIngredientName(line.normalized_name) ||
          label.toLowerCase().replace(/\s+/g, '')
        const prev = unlinkedKeyCounts.get(key)
        unlinkedKeyCounts.set(key, {
          display: label,
          count: (prev?.count ?? 0) + 1,
        })
      }
    }
  }

  const recent_top_labels = [...labelCounts7d.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => ({ label, count }))

  const repeat_order_items = [...labelCounts7d.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }))

  const repeat_unlinked = [...unlinkedKeyCounts.values()]
    .filter((x) => x.count >= 3)
    .map((x) => ({ name: x.display, count: x.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const registration_candidates = repeat_unlinked.map((x) => ({
    name: x.name,
    count: x.count,
  }))

  const repeat_order_item_distinct_count = [...labelCounts7d.values()].filter(
    (c) => c >= 2,
  ).length

  return {
    kakao_line_count_today,
    unmatched_lines_today,
    recent_top_labels,
    repeat_unlinked,
    kakao_orders_today,
    repeat_order_items,
    registration_candidates,
    preparation_needed_order_count,
    repeat_order_item_distinct_count,
  }
}

const ORDER_CAPTURE_SOURCES: readonly OrderOperationCaptureSource[] = [
  'kakao',
  'phone',
  'manual',
  'invoice',
] as const

function isOrderCaptureSource(v: string): v is OrderOperationCaptureSource {
  return (ORDER_CAPTURE_SOURCES as readonly string[]).includes(v)
}

export function encodeOrderCaptureProductName(capture: OrderOperationCapture): string {
  const metaPayload: {
    v: number
    source: OrderOperationCaptureSource
    cp: string
    parsed_items?: OrderParsedLine[]
  } = {
    v: 1,
    source: capture.source,
    cp: capture.counterparty.trim(),
  }
  if (capture.parsed_items && capture.parsed_items.length > 0) {
    metaPayload.parsed_items = capture.parsed_items
  }
  const meta = JSON.stringify(metaPayload)
  const body = (capture.body ?? '').trim()
  return `${ORDER_CAPTURE_PREFIX}${meta}\n${body.length > 0 ? body : ' '}`
}

export function tryDecodeOrderCaptureFromProductName(
  product_name: string,
): OrderOperationCapture | null {
  if (!product_name.startsWith(ORDER_CAPTURE_PREFIX)) return null
  const rest = product_name.slice(ORDER_CAPTURE_PREFIX.length)
  const nl = rest.indexOf('\n')
  if (nl === -1) return null
  const metaLine = rest.slice(0, nl)
  const body = rest.slice(nl + 1).trimEnd()
  try {
    const meta = JSON.parse(metaLine) as {
      v?: number
      source?: string
      cp?: string
      parsed_items?: unknown
    }
    if (meta.v !== 1 || typeof meta.cp !== 'string' || !meta.source) return null
    if (!isOrderCaptureSource(meta.source)) return null
    const parsed_items =
      meta.parsed_items === undefined || meta.parsed_items === null
        ? null
        : coerceOrderParsedItems(meta.parsed_items)
    return {
      source: meta.source,
      counterparty: meta.cp,
      body: body.trim().length > 0 ? body : '',
      parsed_items,
    }
  } catch {
    return null
  }
}

export function formatCaptureSourceLabel(source: OrderOperationCaptureSource): string {
  if (source === 'kakao') return '카카오 주문'
  if (source === 'phone') return '전화 주문'
  if (source === 'manual') return '직접 입력'
  return '거래명세서 주문'
}

export interface OrderRecentActivityItem {
  id: string
  counterparty_name: string
  source_label: string
  created_at: string
}

export interface OrderOperationInsights {
  /** 납품 대기 중인 흡수 주문(operation_capture) 건수 */
  unconfirmed_capture_count: number
  /** 최근 7일 카카오 흡수 주문 건수 */
  kakao_capture_last_7_days: number
  /** 최근 흡수 20건 중 전화·수기 비중이 높은지 (운영 힌트) */
  off_platform_ratio_high: boolean
}

function isWithinDays(isoDate: string, days: number): boolean {
  const t = new Date(isoDate).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() - t <= days * 86400000
}

export function buildRecentOrderActivities(
  orders: Order[],
  limit: number,
): OrderRecentActivityItem[] {
  const sorted = [...orders].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )
  const out: OrderRecentActivityItem[] = []
  for (const o of sorted) {
    if (out.length >= limit) break
    const cap = o.operation_capture
    out.push({
      id: o.id,
      counterparty_name: o.counterparty_name || '거래처 미입력',
      source_label: cap ? formatCaptureSourceLabel(cap.source) : '플랫폼 발주',
      created_at: o.created_at,
    })
  }
  return out
}

export function buildOrderOperationInsights(orders: Order[]): OrderOperationInsights {
  const sorted = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const captures = sorted.filter((o) => o.operation_capture != null)
  const unconfirmed_capture_count = sorted.filter(
    (o) => o.status === 'confirmed' && o.operation_capture != null,
  ).length
  const kakao_capture_last_7_days = sorted.filter(
    (o) =>
      o.operation_capture?.source === 'kakao' && isWithinDays(o.created_at, 7),
  ).length

  const recentCaps = captures.slice(0, 20)
  const denom = recentCaps.length
  let off_platform_ratio_high = false
  if (denom >= 3) {
    const off = recentCaps.filter(
      (o) =>
        o.operation_capture?.source === 'phone' ||
        o.operation_capture?.source === 'manual',
    ).length
    off_platform_ratio_high = off / denom >= 0.6
  }

  return {
    unconfirmed_capture_count,
    kakao_capture_last_7_days,
    off_platform_ratio_high,
  }
}

export type SupplierFlowRow = {
  supplier_name: string
  count: number
}

export type SupplierPriceRiskView = {
  supplier_name: string
  ingredients: { name: string; change_percent: number }[]
  max_change_percent: number
}

export type SupplierDependencyRow = {
  ingredient_name: string
  supplier_name: string
  ocr_count: number
}

export type ActiveSupplierRow = {
  supplier_name: string
  count: number
  is_recently_active: boolean
}

export type TodaySupplierSummary = {
  active_supplier_count: number
  price_risk_supplier_count: number
  repeat_connection_supplier_count: number
  dependency_ingredient_count: number
}

export type TodaySupplierOperationInsights = {
  summary: TodaySupplierSummary
  top_combined: SupplierFlowRow[]
  top_ocr: SupplierFlowRow[]
  top_order_linked: SupplierFlowRow[]
  price_risk_suppliers: SupplierPriceRiskView[]
  dependency_ingredients: SupplierDependencyRow[]
  top_active_suppliers_7d: ActiveSupplierRow[]
}

type OcrActivityRef = {
  supplier_name: string
  ingredient_name: string
  occurred_at: string
}

type MenuHubInput = {
  id: string
  name: string
  operation_risk_level: 'normal' | 'warning' | 'danger'
  margin_rate: number | null
}

type IngredientsHubInput = {
  insights: { spike_count: number; ocr_last_7_days: number }
  top_spike_ingredients: Array<{
    ingredient_id: string
    name: string
    change_percent: number
  }>
  recentOcrActivities: OcrActivityRef[]
}

const MENU_RISK_ORDER = { danger: 0, warning: 1, normal: 2 } as const

export function buildTodayOperationHubFromMenusAndIngredients(
  menus: MenuHubInput[],
  ingOp: IngredientsHubInput | null,
): {
  risk_menu_count: number
  spike_ingredient_count: number
  ocr_recent_count: number
  avg_margin_rate: number | null
  top_risk_menus: Array<{
    id: string
    name: string
    operation_risk_level: MenuHubInput['operation_risk_level']
  }>
  top_spike_ingredients: IngredientsHubInput['top_spike_ingredients']
  recent_ocr: OcrActivityRef[]
} {
  const risk_menu_count = menus.filter((m) => m.operation_risk_level !== 'normal').length
  const margins = menus
    .map((m) => m.margin_rate)
    .filter((r): r is number => r != null && Number.isFinite(r))
  const avg_margin_rate =
    margins.length === 0
      ? null
      : Math.round(margins.reduce((a, b) => a + b, 0) / margins.length)

  const top_risk_menus = [...menus]
    .filter((m) => m.operation_risk_level !== 'normal')
    .sort(
      (a, b) =>
        MENU_RISK_ORDER[a.operation_risk_level] -
        MENU_RISK_ORDER[b.operation_risk_level],
    )
    .slice(0, 5)
    .map((m) => ({
      id: m.id,
      name: m.name,
      operation_risk_level: m.operation_risk_level,
    }))

  return {
    risk_menu_count,
    spike_ingredient_count: ingOp?.insights.spike_count ?? 0,
    ocr_recent_count: ingOp?.insights.ocr_last_7_days ?? 0,
    avg_margin_rate,
    top_risk_menus,
    top_spike_ingredients: ingOp?.top_spike_ingredients ?? [],
    recent_ocr: ingOp?.recentOcrActivities ?? [],
  }
}

type SupplierPriceRiskInput = {
  supplier_name: string
  ingredient_name: string
  change_percent: number
}

function normalizeSupplierKey(name: string): string {
  return name.trim().toLowerCase()
}

function incrementSupplierCount(
  map: Map<string, { display: string; count: number }>,
  supplierName: string,
  delta = 1,
): void {
  const display = supplierName.trim()
  if (!display) return
  const key = normalizeSupplierKey(display)
  const prev = map.get(key)
  map.set(key, {
    display: prev?.display ?? display,
    count: (prev?.count ?? 0) + delta,
  })
}

function mapToTopRows(
  map: Map<string, { display: string; count: number }>,
  limit: number,
): SupplierFlowRow[] {
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((x) => ({ supplier_name: x.display, count: x.count }))
}

function buildOcrSupplierCounts(
  activities: OcrActivityRef[],
  days: number,
): Map<string, { display: string; count: number }> {
  const map = new Map<string, { display: string; count: number }>()
  for (const row of activities) {
    if (!isWithinDaysOrder(row.occurred_at, days)) continue
    incrementSupplierCount(map, row.supplier_name)
  }
  return map
}

function buildOrderLinkedSupplierCounts(
  orders: Order[],
  ocrSupplierByCanonical: Record<string, string>,
  ingredientSupplierByName: Record<string, string | null>,
  days: number,
): Map<string, { display: string; count: number }> {
  const map = new Map<string, { display: string; count: number }>()
  for (const o of orders) {
    if (!isWithinDaysOrder(o.created_at, days)) continue
    const cap = o.operation_capture
    if (cap?.parsed_items?.length) {
      for (const line of cap.parsed_items) {
        const supplier = resolveRecentSupplierForLine(
          line,
          ocrSupplierByCanonical,
          ingredientSupplierByName,
        )
        if (supplier) incrementSupplierCount(map, supplier)
      }
      continue
    }
    const counterparty = (o.counterparty_name ?? '').trim()
    if (counterparty && cap) {
      incrementSupplierCount(map, counterparty)
    }
  }
  return map
}

function mergeSupplierCountMaps(
  a: Map<string, { display: string; count: number }>,
  b: Map<string, { display: string; count: number }>,
): Map<string, { display: string; count: number }> {
  const out = new Map(a)
  for (const [key, val] of b) {
    const prev = out.get(key)
    out.set(key, {
      display: prev?.display ?? val.display,
      count: (prev?.count ?? 0) + val.count,
    })
  }
  return out
}

function groupSupplierPriceRisks(
  risks: SupplierPriceRiskInput[],
): SupplierPriceRiskView[] {
  const bySupplier = new Map<
    string,
    { display: string; ingredients: { name: string; change_percent: number }[] }
  >()
  for (const row of risks) {
    const display = row.supplier_name.trim()
    if (!display) continue
    const key = normalizeSupplierKey(display)
    const prev = bySupplier.get(key)
    const ing = {
      name: row.ingredient_name,
      change_percent: row.change_percent,
    }
    if (prev) {
      prev.ingredients.push(ing)
    } else {
      bySupplier.set(key, { display, ingredients: [ing] })
    }
  }
  return [...bySupplier.values()]
    .map((x) => {
      const max_change_percent = Math.max(
        ...x.ingredients.map((i) => i.change_percent),
        0,
      )
      return {
        supplier_name: x.display,
        ingredients: x.ingredients
          .sort((a, b) => b.change_percent - a.change_percent)
          .slice(0, 3),
        max_change_percent,
      }
    })
    .sort((a, b) => b.max_change_percent - a.max_change_percent)
    .slice(0, 5)
}

function buildSupplierDependencyIngredients(
  activities: OcrActivityRef[],
): SupplierDependencyRow[] {
  const byCanonical = new Map<
    string,
    {
      displayIngredient: string
      latestAt: string
      suppliers: Map<string, { display: string; count: number }>
    }
  >()

  for (const row of activities) {
    if (!isWithinDaysOrder(row.occurred_at, 30)) continue
    const ingredient = row.ingredient_name.trim()
    if (!ingredient) continue
    const canonical =
      normalizeIngredientName(ingredient) || ingredient.toLowerCase()
    const supplier = row.supplier_name.trim()
    if (!supplier) continue

    let bucket = byCanonical.get(canonical)
    if (!bucket) {
      bucket = {
        displayIngredient: ingredient,
        latestAt: row.occurred_at,
        suppliers: new Map(),
      }
      byCanonical.set(canonical, bucket)
    }
    if (row.occurred_at >= bucket.latestAt) {
      bucket.displayIngredient = ingredient
      bucket.latestAt = row.occurred_at
    }
    incrementSupplierCount(bucket.suppliers, supplier)
  }

  const out: SupplierDependencyRow[] = []
  for (const bucket of byCanonical.values()) {
    if (bucket.suppliers.size !== 1) continue
    const only = [...bucket.suppliers.values()][0]
    if (only.count < 2) continue
    out.push({
      ingredient_name: bucket.displayIngredient,
      supplier_name: only.display,
      ocr_count: only.count,
    })
  }

  return out.sort((a, b) => b.ocr_count - a.ocr_count).slice(0, 5)
}

function countRepeatConnectionSuppliers(
  ocr7d: Map<string, { display: string; count: number }>,
  order7d: Map<string, { display: string; count: number }>,
): number {
  let count = 0
  const keys = new Set([...ocr7d.keys(), ...order7d.keys()])
  for (const key of keys) {
    const o = ocr7d.get(key)?.count ?? 0
    const r = order7d.get(key)?.count ?? 0
    if ((o > 0 && r > 0) || o + r >= 3) count += 1
  }
  return count
}

function buildActiveSuppliers7d(
  ocr7d: Map<string, { display: string; count: number }>,
  order7d: Map<string, { display: string; count: number }>,
): ActiveSupplierRow[] {
  const merged = mergeSupplierCountMaps(ocr7d, order7d)
  return [...merged.values()]
    .map((x) => {
      const o = ocr7d.get(normalizeSupplierKey(x.display))?.count ?? 0
      const r = order7d.get(normalizeSupplierKey(x.display))?.count ?? 0
      const is_recently_active =
        (o > 0 && r > 0 && x.count >= 2) || x.count >= 3
      return {
        supplier_name: x.display,
        count: x.count,
        is_recently_active,
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

export function buildTodaySupplierOperationInsights(
  orders: Order[],
  ocrActivities30d: OcrActivityRef[],
  ocrSupplierByCanonical: Record<string, string>,
  ingredientSupplierByName: Record<string, string | null>,
  supplierPriceRisks: SupplierPriceRiskInput[],
): TodaySupplierOperationInsights {
  const ocrMap30 = buildOcrSupplierCounts(ocrActivities30d, 30)
  const orderMap30 = buildOrderLinkedSupplierCounts(
    orders,
    ocrSupplierByCanonical,
    ingredientSupplierByName,
    30,
  )
  const ocrMap7 = buildOcrSupplierCounts(ocrActivities30d, 7)
  const orderMap7 = buildOrderLinkedSupplierCounts(
    orders,
    ocrSupplierByCanonical,
    ingredientSupplierByName,
    7,
  )
  const combined30 = mergeSupplierCountMaps(ocrMap30, orderMap30)
  const price_risk_suppliers = groupSupplierPriceRisks(supplierPriceRisks)
  const dependency_ingredients = buildSupplierDependencyIngredients(ocrActivities30d)
  const top_active_suppliers_7d = buildActiveSuppliers7d(ocrMap7, orderMap7)

  return {
    summary: {
      active_supplier_count: combined30.size,
      price_risk_supplier_count: price_risk_suppliers.length,
      repeat_connection_supplier_count: countRepeatConnectionSuppliers(
        ocrMap7,
        orderMap7,
      ),
      dependency_ingredient_count: dependency_ingredients.length,
    },
    top_combined: mapToTopRows(combined30, 5),
    top_ocr: mapToTopRows(ocrMap30, 5),
    top_order_linked: mapToTopRows(orderMap30, 5),
    price_risk_suppliers,
    dependency_ingredients,
    top_active_suppliers_7d,
  }
}
