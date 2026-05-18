-- 거래명세서 OCR 공급업체 후보 데이터
-- WARNING: Migration file only. Apply via Supabase SQL Editor first. Do not re-run.

CREATE TABLE IF NOT EXISTS public.invoice_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  normalized_name text NOT NULL,
  supplier_name text,
  phone text,
  business_number text,
  address text,
  bank_info text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_suppliers_tenant_normalized_idx
  ON public.invoice_suppliers (tenant_id, normalized_name);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_suppliers_tenant_normalized_unique_idx
  ON public.invoice_suppliers (tenant_id, normalized_name);

ALTER TABLE public.invoice_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_suppliers_tenant"
  ON public.invoice_suppliers FOR ALL
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());
