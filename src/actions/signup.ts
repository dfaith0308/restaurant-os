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
const ACCOUNT_EXISTS_ERROR = '이미 사용 중인 계정입니다'

export type SignupEmailCheckStatus = 'invalid' | 'duplicate' | 'available'

function cleanDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isSignupEmailFormatValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function authUserRecordMatchesEmail(user: unknown, email: string): boolean {
  if (!user || typeof user !== 'object') return false
  const recordEmail =
    'email' in user ? (user as { email?: string }).email : undefined
  return (
    typeof recordEmail === 'string' &&
    normalizeEmail(recordEmail) === normalizeEmail(email)
  )
}

function authUserRecordId(user: unknown): string | null {
  if (!user || typeof user !== 'object' || !('id' in user)) return null
  const id = (user as { id?: string }).id
  return typeof id === 'string' ? id : null
}

function authUserListContainsEmail(users: unknown[], email: string): boolean {
  return users.some(user => authUserRecordMatchesEmail(user, email))
}

function findAuthUserIdInList(users: unknown[], email: string): string | null {
  for (const user of users) {
    if (authUserRecordMatchesEmail(user, email)) {
      return authUserRecordId(user)
    }
  }
  return null
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

function isUsersDuplicateKeyError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('users_pkey') || m.includes('duplicate key value violates unique constraint')
}

async function deleteAuthUser(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.auth.admin.deleteUser(userId)
}

async function deleteTenant(admin: SupabaseClient, tenantId: string): Promise<void> {
  await admin.from('tenants').delete().eq('id', tenantId)
}

type AdminAuthApi = {
  getUserByEmail?: (
    email: string,
  ) => Promise<{
    data: { user: { id: string; email?: string } | null }
    error: { message: string; status?: number } | null
  }>
}

async function getAuthUserIdForEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const normalized = normalizeEmail(email)
  if (!normalized || !isSignupEmailFormatValid(email)) return null

  const adminAuth = admin.auth.admin as AdminAuthApi
  if (typeof adminAuth.getUserByEmail === 'function') {
    const { data, error } = await adminAuth.getUserByEmail(email)
    if (data?.user && authUserRecordMatchesEmail(data.user, email)) {
      return authUserRecordId(data.user)
    }
    if (error) {
      const msg = error.message.toLowerCase()
      if (error.status === 404 || msg.includes('not found')) return null
    }
    return null
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!baseUrl || !serviceKey) return null

  const res = await fetch(
    `${baseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      cache: 'no-store',
    },
  )

  if (res.status === 404) return null
  if (!res.ok) return null

  const body: unknown = await res.json()
  if (!body || typeof body !== 'object') return null

  if ('users' in body && Array.isArray((body as { users: unknown[] }).users)) {
    return findAuthUserIdInList((body as { users: unknown[] }).users, email)
  }

  if (authUserRecordMatchesEmail(body, email)) {
    return authUserRecordId(body)
  }

  return null
}

async function appUserExistsForId(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()
  return Boolean(data?.id)
}

async function isSignupAccountTaken(admin: SupabaseClient, email: string): Promise<boolean> {
  const authUserId = await getAuthUserIdForEmail(admin, email)
  if (!authUserId) return false
  return true
}

export async function checkSignupEmailAvailable(
  email: string,
): Promise<{ status: SignupEmailCheckStatus }> {
  const trimmed = email.trim()
  if (!isSignupEmailFormatValid(trimmed)) {
    return { status: 'invalid' }
  }
  const admin = await createSupabaseAdmin()
  if (await isSignupAccountTaken(admin, trimmed)) {
    return { status: 'duplicate' }
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

  if (await isSignupAccountTaken(admin, email)) {
    return { success: false, error: DUPLICATE_EMAIL_ERROR }
  }

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
  })

  if (authErr || !authData.user) {
    if (authErr && isDuplicateEmailAuthError(authErr)) {
      return { success: false, error: DUPLICATE_EMAIL_ERROR }
    }
    return { success: false, error: authErr?.message ?? '회원가입 실패' }
  }

  const userId = authData.user.id

  if (await appUserExistsForId(admin, userId)) {
    await deleteAuthUser(admin, userId)
    return { success: false, error: ACCOUNT_EXISTS_ERROR }
  }

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

  const { error: userErr } = await admin.from('users').insert({
    id: userId,
    tenant_id: tenantId,
    role: 'restaurant',
    user_type: 'human',
  })

  if (userErr) {
    await deleteTenant(admin, tenantId)
    if (isUsersDuplicateKeyError(userErr.message)) {
      return { success: false, error: ACCOUNT_EXISTS_ERROR }
    }
    await deleteAuthUser(admin, userId)
    return { success: false, error: '계정 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' }
  }

  return { success: true }
}
