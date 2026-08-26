-- 찜(위시리스트) — 매장별 관심 상품 저장
-- 운영 DB 적용 완료 (2026-08-26, Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  listing_id uuid NOT NULL REFERENCES public.commerce_product_listings(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, listing_id)
);

-- 목록 조회는 항상 tenant_id 스코프 + 최근 담은 순
CREATE INDEX IF NOT EXISTS wishlist_items_tenant_idx
  ON public.wishlist_items (tenant_id, created_at DESC);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

-- cart_items 와 동일한 매장 스코프 정책
CREATE POLICY "wishlist_items_tenant"
  ON public.wishlist_items FOR ALL
  USING (tenant_id = get_my_tenant_id());
