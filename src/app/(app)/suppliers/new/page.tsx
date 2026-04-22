'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSupplier } from '@/actions/suppliers'

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? ''

export default function SupplierNewPage() {
  const router = useRouter()
  const [isPending, startTr] = useTransition()
  const [name,    setName]    = useState('')
  const [contact, setContact] = useState('')
  const [region,  setRegion]  = useState('')
  const [memo,    setMemo]    = useState('')
  const [error,   setError]   = useState<string | null>(null)

  function handleSave() {
    if (!name.trim()) { setError('거래처명을 입력해주세요'); return }
    startTr(async () => {
      const res = await createSupplier({ restaurant_id: RESTAURANT_ID, name: name.trim(), contact: contact || undefined, region: region || undefined, memo: memo || undefined })
      if (!res.success) { setError(res.error ?? '오류 발생'); return }
      router.push('/suppliers')
    })
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <button onClick={() => router.back()} style={{ border: 'none', background: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 16 }}>← 뒤로</button>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 24px' }}>거래처 등록</h1>

      {[
        { label: '거래처명 *', val: name,    set: setName,    placeholder: '예: 한마음 식자재' },
        { label: '연락처',     val: contact, set: setContact, placeholder: '예: 010-0000-0000' },
        { label: '지역',       val: region,  set: setRegion,  placeholder: '예: 인천 남동구' },
        { label: '메모',       val: memo,    set: setMemo,    placeholder: '특이사항, 결제 조건 등' },
      ].map(f => (
        <div key={f.label} style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{f.label}</label>
          <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
            style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        </div>
      ))}

      {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 13, color: '#B91C1C', marginBottom: 16 }}>{error}</div>}

      <button onClick={handleSave} disabled={isPending || !name.trim()}
        style={{ width: '100%', padding: '14px', background: (!name.trim() || isPending) ? '#d1d5db' : '#111827', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        {isPending ? '저장 중...' : '저장하기'}
      </button>
    </main>
  )
}
