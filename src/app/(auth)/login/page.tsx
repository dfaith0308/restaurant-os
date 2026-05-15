'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signupAction } from '@/actions/signup'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import AddressSearchButton from '@/components/auth/AddressSearchButton'
import TermsModal from '@/components/auth/TermsModal'
import PrivacyModal from '@/components/auth/PrivacyModal'

type Mode = 'login' | 'signup'
type BusinessType = 'active' | 'prospective'
type BizNumberStatus = 'idle' | 'checking' | 'available' | 'duplicate' | 'invalid'

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  border: '1.5px solid #e5e7eb', borderRadius: 10,
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', background: '#fff',
}

const BTN: React.CSSProperties = {
  width: '100%', padding: '14px',
  border: 'none', borderRadius: 12,
  fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
  cursor: 'pointer',
}

const CHECK_BTN: React.CSSProperties = {
  flexShrink: 0,
  minWidth: 88,
  padding: '12px 12px',
  border: '1.5px solid #e5e7eb',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'inherit',
  background: '#fff',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const LINK_BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#4F46E5',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: 0,
  textDecoration: 'none',
}

function cleanDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function formatPhoneInput(raw: string): string {
  const d = cleanDigits(raw).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

function formatBusinessNumberInput(raw: string): string {
  const d = cleanDigits(raw).slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

function isValidBusinessNumber(value: string): boolean {
  return cleanDigits(value).length === 10
}

function bizNumberStatusMessage(status: BizNumberStatus): string | null {
  if (status === 'invalid') return '올바른 사업자등록번호 형식이 아닙니다'
  if (status === 'duplicate') return '이미 등록된 사업자등록번호입니다'
  if (status === 'available') return '사용 가능한 사업자등록번호입니다'
  return null
}

function bizNumberStatusColor(status: BizNumberStatus): string {
  if (status === 'available') return '#15803d'
  if (status === 'invalid' || status === 'duplicate') return '#B91C1C'
  return '#6b7280'
}

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [storeName, setStoreName] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType>('active')
  const [businessNumber, setBusinessNumber] = useState('')
  const [representativeName, setRepresentativeName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [agreePrivacy, setAgreePrivacy] = useState(true)
  const [marketingAgreed, setMarketingAgreed] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [bizNumberChecked, setBizNumberChecked] = useState(false)
  const [bizNumberStatus, setBizNumberStatus] = useState<BizNumberStatus>('idle')
  const [passwordConfirmTouched, setPasswordConfirmTouched] = useState(false)

  const showPasswordMismatch =
    passwordConfirmTouched &&
    passwordConfirm.length > 0 &&
    password !== passwordConfirm

  const loginReady = Boolean(email.trim() && password.length >= 6)
  const bizNumberOk =
    businessType === 'active'
      ? bizNumberChecked && isValidBusinessNumber(businessNumber)
      : !businessNumber.trim() || isValidBusinessNumber(businessNumber)
  const signupReady = Boolean(
    storeName.trim() &&
    representativeName.trim() &&
    contactPhone.trim() &&
    email.trim() &&
    address.trim() &&
    password.length >= 6 &&
    password === passwordConfirm &&
    agreeTerms &&
    agreePrivacy &&
    bizNumberOk,
  )
  const isReady = mode === 'login' ? loginReady : signupReady

  function resetBizNumberCheck() {
    setBizNumberChecked(false)
    setBizNumberStatus('idle')
  }

  function handleBusinessTypeChange(next: BusinessType) {
    setBusinessType(next)
    resetBizNumberCheck()
  }

  function handleBusinessNumberChange(raw: string) {
    setBusinessNumber(formatBusinessNumberInput(raw))
    resetBizNumberCheck()
  }

  async function handleBizNumberCheck() {
    const cleaned = cleanDigits(businessNumber)
    if (cleaned.length !== 10) {
      setBizNumberStatus('invalid')
      setBizNumberChecked(false)
      return
    }

    setBizNumberStatus('checking')
    setBizNumberChecked(false)

    const supabase = createBrowserSupabase()
    const { data: dup, error: dupErr } = await supabase
      .from('tenants')
      .select('id')
      .eq('business_number', cleaned)
      .maybeSingle()

    if (dupErr) {
      setBizNumberStatus('idle')
      setBizNumberChecked(false)
      setError('사업자등록번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.')
      return
    }

    if (dup) {
      setBizNumberStatus('duplicate')
      setBizNumberChecked(false)
      return
    }

    setBizNumberStatus('available')
    setBizNumberChecked(true)
  }

  async function handleSubmit() {
    if (!isReady || loading) return
    setLoading(true)
    setError(null)

    const supabase = createBrowserSupabase()

    if (mode === 'signup') {
      if (!agreeTerms || !agreePrivacy) {
        setError('이용약관 및 개인정보처리방침에 동의해야 가입할 수 있습니다.')
        setLoading(false)
        return
      }

      if (password !== passwordConfirm) {
        setError('비밀번호가 일치하지 않습니다')
        setLoading(false)
        return
      }

      const cleanedBn = cleanDigits(businessNumber)
      if (businessType === 'active') {
        if (!bizNumberChecked || cleanedBn.length !== 10) {
          setError('사업자등록번호 중복확인을 해주세요')
          setLoading(false)
          return
        }
      }
      if (businessType === 'prospective' && businessNumber.trim() && cleanedBn.length !== 10) {
        setError('올바른 사업자등록번호 형식이 아닙니다')
        setLoading(false)
        return
      }

      if (cleanedBn.length === 10 && (businessType === 'active' || businessNumber.trim())) {
        const { data: dup } = await supabase
          .from('tenants')
          .select('id')
          .eq('business_number', cleanedBn)
          .maybeSingle()
        if (dup) {
          setError('이미 등록된 사업자등록번호입니다')
          setBizNumberStatus('duplicate')
          setBizNumberChecked(false)
          setLoading(false)
          return
        }
      }

      const signupResult = await signupAction({
        email: email.trim(),
        password,
        storeName: storeName.trim(),
        businessType,
        businessNumber,
        representativeName: representativeName.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
        addressDetail: addressDetail.trim(),
        marketingAgreed,
      })
      if (!signupResult.success) {
        setError(signupResult.error ?? '회원가입 실패')
        setLoading(false)
        return
      }

      const { error: signInAfterSignupErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInAfterSignupErr) {
        setError(
          signInAfterSignupErr.message ??
            '가입은 완료되었으나 로그인에 실패했습니다. 로그인 화면에서 다시 시도해주세요.',
        )
        setLoading(false)
        return
      }

      setDone(true)
      setLoading(false)
      return
    }

    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (signInErr || !data.user) {
      setError(signInErr?.message ?? '로그인 실패. 이메일/비밀번호를 확인해주세요.')
      setLoading(false)
      return
    }

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id, tenants(is_approved)')
      .eq('id', data.user.id)
      .maybeSingle()

    const rawTenant = userData?.tenants
    const tenant = (Array.isArray(rawTenant) ? rawTenant[0] : rawTenant) as { is_approved: boolean } | null
    if (!userData?.tenant_id) {
      router.replace('/onboarding')
    } else if (!tenant?.is_approved) {
      router.replace('/pending')
    } else {
      router.replace('/today')
    }
  }

  if (done) {
    return (
      <Wrapper wide={false}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>
            가입 완료
          </div>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, margin: '0 0 24px' }}>
            담당자 승인 후 사용할 수 있습니다.<br />
            로그인 후 승인을 기다려주세요.
          </p>
          <button
            type="button"
            onClick={() => { setDone(false); setMode('login') }}
            style={{ ...BTN, background: 'var(--color-primary)', color: '#fff' }}
          >
            로그인하러 가기
          </button>
        </div>
      </Wrapper>
    )
  }

  return (
    <>
      <Wrapper wide={mode === 'signup'}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <BrandLogo />
          {mode === 'signup' ? (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: '12px 0 0' }}>
                사업자 계정 만들기
              </h1>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '8px 0 0', lineHeight: 1.5 }}>
                발주·공급망·정산을 하나로 관리하세요
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: '12px 0 0' }}>
                식당OS
              </h1>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: '6px 0 0' }}>
                사장님과 함께 장사하는 파트너
              </p>
            </>
          )}
        </div>

        <div
          style={{
            display: 'flex', background: '#F3F4F6', borderRadius: 10,
            padding: 4, marginBottom: 24, gap: 4,
          }}
        >
          {(['login', 'signup'] as Mode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null) }}
              style={{
                flex: 1, padding: '8px',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? 'var(--color-primary)' : '#6b7280',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <>
              <Field label="현재 상태" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <SegButton
                    active={businessType === 'active'}
                    onClick={() => handleBusinessTypeChange('active')}
                    label="식당 운영중"
                  />
                  <SegButton
                    active={businessType === 'prospective'}
                    onClick={() => handleBusinessTypeChange('prospective')}
                    label="예비 창업자"
                  />
                </div>
              </Field>

              <Field label="사업자등록번호" required={businessType === 'active'}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={businessNumber}
                    onChange={e => handleBusinessNumberChange(e.target.value)}
                    placeholder="000-00-00000"
                    style={{ ...INPUT_STYLE, flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="button"
                    onClick={handleBizNumberCheck}
                    disabled={
                      bizNumberStatus === 'checking' ||
                      (businessType === 'prospective' && !businessNumber.trim())
                    }
                    style={{
                      ...CHECK_BTN,
                      opacity:
                        bizNumberStatus === 'checking' ||
                        (businessType === 'prospective' && !businessNumber.trim())
                          ? 0.55
                          : 1,
                      cursor:
                        bizNumberStatus === 'checking' ||
                        (businessType === 'prospective' && !businessNumber.trim())
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    {bizNumberStatus === 'checking' ? '확인중...' : '중복확인'}
                  </button>
                </div>
                {businessType === 'prospective' && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6b7280' }}>
                    예비창업자는 나중에 등록 가능합니다
                  </p>
                )}
                {bizNumberStatusMessage(bizNumberStatus) && (
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontSize: 12,
                      color: bizNumberStatusColor(bizNumberStatus),
                    }}
                  >
                    {bizNumberStatusMessage(bizNumberStatus)}
                  </p>
                )}
              </Field>

              <Field label="상호명" required>
                <input
                  type="text"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  placeholder="예: 행복분식"
                  style={INPUT_STYLE}
                />
              </Field>

              <Field label="대표자명" required>
                <input
                  type="text"
                  value={representativeName}
                  onChange={e => setRepresentativeName(e.target.value)}
                  placeholder="홍길동"
                  style={INPUT_STYLE}
                />
              </Field>

              <Field label="연락처" required>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={e => setContactPhone(formatPhoneInput(e.target.value))}
                  placeholder="010-1234-5678"
                  style={INPUT_STYLE}
                />
              </Field>

              <Field label="이메일" required>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="owner@restaurant.com"
                  autoComplete="email"
                  style={INPUT_STYLE}
                />
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.45 }}>
                  입력한 이메일 주소로 로그인합니다
                </p>
              </Field>

              <Field label="주소" required>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <input
                    type="text"
                    value={address}
                    readOnly
                    placeholder="주소 검색으로 입력"
                    style={{
                      ...INPUT_STYLE,
                      flex: 1,
                      minWidth: 0,
                      background: address.trim() ? '#fff' : '#f9fafb',
                      color: address.trim() ? 'var(--color-text)' : '#9ca3af',
                    }}
                  />
                  <AddressSearchButton onSelect={setAddress} />
                </div>
              </Field>

              <Field label="상세주소">
                <input
                  type="text"
                  value={addressDetail}
                  onChange={e => setAddressDetail(e.target.value)}
                  placeholder="동·호수 (선택)"
                  style={INPUT_STYLE}
                />
              </Field>

              <Field label="비밀번호" required>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="6자리 이상"
                  autoComplete="new-password"
                  style={INPUT_STYLE}
                />
              </Field>

              <Field label="비밀번호 확인" required>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={e => {
                    if (!passwordConfirmTouched) setPasswordConfirmTouched(true)
                    setPasswordConfirm(e.target.value)
                  }}
                  onBlur={() => setPasswordConfirmTouched(true)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="비밀번호 재입력"
                  autoComplete="new-password"
                  style={INPUT_STYLE}
                />
                {showPasswordMismatch && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#B91C1C' }}>
                    비밀번호가 일치하지 않습니다
                  </p>
                )}
              </Field>

              <ConsentBlock
                required
                checked={agreeTerms}
                onChange={setAgreeTerms}
                label="이용약관에 동의합니다."
                onView={() => setShowTermsModal(true)}
              />
              <ConsentBlock
                required
                checked={agreePrivacy}
                onChange={setAgreePrivacy}
                label="개인정보처리방침에 동의합니다."
                onView={() => setShowPrivacyModal(true)}
              />
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#374151' }}>
                <input
                  type="checkbox"
                  checked={marketingAgreed}
                  onChange={e => setMarketingAgreed(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  [선택] 마케팅 수신에 동의합니다.
                  <span style={{ display: 'block', marginTop: 4, color: '#6b7280', fontSize: 12 }}>
                    시세·특가·발주 리마인드 알림 포함
                  </span>
                </span>
              </label>
            </>
          )}

          {mode === 'login' && (
            <>
              <Field label="이메일">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="owner@restaurant.com"
                  autoComplete="email"
                  style={INPUT_STYLE}
                />
              </Field>
              <Field label="비밀번호">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="6자리 이상"
                  autoComplete="current-password"
                  style={INPUT_STYLE}
                />
              </Field>
            </>
          )}
        </div>

        {error && (
          <div
            style={{
              marginTop: 12, padding: '10px 14px',
              background: '#FEF2F2', border: '1px solid #FCA5A5',
              borderRadius: 8, fontSize: 13, color: '#B91C1C',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isReady || loading}
          style={{
            ...BTN, marginTop: 20,
            background: (!isReady || loading) ? '#d1d5db' : 'var(--color-primary)',
            color: '#fff',
            cursor: (!isReady || loading) ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
        </button>

        {mode === 'login' && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 }}>
            계정이 없으신가요?{' '}
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null) }}
              style={{ ...LINK_BTN, fontSize: 12 }}
            >
              회원가입
            </button>
          </p>
        )}
      </Wrapper>

      <TermsModal open={showTermsModal} onClose={() => setShowTermsModal(false)} />
      <PrivacyModal open={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
    </>
  )
}

