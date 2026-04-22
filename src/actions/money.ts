'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, PaymentOutgoing } from '@/types'

// ── 돈관리 대시보드 ───────────────────────────────────────────

export interface MoneyDashboard {
  due_this_week:  number
  due_this_month: number
  total_unpaid:   number
  payments:       PaymentOutgoing[]
  is_tight:       boolean   // 이번 주 지급이 이번 달 70% 이상
}

export async function getMoneyDashboard(
  restaurant_id: string,
): Promise<ActionResult<MoneyDashboard>> {
  const supabase = await createServerClient()

  const today    = new Date()
  const in7      = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('payments_outgoing')
    .select('*')
    .eq('restaurant_id', restaurant_id)
    .eq('status', 'planned')
    .order('due_date', { ascending: true })

  if (error) return { success: false, error: error.message }

  const list = (data ?? []) as PaymentOutgoing[]
  const due_this_week  = list.filter(p => p.due_date <= in7).reduce((s, p) => s + p.amount, 0)
  const due_this_month = list.filter(p => p.due_date <= monthEnd).reduce((s, p) => s + p.amount, 0)
  const total_unpaid   = list.reduce((s, p) => s + p.amount, 0)
  const is_tight       = due_this_month > 0 && due_this_week / due_this_month > 0.7

  return {
    success: true,
    data: { due_this_week, due_this_month, total_unpaid, payments: list, is_tight },
  }
}

// ── 지급 완료 ────────────────────────────────────────────────

export async function markPaymentPaid(payment_id: string): Promise<ActionResult> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('payments_outgoing')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', payment_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/money')
  revalidatePath('/today')
  return { success: true }
}

// ── 수동 지급 추가 ───────────────────────────────────────────

export interface AddManualPaymentInput {
  restaurant_id: string
  supplier_name: string
  amount:        number
  due_date:      string
  memo?:         string
}

export async function addManualPayment(
  input: AddManualPaymentInput,
): Promise<ActionResult<{ id: string }>> {
  if (!input.supplier_name.trim() || !input.amount || !input.due_date) {
    return { success: false, error: '거래처/금액/지급일을 입력해주세요' }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('payments_outgoing')
    .insert({
      restaurant_id: input.restaurant_id,
      supplier_name: input.supplier_name.trim(),
      amount:        input.amount,
      due_date:      input.due_date,
      memo:          input.memo ?? null,
      status:        'planned',
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? '저장 실패' }

  revalidatePath('/money')
  revalidatePath('/today')
  return { success: true, data: { id: data.id } }
}
