'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { updateRestaurant } from '@/actions/restaurant'
import type { RestaurantInfo } from '@/actions/restaurant'
import Link from 'next/link'

const INPUT_BASE: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #e5e7eb', borderRadius: 10,
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', background: '#fff',
}

export default function RestaurantSettingsClient({ restaurant }: { restaurant: RestaurantInfo }) {
  const router = useRouter()
  const [name,      setName]      = useState(restaurant.name ?? '')
  const [region,    setRegion]    = useState(restaurant.region ?? '')
  const [ownerName, setOwnerName] = useState(restaurant.owner_name ?? '')
  const [phone,     setPhone]     = useState(restaurant.phone ?? '')
  const [status,    setStatus]    = useState<'idle' | 'dirty' | 'saved'>('idle')
  const [isPending, startTr]      = useTransition()

  // dirty 감지 — 초기값과 비교
  const isDirty =
    name      !== (restaurant.name       ?? '') ||
    region    !== (restaurant.region     ?? '') ||
    ownerName !== (restaurant.owner_name ?? '') ||
    phone     !== (restaurant.phone      ?? '')

  // status 동기화
  useEffect(() => {
    if (status === 'saved') return  // 저장 직후는 유지
    setStatus(isDirty ? 'dirty' : 'idle')
  }, [isDirty, status])

  // 저장 안 하고 나갈 때 경고
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (status === 'dirty') e.preventDefault()
  }, [status])

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [handleBeforeUnload])

  function handleSave() {
    startTr(async () => {
      await updateRestaurant({
        id:         restaurant.id,
        name:       name.trim()      || undefined,
        region:     region.trim()    || null,
        owner_name: ownerName.trim() || null,
        phone:      phone.trim()     || null,
      })
      setStatus('saved')
      router.refresh()
    })
  }

  const isDisabled = isPending || !name.trim()
  const isSaved    = status === 'saved'
  const showDirty  = status === 'dirty'

  const btnBg = isDisabled ? '#d1d5db' : isSaved ? '#15803D' : '#111827'

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <Link href="/settings" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
        ← 설정
      </Link>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '16px 0 20px' }}>
        매장 정보
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="매장 이름 *">
          <input value={name} onChange={e => { setName(e.target.value); setStatus('idle') }}
            placeholder="예: 행복분식"
            style={{ ...INPUT_BASE, borderColor: isSaved ? '#BBF7D0' : showDirty ? '#FCA5A5' : '#e5e7eb' }} />
        </Field>

        <Field label="지역">
          <input value={region} onChange={e => { setRegion(e.target.value); setStatus('idle') }}
            placeholder="예: 서울 강남"
            style={{ ...INPUT_BASE, borderColor: isSaved ? '#BBF7D0' : showDirty ? '#FCA5A5' : '#e5e7eb' }} />
        </Field>

        <Field label="대표자 이름">
          <input value={ownerName} onChange={e => { setOwnerName(e.target.value); setStatus('idle') }}
            placeholder="예: 홍길동"
            style={{ ...INPUT_BASE, borderColor: isSaved ? '#BBF7D0' : showDirty ? '#FCA5A5' : '#e5e7eb' }} />
        </Field>

        <Field label="연락처">
          <input value={phone} onChange={e => { setPhone(e.target.value); setStatus('idle') }}
            placeholder="예: 010-1234-5678" inputMode="tel"
            style={{ ...INPUT_BASE, borderColor: isSaved ? '#BBF7D0' : showDirty ? '#FCA5A5' : '#e5e7eb' }} />
        </Field>
      </div>

      {/* 상태 메시지 */}
      {(showDirty || isSaved) && (
        <div style={{
          marginTop: 12, fontSize: 12, textAlign: 'center',
          color: isSaved ? '#15803D' : '#EF4444',
        }}>
          {isSaved ? '변경사항이 반영됐습니다' : '⚠ 저장하지 않은 변경사항이 있습니다'}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isDisabled}
        onMouseDown={e => { if (!isDisabled) e.currentTarget.style.transform = 'scale(0.98)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        style={{
          width: '100%', padding: '15px', marginTop: 16,
          background: btnBg, color: '#fff', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 700,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'transform 0.08s ease, background 0.2s ease',
        }}
      >
        {isPending ? '저장 중...' : isSaved ? '저장됨 ✓' : '저장하기'}
      </button>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
