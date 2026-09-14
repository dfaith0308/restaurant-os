/**
 * 상세페이지 템플릿 — 식당OS 복제본 (읽기·표시 전용).
 *
 * 원본: realmyos/src/lib/detail-template/fields.ts + system.ts
 * DB: realmyos/supabase/migrations/20260915110000_commerce_detail_templates.sql
 * 두 앱은 저장소가 달라 상수·규칙만 복제한다(admin-settings-read.ts 의 D-018 과 같은 방식).
 * 칸을 늘리거나 상속 규칙을 바꿀 때는 원본과 이 파일을 같이 고친다.
 *
 * - 칸 단위 상속: 옵션 값(링크 칸 또는 listing 기존 칸) → 상품(템플릿) 값 → 비어 있음(화면에서 숨김)
 * - 시스템값(단가표·발주 안내)은 저장하지 않고 그릴 때마다 listing·admin_settings 에서 계산한다
 */

export type DetailFieldKind = 'text' | 'textarea' | 'lines' | 'images' | 'menu_examples' | 'faqs'

export type DetailSectionKey =
  | 'hero'
  | 'why'
  | 'fit'
  | 'story'
  | 'menu'
  | 'price_table'
  | 'order_guide'
  | 'info'
  | 'faq'

export const DETAIL_SECTIONS: { key: DetailSectionKey; no: string; title: string; system: boolean }[] = [
  { key: 'hero', no: '', title: '첫 화면', system: false },
  { key: 'why', no: '01', title: '왜 이 식자재인가', system: false },
  { key: 'fit', no: '02', title: '어떤 매장에 맞는가', system: false },
  { key: 'story', no: '03', title: '산지·가공·보관·HACCP', system: false },
  { key: 'menu', no: '04', title: '실제 메뉴 적용 예시', system: false },
  { key: 'price_table', no: '05', title: '규격×수량 단가표', system: true },
  { key: 'order_guide', no: '06', title: '발주 안내', system: true },
  { key: 'info', no: '07', title: '원산지·알레르기·유통기한', system: false },
  { key: 'faq', no: '08', title: '자주 묻는 질문', system: false },
]

export type DetailFieldDef = {
  key: DetailFieldKey
  section: DetailSectionKey
  label: string
  kind: DetailFieldKind
  hint?: string
  maxLen: number
  /** 'link' = 링크 테이블에 옵션 전용 칸 / 'listing' = listing 기존 칸이 옵션 값 */
  optionSource: 'link' | 'listing'
  /** optionSource='listing' 일 때 listing 컬럼 이름 */
  listingColumn?: 'image_urls' | 'origin' | 'allergen' | 'storage_method' | 'ingredients'
}

export const DETAIL_FIELD_KEYS = [
  'headline',
  'hero_image_urls',
  'why_points',
  'fit_business_types',
  'fit_store_scale',
  'fit_price_range',
  'story_body',
  'trust_points',
  'story_image_urls',
  'menu_examples',
  'info_origin',
  'info_allergen',
  'info_shelf_life',
  'info_storage',
  'info_ingredients',
  'faqs',
] as const

export type DetailFieldKey = (typeof DETAIL_FIELD_KEYS)[number]

