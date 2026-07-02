export const NAVER_PLACE_MENUS_STORAGE_KEY = 'naver_place_menus_import'

export type NaverPlaceMenuImportItem = {
  name: string
  price: string
}

export function saveNaverPlaceMenusForImport(menus: NaverPlaceMenuImportItem[]): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(NAVER_PLACE_MENUS_STORAGE_KEY, JSON.stringify(menus))
}

export function loadNaverPlaceMenusForImport(): NaverPlaceMenuImportItem[] | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(NAVER_PLACE_MENUS_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter(
      (item): item is NaverPlaceMenuImportItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as NaverPlaceMenuImportItem).name === 'string',
    )
  } catch {
    return null
  }
}

export function clearNaverPlaceMenusForImport(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(NAVER_PLACE_MENUS_STORAGE_KEY)
}

export function parseNaverMenuPrice(price: string): number {
  const digits = price.replace(/[^\d]/g, '')
  const n = parseInt(digits, 10)
  return Number.isFinite(n) ? n : 0
}
