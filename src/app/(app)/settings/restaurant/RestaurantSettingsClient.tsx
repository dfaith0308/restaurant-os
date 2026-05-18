'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { updateRestaurant } from '@/actions/restaurant'
import type { RestaurantInfo } from '@/actions/restaurant'
import { fetchNaverPlaceInfo } from '@/lib/naver-place-parser'
import Link from 'next/link'

const BRAND_ORANGE = '#F97316'

const INPUT_BASE: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #e5e7eb', borderRadius: 10,
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', background: '#fff',
}

export default function RestaurantSettingsClient({ restaurant }: { restaurant: RestaurantInfo }) {
  const router = useRouter()
  const [name,           setName]           = useState(restaurant.name ?? '')
  const [region,         setRegion]         = useState(restaurant.region ?? '')
  const [ownerName,      setOwnerName]      = useState(restaurant.owner_name ?? '')
  const [phone,          setPhone]          = useState(restaurant.phone ?? '')
  const [businessNumber, setBusinessNumber] = useState(restaurant.business_number ?? '')
  const [businessHoursText, setBusinessHoursText] = useState(
    restaurant.business_hours_text ?? '',
  )
  const [workingDays, setWorkingDays] = useState(restaurant.working_days_per_month ?? 25)
  const [placeUrl, setPlaceUrl] = useState('')
  const [placeFetching, setPlaceFetching] = useState(false)
  const [placeFetchResult, setPlaceFetchResult] =
    useState<'success' | 'partial' | 'failed' | null>(null)
  const [status,    setStatus]    = useState<'idle' | 'dirty' | 'saved'>('idle')
  const [isPending, startTr]      = useTransition()

  async function handleFetchPlace() {
    const trimmed = placeUrl.trim()
    if (!trimmed) {
      setPlaceFetchResult('failed')
      return
    }

    setPlaceFetching(true)
    setPlaceFetchResult(null)

    try {
      const info = await fetchNaverPlaceInfo(trimmed)
      if (!info) {
        setPlaceFetchResult('failed')
        return
      }

      const hydrated: boolean[] = []

      if (info.name?.trim()) {
        setName(info.name.trim())
        hydrated.push(true)
      }
      if (info.address?.trim()) {
        setRegion(info.address.trim())
        hydrated.push(true)
      }
      if (info.phone?.trim()) {
        setPhone(info.phone.trim())
        hydrated.push(true)
      }
      if (info.business_hours_text?.trim()) {
        setBusinessHoursText(info.business_hours_text.trim())
        hydrated.push(true)
      }

      // 향후: 메뉴/가격 hydrate 추가 가능 (info.menus)

      const filledCount = hydrated.length
      if (filledCount === 0) {
        setPlaceFetchResult('failed')
      } else if (filledCount === 4) {
        setPlaceFetchResult('success')
        setStatus('dirty')
      } else {
        setPlaceFetchResult('partial')
        setStatus('dirty')
      }
    } catch {
      setPlaceFetchResult('failed')
    } finally {
      setPlaceFetching(false)
    }
  }

  // dirty 감지 — 초기값과 비교
  const isDirty =
    name           !== (restaurant.name            ?? '') ||
    region         !== (restaurant.region          ?? '') ||
    ownerName      !== (restaurant.owner_name      ?? '') ||
    phone          !== (restaurant.phone           ?? '') ||
    businessNumber !== (restaurant.business_number ?? '') ||
    businessHoursText !== (restaurant.business_hours_text ?? '') ||
    workingDays         !== (restaurant.working_days_per_month ?? 25)

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

  useEffect(() => {
    setName(restaurant.name ?? '')
    setRegion(restaurant.region ?? '')
    setOwnerName(restaurant.owner_name ?? '')
    setPhone(restaurant.phone ?? '')
    setBusinessNumber(restaurant.business_number ?? '')
    setBusinessHoursText(restaurant.business_hours_text ?? '')
    setWorkingDays(restaurant.working_days_per_month ?? 25)
    setStatus('idle')
  }, [restaurant])

  function handleSave() {
    startTr(async () => {
      await updateRestaurant({
        id:              restaurant.id,
        name:            name.trim()            || undefined,
        region:          region.trim()          || null,
        owner_name:      ownerName.trim()       || null,
        phone:           phone.trim()           || null,
        business_number: businessNumber.trim()  || null,
        business_hours_text: businessHoursText,
        working_days_per_month: Number(workingDays) || 25,
      })
      setStatus('saved')
      router.refresh()
    })
  }

  const isDisabled = isPending || !name.trim()
  const isSaved    = status === 'saved'
  const showDirty  = status === 'dirty'

  const btnBg = isDisabled ? '#d1d5db' : isSaved ? '#15803D' : 'var(--color-primary)'

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <Link href="/settings" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
        ← 설정
      </Link>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '16px 0 20px' }}>
        매장 정보
      </h1>

      <style>{'@keyframes naverPlaceSpin { to { transform: rotate(360deg); } }'}</style>

      <div style={{
        background: '#f7f6f2',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 20,
        border: '0.5px solid #e8e5de',
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#2b2b2b', margin: 0 }}>
          네이버 플레이스 주소로 자동 입력
        </p>
        <p style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5, marginTop: 4, marginBottom: 12 }}>
          플레이스 URL을 붙여넣으면 가능한 정보를 자동으로 가져옵니다.
          일부 정보는 직접 수정이 필요할 수 있어요.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <input
            value={placeUrl}
            onChange={e => {
              setPlaceUrl(e.target.value)
              if (placeFetchResult) setPlaceFetchResult(null)
            }}
            placeholder="https://map.naver.com/..."
            disabled={placeFetching}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '9px 12px',
              border: '0.5px solid #e8e5de',
              borderRadius: 10,
              fontSize: 13,
              background: '#ffffff',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={handleFetchPlace}
            disabled={placeFetching || !placeUrl.trim()}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: BRAND_ORANGE,
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              padding: '9px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: placeFetching || !placeUrl.trim() ? 'not-allowed' : 'pointer',
              opacity: placeFetching || !placeUrl.trim() ? 0.65 : 1,
              fontFamily: 'inherit',
            }}
          >
            {placeFetching && (
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  border: '2px solid rgba(255,255,255,0.35)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'naverPlaceSpin 0.7s linear infinite',
                }}
              />
            )}
            {placeFetching ? '정보 분석 중...' : '가져오기'}
          </button>
        </div>
        {placeFetchResult === 'success' && (
          <p style={{ fontSize: 12, color: '#1f5d3a', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            매장 정보를 가져왔어요.
            아래 내용을 확인하고 저장하세요.
          </p>
        )}
        {placeFetchResult === 'partial' && (
          <p style={{ fontSize: 12, color: BRAND_ORANGE, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            일부 정보를 가져왔어요.
            비어있는 항목은 직접 입력해주세요.
          </p>
        )}
        {placeFetchResult === 'failed' && (
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            정보를 가져오지 못했어요.
            URL을 확인하거나 아래 항목을 직접 입력해주세요.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="매장 이름 *">
          <input value={name} onChange={e => { setName(e.target.value); setStatus('idle') }}
            placeholder="예: 행복분식"
            style={{ ...INPUT_BASE, borderColor: isSaved ? '#BBF7D0' : showDirty ? '#FCA5A5' : '#e5e7eb' }} />
        </Field>

        <Field label="지역/주소">
          <input value={region} onChange={e => { setRegion(e.target.value); setStatus('idle') }}
            placeholder="예: 서울 강남구 테헤란로 123"
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

        <Field label="사업자번호">
          <input value={businessNumber} onChange={e => { setBusinessNumber(e.target.value); setStatus('idle') }}
            placeholder="예: 123-45-67890" inputMode="numeric"
            style={{ ...INPUT_BASE, borderColor: isSaved ? '#BBF7D0' : showDirty ? '#FCA5A5' : '#e5e7eb' }} />
        </Field>

        <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '8px 0 0' }}>
          영업 정보
        </p>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            영업시간
          </label>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 6px' }}>
            자유롭게 입력하세요
          </p>
          <input
            value={businessHoursText}
            onChange={e => { setBusinessHoursText(e.target.value); setStatus('idle') }}
            placeholder="예: 매일 11:00~22:00 / 월요일 휴무"
            style={{
              width: '100%',
              padding: '9px 12px',
              border: '0.5px solid #e8e5de',
              borderRadius: 10,
              fontSize: 13,
              background: '#f7f6f2',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, lineHeight: 1.4, marginBottom: 0 }}>
            예: 매일 11:00~22:00 / 평일 11:00~21:00 주말 10:00~22:00 / 월요일 휴무
          </p>
        </div>

        <Field label="월 영업일수">
          <input
            type="number"
            min={1}
            max={31}
            value={workingDays}
            onChange={e => {
              const v = parseInt(e.target.value, 10)
              if (isNaN(v)) setWorkingDays(25)
              else if (v < 1) setWorkingDays(1)
              else if (v > 31) setWorkingDays(31)
              else setWorkingDays(v)
              setStatus('idle')
            }}
            placeholder="예: 25"
            inputMode="numeric"
            style={{ ...INPUT_BASE, borderColor: isSaved ? '#BBF7D0' : showDirty ? '#FCA5A5' : '#e5e7eb' }}
          />
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
