'use client'

import { useMemo, useState, useTransition, useCallback } from 'react'
import { createIngredient, updateIngredient, deactivateIngredient } from '@/actions/ingredients'
import { formatKRW, toKoreanAmount } from '@/lib/utils'
import Link from 'next/link'
import IngredientBarcodeSection from '@/components/product/IngredientBarcodeSection'
import type { IngredientBarcodeApplyHints } from '@/components/product/IngredientBarcodeSection'

const UNITS = ['kg', 'g', '개', '봉', 'L', '박스', '팩']

interface Ingredient {
  id: string
  name: string
  unit: string
  current_price: number | null
  target_price: number | null
  category: string | null
  memo: string | null
  barcode: string | null
}
interface Props { ingredients: Ingredient[]; restaurantId: string }

export default function IngredientsClient({ ingredients: init, restaurantId }: Props) {
  const [list, setList]         = useState(init)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTr]    = useTransition()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [memo, setMemo] = useState('')
  const [barcode, setBarcode] = useState('')

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const i of list) {
      const c = (i.category ?? '').trim()
      if (c) set.add(c)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [list])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((i) => {
      if (categoryFilter && (i.category ?? '') !== categoryFilter) return false
      if (!q) return true
      return i.name.toLowerCase().includes(q)
    })
  }, [list, query, categoryFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, Ingredient[]>()
    for (const i of filtered) {
      const key = (i.category ?? '').trim() || '미분류'
      const arr = map.get(key) ?? []
      arr.push(i)
      map.set(key, arr)
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === '미분류') return 1
      if (b === '미분류') return -1
      return a.localeCompare(b)
    })
    return keys.map((k) => ({ category: k, items: map.get(k)! }))
  }, [filtered])

  function resetForm() {
    setEditingId(null)
    setName('')
    setUnit('kg')
    setCategory('')
    setPrice('')
    setTargetPrice('')
    setMemo('')
    setBarcode('')
  }

  const applyBarcodeHints = useCallback((h: IngredientBarcodeApplyHints) => {
    if (h.name != null) setName(h.name)
    if (h.unit != null) setUnit(h.unit)
    if (h.category != null) setCategory(h.category)
    if (h.memo != null) setMemo(h.memo)
    if (h.barcode != null) setBarcode(h.barcode)
    if (h.current_price != null) setPrice(h.current_price)
  }, [])

  function handleAdd() {
    if (!name.trim()) return
    const priceNum = parseInt(price.replace(/,/g, ''), 10)
    const targetNum = parseInt(targetPrice.replace(/,/g, ''), 10)
    const current_price = isNaN(priceNum) ? null : priceNum
    const target_price = isNaN(targetNum) ? null : targetNum
    startTr(async () => {
      const res = editingId
        ? await updateIngredient(editingId, {
            name: name.trim(),
            unit,
            category: category.trim() || null,
            current_price,
            target_price,
            memo: memo.trim() || null,
            barcode: barcode.replace(/\D/g, '').trim() || null,
          })
        : await createIngredient({
            name: name.trim(),
            unit,
            category: category.trim() || null,
            current_price,
            target_price,
            memo: memo.trim() || null,
            barcode: barcode.replace(/\D/g, '').trim() || null,
          })
      if (res.success) {
        if (editingId) {
          setList((prev) =>
            prev.map((i) =>
              i.id === editingId
                ? {
                    ...i,
                    name: name.trim(),
                    unit,
                    category: category.trim() || null,
                    current_price,
                    target_price,
                    memo: memo.trim() || null,
                    barcode: barcode.replace(/\D/g, '').trim() || null,
                  }
                : i,
            ),
          )
        } else {
          // id는 refresh 전 임시값 (UX용)
          setList((prev) => [
            ...prev,
            {
              id: `tmp_${Date.now()}`,
              name: name.trim(),
              unit,
              category: category.trim() || null,
              current_price,
              target_price,
              memo: memo.trim() || null,
              barcode: barcode.replace(/\D/g, '').trim() || null,
            },
          ])
        }
        resetForm()
        setShowForm(false)
      }
    })
  }

  function handleDelete(id: string) {
    startTr(async () => {
      await deactivateIngredient(id)
      setList(prev => prev.filter(i => i.id !== id))
    })
  }

  function openEdit(i: Ingredient) {
    setEditingId(i.id)
    setName(i.name)
    setUnit(i.unit)
    setCategory(i.category ?? '')
    setPrice(i.current_price != null ? String(i.current_price) : '')
    setTargetPrice(i.target_price != null ? String(i.target_price) : '')
    setMemo(i.memo ?? '')
    setBarcode(i.barcode ?? '')
    setShowForm(true)
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <Link href="/settings" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>← 설정</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 20px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>식자재 관리</h1>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + 식자재 추가
        </button>
      </div>

      {/* 검색/필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="식자재명 검색"
          style={{ flex: 1, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ width: 140, padding: '9px 10px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }}
        >
          <option value="">전체 카테고리</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <div style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <IngredientBarcodeSection onApply={applyBarcodeHints} />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>식자재명 *</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 고춧가루"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>카테고리 (선택)</div>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="예: 채소, 육류, 소스..."
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>바코드 (선택)</div>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
              placeholder="숫자만"
              inputMode="numeric"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>현재 구매가 (선택)</div>
              <input value={price} onChange={e => setPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="예: 35000" inputMode="numeric"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
              {price && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  {toKoreanAmount(price)}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>단위 *</div>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>목표가 (선택)</div>
            <input value={targetPrice} onChange={e => setTargetPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="예: 30000" inputMode="numeric"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              목표가 입력 시 가격 비교 알림 활성화
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>메모 (선택)</div>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 특정 브랜드만 사용"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none', height: 64 }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={isPending || !name.trim() || !unit.trim()}
              style={{ flex: 2, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>저장</button>
            <button onClick={() => { setShowForm(false); resetForm() }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grouped.map((g) => (
            <div key={g.category}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#374151', margin: '12px 0 8px' }}>
                {g.category} · {g.items.length}개
              </div>

              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.7fr .7fr .8fr .8fr .7fr .8fr', gap: 0, background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['식자재명', '단위', '현재가', '목표가', '차이', ''].map((h) => (
                    <div key={h} style={{ padding: '10px 10px', fontSize: 11, fontWeight: 800, color: '#6b7280' }}>
                      {h}
                    </div>
                  ))}
                </div>
                {g.items.map((i) => {
                  const cur = i.current_price
                  const tgt = i.target_price
                  const diff = cur != null && tgt != null ? cur - tgt : null
                  const diffTone = diff != null ? (diff > 0 ? 'expensive' : 'ok') : 'na'
                  const diffColor = diffTone === 'expensive' ? '#DC2626' : diffTone === 'ok' ? '#16A34A' : '#9ca3af'
                  return (
                    <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '1.7fr .7fr .8fr .8fr .7fr .8fr', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ padding: '10px 10px' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)' }}>{i.name}</div>
                        {i.barcode ? (
                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>바코드 {i.barcode}</div>
                        ) : null}
                        {i.memo ? <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.memo}</div> : null}
                      </div>
                      <div style={{ padding: '10px 10px', fontSize: 12, color: '#6b7280' }}>{i.unit}</div>
                      <div style={{ padding: '10px 10px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{cur != null ? formatKRW(cur) : '-'}</div>
                      <div style={{ padding: '10px 10px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{tgt != null ? formatKRW(tgt) : '-'}</div>
                      <div style={{ padding: '10px 10px', fontSize: 12, fontWeight: 900, color: diffColor, fontVariantNumeric: 'tabular-nums' }}>
                        {diff != null ? formatKRW(diff) : '-'}
                      </div>
                      <div style={{ padding: '10px 10px', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <button onClick={() => openEdit(i)}
                          style={{ padding: '6px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, fontSize: 11, color: '#1D4ED8', cursor: 'pointer', fontWeight: 800 }}>
                          수정
                        </button>
                        <button onClick={() => handleDelete(i.id)}
                          style={{ padding: '6px 10px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 11, color: '#B91C1C', cursor: 'pointer', fontWeight: 800 }}>
                          비활성화
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
