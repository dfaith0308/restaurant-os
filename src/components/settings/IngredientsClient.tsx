'use client'

import { useMemo, useState, useTransition, useCallback } from 'react'
import { createIngredient, updateIngredient, deactivateIngredient } from '@/actions/ingredients'
import { formatKRW, toKoreanAmount } from '@/lib/utils'
import Link from 'next/link'
import IngredientBarcodeSection from '@/components/product/IngredientBarcodeSection'
import type { IngredientBarcodeApplyHints } from '@/components/product/IngredientBarcodeSection'

const BRAND_ORANGE = '#F97316'
const BRAND_GREEN = '#1f5d3a'

const UNITS = ['kg', 'g', 'L', 'ml', '개', '봉', '묶음', '팩', '캔'] as const

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: '0.5px solid #e8e5de',
  borderRadius: 10,
  fontSize: 14,
  background: '#f7f6f2',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  color: '#2b2b2b',
}

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

function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 500, color: '#2b2b2b', marginBottom: 6 }}>
      {children}
      {required && <span style={{ color: BRAND_ORANGE }}> *</span>}
    </div>
  )
}

function CurrencyField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  hint?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <FormLabel>{label}</FormLabel>
      <div style={{ position: 'relative' }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder={placeholder}
          inputMode="numeric"
          style={{ ...INPUT_STYLE, paddingRight: 36 }}
        />
        <span
          style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 13,
            color: '#9ca3af',
            pointerEvents: 'none',
          }}
        >
          원
        </span>
      </div>
      {hint && (
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, marginBottom: 0, lineHeight: 1.4 }}>
          {hint}
        </p>
      )}
      {value && !hint && (
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, marginBottom: 0 }}>
          {toKoreanAmount(value)}
        </p>
      )}
    </div>
  )
}

function BarcodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6v12M7 6v12M10 4v16M13 6v12M16 6v12M19 4v16M22 6v12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke={BRAND_ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function IngredientsClient({ ingredients: init, restaurantId: _restaurantId }: Props) {
  const [list, setList]         = useState(init)
  const [showForm, setShowForm] = useState(false)
  const [barcodeToolsOpen, setBarcodeToolsOpen] = useState(false)
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
    setBarcodeToolsOpen(false)
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
    setUnit(UNITS.includes(i.unit as (typeof UNITS)[number]) ? i.unit : 'kg')
    setCategory(i.category ?? '')
    setPrice(i.current_price != null ? String(i.current_price) : '')
    setTargetPrice(i.target_price != null ? String(i.target_price) : '')
    setMemo(i.memo ?? '')
    setBarcode(i.barcode ?? '')
    setBarcodeToolsOpen(false)
    setShowForm(true)
  }

  function openAddForm() {
    if (showForm) {
      resetForm()
      setShowForm(false)
    } else {
      resetForm()
      setShowForm(true)
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px', background: '#f7f6f2', minHeight: '100vh' }}>
      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { opacity: 0; animation: fadeUp 0.4s ease forwards; }
        .fade-up-delay-1 { animation-delay: 0.1s; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Link href="/settings" style={{ fontSize: 13, color: BRAND_GREEN, fontWeight: 500, textDecoration: 'none' }}>
          ← 설정
        </Link>
        <button
          type="button"
          onClick={openAddForm}
          style={{
            padding: '8px 14px',
            background: BRAND_GREEN,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + 식자재 추가
        </button>
      </div>

      <p style={{ fontSize: 11, color: BRAND_GREEN, fontWeight: 500, letterSpacing: '0.5px', margin: '0 0 6px' }}>
        식자재 관리
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 500, color: '#2b2b2b', letterSpacing: '-0.5px', margin: '0 0 20px', lineHeight: 1.3 }}>
        현재 사용하는 식자재를 등록하세요
      </h1>

      {/* 검색/필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="식자재명 검색"
          style={{ ...INPUT_STYLE, flex: 1, background: '#ffffff' }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ ...INPUT_STYLE, width: 140, background: '#ffffff' }}
        >
          <option value="">전체 카테고리</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <>
          <button
            type="button"
            className="fade-up"
            onClick={() => setBarcodeToolsOpen(true)}
            style={{
              width: '100%',
              background: '#fff8f3',
              border: '1px solid #fde8d4',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: BRAND_ORANGE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <BarcodeIcon />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#2b2b2b' }}>
                바코드로 빠르게 등록
              </span>
              <span style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                카메라 또는 바코드 번호로 식자재 정보를 가져와요
              </span>
            </span>
            <ChevronRight />
          </button>

          {barcodeToolsOpen && (
            <div className="fade-up" style={{ marginBottom: 12 }}>
              <IngredientBarcodeSection onApply={applyBarcodeHints} />
            </div>
          )}

          <div
            className="fade-up fade-up-delay-1"
            style={{
              background: '#ffffff',
              borderRadius: 18,
              border: '0.5px solid #e8e5de',
              padding: 20,
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: '#edf7f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                🥬
              </span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#2b2b2b', margin: 0 }}>
                  {editingId ? '식자재 수정' : '새 식자재 등록'}
                </p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
                  단가를 입력하면 메뉴 원가가 자동 계산돼요
                </p>
              </div>
            </div>
            <div style={{ height: 0.5, background: '#f0ede8', marginBottom: 18 }} />

            <div style={{ marginBottom: 10 }}>
              <FormLabel required>식자재명</FormLabel>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="예: 고춧가루"
                style={INPUT_STYLE}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <FormLabel>카테고리</FormLabel>
                <input
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="예: 채소, 육류"
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <FormLabel required>단위</FormLabel>
                <select
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  style={INPUT_STYLE}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  {!UNITS.includes(unit as (typeof UNITS)[number]) && unit ? (
                    <option value={unit}>{unit}</option>
                  ) : null}
                </select>
              </div>
            </div>

            <CurrencyField
              label="현재 구매가"
              value={price}
              onChange={setPrice}
              placeholder="예: 35000"
            />

            <CurrencyField
              label="목표가"
              value={targetPrice}
              onChange={setTargetPrice}
              placeholder="예: 30000"
              hint="목표가 입력 시 가격 비교 알림이 활성화돼요"
            />

            <div style={{ marginBottom: 16 }}>
              <FormLabel>메모</FormLabel>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="예: 특정 브랜드만 사용, 냉동 보관"
                style={{ ...INPUT_STYLE, resize: 'none', height: 72 }}
              />
            </div>

            {barcode.trim() ? (
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '-8px 0 14px' }}>
                바코드 {barcode} · 스캔으로 불러온 값
              </p>
            ) : null}

            <div style={{ height: 0.5, background: '#f0ede8', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleAdd}
                disabled={isPending || !name.trim() || !unit.trim()}
                style={{
                  flex: 2,
                  padding: 13,
                  background: isPending || !name.trim() || !unit.trim() ? '#9ca3af' : BRAND_GREEN,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: isPending || !name.trim() || !unit.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm() }}
                style={{
                  flex: 1,
                  padding: 13,
                  background: 'transparent',
                  border: '0.5px solid #e8e5de',
                  color: '#9ca3af',
                  borderRadius: 10,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                취소
              </button>
            </div>
          </div>
        </>
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
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#2b2b2b' }}>{i.name}</div>
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
