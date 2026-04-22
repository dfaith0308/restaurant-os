'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase-browser'

const UNITS = ['kg', 'g', '개', '봉', 'L', '박스']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [restaurantName, setRestaurantName] = useState('')
  const [region, setRegion] = useState('')
  const [ingredientName, setIngredientName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [currentPrice, setCurrentPrice] = useState('')
  const [isPending, startTr] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // 예상 절약 (10% 가정)
  const priceNum = parseInt(currentPrice.replace(/,/g, ''), 10) || 0
  const estSave  = priceNum > 0 ? Math.floor(priceNum * 0.1) : 0

  function fmtPrice(v: string) {
    const n = v.replace(/[^0-9]/g, '')
    setCurrentPrice(n ? Number(n).toLocaleString() : '')
  }

  function handleStep1() {
    if (!restaurantName.trim()) { setError('매장 이름을 입력해주세요'); return }
    setError(null); setStep(2)
  }

  function handleStep2() {
    if (!ingredientName.trim()) { setError('품목명을 입력해주세요'); return }
    setError(null); setStep(3)
  }

  async function handleFinish() {
    startTr(async () => {
      const supabase = createBrowserSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // 1. 식당 생성
      const { data: restaurant, error: rErr } = await supabase
        .from('restaurants')
        .insert({ name: restaurantName.trim(), region: region.trim() || null, owner_id: user.id, is_approved: false })
        .select('id').single()

      if (rErr || !restaurant) { setError('매장 등록 실패: ' + rErr?.message); return }

      // 2. 식자재 등록
      if (ingredientName.trim()) {
        await supabase.from('ingredients').insert({
          restaurant_id: restaurant.id,
          name: ingredientName.trim(),
          unit,
          current_price: priceNum || null,
        })
      }

      router.push('/today')
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* 진행 표시 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              flex: 1, height: 4, borderRadius: 4,
              background: n <= step ? '#111827' : '#e5e7eb',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* STEP 1: 매장 정보 */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>1 / 3</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
              반갑습니다 👋
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 28px', lineHeight: 1.6 }}>
              매장 이름만 알려주시면<br />바로 시작할 수 있어요
            </p>

            <Field label="매장 이름">
              <input value={restaurantName} onChange={e => setRestaurantName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStep1()}
                placeholder="예: 한강 삼겹살" style={inputStyle} />
            </Field>

            <Field label="지역 (선택)">
              <input value={region} onChange={e => setRegion(e.target.value)}
                placeholder="예: 인천 부평구" style={inputStyle} />
            </Field>

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <Btn onClick={handleStep1}>다음 →</Btn>
          </div>
        )}

        {/* STEP 2: 식자재 1개 */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>2 / 3</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
              자주 사는 식자재<br />하나만 알려주세요
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 28px', lineHeight: 1.6 }}>
              지금 사고 있는 가격으로<br />절약 기회를 바로 찾아드려요
            </p>

            <Field label="품목명">
              <input value={ingredientName} onChange={e => setIngredientName(e.target.value)}
                placeholder="예: 고춧가루, 돼지고기 앞다리" style={inputStyle} />
            </Field>

            <Field label="단위">
              <select value={unit} onChange={e => setUnit(e.target.value)} style={inputStyle}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </Field>

            <Field label="지금 얼마에 사고 계세요?" hint="몰라도 괜찮아요">
              <input value={currentPrice} onChange={e => fmtPrice(e.target.value)}
                inputMode="numeric" placeholder="예: 12,000" style={inputStyle} />
            </Field>

            {/* 즉각 피드백 */}
            {estSave > 0 && (
              <div style={{
                background: '#F0FDF4', border: '1px solid #BBF7D0',
                borderRadius: 12, padding: '12px 16px', marginBottom: 20,
                fontSize: 13, color: '#15803D', fontWeight: 600,
              }}>
                💡 평균적으로 {currentPrice}원짜리는<br />
                약 {estSave.toLocaleString()}원 절약이 가능해요
              </div>
            )}

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <Btn onClick={handleStep2}>다음 →</Btn>
            <SkipBtn onClick={() => setStep(3)}>나중에 입력할게요</SkipBtn>
          </div>
        )}

        {/* STEP 3: 완료 */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>
              준비 완료예요!
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, margin: '0 0 32px' }}>
              {ingredientName ? (
                <><strong>{ingredientName}</strong> 기준으로<br />절약 기회를 바로 찾아드릴게요</>
              ) : (
                <>지금부터 같이 장사해봐요 👍</>
              )}
            </p>

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <Btn onClick={handleFinish} disabled={isPending}>
              {isPending ? '설정 중...' : '시작하기 →'}
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6, fontSize: 11 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 13, color: '#B91C1C', marginBottom: 16 }}>
      {children}
    </div>
  )
}

function Btn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'block', width: '100%', padding: '14px',
      background: disabled ? '#d1d5db' : '#111827', color: '#fff',
      border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      marginBottom: 10,
    }}>{children}</button>
  )
}

function SkipBtn({ onClick, children }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', padding: '10px',
      background: 'none', border: 'none',
      fontSize: 13, color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit',
    }}>{children ?? '건너뛰기'}</button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  border: '1.5px solid #e5e7eb', borderRadius: 10,
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
  background: '#fff', fontFamily: 'inherit',
}
