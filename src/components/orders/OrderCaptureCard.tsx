'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { captureOperationalOrder } from '@/actions/orders'
import type { OrderOperationCaptureSource } from '@/types'

const SOURCE_OPTIONS: { id: OrderOperationCaptureSource; label: string }[] = [
  { id: 'kakao', label: '카카오톡 주문' },
  { id: 'phone', label: '전화 주문' },
  { id: 'manual', label: '직접 입력' },
  { id: 'invoice', label: '거래명세서 기반 주문' },
]

export default function OrderCaptureCard() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [source, setSource] = useState<OrderOperationCaptureSource>('kakao')
  const [counterparty, setCounterparty] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  const showLargeMemo = source === 'kakao'

  const bodyRequired = source === 'kakao' || source === 'manual'
  const canSubmit =
    counterparty.trim().length > 0 && (!bodyRequired || body.trim().length > 0)

  function resetForm() {
    setBody('')
    setError(null)
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await captureOperationalOrder({
        source,
        counterparty_name: counterparty,
        body,
      })
      if (!res.success) {
        setError(res.error ?? '저장에 실패했어요')
        return
      }
      resetForm()
      router.refresh()
    })
  }

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
        어떻게 주문이 들어왔나요?
      </h2>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px' }}>
        카카오·전화·수기 흐름을 그대로 남겨두면 나중에 정리하기 쉬워요.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {SOURCE_OPTIONS.map((opt) => {
          const active = source === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={pending}
              onClick={() => {
                setSource(opt.id)
                setError(null)
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: active ? '1px solid var(--color-primary)' : '1px solid #e5e7eb',
                background: active ? '#ecfdf5' : '#fff',
                color: active ? '#1f5d3a' : '#6b7280',
                fontSize: 12,
                fontWeight: 700,
                cursor: pending ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

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
          marginBottom: 12,
          fontFamily: 'inherit',
        }}
      />

      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
        {source === 'kakao'
          ? '카카오 주문 메모'
          : source === 'phone'
            ? '통화 내용 메모'
            : source === 'invoice'
              ? '거래명세서 관련 메모'
              : '주문 내용'}
      </label>
      <textarea
        value={body}
        disabled={pending}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          source === 'kakao'
            ? '양파 1박스\n대파 2단\n삼겹살 5kg'
            : '주문 내용을 그대로 적어주세요'
        }
        rows={showLargeMemo ? 6 : 3}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #e5e7eb',
          fontSize: 14,
          lineHeight: 1.45,
          resize: 'vertical',
          marginBottom: 12,
          fontFamily: 'inherit',
        }}
      />

      {error ? (
        <p style={{ color: '#dc2626', fontSize: 12, fontWeight: 600, margin: '0 0 10px' }}>{error}</p>
      ) : null}

      <button
        type="button"
        disabled={pending || !canSubmit}
        onClick={submit}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 10,
          border: 'none',
          background: pending ? '#9ca3af' : 'var(--color-primary)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 800,
          cursor: pending || !canSubmit ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {pending ? '저장 중…' : '주문 흐름 저장'}
      </button>
    </section>
  )
}
