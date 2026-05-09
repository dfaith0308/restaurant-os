'use client'

import { useState, useTransition } from 'react'
import { markPaymentPaid, addManualPayment } from '@/actions/money'
import { formatKRW, ddayLabel } from '@/lib/utils'
import type { MoneyDashboard } from '@/actions/money'

interface Props {
  data: MoneyDashboard
  restaurantId: string
  view?: 'upcoming' | 'suppliers' | 'cashflow'
}

type MoneyFilter = '3days' | 'week' | 'month'

export default function MoneyClient({ data, restaurantId, view = 'upcoming' }: Props) {
  const [paid, setPaid]          = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd]    = useState(false)
  const [isPending, startTr]     = useTransition()
  const [filter, setFilter]      = useState<MoneyFilter>('week')
  const [selectedCounterparty, setSelectedCounterparty] = useState<string | null>(null)

  // 추가 폼 상태
  const [newSupplier, setNewSupplier] = useState('')
  const [newAmount,   setNewAmount]   = useState('')
  const [newDue,      setNewDue]      = useState('')
  const [newMemo,     setNewMemo]     = useState('')

  const active = data.payments.filter(p => !paid.has(p.id))
  const today = new Date()
  const cutoff3Days = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10)
  const cutoffWeek = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const cutoffMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

  const cutoff = filter === '3days'
    ? cutoff3Days
    : filter === 'week'
      ? cutoffWeek
      : cutoffMonth

  const visible = active.filter(p => p.due_date <= cutoff)
  const balances = data.supplier_balances ?? []
  const drilldownPayments = selectedCounterparty
    ? active.filter(p => p.counterparty_name === selectedCounterparty)
    : []

  function handlePay(id: string) {
    startTr(async () => {
      const res = await markPaymentPaid(id, restaurantId)
      if (res.success) setPaid(prev => new Set([...prev, id]))
    })
  }

  function handleAdd() {
    const amt = parseInt(newAmount.replace(/,/g, ''), 10)
    if (!newSupplier || !amt || !newDue) return
    startTr(async () => {
      await addManualPayment({ tenant_id: restaurantId, supplier_name: newSupplier, amount: amt, due_date: newDue, memo: newMemo || undefined })
      setShowAdd(false); setNewSupplier(''); setNewAmount(''); setNewDue(''); setNewMemo('')
    })
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px' }}>돈관리</h1>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>나갈 돈 중심으로 관리해요</p>

      <MoneySubNav active={view} />

      {/* KPI */}
      {view === 'cashflow' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <KpiCard label="이번 주" value={formatKRW(data.due_this_week)}
            warn={data.is_tight} sub={`이번 주 약 ${formatKRW(data.due_this_week)} 나갈 예정이에요`} />
          <KpiCard
            label="이번 달"
            value={formatKRW(data.due_this_month)}
            sub={`이번 달 약 ${formatKRW(data.due_this_month)} 나갈 예정이에요`}
          />
        </div>
      )}

      {/* 타이트 경고 */}
      {view === 'cashflow' && data.is_tight && (
        <div style={{ background: '#FFF1F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#B91C1C', fontWeight: 600 }}>
          🔴 이번 주 나갈 돈이 많아요. 미리 준비해두세요.
        </div>
      )}

      {/* 지급 목록 */}
      {view === 'upcoming' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>지급 예정 {visible.length}건</span>
          <button onClick={() => setShowAdd(!showAdd)} style={{
            padding: '6px 12px', background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer',
          }}>+ 추가</button>
        </div>
      )}

      {/* 필터 */}
      {view === 'upcoming' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <FilterChip active={filter === '3days'} onClick={() => setFilter('3days')}>3일</FilterChip>
          <FilterChip active={filter === 'week'} onClick={() => setFilter('week')}>이번주</FilterChip>
          <FilterChip active={filter === 'month'} onClick={() => setFilter('month')}>이번달</FilterChip>
        </div>
      )}

      {/* 추가 폼 */}
      {view === 'upcoming' && showAdd && (
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
            <button onClick={handleAdd} disabled={isPending} style={{ flex: 2, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>저장</button>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>취소</button>
          </div>
        </div>
      )}

      {view === 'upcoming' && (visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          지급 예정이 없어요. 좋은 상황이에요 👍
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(p => {
            const day = ddayLabel(p.due_date)
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${day.urgent ? '#FCA5A5' : '#e5e7eb'}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{p.counterparty_name}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginTop: 2 }}>{formatKRW(p.amount)}</div>
                  <div style={{ fontSize: 11, color: day.urgent ? '#EF4444' : '#9ca3af', marginTop: 2 }}>
                    {day.text} · {p.due_date}
                  </div>
                  {p.memo && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{p.memo}</div>}
                </div>
                <button onClick={() => handlePay(p.id)} disabled={isPending}
                  style={{ padding: '8px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  지급 완료
                </button>
              </div>
            )
          })}
        </div>
      ))}

      {/* 거래처 미지급금 */}
      {view === 'suppliers' && (
      <div style={{ marginTop: 8, background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)', marginBottom: 10 }}>
          거래처 미지급금
        </div>

        {balances.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9ca3af' }}>
            미지급 거래처가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {balances.map((b) => (
              <div key={b.counterparty_name}>
                <button
                  type="button"
                  onClick={() => setSelectedCounterparty(prev => (prev === b.counterparty_name ? null : b.counterparty_name))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid #f3f4f6',
                    background: '#FAFAFA',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.counterparty_name}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280' }}>
                        {selectedCounterparty === b.counterparty_name ? '닫기' : '보기'}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      가장 오래된 미지급일 · {b.oldest_due_date}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatKRW(b.total_unpaid)}
                  </div>
                </button>

                {selectedCounterparty === b.counterparty_name && (
                  <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>
                      지급 예정 내역 {drilldownPayments.length}건
                    </div>
                    {drilldownPayments.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>
                        지급 예정 내역이 없습니다.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {drilldownPayments.map((p) => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                                {p.due_date}
                              </div>
                              {p.memo && (
                                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.memo}
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {formatKRW(p.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* 자금 흐름 요약 */}
      {view === 'cashflow' && (
        <div style={{ marginTop: 8, background: '#F9FAFB', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>자금 흐름 요약</div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
            <div>미지급 총액 <strong style={{ color: 'var(--color-text)', float: 'right' }}>{formatKRW(data.total_unpaid)}</strong></div>
            <div>이번 주 <strong style={{ color: data.is_tight ? '#B91C1C' : 'var(--color-text)', float: 'right' }}>{formatKRW(data.due_this_week)}</strong></div>
            <div>이번 달 <strong style={{ color: 'var(--color-text)', float: 'right' }}>{formatKRW(data.due_this_month)}</strong></div>
          </div>
        </div>
      )}
    </main>
  )
}

function MoneySubNav({ active }: { active: 'upcoming' | 'suppliers' | 'cashflow' }) {
  const item = (href: string, label: string, key: typeof active) => {
    const isActive = active === key
    return (
      <a
        href={href}
        style={{
          flex: 1,
          textAlign: 'center',
          padding: '10px 0',
          borderRadius: 12,
          textDecoration: 'none',
          border: `1px solid ${isActive ? 'var(--color-primary)' : '#e5e7eb'}`,
          background: isActive ? 'var(--color-primary)' : '#fff',
          color: isActive ? '#fff' : '#374151',
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        {label}
      </a>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {item('/money/upcoming', '지급예정', 'upcoming')}
      {item('/money/suppliers', '거래처미지급금', 'suppliers')}
      {item('/money/cashflow', '자금흐름', 'cashflow')}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 10px',
        borderRadius: 999,
        border: `1px solid ${active ? 'var(--color-primary)' : '#e5e7eb'}`,
        background: active ? 'var(--color-primary)' : '#fff',
        color: active ? '#fff' : '#374151',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function KpiCard({ label, value, warn, sub }: { label: string; value: string; warn?: boolean; sub?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${warn ? '#FCA5A5' : '#e5e7eb'}`, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: warn ? '#B91C1C' : 'var(--color-text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: warn ? '#EF4444' : '#15803D', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
