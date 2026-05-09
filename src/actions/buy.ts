'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient, getAuthCtx } from '@/lib/supabase-server'
import { buildKakaoOrderSummary } from '@/lib/kakao-format'
import type {
  BuyListingRow,
  CartRow,
  CommerceOrderListRow,
  CreateCommerceOrderInput,
  RecentOrderItemRow,
} from '@/lib/buy-types'
import type { ActionResult } from '@/types'

function normalizeProductName(row: Record<string, unknown>): {
  product_name: string | null
  category_id: string | null
} {
  const raw = row.products ?? (row as { product?: unknown }).product
  const p = Array.isArray(raw) ? raw[0] : raw
  if (!p || typeof p !== 'object') return { product_name: null, category_id: null }
  const o = p as { name?: string | null; category_id?: string | null }
  const name = o.name != null && String(o.name).trim() ? String(o.name).trim() : null
  return { product_name: name, category_id: o.category_id ?? null }
}

function genOrderNumber(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const r = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
  return `ORD-${y}${m}${day}-${r}`
}

export async function getListings(filters?: {
  category_id?: string
  search?: string
}): Promise<ActionResult<{ listings: BuyListingRow[] }>> {
  const supabase = await createServerClient()

  const term = filters?.search?.trim()
  const cat = filters?.category_id?.trim()

  let productIds: string[] | null = null

  if (term) {
    const { data: prods, error: pe } = await supabase.from('products').select('id').ilike('name', `%${term}%`).limit(200)
    if (pe) return { success: false, error: pe.message }
    productIds = (prods ?? []).map((p: { id: string }) => p.id)
    if (productIds.length === 0) return { success: true, data: { listings: [] } }
  }

  if (cat) {
    const { data: prods, error: ce } = await supabase.from('products').select('id').eq('category_id', cat).limit(500)
    if (ce) return { success: false, error: ce.message }
    const catIds = (prods ?? []).map((p: { id: string }) => p.id)
    if (catIds.length === 0) return { success: true, data: { listings: [] } }
    if (productIds) {
      const set = new Set(catIds)
      productIds = productIds.filter((id) => set.has(id))
      if (productIds.length === 0) return { success: true, data: { listings: [] } }
    } else {
      productIds = catIds
    }
  }

  let q = supabase
    .from('commerce_product_listings')
    .select(
      `
      id,
      tenant_id,
      product_id,
      commerce_price,
      status,
      is_visible,
      created_at,
      thumbnail_url,
      image_urls,
      description,
      products ( name, category_id )
    `,
    )
    .eq('status', 'visible')
    .eq('is_visible', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (productIds) q = q.in('product_id', productIds)

  const { data, error } = await q
  if (error) return { success: false, error: error.message }

  const listings = (data ?? []).map((row: Record<string, unknown>) => {
    const { product_name, category_id } = normalizeProductName(row)
    const { products: _p, ...rest } = row as BuyListingRow & { products?: unknown }
    return {
      ...(rest as Omit<BuyListingRow, 'product_name' | 'category_id'>),
      thumbnail_url: (row.thumbnail_url as string | null) ?? null,
      image_urls: (row.image_urls as string[] | null) ?? null,
      description: (row.description as string | null) ?? null,
      product_name,
      category_id,
    }
  })

  return { success: true, data: { listings } }
}

export async function getListing(id: string): Promise<ActionResult<{ listing: BuyListingRow }>> {
  const supabase = await createServerClient()
  const lid = String(id ?? '').trim()
  if (!lid) return { success: false, error: '상품을 찾을 수 없습니다' }

  const { data, error } = await supabase
    .from('commerce_product_listings')
    .select(
      `
      id,
      tenant_id,
      product_id,
      commerce_price,
      status,
      is_visible,
      created_at,
      thumbnail_url,
      image_urls,
      description,
      products ( name, category_id )
    `,
    )
    .eq('id', lid)
    .eq('status', 'visible')
    .eq('is_visible', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: '상품을 찾을 수 없습니다' }

  const { product_name, category_id } = normalizeProductName(data as Record<string, unknown>)
  const { products: _p, ...rest } = data as BuyListingRow & { products?: unknown }
  const r = data as Record<string, unknown>
  const listing: BuyListingRow = {
    ...(rest as Omit<BuyListingRow, 'product_name' | 'category_id'>),
    thumbnail_url: (r.thumbnail_url as string | null) ?? null,
    image_urls: (r.image_urls as string[] | null) ?? null,
    description: (r.description as string | null) ?? null,
    product_name,
    category_id,
  }

  return { success: true, data: { listing } }
}

export async function getRecentOrderItems(): Promise<ActionResult<{ items: RecentOrderItemRow[] }>> {
  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return { success: false, error: '로그인이 필요합니다' }

  const { data: orders, error: oe } = await supabase
    .from('commerce_orders')
    .select('id')
    .eq('tenant_id', ctx.tenant_id)
    .order('created_at', { ascending: false })
    .limit(80)

  if (oe) return { success: false, error: oe.message }
  const orderIds = (orders ?? []).map((o: { id: string }) => o.id)
  if (orderIds.length === 0) return { success: true, data: { items: [] } }

  const { data: lines, error: le } = await supabase
    .from('commerce_order_items')
    .select('listing_id, listing_title, unit_price, created_at, order_id')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false })
    .limit(40)

  if (le) return { success: false, error: le.message }

  const seen = new Set<string>()
  const items: RecentOrderItemRow[] = []
  for (const row of lines ?? []) {
    const lid = (row as { listing_id: string }).listing_id
    if (seen.has(lid)) continue
    seen.add(lid)
    items.push({
      listing_id: lid,
      listing_title: (row as { listing_title: string }).listing_title,
      unit_price: (row as { unit_price: number }).unit_price,
      created_at: (row as { created_at: string }).created_at,
      thumbnail_url: null,
      current_price: null,
      listing_buyable: false,
    })
    if (items.length >= 10) break
  }

  if (items.length === 0) return { success: true, data: { items } }

  const lidList = items.map((i) => i.listing_id)
  const { data: listingRows, error: le2 } = await supabase
    .from('commerce_product_listings')
    .select('id, commerce_price, thumbnail_url, status, is_visible, deleted_at')
    .in('id', lidList)

  if (le2) return { success: false, error: le2.message }

  const listingMap = new Map(
    (listingRows ?? []).map((r: Record<string, unknown>) => [
      r.id as string,
      {
        commerce_price: r.commerce_price as number,
        thumbnail_url: (r.thumbnail_url as string | null) ?? null,
        status: r.status as string,
        is_visible: r.is_visible as boolean,
        deleted_at: r.deleted_at as string | null,
      },
    ]),
  )

  for (const it of items) {
    const row = listingMap.get(it.listing_id)
    if (!row) continue
    const buyable = row.status === 'visible' && row.is_visible && !row.deleted_at
    it.thumbnail_url = row.thumbnail_url?.trim() ? row.thumbnail_url.trim() : null
    it.current_price = buyable ? row.commerce_price : null
    it.listing_buyable = buyable
  }

  return { success: true, data: { items } }
}

