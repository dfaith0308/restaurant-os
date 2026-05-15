'use server'

import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { ActionResult } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SignupBusinessType = 'active' | 'prospective'

export interface SignupInput {
  email: string
  password: string
  storeName: string
  businessType: SignupBusinessType
  businessNumber: string
  representativeName: string
  contactPhone: string
  address: string
  addressDetail: string
  marketingAgreed: boolean
}

const DUPLICATE_EMAIL_ERROR = '이미 가입된 이메일입니다'

export type SignupEmailCheckStatus = 'invalid' | 'duplicate' | 'available'

function cleanDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function isSignupEmailFormatValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function isDuplicateEmailAuthError(error: { message?: string; code?: string }): boolean {
  const code = error.code?.toLowerCase() ?? ''
  if (code === 'email_exists' || code === 'user_already_exists') return true
  const m = (error.message ?? '').toLowerCase()
  return (
    m.includes('already registered') ||
    m.includes('already been registered') ||
    m.includes('user already registered') ||
    m.includes('email address has already been registered')
  )
}

async function deleteAuthUser(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.auth.admin.deleteUser(userId)
}

async function deleteTenant(admin: SupabaseClient, tenantId: string): Promise<void> {
  await admin.from('tenants').delete().eq('id', tenantId)
}

function isTriggerPlaceholderTenant(
  tenant: { role: string | null; name: string | null },
  userRole: string | null,
): boolean {
  if (userRole === 'supplier') return true
  if (tenant.role === 'supplier' || tenant.role === null) return true
  if (tenant.name === '내 회사') return true
  return false
}

async function cleanupTriggerOnboardingArtifacts(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: existingUser } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (existingUser?.tenant_id) {
    const { data: linkedTenant } = await admin
      .from('tenants')
      .select('id, role, name')
      .eq('id', existingUser.tenant_id)
      .maybeSingle()

    if (
      linkedTenant &&
      isTriggerPlaceholderTenant(linkedTenant, existingUser.role ?? null)
    ) {
      await admin.from('users').delete().eq('id', userId)
      await deleteTenant(admin, linkedTenant.id)
    }
  }

  const { data: ownerTenants, error: ownerQueryErr } = await admin
    .from('tenants')
    .select('id, role, name')
    .eq('owner_id', userId)

  if (!ownerQueryErr && ownerTenants) {
    for (const tenant of ownerTenants) {
      if (isTriggerPlaceholderTenant(tenant, 'supplier')) {
        await deleteTenant(admin, tenant.id)
      }
    }
  }
}

export async function checkSignupEmailAvailable(
  email: string,
): Promise<{ status: SignupEmailCheckStatus }> {
  const trimmed = email.trim()
  if (!isSignupEmailFormatValid(trimmed)) {
    return { status: 'invalid' }
  }
  return { status: 'available' }
}

export async function signupAction(input: SignupInput): Promise<ActionResult> {
  const email = input.email.trim()
  const password = input.password
  const storeName = input.storeName.trim()
  const representativeName = input.representativeName.trim()
  const contactPhone = input.contactPhone.trim()
  const address = input.address.trim()
  const addressDetail = input.addressDetail.trim()
  const cleanedBn = cleanDigits(input.businessNumber)

  if (!email || !password || password.length < 6) {
    return { success: false, error: '이메일과 비밀번호(6자리 이상)를 확인해주세요.' }
  }
  if (!storeName || !representativeName || !contactPhone || !address) {
    return { success: false, error: '필수 항목을 모두 입력해주세요.' }
  }
  if (input.businessType === 'active' && cleanedBn.length !== 10) {
    return { success: false, error: '사업자등록번호 중복확인을 해주세요' }
  }
  if (input.businessType === 'prospective' && input.businessNumber.trim() && cleanedBn.length !== 10) {
    return { success: false, error: '올바른 사업자등록번호 형식이 아닙니다' }
  }

  const admin = await createSupabaseAdmin()

  if (cleanedBn.length === 10) {
    const { data: dup } = await admin
      .from('tenants')
      .select('id')
      .eq('business_number', cleanedBn)
      .maybeSingle()
    if (dup) {
      return { success: false, error: '이미 등록된 사업자등록번호입니다' }
    }
  }

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'restaurant',
    },
  })

  if (authErr || !authData.user) {
    if (authErr && isDuplicateEmailAuthError(authErr)) {
      return { success: false, error: DUPLICATE_EMAIL_ERROR }
    }
    return { success: false, error: authErr?.message ?? '회원가입 실패' }
  }

  const userId = authData.user.id

  await cleanupTriggerOnboardingArtifacts(admin, userId)

  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .insert({
      name: storeName,
      role: 'restaurant',
      is_approved: false,
      business_type: input.businessType,
      business_number: cleanedBn.length === 10 ? cleanedBn : null,
      representative_name: representativeName,
      contact_phone: contactPhone,
      address,
      address_detail: addressDetail || null,
      verification_status: 'unverified',
      marketing_agreed: input.marketingAgreed,
      marketing_agreed_at: input.marketingAgreed ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (tenantErr || !tenant) {
    await deleteAuthUser(admin, userId)
    return { success: false, error: '매장 등록 실패: ' + (tenantErr?.message ?? 'unknown') }
  }

  const tenantId = tenant.id

  const { error: userErr } = await admin.from('users').upsert(
    {
      id: userId,
      tenant_id: tenantId,
      role: 'restaurant',
      user_type: 'human',
    },
    { onConflict: 'id' },
  )

  if (userErr) {
    await deleteTenant(admin, tenantId)
    await deleteAuthUser(admin, userId)
    return { success: false, error: '계정 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' }
  }

  return { success: true }
}
