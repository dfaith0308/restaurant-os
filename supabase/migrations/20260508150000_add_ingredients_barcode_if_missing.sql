-- SUP-MISSING-011: ingredients.barcode (식자재 SKU)
-- WARNING: Migration file only. Do not execute without approval.

ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS barcode text;

CREATE INDEX IF NOT EXISTS ingredients_tenant_barcode_idx
  ON public.ingredients (tenant_id, barcode)
  WHERE barcode IS NOT NULL;
