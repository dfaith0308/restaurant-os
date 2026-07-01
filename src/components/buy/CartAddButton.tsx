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
  listingCard = false,
  disabled = false,
  onSuccess,
}: {
  listingId: string
  quantity?: number
  label?: string
  primary?: boolean
  compact?: boolean
  fullWidth?: boolean
  /** /buy 그리드: 풀 너비·높이 36px, radius 6 */
  listingCard?: boolean
  disabled?: boolean
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const raw = typeof label === 'string' ? label.trim() : ''
  const buttonLabel = !raw || raw === '닫기' ? '담기' : raw

  const isFullWidth = fullWidth || listingCard

  return (
    <span
      style={{
        display: isFullWidth ? 'flex' : 'inline-flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 4,
        width: isFullWidth ? '100%' : undefined,
      }}
    >
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
            onSuccess?.()
          })
        }}
        style={{
          width: isFullWidth ? '100%' : undefined,
          boxSizing: 'border-box',
          padding: listingCard ? '8px' : compact ? '8px 10px' : '8px 12px',
          borderRadius: listingCard ? 6 : 8,
          border: primary ? 'none' : '1px solid var(--color-border)',
          background: primary ? (listingCard ? '#1f5d3a' : 'var(--color-primary)') : '#fff',
          color: primary ? '#fff' : 'var(--color-text)',
          fontSize: listingCard ? 13 : compact ? 12 : 13,
          fontWeight: listingCard ? 500 : 700,
          fontFamily: listingCard ? 'inherit' : undefined,
          cursor: pending || disabled ? 'not-allowed' : 'pointer',
          opacity: pending ? 0.7 : disabled ? 0.45 : 1,
          display: listingCard ? 'flex' : undefined,
          alignItems: listingCard ? 'center' : undefined,
          justifyContent: listingCard ? 'center' : undefined,
        }}
      >
        {buttonLabel}
      </button>
      {err ? <span style={{ fontSize: 11, color: '#b91c1c' }}>{err}</span> : null}
    </span>
  )
}
