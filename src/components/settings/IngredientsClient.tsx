'use client'

import { useMemo, useState, useTransition, useCallback, useRef, useEffect } from 'react'
import {
  createIngredient,
  updateIngredient,
  deactivateIngredient,
  registerInvoiceIngredients,
  upsertInvoiceSupplierFromOcr,
  getIngredientsOperationData,
  type IngredientPriceHistoryEntry,
  type IngredientOperationMeta,
  type IngredientsOperationData,
} from '@/actions/ingredients'
import { formatKRW, toKoreanAmount } from '@/lib/utils'
import { analyzeInvoiceImageWithRaw } from '@/lib/invoice-ocr'
import type { InvoiceIngredient, InvoiceSupplier } from '@/lib/invoice-ocr'
import { compressImageForInvoiceOcr } from '@/lib/image-compress'
import {
  buildInvoiceDocumentRuntime,
  type InvoiceDocumentRuntime,
} from '@/lib/invoice-document'
import { uploadInvoiceDocumentImage } from '@/lib/invoice-document-upload'
import {
  formatInvoiceItemDisplayTitle,
  normalizeInvoiceItemSpec,
} from '@/lib/invoice-item-validation'
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

import { normalizeIngredientName } from '@/lib/ingredient-canonical'

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

function parseSupplierFromMemo(memo: string | null): string | null {
  if (!memo) return null
  const explicit = memo.match(/공급[:：]\s*([^·\n]+)/)
  if (explicit?.[1]) {
    const name = explicit[1].trim()
    if (name) return name
  }
  if (!memo.includes('거래명세서 OCR')) return null
  const parts = memo.split('·').map((s) => s.trim())
  if (parts.length >= 2) {
    const seg = parts[1]
    if (seg && !seg.startsWith('수량')) return seg
  }
  return null
}

function inferRegistrationLabel(memo: string | null, barcode: string | null): string {
  const m = memo ?? ''
  if (m.includes('거래명세서 OCR')) return '거래명세서 등록'
  if (barcode || m.includes('제조사:') || m.includes('품목보고')) return '제품 사진 등록'
  return '수동 등록'
}

function formatRelativeDays(isoDate: string): string {
  const then = new Date(isoDate)
  if (Number.isNaN(then.getTime())) return ''
  const now = new Date()
  const days = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return '오늘'
  if (days === 1) return '1일 전'
  return `${days}일 전`
}

function formatDateLabel(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  return dateStr
}

function buildInvoiceMemo(
  quantity: number | null,
  unit: string | null | undefined,
  supplierName: string | null | undefined,
  spec: string | null | undefined,
): string {
  const parts = ['거래명세서 OCR']
  const supplier = supplierName?.trim()
  if (supplier) parts.push(supplier)
  const specNorm = spec ? normalizeInvoiceItemSpec(spec) : null
  if (specNorm) parts.push(`규격 ${specNorm}`)
  if (quantity != null) {
    parts.push(`수량 ${quantity}${unit ? ` ${unit}` : ''}`)
  }
  return parts.join(' · ')
}

function formatRelativeTime(isoDate: string): string {
  const then = new Date(isoDate)
  if (Number.isNaN(then.getTime())) return ''
  const diffMs = Date.now() - then.getTime()
  const mins = Math.floor(diffMs / (1000 * 60))
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return formatRelativeDays(isoDate)
}

function formatPriceChangeIndicator(
  meta: IngredientOperationMeta | undefined,
): { label: string; color: string } | null {
  if (
    !meta?.price_change_percent ||
    meta.price_change_percent === 0 ||
    !meta.price_change_direction
  ) {
    return null
  }
  const prefix = meta.price_change_direction === 'up' ? '▲' : '▼'
  const signed =
    meta.price_change_percent > 0
      ? `+${meta.price_change_percent}%`
      : `${meta.price_change_percent}%`
  return {
    label: `${prefix} ${signed}`,
    color: meta.price_change_direction === 'up' ? BRAND_ORANGE : '#2563eb',
  }
}

