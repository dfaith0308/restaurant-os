'use server'

import { createServerClient } from '@/lib/supabase-server'

/**
 * realmyos `POLICY_SETTING_DEFAULTS`와 동일한 값을 유지할 것 (D-018).
 * 식당OS는 별 저장소라 상수만 최소 복제.
 */
const POLICY_NUMERIC_FALLBACK: Record<string, string> = {
  rfq_repeat_limit: '3',
  rfq_open_duration_hours: '24',
}

export async function getAdminSettingNumber(key: string, bounds?: { min: number; max: number }): Promise<number> {
  const meta = POLICY_NUMERIC_FALLBACK[key]
  let fallback = meta ? Math.floor(Number(meta)) : 0
  if (!Number.isFinite(fallback)) fallback = 0

  const clamp = (n: number) => (bounds ? Math.max(bounds.min, Math.min(bounds.max, n)) : n)

  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase.from('admin_settings').select('value').eq('key', key).maybeSingle()
    if (error || data == null) return clamp(fallback)
    const n = Math.floor(Number((data as { value?: string }).value))
    if (!Number.isFinite(n)) return clamp(fallback)
    return clamp(n)
  } catch {
    return clamp(fallback)
  }
}