const LOGO_SHELL: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: 40,
  maxHeight: 40,
  margin: '0 auto',
  overflow: 'hidden',
}

const LOGO_IMG: React.CSSProperties = {
  display: 'block',
  height: 40,
  maxHeight: 40,
  width: 'auto',
  maxWidth: 'min(200px, 72vw)',
  objectFit: 'contain',
}

const LOGO_FALLBACK: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 800,
  lineHeight: '40px',
  letterSpacing: '-0.02em',
  color: 'var(--color-text)',
  whiteSpace: 'nowrap',
}

function BrandLogo() {
  const [imgErr, setImgErr] = useState(false)

  if (imgErr) {
    return (
      <div style={LOGO_SHELL} role="img" aria-label="식식이OS">
        <span style={LOGO_FALLBACK}>식식이OS</span>
      </div>
    )
  }

  return (
    <div style={LOGO_SHELL}>
      <img
        src="/logo.png"
        alt="식식이OS"
        width={160}
        height={40}
        decoding="async"
        onError={() => setImgErr(true)}
        style={LOGO_IMG}
      />
    </div>
  )
}

function SegButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 8px',
        border: active ? '1.5px solid var(--color-primary)' : '1.5px solid #e5e7eb',
        borderRadius: 10,
        background: active ? '#f0fdf4' : '#fff',
        color: active ? 'var(--color-primary)' : '#374151',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

function ConsentBlock({
  required,
  checked,
  onChange,
  label,
  onView,
}: {
  required?: boolean
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  onView: () => void
}) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#374151' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 3 }}
      />
      <span>
        <b>{required ? '[필수]' : '[선택]'}</b> {label}{' '}
        <button type="button" onClick={onView} style={LINK_BTN}>
          보기
        </button>
      </span>
    </label>
  )
}

function Wrapper({ children, wide }: { children: React.ReactNode; wide: boolean }) {
  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#F9FAFB', padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: wide ? 440 : 380,
          background: '#fff', borderRadius: 20, padding: '36px 28px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
        {label}
        {required ? <span style={{ color: '#DC2626' }}> *</span> : null}
      </label>
      {children}
    </div>
  )
}
