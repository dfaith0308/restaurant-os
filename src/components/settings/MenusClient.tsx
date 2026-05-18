'use client'

import { useMemo, useState, useTransition, type FocusEvent } from 'react'
import Link from 'next/link'
import { formatKRW } from '@/lib/utils'
import {
  activateMenu,
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

function hasNoReliableCost(m: MenuWithCost): boolean {
  return m.ingredients.length === 0 || m.calculated_cost == null || m.calculated_cost === 0
}

function getMenuCardDisplay(
  m: MenuWithCost,
  directCostByMenuId: Record<string, string>,
): {
  showMetrics: boolean
  grossProfit: string
  marginRate: number | null
  costForRow: number
} {
  const priceNum = m.price ?? 0
  const directStr = directCostByMenuId[m.id]?.trim() ?? ''
  const directNum = directStr ? parseInt(directStr.replace(/[^0-9]/g, ''), 10) : NaN

  if (directStr && Number.isFinite(directNum) && directNum > 0) {
    const marginRate = priceNum > 0 ? ((priceNum - directNum) / priceNum) * 100 : null
    return {
      showMetrics: true,
      grossProfit: formatGrossProfit(priceNum, directNum),
      marginRate,
      costForRow: directNum,
    }
  }

  if (hasNoReliableCost(m)) {
    return { showMetrics: false, grossProfit: '-', marginRate: null, costForRow: 0 }
  }

  return {
    showMetrics: true,
    grossProfit: formatGrossProfit(priceNum, m.calculated_cost),
    marginRate: m.margin_rate,
    costForRow: m.calculated_cost ?? 0,
  }
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

function MenuMetricsHero(props: { grossProfit: string; marginRate: number | null }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>재료 제외 금액</div>
        <div style={{ fontSize: 32, fontWeight: 500, color: '#1f5d3a', lineHeight: 1.1 }}>{props.grossProfit}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>예상 마진</div>
        <div style={{ fontSize: 20, fontWeight: 500, color: '#1f5d3a' }}>{pct(props.marginRate)}</div>
      </div>
    </div>
  )
}

function MenuPriceCostRow(props: { price: number; cost: number }) {
  return (
    <div
      style={{
        background: '#f7f6f2',
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 12,
        fontSize: 12,
        color: '#6b7280',
      }}
    >
      <span>판매가 {formatKRW(props.price)}</span>
      <span>재료 원가 {formatKRW(props.cost)}</span>
    </div>
  )
}

function HiddenCostNotice() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 12,
        fontSize: 11,
        color: '#9ca3af',
        lineHeight: 1.4,
      }}
    >
      <svg width="12" height="12" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span>숨은 원가(임대료·인건비·기본반찬 등)는 포함되지 않아요</span>
    </div>
  )
}

function MenuUnconfiguredBox(props: {
  price: number | null | undefined
  onConfigure: () => void
}) {
  return (
    <div
      style={{
        background: '#f7f6f2',
        borderRadius: 10,
        padding: '14px 16px',
        marginBottom: 12,
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 500, color: '#2b2b2b', margin: '0 0 4px', lineHeight: 1.4 }}>
        재료 구성하면 예상 마진을 볼 수 있어요
      </p>
      <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px', lineHeight: 1.5 }}>
        대략적인 양만 입력해도 계산됩니다
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
          판매가 {formatKRW(props.price ?? 0)}
        </span>
        <button
          type="button"
          onClick={props.onConfigure}
          style={{
            flexShrink: 0,
            background: '#1f5d3a',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          재료 구성하기
        </button>
      </div>
    </div>
  )
}

const formInputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '0.5px solid #e8e5de',
  borderRadius: 10,
  background: '#f7f6f2',
  fontSize: 14,
  color: '#2b2b2b',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
}

const formLabelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: '#2b2b2b',
  marginBottom: 6,
  display: 'block',
}

function onFormInputFocus(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#1f5d3a'
  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(31, 93, 58, 0.12)'
}

function onFormInputBlur(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#e8e5de'
  e.currentTarget.style.boxShadow = 'none'
}

