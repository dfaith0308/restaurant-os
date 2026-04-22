'use client'

// ============================================================
// TodayImportCard
//
// 자동 수집 레이어의 UI 진입점.
// 업로드 → mock parse → 미리보기 → AI 판단 뱃지 → 확정 → revalidate
// 페이지 이동 0회. loop_input 상태에서 보조 카드로 렌더된다.
// ============================================================

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  mockParseInvoice,
  mockParseProductBack,
  type ParsedInvoice,
  type ParsedInvoiceRow,
  type ParsedProductBack,
} from '@/lib/mock-parser'
import { importIngredients, registerSku, type ImportResult } from '@/actions/import'
import { aiEvaluatePrice, decisionTone, type Decision } from '@/lib/ai-evaluate'
import { logTodayEvent } from '@/actions/today-events'
import { getOrCreateSessionId, timeSinceEnter, resetEnterTs } from '@/lib/today-events'
import { formatKRW } from '@/lib/utils'

interface Props {
  restaurantId: string
  // emphasize=true 일 때: 제품 뒷면 모드로 기본 진입, SKU 유도 카피로 전환
  emphasize?:   boolean
}

type Mode  = 'invoice' | 'product_back'
type Phase = 'idle' | 'preview' | 'done' | 'sku_preview' | 'sku_done'

