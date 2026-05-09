'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { lookupBarcode, recognizeProductFromImage } from '@/actions/barcode'
import BarcodeScanner from '@/components/product/BarcodeScanner'

export type IngredientBarcodeApplyHints = {
  name?: string
  unit?: string
  category?: string
  memo?: string
  barcode?: string
  current_price?: string
}

const UNITS_ORDER = ['kg', 'g', '개', '봉', 'L', '박스', '팩'] as const

function guessUnitFromText(text: string | null | undefined): string | undefined {
  if (!text) return undefined
  const t = text.toLowerCase()
  if (/\bml\b|밀리|mℓ/.test(t)) return 'L'
  if (/\d\s*l\b|리터|ℓ/.test(t)) return 'L'
  if (/kg|킬로|키로/.test(t)) return 'kg'
  if (/\d\s*g\b|그람|g\b/.test(t)) return 'g'
  if (/박스/.test(t)) return '박스'
  if (/팩/.test(t)) return '팩'
  if (/봉/.test(t)) return '봉'
  if (/개/.test(t)) return '개'
  return undefined
}

export default function IngredientBarcodeSection({ onApply }: { onApply: (h: IngredientBarcodeApplyHints) => void }) {
  const [scanOpen, setScanOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const lastDetectRef = useRef(0)

  const runLookup = useCallback(
    (code: string) => {
      const c = code.replace(/\D/g, '')
      if (c.length < 8) {
        setMsg('바코드 숫자를 8자리 이상 입력해 주세요.')
        return
      }
      setMsg(null)
      startTransition(async () => {
        const r = await lookupBarcode(c)
        if (r.ok) {
          const memoParts = [r.manufacturer ? `제조사: ${r.manufacturer}` : null, r.ingredients_text, r.item_report_number ? `품목보고: ${r.item_report_number}` : null].filter(
            Boolean,
          )
          onApply({
            name: r.name ?? undefined,
            barcode: r.barcode,
            category: r.category ?? undefined,
            memo: memoParts.length ? memoParts.join('\n\n') : undefined,
          })
          setMsg('조회되었습니다. 확인 후 저장하세요.')
          setScanOpen(false)
        } else {
          setMsg(r.error ?? '등록된 정보가 없습니다. 직접 입력해 주세요.')
          onApply({ barcode: c })
        }
      })
    },
    [onApply],
  )

  const onQuaggaDetect = useCallback(
    (digits: string) => {
      const now = Date.now()
      if (now - lastDetectRef.current < 2000) return
      lastDetectRef.current = now
      runLookup(digits)
    },
    [runLookup],
  )

  function onVisionFile(file: File | undefined) {
    if (!file) return
    setMsg(null)
    const fd = new FormData()
    fd.set('image', file)
    startTransition(async () => {
      const r = await recognizeProductFromImage(fd)
      if (!r.ok || !r.data) {
        setMsg(r.error ?? '사진 인식에 실패했습니다. 직접 입력해 주세요.')
        return
      }
      const d = r.data
      const u = guessUnitFromText(d.unit) ?? UNITS_ORDER[0]
      const name =
        d.name && d.unit && !d.name.includes(String(d.unit)) ? `${d.name} (${d.unit})` : d.name ?? undefined
      const memoParts = [d.manufacturer ? `제조사: ${d.manufacturer}` : null, d.ingredients_text, d.raw_notes].filter(Boolean)
      onApply({
        name: name ?? undefined,
        unit: u,
        barcode: d.barcode ?? undefined,
        memo: memoParts.length ? memoParts.join('\n\n') : undefined,
        current_price: d.price_won != null ? String(d.price_won) : undefined,
      })
      setMsg('사진에서 추출했습니다. 확인 후 저장하세요.')
      setScanOpen(false)
    })
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 14, background: '#fff' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#374151', margin: '0 0 8px' }}>바코드 스캔 · 사진 인식</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => {
            setScanOpen((v) => !v)
            setMsg(null)
          }}
          style={{
            padding: '8px 12px',
            background: scanOpen ? '#374151' : 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {scanOpen ? '카메라 닫기' : '카메라로 스캔'}
        </button>
        <label style={{ fontSize: 11, color: '#6b7280' }}>
          사진으로 인식{' '}
          <input
            type="file"
            accept="image/*"
            disabled={pending}
            onChange={(e) => {
              onVisionFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {scanOpen && <BarcodeScanner active={scanOpen} onDetected={onQuaggaDetect} onInitError={(m) => setMsg(m)} />}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <input
          style={{
            flex: 1,
            minWidth: 140,
            padding: '8px 10px',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontSize: 13,
          }}
          inputMode="numeric"
          placeholder="바코드 번호"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
          disabled={pending}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => runLookup(manualCode)}
          style={{
            padding: '8px 14px',
            background: pending ? '#9ca3af' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          조회
        </button>
      </div>
      {msg && (
        <p style={{ fontSize: 11, color: msg.includes('없습니다') || msg.includes('실패') ? '#b45309' : '#15803d', margin: '8px 0 0' }}>{msg}</p>
      )}
      <p style={{ fontSize: 10, color: '#9ca3af', margin: '6px 0 0' }}>
        API: 환경변수 <code>FOOD_SAFETY_API_KEY</code> · 사진: <code>ANTHROPIC_API_KEY</code>
      </p>
    </div>
  )
}
