'use client'

// ============================================================
// TodayTracker
//
// 페이지 진입 시 today_enter 1회 발사.
// sessionStorage 에 session_id / enter_ts 기록 — 이후 하위 컴포넌트가 쓸 수 있게.
// ============================================================

import { useEffect, useRef } from 'react'
import { getOrCreateSessionId, markEnter } from '@/lib/today-events'
import {
  logTodayEvent,
  type PressureType,
  type DecisionType,
  type SkuPrecisionStr,
  type PersonalizationType,
} from '@/actions/today-events'

interface Props {
  restaurantId:            string
  pressureType:            PressureType
  decisionType?:           DecisionType | null
  skuPrecision?:           SkuPrecisionStr | null
  hasConflict?:            boolean
  personalizationApplied?: boolean
  personalizationType?:    PersonalizationType | null
}

export default function TodayTracker({
  restaurantId, pressureType, decisionType, skuPrecision, hasConflict,
  personalizationApplied, personalizationType,
}: Props) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    markEnter()
    const sid = getOrCreateSessionId()
    if (!sid) return

    logTodayEvent({
      restaurant_id:           restaurantId,
      session_id:              sid,
      event_type:              'today_enter',
      decision_type:           decisionType ?? null,
      sku_precision:           skuPrecision ?? null,
      has_conflict:            hasConflict,
      shown_pressure_type:     pressureType,
      personalization_applied: personalizationApplied ?? false,
      personalization_type:    personalizationType ?? 'none',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