async function assertListingBuyable(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  listing_id: string,
): Promise<
  | { ok: true; commerce_price: number; product_name: string }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase
    .from('commerce_product_listings')
    .select(
      `
      id,
      commerce_price,
      status,
      is_visible,
      deleted_at,
      products ( name )
    `,
    )
    .eq('id', listing_id)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: '상품을 찾을 수 없습니다' }

  const row = data as {
    commerce_price: number
    status: string
    is_visible: boolean
    deleted_at: string | null
    products: { name: string | null } | { name: string | null }[] | null
  }

  if (row.deleted_at) return { ok: false, error: '판매 종료된 상품입니다' }
  if (row.status !== 'visible' || !row.is_visible) return { ok: false, error: '현재 담을 수 없는 상품입니다' }

  const raw = row.products
  const p = Array.isArray(raw) ? raw[0] : raw
  const product_name = (p?.name && String(p.name).trim()) || '\u2014'

  return { ok: true, commerce_price: row.commerce_price, product_name }
}

export async function addToCart(listing_id: string, quantity: number): Promise<ActionResult<void>> {
  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return { success: false, error: '로그인이 필요합니다' }

  const lid = String(listing_id ?? '').trim()
  const qty = Number(quantity)
  if (!lid) return { success: false, error: '상품이 필요합니다' }
  if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1) {
    return { success: false, error: '수량은 1 이상이어야 합니다' }
  }

  const ok = await assertListingBuyable(supabase, lid)
  if (!ok.ok) return { success: false, error: ok.error }

  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('tenant_id', ctx.tenant_id)
    .eq('listing_id', lid)
    .maybeSingle()

  if (existing?.id) {
    const nextQty = (existing.quantity as number) + qty
    const { error: upErr } = await supabase
      .from('cart_items')
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('tenant_id', ctx.tenant_id)
    if (upErr) return { success: false, error: upErr.message }
  } else {
    const { error: insErr } = await supabase.from('cart_items').insert({
      tenant_id: ctx.tenant_id,
      listing_id: lid,
      quantity: qty,
      cart_group_id: ctx.tenant_id,
    })
    if (insErr) return { success: false, error: insErr.message }
  }

  revalidatePath('/buy')
  revalidatePath('/buy/cart')
  return { success: true }
}

