// ============================================================
// 사장 성향 프로파일 레이어
//
// ai_decision_logs 를 기반으로 "이 식당 사장이 어떤 스타일인지" 계산.
// aiEvaluatePrice 의 ctx.behavior_profile 로 주입되어 decision / threshold / 메시지에 반영됨.
//
// 데이터가 부족하면 DEFAULT_PROFILE (중립) 을 돌려줌.
// ============================================================

export interface BehaviorProfile {
  // ── 기존 (ai_decision_logs 기반) ──
  switch_preference:  number    // 0~1 — 전체 기록 중 SWITCH 선택 비율
  auto_accept_rate:   number    // 0~1 — SWITCH 제안 받았을 때 실행 비율
  risk_tolerance:     number    // 0~1 — 공격성 (위 두 값의 가중 평균 + 보정)
  sample_size:        number

  // ── 신규 (today_events 기반 pressure 반응 측정) ──
  loss_conversion_rate:  number    // 0~1 — loss 압박 본 세션 중 action_complete 비율
  time_conversion_rate:  number    // 0~1 — time 압박 본 세션 중 action_complete 비율
  avg_time_to_action_ms: number    // 평균 반응 속도 (0 = 데이터 없음)
  exit_rate:             number    // 0~1 — enter 후 action 없이 이탈한 세션 비율
  preferred_pressure:    'loss' | 'time' | 'none'   // 유도 가장 잘 되는 압박 유형
  pressure_sample_size:  number    // 계산에 쓰인 today_enter 이벤트 수
}

// 중립 기본값 — 신규 사장님은 여기서 시작
export const DEFAULT_PROFILE: BehaviorProfile = {
  switch_preference: 0.5,
  auto_accept_rate:  0.5,
  risk_tolerance:    0.5,
  sample_size:       0,
  loss_conversion_rate:  0.5,
  time_conversion_rate:  0.5,
  avg_time_to_action_ms: 0,
  exit_rate:             0,
  preferred_pressure:    'none',
  pressure_sample_size:  0,
}

// 성향 분류 임계값
export const AGGRESSIVE_THRESHOLD   = 0.65   // risk_tolerance 이상 = 공격형
export const CONSERVATIVE_THRESHOLD = 0.35   // risk_tolerance 이하 = 보수형

// Pressure 관련 임계값
export const MIN_PRESSURE_SAMPLES     = 5     // 의미있는 pressure 데이터로 간주할 최소 today_enter 수
export const HIGH_EXIT_THRESHOLD      = 0.5   // 이탈률이 이 값 이상이면 압박 단순화
export const FAST_ACTION_MS           = 30_000   // 30초 이내 반응 → 빠른 결정가
export const SLOW_ACTION_MS           = 120_000  // 2분 이상 → 신중한 결정가
export const PRESSURE_PREF_GAP        = 0.1   // 압박 유형 선호 판정 최소 차이

// ── 안정화 상수 ───────────────────────────────────────────
export const DECAY_DAYS               = 14        // 이 기간 내는 가중치 1.0
export const DECAY_FLOOR              = 0.25      // 오래된 데이터 최소 가중치
// 반응 속도 이상치 필터 — 이 범위 밖은 개인화 계산에서 무시
export const PLAUSIBLE_MIN_MS         = 2_000     // 2초 미만 = 반사 클릭/버그/봇
export const PLAUSIBLE_MAX_MS         = 600_000   // 10분 이상 = 실제 의사결정 아님
// simple mode 임계 — 이 이상 이탈 + 충분한 샘플이면 UX 극단 단순화
export const SIMPLE_MODE_EXIT_RATE    = 0.9
export const SIMPLE_MODE_MIN_SAMPLES  = 10

// 의미있는 프로파일로 간주할 최소 로그 수 — 이하면 DEFAULT 반환
const MIN_LOGS_FOR_PROFILE = 3

