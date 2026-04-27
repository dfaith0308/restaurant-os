'use server'

// ============================================================
// AI 결정 로그 기록
//
// TodayLoopCard 에서 사용자가 AI 판단에 반응할 때 호출.
// fire-and-forget 형태 — 실패해도 UI 블로킹 없음.
// ============================================================

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export interface LogAiDecisionInput {
  tenant_id:       string
  ingredient_name: string
  ai_decision:     'KEEP' | 'SWITCH'          // 스키마는 두 값만 허용 — REVIEW 는 호출자가 매핑
  user_action:     'KEEP' | 'SWITCH' | 'CANCEL'
  confidence:      number                       // 0~1
}

export async function logAiDecision(input: LogAiDecisionInput): Promise<void> {
  if (!input.tenant_id || !input.ingredient_name) return
  try {
    const supabase = await createServerClient()
    await supabase.from('ai_decision_logs').insert({
      tenant_id:       input.tenant_id,
      ingredient_name: input.ingredient_name,
      ai_decision:     input.ai_decision,
      user_action:     input.user_action,
      confidence:      input.confidence,
    })
    // behavior_profile 는 다음 today 렌더에서 다시 계산되므로 revalidate
    revalidatePath('/today')
  } catch {
    // 로깅 실패는 핵심 플로우 차단하지 않음
  }
}