function matchesIngredientSearch(
  item: Ingredient,
  rawQuery: string,
  invoiceSupplierNames: string[],
): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  const tokens = q.split(/\s+/).filter(Boolean)
  const nameNorm = normalizeIngredientName(item.name)
  const supplier = (parseSupplierFromMemo(item.memo) ?? '').toLowerCase()
  const unit = (item.unit ?? '').toLowerCase()

  return tokens.every((token) => {
    const tokenNorm = normalizeIngredientName(token)
    return (
      item.name.toLowerCase().includes(token) ||
      (!!tokenNorm && nameNorm.includes(tokenNorm)) ||
      unit.includes(token) ||
      supplier.includes(token) ||
      invoiceSupplierNames.some((sn) => sn.toLowerCase().includes(token))
    )
  })
}

function sanitizeOcrUnitInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 20) return null
  return trimmed
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

const OCR_PROGRESS_STEPS = [
  '이미지 업로드 중...',
  '거래명세서 읽는 중...',
  '식자재 분석 중...',
  '가격 비교 중...',
  '등록 준비 완료',
] as const

const INVOICE_FP_STORAGE_KEY = 'restaurant_os_invoice_ocr_fps'

function buildInvoiceFingerprint(
  invoiceDate: string | null,
  supplier: InvoiceSupplier | null,
  items: InvoiceIngredient[],
): string {
  const date = invoiceDate ?? ''
  const supplierName = supplier?.supplier_name?.trim() ?? ''
  const topNames = items
    .map((item) => item.name.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('|')
  return `${date}::${supplierName}::${items.length}::${topNames}`
}

function loadRecentInvoiceFingerprints(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(INVOICE_FP_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

function saveInvoiceFingerprint(fingerprint: string): void {
  if (typeof window === 'undefined' || !fingerprint) return
  const recent = loadRecentInvoiceFingerprints()
  const next = [fingerprint, ...recent.filter((fp) => fp !== fingerprint)].slice(0, 30)
  window.localStorage.setItem(INVOICE_FP_STORAGE_KEY, JSON.stringify(next))
}

function isDuplicateInvoiceFingerprint(fingerprint: string): boolean {
  if (!fingerprint) return false
  return loadRecentInvoiceFingerprints().includes(fingerprint)
}

function InvoiceOcrProgress({ activeStep }: { activeStep: number }) {
  return (
    <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, textAlign: 'left' }}>
      {OCR_PROGRESS_STEPS.map((label, idx) => {
        const active = idx === activeStep
        const done = idx < activeStep
        return (
          <li
            key={label}
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              color: active ? BRAND_ORANGE : done ? '#6b7280' : '#9ca3af',
              fontWeight: active ? 600 : 400,
            }}
          >
            {label}
          </li>
        )
      })}
    </ul>
  )
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
  created_at?: string
  updated_at?: string | null
}

