// ============================================================
// 구매 할인 계산 — 원가를 참조하지 않는다
//
// [왜 원가를 안 보는가]
// 이전 구현(calcCartDiscount)은 service role 로 product_costs 를 읽어
//   discount = netRevenue - totalCost / MIN_MARGIN / (1 - PG_RATE)
// 를 돌려줬다. 상수 두 개가 소스에 있으므로 이 식은 원가에 대해 역함수가 있고,
// 장바구니 구성을 바꿔가며 응답을 관찰하면 연립방정식으로 개별 상품 원가가 풀린다.
// 반올림 단위를 키우는 건 역산을 어렵게 할 뿐 경로를 끊지 못한다.
//
// 그래서 할인액이 원가의 함수가 아니게 만들었다. 아래 계산에 들어가는 입력은
// 소계와 회원 등급뿐이고, 둘 다 구매자가 이미 아는 값이다. 응답으로 새로 알 수
// 있는 정보가 없으므로 역산할 대상 자체가 없다.
//
// 마진 바닥 보호는 관리자가 commerce_price 를 정하는 시점의 문제로 옮긴다 —
// 원가를 보는 것이 정당한 유일한 지점이다.
// ============================================================

/** 회원 등급 */
export type BuyerGrade = 'subscriber' | 'member' | 'guest'

/** 일반회원 구간 할인 — 소계가 min 이상이면 rate(%) */
export type DiscountTier = { min: number; rate: number }

/**
 * 절상 단위 구간. below 미만이면 unit 단위로 절상한다.
 * 마지막 항목의 below 는 null (상한 없음).
 */
export type RoundingBand = { below: number | null; unit: number }

export type BuyDiscountConfig = {
  /** 구독회원 정률(%) — 장바구니 금액과 무관 */
  subscriberRate: number
  /** 일반회원 구간 계단 */
  memberTiers: DiscountTier[]
  /** 할인액 절상 단위 */
  roundingBands: RoundingBand[]
}

/**
 * 기본값. admin_settings 에 해당 key 가 없으면 이 값을 쓴다.
 * 아직 확정 전 수치라 코드에 박지 않고 설정에서 덮어쓸 수 있게 뒀다.
 */
export const DEFAULT_BUY_DISCOUNT_CONFIG: BuyDiscountConfig = {
  subscriberRate: 10,
  memberTiers: [
    { min: 100_000, rate: 3 },
    { min: 200_000, rate: 5 },
    { min: 300_000, rate: 7 },
  ],
  roundingBands: [
    { below: 10_000, unit: 100 },
    { below: 50_000, unit: 500 },
    { below: null, unit: 1_000 },
  ],
}

/** admin_settings 의 key 이름 */
export const BUY_DISCOUNT_SETTING_KEYS = {
  subscriberRate: 'buy_discount_subscriber_rate',
  memberTiers: 'buy_discount_member_tiers',
  roundingBands: 'buy_discount_rounding_bands',
} as const

function toFiniteNumber(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  return Number.isFinite(n) ? n : null
}

/** admin_settings 의 문자열 값을 설정으로 바꾼다. 형식이 깨졌으면 기본값을 쓴다. */
export function parseBuyDiscountConfig(
  rows: { key: string; value: string | null }[],
): BuyDiscountConfig {
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  const config: BuyDiscountConfig = {
    subscriberRate: DEFAULT_BUY_DISCOUNT_CONFIG.subscriberRate,
    memberTiers: DEFAULT_BUY_DISCOUNT_CONFIG.memberTiers,
    roundingBands: DEFAULT_BUY_DISCOUNT_CONFIG.roundingBands,
  }

  const rate = toFiniteNumber(byKey.get(BUY_DISCOUNT_SETTING_KEYS.subscriberRate))
  if (rate != null && rate >= 0 && rate <= 100) config.subscriberRate = rate

  const tiersRaw = byKey.get(BUY_DISCOUNT_SETTING_KEYS.memberTiers)
  if (tiersRaw) {
    try {
      const parsed = JSON.parse(tiersRaw) as unknown
      if (Array.isArray(parsed)) {
        const tiers = parsed
          .map((t) => {
            const o = t as Record<string, unknown>
            const min = toFiniteNumber(o.min)
            const r = toFiniteNumber(o.rate)
            return min != null && r != null && min >= 0 && r >= 0 && r <= 100 ? { min, rate: r } : null
          })
          .filter((t): t is DiscountTier => t !== null)
        if (tiers.length > 0) config.memberTiers = tiers
      }
    } catch {
      // 형식이 깨졌으면 기본값 유지. 할인이 사라지는 것보다 낫다.
    }
  }

  const bandsRaw = byKey.get(BUY_DISCOUNT_SETTING_KEYS.roundingBands)
  if (bandsRaw) {
    try {
      const parsed = JSON.parse(bandsRaw) as unknown
      if (Array.isArray(parsed)) {
        const bands = parsed
          .map((b) => {
            const o = b as Record<string, unknown>
            const unit = toFiniteNumber(o.unit)
            const below = o.below == null ? null : toFiniteNumber(o.below)
            return unit != null && unit > 0 ? { below, unit } : null
          })
          .filter((b): b is RoundingBand => b !== null)
        if (bands.length > 0) config.roundingBands = bands
      }
    } catch {
      // 위와 같다
    }
  }

  return config
}

/** 등급별 할인율(%). 소계는 일반회원 구간 판정에만 쓴다. */
export function resolveDiscountRate(
  grade: BuyerGrade,
  subtotal: number,
  config: BuyDiscountConfig,
): number {
  if (grade === 'guest') return 0
  if (grade === 'subscriber') return config.subscriberRate

  // 일반회원 — 조건을 만족하는 구간 중 가장 높은 rate
  let rate = 0
  for (const tier of config.memberTiers) {
    if (subtotal >= tier.min && tier.rate > rate) rate = tier.rate
  }
  return rate
}

/** 금액대에 맞는 절상 단위 */
export function resolveRoundingUnit(amount: number, config: BuyDiscountConfig): number {
  for (const band of config.roundingBands) {
    if (band.below == null || amount < band.below) return band.unit
  }
  return config.roundingBands[config.roundingBands.length - 1]?.unit ?? 1
}

/**
 * 최종 할인액.
 *
 * 입력은 소계와 등급뿐이다 — 원가는 어디에도 들어가지 않는다.
 * 절상이라 할인액이 비율보다 조금 커질 수 있고, 소계를 넘지 않도록 자른다.
 */
export function calcDiscountAmount(
  grade: BuyerGrade,
  subtotal: number,
  config: BuyDiscountConfig,
): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0

  const rate = resolveDiscountRate(grade, subtotal, config)
  if (rate <= 0) return 0

  const raw = (subtotal * rate) / 100
  const unit = resolveRoundingUnit(raw, config)
  const rounded = Math.ceil(raw / unit) * unit

  return Math.max(0, Math.min(rounded, subtotal))
}
