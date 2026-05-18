-- 식자재 공급가 이력 (append-only)
-- WARNING: Migration file only. Already applied via Supabase SQL Editor. Do not re-run.

CREATE TABLE IF NOT EXISTS public.ingredient_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  ingredient_id uuid NOT NULL
    REFERENCES public.ingredients(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingredient_price_history_tenant_ingredient_idx
  ON public.ingredient_price_history (tenant_id, ingredient_id);

ALTER TABLE public.ingredient_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredient_price_history_tenant"
  ON public.ingredient_price_history FOR ALL
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());
