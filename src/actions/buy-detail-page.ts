'use server'

import { createSupabaseAdmin } from '@/lib/supabase-server'
import {
  DETAIL_FIELDS,
  LINK_OVERRIDE_KEYS,
  ORDER_GUIDE_SETTING_KEYS,
  buildBuyDetailPageView,
  type BuyDetailPageView,
  type DetailFieldKey,
  type DetailListingRow,
  type DetailValues,
} from '@/lib/detail-template'

/**
 * 식당OS — 상품 상세의 "새 상세페이지 방식"(템플릿) 화면 데이터.
 *
 * 템플릿·링크 테이블은 RLS 가 관리자 전용이다. 여기서는 **노출 중인 listing 인지 먼저 확인한 뒤**
 * service role 로 필요한 칸만 읽는다(구매자 정보와 무관한 상품 소개 데이터라 tenant 스코프 대상이 아니다
 * — 기존 getListing 도 비회원에게 열린 데이터다).
 *
 * 연결 안 된 listing / 보관된 템플릿 / 마이그레이션 전 → null. 화면은 지금 상세 그대로.
 * 쿼리는 옵션 수와 무관하게 5번 고정(N+1 없음). 화면 모델 조립은 lib 의 순수 함수가 한다.
 */

const VISIBLE_STATUSES = ['visible', 'sold_out']

export async function getBuyListingDetailPage(listingId: string): Promise<BuyDetailPageView | null> {
  const lid = String(listingId ?? '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(lid)) return null

  const admin = await createSupabaseAdmin()

  // 1) 이 listing 의 연결
  const { data: link, error: linkErr } = await admin
    .from('commerce_listing_detail_links')
    .select(['listing_id', 'template_id', ...LINK_OVERRIDE_KEYS].join(', '))
    .eq('listing_id', lid)
    .maybeSingle()
  if (linkErr || !link) return null
  const linkRow = link as unknown as Record<string, unknown>
  const templateId = String(linkRow.template_id)

  // 2) 템플릿(보관 제외) · 3) 같은 템플릿의 옵션 순서 · 4) 발주 안내 설정 — 병렬
  const [tRes, siblingsRes, settingsRes] = await Promise.all([
    admin
      .from('commerce_detail_templates')
      .select(DETAIL_FIELDS.map((f) => f.key).join(', '))
      .eq('id', templateId)
      .is('archived_at', null)
      .maybeSingle(),
    admin
      .from('commerce_listing_detail_links')
      .select('listing_id, sort_order')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true }),
    admin.from('admin_settings').select('key, value').in('key', Object.values(ORDER_GUIDE_SETTING_KEYS)),
  ])
  if (tRes.error || !tRes.data || siblingsRes.error) return null

  const siblingIds = ((siblingsRes.data ?? []) as { listing_id: string }[]).map((s) => s.listing_id)

  // 5) 옵션 listing 들 — 노출 중인 것만
  const { data: listingRows, error: lErr } = await admin
    .from('commerce_product_listings')
    .select(
      'id, spec, commerce_price, status, bulk_qty, bulk_discount_rate, free_shipping_qty, base_shipping_fee, min_order_qty, image_urls, origin, allergen, storage_method, ingredients',
    )
    .in('id', siblingIds)
    .in('status', VISIBLE_STATUSES)
    .eq('is_visible', true)
    .is('deleted_at', null)
  if (lErr) return null

  const byId = new Map(((listingRows ?? []) as Record<string, unknown>[]).map((r) => [String(r.id), r]))
  const options: DetailListingRow[] = siblingIds
    .map((id) => byId.get(id))
    .filter((r): r is Record<string, unknown> => Boolean(r))
    .map((r) => ({
      id: String(r.id),
      spec: (r.spec as string | null) ?? null,
      commerce_price: Number(r.commerce_price ?? 0),
      status: String(r.status ?? ''),
      bulk_qty: (r.bulk_qty as number | null) ?? null,
      bulk_discount_rate: r.bulk_discount_rate == null ? null : Number(r.bulk_discount_rate),
      free_shipping_qty: (r.free_shipping_qty as number | null) ?? null,
      base_shipping_fee: (r.base_shipping_fee as number | null) ?? null,
      min_order_qty: (r.min_order_qty as number | null) ?? null,
      image_urls: (r.image_urls as string[] | null) ?? null,
      origin: (r.origin as string | null) ?? null,
      allergen: (r.allergen as string | null) ?? null,
      storage_method: (r.storage_method as string | null) ?? null,
      ingredients: (r.ingredients as string | null) ?? null,
    }))

  const overrides: DetailValues = {}
  for (const k of LINK_OVERRIDE_KEYS) overrides[k as DetailFieldKey] = (linkRow[k] ?? null) as DetailValues[DetailFieldKey]

  return buildBuyDetailPageView({
    currentListingId: lid,
    template: tRes.data as unknown as DetailValues,
    overrides,
    options,
    settingsRows: settingsRes.error ? [] : ((settingsRes.data ?? []) as { key: string; value: string | null }[]),
  })
}
