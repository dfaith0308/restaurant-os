'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { formatKRW } from '@/lib/utils'
import {
  addMenuIngredient,
  createMenu,
  deactivateMenu,
  getMenuCostEstimate,
  removeMenuIngredient,
  updateMenu,
  type MenuWithCost,
} from '@/actions/menus'

type Ingredient = {
  id: string
  name: string
  unit: string
  current_price: number | null
  category: string | null
}

function pct(n: number | null) {
  if (n == null || !Number.isFinite(n)) return '-'
  const v = Math.round(n * 10) / 10
  return `${v}%`
}

function formatGrossProfit(price: number | null | undefined, cost: number | null | undefined): string {
  if (price == null || cost == null || !Number.isFinite(price) || !Number.isFinite(cost)) return '-'
  const diff = Math.round(price - cost)
  const sign = diff >= 0 ? '+' : '-'
  return `${sign}${Math.abs(diff).toLocaleString('ko-KR')}원`
}

function marginBadge(rate: number | null): { label: string; bg: string; color: string } | null {
  if (rate == null || !Number.isFinite(rate)) return null
  if (rate >= 60) return { label: '마진 우수', bg: '#edf7f1', color: '#1f5d3a' }
  if (rate >= 40) return { label: '평균 수준', bg: '#f7f6f2', color: '#6b7280' }
  return null
}

const costEstimateRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  background: '#f7f6f2',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 12,
  color: '#6b7280',
} as const

