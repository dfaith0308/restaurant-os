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

function cleanDigits(value: string): string {
  return value.replace(/\D/g, '')
}

async function deleteAuthUser(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.auth.admin.deleteUser(userId)
}

async function deleteTenant(admin: SupabaseClient, tenantId: string): Promise<void> {
  await admin.from('tenants').delete().eq('id', tenantId)
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
  })

  if (authErr || !authData.user) {
    return { success: false, error: authErr?.message ?? '회원가입 실패' }
  }

  const userId = authData.user.id

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
  })

  if (userErr) {
    await deleteTenant(admin, tenantId)
    await deleteAuthUser(admin, userId)
    return { success: false, error: '계정 연결 실패: ' + userErr.message }
  }

  return { success: true }
}
