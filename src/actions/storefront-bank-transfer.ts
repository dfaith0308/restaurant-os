'use server'

import { createServerClient } from '@/lib/supabase-server'
import {
  STOREFRONT_BANK_TRANSFER_SETTINGS_KEY,
  parseStorefrontBankTransferJson,
  type StorefrontBankTransferSettings,
} from '@/lib/storefront-bank-transfer'

type ActionResult<T> = { success: boolean; data?: T; error?: string }

/**
 * 체크아웃 완료 화면용 — 인증된 식당 세션에서 `admin_settings` SELECT (RLS: 전역 읽기 허용).
 * 조회 실패 시에도 주문 플로우는 막지 않도록 `data: null` 로 성공 처리한다.
 */
export async function getStorefrontBankTransferForCheckout(): Promise<
  ActionResult<StorefrontBankTransferSettings | null>
> {
  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', STOREFRONT_BANK_TRANSFER_SETTINGS_KEY)
      .maybeSingle()

    if (error) {
      console.error('[getStorefrontBankTransferForCheckout] admin_settings select failed', error.message)
      return { success: true, data: null }
    }
    const raw = (data as { value?: string } | null)?.value ?? null
    return { success: true, data: parseStorefrontBankTransferJson(raw) }
  } catch (e) {
    console.error('[getStorefrontBankTransferForCheckout]', e)
    return { success: true, data: null }
  }
}
