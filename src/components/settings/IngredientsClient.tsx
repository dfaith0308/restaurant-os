'use client'

import { useMemo, useState, useTransition, useCallback, useRef } from 'react'
import {
  createIngredient,
  updateIngredient,
  deactivateIngredient,
  registerInvoiceIngredients,
  upsertInvoiceSupplierFromOcr,
} from '@/actions/ingredients'
import { formatKRW, toKoreanAmount } from '@/lib/utils'
import { analyzeInvoiceImage } from '@/lib/invoice-ocr'
import type { InvoiceIngredient, InvoiceSupplier } from '@/lib/invoice-ocr'
import Link from 'next/link'
import IngredientBarcodeSection from '@/components/product/IngredientBarcodeSection'
import type { IngredientBarcodeApplyHints } from '@/components/product/IngredientBarcodeSection'

const BRAND_ORANGE = '#F97316'
const BRAND_GREEN = '#1f5d3a'

const UNITS = ['kg', 'g', 'L', 'ml', '개', '봉', '묶음', '팩', '캔'] as const

type RegisterMode = 'select' | 'manual' | 'product' | 'invoice' | null
type InvoiceAnalyzeStatus = 'idle' | 'loading' | 'success' | 'failed'

type OcrIngredientRow = InvoiceIngredient & {
  rowKey: string
  effectiveFrom: string
  priceAction?: 'apply' | 'keep'
}

// 거래명세서 식자재명은 업체마다 표현이 다르다.
// OCR 중복 폭발 방지를 위해 canonical normalize 사용.
const CANONICAL_STRIP_TOKENS = [
  '국내산',
  '수입산',
  '상품',
  '박스',
  'box',
  '깐',
  '특',
  'kg',
  'ea',
  '개',
  'g',
] as const

function normalizeIngredientName(name: string): string {
  let s = name
    .trim()
    .toLowerCase()
    .replace(/[\s()[\]{}·.,\-_/\\|"'`~!@#$%^&*+=?:;<>]/g, '')

  for (const token of CANONICAL_STRIP_TOKENS) {
    s = s.split(token).join('')
  }

  s = s.replace(/\d+/g, '')
  return s
}

function isLikelySameIngredient(a: string, b: string): boolean {
  const left = normalizeIngredientName(a)
  const right = normalizeIngredientName(b)
  if (!left || !right) return false
  return left === right
}

function findCanonicalIngredient(
  ingredients: Ingredient[],
  ocrName: string,
): Ingredient | undefined {
  return ingredients.find((row) => isLikelySameIngredient(row.name, ocrName))
}

function todayDateString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function defaultEffectiveFrom(invoiceDate: string | null): string {
  return invoiceDate ?? todayDateString()
}

function pricesDiffer(
  existing: number | null,
  incoming: number | null,
): boolean {
  if (incoming == null) return false
  if (existing == null) return true
  return existing !== incoming
}

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

function ModeChevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" stroke="#c0bdb8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RegisterModeCard({
  icon,
  iconBg,
  title,
  description,
  badge,
  badgeStyle,
  onClick,
}: {
  icon: string
  iconBg: string
  title: string
  description: string
  badge?: string
  badgeStyle?: React.CSSProperties
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="reg-mode-card"
      onClick={onClick}
      style={{
        width: '100%',
        background: '#ffffff',
        border: '0.5px solid #e8e5de',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s ease',
        marginBottom: 10,
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#2b2b2b' }}>{title}</span>
          {badge ? (
            <span style={badgeStyle}>{badge}</span>
          ) : null}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: '#9ca3af', lineHeight: 1.45 }}>
          {description}
        </span>
      </span>
      <ModeChevron />
    </button>
  )
}

