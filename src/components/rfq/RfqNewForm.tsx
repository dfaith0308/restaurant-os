'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createRfqRequest } from '@/actions/rfq'
import { formatKRW, priceDiffPct } from '@/lib/utils'

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? ''

const UNITS = ['kg', 'g', '개', '봉', 'L', 'ml', '박스', '팩']

interface Props {
  prefillName?:  string
  prefillPrice?: number
}

export default function RfqNewForm({ prefillName, prefillPrice }: Props) {
  const router = useRouter()
  const [isPending, startTr] = useTransition()

  const [name,    setName]    = useState(prefillName  ?? '')
  const [qty,     setQty]     = useState('')
  const [unit,    setUnit]    = useState('kg')
  const [curPx,   setCurPx]   = useState(prefillPrice ? String(prefillPrice) : '')
  const [note,    setNote]    = useState('')
  const [deadline, setDeadline] = useState('')
  const [error,   setError]   = useState<string | null>(null)

  // 즉각 피드백 — 입력 즉시 절약 예상
  const curNum   = parseInt(curPx.replace(/,/g, ''), 10) || 0
  const qtyNum   = parseInt(qty, 10) || 0
  // MVP: 시장 평균 없으므로 10% 절약 가정으로 표시
  const estSave  = curNum > 0 ? Math.floor(curNum * 0.10) : 0
  const estTotal = estSave * qtyNum

  function handlePriceInput(v: string) {
    const num = v.replace(/[^0-9]/g, '')
    setCurPx(num ? Number(num).toLocaleString() : '')
  }

  function handleSubmit() {
    if (!name.trim()) { setError('품목명을 입력해주세요'); return }
    if (!qtyNum)       { setError('수량을 입력해주세요');   return }
    setError(null)

    startTr(async () => {
      const res = await createRfqRequest({
        restaurant_id:  RESTAURANT_ID,
        product_name:   name.trim(),
        quantity:       qtyNum,
        unit,
        current_price:  curNum || null,
        request_note:   note || undefined,
        deadline:       deadline || undefined,
      })

      if (!res.success) { setError(res.error ?? '오류 발생'); return }
      router.push('/today')
    })
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.back()}
          style={{ border: 'none', background: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, padding: 0, marginBottom: 12 }}>
          ← 뒤로
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
          더 좋은 조건 받아보기
        </h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '6px 0 0 0' }}>
          품목과 수량만 입력하면 바로 비교해드려요
        </p>
      </div>

      {/* 즉각 피드백 배너 — 데이터 입력 시 표시 */}
      {curNum > 0 && qtyNum > 0 && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #BBF7D0',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 12, color: '#15803D', fontWeight: 600 }}>예상 절약 (10% 기준)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#15803D' }}>
              {formatKRW(estTotal)}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#15803D', textAlign: 'right' }}>
            단가 {formatKRW(estSave)} ×<br />{qtyNum}{unit}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 품목명 */}
        <Field label="어떤 품목인가요? *">
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="예: 고춧가루, 돼지고기 앞다리"
            style={inputStyle}
          />
        </Field>

        {/* 수량 + 단위 */}
        <Field label="얼마나 필요하세요? *">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={qty} onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="수량"
              inputMode="numeric"
              style={{ ...inputStyle, flex: 2 }}
            />
            <select value={unit} onChange={e => setUnit(e.target.value)}
              style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </Field>

        {/* 현재 구매가 */}
        <Field label="지금 얼마에 사고 계세요?" hint="입력하면 절약 금액을 바로 보여드려요">
          <div style={{ position: 'relative' }}>
            <input
              value={curPx} onChange={e => handlePriceInput(e.target.value)}
              placeholder="예: 12,000"
              inputMode="numeric"
              style={{ ...inputStyle, paddingRight: 32 }}
            />
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, color: '#9ca3af',
            }}>원</span>
          </div>
        </Field>

        {/* 요청 메모 */}
        <Field label="전달할 말이 있으세요?" hint="선택사항">
          <textarea
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="예: 납품일 25일 오전 10시 이전, 품질 유지 중요"
            rows={3}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
          />
        </Field>

        {/* 마감일 */}
        <Field label="언제까지 받고 싶으세요?" hint="선택사항">
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      {error && (
        <div style={{
          marginTop: 16, padding: '10px 14px', background: '#FEF2F2',
          border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 13, color: '#B91C1C',
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isPending || !name || !qty}
        style={{
          display: 'block', width: '100%', marginTop: 24,
          padding: '15px', background: (!name || !qty) ? '#d1d5db' : '#111827',
          color: '#fff', border: 'none', borderRadius: 14,
          fontSize: 16, fontWeight: 700, cursor: (!name || !qty) ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? '요청 중...' : '견적 받아보기 →'}
      </button>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
        요청 후 입찰 결과를 알림으로 알려드려요
      </p>
    </div>
  )
}

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
        {label}
        {hint && <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  border: '1.5px solid #e5e7eb', borderRadius: 10,
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
  background: '#fff', color: '#111827',
}
