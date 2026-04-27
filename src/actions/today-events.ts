'use server'

// ============================================================
// Today 이벤트 서버 액션
//
// fire-and-forget — 실패해도 UI 블로킹 없음.
// ============================================================

import { createServerClient } from '@/lib/supabase-server'

export type TodayEventType = 'today_enter' | 'primary_card_click' | 'action_complete'
export type DecisionType   = 'SWITCH' | 'KEEP' | 'REVIEW'
export type PressureType   = 'loss' | 'time' | 'none'
export type ActionKind     = 'payment' | 'rfq' | 'sku' | 'delivery' | 'order_create'
export type SkuPrecisionStr = 'exact' | 'grouped' | 'branded' | 'name_only'
export type PersonalizationType = 'loss_pref' | 'time_pref' | 'dampened' | 'simple' | 'none'

export interface TodayEventInput {
  tenant_id:            string
  session_id:           string
  event_type:           TodayEventType
  decision_type?:       DecisionType | null
  sku_precision?:       SkuPrecisionStr | null
  has_conflict?:        boolean
  shown_pressure_type?: PressureType | null
  action_kind?:         ActionKind | null
  time_to_action_ms?:   number | null
  // 안정화 레이어
  personalization_applied?: boolean
  personalization_type?:    PersonalizationType | null
}

export async function logTodayEvent(input: TodayEventInput): Promise<void> {
  if (!input.tenant_id || !input.session_id || !input.event_type) return
  try {
    const supabase = await createServerClient()
    await supabase.from('today_events').insert({
      tenant_id:           input.tenant_id,
      session_id:          input.session_id,
      event_type:          input.event_type,
      decision_type:       input.decision_type       ?? null,
      sku_precision:       input.sku_precision       ?? null,
      has_conflict:        input.has_conflict        ?? null,
      shown_pressure_type: input.shown_pressure_type ?? null,
      action_kind:         input.action_kind         ?? null,
      time_to_action_ms:   input.time_to_action_ms   ?? null,
      personalization_applied: input.personalization_applied ?? null,
      personalization_type:    input.personalization_type    ?? null,
    })
  } catch {
    // 로깅 실패는 핵심 플로우 차단하지 않음
  }
}
