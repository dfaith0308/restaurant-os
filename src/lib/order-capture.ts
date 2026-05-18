import type {
  Order,
  OrderOperationCapture,
  OrderOperationCaptureSource,
} from '@/types'

const ORDER_CAPTURE_PREFIX = '__ORDER_CAPTURE_V1__\n' as const

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
  const meta = JSON.stringify({
    v: 1,
    source: capture.source,
    cp: capture.counterparty.trim(),
  })
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
    }
    if (meta.v !== 1 || typeof meta.cp !== 'string' || !meta.source) return null
    if (!isOrderCaptureSource(meta.source)) return null
    return {
      source: meta.source,
      counterparty: meta.cp,
      body: body.trim().length > 0 ? body : '',
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
