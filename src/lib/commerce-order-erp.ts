import type { SupabaseClient } from '@supabase/supabase-js'

export const PLATFORM_OWNER_TENANT = '00000000-0000-0000-0000-000000000000'

type PaidOrderRef = {
  id: string
  tenant_id: string
  order_number: string | null
  total_amount: number
  payment_method: string
}

function kstTodayDateString(): string {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
}

async function insertErpLog(
  supabase: SupabaseClient,
  input: {
    actor_user_id: string
    tenant_id: string | null
    action_type: string
    target_table?: string | null
    target_id?: string | null
    new_value?: unknown
  },
): Promise<void> {
  const { error } = await supabase.from('admin_logs').insert({
    admin_tenant_id: PLATFORM_OWNER_TENANT,
    admin_id: input.actor_user_id,
    tenant_id: input.tenant_id,
    action_type: input.action_type,
    target_table: input.target_table ?? null,
    target_id: input.target_id ?? null,
    new_value: input.new_value ?? null,
  })
  if (error) {
    console.error('[commerce-order-erp] admin_logs insert failed', input.action_type, error.message)
  }
}

/**
 * realmyos `tryRecordPlatformReceivablePayment`와 동일 스키마.
 * 실패해도 throw 하지 않음.
 */
export async function tryRecordPlatformReceivablePayment(
  supabase: SupabaseClient,
  actorUserId: string,
  order: PaidOrderRef,
): Promise<void> {
  const { data: dup } = await supabase
    .from('payments')
    .select('id')
    .eq('commerce_order_id', order.id)
    .is('reversal_of_id', null)
    .maybeSingle()
  if (dup?.id) return

  const amt =
    typeof order.total_amount === 'number' && Number.isFinite(order.total_amount) ? order.total_amount : NaN
  if (!Number.isFinite(amt) || amt <= 0) {
    console.error('[commerce-order-erp] invalid total_amount', order.total_amount)
    await insertErpLog(supabase, {
      actor_user_id: actorUserId,
      tenant_id: order.tenant_id,
      action_type: 'platform_payment_insert_failed',
      target_table: 'payments',
      new_value: {
        commerce_order_id: order.id,
        order_number: order.order_number,
        error: 'invalid total_amount for platform payment',
      },
    })
    return
  }

  const pm = String(order.payment_method ?? '')
  if (pm !== 'bank_transfer' && pm !== 'kakao_manual' && pm !== 'card') {
    console.error('[commerce-order-erp] unsupported payment_method', pm)
    await insertErpLog(supabase, {
      actor_user_id: actorUserId,
      tenant_id: order.tenant_id,
      action_type: 'platform_payment_insert_failed',
      target_table: 'payments',
      new_value: {
        commerce_order_id: order.id,
        order_number: order.order_number,
        error: `unsupported payment_method: ${pm}`,
      },
    })
    return
  }

  const paymentDate = kstTodayDateString()
  const label = `storefront 주문 ${order.order_number ?? order.id}`

  const { data: inserted, error } = await supabase
    .from('payments')
    .insert({
      tenant_id: PLATFORM_OWNER_TENANT,
      payer_tenant_id: order.tenant_id,
      payee_tenant_id: PLATFORM_OWNER_TENANT,
      direction: 'inbound',
      status: 'confirmed',
      amount: amt,
      commerce_order_id: order.id,
      payment_method: pm,
      payment_date: paymentDate,
      due_date: paymentDate,
      deposit_amount: 0,
      order_id: null,
      counterparty_name: label,
      memo: label,
      created_by: actorUserId,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    const code = (error as { code?: string }).code
    if (code === '23505') return
    console.error('[commerce-order-erp] payments insert failed', error.message)
    await insertErpLog(supabase, {
      actor_user_id: actorUserId,
      tenant_id: order.tenant_id,
      action_type: 'platform_payment_insert_failed',
      target_table: 'payments',
      new_value: {
        commerce_order_id: order.id,
        order_number: order.order_number,
        error: error.message,
      },
    })
    return
  }

  const payId = (inserted as { id?: string } | null)?.id ?? null
  await insertErpLog(supabase, {
    actor_user_id: actorUserId,
    tenant_id: order.tenant_id,
    action_type: 'platform_payment_recorded',
    target_table: 'payments',
    target_id: payId,
    new_value: {
      commerce_order_id: order.id,
      amount: amt,
      order_number: order.order_number,
      payer_tenant_id: order.tenant_id,
      payment_id: payId,
    },
  })
}

type ListingRow = {
  id: string
  supplier_tenant_id: string | null
  owner_type: string
  owner_tenant_id: string
  product_id: string | null
}

function resolveSupplierTenantId(listing: ListingRow, product: { tenant_id: string } | null): string | null {
  const P = PLATFORM_OWNER_TENANT
  if (listing.supplier_tenant_id && listing.supplier_tenant_id !== P) return listing.supplier_tenant_id
  if (listing.owner_type === 'approved_supplier' && listing.owner_tenant_id && listing.owner_tenant_id !== P) {
    return listing.owner_tenant_id
  }
  if (product?.tenant_id && product.tenant_id !== P) return product.tenant_id
  return null
}

async function loadPlatformFeePercentNumerator(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from('admin_settings').select('value').eq('key', 'platform_fee_rate').maybeSingle()
  if (error) return 0
  const n = Number((data as { value?: unknown } | null)?.value)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/**
 * realmyos `createCommerceOrderAllocations`와 동일 로직 (service role).
 * 실패해도 throw 하지 않음.
 */
export async function tryCreateCommerceOrderAllocations(
  supabase: SupabaseClient,
  actorUserId: string,
  commerce_order_id: string,
): Promise<void> {
  const oid = String(commerce_order_id ?? '').trim()
  if (!oid) return

  const { data: order, error: oErr } = await supabase
    .from('commerce_orders')
    .select('id, tenant_id, payment_status, order_number')
    .eq('id', oid)
    .maybeSingle()

  if (oErr) {
    console.error('[commerce-order-erp] allocation order fetch failed', oErr.message)
    return
  }
  if (!order) return
  if (order.payment_status !== 'paid') return

  const { data: items, error: iErr } = await supabase
    .from('commerce_order_items')
    .select('id, listing_id, quantity, unit_price, total_price')
    .eq('order_id', oid)

  if (iErr) {
    console.error('[commerce-order-erp] allocation items fetch failed', iErr.message)
    return
  }

  const itemRows = (items ?? []) as {
    id: string
    listing_id: string
    quantity: number
    unit_price: number
    total_price: number
  }[]

  if (itemRows.length === 0) {
    await insertErpLog(supabase, {
      actor_user_id: actorUserId,
      tenant_id: order.tenant_id as string,
      action_type: 'commerce_allocation_failed',
      target_table: 'commerce_orders',
      target_id: oid,
      new_value: { reason: 'no_order_items', order_number: order.order_number },
    })
    return
  }

  const { data: existing, error: exErr } = await supabase
    .from('commerce_order_allocations')
    .select('commerce_order_item_id')
    .eq('commerce_order_id', oid)

  if (exErr) {
    console.error('[commerce-order-erp] allocation existing fetch failed', exErr.message)
    return
  }

  const existingItemIds = new Set((existing ?? []).map((r: { commerce_order_item_id: string }) => r.commerce_order_item_id))
  const toProcess = itemRows.filter((it) => !existingItemIds.has(it.id))
  const skipped = itemRows.length - toProcess.length
  if (toProcess.length === 0) return

  const listingIds = [...new Set(toProcess.map((t) => t.listing_id))]
  const { data: listings, error: lErr } = await supabase
    .from('commerce_product_listings')
    .select('id, supplier_tenant_id, owner_type, owner_tenant_id, product_id')
    .in('id', listingIds)

  if (lErr) {
    console.error('[commerce-order-erp] allocation listings fetch failed', lErr.message)
    return
  }

  const listingMap = new Map((listings ?? []).map((l: ListingRow) => [l.id, l as ListingRow]))

  const productIds = [
    ...new Set(
      (listings ?? [])
        .map((l: ListingRow) => l.product_id)
        .filter((x): x is string => typeof x === 'string' && x.length > 0),
    ),
  ]
  const productMap = new Map<string, { tenant_id: string }>()
  if (productIds.length) {
    const { data: products, error: pErr } = await supabase.from('products').select('id, tenant_id').in('id', productIds)
    if (pErr) {
      console.error('[commerce-order-erp] allocation products fetch failed', pErr.message)
      return
    }
    for (const p of (products ?? []) as { id: string; tenant_id: string }[]) {
      productMap.set(p.id, { tenant_id: p.tenant_id })
    }
  }

  const feeNum = await loadPlatformFeePercentNumerator(supabase)
  const feeRateDecimal = Number((feeNum / 100).toFixed(4))

  type Planned = {
    commerce_order_item_id: string
    supplier_tenant_id: string
    item_amount: number
    platform_fee_rate: number
    platform_fee_amount: number
    supplier_payable_amount: number
  }

  const planned: Planned[] = []
  const resolutionErrors: { item_id: string; listing_id: string; reason: string }[] = []

  for (const it of toProcess) {
    const listing = listingMap.get(it.listing_id)
    if (!listing) {
      resolutionErrors.push({ item_id: it.id, listing_id: it.listing_id, reason: 'listing_not_found' })
      continue
    }
    const product = listing.product_id ? productMap.get(listing.product_id) ?? null : null
    const supplierId = resolveSupplierTenantId(listing, product)
    if (!supplierId) {
      resolutionErrors.push({ item_id: it.id, listing_id: it.listing_id, reason: 'supplier_unresolved' })
      continue
    }

    const item_amount =
      typeof it.total_price === 'number' && Number.isFinite(it.total_price) && it.total_price >= 0
        ? it.total_price
        : Math.max(0, Math.round((it.unit_price ?? 0) * (it.quantity ?? 0)))

    const platform_fee_amount = Math.round((item_amount * feeNum) / 100)
    const supplier_payable_amount = item_amount - platform_fee_amount
    if (supplier_payable_amount < 0 || platform_fee_amount < 0) {
      resolutionErrors.push({ item_id: it.id, listing_id: it.listing_id, reason: 'invalid_amounts' })
      continue
    }

    planned.push({
      commerce_order_item_id: it.id,
      supplier_tenant_id: supplierId,
      item_amount,
      platform_fee_rate: feeRateDecimal,
      platform_fee_amount,
      supplier_payable_amount,
    })
  }

  if (resolutionErrors.length || planned.length !== toProcess.length) {
    await insertErpLog(supabase, {
      actor_user_id: actorUserId,
      tenant_id: order.tenant_id as string,
      action_type: 'commerce_allocation_failed',
      target_table: 'commerce_orders',
      target_id: oid,
      new_value: {
        order_number: order.order_number,
        errors: resolutionErrors,
        fee_percent_numerator: feeNum,
        expected_items: toProcess.length,
        planned_items: planned.length,
      },
    })
    return
  }

  const insertedIds: string[] = []
  for (const row of planned) {
    const { data: ins, error: insErr } = await supabase
      .from('commerce_order_allocations')
      .insert({
        commerce_order_id: oid,
        commerce_order_item_id: row.commerce_order_item_id,
        supplier_tenant_id: row.supplier_tenant_id,
        item_amount: row.item_amount,
        platform_fee_rate: row.platform_fee_rate,
        platform_fee_amount: row.platform_fee_amount,
        supplier_payable_amount: row.supplier_payable_amount,
        status: 'pending',
      })
      .select('id')
      .maybeSingle()

    if (insErr || !ins?.id) {
      if (insertedIds.length) {
        await supabase.from('commerce_order_allocations').delete().in('id', insertedIds)
      }
      await insertErpLog(supabase, {
        actor_user_id: actorUserId,
        tenant_id: order.tenant_id as string,
        action_type: 'commerce_allocation_failed',
        target_table: 'commerce_orders',
        target_id: oid,
        new_value: {
          order_number: order.order_number,
          reason: 'insert_failed',
          message: insErr?.message ?? 'no id',
          rolled_back_ids: insertedIds,
        },
      })
      return
    }
    insertedIds.push(ins.id as string)
  }

  if (planned.length > 0) {
    await insertErpLog(supabase, {
      actor_user_id: actorUserId,
      tenant_id: order.tenant_id as string,
      action_type: 'commerce_allocation_created',
      target_table: 'commerce_orders',
      target_id: oid,
      new_value: {
        order_number: order.order_number,
        created: planned.length,
        skipped,
        allocation_ids: insertedIds,
      },
    })
  }
}

export async function runCommerceOrderPaidErpPostProcessing(
  supabase: SupabaseClient,
  actorUserId: string,
  order: PaidOrderRef,
): Promise<void> {
  await tryRecordPlatformReceivablePayment(supabase, actorUserId, order)
  await tryCreateCommerceOrderAllocations(supabase, actorUserId, order.id)
}