export async function getCart(): Promise<ActionResult<{ items: CartRow[] }>> {
  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return { success: false, error: '로그인이 필요합니다' }

  const { data, error } = await supabase
    .from('cart_items')
    .select(
      `
      id,
      listing_id,
      quantity,
      commerce_product_listings (
        commerce_price,
        thumbnail_url,
        products ( name )
      )
    `,
    )
    .eq('tenant_id', ctx.tenant_id)
    .order('created_at', { ascending: true })

  if (error) return { success: false, error: error.message }

  const items: CartRow[] = (data ?? []).map((row: Record<string, unknown>) => {
    const lid = row.commerce_product_listings as
      | { commerce_price: number; products: { name: string | null } | { name: string | null }[] }
      | null
    const lp = lid
    const rawP = lp?.products
    const p = Array.isArray(rawP) ? rawP[0] : rawP
    const thumb = lp && 'thumbnail_url' in lp ? (lp as { thumbnail_url?: string | null }).thumbnail_url : null
    return {
      id: row.id as string,
      listing_id: row.listing_id as string,
      quantity: row.quantity as number,
      commerce_price: lp?.commerce_price ?? 0,
      product_name: p?.name ?? null,
      thumbnail_url: thumb?.trim() ? thumb.trim() : null,
    }
  })

  return { success: true, data: { items } }
}

