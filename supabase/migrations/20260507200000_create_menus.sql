-- RES-MISSING-002: 메뉴 + 원가 계산
-- PRODUCT §8-7 식당OS 설정
CREATE TABLE IF NOT EXISTS public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  category text,
  is_representative boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS menus_tenant_idx
  ON public.menus (tenant_id, is_active);
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menus_tenant" ON public.menus FOR ALL
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE TABLE IF NOT EXISTS public.menu_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  menu_id uuid NOT NULL
    REFERENCES public.menus(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL
    REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS menu_ingredients_menu_idx
  ON public.menu_ingredients (tenant_id, menu_id);
ALTER TABLE public.menu_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_ingredients_tenant"
  ON public.menu_ingredients FOR ALL
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE TABLE IF NOT EXISTS public.menu_cost_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  menu_name text NOT NULL,
  estimated_ingredients jsonb,
  estimated_cost integer,
  source text NOT NULL DEFAULT 'gpt'
    CHECK (source IN ('gpt', 'internal')),
  confidence_level integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS menu_cost_cache_tenant_name_uidx
  ON public.menu_cost_cache (tenant_id, menu_name);
ALTER TABLE public.menu_cost_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_cost_cache_tenant"
  ON public.menu_cost_cache FOR ALL
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());
