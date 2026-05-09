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
      setEstimate(res.data as any)
    })
  }

  const selectedIngredient = useMemo(() => {
    return props.ingredients.find((i) => i.id === ingId) ?? null
  }, [ingId, props.ingredients])

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 80px' }}>
      <Link href="/settings" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>← 설정</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 20px' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>메뉴 · 원가</h1>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            원가는 실시간 계산(저장 금지). 대략적인 양만 입력해도 충분합니다(±20% OK).
          </div>
        </div>
        <button
          onClick={openCreate}
          style={{ padding: '8px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          + 메뉴 추가
        </button>
      </div>

      {props.error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 12 }}>
          {props.error}
        </div>
      )}

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

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr .8fr .7fr .7fr .3fr', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          {['메뉴', '판매가', '원가', '마진율', '대표', ''].map((h) => (
            <div key={h} style={{ padding: '10px 10px', fontSize: 11, fontWeight: 900, color: '#6b7280' }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 18, color: '#9ca3af', fontSize: 13 }}>
            표시할 메뉴가 없습니다.
          </div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr .8fr .7fr .7fr .3fr', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
              <div style={{ padding: '10px 10px' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--color-text)' }}>{m.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  {(m.category ?? '미분류')} · 재료 {m.ingredients.length}개
                </div>
              </div>
              <div style={{ padding: '10px 10px', fontSize: 13, color: 'var(--color-text)' }}>{formatKRW(m.price ?? 0)}</div>
              <div style={{ padding: '10px 10px', fontSize: 13, color: 'var(--color-text)' }}>{formatKRW(m.calculated_cost ?? 0)}</div>
              <div style={{ padding: '10px 10px', fontSize: 13, color: 'var(--color-text)' }}>{pct(m.margin_rate)}</div>
              <div style={{ padding: '10px 10px', fontSize: 12, fontWeight: 900, color: m.is_representative ? '#0f766e' : '#9ca3af' }}>
                {m.is_representative ? '대표' : '-'}
              </div>
              <div style={{ padding: '10px 10px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => openEdit(m)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}
                >
                  편집
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}