export default function TodayImportCard({ restaurantId, emphasize = false }: Props) {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [isPending, startTr] = useTransition()
  const [mode,  setMode]    = useState<Mode>(emphasize ? 'product_back' : 'invoice')
  const [phase, setPhase]   = useState<Phase>('idle')
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null)
  const [skuParsed, setSkuParsed] = useState<ParsedProductBack | null>(null)
  const [skuCreated, setSkuCreated] = useState<boolean>(false)
  const [selected, setSelected] = useState<boolean[]>([])   // 행별 체크 상태
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error,  setError]  = useState<string | null>(null)

  // 각 행의 AI 판정 (파싱 직후 1번만 계산해서 셀렉션 로직에 재사용)
  const rowEvals = useMemo(() => {
    if (!parsed) return []
    return parsed.rows.map(r => aiEvaluatePrice(r.name, r.unit, r.unit_price))
  }, [parsed])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)

    if (mode === 'product_back') {
      // 제품 뒷면 이미지 → 단일 SKU 추출
      const sku = mockParseProductBack({ name: f.name, size: f.size })
      setSkuParsed(sku)
      setPhase('sku_preview')
    } else {
      // 명세서 → 여러 행 파싱
      const p = mockParseInvoice({ name: f.name, size: f.size })
      setParsed(p)
      setSelected(p.rows.map(() => true))   // 기본 전체 선택
      setPhase('preview')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleSkuConfirm() {
    if (!skuParsed) return
    setError(null)
    startTr(async () => {
      const res = await registerSku({
        restaurant_id: restaurantId,
        name:          skuParsed.name,
        parsed_name:   skuParsed.parsed_name,
        brand:         skuParsed.brand,
        unit:          skuParsed.unit,
        barcode:       skuParsed.barcode,
        manufacturer:  skuParsed.manufacturer,
      })
      if (!res.success || !res.data) { setError(res.error ?? '실패'); return }
      setSkuCreated(res.data.created)
      setPhase('sku_done')
      const sid = getOrCreateSessionId()
      if (sid) {
        logTodayEvent({
          restaurant_id: restaurantId, session_id: sid,
          event_type: 'action_complete', action_kind: 'sku',
          time_to_action_ms: timeSinceEnter(),
        })
        resetEnterTs()
      }
      router.refresh()
    })
  }

  function toggleRow(i: number) {
    setSelected(prev => prev.map((v, idx) => idx === i ? !v : v))
  }
  function selectAll() {
    setSelected(prev => prev.map(() => true))
  }
  function selectSwitchOnly() {
    setSelected(rowEvals.map(ev => ev.decision === 'SWITCH'))
  }

  function handleConfirm() {
    if (!parsed) return
    const chosen = parsed.rows.filter((_, i) => selected[i])
    if (chosen.length === 0) {
      setError('저장할 항목이 없어요 — 하나 이상 선택해주세요')
      return
    }
    setError(null)
    startTr(async () => {
      const res = await importIngredients(
        restaurantId,
        chosen.map(r => ({
          name:          r.name,
          unit:          r.unit,
          current_price: r.unit_price,
          supplier_name: r.supplier_name,
          // SKU 레이어 — 파싱 결과에 있으면 같이 전달
          parsed_name:   r.parsed_name  ?? null,
          brand:         r.brand        ?? null,
          barcode:       r.barcode      ?? null,
          manufacturer:  r.manufacturer ?? null,
        })),
      )
      if (!res.success || !res.data) { setError(res.error ?? '실패'); return }
      setResult(res.data)
      setPhase('done')
      const sid = getOrCreateSessionId()
      if (sid) {
        logTodayEvent({
          restaurant_id: restaurantId, session_id: sid,
          event_type: 'action_complete', action_kind: 'sku',
          time_to_action_ms: timeSinceEnter(),
        })
        resetEnterTs()
      }
      router.refresh()
    })
  }

  function handleReset() {
    setParsed(null)
    setSkuParsed(null)
    setSkuCreated(false)
    setSelected([])
    setResult(null)
    setPhase('idle')
    setError(null)
  }

  const selectedCount = selected.filter(Boolean).length
  const switchCount   = rowEvals.filter(e => e.decision === 'SWITCH').length

  // ── 렌더 ───────────────────────────────────────────────────

  if (phase === 'idle') {
    const headline = emphasize && mode === 'product_back'
      ? '사진 올리면 더 정확하게 추천됩니다'
      : mode === 'invoice'
        ? '거래명세표를 올려주시면 한번에 들어가요'
        : '제품 뒷면 사진을 올리면 SKU가 자동 등록돼요'
    const sub = emphasize && mode === 'product_back'
      ? '지금은 이름만 기반이라 판단 정확도가 낮아요 · 제품 뒷면 한 번만 찍어주세요'
      : mode === 'invoice'
        ? '사진이나 PDF 모두 가능 · 올리는 즉시 AI가 비싼 품목을 골라드려요'
        : '브랜드 / 용량 / 바코드가 추출돼 같은 제품끼리 정확히 비교됩니다'
    const btnLabel = mode === 'invoice' ? '📄 명세서 선택' : '📦 제품 뒷면 사진'

    return (
      <div style={emphasize ? cardEmphasized : card}>
        <Tag tone={emphasize ? 'warn' : undefined}>
          {emphasize ? '정확도 올리기' : '자동 입력'}
        </Tag>

        {/* 모드 토글 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, marginBottom: 4 }}>
          <ModeBtn active={mode === 'invoice'}      onClick={() => { setMode('invoice');      setError(null) }}>
            명세서
          </ModeBtn>
          <ModeBtn active={mode === 'product_back'} onClick={() => { setMode('product_back'); setError(null) }}>
            제품 뒷면 사진
          </ModeBtn>
        </div>

        <Headline>{headline}</Headline>
        <Sub>{sub}</Sub>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            ...primaryBtn,
            marginTop: 14,
            width: '100%',
            background: '#fff',
            color: '#111827',
            border: '1.5px dashed #9ca3af',
          }}>
          {btnLabel}
        </button>
        {error && <ErrorMsg>{error}</ErrorMsg>}
      </div>
    )
  }

  // ── 제품 뒷면 사진 — SKU 프리뷰 ─────────────────────────────
  if (phase === 'sku_preview' && skuParsed) {
    return (
      <div style={card}>
        <Tag>SKU 인식 결과</Tag>
        <Headline>{skuParsed.brand} · {skuParsed.parsed_name}</Headline>
        <Sub>바코드 {skuParsed.barcode} — 맞는지 한번 확인해주세요</Sub>

        <div style={{
          marginTop: 12, padding: '12px 14px',
          background: '#F9FAFB', border: '1px solid #e5e7eb',
          borderRadius: 10, fontSize: 13, color: '#374151', lineHeight: 1.8,
        }}>
          <div><span style={skuLabel}>raw 이름</span> {skuParsed.name}</div>
          <div><span style={skuLabel}>정식 품목명</span> {skuParsed.parsed_name}</div>
          <div><span style={skuLabel}>브랜드</span> {skuParsed.brand}</div>
          <div><span style={skuLabel}>용량 단위</span> {skuParsed.unit}</div>
          <div><span style={skuLabel}>제조사</span> {skuParsed.manufacturer}</div>
          <div><span style={skuLabel}>바코드</span> <code>{skuParsed.barcode}</code></div>
        </div>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="button" onClick={handleReset} style={secondaryBtn}>취소</button>
          <button
            type="button"
            onClick={handleSkuConfirm}
            disabled={isPending}
            style={{
              ...primaryBtn, flex: 2,
              background: isPending ? '#d1d5db' : '#111827',
            }}>
            {isPending ? '저장 중...' : 'SKU 등록'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'sku_done' && skuParsed) {
    return (
      <div style={card}>
        <Tag tone="good">완료</Tag>
        <Headline>
          ✓ 완료됐어요 · 잘 처리하셨어요
        </Headline>
        <Sub>
          {skuCreated ? '새 SKU 가 등록됐어요. ' : '기존 SKU 에 정보가 보강됐어요. '}
          {skuParsed.brand} · {skuParsed.parsed_name} · 바코드 {skuParsed.barcode}
          {' '}— 이제 같은 제품끼리만 가격이 비교됩니다.
        </Sub>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="button" onClick={handleReset} style={{ ...primaryBtn, flex: 1 }}>
            또 올리기
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'preview' && parsed) {
    const selectedTotal = parsed.rows.reduce(
      (s, r, i) => selected[i] ? s + r.unit_price * r.quantity : s,
      0,
    )
    return (
      <div style={card}>
        <Tag>미리보기</Tag>
        <Headline>{parsed.supplier_name} · {parsed.invoice_date}</Headline>
        <Sub>
          총 {parsed.rows.length}건
          {switchCount > 0 && ` · AI가 ${switchCount}건 SWITCH 추천`}
          {' '}— 저장할 항목을 선택하세요
        </Sub>

        {/* 빠른 선택 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <QuickBtn active={selectedCount === parsed.rows.length} onClick={selectAll}>
            전체
          </QuickBtn>
          <QuickBtn
            active={switchCount > 0 && selectedCount === switchCount &&
                    rowEvals.every((e, i) => (e.decision === 'SWITCH') === selected[i])}
            onClick={selectSwitchOnly}
            disabled={switchCount === 0}>
            바꿔야 할 항목만 ({switchCount})
          </QuickBtn>
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {parsed.rows.map((r, i) => (
            <PreviewRow
              key={i}
              row={r}
              decision={rowEvals[i].decision}
              confidence={rowEvals[i].confidence}
              avgPrice={rowEvals[i].base.avg_price}
              checked={selected[i]}
              onToggle={() => toggleRow(i)}
            />
          ))}
        </div>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="button" onClick={handleReset} style={secondaryBtn}>취소</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || selectedCount === 0}
            style={{
              ...primaryBtn,
              flex: 2,
              background: (isPending || selectedCount === 0) ? '#d1d5db' : '#111827',
            }}>
            {isPending
              ? '저장 중...'
              : selectedCount === 0
                ? '선택된 항목 없음'
                : `${selectedCount}건 저장 · ${formatKRW(selectedTotal)}`
            }
          </button>
        </div>
      </div>
    )
  }

  // done
  if (phase === 'done' && result) {
    return (
      <div style={card}>
        <Tag tone="good">완료</Tag>
        <Headline>✓ 완료됐어요 · 잘 처리하셨어요</Headline>
        <Sub>
          {result.created}건 추가
          {result.updated > 0 && ` · ${result.updated}건 가격 갱신`}
          {result.supplier_seeded && ' · 거래처 자동 추가'}
          {'. '}비싼 품목이 있으면 오늘 카드 위쪽에 올라와요.
        </Sub>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="button" onClick={handleReset} style={{ ...primaryBtn, flex: 1 }}>
            또 올리기
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ── 미리보기 행: 체크박스 + 품목 + AI decision 뱃지 ──────────

function PreviewRow({
  row, decision, confidence, avgPrice, checked, onToggle,
}: {
  row:        ParsedInvoiceRow
  decision:   Decision
  confidence: number
  avgPrice:   number
  checked:    boolean
  onToggle:   () => void
}) {
  const tone = decisionTone(decision)
  const hasSku = !!(row.brand || row.barcode)

  return (
    <label style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 12px',
      background: checked ? '#fff' : '#F9FAFB',
      border: `1px solid ${checked ? '#111827' : '#e5e7eb'}`,
      borderRadius: 10, cursor: 'pointer',
      transition: 'border-color 0.15s',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{
          width: 18, height: 18, margin: '0 12px 0 0',
          accentColor: '#111827', cursor: 'pointer',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
          {row.name} <span style={{ fontWeight: 400, color: '#9ca3af' }}>× {row.quantity}{row.unit}</span>
        </div>
        {hasSku && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.4 }}>
            {row.brand && <strong>{row.brand}</strong>}
            {row.brand && row.parsed_name ? ' · ' : ''}
            {row.parsed_name}
            {row.barcode && (
              <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>
                바코드 {row.barcode}
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
          단위 {formatKRW(row.unit_price)} / {row.unit}
          {avgPrice > 0 && <> · 평균 {formatKRW(avgPrice)}</>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, marginLeft: 8 }}>
        <div style={{
          padding: '3px 9px', borderRadius: 20,
          fontSize: 10, fontWeight: 700,
          background: tone.bg, color: tone.fg,
          whiteSpace: 'nowrap',
        }}>
          {tone.short} {Math.round(confidence * 100)}%
        </div>
        {row.barcode && (
          <div style={{
            padding: '2px 6px', borderRadius: 10,
            fontSize: 9, fontWeight: 600,
            background: '#EFF6FF', color: '#1D4ED8',
            whiteSpace: 'nowrap',
          }}>
            SKU 정확
          </div>
        )}
      </div>
    </label>
  )
}

function ModeBtn({
  active, onClick, children,
}: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '6px 10px',
        fontSize: 12, fontWeight: 600,
        borderRadius: 8, cursor: 'pointer',
        background: active ? '#111827' : '#fff',
        color:      active ? '#fff'    : '#6b7280',
        border:     active ? 'none'    : '1px solid #e5e7eb',
        fontFamily: 'inherit',
      }}>
      {children}
    </button>
  )
}

const skuLabel: React.CSSProperties = {
  display: 'inline-block', width: 96, color: '#6b7280', fontSize: 11,
}

function QuickBtn({
  active, onClick, disabled, children,
}: {
  active?: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px',
        fontSize: 12, fontWeight: 600,
        borderRadius: 20, cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? '#111827' : '#fff',
        color:      active ? '#fff'    : disabled ? '#d1d5db' : '#374151',
        border:     active ? 'none'    : '1px solid #e5e7eb',
        fontFamily: 'inherit',
      }}>
      {children}
    </button>
  )
}

// ── UI 조각 ────────────────────────────────────────────────

function Tag({ children, tone }: { children: React.ReactNode; tone?: 'good' | 'warn' }) {
  const c = tone === 'good'
    ? { bg: '#ECFDF5', fg: '#059669' }
    : tone === 'warn'
    ? { bg: '#FEF2F2', fg: '#B91C1C' }
    : { bg: '#EFF6FF', fg: '#1D4ED8' }
  return (
    <div style={{
      display: 'inline-block', padding: '3px 10px',
      background: c.bg, color: c.fg,
      borderRadius: 20, fontSize: 11, fontWeight: 600, marginBottom: 8,
    }}>{children}</div>
  )
}

function Headline({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1.35 }}>{children}</div>
}
function Sub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 1.5 }}>{children}</div>
}
function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 10, padding: '8px 12px',
      background: '#FEF2F2', border: '1px solid #FCA5A5',
      borderRadius: 8, fontSize: 12, color: '#B91C1C',
    }}>{children}</div>
  )
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16,
  border: '1px solid #e5e7eb', padding: '18px 20px',
}

const cardEmphasized: React.CSSProperties = {
  background: '#FFFBEB', borderRadius: 16,
  border: '1.5px solid #FCA5A5', padding: '18px 20px',
}

const primaryBtn: React.CSSProperties = {
  padding: '13px', color: '#fff',
  border: 'none', borderRadius: 12,
  fontSize: 14, fontWeight: 700,
  fontFamily: 'inherit', cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  flex: 1, padding: '13px',
  background: '#fff', color: '#374151',
  border: '1px solid #e5e7eb', borderRadius: 12,
  fontSize: 14, fontWeight: 600,
  fontFamily: 'inherit', cursor: 'pointer',
}
