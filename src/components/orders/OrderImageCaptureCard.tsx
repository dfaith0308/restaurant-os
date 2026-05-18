'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  captureOperationalOrder,
  extractOrderTextFromImage,
  previewOrderBodyParse,
} from '@/actions/orders'
import type { OrderParsedLine } from '@/types'

const BRAND_ORANGE = '#F97316'

type Step = 'idle' | 'analyzing' | 'review' | 'failed'

function imageFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

export default function OrderImageCaptureCard() {
  const router = useRouter()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  const [step, setStep] = useState<Step>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [counterparty, setCounterparty] = useState('')
  const [body, setBody] = useState('')
  const [parsedPreview, setParsedPreview] = useState<OrderParsedLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFp, setLastFp] = useState<{ fp: string; at: number } | null>(null)

  function resetToIdle() {
    setStep('idle')
    setFileName(null)
    setBody('')
    setParsedPreview(null)
    setError(null)
  }

  async function runOcr(file: File) {
    const fp = imageFingerprint(file)
    const now = Date.now()
    if (lastFp && lastFp.fp === fp && now - lastFp.at < 30000) {
      setError('같은 이미지는 30초 후에 다시 분석할 수 있어요')
      return
    }

    setError(null)
    setStep('analyzing')
    setFileName(file.name)

    const fd = new FormData()
    fd.append('image', file)

    const ocrRes = await extractOrderTextFromImage(fd)
    setLastFp({ fp, at: now })

    if (!ocrRes.success || !ocrRes.data) {
      setStep('failed')
      setError(
        ocrRes.error ??
          '이미지에서 주문 내용을 읽지 못했어요. 직접 입력으로 이어서 등록할 수 있어요.',
      )
      return
    }

    setBody(ocrRes.data.order_text)
    if (ocrRes.data.counterparty_hint && !counterparty.trim()) {
      setCounterparty(ocrRes.data.counterparty_hint)
    }

    const parseRes = await previewOrderBodyParse(ocrRes.data.order_text)
    if (parseRes.success && parseRes.data) {
      setParsedPreview(parseRes.data.parsed_items)
    } else {
      setParsedPreview(null)
    }

    setStep('review')
  }

  function handleFile(file: File | undefined) {
    if (!file) return
    void runOcr(file)
  }

  function refreshParsePreview() {
    const trimmed = body.trim()
    if (trimmed.length < 2) {
      setParsedPreview(null)
      return
    }
    startTransition(async () => {
      const res = await previewOrderBodyParse(trimmed)
      if (res.success && res.data) {
        setParsedPreview(res.data.parsed_items)
      }
    })
  }

  function saveOrder() {
    setError(null)
    startTransition(async () => {
      const res = await captureOperationalOrder({
        source: 'kakao',
        counterparty_name: counterparty,
        body,
        parsed_items: parsedPreview && parsedPreview.length > 0 ? parsedPreview : null,
      })
      if (!res.success) {
        setError(res.error ?? '저장에 실패했어요')
        return
      }
      resetToIdle()
      setCounterparty('')
      router.refresh()
    })
  }

  const canSave = counterparty.trim().length > 0 && body.trim().length > 0

  return (
    <section
      style={{
        background: '#ffffff',
        border: '0.5px solid #ece8df',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px' }}>
        카카오 주문 캡처 업로드
      </h2>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px', lineHeight: 1.45 }}>
        카톡 채팅·주문 사진·전화 메모 캡처를 올리면 주문 내용을 읽어요.
      </p>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {step === 'idle' || step === 'failed' ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              disabled={pending}
              onClick={() => cameraRef.current?.click()}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background: BRAND_ORANGE,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: pending ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              사진 찍기
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => galleryRef.current?.click()}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${BRAND_ORANGE}`,
                background: '#fff7ed',
                color: BRAND_ORANGE,
                fontSize: 13,
                fontWeight: 700,
                cursor: pending ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              갤러리에서 선택
            </button>
          </div>
          {step === 'failed' ? (
            <div
              style={{
                background: '#fff7ed',
                border: `1px solid ${BRAND_ORANGE}`,
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: '#9a3412',
                lineHeight: 1.45,
                marginBottom: 8,
              }}
            >
              {error ??
                '이미지에서 주문 내용을 읽지 못했어요. 직접 입력으로 이어서 등록할 수 있어요.'}
            </div>
          ) : null}
        </>
      ) : null}

      {step === 'analyzing' ? (
        <div style={{ textAlign: 'center', padding: '20px 8px' }}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 28,
              height: 28,
              border: '3px solid rgba(249,115,22,0.25)',
              borderTopColor: BRAND_ORANGE,
              borderRadius: '50%',
              animation: 'naverPlaceSpin 0.7s linear infinite',
              marginBottom: 10,
            }}
          />
          <p style={{ fontSize: 13, fontWeight: 700, color: BRAND_ORANGE, margin: 0 }}>
            주문 이미지 분석 중…
          </p>
          {fileName ? (
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0' }}>{fileName}</p>
          ) : null}
        </div>
      ) : null}

      {step === 'review' ? (
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            거래처(상호)
          </label>
          <input
            type="text"
            value={counterparty}
            disabled={pending}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="예: 대한유통"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              fontSize: 14,
              marginBottom: 10,
              fontFamily: 'inherit',
            }}
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            인식된 주문 내용
          </label>
          <textarea
            value={body}
            disabled={pending}
            onChange={(e) => setBody(e.target.value)}
            onBlur={refreshParsePreview}
            rows={5}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${BRAND_ORANGE}`,
              fontSize: 14,
              lineHeight: 1.45,
              marginBottom: 10,
              fontFamily: 'inherit',
            }}
          />

          {parsedPreview && parsedPreview.length > 0 ? (
            <div
              style={{
                background: '#f9fafb',
                borderRadius: 12,
                padding: 10,
                marginBottom: 10,
                border: '1px solid #f3f4f6',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 8 }}>
                주문 인식 결과
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {parsedPreview.map((line, idx) => (
                  <li
                    key={`${line.raw_name}-${idx}`}
                    style={{
                      fontSize: 12,
                      color: '#374151',
                      padding: '4px 0',
                      borderTop: idx === 0 ? 'none' : '1px solid #ece8df',
                    }}
                  >
                    {line.normalized_name} · {line.quantity_text}
                    {line.ingredient_match ? ' · 연결됨' : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? (
            <p style={{ color: '#dc2626', fontSize: 12, fontWeight: 600, margin: '0 0 10px' }}>{error}</p>
          ) : null}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={pending}
              onClick={resetToIdle}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: pending ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              취소
            </button>
            <button
              type="button"
              disabled={pending || !canSave}
              onClick={saveOrder}
              style={{
                flex: 2,
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background: pending || !canSave ? '#9ca3af' : BRAND_ORANGE,
                color: '#fff',
                fontSize: 13,
                fontWeight: 800,
                cursor: pending || !canSave ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {pending ? '저장 중…' : '주문 흐름 저장'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
