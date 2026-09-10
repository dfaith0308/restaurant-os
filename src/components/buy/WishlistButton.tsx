'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleWishlist } from '@/actions/buy'

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 20.5l-1.2-1.09C6.3 15.36 3.5 12.83 3.5 9.72 3.5 7.19 5.49 5.2 8.02 5.2c1.43 0 2.8.66 3.7 1.71l.28.33.28-.33a4.87 4.87 0 013.7-1.71c2.53 0 4.52 1.99 4.52 4.52 0 3.11-2.8 5.64-7.3 9.69L12 20.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 찜 토글 버튼.
 * 서버 응답 전에 먼저 눌린 상태를 보여주고, 실패하면 되돌린다.
 */
export default function WishlistButton({
  listingId,
  initialWished,
  size = 'sm',
}: {
  listingId: string
  initialWished: boolean
  /** sm: 목록 카드용 아이콘만 / lg: 상세 페이지용 라벨 포함 */
  size?: 'sm' | 'lg'
}) {
  const router = useRouter()
  const [wished, setWished] = useState(initialWished)
  const [pending, start] = useTransition()

  function handleToggle() {
    const next = !wished
    setWished(next)
    start(async () => {
      const r = await toggleWishlist(listingId)
      if (!r.success) {
        setWished(!next)
        return
      }
      setWished(r.data?.wished ?? next)
      router.refresh()
    })
  }

  const color = wished ? '#b91c1c' : '#9ca3af'

  if (size === 'lg') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={wished}
        aria-label={wished ? '찜 해제' : '찜하기'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '13px 16px',
          background: '#fff',
          border: `1px solid ${wished ? '#fecaca' : '#e5e7eb'}`,
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          color,
          cursor: pending ? 'wait' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <HeartIcon filled={wished} />
        {wished ? '찜함' : '찜하기'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      aria-pressed={wished}
      aria-label={wished ? '찜 해제' : '찜하기'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        padding: 0,
        background: 'transparent',
        border: 'none',
        borderRadius: 8,
        color,
        cursor: pending ? 'wait' : 'pointer',
        flexShrink: 0,
      }}
    >
      <HeartIcon filled={wished} />
    </button>
  )
}