export default function MenusClient(props: {
  menus: MenuWithCost[]
  ingredients: Ingredient[]
  error: string | null
}) {
  const [menus, setMenus] = useState<MenuWithCost[]>(props.menus)
  const [isPending, startTr] = useTransition()

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [isRep, setIsRep] = useState(false)
  const [memo, setMemo] = useState('')

  const [ingId, setIngId] = useState('')
  const [ingQty, setIngQty] = useState('1')
  const [ingUnit, setIngUnit] = useState('')

  const [estimate, setEstimate] = useState<{
    menu_name: string
    estimated_cost: number | null
    source: 'gpt' | 'internal'
    confidence_level: number | null
    updated_at: string
  } | null>(null)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const m of menus) {
      const c = (m.category ?? '').trim()
      if (c) set.add(c)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [menus])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return menus.filter((m) => {
      if (categoryFilter && (m.category ?? '') !== categoryFilter) return false
      if (!q) return true
      if (m.name.toLowerCase().includes(q)) return true
      for (const ing of m.ingredients) {
        if (ing.ingredient_name.toLowerCase().includes(q)) return true
      }
      return false
    })
  }, [menus, query, categoryFilter])

  function resetForm() {
    setEditingId(null)
    setName('')
    setPrice('')
    setCategory('')
    setIsRep(false)
    setMemo('')
    setIngId('')
    setIngQty('1')
    setIngUnit('')
    setEstimate(null)
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(m: MenuWithCost) {
    resetForm()
    setEditingId(m.id)
    setName(m.name)
    setPrice(String(m.price ?? 0))
    setCategory(m.category ?? '')
    setIsRep(!!m.is_representative)
    setMemo(m.memo ?? '')
    setShowForm(true)
  }

  const currentMenu = useMemo(() => {
    if (!editingId) return null
    return menus.find((m) => m.id === editingId) ?? null
  }, [editingId, menus])

  const liveCost = useMemo(() => {
    const menu = currentMenu
    if (!menu) return null
    return menu.calculated_cost ?? 0
  }, [currentMenu])

  const liveMargin = useMemo(() => {
    const menu = currentMenu
    if (!menu) return null
    return menu.margin_rate
  }, [currentMenu])

  function handleSaveMenu() {
    const p = parseInt((price || '0').replace(/[^0-9]/g, ''), 10)
    const priceNum = Number.isFinite(p) ? p : 0
    startTr(async () => {
      const res = editingId
        ? await updateMenu(editingId, {
            name: name.trim(),
            price: priceNum,
            category: category.trim() || null,
            is_representative: isRep,
            memo: memo.trim() || null,
          })
        : await createMenu({
            name: name.trim(),
            price: priceNum,
            category: category.trim() || null,
            is_representative: isRep,
            memo: memo.trim() || null,
          })

      if (!res.success) {
        alert(res.error ?? '저장 실패')
        return
      }

      // server 계산값 반영을 위해 refresh 대신 간단 재조회
      const next = await import('@/actions/menus').then((m) => m.getMenus())
      if (next.success) setMenus(next.data ?? [])
      setShowForm(false)
      resetForm()
    })
  }

  function handleDeactivate(menuId: string) {
    if (!confirm('비활성화할까요?')) return
    startTr(async () => {
      const res = await deactivateMenu(menuId)
      if (!res.success) alert(res.error ?? '처리 실패')
      const next = await import('@/actions/menus').then((m) => m.getMenus())
      if (next.success) setMenus(next.data ?? [])
    })
  }

  function handleAddIngredient() {
    if (!editingId) return
    const qty = Number(ingQty)
    startTr(async () => {
      const res = await addMenuIngredient({
        menu_id: editingId,
        ingredient_id: ingId,
        quantity: qty,
        unit: ingUnit.trim() || null,
      })
      if (!res.success) {
        alert(res.error ?? '추가 실패')
        return
      }
      const next = await import('@/actions/menus').then((m) => m.getMenus())
      if (next.success) setMenus(next.data ?? [])
      setIngId('')
      setIngQty('1')
      setIngUnit('')
      setEstimate(null)
    })
  }

  function handleRemoveIngredient(menuIngredientId: string) {
    if (!confirm('이 재료를 구성에서 제외할까요?')) return
    startTr(async () => {
      const res = await removeMenuIngredient(menuIngredientId)
      if (!res.success) alert(res.error ?? '처리 실패')
      const next = await import('@/actions/menus').then((m) => m.getMenus())
      if (next.success) setMenus(next.data ?? [])
    })
  }

  function handleFetchEstimate() {
    const n = name.trim()
    if (!n) return
    startTr(async () => {
      const res = await getMenuCostEstimate(n)
      if (!res.success) {
        alert(res.error ?? '조회 실패')
        return
      }
      if (res.data) {
        setEstimate({
          menu_name: res.data.menu_name,
          estimated_cost: res.data.estimated_cost,
          source: res.data.source,
          confidence_level: res.data.confidence_level,
          updated_at: res.data.updated_at,
        })
      } else {
        setEstimate(null)
      }
    })
  }

  const selectedIngredient = useMemo(() => {
    return props.ingredients.find((i) => i.id === ingId) ?? null
  }, [ingId, props.ingredients])

  return (
    <>
      <style jsx>{`
        @keyframes menusFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes menusPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.3); }
          50% { box-shadow: 0 0 0 8px rgba(249, 115, 22, 0); }
        }
        .menus-fade-up { opacity: 0; animation: menusFadeUp 0.5s ease forwards; }
        .menus-anim-title { animation-delay: 0s; }
        .menus-anim-hero { animation-delay: 0.1s; }
        .menus-anim-divider { animation: menusFadeUp 0.4s ease forwards; animation-delay: 0.45s; opacity: 0; }
        .menus-anim-card1 { animation-delay: 0.55s; }
        .menus-anim-card2 { animation-delay: 0.68s; }
        .menus-anim-card3 { animation-delay: 0.78s; }
        .menus-anim-cta { animation: menusPulse 2.5s ease-in-out infinite; animation-delay: 1.2s; }
        .menus-card-hover { transition: transform 200ms ease; }
        .menus-card-hover:hover { transform: translateY(-2px); }
      `}</style>
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 80px', background: '#f7f6f2', minHeight: '100vh', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Link href="/settings" style={{ fontSize: 13, color: '#1f5d3a', fontWeight: 500, textDecoration: 'none' }}>← 설정</Link>

          <button
            type="button"
            onClick={openCreate}
            style={{ padding: '8px 14px', background: '#1f5d3a', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + 메뉴 추가
          </button>
        </div>

        <div className="menus-fade-up menus-anim-title" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#1f5d3a', fontWeight: 500, letterSpacing: '0.5px', marginBottom: 8 }}>메뉴 · 원가</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#2b2b2b', letterSpacing: '-1px', lineHeight: 1.15, margin: 0 }}>
            내 메뉴, 얼마나 남고 있나요?
          </h1>
        </div>

      {props.error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 12 }}>
          {props.error}
        </div>
      )}

      {menus.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="메뉴/식자재 검색"
            style={{ flex: 1, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: 160, padding: '9px 10px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }}
          >
            <option value="">전체 카테고리</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      {showForm && (
        <div style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--color-text)' }}>
              {editingId ? '메뉴 수정' : '메뉴 등록'}
            </div>
            {editingId && (
              <button
                onClick={() => handleDeactivate(editingId)}
                disabled={isPending}
                style={{ background: 'transparent', border: 'none', color: '#b91c1c', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                비활성화
              </button>
            )}
          </div>

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>메뉴명 *</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 김치볶음밥"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>판매가 *</div>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                placeholder="예: 9000"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>카테고리 (선택)</div>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="예: 식사, 사이드"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <input type="checkbox" checked={isRep} onChange={(e) => setIsRep(e.target.checked)} />
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text)' }}>
                대표메뉴 (최대 3개)
              </span>
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>메모 (선택)</div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 점심특선"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none', height: 64 }}
            />
          </div>

          {editingId && (
            <div style={{ marginTop: 14, borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--color-text)', marginBottom: 8 }}>식재료 구성 (1인분 기준)</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px', gap: 8, alignItems: 'end' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>식자재</div>
                  <select
                    value={ingId}
                    onChange={(e) => {
                      const id = e.target.value
                      setIngId(id)
                      const ing = props.ingredients.find((x) => x.id === id)
                      setIngUnit(ing?.unit ?? '')
                    }}
                    style={{ width: '100%', padding: '9px 10px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }}
                  >
                    <option value="">선택…</option>
                    {props.ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} {i.current_price != null ? `(${formatKRW(i.current_price)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>수량</div>
                  <input
                    value={ingQty}
                    onChange={(e) => setIngQty(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    placeholder="예: 0.2"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>단위</div>
                  <input
                    value={ingUnit}
                    onChange={(e) => setIngUnit(e.target.value)}
                    placeholder={selectedIngredient?.unit ?? '예: kg'}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
                <button
                  onClick={handleAddIngredient}
                  disabled={isPending || !ingId || !(Number(ingQty) > 0)}
                  style={{ padding: '10px 10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  추가
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
                원가 계산: \u03A3(현재가 × 수량). 계산값은 저장하지 않습니다.
              </div>

              <div style={{ marginTop: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 70px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['식자재', '수량', '현재가', ''].map((h) => (
                    <div key={h} style={{ padding: '10px 10px', fontSize: 11, fontWeight: 900, color: '#6b7280' }}>{h}</div>
                  ))}
                </div>
                {(currentMenu?.ingredients ?? []).length === 0 ? (
                  <div style={{ padding: 12, fontSize: 13, color: '#9ca3af' }}>
                    식재료를 입력하면 원가가 계산됩니다.
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={handleFetchEstimate}
                        disabled={isPending || !name.trim()}
                        style={{ padding: '8px 10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                      >
                        AI 추정 원가 조회
                      </button>
                    </div>
                    {estimate?.estimated_cost != null && (
                      <div style={{ marginTop: 10, color: 'var(--color-text)', fontWeight: 800 }}>
                        예상 원가 약 {formatKRW(estimate.estimated_cost)} (±15% 오차)
                      </div>
                    )}
                    {estimate && estimate.estimated_cost == null && (
                      <div style={{ marginTop: 10 }}>
                        추정 데이터가 없습니다. 식재료를 입력하면 원가가 계산됩니다.
                      </div>
                    )}
                  </div>
                ) : (
                  currentMenu!.ingredients.map((r) => (
                    <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 70px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ padding: '10px 10px', fontSize: 13, fontWeight: 800, color: 'var(--color-text)' }}>
                        {r.ingredient_name}
                        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>
                          {r.unit || r.ingredient_unit || ''}
                        </div>
                      </div>
                      <div style={{ padding: '10px 10px', fontSize: 13, color: 'var(--color-text)' }}>{r.quantity}</div>
                      <div style={{ padding: '10px 10px', fontSize: 13, color: 'var(--color-text)' }}>
                        {r.ingredient_current_price != null ? formatKRW(r.ingredient_current_price) : '-'}
                      </div>
                      <div style={{ padding: '10px 10px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleRemoveIngredient(r.id)}
                          disabled={isPending}
                          style={{ background: 'transparent', border: 'none', color: '#b91c1c', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                        >
                          제외
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#6b7280' }}>현재 원가</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900, color: 'var(--color-text)' }}>
                    {formatKRW(liveCost ?? 0)}
                  </div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#6b7280' }}>마진율</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900, color: 'var(--color-text)' }}>
                    {pct(liveMargin)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={handleSaveMenu}
              disabled={isPending || !name.trim() || !String(price).trim()}
              style={{ flex: 2, padding: '11px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
            >
              {isPending ? '저장 중…' : '저장'}
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              disabled={isPending}
              style={{ flex: 1, padding: '11px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', color: '#6b7280' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {menus.length === 0 ? (
        <>
          <div className="menus-fade-up menus-anim-hero" style={{ background: '#2a6a46', borderRadius: 20, padding: 22, marginBottom: 28 }}>
            <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>아직 메뉴가 없어요</p>
            <p style={{ margin: '0 0 8px', color: '#ffffff', fontSize: 16, fontWeight: 500 }}>대표 메뉴 1개만 먼저 등록해보세요</p>
            <p style={{ margin: '0 0 18px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>등록하면 생각보다 많은 걸 바로 볼 수 있습니다</p>
            <button type="button" className="menus-anim-cta" onClick={openCreate} style={{ width: '100%', background: '#F97316', color: '#ffffff', border: 'none', borderRadius: 10, padding: 13, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              대표 메뉴 등록하기
            </button>
          </div>
          <div className="menus-anim-divider" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: '#e8e5de' }} />
            <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>등록하면 이렇게 보여요</span>
            <div style={{ flex: 1, height: 1, background: '#e8e5de' }} />
          </div>
          <div className="menus-fade-up menus-anim-card1 menus-card-hover" style={{ background: '#ffffff', border: '1px solid #c8e6d0', borderRadius: 18, padding: '18px 18px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 500, color: '#2b2b2b' }}>김치찌개</span>
              <span style={{ fontSize: 11, fontWeight: 600, background: '#edf7f1', color: '#1f5d3a', padding: '4px 10px', borderRadius: 999 }}>마진 우수</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>재료 원가 제외</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#1f5d3a', lineHeight: 1 }}>+6,300원</div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1f5d3a' }}>70%</div>
            </div>
            <div style={costEstimateRowStyle}><span>판매가 9,000원</span><span>재료 원가 2,700원</span></div>
          </div>
          <div className="menus-fade-up menus-anim-card2 menus-card-hover" style={{ background: '#ffffff', border: '0.5px solid #e8e5de', borderRadius: 16, padding: '16px 18px 12px', marginBottom: 10, opacity: 0.7 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#2b2b2b', marginBottom: 10 }}>제육볶음</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#6b7280' }}>+5,500원</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#6b7280' }}>55%</span>
            </div>
            <div style={costEstimateRowStyle}><span>판매가 10,000원</span><span>원가 4,500원</span></div>
          </div>
          <div className="menus-fade-up menus-anim-card3" style={{ background: '#ffffff', border: '0.5px solid #e8e5de', borderRadius: 16, padding: '16px 18px', opacity: 0.25, filter: 'blur(2px)', pointerEvents: 'none' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#2b2b2b', marginBottom: 8 }}>된장찌개</div>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#F97316' }}>+2,400원</span>
          </div>
        </>
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>검색 결과가 없습니다.</p>
      ) : (
        filtered.map((m) => {
          const badge = marginBadge(m.margin_rate)
          return (
            <div key={m.id} className="menus-card-hover" style={{ background: '#ffffff', borderRadius: 16, border: '0.5px solid #e8e5de', padding: '16px 18px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#2b2b2b' }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{(m.category ?? '미분류')} · 재료 {m.ingredients.length}개{m.is_representative ? ' · 대표' : ''}</div>
                </div>
                {badge && <span style={{ fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color, padding: '4px 10px', borderRadius: 999, flexShrink: 0 }}>{badge.label}</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>재료 원가 제외</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1f5d3a', lineHeight: 1.1 }}>{formatGrossProfit(m.price, m.calculated_cost)}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1f5d3a' }}>{pct(m.margin_rate)}</div>
              </div>
              <div style={{ ...costEstimateRowStyle, marginBottom: 12 }}>
                <span>판매가 {formatKRW(m.price ?? 0)}</span>
                <span>재료 원가 {formatKRW(m.calculated_cost ?? 0)}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                <button type="button" onClick={() => openEdit(m)} style={{ background: 'transparent', border: 'none', color: '#1f5d3a', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>편집</button>
                <button type="button" onClick={() => handleDeactivate(m.id)} disabled={isPending} style={{ background: 'transparent', border: 'none', color: '#b91c1c', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>비활성화</button>
              </div>
            </div>
          )
        })
      )}
    </main>
    </>
  )
}