type CardEditDraft = {
  name: string
  unit: string
  price: string
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
  const [operationData, setOperationData] = useState<IngredientsOperationData | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cardEdit, setCardEdit] = useState<CardEditDraft | null>(null)
  const [cardSavingId, setCardSavingId] = useState<string | null>(null)
  const operationLoadRef = useRef(0)
  const cardSaveInFlightRef = useRef(false)
  const invoiceCameraInputRef = useRef<HTMLInputElement>(null)
  const invoiceGalleryInputRef = useRef<HTMLInputElement>(null)
  const ocrStepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [invoiceImage, setInvoiceImage] = useState<File | null>(null)
  const [invoiceAnalyzeStatus, setInvoiceAnalyzeStatus] =
    useState<InvoiceAnalyzeStatus>('idle')
  const [ocrLoadingStep, setOcrLoadingStep] = useState(0)
  const [invoiceDate, setInvoiceDate] = useState<string | null>(null)
  const [invoiceSupplier, setInvoiceSupplier] = useState<InvoiceSupplier | null>(null)
  const [ocrIngredients, setOcrIngredients] = useState<OcrIngredientRow[]>([])
  const [invoiceDocument, setInvoiceDocument] =
    useState<InvoiceDocumentRuntime | null>(null)
  const [duplicateInvoiceWarning, setDuplicateInvoiceWarning] = useState(false)
  const [bulkRegisterSummary, setBulkRegisterSummary] = useState<{
    total: number
    newCount: number
    linkedCount: number
  } | null>(null)
  const [bulkRegisterError, setBulkRegisterError] = useState<string | null>(null)
  const [bulkRegistering, setBulkRegistering] = useState(false)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const i of list) {
      const c = (i.category ?? '').trim()
      if (c) set.add(c)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [list])

  const invoiceSupplierNames = operationData?.invoiceSupplierNames ?? []

  const refreshOperationData = useCallback(async () => {
    const token = ++operationLoadRef.current
    const res = await getIngredientsOperationData()
    if (token !== operationLoadRef.current) return
    if (res.success && res.data) {
      setOperationData(res.data)
    }
  }, [])

  useEffect(() => {
    void refreshOperationData()
  }, [refreshOperationData])

  const filtered = useMemo(() => {
    return list.filter((i) => {
      if (categoryFilter && (i.category ?? '') !== categoryFilter) return false
      return matchesIngredientSearch(i, query, invoiceSupplierNames)
    })
  }, [list, query, categoryFilter, invoiceSupplierNames])

  const sortedFiltered = useMemo(() => {
    const meta = operationData?.metaByIngredient
    if (!meta) return filtered
    return [...filtered].sort((a, b) => {
      const da = meta[a.id]?.last_price_change_date ?? ''
      const db = meta[b.id]?.last_price_change_date ?? ''
      if (da !== db) return db.localeCompare(da)
      return a.name.localeCompare(b.name, 'ko')
    })
  }, [filtered, operationData])

  const operationInsights = operationData?.insights
  const recentOcrActivities = operationData?.recentOcrActivities ?? []

  const grouped = useMemo(() => {
    const map = new Map<string, Ingredient[]>()
    for (const i of sortedFiltered) {
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
  }, [sortedFiltered])

  const hasSearchQuery = query.trim().length > 0
  const showSearchEmpty = list.length > 0 && filtered.length === 0 && hasSearchQuery

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

  useEffect(() => {
    return () => {
      if (ocrStepTimerRef.current) {
        clearInterval(ocrStepTimerRef.current)
      }
    }
  }, [])

  function clearOcrStepTimer() {
    if (ocrStepTimerRef.current) {
      clearInterval(ocrStepTimerRef.current)
      ocrStepTimerRef.current = null
    }
  }

  function resetInvoiceFlow() {
    clearOcrStepTimer()
    setInvoiceImage(null)
    setInvoiceAnalyzeStatus('idle')
    setOcrLoadingStep(0)
    setInvoiceDate(null)
    setInvoiceSupplier(null)
    setOcrIngredients([])
    setDuplicateInvoiceWarning(false)
    setBulkRegisterSummary(null)
    setBulkRegisterError(null)
    setBulkRegistering(false)
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

  function removeOcrRow(rowKey: string) {
    setOcrIngredients((prev) => prev.filter((row) => row.rowKey !== rowKey))
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
        if (field === 'spec') {
          return {
            ...row,
            spec: normalizeInvoiceItemSpec(value),
          }
        }
        if (field === 'unit') {
          return { ...row, unit: sanitizeOcrUnitInput(value) }
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
    setBulkRegisterSummary(null)
    setBulkRegisterError(null)
  }

  function updateOcrEffectiveFrom(rowKey: string, value: string) {
    setOcrIngredients((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey ? { ...row, effectiveFrom: value } : row,
      ),
    )
    setBulkRegisterSummary(null)
    setBulkRegisterError(null)
  }

  function setOcrPriceAction(rowKey: string, action: 'apply' | 'keep') {
    setOcrIngredients((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey ? { ...row, priceAction: action } : row,
      ),
    )
    setBulkRegisterSummary(null)
    setBulkRegisterError(null)
  }

  async function handleInvoiceFileSelect(file: File | undefined) {
    if (!file) return
    clearOcrStepTimer()

    let uploadFile = file
    try {
      uploadFile = await compressImageForInvoiceOcr(file)
    } catch {
      uploadFile = file
    }

    setInvoiceImage(uploadFile)
    setInvoiceAnalyzeStatus('loading')
    setOcrLoadingStep(0)
    setInvoiceDate(null)
    setInvoiceSupplier(null)
    setOcrIngredients([])
    setInvoiceDocument(null)
    setDuplicateInvoiceWarning(false)
    setBulkRegisterSummary(null)
    setBulkRegisterError(null)

    ocrStepTimerRef.current = setInterval(() => {
      setOcrLoadingStep((prev) => (prev < 3 ? prev + 1 : prev))
    }, 550)

    try {
      const analysis = await analyzeInvoiceImageWithRaw(uploadFile)

      if (!analysis || analysis.result.items.length === 0) {
        setInvoiceAnalyzeStatus('failed')
        setOcrLoadingStep(0)
        return
      }

      const result = analysis.result
      const effDefault = defaultEffectiveFrom(result.invoice_date)
      const fingerprint = buildInvoiceFingerprint(
        result.invoice_date,
        result.supplier,
        result.items,
      )

      setOcrLoadingStep(4)
      await new Promise((resolve) => setTimeout(resolve, 280))

      setInvoiceDate(result.invoice_date)
      setInvoiceSupplier(result.supplier)
      setDuplicateInvoiceWarning(isDuplicateInvoiceFingerprint(fingerprint))
      if (result.supplier) {
        void upsertInvoiceSupplierFromOcr(result.supplier)
      }
      setOcrIngredients(
        result.items.map((item, idx) => ({
          ...item,
          spec: item.spec ?? null,
          rowKey: `ocr_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
          effectiveFrom: effDefault,
          priceAction: undefined,
        })),
      )
      setInvoiceDocument(
        buildInvoiceDocumentRuntime(
          result,
          null,
          analysis.ocr_raw_text,
        ),
      )
      void uploadInvoiceDocumentImage(uploadFile, result.invoice_date).then(
        (imagePath) => {
          if (!imagePath) return
          setInvoiceDocument((prev) =>
            prev
              ? { ...prev, image_path: imagePath }
              : buildInvoiceDocumentRuntime(result, imagePath, analysis.ocr_raw_text),
          )
        },
      )
      setInvoiceAnalyzeStatus('success')
    } catch {
      setInvoiceAnalyzeStatus('failed')
      setOcrLoadingStep(0)
    } finally {
      clearOcrStepTimer()
    }
  }

  function handleBulkRegister() {
    if (bulkRegistering || isPending) return

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
          unit: row.unit ?? '',
          price: row.price,
          memo: buildInvoiceMemo(
            row.quantity,
            row.unit,
            invoiceSupplier?.supplier_name,
            row.spec,
          ),
          mode,
          effective_from: row.effectiveFrom,
        }
      })

    if (rows.length === 0) return

    setBulkRegistering(true)
    setBulkRegisterError(null)
    setBulkRegisterSummary(null)

    let newCount = 0
    let linkedCount = 0
    for (const row of rows) {
      if (findCanonicalIngredient(list, row.name)) linkedCount += 1
      else newCount += 1
    }

    const fingerprint = buildInvoiceFingerprint(
      invoiceDate,
      invoiceSupplier,
      ocrIngredients,
    )

    startTr(async () => {
      try {
        const res = await registerInvoiceIngredients(rows)
        if (!res.success || !res.data) {
          setBulkRegisterError('등록에 실패했어요. 다시 시도해주세요.')
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
        if (successCount > 0 && fingerprint) {
          saveInvoiceFingerprint(fingerprint)
        }
        setBulkRegisterSummary({
          total: successCount,
          newCount,
          linkedCount,
        })
        if (successCount > 0) {
          void refreshOperationData()
          setTimeout(() => closeRegistration(), 2000)
        }
      } finally {
        setBulkRegistering(false)
      }
    })
  }

  function toggleExpand(ingredient: Ingredient) {
    if (expandedId === ingredient.id) {
      setExpandedId(null)
      setCardEdit(null)
      return
    }
    setExpandedId(ingredient.id)
    setCardEdit({
      name: ingredient.name,
      unit: ingredient.unit,
      price:
        ingredient.current_price != null ? String(ingredient.current_price) : '',
    })
  }

  function handleCardSave(ingredient: Ingredient) {
    if (!cardEdit || cardSavingId || cardSaveInFlightRef.current) return
    if (!cardEdit.name.trim() || !cardEdit.unit.trim()) return

    const priceNum = parseInt(cardEdit.price.replace(/,/g, ''), 10)
    const current_price = Number.isNaN(priceNum) ? null : priceNum
    const nameTrimmed = cardEdit.name.trim()
    const unitTrimmed = cardEdit.unit.trim()
    const priceUnchanged =
      (current_price == null && ingredient.current_price == null) ||
      current_price === ingredient.current_price
    if (
      nameTrimmed === ingredient.name &&
      unitTrimmed === ingredient.unit &&
      priceUnchanged
    ) {
      return
    }

    cardSaveInFlightRef.current = true
    setCardSavingId(ingredient.id)

    startTr(async () => {
      try {
        const res = await updateIngredient(ingredient.id, {
          name: nameTrimmed,
          unit: unitTrimmed,
          category: ingredient.category,
          current_price,
          target_price: ingredient.target_price,
          memo: ingredient.memo,
          barcode: ingredient.barcode,
        })
        if (!res.success) return

        setList((prev) =>
          prev.map((row) =>
            row.id === ingredient.id
              ? {
                  ...row,
                  name: nameTrimmed,
                  unit: unitTrimmed,
                  current_price,
                }
              : row,
          ),
        )
        await refreshOperationData()
      } finally {
        cardSaveInFlightRef.current = false
        setCardSavingId(null)
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
        void refreshOperationData()
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
        .ocr-row-delete:hover { background: #fee2e2 !important; color: #b91c1c !important; }
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
          placeholder="식자재·공급업체·단위 검색"
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

      {operationInsights ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 12,
          }}
        >
          {[
            {
              label: '최근 가격 변동',
              value: `${operationInsights.changed_last_7_days}개`,
            },
            {
              label: '급등 주의',
              value: `${operationInsights.spike_count}개`,
            },
            {
              label: '최근 거래명세서 등록',
              value: `${operationInsights.ocr_last_7_days}건`,
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: '#ffffff',
                border: '0.5px solid #ece8df',
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: BRAND_GREEN,
                  marginBottom: 4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {item.value}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {recentOcrActivities.length > 0 ? (
        <div
          style={{
            background: '#ffffff',
            border: '0.5px solid #ece8df',
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 8px' }}>
            최근 OCR 활동
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentOcrActivities.map((activity) => (
              <p
                key={`${activity.supplier_name}_${activity.ingredient_name}_${activity.occurred_at}`}
                style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.45 }}
              >
                {activity.supplier_name} 거래명세서 등록 ·{' '}
                {formatRelativeTime(activity.occurred_at)}
                {activity.ingredient_name
                  ? ` · ${activity.ingredient_name}`
                  : ''}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {showSearchEmpty ? (
        <div
          style={{
            textAlign: 'center',
            padding: '28px 16px',
            color: '#9ca3af',
            fontSize: 13,
            lineHeight: 1.55,
            marginBottom: 12,
          }}
        >
          검색 결과가 없습니다.
          <br />
          다른 식자재명이나 공급업체명으로 검색해보세요.
        </div>
      ) : null}

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
            ref={invoiceCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              handleInvoiceFileSelect(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <input
            ref={invoiceGalleryInputRef}
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
              <p style={{ fontSize: 14, fontWeight: 600, color: BRAND_ORANGE, margin: '0 0 4px' }}>
                {OCR_PROGRESS_STEPS[ocrLoadingStep]}
              </p>
              {invoiceImage && (
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px' }}>
                  {invoiceImage.name}
                </p>
              )}
              <InvoiceOcrProgress activeStep={ocrLoadingStep} />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => invoiceCameraInputRef.current?.click()}
                  disabled={isPending}
                  style={{
                    flex: 1,
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
                  }}
                >
                  사진 찍기
                </button>
                <button
                  type="button"
                  onClick={() => invoiceGalleryInputRef.current?.click()}
                  disabled={isPending}
                  style={{
                    flex: 1,
                    padding: 13,
                    background: '#ffffff',
                    color: '#374151',
                    border: '0.5px solid #e8e5de',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: isPending ? 0.65 : 1,
                  }}
                >
                  갤러리에서 선택
                </button>
              </div>

              {invoiceAnalyzeStatus === 'failed' && (
                <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6, margin: '0 0 12px' }}>
                  거래명세서를 읽지 못했어요.
                  <br />
                  직접 입력을 이용해주세요.
                </p>
              )}

              {invoiceAnalyzeStatus === 'success' && ocrIngredients.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, margin: '0 0 10px' }}>
                    <span style={{ fontWeight: 800, color: '#374151' }}>검토 후 저장</span>
                    <br />
                    OCR은 읽기만 하며, 확인·수정 후에만 식자재·가격 데이터에 반영돼요.
                    <br />
                    거래명세서 상태에 따라 일부 인식이 달라질 수 있어요.
                  </p>
                  {invoiceDocument?.image_path && (
                    <p style={{ fontSize: 11, color: '#1f5d3a', margin: '0 0 10px' }}>
                      원본 명세서 이미지가 저장되었습니다.
                    </p>
                  )}
                  {duplicateInvoiceWarning && (
                    <p
                      style={{
                        fontSize: 12,
                        color: BRAND_ORANGE,
                        background: '#fff8f3',
                        border: `0.5px solid ${BRAND_ORANGE}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                        lineHeight: 1.5,
                        margin: '0 0 10px',
                      }}
                    >
                      최근 등록한 거래명세서와 매우 유사합니다.
                      <br />
                      중복 등록이 아닌지 확인해주세요.
                    </p>
                  )}
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
                            position: 'relative',
                            background: priceChanged ? '#fff7ed' : '#ffffff',
                            border: priceChanged
                              ? `1px solid ${BRAND_ORANGE}`
                              : '0.5px solid #e8e5de',
                            borderRadius: 12,
                            padding: 12,
                          }}
                        >
                          <button
                            type="button"
                            aria-label="이 행 삭제"
                            onClick={() => removeOcrRow(row.rowKey)}
                            className="ocr-row-delete"
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              border: 'none',
                              background: '#e5e7eb',
                              color: '#6b7280',
                              fontSize: 16,
                              lineHeight: 1,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                            }}
                          >
                            ×
                          </button>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap', paddingRight: 32 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: '#2b2b2b', margin: '0 0 4px' }}>
                                {formatInvoiceItemDisplayTitle(row.name, row.spec)}
                              </p>
                              <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                                {row.quantity != null ? `${row.quantity}` : '-'}
                                {row.unit ? ` ${row.unit}` : ''}
                                {' · '}
                                {row.price != null ? formatKRW(row.price) : '공급가 미입력'}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                              {priceChanged && (
                                <span
                                  style={{
                                    background: '#fff8f3',
                                    color: BRAND_ORANGE,
                                    borderRadius: 999,
                                    padding: '3px 8px',
                                    fontSize: 10,
                                    fontWeight: 500,
                                  }}
                                >
                                  가격 변경
                                </span>
                              )}
                            </div>
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
                          <input
                            value={row.spec ?? ''}
                            onChange={(e) => updateOcrRow(row.rowKey, 'spec', e.target.value)}
                            placeholder="규격 (예: 14KG, 1.8L/10)"
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
                      bulkRegistering ||
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
                      cursor:
                        bulkRegistering || isPending ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      opacity: bulkRegistering || isPending ? 0.6 : 1,
                    }}
                  >
                    {bulkRegistering || isPending
                      ? '등록 중...'
                      : '식자재 한번에 등록'}
                  </button>
                  {bulkRegisterError && (
                    <p style={{ fontSize: 13, color: '#b45309', textAlign: 'center', marginTop: 10, fontWeight: 500 }}>
                      {bulkRegisterError}
                    </p>
                  )}
                  {bulkRegisterSummary && (
                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: BRAND_GREEN, margin: '0 0 4px' }}>
                        식자재 {bulkRegisterSummary.total}개 등록 완료
                      </p>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                        신규 {bulkRegisterSummary.newCount}개 · 기존 연결 {bulkRegisterSummary.linkedCount}개
                      </p>
                    </div>
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
      ) : showSearchEmpty ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grouped.map((g) => (
            <div key={g.category}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#374151', margin: '12px 0 8px' }}>
                {g.category} · {g.items.length}개
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.items.map((i) => {
                  const expanded = expandedId === i.id
                  const history =
                    operationData?.priceHistoryByIngredient[i.id] ?? []
                  const meta = operationData?.metaByIngredient[i.id]
                  const supplierComparison =
                    operationData?.supplierComparisonByIngredient[i.id] ?? []
                  const recentSupplier = parseSupplierFromMemo(i.memo)
                  const lastPriceChange =
                    meta?.last_price_change_date ?? history[0]?.effective_from ?? null
                  const regLabel = inferRegistrationLabel(i.memo, i.barcode)
                  const ocrRelative =
                    (i.memo ?? '').includes('거래명세서 OCR') && i.updated_at
                      ? formatRelativeDays(i.updated_at)
                      : null
                  const spike =
                    meta?.is_spike_risk && history.length >= 2
                      ? { previous: history[1].price, current: history[0].price }
                      : null
                  const priceChangeIndicator = formatPriceChangeIndicator(meta)
                  const editingThis = expanded && cardEdit

                  return (
                    <div
                      key={i.id}
                      style={{
                        background: '#fff',
                        borderRadius: 12,
                        border: '0.5px solid #e8e5de',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpand(i)}
                        style={{
                          width: '100%',
                          padding: 14,
                          background: 'transparent',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                                marginBottom: 6,
                              }}
                            >
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#2b2b2b' }}>
                                {i.name}
                              </span>
                              {meta?.is_spike_risk ? (
                                <span
                                  style={{
                                    background: '#fff7ed',
                                    color: BRAND_ORANGE,
                                    borderRadius: 999,
                                    padding: '3px 8px',
                                    fontSize: 10,
                                    fontWeight: 600,
                                  }}
                                >
                                  가격 급등
                                </span>
                              ) : null}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 17, fontWeight: 600, color: BRAND_GREEN, fontVariantNumeric: 'tabular-nums' }}>
                                {i.current_price != null ? formatKRW(i.current_price) : '가격 미입력'}
                              </span>
                              {priceChangeIndicator ? (
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: priceChangeIndicator.color,
                                  }}
                                >
                                  {priceChangeIndicator.label}
                                </span>
                              ) : null}
                              <span style={{ fontSize: 11, color: '#6b7280' }}>{i.unit}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {recentSupplier ? (
                                <span style={{ fontSize: 11, color: '#6b7280' }}>
                                  최근 공급업체 · {recentSupplier}
                                </span>
                              ) : null}
                              {lastPriceChange ? (
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                                  {formatDateLabel(lastPriceChange)} 가격변경
                                </span>
                              ) : null}
                              {ocrRelative ? (
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                                  OCR 등록 {ocrRelative}
                                </span>
                              ) : null}
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>{regLabel}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>
                            {expanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </button>

                      {expanded ? (
                        <div style={{ padding: '0 14px 14px' }}>
                          {spike ? (
                            <div
                              style={{
                                background: '#fff7ed',
                                border: '0.5px solid #F97316',
                                borderRadius: 12,
                                padding: 10,
                                marginBottom: 10,
                              }}
                            >
                              <p style={{ fontSize: 12, fontWeight: 600, color: '#c2410c', margin: '0 0 4px' }}>
                                최근 공급가가 크게 상승했습니다.
                              </p>
                              <p style={{ fontSize: 12, color: '#9a3412', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                                {formatKRW(spike.previous)} → {formatKRW(spike.current)}
                              </p>
                            </div>
                          ) : null}

                          {supplierComparison.length > 0 ? (
                            <div
                              style={{
                                background: '#f7f6f2',
                                borderRadius: 12,
                                padding: 12,
                                marginTop: 10,
                                marginBottom: 10,
                              }}
                            >
                              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 4px' }}>
                                최근 공급업체 가격 비교
                              </p>
                              {supplierComparison.map((row, idx) => (
                                <div
                                  key={`${row.supplier_name}_${row.effective_from}`}
                                  style={{
                                    padding: '8px 0',
                                    borderBottom:
                                      idx < supplierComparison.length - 1
                                        ? '0.5px solid #ece8df'
                                        : 'none',
                                  }}
                                >
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2b2b2b', marginBottom: 2 }}>
                                    {row.supplier_name}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                    <span
                                      style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: BRAND_GREEN,
                                        fontVariantNumeric: 'tabular-nums',
                                      }}
                                    >
                                      {formatKRW(row.price)}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                                      {formatDateLabel(row.effective_from)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {recentSupplier && history.length > 0 ? (
                            <div style={{ marginBottom: 10 }}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 6px' }}>
                                {recentSupplier} 기준 가격 흐름
                              </p>
                              {history.slice(0, 5).map((row) => (
                                <div
                                  key={`flow_${row.effective_from}_${row.created_at}`}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: 12,
                                    color: '#374151',
                                    padding: '4px 0',
                                  }}
                                >
                                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                                    {formatDateLabel(row.effective_from)}
                                  </span>
                                  <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                                    {formatKRW(row.price)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {history.length > 0 ? (
                            <div style={{ marginBottom: 12 }}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 4px' }}>
                                최근 가격 히스토리
                              </p>
                              {history.map((row, histIdx) => {
                                const prevRow = history[histIdx + 1]
                                let rowChange: { label: string; color: string } | null = null
                                if (prevRow && prevRow.price > 0) {
                                  const delta = Math.round(
                                    ((row.price - prevRow.price) / prevRow.price) * 100,
                                  )
                                  if (delta !== 0) {
                                    rowChange = {
                                      label: `${delta > 0 ? '▲' : '▼'} ${delta > 0 ? '+' : ''}${delta}%`,
                                      color: delta > 0 ? BRAND_ORANGE : '#2563eb',
                                    }
                                  }
                                }
                                return (
                                  <div
                                    key={`hist_${row.effective_from}_${row.created_at}`}
                                    style={{
                                      borderTop: '0.5px solid #f0ede7',
                                      paddingTop: 8,
                                      paddingBottom: 8,
                                    }}
                                  >
                                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
                                      {formatDateLabel(row.effective_from)}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                                        {formatKRW(row.price)}
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {rowChange ? (
                                          <span style={{ fontSize: 11, fontWeight: 600, color: rowChange.color }}>
                                            {rowChange.label}
                                          </span>
                                        ) : null}
                                        {row.supplier_name ? (
                                          <span style={{ fontSize: 11, color: '#6b7280' }}>{row.supplier_name}</span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px' }}>
                              아직 가격 히스토리가 없습니다.
                            </p>
                          )}

                          {editingThis ? (
                            <div style={{ marginBottom: 10 }}>
                              <FormLabel required>식자재명</FormLabel>
                              <input
                                value={cardEdit.name}
                                onChange={(e) =>
                                  setCardEdit((prev) =>
                                    prev ? { ...prev, name: e.target.value } : prev,
                                  )
                                }
                                style={{ ...INPUT_STYLE, marginBottom: 8 }}
                              />
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                <div>
                                  <FormLabel required>공급가</FormLabel>
                                  <input
                                    value={cardEdit.price}
                                    onChange={(e) =>
                                      setCardEdit((prev) =>
                                        prev ? { ...prev, price: e.target.value } : prev,
                                      )
                                    }
                                    inputMode="numeric"
                                    style={INPUT_STYLE}
                                  />
                                </div>
                                <div>
                                  <FormLabel required>단위</FormLabel>
                                  <select
                                    value={cardEdit.unit}
                                    onChange={(e) =>
                                      setCardEdit((prev) =>
                                        prev ? { ...prev, unit: e.target.value } : prev,
                                      )
                                    }
                                    style={INPUT_STYLE}
                                  >
                                    {UNITS.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={!!cardSavingId || isPending}
                                onClick={() => handleCardSave(i)}
                                style={{
                                  width: '100%',
                                  padding: 11,
                                  background: cardSavingId ? '#9ca3af' : BRAND_GREEN,
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: cardSavingId ? 'not-allowed' : 'pointer',
                                  fontFamily: 'inherit',
                                }}
                              >
                                {cardSavingId === i.id ? '저장 중...' : '변경 저장'}
                              </button>
                            </div>
                          ) : null}

                          <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 10px', lineHeight: 1.45 }}>
                            가격과 단위 변경 이력은 자동 저장됩니다.
                          </p>

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => openEdit(i)}
                              style={{
                                flex: 1,
                                padding: '8px 10px',
                                background: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                borderRadius: 8,
                                fontSize: 11,
                                color: '#1D4ED8',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontFamily: 'inherit',
                              }}
                            >
                              상세 수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(i.id)}
                              style={{
                                padding: '8px 10px',
                                background: '#FEF2F2',
                                border: '1px solid #FCA5A5',
                                borderRadius: 8,
                                fontSize: 11,
                                color: '#B91C1C',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontFamily: 'inherit',
                              }}
                            >
                              비활성화
                            </button>
                          </div>
                        </div>
                      ) : null}
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
