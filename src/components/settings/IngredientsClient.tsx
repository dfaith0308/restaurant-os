'use client'

import { useState, useTransition } from 'react'
import { upsertIngredient, deleteIngredient } from '@/actions/settings'
import { formatKRW, toKoreanAmount } from '@/lib/utils'
import Link from 'next/link'

const UNITS = ['kg', 'g', '개', '봉', 'L', '박스', '팩']

interface Ingredient { id: string; name: string; unit: string; current_price: number | null; supplier_name: string | null }
interface Props { ingredients: Ingredient[]; restaurantId: string }

export default function IngredientsClient({ ingredients: init, restaurantId }: Props) {
  const [list, setList]         = useState(init)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTr]    = useTransition()

  const [name,    setName]    = useState('')
  const [unit,    setUnit]    = useState('kg')
  const [price,   setPrice]   = useState('')
  const [supplier, setSupplier] = useState('')

  function handleAdd() {
    if (!name.trim()) return
    const priceNum = parseInt(price.replace(/,/g, ''), 10) || null
    startTr(async () => {
      const res = await upsertIngredient({ restaurant_id: restaurantId, name: name.trim(), unit, current_price: priceNum, supplier_name: supplier || null })
      if (res.success) {
        setList(prev => [...prev, { id: Date.now().toString(), name: name.trim(), unit, current_price: priceNum, supplier_name: supplier || null }])
        setName(''); setPrice(''); setSupplier(''); setShowForm(false)
      }
    })
  }

  function handleDelete(id: string) {
    startTr(async () => {
      await deleteIngredient(id)
      setList(prev => prev.filter(i => i.id !== id))
    })
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <Link href="/settings" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>← 설정</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 20px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>식자재 관리</h1>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 14px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + 추가
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          {[
            { label: '품목명 *', val: name,     set: setName,     placeholder: '예: 고춧가루' },
            { label: '거래처',   val: supplier,  set: setSupplier, placeholder: '현재 사는 곳' },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{f.label}</div>
              <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>현재 구매가</div>
              <input value={price} onChange={e => setPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" inputMode="numeric"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
              {price && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  {toKoreanAmount(price)}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>단위</div>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={isPending || !name.trim()}
              style={{ flex: 2, padding: '10px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>저장</button>
            <button onClick={() => setShowForm(false)}
              style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>취소</button>
          </div>
        </div>
      )}

      {list.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🥬</div>
          자주 사는 식자재를 입력해주세요<br />
          <span style={{ fontSize: 12 }}>입력하면 절약 기회를 더 잘 찾을 수 있어요</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(i => (
            <div key={i.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{i.name} <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12 }}>/ {i.unit}</span></div>
                {i.current_price && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{formatKRW(i.current_price)}</div>}
                {i.supplier_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>{i.supplier_name}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Link href={`/rfq/new?ingredient=${encodeURIComponent(i.name)}&price=${i.current_price ?? ''}`}
                  style={{ padding: '6px 10px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, fontSize: 11, color: '#15803D', textDecoration: 'none', fontWeight: 600 }}>
                  비교
                </Link>
                <button onClick={() => handleDelete(i.id)}
                  style={{ padding: '6px 10px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 11, color: '#B91C1C', cursor: 'pointer' }}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
