'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToCart } from '@/actions/buy'

export default function CartAddButton({
  listingId,
  quantity = 1,
  label = '담기',
  primary = false,
  compact = false,
  fullWidth = false,
  disabled = false,
}: {
  listingId: string
  quantity?: number
  label?: string
  primary?: boolean
  compact?: boolean
  fullWidth?: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const buttonLabel = label === '닫기' ? '담기' : (label ?? '담기')

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
      <button
        type="button"
        disabled={pending || disabled}
        aria-label={buttonLabel}
        onClick={() => {
          setErr(null)
          start(async () => {
            const r = await addToCart(listingId, quantity)
            if (!r.success) {
              setErr(r.error ?? '실패')
              return
            }
            router.refresh()
          })
        }}
        style={{
          width: fullWidth ? '100%' : undefined,
          boxSizing: 'border-box',
          padding: compact ? '8px 10px' : '8px 12px',
          borderRadius: 8,
          border: primary ? 'none' : '1px solid #ddd',
          background: primary ? '#111' : '#fff',
          color: primary ? '#fff' : '#111',
          fontSize: compact ? 12 : 13,
          fontWeight: 700,
          cursor: pending || disabled ? 'not-allowed' : 'pointer',
          opacity: pending ? 0.7 : disabled ? 0.45 : 1,
        }}
      >
        {buttonLabel}
      </button>
      {err ? <span style={{ fontSize: 11, color: '#b91c1c' }}>{err}</span> : null}
    </span>
  )
}