export default function MenusClient(props: {
  menus: MenuWithCost[]
  inactiveMenus: MenuWithCost[]
  ingredients: Ingredient[]
  error: string | null
}) {
  const [menus, setMenus] = useState<MenuWithCost[]>(props.menus)
  const [inactiveMenus, setInactiveMenus] = useState<MenuWithCost[]>(props.inactiveMenus)
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

  const [costInputTab, setCostInputTab] = useState<'direct' | 'ingredient'>('direct')
  const [directCost, setDirectCost] = useState('')
  const [directCostByMenuId, setDirectCostByMenuId] = useState<Record<string, string>>({})
  const [priceFocused, setPriceFocused] = useState(false)
  const [directCostFocused, setDirectCostFocused] = useState(false)
  const [confirmHideMenuId, setConfirmHideMenuId] = useState<string | null>(null)

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
    setCostInputTab('direct')
    setDirectCost('')
    setPriceFocused(false)
    setDirectCostFocused(false)
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
    setDirectCost(directCostByMenuId[m.id] ?? '')
    setCostInputTab('direct')
    setPriceFocused(false)
    setDirectCostFocused(false)
    setShowForm(true)
  }

  function syncDirectCostForMenu(menuId: string, value: string) {
    setDirectCost(value)
    setDirectCostByMenuId((prev) => {
      const trimmed = value.trim()
      if (!trimmed) {
        const next = { ...prev }
        delete next[menuId]
        return next
      }
      return { ...prev, [menuId]: value }
    })
  }

  const formPriceNum = parseInt((price || '0').replace(/[^0-9]/g, ''), 10)
  const formDirectCostNum = parseInt((directCost || '').replace(/[^0-9]/g, ''), 10)
  const formDirectMargin =
    formPriceNum > 0 && Number.isFinite(formDirectCostNum) && formDirectCostNum > 0
      ? ((formPriceNum - formDirectCostNum) / formPriceNum) * 100
      : null

  const priceDisplay = priceFocused
    ? price
    : price
      ? Number(price).toLocaleString('ko-KR')
      : ''

  const directCostDisplay = directCostFocused
    ? directCost
    : directCost
      ? Number(directCost).toLocaleString('ko-KR')
      : ''

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

  async function refreshMenuLists() {
    const menusMod = await import('@/actions/menus')
    const [next, inactive] = await Promise.all([menusMod.getMenus(), menusMod.getInactiveMenus()])
    if (next.success) setMenus(next.data ?? [])
    if (inactive.success) setInactiveMenus(inactive.data ?? [])
  }

  function handleDeactivate(menuId: string) {
    startTr(async () => {
      const res = await deactivateMenu(menuId)
      if (!res.success) {
        alert(res.error ?? '처리 실패')
        return
      }
      setConfirmHideMenuId(null)
      await refreshMenuLists()
    })
  }

  function handleActivate(menuId: string) {
    startTr(async () => {
      const res = await activateMenu(menuId)
      if (!res.success) {
        alert(res.error ?? '처리 실패')
        return
      }
      await refreshMenuLists()
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
        .menu-hide-btn { color: #9ca3af; transition: color 150ms ease; }
        .menu-hide-btn:hover:not(:disabled) { color: #6b7280; }
        .menu-restore-btn { transition: opacity 150ms ease; }
        .menu-restore-btn:hover:not(:disabled) { opacity: 0.8; }
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
        <div style={{ background: '#ffffff', border: '0.5px solid #e8e5de', borderRadius: 18, padding: 20, marginBottom: 16, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2b2b2b' }}>
              {editingId ? '메뉴 수정' : '메뉴 등록'}
            </div>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  if (editingId) setConfirmHideMenuId(editingId)
                  setShowForm(false)
                  resetForm()
                }}
                disabled={isPending}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 13, fontWeight: 500, cursor: 'pointer', minHeight: 44, padding: '10px 8px', fontFamily: 'inherit' }}
              >
                메뉴 숨기기
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            <div>
              <label style={formLabelStyle}>메뉴명 *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 김치볶음밥"
                style={formInputStyle}
                onFocus={onFormInputFocus}
                onBlur={onFormInputBlur}
              />
            </div>
            <div>
              <label style={formLabelStyle}>판매가 *</label>
              <input
                value={priceDisplay}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
                onFocus={(e) => {
                  setPriceFocused(true)
                  onFormInputFocus(e)
                }}
                onBlur={(e) => {
                  setPriceFocused(false)
                  onFormInputBlur(e)
                }}
                inputMode="numeric"
                placeholder="예: 9000"
                style={formInputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginTop: 14 }}>
            <div>
              <label style={formLabelStyle}>카테고리 (선택)</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="예: 식사, 사이드, 주류, 점심메뉴, 세트메뉴"
                style={formInputStyle}
                onFocus={onFormInputFocus}
                onBlur={onFormInputBlur}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer' }}>
              <input type="checkbox" checked={isRep} onChange={(e) => setIsRep(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: '#2b2b2b' }}>대표메뉴 (최대 3개)</span>
            </label>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={formLabelStyle}>메모 (선택)</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 점심특선 / 시그니처 메뉴 / 3월 한정 테스트 메뉴"
              style={{ ...formInputStyle, resize: 'none', height: 72 }}
              onFocus={onFormInputFocus}
              onBlur={onFormInputBlur}
            />
          </div>
          {editingId && (
            <div style={{ marginTop: 18, borderTop: '0.5px solid #e8e5de', paddingTop: 18 }}>
              <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5, margin: '0 0 12px' }}>
                정확한 재료 입력 전에
                <br />
                대략 얼마 남는지 먼저 확인할 수 있어요
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setCostInputTab('direct')}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: costInputTab === 'direct' ? 'none' : '0.5px solid #e8e5de',
                    background: costInputTab === 'direct' ? '#1f5d3a' : '#ffffff',
                    color: costInputTab === 'direct' ? '#ffffff' : '#6b7280',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  빠르게 계산
                </button>
                <button
                  type="button"
                  onClick={() => setCostInputTab('ingredient')}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: costInputTab === 'ingredient' ? 'none' : '0.5px solid #e8e5de',
                    background: costInputTab === 'ingredient' ? '#1f5d3a' : '#ffffff',
                    color: costInputTab === 'ingredient' ? '#ffffff' : '#6b7280',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  재료로 자세히 계산
                </button>
              </div>

              {costInputTab === 'direct' ? (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5, margin: '0 0 12px' }}>
                    재료를 자세히 입력하기 전에
                    <br />
                    대략적인 마진을 먼저 확인할 수 있어요.
                  </p>
                  <label style={formLabelStyle}>예상 원가 (대략적인 금액)</label>
                  <input
                    value={directCostDisplay}
                    onChange={(e) => syncDirectCostForMenu(editingId, e.target.value.replace(/[^0-9]/g, ''))}
                    inputMode="numeric"
                    placeholder="예: 8,000"
                    style={formInputStyle}
                    onFocus={(e) => {
                      setDirectCostFocused(true)
                      onFormInputFocus(e)
                    }}
                    onBlur={(e) => {
                      setDirectCostFocused(false)
                      onFormInputBlur(e)
                    }}
                  />
                  {formDirectMargin != null && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                      <div style={{ background: '#f7f6f2', borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>예상 남는 금액</div>
                        <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, color: '#1f5d3a' }}>{formatGrossProfit(formPriceNum, formDirectCostNum)}</div>
                      </div>
                      <div style={{ background: '#f7f6f2', borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>예상 마진율</div>
                        <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, color: '#1f5d3a' }}>{pct(formDirectMargin)}</div>
                      </div>
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5, margin: '12px 0 0' }}>
                    더 정확히 보려면{' '}
                    <button
                      type="button"
                      onClick={() => setCostInputTab('ingredient')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        color: '#1f5d3a',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textDecoration: 'underline',
                      }}
                    >
                      재료로 자세히 계산
                    </button>
                    을 이용해보세요.
                  </p>
                </div>
              ) : (
                <>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2b2b2b', marginBottom: 10 }}>식재료 구성 (1인분 기준)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                <div>
                  <label style={{ ...formLabelStyle, fontSize: 12 }}>식자재</label>
                  <select value={ingId} onChange={(e) => {
                      const id = e.target.value
                      setIngId(id)
                      const ing = props.ingredients.find((x) => x.id === id)
                      setIngUnit(ing?.unit ?? '')
                    }} style={{ ...formInputStyle, minHeight: 44 }} onFocus={onFormInputFocus} onBlur={onFormInputBlur}>
                    <option value="">선택…</option>
                    {props.ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} {i.current_price != null ? `(${formatKRW(i.current_price)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ ...formLabelStyle, fontSize: 12 }}>수량</label>
                    <input value={ingQty} onChange={(e) => setIngQty(e.target.value.replace(/[^0-9.]/g, ''))}
                      inputMode="decimal" placeholder="예: 0.2" style={formInputStyle} onFocus={onFormInputFocus} onBlur={onFormInputBlur} />
                  </div>
                  <div>
                    <label style={{ ...formLabelStyle, fontSize: 12 }}>단위</label>
                    <input value={ingUnit} onChange={(e) => setIngUnit(e.target.value)}
                      placeholder={selectedIngredient?.unit ?? '예: kg'} style={formInputStyle} onFocus={onFormInputFocus} onBlur={onFormInputBlur} />
                  </div>
                </div>
                <button type="button" onClick={handleAddIngredient} disabled={isPending || !ingId || !(Number(ingQty) > 0)}
                  style={{ width: '100%', minHeight: 44, padding: '12px', background: '#1f5d3a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  추가
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
                원가 계산: Σ(현재가 × 수량). 계산값은 저장하지 않습니다.
              </div>
              <div style={{ marginTop: 10, background: '#f7f6f2', border: '0.5px solid #e8e5de', borderRadius: 12, overflow: 'hidden' }}>
                {(currentMenu?.ingredients ?? []).length === 0 ? (
                  <div style={{ padding: 14, fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
                    식재료를 입력하면 원가가 계산됩니다.
                    <div style={{ marginTop: 10 }}>
                      <button type="button" onClick={handleFetchEstimate} disabled={isPending || !name.trim()}
                        style={{ minHeight: 44, padding: '10px 16px', background: '#1f5d3a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        비슷한 메뉴 예상 원가 보기
                      </button>
                    </div>
                    {estimate?.estimated_cost != null && (
                      <div style={{ marginTop: 10, color: '#2b2b2b', fontWeight: 600, fontSize: 13 }}>
                        예상 원가 약 {formatKRW(estimate.estimated_cost)} (±15% 오차)
                      </div>
                    )}
                    {estimate && estimate.estimated_cost == null && (
                      <div style={{ marginTop: 10 }}>추정 데이터가 없습니다. 식재료를 입력하면 원가가 계산됩니다.</div>
                    )}
                  </div>
                ) : (
                  currentMenu!.ingredients.map((r) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '0.5px solid #e8e5de' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#2b2b2b' }}>{r.ingredient_name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                          {r.quantity} {r.unit || r.ingredient_unit || ''} · {r.ingredient_current_price != null ? formatKRW(r.ingredient_current_price) : '-'}
                        </div>
                      </div>
                      <button type="button" onClick={() => handleRemoveIngredient(r.id)} disabled={isPending}
                        style={{ background: 'transparent', border: 'none', color: '#b91c1c', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44, padding: '8px', fontFamily: 'inherit' }}>
                        제외
                      </button>
                    </div>
                  ))
                )}
              </div>
              {currentMenu && !hasNoReliableCost(currentMenu) && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#f7f6f2', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>현재 원가</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, color: '#2b2b2b' }}>{formatKRW(liveCost ?? 0)}</div>
                </div>
                <div style={{ background: '#f7f6f2', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>마진율</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, color: '#1f5d3a' }}>{pct(liveMargin)}</div>
                </div>
              </div>
              )}
                </>
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            <button type="button" onClick={handleSaveMenu} disabled={isPending || !name.trim() || !String(price).trim()}
              style={{ width: '100%', minHeight: 44, padding: '12px', background: '#1f5d3a', color: '#ffffff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {isPending ? '저장 중…' : '저장'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); resetForm() }} disabled={isPending}
              style={{ width: '100%', minHeight: 44, padding: '12px', background: '#ffffff', border: '0.5px solid #e8e5de', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#9ca3af', fontFamily: 'inherit' }}>
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
                        <MenuMetricsHero grossProfit="+6,300원" marginRate={70} />
            <MenuPriceCostRow price={9000} cost={2700} />
            <HiddenCostNotice />

          </div>
          <div className="menus-fade-up menus-anim-card2 menus-card-hover" style={{ background: '#ffffff', border: '0.5px solid #e8e5de', borderRadius: 16, padding: '16px 18px 12px', marginBottom: 10, opacity: 0.7 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#2b2b2b', marginBottom: 10 }}>제육볶음</div>
                        <MenuMetricsHero grossProfit="+5,500원" marginRate={55} />
            <MenuPriceCostRow price={10000} cost={4500} />

          </div>
          <div className="menus-fade-up menus-anim-card3" style={{ background: '#ffffff', border: '0.5px solid #e8e5de', borderRadius: 16, padding: '16px 18px 12px', opacity: 0.25, filter: 'blur(2px)', pointerEvents: 'none' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#2b2b2b', marginBottom: 10 }}>된장찌개</div>
            <MenuMetricsHero grossProfit="+2,400원" marginRate={40} />
            <MenuPriceCostRow price={8000} cost={5600} />
          </div>
        </>
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>검색 결과가 없습니다.</p>
      ) : (
        filtered.map((m) => {
          const display = getMenuCardDisplay(m, directCostByMenuId)
          const badge = display.showMetrics ? marginBadge(display.marginRate) : null
          return (
            <div key={m.id} className="menus-card-hover" style={{ background: '#ffffff', borderRadius: 16, border: '0.5px solid #e8e5de', padding: '16px 18px', marginBottom: 10, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#2b2b2b' }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{(m.category ?? '미분류')} · 재료 {m.ingredients.length}개{m.is_representative ? ' · 대표' : ''}</div>
                </div>
                {badge && <span style={{ fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color, padding: '4px 10px', borderRadius: 999, flexShrink: 0 }}>{badge.label}</span>}
              </div>
              {display.showMetrics ? (
                <>
                  <MenuMetricsHero grossProfit={display.grossProfit} marginRate={display.marginRate} />
                  <MenuPriceCostRow price={m.price ?? 0} cost={display.costForRow} />
                  <HiddenCostNotice />
                </>
              ) : (
                <MenuUnconfiguredBox price={m.price} onConfigure={() => openEdit(m)} />
              )}

              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                {confirmHideMenuId !== m.id && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {display.showMetrics && (
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        style={{
                          background: 'transparent',
                          border: '1px solid #1f5d3a',
                          color: '#1f5d3a',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '8px 14px',
                          minHeight: 44,
                          fontFamily: 'inherit',
                        }}
                      >
                        원가 수정
                      </button>
                    )}
                    <button
                      type="button"
                      className="menu-hide-btn"
                      onClick={() => setConfirmHideMenuId(m.id)}
                      disabled={isPending}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#9ca3af',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '10px 0',
                        minHeight: 44,
                        fontFamily: 'inherit',
                      }}
                    >
                      메뉴 숨기기
                    </button>
                  </div>
                )}
                {confirmHideMenuId === m.id && (
                  <div
                    style={{
                      background: '#f7f6f2',
                      border: '0.5px solid #ece7df',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#2b2b2b', margin: '0 0 6px' }}>
                      이 메뉴를 숨길까요?
                    </p>
                    <p style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5, margin: '0 0 12px' }}>
                      숨겨진 메뉴는 언제든 다시 표시할 수 있어요.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setConfirmHideMenuId(null)}
                        disabled={isPending}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: '0.5px solid #e8e5de',
                          color: '#6b7280',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeactivate(m.id)}
                        disabled={isPending}
                        style={{
                          flex: 1,
                          background: '#1f5d3a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        숨기기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}

      {inactiveMenus.length > 0 && (
        <div
          style={{
            background: '#f7f6f2',
            border: '0.5px solid #e8e5de',
            borderRadius: 16,
            padding: 16,
            marginTop: 24,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12 }}>
            숨긴 메뉴 ({inactiveMenus.length}개)
          </div>
          {inactiveMenus.map((m, i) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: i < inactiveMenus.length - 1 ? '0.5px solid #e8e5de' : undefined,
              }}
            >
              <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 500 }}>{m.name}</span>
              <button
                type="button"
                onClick={() => handleActivate(m.id)}
                disabled={isPending}
                className="menu-restore-btn"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#1f5d3a',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                다시 표시
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
    </>
  )
}
