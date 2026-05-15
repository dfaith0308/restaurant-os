'use client'

import { useCallback, useState } from 'react'

const SCRIPT_URL = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

type DaumPostcodeData = {
  address: string
  roadAddress: string
  jibunAddress: string
  buildingName: string
  zonecode: string
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void
      }) => { open: () => void }
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadPostcodeScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window unavailable'))
  }
  if (window.daum?.Postcode) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const done = () => {
      if (window.daum?.Postcode) resolve()
      else reject(new Error('postcode unavailable'))
    }

    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`)
    if (existing) {
      if (window.daum?.Postcode) {
        resolve()
        return
      }
      existing.addEventListener('load', done, { once: true })
      existing.addEventListener('error', () => reject(new Error('script load failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = done
    script.onerror = () => reject(new Error('script load failed'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

const BTN_STYLE: React.CSSProperties = {
  flexShrink: 0,
  minWidth: 88,
  padding: '12px 12px',
  border: '1.5px solid #e5e7eb',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'inherit',
  background: '#fff',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

type AddressSearchButtonProps = {
  onSelect: (address: string) => void
  disabled?: boolean
}

export default function AddressSearchButton({ onSelect, disabled }: AddressSearchButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = useCallback(async () => {
    if (disabled || loading) return
    setLoading(true)
    try {
      await loadPostcodeScript()
      if (!window.daum?.Postcode) return

      new window.daum.Postcode({
        oncomplete(data) {
          const base = data.roadAddress || data.jibunAddress || data.address
          const building = data.buildingName?.trim()
          onSelect(building ? `${base} (${building})` : base)
        },
      }).open()
    } catch {
      // 사용자 재시도 가능 — 별도 토스트 없이 버튼만 복구
    } finally {
      setLoading(false)
    }
  }, [disabled, loading, onSelect])

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      style={{
        ...BTN_STYLE,
        opacity: disabled || loading ? 0.55 : 1,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? '불러오는 중...' : '주소 검색'}
    </button>
  )
}