export default function IngredientsClient({ ingredients: init, restaurantId: _restaurantId }: Props) {
  const [list, setList] = useState(init)
  const [showForm, setShowForm] = useState(false)
  const [registerMode, setRegisterMode] = useState<RegisterMode>(null)
  const [barcodeToolsOpen, setBarcodeToolsOpen] = useState(false)
  const [isPending, startTr] = useTransition()

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
  const invoiceInputRef = useRef<HTMLInputElement>(null)
  const [invoiceImage, setInvoiceImage] = useState<File | null>(null)
  const [invoiceAnalyzeStatus, setInvoiceAnalyzeStatus] =
    useState<InvoiceAnalyzeStatus>('idle')
  const [invoiceDate, setInvoiceDate] = useState<string | null>(null)
  const [invoiceSupplier, setInvoiceSupplier] = useState<InvoiceSupplier | null>(null)
  const [ocrIngredients, setOcrIngredients] = useState<OcrIngredientRow[]>([])
  const [bulkRegisterMessage, setBulkRegisterMessage] = useState<string | null>(null)

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

  const registrationOpen = registerMode !== null
  const showManualForm =
    showForm && (registerMode === 'manual' || registerMode === 'product')

  const pendingPriceChoices = useMemo(() => {
    return ocrIngredients.some((row) => {
      const existing = findCanonicalIngredient(list, row.name)
      if (!existing || row.price == null) return false
      return pricesDiffer(existing.current_price, row.price) && row.priceAction == null
    })
  }, [ocrIngredients, list])

  function resetInvoiceFlow() {
    setInvoiceImage(null)
    setInvoiceAnalyzeStatus('idle')
    setInvoiceDate(null)
    setInvoiceSupplier(null)
    setOcrIngredients([])
    setBulkRegisterMessage(null)
  }

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

  function closeRegistration() {
    setShowForm(false)
    setRegisterMode(null)
    resetForm()
    resetInvoiceFlow()
  }

  function updateOcrRow(
    rowKey: string,
    field: keyof InvoiceIngredient,
    value: string,
  ) {
    setOcrIngredients((prev) =>
      prev.map((row) => {
        if (row.rowKey !== rowKey) return row
        if (field === 'name') {
          return { ...row, name: value, priceAction: undefined }
        }
        if (field === 'unit') {
          return { ...row, unit: value.trim() || null }
        }
        if (field === 'quantity') {
          const n = parseFloat(value.replace(/,/g, ''))
          return {
            ...row,
            quantity: Number.isFinite(n) && n > 0 ? n : null,
          }
        }
        const n = parseInt(value.replace(/,/g, ''), 10)
        return {
          ...row,
          price: Number.isFinite(n) && n > 0 ? n : null,
          priceAction: undefined,
        }
      }),
    )
    setBulkRegisterMessage(null)
  }

  function updateOcrEffectiveFrom(rowKey: string, value: string) {
    setOcrIngredients((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey ? { ...row, effectiveFrom: value } : row,
      ),
    )
    setBulkRegisterMessage(null)
  }

  function setOcrPriceAction(rowKey: string, action: 'apply' | 'keep') {
    setOcrIngredients((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey ? { ...row, priceAction: action } : row,
      ),
    )
    setBulkRegisterMessage(null)
  }

  async function handleInvoiceFileSelect(file: File | undefined) {
    if (!file) return
    setInvoiceImage(file)
    setInvoiceAnalyzeStatus('loading')
    setInvoiceDate(null)
    setInvoiceSupplier(null)
    setOcrIngredients([])
    setBulkRegisterMessage(null)

    const result = await analyzeInvoiceImage(file)
    if (!result || result.items.length === 0) {
      setInvoiceAnalyzeStatus('failed')
      return
    }
    const effDefault = defaultEffectiveFrom(result.invoice_date)
    setInvoiceDate(result.invoice_date)
    setInvoiceSupplier(result.supplier)
    if (result.supplier) {
      void upsertInvoiceSupplierFromOcr(result.supplier)
    }
    setOcrIngredients(
      result.items.map((item, idx) => ({
        ...item,
        rowKey: `ocr_${Date.now()}_${idx}`,
        effectiveFrom: effDefault,
        priceAction: undefined,
      })),
    )
    setInvoiceAnalyzeStatus('success')
  }

  function handleBulkRegister() {
    const rows = ocrIngredients
      .filter((row) => row.name.trim().length > 0)
      .map((row) => {
        const existing = findCanonicalIngredient(list, row.name)
        let mode: 'new' | 'apply' | 'keep'
        if (!existing) {
          mode = 'new'
        } else if (
          row.price != null &&
          pricesDiffer(existing.current_price, row.price)
        ) {
          mode = row.priceAction === 'apply' ? 'apply' : 'keep'
        } else {
          mode = 'keep'
        }
        return {
          name: row.name.trim(),
          unit: row.unit?.trim() || '개',
          price: row.price,
          memo:
            row.quantity != null
              ? `거래명세서 OCR · 수량 ${row.quantity}${row.unit ? ` ${row.unit}` : ''}`
              : '거래명세서 OCR',
          mode,
          effective_from: row.effectiveFrom,
        }
      })

    if (rows.length === 0) return

    startTr(async () => {
      const res = await registerInvoiceIngredients(rows)
      if (!res.success || !res.data) {
        setBulkRegisterMessage('등록에 실패했어요. 다시 시도해주세요.')
        return
      }
      const { successCount, created, updated } = res.data
      if (created.length > 0 || updated.length > 0) {
        setList((prev) => {
          const byId = new Map(prev.map((i) => [i.id, i]))
          for (const u of updated) byId.set(u.id, u)
          const merged = [...byId.values()]
          for (const c of created) {
            if (!byId.has(c.id)) merged.push(c)
          }
          return merged
        })
      }
      setBulkRegisterMessage(`${successCount}개 등록 완료`)
      if (successCount > 0) {
        setTimeout(() => closeRegistration(), 1200)
      }
    })
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
        closeRegistration()
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
    closeRegistration()
    setEditingId(i.id)
    setName(i.name)
    setUnit(UNITS.includes(i.unit as (typeof UNITS)[number]) ? i.unit : 'kg')
    setCategory(i.category ?? '')
    setPrice(i.current_price != null ? String(i.current_price) : '')
    setTargetPrice(i.target_price != null ? String(i.target_price) : '')
    setMemo(i.memo ?? '')
    setBarcode(i.barcode ?? '')
    setRegisterMode('manual')
    setShowForm(true)
  }

  function openAddFlow() {
    if (registrationOpen) {
      closeRegistration()
    } else {
      resetForm()
      setRegisterMode('select')
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
        .reg-mode-card:hover { border-color: #F97316 !important; }
        @keyframes naverPlaceSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Link href="/settings" style={{ fontSize: 13, color: BRAND_GREEN, fontWeight: 500, textDecoration: 'none' }}>
          ← 설정
        </Link>
        <button
          type="button"
          onClick={openAddFlow}
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

      {registerMode === 'select' && (
        <div
          className="fade-up"
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: '0.5px solid #e8e5de',
            padding: 20,
            marginBottom: 18,
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: '#2b2b2b', margin: '0 0 4px' }}>
            어떻게 등록하실 건가요?
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>
            식당 운영 방식에 맞게 선택하세요
          </p>

          <RegisterModeCard
            icon="✍️"
            iconBg="#edf7f1"
            title="직접 입력하기"
            description="식자재명, 단가, 단위를 직접 입력해요"
            onClick={() => {
              setRegisterMode('manual')
              setShowForm(true)
            }}
          />

          <RegisterModeCard
            icon="📦"
            iconBg="#fff8f3"
            title="제품 사진 찍기"
            description="제품 뒷면이나 바코드를 찍으면 정보를 가져올 수 있어요"
            badge="바코드 인식 지원"
            badgeStyle={{
              background: '#fff8f3',
              color: BRAND_ORANGE,
              borderRadius: 999,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 500,
            }}
            onClick={() => {
              setRegisterMode('product')
              setShowForm(true)
              setBarcodeToolsOpen(true)
            }}
          />

          <RegisterModeCard
            icon="📄"
            iconBg="#eff6ff"
            title="거래명세서 사진 찍기"
            description="명세서 한 장으로 여러 식자재를 한번에 등록해요"
            badge="자동 등록"
            badgeStyle={{
              background: '#eff6ff',
              color: '#3b82f6',
              borderRadius: 999,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 500,
            }}
            onClick={() => {
              resetInvoiceFlow()
              setRegisterMode('invoice')
            }}
          />

          <button
            type="button"
            onClick={() => setRegisterMode(null)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 12,
              padding: 0,
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              color: '#9ca3af',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'center',
            }}
          >
            취소
          </button>
        </div>
      )}

      {registerMode === 'invoice' && (
        <div
          className="fade-up"
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: '0.5px solid #e8e5de',
            padding: 20,
            marginBottom: 18,
          }}
        >
          <input
            ref={invoiceInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              handleInvoiceFileSelect(e.target.files?.[0])
              e.target.value = ''
            }}
          />

          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 38, marginBottom: 8 }}>📄</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#2b2b2b', margin: '0 0 6px' }}>
              거래명세서 자동 등록
            </p>
            <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, margin: 0 }}>
              공급가·수량·제품명을 자동 분석합니다
            </p>
          </div>

          {invoiceAnalyzeStatus === 'loading' ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 32,
                  height: 32,
                  border: '3px solid rgba(249,115,22,0.25)',
                  borderTopColor: BRAND_ORANGE,
                  borderRadius: '50%',
                  animation: 'naverPlaceSpin 0.7s linear infinite',
                  marginBottom: 12,
                }}
              />
              <p style={{ fontSize: 14, fontWeight: 500, color: '#2b2b2b', margin: '0 0 4px' }}>
                거래명세서 분석 중...
              </p>
              {invoiceImage && (
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
                  {invoiceImage.name}
                </p>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => invoiceInputRef.current?.click()}
                disabled={isPending}
                style={{
                  width: '100%',
                  padding: 13,
                  background: BRAND_ORANGE,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: isPending ? 0.65 : 1,
                  marginBottom: 12,
                }}
              >
                거래명세서 사진 선택
              </button>

              {invoiceAnalyzeStatus === 'failed' && (
                <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6, margin: '0 0 12px' }}>
                  거래명세서를 읽지 못했어요.
                  <br />
                  직접 입력을 이용해주세요.
                </p>
              )}

              {invoiceAnalyzeStatus === 'success' && ocrIngredients.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>
                    거래명세서 날짜:{' '}
                    <span style={{ fontWeight: 500, color: '#374151' }}>
                      {defaultEffectiveFrom(invoiceDate)}
                    </span>
                  </p>
                  {invoiceSupplier?.supplier_name && (
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 10px', lineHeight: 1.5 }}>
                      공급업체: {invoiceSupplier.supplier_name}
                      {invoiceSupplier.phone ? ` · ${invoiceSupplier.phone}` : ''}
                    </p>
                  )}
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#2b2b2b', margin: '0 0 10px' }}>
                    추출된 식자재 {ocrIngredients.length}개
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ocrIngredients.map((row) => {
                      const existing = findCanonicalIngredient(list, row.name)
                      const isNew = !existing
                      const priceChanged =
                        !!existing &&
                        row.price != null &&
                        pricesDiffer(existing.current_price, row.price)
                      return (
                        <div
                          key={row.rowKey}
                          style={{
                            background: '#ffffff',
                            border: priceChanged
                              ? `1px solid ${BRAND_ORANGE}`
                              : '0.5px solid #e8e5de',
                            borderRadius: 12,
                            padding: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                              품목
                            </span>
                            <span
                              style={{
                                background: isNew ? '#edf7f1' : '#f3f4f6',
                                color: isNew ? BRAND_GREEN : '#6b7280',
                                borderRadius: 999,
                                padding: '3px 8px',
                                fontSize: 10,
                                fontWeight: 500,
                              }}
                            >
                              {isNew ? '신규' : '기존'}
                            </span>
                          </div>
                          {!isNew && (
                            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 8px' }}>
                              기존 식자재와 연결됨
                            </p>
                          )}
                          <input
                            value={row.name}
                            onChange={(e) => updateOcrRow(row.rowKey, 'name', e.target.value)}
                            placeholder="식자재명"
                            style={{ ...INPUT_STYLE, marginBottom: 8 }}
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <input
                              value={row.quantity != null ? String(row.quantity) : ''}
                              onChange={(e) => updateOcrRow(row.rowKey, 'quantity', e.target.value)}
                              placeholder="수량"
                              inputMode="decimal"
                              style={INPUT_STYLE}
                            />
                            <input
                              value={row.unit ?? ''}
                              onChange={(e) => updateOcrRow(row.rowKey, 'unit', e.target.value)}
                              placeholder="단위"
                              style={INPUT_STYLE}
                            />
                          </div>
                          <input
                            value={row.price != null ? String(row.price) : ''}
                            onChange={(e) => updateOcrRow(row.rowKey, 'price', e.target.value)}
                            placeholder="공급가 (원)"
                            inputMode="numeric"
                            style={{ ...INPUT_STYLE, marginBottom: priceChanged ? 10 : 0 }}
                          />
                          {priceChanged && existing && row.price != null && (
                            <div
                              style={{
                                background: '#fff8f3',
                                border: `0.5px solid ${BRAND_ORANGE}`,
                                borderRadius: 10,
                                padding: 12,
                              }}
                            >
                              <p style={{ fontSize: 12, color: '#374151', margin: '0 0 4px', lineHeight: 1.5 }}>
                                기존 공급가:
                                <br />
                                {existing.current_price != null
                                  ? formatKRW(existing.current_price)
                                  : '미등록'}
                              </p>
                              <p style={{ fontSize: 12, color: '#374151', margin: '0 0 8px', lineHeight: 1.5 }}>
                                새 거래명세서:
                                <br />
                                {formatKRW(row.price)}
                              </p>
                              <p style={{ fontSize: 12, fontWeight: 600, color: BRAND_ORANGE, margin: '0 0 10px' }}>
                                공급가 변경으로 보입니다.
                              </p>
                              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px' }}>
                                적용 시작일
                              </p>
                              <input
                                type="date"
                                value={row.effectiveFrom}
                                onChange={(e) =>
                                  updateOcrEffectiveFrom(row.rowKey, e.target.value)
                                }
                                style={{ ...INPUT_STYLE, marginBottom: 10 }}
                              />
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => setOcrPriceAction(row.rowKey, 'apply')}
                                  style={{
                                    flex: 1,
                                    padding: 10,
                                    background:
                                      row.priceAction === 'apply'
                                        ? BRAND_ORANGE
                                        : '#ffffff',
                                    color:
                                      row.priceAction === 'apply'
                                        ? '#ffffff'
                                        : BRAND_ORANGE,
                                    border: `1px solid ${BRAND_ORANGE}`,
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  새 가격 적용
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOcrPriceAction(row.rowKey, 'keep')}
                                  style={{
                                    flex: 1,
                                    padding: 10,
                                    background:
                                      row.priceAction === 'keep'
                                        ? '#f3f4f6'
                                        : '#ffffff',
                                    color: '#6b7280',
                                    border: '0.5px solid #e8e5de',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  기존 가격 유지
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={handleBulkRegister}
                    disabled={
                      isPending ||
                      pendingPriceChoices ||
                      ocrIngredients.every((r) => !r.name.trim())
                    }
                    style={{
                      width: '100%',
                      marginTop: 12,
                      padding: 13,
                      background: BRAND_GREEN,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isPending ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      opacity: isPending ? 0.65 : 1,
                    }}
                  >
                    {isPending ? '등록 중...' : '식자재 한번에 등록'}
                  </button>
                  {bulkRegisterMessage && (
                    <p style={{ fontSize: 13, color: BRAND_GREEN, textAlign: 'center', marginTop: 10, fontWeight: 500 }}>
                      {bulkRegisterMessage}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                resetForm()
                resetInvoiceFlow()
                setRegisterMode('manual')
                setShowForm(true)
              }}
              style={{
                width: '100%',
                padding: 12,
                background: 'transparent',
                border: '0.5px solid #e8e5de',
                color: '#6b7280',
                borderRadius: 10,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              직접 입력하기
            </button>
            <button
              type="button"
              onClick={() => {
                resetInvoiceFlow()
                setRegisterMode('select')
              }}
              style={{
                width: '100%',
                padding: 0,
                border: 'none',
                background: 'transparent',
                fontSize: 13,
                color: '#9ca3af',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              돌아가기
            </button>
          </div>
        </div>
      )}

      {registerMode === 'product' && (
        <div className="fade-up" style={{ marginBottom: 12 }}>
          <IngredientBarcodeSection onApply={applyBarcodeHints} />
        </div>
      )}

      {showManualForm && (
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
                background: registerMode === 'product' ? '#fff8f3' : '#edf7f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {registerMode === 'product' ? '📦' : '🥬'}
            </span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#2b2b2b', margin: 0 }}>
                {editingId
                  ? '식자재 수정'
                  : registerMode === 'product'
                    ? '제품 정보 확인 후 저장'
                    : '새 식자재 등록'}
              </p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
                {registerMode === 'product'
                  ? '스캔한 정보를 확인하고 저장하세요'
                  : '단가를 입력하면 메뉴 원가가 자동 계산돼요'}
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
              onClick={closeRegistration}
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
      )}

      {list.length === 0 && !registrationOpen ? (
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
