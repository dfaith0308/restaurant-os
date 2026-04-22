'use client'

import { useState, useTransition } from 'react'
import { markPaymentPaid, addManualPayment } from '@/actions/money'
import { formatKRW, ddayLabel } from '@/lib/utils'
import type { MoneyDashboard } from '@/actions/money'

interface Props { data: MoneyDashboard; restaurantId: string }

export default function MoneyClient({ data, restaurantId }: Props) {
  const [paid, setPaid]          = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd]    = useState(false)
  const [isPending, startTr]     = useTransition()

  // 추가 폼 상태
  const [newSupplier, setNewSupplier] = useState('')
  const [newAmount,   setNewAmount]   = useState('')
  const [newDue,      setNewDue]      = useState('')
  const [newMemo,     setNewMemo]     = useState('')

  const active = data.payments.filter(p => !paid.has(p.id))

  function handlePay(id: string) {
    startTr(async () => {
      const res = await markPaymentPaid(id)
      if (res.success) setPaid(prev => new Set([...prev, id]))
    })
  }

  function handleAdd() {
    const amt = parseInt(newAmount.replace(/,/g, ''), 10)
    if (!newSupplier || !amt || !newDue) return
    startTr(async () => {
      await addManualPayment({ restaurant_id: restaurantId, supplier_name: newSupplier, amount: amt, due_date: newDue, memo: newMemo || undefined })
      setShowAdd(false); setNewSupplier(''); setNewAmount(''); setNewDue(''); setNewMemo('')
    })
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>돈관리</h1>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>나갈 돈 중심으로 관리해요</p>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        <KpiCard label="이번 주 나갈 돈" value={formatKRW(data.due_this_week)}
          warn={data.is_tight} sub={data.is_tight ? '⚠️ 준비가 필요해요' : '괜찮아요 👍'} />
        <KpiCard label="이번 달 전체" value={formatKRW(data.due_this_month)} />
      </div>

      {/* 타이트 경고 */}
      {data.is_tight && (
        <div style={{ background: '#FFF1F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#B91C1C', fontWeight: 600 }}>
          🔴 이번 주 나갈 돈이 많아요. 미리 준비해두세요.
        </div>
      )}

      {/* 지급 목록 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>지급 예정 {active.length}건</span>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          padding: '6px 12px', background: '#111827', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer',
        }}>+ 추가</button>
      </div>

      {/* 추가 폼 */}
      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          {[
            { label: '거래처명', val: newSupplier, set: setNewSupplier, placeholder: '예: 한마음 식자재' },
            { label: '금액',    val: newAmount,   set: (v: string) => setNewAmount(v.replace(/[^0-9]/g,'')), placeholder: '예: 350000' },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{f.label}</div>
              <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
          ))}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>지급일</div>
            <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={isPending} style={{ flex: 2, padding: '10px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>저장</button>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>취소</button>
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          지급 예정이 없어요. 좋은 상황이에요 👍
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(p => {
            const day = ddayLabel(p.due_date)
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${day.urgent ? '#FCA5A5' : '#e5e7eb'}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{p.supplier_name}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 2 }}>{formatKRW(p.amount)}</div>
                  <div style={{ fontSize: 11, color: day.urgent ? '#EF4444' : '#9ca3af', marginTop: 2 }}>
                    {day.text} · {p.due_date}
                  </div>
                  {p.memo && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{p.memo}</div>}
                </div>
                <button onClick={() => handlePay(p.id)} disabled={isPending}
                  style={{ padding: '8px 14px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  지급 완료
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 자금 흐름 요약 */}
      <div style={{ marginTop: 24, background: '#F9FAFB', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>자금 흐름 요약</div>
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
          <div>미지급 총액 <strong style={{ color: '#111827', float: 'right' }}>{formatKRW(data.total_unpaid)}</strong></div>
          <div>이번 주 <strong style={{ color: data.is_tight ? '#B91C1C' : '#111827', float: 'right' }}>{formatKRW(data.due_this_week)}</strong></div>
          <div>이번 달 <strong style={{ color: '#111827', float: 'right' }}>{formatKRW(data.due_this_month)}</strong></div>
        </div>
      </div>
    </main>
  )
}

function KpiCard({ label, value, warn, sub }: { label: string; value: string; warn?: boolean; sub?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${warn ? '#FCA5A5' : '#e5e7eb'}`, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: warn ? '#B91C1C' : '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: warn ? '#EF4444' : '#15803D', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
