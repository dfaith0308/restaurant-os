'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, PaymentOutgoing } from '@/types'
import { networkApprovalErrorIfBlocked } from '@/lib/get-restaurant'

// ── 돈관리 대시보드 (payments 테이블 — realmyos DB 단일화 구조) ─

export interface MoneyDashboard {
  due_this_week:  number
  due_this_month: number
  total_unpaid:   number
  payments:       PaymentOutgoing[]
  supplier_balances?: SupplierBalance[]
  is_tight:       boolean
}

export interface SupplierBalance {
  counterparty_name: string
  total_unpaid:      number
  oldest_due_date:   string
}

export async function getSupplierBalances(
  tenant_id: string,
): Promise<SupplierBalance[]> {
  const deny = await networkApprovalErrorIfBlocked()
  if (deny) return []

  const supabase = await createServerClient()

  const { data, error } = await supabase.rpc('get_supplier_balances', {
    p_tenant_id: tenant_id,
  })

  if (error || !data) return []

  return (data as Array<{
    counterparty_name: string | null
    total_unpaid: number | string | null
    oldest_due_date: string | null
  }>)
    .filter((r) => !!r.counterparty_name)
    .map((r) => ({
      counterparty_name: r.counterparty_name as string,
      total_unpaid: Number(r.total_unpaid ?? 0),
      oldest_due_date: r.oldest_due_date ?? '',
    }))
}

export async function getMoneyDashboard(
  tenant_id: string,
): Promise<ActionResult<MoneyDashboard>> {
  const deny = await networkApprovalErrorIfBlocked()
  if (deny) return { success: false, error: deny }

  const supabase = await createServerClient()

  const today    = new Date()
  const in7      = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().slice(0, 10)

  // payments 테이블: payer_tenant_id = 식당, direction = 'outbound'
  const [{ data, error }, supplier_balances] = await Promise.all([
    supabase
    .from('payments')
    .select('id, payer_tenant_id, order_id, counterparty_name, amount, due_date, status, paid_at, memo')
    .eq('payer_tenant_id', tenant_id)
    .eq('direction', 'outbound')
    .eq('status', 'pending')
    .order('due_date', { ascending: true }),
    getSupplierBalances(tenant_id),
  ])

  if (error) return { success: false, error: error.message }

  const list = (data ?? []) as PaymentOutgoing[]
  const due_this_week  = list.filter(p => p.due_date <= in7).reduce((s, p) => s + p.amount, 0)
  const due_this_month = list.filter(p => p.due_date <= monthEnd).reduce((s, p) => s + p.amount, 0)
  const total_unpaid   = list.reduce((s, p) => s + p.amount, 0)
  const is_tight       = due_this_month > 0 && due_this_week / due_this_month > 0.7

  return {
    success: true,
    data: { due_this_week, due_this_month, total_unpaid, payments: list, supplier_balances, is_tight },
  }
}

// ── 지급 완료 ────────────────────────────────────────────────

export async function markPaymentPaid(
  payment_id: string,
  tenant_id: string,
): Promise<ActionResult> {
  const deny = await networkApprovalErrorIfBlocked()
  if (deny) return { success: false, error: deny }

  const supabase = await createServerClient()

  const { error } = await supabase
    .from('payments')
    .update({ status: 'confirmed', paid_at: new Date().toISOString() })
    .eq('id', payment_id)
    .eq('payer_tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/money')
  revalidatePath('/today')
  return { success: true }
}

// ── 수동 지급 추가 ───────────────────────────────────────────

export interface AddManualPaymentInput {
  tenant_id:     string
  supplier_name: string
  amount:        number
  due_date:      string
  memo?:         string
}

export async function addManualPayment(
  input: AddManualPaymentInput,
): Promise<ActionResult<{ id: string }>> {
  const supplier = input.supplier_name.trim()
  const amount = input.amount

  if (!supplier || !input.due_date) {
    return { success: false, error: '거래처/금액/지급일을 입력해주세요' }
  }
  if (!Number.isFinite(amount)) return { success: false, error: '금액이 올바르지 않습니다' }
  if (!Number.isInteger(amount)) return { success: false, error: '금액은 정수(원)만 입력할 수 있습니다' }
  if (amount <= 0) return { success: false, error: '금액은 1원 이상이어야 합니다' }
  if (amount > 999_999_999) return { success: false, error: '금액이 너무 큽니다 (최대 999,999,999원)' }

  const deny = await networkApprovalErrorIfBlocked()
  if (deny) return { success: false, error: deny }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('payments')
    .insert({
      payer_tenant_id: input.tenant_id,
      tenant_id:       input.tenant_id,   // RLS용
      counterparty_name: supplier,  // payments 컬럼명
      amount,
      due_date:        input.due_date,
      memo:            input.memo ?? null,
      status:          'pending',
      direction:       'outbound',
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

  revalidatePath('/money')
  revalidatePath('/today')
  return { success: true, data: { id: data.id } }
}