export const DETAIL_FIELDS: DetailFieldDef[] = [
  { key: 'headline', section: 'hero', label: '핵심 한 줄', kind: 'text', maxLen: 80, optionSource: 'link', hint: '예: 껍질 까는 시간 0분, 바로 다지는 국내산 깐마늘' },
  { key: 'hero_image_urls', section: 'hero', label: '대표 사진', kind: 'images', maxLen: 10, optionSource: 'listing', listingColumn: 'image_urls', hint: '옵션(상품 등록 화면)에 상세 이미지가 있으면 그것을 먼저 씁니다' },
  { key: 'why_points', section: 'why', label: '설득 근거 (한 줄에 하나)', kind: 'lines', maxLen: 8, optionSource: 'link', hint: '원가율·조리 시간·회전율 — 식당 사장님이 그대로 복사해 쓸 수 있는 문장' },
  { key: 'fit_business_types', section: 'fit', label: '업종', kind: 'text', maxLen: 120, optionSource: 'link', hint: '예: 한식 백반, 고깃집, 중식' },
  { key: 'fit_store_scale', section: 'fit', label: '규모', kind: 'text', maxLen: 120, optionSource: 'link', hint: '예: 하루 50~150그릇' },
  { key: 'fit_price_range', section: 'fit', label: '객단가', kind: 'text', maxLen: 120, optionSource: 'link', hint: '예: 1인 8천~1만5천원' },
  { key: 'story_body', section: 'story', label: '산지·가공·보관 이야기', kind: 'textarea', maxLen: 2000, optionSource: 'link' },
  { key: 'trust_points', section: 'story', label: '신뢰 근거 (한 줄에 하나)', kind: 'lines', maxLen: 8, optionSource: 'link', hint: '예: HACCP 인증 시설 가공 / 입고 당일 선별' },
  { key: 'story_image_urls', section: 'story', label: '산지·가공 사진', kind: 'images', maxLen: 6, optionSource: 'link' },
  { key: 'menu_examples', section: 'menu', label: '메뉴 적용 예시 (사진 + 설명)', kind: 'menu_examples', maxLen: 8, optionSource: 'link' },
  { key: 'info_origin', section: 'info', label: '원산지', kind: 'text', maxLen: 200, optionSource: 'listing', listingColumn: 'origin' },
  { key: 'info_allergen', section: 'info', label: '알레르기', kind: 'text', maxLen: 200, optionSource: 'listing', listingColumn: 'allergen' },
  { key: 'info_shelf_life', section: 'info', label: '유통기한', kind: 'text', maxLen: 200, optionSource: 'link', hint: '예: 냉장 제조일로부터 14일' },
  { key: 'info_storage', section: 'info', label: '보관방법', kind: 'text', maxLen: 200, optionSource: 'listing', listingColumn: 'storage_method' },
  { key: 'info_ingredients', section: 'info', label: '원재료명', kind: 'textarea', maxLen: 1000, optionSource: 'listing', listingColumn: 'ingredients' },
  { key: 'faqs', section: 'faq', label: '질문과 답', kind: 'faqs', maxLen: 12, optionSource: 'link' },
]

/** 링크 테이블에 옵션 전용 칸이 있는 필드 — DB 컬럼과 1:1 */
export const LINK_OVERRIDE_KEYS = DETAIL_FIELDS.filter((f) => f.optionSource === 'link').map((f) => f.key)

export type MenuExample = { image_url: string | null; caption: string | null }
export type FaqItem = { q: string; a: string }

export type DetailFieldValue = string | string[] | MenuExample[] | FaqItem[] | null

export type DetailValues = Partial<Record<DetailFieldKey, DetailFieldValue>>

/** 값이 "채워졌는가" — 화면 숨김 판단과 상속 판단이 같은 기준을 쓴다 */
export function isFilled(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}

export type ListingOptionColumns = {
  image_urls: string[] | null
  origin: string | null
  allergen: string | null
  storage_method: string | null
  ingredients: string | null
}

export type ResolvedField = {
  key: DetailFieldKey
  value: DetailFieldValue
  /** 'option' = 옵션 자기 값 / 'template' = 상품 값 상속 / 'empty' = 둘 다 없음(숨김) */
  from: 'option' | 'template' | 'empty'
}

/**
 * 칸 단위 상속 — 판정은 이 함수 한 곳에서만 한다.
 * 옵션 값(링크 칸 또는 listing 기존 칸) → 상품(템플릿) 값 → 비어 있음.
 */
