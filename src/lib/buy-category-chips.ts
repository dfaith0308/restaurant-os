/**
 * /buy 카테고리 칩 — label 은 UI 고정, categoryId 는 DB product_categories.id 와 연결 시에만 필터 적용.
 * categoryId 가 null 이면 칩을 눌러도 getListings 에 category_id 를 넘기지 않음(전체 상품과 동일).
 */

export type BuyCategoryChipDef = {
  slug: string
  label: string
  /** public.product_categories.id — 미연결이면 null */
  categoryId: string | null
}

export const BUY_CATEGORY_CHIPS: BuyCategoryChipDef[] = [
  { slug: 'all', label: '전체', categoryId: null },
  { slug: 'sauce', label: '소스·양념', categoryId: null },
  { slug: 'meat', label: '육류·축산', categoryId: null },
  { slug: 'frozen', label: '냉동식품', categoryId: null },
  { slug: 'veg', label: '채소·과일', categoryId: null },
  { slug: 'disposable', label: '일회용품', categoryId: null },
  { slug: 'noodle', label: '면·곡류', categoryId: null },
  { slug: 'other', label: '기타', categoryId: null },
]

/** URL ?cat=slug → listing 필터용 category_id (없으면 필터 생략) */
export function categoryIdForCatParam(cat: string | undefined): string | undefined {
  const slug = cat?.trim()
  if (!slug || slug === 'all') return undefined
  const def = BUY_CATEGORY_CHIPS.find((c) => c.slug === slug)
  if (!def?.categoryId) return undefined
  return def.categoryId
}

export function isValidCatSlug(cat: string | undefined): boolean {
  const s = cat?.trim()
  if (!s) return false
  return BUY_CATEGORY_CHIPS.some((c) => c.slug === s)
}
