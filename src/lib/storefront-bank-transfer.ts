/** storefront 무통장 입금 안내 — `admin_settings.key` (realmyos와 동일 키) */
export const STOREFRONT_BANK_TRANSFER_SETTINGS_KEY = 'storefront_bank_transfer' as const

export type StorefrontBankTransferSettings = {
  bank_name: string
  account_number: string
  account_holder: string
  notice: string
}

export function parseStorefrontBankTransferJson(raw: string | null | undefined): StorefrontBankTransferSettings | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  try {
    const o = JSON.parse(s) as Record<string, unknown>
    const bank_name = typeof o.bank_name === 'string' ? o.bank_name.trim() : ''
    const account_number = typeof o.account_number === 'string' ? o.account_number.trim() : ''
    const account_holder = typeof o.account_holder === 'string' ? o.account_holder.trim() : ''
    const notice = typeof o.notice === 'string' ? o.notice.trim() : ''
    if (!bank_name || !account_number || !account_holder) return null
    return { bank_name, account_number, account_holder, notice }
  } catch {
    return null
  }
}
