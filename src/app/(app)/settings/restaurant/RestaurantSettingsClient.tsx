'use client'

import { useState, useTransition, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { updateRestaurant } from '@/actions/restaurant'
import type { RestaurantInfo } from '@/actions/restaurant'
import { crawlNaverPlace } from '@/actions/naver-place'
import type { NaverPlaceCrawlData, NaverPlaceMenuItem } from '@/actions/naver-place'
import { parseNaverPlaceImage } from '@/lib/naver-place-parser'
import type { NaverPlaceInfo } from '@/lib/naver-place-parser'
import { saveNaverPlaceMenusForImport } from '@/lib/naver-place-import'
import Link from 'next/link'

const BRAND_ORANGE = '#F97316'

const INPUT_BASE: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #e5e7eb', borderRadius: 10,
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', background: '#fff',
}

type PlaceImportStatus = 'idle' | 'loading' | 'success' | 'partial' | 'failed'
type ReviewTab = 'visitor' | 'blog'

function normalizePlaceInfo(
  info: NaverPlaceInfo | NaverPlaceCrawlData,
): NaverPlaceInfo {
  if ('business_hours' in info && Array.isArray(info.business_hours)) {
    return {
      name: info.name,
      address: info.address,
      phone: info.phone,
      business_hours_text:
        info.business_hours.length > 0 ? info.business_hours.join(' / ') : null,
      menus: info.menus,
    }
  }

  const place = info as NaverPlaceInfo
  return {
    name: place.name ?? null,
    address: place.address ?? null,
    phone: place.phone ?? null,
    business_hours_text: place.business_hours_text ?? null,
    menus: place.menus,
  }
}

