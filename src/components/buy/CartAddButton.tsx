'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToCart } from '@/actions/buy'

export default function CartAddButton({
  listingId,
  quantity = 1,
  label = '담기',
  primary = false,
}: {
  listingId: string
  quantity?: number
  label?: string
  primary?: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
      <button
        type="button"
        disabled={pending}
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
          padding: '8px 12px',
          borderRadius: 10,
          border: primary ? 'none' : '1px solid #e5e7eb',
          background: primary ? '#111827' : '#fff',
          color: primary ? '#fff' : '#111827',
          fontSize: 13,
          fontWeight: 800,
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {label}
      </button>
      {err ? <span style={{ fontSize: 11, color: '#b91c1c' }}>{err}</span> : null}
    </span>
  )
}
