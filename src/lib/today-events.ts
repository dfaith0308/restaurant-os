// ============================================================
// Today 이벤트 측정 — 클라이언트 헬퍼
//
// 세션 ID 와 진입 시각을 sessionStorage 에 저장.
//   - 세션 ID: 브라우저 탭 수명 동안 유지 (새 탭 = 새 세션)
//   - 진입 시각: 첫 today_enter 시점 기록. action_complete 시각과 차이로 time_to_action_ms 계산
// SSR 환경에서는 no-op (window 체크).
// ============================================================

const KEY_SESSION  = 'restaurant_os:today:session_id'
const KEY_ENTER_TS = 'restaurant_os:today:enter_ts'

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try { return window.sessionStorage } catch { return null }
}

export function getOrCreateSessionId(): string {
  const s = safeStorage()
  if (!s) return ''
  let sid = s.getItem(KEY_SESSION)
  if (!sid) {
    sid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`
    s.setItem(KEY_SESSION, sid)
  }
  return sid
}

// 첫 진입 시각 기록 — 이미 있으면 덮지 않음 (세션 내내 고정)
export function markEnter(): void {
  const s = safeStorage()
  if (!s) return
  if (!s.getItem(KEY_ENTER_TS)) {
    s.setItem(KEY_ENTER_TS, String(Date.now()))
  }
}

export function timeSinceEnter(): number | null {
  const s = safeStorage()
  if (!s) return null
  const t = s.getItem(KEY_ENTER_TS)
  if (!t) return null
  const n = parseInt(t, 10)
  if (isNaN(n)) return null
  return Math.max(0, Date.now() - n)
}

// 액션 완료 후 진입 시각 리셋 — 다음 1-액션을 위한 새 타이머
export function resetEnterTs(): void {
  const s = safeStorage()
  if (!s) return
  s.removeItem(KEY_ENTER_TS)
}