export default function RestaurantSettingsClient({ restaurant }: { restaurant: RestaurantInfo }) {
  const router = useRouter()
  const placeImageInputRef = useRef<HTMLInputElement>(null)
  const [naverUrl, setNaverUrl] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [crawlError, setCrawlError] = useState<string | null>(null)
  const [urlImportStatus, setUrlImportStatus] = useState<PlaceImportStatus>('idle')
  const [extractedMenus, setExtractedMenus] = useState<NaverPlaceMenuItem[]>([])
  const [extractedVisitorReviews, setExtractedVisitorReviews] = useState<string[]>([])
  const [extractedBlogReviews, setExtractedBlogReviews] = useState<
    Array<{ title: string; summary: string }>
  >([])
  const [reviewsExpanded, setReviewsExpanded] = useState(false)
  const [reviewTab, setReviewTab] = useState<ReviewTab>('visitor')
  const [name,           setName]           = useState(restaurant.name ?? '')
  const [region,         setRegion]         = useState(restaurant.region ?? '')
  const [ownerName,      setOwnerName]      = useState(restaurant.owner_name ?? '')
  const [phone,          setPhone]          = useState(restaurant.phone ?? '')
  const [businessNumber, setBusinessNumber] = useState(restaurant.business_number ?? '')
  const [businessHoursText, setBusinessHoursText] = useState(
    restaurant.business_hours_text ?? '',
  )
  const [workingDays, setWorkingDays] = useState(restaurant.working_days_per_month ?? 25)
  const [selectedPlaceImage, setSelectedPlaceImage] = useState<File | null>(null)
  const [placeImportStatus, setPlaceImportStatus] = useState<PlaceImportStatus>('idle')
  const [status,    setStatus]    = useState<'idle' | 'dirty' | 'saved'>('idle')
  const [isPending, startTr]      = useTransition()

  function applyPlaceInfo(info: NaverPlaceInfo | NaverPlaceCrawlData): 'success' | 'partial' | 'failed' {
    const normalized = normalizePlaceInfo(info)
    let filledCount = 0

    if (normalized.name?.trim()) {
      setName(normalized.name.trim())
      filledCount += 1
    }
    if (normalized.address?.trim()) {
      setRegion(normalized.address.trim())
      filledCount += 1
    }
    if (normalized.phone?.trim()) {
      setPhone(normalized.phone.trim())
      filledCount += 1
    }
    if (normalized.business_hours_text?.trim()) {
      setBusinessHoursText(normalized.business_hours_text.trim())
      filledCount += 1
    }

    if (filledCount === 0) return 'failed'
    if (filledCount === 4) return 'success'
    return 'partial'
  }

  async function handleCrawl() {
    const trimmed = naverUrl.trim()
    if (!trimmed) {
      setCrawlError('네이버 플레이스 URL을 입력해주세요')
      return
    }

    setCrawling(true)
    setCrawlError(null)
    setUrlImportStatus('loading')
    setExtractedMenus([])
    setExtractedVisitorReviews([])
    setExtractedBlogReviews([])
    setReviewsExpanded(false)

    try {
      const res = await crawlNaverPlace(trimmed)
      if (!res.success) {
        setCrawlError(res.error)
        setUrlImportStatus('failed')
        return
      }

      const result = applyPlaceInfo(res.data)
      setUrlImportStatus(result)
      if (result !== 'failed') setStatus('dirty')

      if (res.data.menus?.length > 0) {
        setExtractedMenus(res.data.menus)
      }
      if (res.data.visitor_reviews?.length > 0) {
        setExtractedVisitorReviews(res.data.visitor_reviews)
      }
      if (res.data.blog_reviews?.length > 0) {
        setExtractedBlogReviews(res.data.blog_reviews)
      }
    } catch {
      setCrawlError('정보를 가져오지 못했습니다')
      setUrlImportStatus('failed')
    } finally {
      setCrawling(false)
    }
  }

  function handleGoToMenusImport() {
    if (extractedMenus.length === 0) return
    saveNaverPlaceMenusForImport(extractedMenus)
    router.push('/settings/menus?import=naver')
  }

  function handlePlaceImageSelect(file: File | undefined) {
    if (!file) return

    setSelectedPlaceImage(file)
    setPlaceImportStatus('loading')

    window.setTimeout(async () => {
      try {
        const info = await parseNaverPlaceImage(file)
        if (!info) {
          setPlaceImportStatus('failed')
          return
        }
        const result = applyPlaceInfo(info)
        setPlaceImportStatus(result)
        if (result !== 'failed') setStatus('dirty')
      } catch {
        setPlaceImportStatus('failed')
      }
    }, 1500)
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
  const isPlaceLoading = placeImportStatus === 'loading'

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

      <input
        ref={placeImageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          handlePlaceImageSelect(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <div style={{
        background: '#f7f6f2',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 16,
        border: '0.5px solid #e8e5de',
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#2b2b2b', margin: 0 }}>
          네이버 플레이스 URL
        </p>
        <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginTop: 4, marginBottom: 12 }}>
          플레이스 링크를 붙여넣으면 매장·메뉴·리뷰 정보를 수집합니다.
        </p>

        <input
          type="url"
          placeholder="https://map.naver.com/v5/entry/place/..."
          value={naverUrl}
          onChange={e => { setNaverUrl(e.target.value); setCrawlError(null) }}
          style={{ ...INPUT_BASE, marginBottom: 10, fontSize: 13 }}
        />

        <button
          type="button"
          onClick={handleCrawl}
          disabled={crawling || !naverUrl.trim()}
          style={{
            width: '100%',
            background: crawling || !naverUrl.trim() ? '#d1d5db' : '#1f5d3a',
            color: '#ffffff',
            border: 'none',
            borderRadius: 10,
            padding: '11px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: crawling || !naverUrl.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {crawling ? '수집 중...' : '정보 가져오기'}
        </button>

        {crawlError && (
          <p style={{ fontSize: 12, color: '#B91C1C', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            {crawlError}
          </p>
        )}
        {urlImportStatus === 'success' && (
          <p style={{ fontSize: 12, color: '#1f5d3a', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            매장 정보를 가져왔어요. 아래 내용을 확인하고 저장하세요.
          </p>
        )}
        {urlImportStatus === 'partial' && (
          <p style={{ fontSize: 12, color: BRAND_ORANGE, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            일부 정보를 가져왔어요. 비어있는 항목은 직접 입력해주세요.
          </p>
        )}
        {urlImportStatus === 'failed' && !crawlError && (
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            정보를 가져오지 못했어요. URL을 확인하거나 스크린샷 업로드를 이용해주세요.
          </p>
        )}
      </div>

      {extractedMenus.length > 0 && (
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 16,
          border: '0.5px solid #e8e5de',
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2b2b2b', margin: '0 0 4px' }}>
            수집된 메뉴 {extractedMenus.length}개
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px', lineHeight: 1.4 }}>
            {extractedMenus.slice(0, 3).map(m => m.name).join(', ')}
            {extractedMenus.length > 3 ? ' …' : ''}
          </p>
          <button
            type="button"
            onClick={handleGoToMenusImport}
            style={{
              width: '100%',
              background: BRAND_ORANGE,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            메뉴 설정에 자동 등록
          </button>
        </div>
      )}

      {(extractedVisitorReviews.length > 0 || extractedBlogReviews.length > 0) && (
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 16,
          border: '0.5px solid #e8e5de',
        }}>
          <button
            type="button"
            onClick={() => setReviewsExpanded(v => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2b2b2b' }}>
              수집된 리뷰
              {' '}
              (방문자 {extractedVisitorReviews.length} · 블로그 {extractedBlogReviews.length})
            </span>
            <span style={{ fontSize: 16, color: '#9ca3af' }}>{reviewsExpanded ? '∧' : '∨'}</span>
          </button>

          {reviewsExpanded && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {(['visitor', 'blog'] as ReviewTab[]).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setReviewTab(tab)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: reviewTab === tab ? '1.5px solid #1f5d3a' : '1px solid #e5e7eb',
                      background: reviewTab === tab ? '#f0fdf4' : '#fff',
                      color: reviewTab === tab ? '#1f5d3a' : '#6b7280',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {tab === 'visitor' ? '방문자 리뷰' : '블로그 리뷰'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                {reviewTab === 'visitor' && extractedVisitorReviews.map((review, i) => (
                  <p key={i} style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5, background: '#f7f6f2', borderRadius: 8, padding: '10px 12px' }}>
                    {review}
                  </p>
                ))}
                {reviewTab === 'blog' && extractedBlogReviews.map((review, i) => (
                  <div key={i} style={{ background: '#f7f6f2', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#2b2b2b', margin: '0 0 4px' }}>{review.title}</p>
                    {review.summary && (
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{review.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{
        background: '#f7f6f2',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 20,
        border: '0.5px solid #e8e5de',
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#2b2b2b', margin: 0 }}>
          네이버 플레이스 화면 업로드
        </p>
        <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginTop: 4, marginBottom: 14 }}>
          플레이스 화면을 캡쳐해서 올리면
          매장 정보를 자동으로 입력해드려요.
        </p>

        <div style={{
          border: '1px dashed #F97316',
          borderRadius: 14,
          background: '#fff7ed',
          padding: 20,
          textAlign: 'center',
        }}>
          {isPlaceLoading ? (
            <>
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
                  marginBottom: 12,
                }}
              />
              <p style={{ fontSize: 14, fontWeight: 500, color: '#2b2b2b', margin: '0 0 4px' }}>
                정보 분석 중...
              </p>
              {selectedPlaceImage && (
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
                  {selectedPlaceImage.name}
                </p>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#2b2b2b', margin: '0 0 4px' }}>
                네이버 플레이스 화면 올리기
              </p>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 14px', lineHeight: 1.4 }}>
                매장명 · 주소 · 전화번호 · 영업시간 자동 분석
              </p>
              <button
                type="button"
                onClick={() => placeImageInputRef.current?.click()}
                style={{
                  background: BRAND_ORANGE,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                이미지 선택
              </button>
            </>
          )}
        </div>

        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
          ※ AI가 화면을 분석합니다.
          일부 정보는 직접 수정이 필요할 수 있어요.
        </p>

        {placeImportStatus === 'success' && (
          <p style={{ fontSize: 12, color: '#1f5d3a', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            매장 정보를 가져왔어요.
            아래 내용을 확인하고 저장하세요.
          </p>
        )}
        {placeImportStatus === 'partial' && (
          <p style={{ fontSize: 12, color: BRAND_ORANGE, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            일부 정보를 가져왔어요.
            비어있는 항목은 직접 입력해주세요.
          </p>
        )}
        {placeImportStatus === 'failed' && (
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            정보를 분석하지 못했어요.
            다른 이미지를 시도하거나 아래 항목을 직접 입력해주세요.
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
