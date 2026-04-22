'use client'

import { useState, useTransition } from 'react'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import { formatKRW } from '@/lib/utils'

interface Restaurant {
  id: string; name: string; region: string | null
  is_approved: boolean; created_at: string
}
interface Rfq {
  id: string; restaurant_id: string; product_name: string
  status: string; created_at: string
}
interface Order {
  id: string; restaurant_id: string; product_name: string
  supplier_name: string; status: string; total_amount: number; created_at: string
}

type Tab = 'approval' | 'restaurants' | 'trades'

export default function AdminClient({ restaurants: initRest, rfqs, orders }: {
  restaurants: Restaurant[]
  rfqs:        Rfq[]
  orders:      Order[]
}) {
  const [tab, setTab]          = useState<Tab>('approval')
  const [restaurants, setRest] = useState(initRest)
  const [, startTr]            = useTransition()

  // 승인/취소 토글
  function toggleApprove(id: string, current: boolean) {
    setRest(prev => prev.map(r => r.id === id ? { ...r, is_approved: !current } : r))
    startTr(async () => {
      const supabase = createBrowserSupabase()
      const { error } = await supabase
        .from('restaurants')
        .update({ is_approved: !current })
        .eq('id', id)
      if (error) {
        setRest(prev => prev.map(r => r.id === id ? { ...r, is_approved: current } : r))
      }
    })
  }

  const pending  = restaurants.filter(r => !r.is_approved)
  const approved = restaurants.filter(r =>  r.is_approved)

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    background: active ? '#111827' : 'transparent',
    color: active ? '#fff' : '#6b7280',
  })

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px 80px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          관리자
        </h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
          매장 {restaurants.length}개 · 대기 {pending.length}개
        </p>
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        background: '#F9FAFB', borderRadius: 10, padding: 4,
      }}>
        {([
          ['approval',    `승인 관리 ${pending.length > 0 ? `(${pending.length})` : ''}`],
          ['restaurants', '매장 관리'],
          ['trades',      '거래 관리'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={TAB_STYLE(tab === key)}>
            {label}
          </button>
        ))}
      </div>

      {/* 승인 관리 */}
      {tab === 'approval' && (
        <div>
          {pending.length === 0 ? (
            <Empty text="승인 대기 중인 매장이 없습니다" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.map(r => (
                <RestaurantRow key={r.id} r={r} onToggle={() => toggleApprove(r.id, r.is_approved)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 매장 관리 */}
      {tab === 'restaurants' && (
        <div>
          <SectionLabel label={`승인 완료 (${approved.length})`} color="#059669" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {approved.map(r => (
              <RestaurantRow key={r.id} r={r} onToggle={() => toggleApprove(r.id, r.is_approved)} />
            ))}
            {approved.length === 0 && <Empty text="승인된 매장이 없습니다" />}
          </div>

          <SectionLabel label={`대기 중 (${pending.length})`} color="#B45309" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(r => (
              <RestaurantRow key={r.id} r={r} onToggle={() => toggleApprove(r.id, r.is_approved)} />
            ))}
            {pending.length === 0 && <Empty text="대기 중인 매장이 없습니다" />}
          </div>
        </div>
      )}

      {/* 거래 관리 */}
      {tab === 'trades' && (
        <div>
          <SectionLabel label={`견적 요청 (${rfqs.length})`} color="#374151" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
            {rfqs.slice(0, 20).map(r => (
              <TradeRow key={r.id}
                name={r.product_name}
                sub={`${r.status} · ${fmtDate(r.created_at)}`}
                statusColor={statusColor(r.status)}
              />
            ))}
            {rfqs.length === 0 && <Empty text="견적 요청이 없습니다" />}
          </div>

          <SectionLabel label={`주문 (${orders.length})`} color="#374151" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {orders.slice(0, 20).map(o => (
              <TradeRow key={o.id}
                name={`${o.product_name} · ${o.supplier_name}`}
                sub={`${formatKRW(o.total_amount)} · ${o.status} · ${fmtDate(o.created_at)}`}
                statusColor={statusColor(o.status)}
              />
            ))}
            {orders.length === 0 && <Empty text="주문이 없습니다" />}
          </div>
        </div>
      )}
    </main>
  )
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────

function RestaurantRow({ r, onToggle }: { r: Restaurant; onToggle: () => void }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: r.is_approved ? '1px solid #e5e7eb' : '1.5px solid #FCD34D',
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{r.name}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
            background: r.is_approved ? '#ECFDF5' : '#FFFBEB',
            color: r.is_approved ? '#059669' : '#B45309',
          }}>
            {r.is_approved ? '승인됨' : '대기'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          {r.region ?? '지역 미입력'} · {fmtDate(r.created_at)}
        </div>
      </div>
      <button
        onClick={onToggle}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        style={{
          padding: '8px 14px', border: 'none', borderRadius: 8,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap',
          transition: 'transform 0.08s ease',
          background: r.is_approved ? '#F3F4F6' : '#111827',
          color: r.is_approved ? '#374151' : '#fff',
        }}
      >
        {r.is_approved ? '승인 취소' : '승인'}
      </button>
    </div>
  )
}

function TradeRow({ name, sub, statusColor }: { name: string; sub: string; statusColor: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10,
      border: '1px solid #e5e7eb', padding: '12px 14px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 11, color: statusColor, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 12 }}>
        {sub}
      </div>
    </div>
  )
}

function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 10 }}>
      {label}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0', fontSize: 13 }}>
      {text}
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function statusColor(status: string) {
  if (status === 'completed') return '#059669'
  if (status === 'confirmed') return '#4F46E5'
  if (status === 'open')      return '#B45309'
  if (status === 'cancelled') return '#9ca3af'
  return '#374151'
}
