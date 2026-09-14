/**
 * 자체 배송 상태 체계 — 식당OS 복제본 (읽기·표시 전용).
 *
 * 원본: realmyos/src/lib/delivery-tracking/status.ts
 * DB 정의: realmyos/supabase/migrations/20260915100000_commerce_delivery_tracking.sql
 * 두 앱은 저장소가 달라 상수만 최소 복제한다(admin-settings-read.ts 의 D-018 과 같은 방식).
 * 값을 늘릴 때는 원본·DB·이 파일을 같이 고친다.
 *
 * 식당OS 는 배송 상태를 쓰지 않는다. 판정은 DB 함수 apply_commerce_delivery_event() 한 곳에서만 한다.
 */

/** 진행 6단계 — 순서가 곧 순위다 */
export const DELIVERY_PROGRESS_STATUSES = [
  'not_registered',
  'ready',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
] as const

/** 예외 2개 — 진행 단계가 아니다 */
export const DELIVERY_EXCEPTION_STATUSES = ['attention', 'lookup_error'] as const

export const DELIVERY_STATUSES = [...DELIVERY_PROGRESS_STATUSES, ...DELIVERY_EXCEPTION_STATUSES] as const

export type DeliveryProgressStatus = (typeof DELIVERY_PROGRESS_STATUSES)[number]
export type DeliveryExceptionStatus = (typeof DELIVERY_EXCEPTION_STATUSES)[number]
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  not_registered: '송장 등록 전',
  ready: '배송 준비',
  picked_up: '집화',
  in_transit: '배송 중',
  out_for_delivery: '배달 중',
  delivered: '배송 완료',
  attention: '확인 필요',
  lookup_error: '조회 오류',
}

export function isDeliveryStatus(v: unknown): v is DeliveryStatus {
  return typeof v === 'string' && (DELIVERY_STATUSES as readonly string[]).includes(v)
}

export function isDeliveryException(v: unknown): v is DeliveryExceptionStatus {
  return typeof v === 'string' && (DELIVERY_EXCEPTION_STATUSES as readonly string[]).includes(v)
}

/** 진행 순위. 예외·모르는 값은 null (DB commerce_delivery_progress_rank 와 같은 값) */
export function deliveryProgressRank(v: string | null | undefined): number | null {
  const i = (DELIVERY_PROGRESS_STATUSES as readonly string[]).indexOf(String(v ?? ''))
  return i >= 0 ? i : null
}
