'use client'

import { useState } from 'react'

/** 문장·표 복사 버튼 — 표는 탭 구분 텍스트로 넘겨 엑셀에 그대로 붙여넣을 수 있게 한다 */
export default function CopyTextButton({ text, label = '복사' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch {
      setDone(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid #d1d5db',
        background: done ? '#f0f7f3' : '#fff',
        color: done ? '#1f5d3a' : '#374151',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
    >
      {done ? '복사됨' : label}
    </button>
  )
}