export function resolveDetailFields(
  template: DetailValues,
  link: DetailValues | null,
  listing: ListingOptionColumns | null,
): Record<DetailFieldKey, ResolvedField> {
  const out = {} as Record<DetailFieldKey, ResolvedField>
  for (const def of DETAIL_FIELDS) {
    const optionValue: unknown =
      def.optionSource === 'listing'
        ? def.listingColumn && listing
          ? listing[def.listingColumn]
          : null
        : link?.[def.key] ?? null
    const templateValue = template[def.key] ?? null

    if (isFilled(optionValue)) {
      const v = typeof optionValue === 'string' ? optionValue.trim() : optionValue
      out[def.key] = { key: def.key, value: v as DetailFieldValue, from: 'option' }
    } else if (isFilled(templateValue)) {
      out[def.key] = { key: def.key, value: templateValue, from: 'template' }
    } else {
      out[def.key] = { key: def.key, value: null, from: 'empty' }
    }
  }
  return out
}

// ── 시스템값 ──────────────────────────────────────────────────────────────────────

/** admin_settings 키 — 플랫폼 전체 발주 안내 (상품마다 입력하지 않는다) */
export const ORDER_GUIDE_SETTING_KEYS = {
  cutoffTime: 'storefront_order_cutoff_time',
  deliveryWeekdays: 'storefront_delivery_weekdays',
} as const

export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const

export type OrderGuideSettings = {
  /** 'HH:MM' (KST) 또는 null */
  cutoffTime: string | null
  /** 1=월 … 7=일, 오름차순, 중복 없음. 비어 있으면 null */
  deliveryWeekdays: number[] | null
}

/** 'HH:MM' 검증 — 형식이 틀리면 null (추측해서 고치지 않는다) */
export function parseCutoffTime(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v)
  return m ? `${m[1]}:${m[2]}` : null
}

/** '1,2,5' → [1,2,5]. 1~7 밖의 값이 하나라도 있으면 전체를 null */
export function parseWeekdays(raw: string | null | undefined): number[] | null {
  const v = String(raw ?? '').trim()
  if (!v) return null
  const parts = v.split(',').map((x) => x.trim()).filter(Boolean)
  const nums = parts.map((x) => Number(x))
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 7)) return null
  const uniq = [...new Set(nums)].sort((a, b) => a - b)
  return uniq.length ? uniq : null
}

export function parseOrderGuideSettings(rows: { key: string; value: string | null }[]): OrderGuideSettings {
  const m = new Map(rows.map((r) => [r.key, r.value]))
  return {
    cutoffTime: parseCutoffTime(m.get(ORDER_GUIDE_SETTING_KEYS.cutoffTime)),
    deliveryWeekdays: parseWeekdays(m.get(ORDER_GUIDE_SETTING_KEYS.deliveryWeekdays)),
  }
}

