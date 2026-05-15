-- 식당OS 회원가입 확장 필드 (additive only)

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS business_number text,
  ADD COLUMN IF NOT EXISTS business_type text
    CHECK (business_type IN ('active', 'prospective')),
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_detail text,
  ADD COLUMN IF NOT EXISTS representative_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'failed')),
  ADD COLUMN IF NOT EXISTS marketing_agreed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_agreed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_business_number_unique
  ON tenants (business_number)
  WHERE business_number IS NOT NULL;
