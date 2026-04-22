/** 원화 포맷 */
export function formatKRW(amount: number | null | undefined): string {
  if (amount == null) return '0원'
  return amount.toLocaleString('ko-KR') + '원'
}

/** 오늘 날짜 문자열 */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** N일 후 날짜 */
export function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
}

/** D-day 라벨 */
export function ddayLabel(dateStr: string): { text: string; urgent: boolean } {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (diff < 0)   return { text: `${Math.abs(diff)}일 지남`, urgent: true }
  if (diff === 0) return { text: '오늘',  urgent: true }
  if (diff === 1) return { text: '내일',  urgent: true }
  return { text: `${diff}일 후`, urgent: false }
}

/** 가격 차이 % */
export function priceDiffPct(current: number, compare: number): number {
  if (compare === 0) return 0
  return Math.round(((current - compare) / compare) * 100)
}

/**
 * 가격 수준 레이블 (UI/UX 문서 수치 기준)
 * 시장 평균 대비 diff %
 */
export function priceLevelLabel(diffPct: number): {
  text: string; color: string; bg: string
} {
  if (diffPct <= -5)  return { text: '좋은 가격이에요 👍', color: '#15803D', bg: '#F0FDF4' }
  if (diffPct <= 5)   return { text: '적정 가격이에요',   color: '#374151', bg: '#F9FAFB' }
  if (diffPct <= 15)  return { text: '조금 높은 편이에요', color: '#B45309', bg: '#FFFBEB' }
  return               { text: '많이 높은 편이에요',   color: '#B91C1C', bg: '#FEF2F2' }
}

// 금액을 사람이 읽기 쉬운 단위로 표시
// 예: 1500000 → "약 150만원", 15000 → "약 1만 5천원"
export function toKoreanAmount(raw: string | number): string {
  const n = typeof raw === 'string'
    ? parseInt(raw.replace(/[^0-9]/g, ''), 10)
    : Math.floor(raw)
  if (isNaN(n) || raw === '') return ''
  if (n === 0) return '0원'

  // 정확한 콤마 포맷
  const formatted = n.toLocaleString('ko-KR') + '원'

  // 한글 보조 표현 (만 단위 이상일 때만)
  if (n < 10000) return formatted

  const man  = Math.floor(n / 10000)
  const rest = n % 10000

  let korean = `${man.toLocaleString('ko-KR')}만`
  if (rest >= 1000) korean += ` ${Math.floor(rest / 1000)}천`
  if (rest % 1000 > 0) korean += ` ${(rest % 1000).toLocaleString('ko-KR')}`

  return `${formatted} (${korean}원)`
}