/** 'HH:MM' → '오후 3시' / '오전 10시 30분' */
export function formatCutoffLabel(hhmm: string): string {
  const [h, mm] = hhmm.split(':').map(Number)
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${h12}시${mm ? ` ${mm}분` : ''}`
}

export type PriceOption = {
  listing_id: string
  spec: string | null
  commerce_price: number
  bulk_qty: number | null
  bulk_discount_rate: number | null
  free_shipping_qty: number | null
  sold_out: boolean
}

export type PriceTableRow = {
  listing_id: string
  spec_label: string
  unit_price: number
  bulk: { qty: number; rate: number; unit_price: number } | null
  free_shipping_qty: number | null
  sold_out: boolean
}

/**
 * 규격×수량 단가표.
 * 대량 단가 계산식은 식당OS 상품 상세(BuyProductDetailClient)의 `Math.round(price * (1 - rate / 100))`와 같다.
 * 표에 다른 식을 쓰면 표와 장바구니 버튼 금액이 어긋난다.
 */
export function buildPriceTable(options: PriceOption[]): PriceTableRow[] {
  return options.map((o, i) => {
    const hasBulk =
      o.bulk_qty != null && o.bulk_qty > 0 && o.bulk_discount_rate != null && o.bulk_discount_rate > 0
    return {
      listing_id: o.listing_id,
      spec_label: (o.spec ?? '').trim() || `옵션 ${i + 1}`,
      unit_price: o.commerce_price,
      bulk: hasBulk
        ? {
            qty: o.bulk_qty as number,
            rate: o.bulk_discount_rate as number,
            unit_price: Math.round(o.commerce_price * (1 - (o.bulk_discount_rate as number) / 100)),
          }
        : null,
      free_shipping_qty: o.free_shipping_qty != null && o.free_shipping_qty > 0 ? o.free_shipping_qty : null,
      sold_out: o.sold_out,
    }
  })
}

/** 표를 보여줄 가치가 있는가 — 옵션이 둘 이상이거나, 수량 조건(대량 할인·무료배송)이 있을 때만 */
export function shouldShowPriceTable(rows: PriceTableRow[]): boolean {
  if (rows.length >= 2) return true
  return rows.some((r) => r.bulk != null || r.free_shipping_qty != null)
}

export type OrderGuideRow = { label: string; value: string }

/**
 * 06 발주 안내.
 * 배송비 문구는 식당OS 상품 상세 첫 화면(BuyProductDetailClient)과 **같은 규칙**으로 만든다
 * — 기본배송비(없으면 3,500원) 별도, 무료배송 수량이 있으면 함께. 한 페이지 안에서 배송비 설명이
 * 두 가지로 갈리지 않게 하기 위해서다(shipping_type 은 첫 화면도 쓰지 않으므로 여기서도 쓰지 않는다).
 */
export function buildOrderGuide(input: {
  settings: OrderGuideSettings
  min_order_qty: number | null
  base_shipping_fee: number | null
  free_shipping_qty: number | null
}): OrderGuideRow[] {
  const rows: OrderGuideRow[] = []
  if (input.settings.cutoffTime) {
    rows.push({ label: '발주 마감', value: `${formatCutoffLabel(input.settings.cutoffTime)}까지 (한국 시간)` })
  }
  if (input.settings.deliveryWeekdays) {
    rows.push({
      label: '배송 요일',
      value: input.settings.deliveryWeekdays.map((d) => WEEKDAY_LABELS[d - 1]).join('·'),
    })
  }
  if (input.min_order_qty != null && input.min_order_qty > 1) {
    rows.push({ label: '최소 주문', value: `${input.min_order_qty}개부터` })
  }
  const fee = input.base_shipping_fee ?? 3500
  const freeQty = input.free_shipping_qty != null && input.free_shipping_qty > 0 ? input.free_shipping_qty : null
  rows.push({
    label: '배송비',
    value: `${fee.toLocaleString('ko-KR')}원 별도${freeQty ? ` · ${freeQty}개 이상 무료배송` : ''}`,
  })
  return rows
}

// ── 식당 화면 모델 ────────────────────────────────────────────────────────────────

export type DetailListingRow = {
  id: string
  spec: string | null
  commerce_price: number
  status: string
  bulk_qty: number | null
  bulk_discount_rate: number | null
  free_shipping_qty: number | null
  base_shipping_fee: number | null
  min_order_qty: number | null
  image_urls: string[] | null
  origin: string | null
  allergen: string | null
  storage_method: string | null
  ingredients: string | null
}

export type BuyDetailOptionChip = {
  listing_id: string
  spec_label: string
  current: boolean
  sold_out: boolean
}

export type BuyDetailPageView = {
  headline: string | null
  /** 첫 화면 사진 — 옵션 자기 상세 이미지가 있으면 그것, 없으면 템플릿 대표 사진. 둘 다 없으면 null */
  gallery: string[] | null
  options: BuyDetailOptionChip[]
  why: string[] | null
  fit: { label: string; value: string }[] | null
  story: { body: string | null; points: string[] | null; images: string[] | null } | null
  menu: MenuExample[] | null
  price_table: PriceTableRow[] | null
  order_guide: OrderGuideRow[] | null
  info: { label: string; value: string }[] | null
  faq: FaqItem[] | null
}

/**
 * 템플릿·옵션 값·listing·설정 → 식당 화면 모델. **안 채운 섹션은 null** 이고 화면은 null 섹션을 통째로 그리지 않는다.
 * DB 를 모르는 순수 함수라 서버 액션과 검증 스크립트가 같은 코드를 쓴다.
 */
export function buildBuyDetailPageView(input: {
  currentListingId: string
  template: DetailValues
  overrides: DetailValues
  /** 같은 템플릿의 노출 중 옵션들, 순서대로. 현재 listing 포함 */
  options: DetailListingRow[]
  settingsRows: { key: string; value: string | null }[]
}): BuyDetailPageView | null {
  const current = input.options.find((o) => o.id === input.currentListingId)
  if (!current) return null

  const resolved = resolveDetailFields(input.template, input.overrides, {
    image_urls: current.image_urls,
    origin: current.origin,
    allergen: current.allergen,
    storage_method: current.storage_method,
    ingredients: current.ingredients,
  })
  const val = (k: DetailFieldKey) => resolved[k].value

  const priceRows = buildPriceTable(
    input.options.map((r) => ({
      listing_id: r.id,
      spec: r.spec,
      commerce_price: r.commerce_price,
      bulk_qty: r.bulk_qty,
      bulk_discount_rate: r.bulk_discount_rate,
      free_shipping_qty: r.free_shipping_qty,
      sold_out: r.status === 'sold_out',
    })),
  )

  const fit = [
    { label: '업종', value: asText(val('fit_business_types')) },
    { label: '규모', value: asText(val('fit_store_scale')) },
    { label: '객단가', value: asText(val('fit_price_range')) },
  ].filter((r): r is { label: string; value: string } => Boolean(r.value))

  const storyBody = asText(val('story_body'))
  const storyPoints = asStrings(val('trust_points'))
  const storyImages = asStrings(val('story_image_urls'))

  const info = [
    { label: '원산지', value: asText(val('info_origin')) },
    { label: '알레르기', value: asText(val('info_allergen')) },
    { label: '유통기한', value: asText(val('info_shelf_life')) },
    { label: '보관방법', value: asText(val('info_storage')) },
    { label: '원재료명', value: asText(val('info_ingredients')) },
  ].filter((r): r is { label: string; value: string } => Boolean(r.value))

  const menu = val('menu_examples')
  const faqs = val('faqs')

  return {
    headline: asText(val('headline')),
    gallery: asStrings(val('hero_image_urls')),
    options:
      input.options.length >= 2
        ? priceRows.map((p) => ({
            listing_id: p.listing_id,
            spec_label: p.spec_label,
            current: p.listing_id === current.id,
            sold_out: p.sold_out,
          }))
        : [],
    why: asStrings(val('why_points')),
    fit: fit.length ? fit : null,
    story: storyBody || storyPoints || storyImages ? { body: storyBody, points: storyPoints, images: storyImages } : null,
    menu: Array.isArray(menu) && menu.length ? (menu as MenuExample[]) : null,
    price_table: shouldShowPriceTable(priceRows) ? priceRows : null,
    order_guide: buildOrderGuide({
      settings: parseOrderGuideSettings(input.settingsRows),
      min_order_qty: current.min_order_qty,
      base_shipping_fee: current.base_shipping_fee,
      free_shipping_qty: current.free_shipping_qty,
    }),
    info: info.length ? info : null,
    faq: Array.isArray(faqs) && faqs.length ? (faqs as FaqItem[]) : null,
  }
}

function asStrings(v: unknown): string[] | null {
  return Array.isArray(v) && v.length ? (v as string[]) : null
}

function asText(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