export async function removeFromCart(id: string): Promise<ActionResult<void>> {
  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return { success: false, error: '로그인이 필요합니다' }

  const cid = String(id ?? '').trim()
  if (!cid) return { success: false, error: '항목이 필요합니다' }

  const { error } = await supabase.from('cart_items').delete().eq('id', cid).eq('tenant_id', ctx.tenant_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/buy/cart')
  revalidatePath('/buy/checkout')
  revalidatePath('/buy')
  return { success: true }
}

export async function updateCartItemQuantity(cart_item_id: string, quantity: number): Promise<ActionResult<void>> {
  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return { success: false, error: '로그인이 필요합니다' }

  const cid = String(cart_item_id ?? '').trim()
  const qty = Number(quantity)
  if (!cid) return { success: false, error: '항목이 필요합니다' }
  if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1) {
    return { success: false, error: '수량은 1 이상이어야 합니다' }
  }
  if (qty > 999) return { success: false, error: '수량이 너무 많습니다' }

  const { error } = await supabase
    .from('cart_items')
    .update({ quantity: qty, updated_at: new Date().toISOString() })
    .eq('id', cid)
    .eq('tenant_id', ctx.tenant_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/buy')
  revalidatePath('/buy/cart')
  revalidatePath('/buy/checkout')
  return { success: true }
}

export async function createCommerceOrder(
  input: CreateCommerceOrderInput,
): Promise<
  ActionResult<{
    order_id: string
    order_number: string | null
    kakao_summary: string | null
  }>
> {
  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return { success: false, error: '로그인이 필요합니다' }

  const shipping_name = input.shipping_name.trim()
  const shipping_phone = input.shipping_phone.trim()
  const shipping_address = input.shipping_address.trim()
  const delivery_memo = input.delivery_memo?.trim() || null

  if (!shipping_name || !shipping_phone || !shipping_address) {
    return { success: false, error: '배송 정보를 모두 입력해 주세요' }
  }

  const pm = input.payment_method
  if (pm !== 'card' && pm !== 'bank_transfer' && pm !== 'kakao_manual') {
    return { success: false, error: '결제 방식이 올바르지 않습니다' }
  }

  const { data: cartRows, error: cartErr } = await supabase
    .from('cart_items')
    .select('id, listing_id, quantity')
    .eq('tenant_id', ctx.tenant_id)

  if (cartErr) return { success: false, error: cartErr.message }
  const rows = cartRows ?? []
  if (rows.length === 0) return { success: false, error: '장바구니가 비어 있습니다' }

  type Line = { listing_id: string; quantity: number; unit_price: number; listing_title: string; line_total: number }
  const lines: Line[] = []

  for (const row of rows) {
    const listing_id = row.listing_id as string
    const quantity = row.quantity as number
    const ok = await assertListingBuyable(supabase, listing_id)
    if (!ok.ok) return { success: false, error: ok.error }
    const unit_price = ok.commerce_price
    const line_total = unit_price * quantity
    lines.push({
      listing_id,
      quantity,
      unit_price,
      listing_title: ok.product_name,
      line_total,
    })
  }

  const total_amount = lines.reduce((s, l) => s + l.line_total, 0)
  const order_number = genOrderNumber()

  const payment_label = pm === 'bank_transfer' ? '무통장입금' : pm === 'kakao_manual' ? '카카오 주문전달' : '카드결제'

  const { data: orderIns, error: orderErr } = await supabase
    .from('commerce_orders')
    .insert({
      tenant_id: ctx.tenant_id,
      source: 'direct',
      status: 'pending_payment',
      payment_method: pm,
      payment_status: 'unpaid',
      total_amount,
      shipping_name,
      shipping_phone,
      shipping_address,
      delivery_memo,
      order_number,
    })
    .select('id, order_number')
    .single()

  if (orderErr || !orderIns) {
    return { success: false, error: orderErr?.message ?? '주문 생성에 실패했습니다' }
  }

  const order_id = orderIns.id as string
  const savedNo = (orderIns as { order_number?: string | null }).order_number ?? order_number

  const itemPayload = lines.map((l) => ({
    order_id,
    listing_id: l.listing_id,
    quantity: l.quantity,
    unit_price: l.unit_price,
    total_price: l.line_total,
    listing_title: l.listing_title,
  }))

  const { error: itemErr } = await supabase.from('commerce_order_items').insert(itemPayload)

  if (itemErr) {
    await supabase.from('commerce_orders').delete().eq('id', order_id)
    return { success: false, error: itemErr.message }
  }

  const { error: delErr } = await supabase.from('cart_items').delete().eq('tenant_id', ctx.tenant_id)
  if (delErr) {
    console.error('[createCommerceOrder] cart clear failed', delErr)
  }

  const kakao_summary =
    pm === 'bank_transfer' || pm === 'kakao_manual'
      ? buildKakaoOrderSummary({
          order_number: savedNo,
          payment_label,
          total_amount,
          shipping_name,
          shipping_phone,
          shipping_address,
          delivery_memo,
          lines: lines.map((l) => ({
            title: l.listing_title,
            quantity: l.quantity,
            unit_price: l.unit_price,
            line_total: l.line_total,
          })),
        })
      : null

  revalidatePath('/buy')
  revalidatePath('/buy/cart')
  revalidatePath('/buy/checkout')
  revalidatePath('/buy/orders')

  return {
    success: true,
    data: {
      order_id,
      order_number: savedNo,
      kakao_summary,
    },
  }
}

export async function getMyCommerceOrders(): Promise<ActionResult<{ orders: CommerceOrderListRow[] }>> {
  const supabase = await createServerClient()
  const ctx = await getAuthCtx(supabase)
  if (!ctx) return { success: false, error: '로그인이 필요합니다' }

  const { data, error } = await supabase
    .from('commerce_orders')
    .select('id, order_number, status, total_amount, created_at')
    .eq('tenant_id', ctx.tenant_id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: { orders: (data ?? []) as CommerceOrderListRow[] },
  }
}