// ── 성향 계산 ──────────────────────────────────────────────
// 서버 전용 — supabase-server 를 내부 import 로 가져감.
//   두 테이블 병렬 조회: ai_decision_logs (결정 반응) + today_events (pressure 반응)
export async function getRestaurantBehaviorProfile(
  tenant_id: string,
): Promise<BehaviorProfile> {
  if (!tenant_id) return DEFAULT_PROFILE

  const { createServerClient } = await import('@/lib/supabase-server')
  const supabase = await createServerClient()

  const [
    { data: logsRaw, error: logsErr },
    { data: eventsRaw },
  ] = await Promise.all([
    supabase
      .from('ai_decision_logs')
      .select('ai_decision, user_action, confidence, created_at')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('today_events')
      .select('event_type, session_id, shown_pressure_type, time_to_action_ms, created_at')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  const now = Date.now()

  // ── 1. ai_decision_logs 기반 기존 메트릭 (decay 가중) ──
  const logs = (logsErr ? [] : (logsRaw ?? []))
  const hasLogs = logs.length >= MIN_LOGS_FOR_PROFILE

  const base = hasLogs ? (() => {
    // 각 로그에 decay 가중치 적용해 가중합으로 계산
    let wTotal = 0, wSwitchUser = 0, wCancelUser = 0
    let wSwitchOffered = 0, wAcceptedOfferedSwitch = 0
    for (const l of logs) {
      const w = decayWeight(l.created_at, now)
      wTotal += w
      if (l.user_action === 'SWITCH') wSwitchUser += w
      if (l.user_action === 'CANCEL') wCancelUser += w
      if (l.ai_decision  === 'SWITCH') {
        wSwitchOffered += w
        if (l.user_action === 'SWITCH') wAcceptedOfferedSwitch += w
      }
    }
    const switch_preference = wTotal > 0 ? wSwitchUser / wTotal : DEFAULT_PROFILE.switch_preference
    const auto_accept_rate  = wSwitchOffered > 0
      ? wAcceptedOfferedSwitch / wSwitchOffered
      : DEFAULT_PROFILE.auto_accept_rate
    const cancelRate  = wTotal > 0 ? wCancelUser / wTotal : 0
    const blended     = 0.5 * switch_preference + 0.5 * auto_accept_rate
    const risk_tolerance = clamp01(blended - cancelRate * 0.3)

    return {
      switch_preference: round2(switch_preference),
      auto_accept_rate:  round2(auto_accept_rate),
      risk_tolerance:    round2(risk_tolerance),
      sample_size:       logs.length,
    }
  })() : {
    switch_preference: DEFAULT_PROFILE.switch_preference,
    auto_accept_rate:  DEFAULT_PROFILE.auto_accept_rate,
    risk_tolerance:    DEFAULT_PROFILE.risk_tolerance,
    sample_size:       logs.length,
  }

  // ── 2. today_events 기반 pressure 반응 메트릭 (decay + 이상치 필터) ──
  const events = eventsRaw ?? []
  const enters    = events.filter(e => e.event_type === 'today_enter')
  const completes = events.filter(e => e.event_type === 'action_complete')

  // session → 완료 시 정보 맵 (time_to_action 포함)
  const completedBySession = new Map<string, { time_to_action_ms: number | null }>()
  for (const c of completes) {
    if (!c.session_id) continue
    completedBySession.set(c.session_id, {
      time_to_action_ms: typeof c.time_to_action_ms === 'number' ? c.time_to_action_ms : null,
    })
  }

  // enter 세션별로 decay 가중치 적용
  let wAllTotal = 0, wAllCompleted = 0
  let wLossTotal = 0, wLossCompleted = 0, lossN = 0
  let wTimeTotal = 0, wTimeCompleted = 0, timeN = 0
  let wTimingSum = 0, wTimingWeight = 0

  for (const e of enters) {
    const w = decayWeight(e.created_at, now)
    const completed = completedBySession.has(e.session_id)
    wAllTotal += w
    if (completed) wAllCompleted += w
    if (e.shown_pressure_type === 'loss') {
      wLossTotal += w; lossN++
      if (completed) wLossCompleted += w
    }
    if (e.shown_pressure_type === 'time') {
      wTimeTotal += w; timeN++
      if (completed) wTimeCompleted += w
    }
    // 평균 반응 속도 — enter 의 decay 로 가중 (완료된 것만)
    if (completed) {
      const info = completedBySession.get(e.session_id)!
      const t = info.time_to_action_ms
      // 이상치 필터 — 2초 미만 / 10분 초과 제외
      if (typeof t === 'number' && t >= PLAUSIBLE_MIN_MS && t <= PLAUSIBLE_MAX_MS) {
        wTimingSum    += t * w
        wTimingWeight += w
      }
    }
  }

  const loss_conversion_rate = wLossTotal > 0 ? wLossCompleted / wLossTotal : DEFAULT_PROFILE.loss_conversion_rate
  const time_conversion_rate = wTimeTotal > 0 ? wTimeCompleted / wTimeTotal : DEFAULT_PROFILE.time_conversion_rate
  const exitRate             = wAllTotal  > 0 ? 1 - (wAllCompleted / wAllTotal) : 0
  const avg_time_to_action_ms = wTimingWeight > 0 ? Math.round(wTimingSum / wTimingWeight) : 0

  // 선호 압박 유형 판정 — 샘플 부족하면 'none'
  const pressure_sample_size = enters.length
  let preferred_pressure: BehaviorProfile['preferred_pressure'] = 'none'
  if (pressure_sample_size >= MIN_PRESSURE_SAMPLES && lossN >= 2 && timeN >= 2) {
    const diff = loss_conversion_rate - time_conversion_rate
    preferred_pressure = diff >  PRESSURE_PREF_GAP ? 'loss'
                       : diff < -PRESSURE_PREF_GAP ? 'time'
                       : 'none'
  }

  return {
    ...base,
    loss_conversion_rate:   round2(loss_conversion_rate),
    time_conversion_rate:   round2(time_conversion_rate),
    avg_time_to_action_ms,
    exit_rate:              round2(exitRate),
    preferred_pressure,
    pressure_sample_size,
  }
}

// ── 성향 분류 헬퍼 ──────────────────────────────────────────

export function isAggressive(p?: BehaviorProfile): boolean {
  return !!p && p.sample_size >= MIN_LOGS_FOR_PROFILE && p.risk_tolerance >= AGGRESSIVE_THRESHOLD
}
export function isConservative(p?: BehaviorProfile): boolean {
  return !!p && p.sample_size >= MIN_LOGS_FOR_PROFILE && p.risk_tolerance <= CONSERVATIVE_THRESHOLD
}
export function profileLabel(p?: BehaviorProfile): '공격형' | '보수형' | '중립' | null {
  if (!p || p.sample_size < MIN_LOGS_FOR_PROFILE) return null
  if (p.risk_tolerance >= AGGRESSIVE_THRESHOLD)   return '공격형'
  if (p.risk_tolerance <= CONSERVATIVE_THRESHOLD) return '보수형'
  return '중립'
}

// ── Pressure 개인화 헬퍼 ────────────────────────────────────
//   UI 가 "표현만" 개인화하는 데 쓰는 판정 함수들

// 이탈률이 높으면 메시지 / 압박을 단순화할 것
export function shouldDampenPressure(p?: BehaviorProfile): boolean {
  return !!p
    && p.pressure_sample_size >= MIN_PRESSURE_SAMPLES
    && p.exit_rate > HIGH_EXIT_THRESHOLD
}

// 선호 압박 유형 — "none" 이면 개인화 없이 기본 표현
export function preferredPressureOf(p?: BehaviorProfile): 'loss' | 'time' | 'none' {
  if (!p || p.pressure_sample_size < MIN_PRESSURE_SAMPLES) return 'none'
  return p.preferred_pressure
}

// 빠른 결정가 여부 (auto_ready threshold 완화에 사용)
export function isFastActor(p?: BehaviorProfile): boolean {
  return !!p
    && p.pressure_sample_size >= MIN_PRESSURE_SAMPLES
    && p.avg_time_to_action_ms > 0
    && p.avg_time_to_action_ms < FAST_ACTION_MS
}
// 느린 결정가 (threshold 더 보수적으로)
export function isSlowActor(p?: BehaviorProfile): boolean {
  return !!p
    && p.pressure_sample_size >= MIN_PRESSURE_SAMPLES
    && p.avg_time_to_action_ms > SLOW_ACTION_MS
}

// 앱을 거의 쓰지 않는 사용자 — UX 극단 단순화 (버튼만)
export function isSimpleModeCandidate(p?: BehaviorProfile): boolean {
  return !!p
    && p.pressure_sample_size >= SIMPLE_MODE_MIN_SAMPLES
    && p.exit_rate >= SIMPLE_MODE_EXIT_RATE
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// 시간 감쇠 — 14일 이내는 1.0, 이후는 14/days 로 감소, 최저 0.25
function decayWeight(createdAt: string | null | undefined, nowMs: number): number {
  if (!createdAt) return 1
  const t = Date.parse(createdAt)
  if (isNaN(t)) return 1
  const days = Math.max(0, (nowMs - t) / (1000 * 60 * 60 * 24))
  if (days <= DECAY_DAYS) return 1
  return Math.max(DECAY_FLOOR, DECAY_DAYS / days)
}
