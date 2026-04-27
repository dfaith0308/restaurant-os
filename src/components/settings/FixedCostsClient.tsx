'use client'

import { useState, useTransition } from 'react'
import { upsertFixedCost, deleteFixedCost } from '@/actions/settings'
import { formatKRW, toKoreanAmount } from '@/lib/utils'
import Link from 'next/link'

const PRESETS = ['월세', '인건비', '전기요금', '가스요금', '수도요금', '통신비', '카드단말기', '보험료']

interface Cost { id: string; name: string; amount: number; cycle: string }
interface Props { costs: Cost[]; restaurantId: string }

export default function FixedCostsClient({ costs: init, restaurantId }: Props) {
  const [list, setList]      = useState(init)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTr] = useTransition()
  const [name,   setName]   = useState('')
  const [amount, setAmount] = useState('')

  const total = list.reduce((s, c) => s + c.amount, 0)

  function handleAdd(presetName?: string) {
    const n = presetName ?? name.trim()
    const a = parseInt(amount.replace(/,/g, ''), 10)
    if (!n || !a) return
    startTr(async () => {
      const res = await upsertFixedCost({ tenant_id: restaurantId, name: n, amount: a })
      if (res.success) {
        setList(prev => [...prev, { id: Date.now().toString(), name: n, amount: a, cycle: 'monthly' }])
        setName(''); setAmount(''); setShowForm(false)
      }
    })
  }

  function handleDelete(id: string) {
    startTr(async () => {
      await deleteFixedCost(id)
      setList(prev => prev.filter(c => c.id !== id))
    })
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <Link href="/settings" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>← 설정</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 12px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>고정비</h1>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 14px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ 추가</button>
      </div>

      {total > 0 && (
        <div style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>월 고정비 합계</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{formatKRW(total)}</span>
        </div>
      )}

      {/* 프리셋 빠른 추가 */}
      {list.length === 0 && !showForm && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>자주 있는 고정비를 선택해보세요</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map(p => (
              <button key={p} onClick={() => { setName(p); setShowForm(true) }}
                style={{ padding: '6px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, fontSize: 12, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>항목명</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 월세"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>금액 (월)</div>
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="예: 1500000" inputMode="numeric"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
            {amount && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                {toKoreanAmount(amount)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleAdd()} disabled={isPending || !name || !amount}
              style={{ flex: 2, padding: '10px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>저장</button>
            <button onClick={() => setShowForm(false)}
              style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>취소</button>
          </div>
        </div>
      )}

      {list.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>
          고정비를 입력하면 손익분기점을 계산할 수 있어요
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{c.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>월 {formatKRW(c.amount)}</div>
              </div>
              <button onClick={() => handleDelete(c.id)}
                style={{ padding: '6px 10px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 11, color: '#B91C1C', cursor: 'pointer' }}>삭제</button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
