'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { formatKRW } from '@/lib/utils'
import { updateRestaurant } from '@/actions/restaurant'
import type { RestaurantInfo, MenuRow, SeatingType } from '@/actions/restaurant'
import type { FixedCostRow, IngredientRow } from '@/actions/settings'

interface Props {
  restaurant:  RestaurantInfo
  fixedCosts:  FixedCostRow[]
  ingredients: IngredientRow[]
  menus:       MenuRow[]
}

const BRAND_ORANGE = '#F97316'

type NextAction = 'restaurant' | 'restaurant-hours' | 'fixed-costs' | 'menus' | 'seats' | null
type SettingsRowVariant = 'default' | 'done' | 'priority'

function rowVariant(
  done: boolean,
  nextAction: NextAction,
  target: Exclude<NextAction, null>,
): SettingsRowVariant {
  if (done) return 'done'
  if (nextAction === target) return 'priority'
  return 'default'
}

export default function SettingsHub({ restaurant, fixedCosts, ingredients, menus: initMenus }: Props) {
  const monthlyFixed = fixedCosts.reduce((s, c) => s + c.amount, 0)
  const effectiveDays =
    restaurant.working_days_per_month > 0 ? restaurant.working_days_per_month : 25
  const dailyBreakeven =
    monthlyFixed > 0 && effectiveDays > 0 ? Math.ceil(monthlyFixed / effectiveDays) : 0

  const fixedCostFilled = fixedCosts.length > 0
  const ingredientCount = ingredients.length
  const ingredientFilled = ingredientCount > 0
  const pricedCount = ingredients.filter(i => i.current_price != null).length
  const restaurantFilled = !!(
    restaurant.name?.trim() &&
    restaurant.phone &&
    restaurant.address
  )
  const businessHoursFilled = restaurant.working_days_per_month > 0
  const menuCount = initMenus.length
  const menuFilled = menuCount > 0
  const seatFilled = (restaurant.table_2p ?? 0) + (restaurant.table_4p ?? 0) > 0
  const storeSetupFilled = restaurantFilled && businessHoursFilled

  const nextAction: NextAction =
    !restaurantFilled ? 'restaurant' :
    !businessHoursFilled ? 'restaurant-hours' :
    !fixedCostFilled ? 'fixed-costs' :
    !menuFilled ? 'menus' :
    !seatFilled ? 'seats' :
    null

  const completionRate =
    (restaurantFilled ? 20 : 0) +
    (businessHoursFilled ? 20 : 0) +
    (fixedCostFilled ? 20 : 0) +
    (menuFilled ? 20 : 0) +
    (seatFilled ? 20 : 0)

  const [barWidth, setBarWidth] = useState(0)
  const [displayRate, setDisplayRate] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setBarWidth(completionRate), 200)
    return () => clearTimeout(timer)
  }, [completionRate])

  useEffect(() => {
    const target = completionRate
    const duration = 1000
    const steps = 30
    const stepValue = target / steps
    const stepTime = duration / steps
    let current = 0

    const timer = setInterval(() => {
      current += stepValue
      if (current >= target) {
        setDisplayRate(target)
        clearInterval(timer)
      } else {
        setDisplayRate(Math.round(current))
      }
    }, stepTime)

    return () => clearInterval(timer)
  }, [completionRate])

  const canGoRfq = fixedCostFilled && ingredientCount >= 3

  const DEFAULT_SEATING: SeatingType[] = [
    { name: '2인 테이블', seats: 2, count: 0 },
    { name: '4인 테이블', seats: 4, count: 0 },
  ]

  const initialSeating: SeatingType[] = DEFAULT_SEATING.map((r) => {
    if (r.seats === 2) return { ...r, count: restaurant.table_2p ?? 0 }
    if (r.seats === 4) return { ...r, count: restaurant.table_4p ?? 0 }
    return r
  })
  const [seating, setSeating]             = useState<SeatingType[]>(initialSeating)
  const [tableExpanded, setTableExpanded] = useState(false)
  const [canUndo, setCanUndo]             = useState(false)
  const saveTimerRef                      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevSeatingRef                    = useRef<SeatingType[]>(seating)

  const totalSeats = seating.reduce((s, r) => {
    const seats = Number.isFinite(r.seats) && r.seats >= 1 ? r.seats : 0
    const count = Number.isFinite(r.count) && r.count >= 0 ? r.count : 0
    return s + seats * count
  }, 0)

  function saveSeating(next: SeatingType[]) {
    prevSeatingRef.current = seating
    setSeating(next)
    setCanUndo(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const table_2p = next.find(r => r.seats === 2)?.count ?? 0
      const table_4p = next.find(r => r.seats === 4)?.count ?? 0
      await updateRestaurant({ id: restaurant.id, table_2p, table_4p })
    }, 500)
  }

  function handleUndo() {
    const prev = prevSeatingRef.current
    setSeating(prev)
    setCanUndo(false)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const table_2p = prev.find(r => r.seats === 2)?.count ?? 0
    const table_4p = prev.find(r => r.seats === 4)?.count ?? 0
    updateRestaurant({ id: restaurant.id, table_2p, table_4p })
  }

  function addSeatingRow() {
    saveSeating([...seating, { name: '', seats: 1, count: 0 }])
  }

  function removeSeatingRow(i: number) {
    saveSeating(seating.filter((_, idx) => idx !== i))
  }

  function updateSeatingName(i: number, val: string) {
    const next = seating.map((r, idx) => idx === i ? { ...r, name: val } : r)
    saveSeating(next)
  }

  function updateSeatingSeats(i: number, raw: string) {
    const v = parseInt(raw.replace(/[^0-9]/g, ''), 10)
    const seats = Number.isFinite(v) && v >= 1 ? v : 1
    const next = seating.map((r, idx) => idx === i ? { ...r, seats } : r)
    saveSeating(next)
  }

  function updateSeatingCount(i: number, raw: string) {
    const v = parseInt(raw.replace(/[^0-9]/g, ''), 10)
    const count = Number.isFinite(v) && v >= 0 ? v : 0
    const next = seating.map((r, idx) => idx === i ? { ...r, count } : r)
    saveSeating(next)
  }

  const completionHint =
    nextAction === 'restaurant' ? '매장 정보를 먼저 입력해주세요' :
    nextAction === 'restaurant-hours' ? '월 영업일수를 입력하면 손익 계산이 가능해져요' :
    nextAction === 'fixed-costs' ? '고정비를 입력하면 하루 손익분기를 볼 수 있어요' :
    nextAction === 'menus' ? '메뉴를 등록하면 원가 분석이 가능해요' :
    nextAction === 'seats' ? '좌석 구성을 입력해주세요' :
    null

  const ctaLinkStyle = {
    background: BRAND_ORANGE,
    color: '#ffffff',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 500,
    textDecoration: 'none',
  } as const

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px', background: '#ffffff' }}>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2b2b2b', margin: '0 0 4px' }}>
        설정
      </h1>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>
        입력할수록 제안이 정확해져요
      </p>

      {/* 핵심 세팅 완료율 */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        border: '0.5px solid #e8e5de',
        padding: '16px 18px',
        marginBottom: 16,
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#2b2b2b' }}>핵심 세팅 완료율</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: BRAND_ORANGE }}>{displayRate}%</span>
        </div>
        <div style={{ background: '#f7f6f2', borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: completionHint ? 10 : 0 }}>
          <div style={{
            width: `${barWidth}%`,
            transition: 'width 1000ms ease-out',
            height: '100%',
            background: BRAND_ORANGE,
            borderRadius: 99,
          }} />
        </div>
        {completionHint && (
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
            {completionHint}
          </p>
        )}
      </div>

      {/* onboarding 히어로 배너 */}
      {nextAction === null ? (
        <div style={{
          background: '#1f5d3a',
          borderRadius: 16,
          padding: '18px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 11, color: '#86efac', margin: '0 0 4px', fontWeight: 500 }}>
            핵심 세팅 완료!
          </p>
          <p style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', margin: '0 0 8px', lineHeight: 1.3 }}>
            이제 손익 분석을 시작할 수 있어요
          </p>
          {fixedCostFilled && dailyBreakeven > 0 && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: '0 0 14px', lineHeight: 1.4 }}>
              하루 최소 매출 약 {formatKRW(dailyBreakeven)} (월 {effectiveDays}일 영업 기준)
            </p>
          )}
          <Link href="/today" style={ctaLinkStyle}>
            오늘 운영 보기
          </Link>
        </div>
      ) : nextAction === 'restaurant' ? (
        <div style={{
          background: '#1f5d3a',
          borderRadius: 16,
          padding: '18px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 11, color: '#86efac', margin: '0 0 4px', fontWeight: 500 }}>
            다음 단계
          </p>
          <p style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', margin: '0 0 14px', lineHeight: 1.3 }}>
            매장 정보를 먼저 입력해주세요
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.4 }}>
              상호명, 연락처, 주소를 입력하면 다음 단계로 갈 수 있어요
            </p>
            <Link href="/settings/restaurant" style={ctaLinkStyle}>
              입력하기
            </Link>
          </div>
        </div>
      ) : nextAction === 'restaurant-hours' ? (
        <div style={{
          background: '#1f5d3a',
          borderRadius: 16,
          padding: '18px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 11, color: '#86efac', margin: '0 0 4px', fontWeight: 500 }}>
            월 영업일수를 입력하면
          </p>
          <p style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', margin: '0 0 14px', lineHeight: 1.3 }}>
            하루 고정비와 손익 계산이 가능해져요
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              월 영업일수 미입력
            </p>
            <Link href="/settings/restaurant" style={ctaLinkStyle}>
              입력하기
            </Link>
          </div>
        </div>
      ) : nextAction === 'fixed-costs' ? (
        <div style={{
          background: '#1f5d3a',
          borderRadius: 16,
          padding: '18px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 11, color: '#86efac', margin: '0 0 4px', fontWeight: 500 }}>
            고정비를 입력하면
          </p>
          <p style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', margin: '0 0 14px', lineHeight: 1.3 }}>
            하루 얼마나 팔아야 하는지 알 수 있어요
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              임대료·인건비 등 미입력
            </p>
            <Link href="/settings/fixed-costs" style={ctaLinkStyle}>
              입력하기
            </Link>
          </div>
        </div>
      ) : nextAction === 'menus' ? (
        <div style={{
          background: '#1f5d3a',
          borderRadius: 16,
          padding: '18px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 11, color: '#86efac', margin: '0 0 4px', fontWeight: 500 }}>
            메뉴를 등록하면
          </p>
          <p style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', margin: '0 0 14px', lineHeight: 1.3 }}>
            원가와 예상 마진을 바로 확인할 수 있어요
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              등록된 메뉴 없음
            </p>
            <Link href="/settings/menus" style={ctaLinkStyle}>
              입력하기
            </Link>
          </div>
        </div>
      ) : nextAction === 'seats' ? (
        <div style={{
          background: '#1f5d3a',
          borderRadius: 16,
          padding: '18px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 11, color: '#86efac', margin: '0 0 4px', fontWeight: 500 }}>
            좌석 구성을 입력해주세요
          </p>
          <p style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', margin: '0 0 8px', lineHeight: 1.3 }}>
            테이블 수에 맞춰 운영 분석이 정확해져요
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            아래 좌석 구성 카드에서 입력할 수 있어요
          </p>
        </div>
      ) : null}

      {canGoRfq ? (
        <div style={{ marginBottom: 16 }}>
          <Link href="/rfq/new" style={{
            display: 'block',
            padding: '15px',
            background: '#1f5d3a',
            color: '#fff',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            textDecoration: 'none',
            textAlign: 'center',
          }}>
            더 싸게 살 수 있는지 확인하기
          </Link>
        </div>
      ) : monthlyFixed > 0 ? (
        <div style={{
          marginBottom: 16,
          padding: '10px 14px',
          background: '#f7f6f2',
          borderRadius: 10,
          border: '0.5px solid #e8e5de',
          fontSize: 12,
          color: '#6b7280',
        }}>
          식자재를 3개 이상 입력하면 절약 가능 품목을 찾아드려요
        </div>
      ) : null}

      <p style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', margin: '0 0 10px', letterSpacing: '0.04em' }}>
        계정
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <SettingsRow
          label="계정"
          description="비밀번호 변경"
          icon="👤"
          href="/settings/account"
          status={null}
          statusNote="로그인 비밀번호 관리"
        />

        <SettingsRow
          label="알림 설정"
          description="푸시 알림 on/off"
          icon="🔔"
          href="/settings/notifications"
          status={null}
          statusNote="시세·발주 알림"
        />
      </div>

      <p style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', margin: '0 0 10px', letterSpacing: '0.04em' }}>
        매장 운영
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        <SettingsRow
          label="매장 정보"
          description="상호명, 주소, 대표자, 연락처, 사업자번호"
          icon="🏪"
          href="/settings/restaurant"
          status={restaurantFilled ? restaurant.name : null}
          statusNote={restaurantFilled ? restaurant.region ?? undefined : '상호명·위치 미입력'}
          variant={
            storeSetupFilled ? 'done' :
            nextAction === 'restaurant' || nextAction === 'restaurant-hours' ? 'priority' :
            'default'
          }
        />

        <SettingsRow
          label="고정비"
          description="임대료, 인건비 등 월 고정비"
          icon="💰"
          href="/settings/fixed-costs"
          status={fixedCostFilled ? `${formatKRW(monthlyFixed)} / 월` : null}
          statusNote={fixedCostFilled ? `${fixedCosts.length}개 항목` : '임대료·인건비 등 미입력'}
          variant={rowVariant(fixedCostFilled, nextAction, 'fixed-costs')}
        />

        <SettingsRow
          label="식자재"
          description="재료명, 단위, 단가 관리"
          icon="🥬"
          href="/settings/ingredients"
          status={ingredientCount > 0 ? `${ingredientCount}개` : null}
          statusNote={
            ingredientCount === 0 ? '아직 없음' :
            pricedCount < ingredientCount ? `${pricedCount}개 가격 입력됨` :
            '전부 가격 입력됨'
          }
          variant={ingredientFilled ? 'done' : 'default'}
        />

        <SettingsRow
          label="메뉴 / 원가"
          description="메뉴 등록, 재료 구성, 원가·마진 확인"
          icon="📋"
          href="/settings/menus"
          status={menuCount > 0 ? `${menuCount}개` : null}
          statusNote={menuCount > 0 ? '메뉴별 원가 관리' : '아직 없음'}
          variant={rowVariant(menuFilled, nextAction, 'menus')}
        />

        <div>
          <button
            type="button"
            onClick={() => setTableExpanded(e => !e)}
            style={{
              width: '100%',
              background: '#ffffff',
              border: nextAction === 'seats'
                ? `1.5px solid ${BRAND_ORANGE}`
                : '0.5px solid #e8e5de',
              borderRadius: tableExpanded ? '14px 14px 0 0' : 14,
              padding: '16px 18px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
              <span style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: totalSeats > 0 ? '#edf7f1' : '#f7f6f2',
                color: totalSeats > 0 ? '#1f5d3a' : '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
              }}>🪑</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#2b2b2b' }}>좌석 구성</span>
                  {totalSeats > 0 && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#1f5d3a',
                      background: '#edf7f1',
                      borderRadius: 10,
                      padding: '1px 6px',
                    }}>완료</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: totalSeats > 0 ? '#374151' : '#9ca3af' }}>
                  {totalSeats > 0
                    ? `총 ${totalSeats}석 (${seating.filter(r => r.count > 0).map(r => `${r.name} ${r.count}개`).join(', ')})`
                    : '좌석 구조 미입력'}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 20, color: '#c0bdb8', flexShrink: 0 }}>{tableExpanded ? '∧' : '›'}</span>
          </button>

          {tableExpanded && (
            <div style={{
              background: '#f7f6f2',
              border: '0.5px solid #e8e5de',
              borderTop: 'none',
              borderRadius: '0 0 14px 14px',
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {seating.map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      value={row.name}
                      onChange={e => updateSeatingName(i, e.target.value)}
                      placeholder="좌석 유형명"
                      style={{
                        flex: 2,
                        padding: '8px 10px',
                        border: '0.5px solid #e8e5de',
                        borderRadius: 8,
                        fontSize: 13,
                        fontFamily: 'inherit',
                        outline: 'none',
                        background: '#fff',
                      }}
                    />
                    <input
                      value={row.seats}
                      onChange={e => updateSeatingSeats(i, e.target.value)}
                      placeholder="인원"
                      inputMode="numeric"
                      style={{
                        width: 52,
                        padding: '8px 6px',
                        border: '0.5px solid #e8e5de',
                        borderRadius: 8,
                        fontSize: 13,
                        fontFamily: 'inherit',
                        textAlign: 'center',
                        outline: 'none',
                        background: '#fff',
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>인</span>
                    <input
                      value={row.count}
                      onChange={e => updateSeatingCount(i, e.target.value)}
                      placeholder="수량"
                      inputMode="numeric"
                      style={{
                        width: 52,
                        padding: '8px 6px',
                        border: '0.5px solid #e8e5de',
                        borderRadius: 8,
                        fontSize: 13,
                        fontFamily: 'inherit',
                        textAlign: 'center',
                        outline: 'none',
                        background: '#fff',
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>개</span>
                    <button
                      type="button"
                      onClick={() => removeSeatingRow(i)}
                      style={{
                        padding: '6px 8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9ca3af',
                        fontSize: 16,
                        lineHeight: 1,
                        fontFamily: 'inherit',
                      }}
                    >×</button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={addSeatingRow}
                  style={{
                    flex: 1,
                    padding: '9px',
                    background: '#fff',
                    border: '1px dashed #e8e5de',
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  + 좌석 유형 추가
                </button>
                {canUndo && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    style={{
                      padding: '9px 14px',
                      background: '#fff',
                      border: '0.5px solid #e8e5de',
                      borderRadius: 8,
                      fontSize: 13,
                      color: '#6b7280',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    되돌리기
                  </button>
                )}
              </div>

              {totalSeats > 0 && (
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1f5d3a',
                  background: '#edf7f1',
                  borderRadius: 8,
                  padding: '8px 12px',
                }}>
                  총 {totalSeats}석 · 자동 저장됨
                </div>
              )}
            </div>
          )}
        </div>

      </div>

    </main>
  )
}

function SettingsRow({ label, description, icon, href, status, statusNote, variant = 'default' }: {
  label: string
  description?: string
  icon: string
  href: string
  status: string | null
  statusNote?: string
  variant?: SettingsRowVariant
}) {
  const isDone = variant === 'done'
  const isPriority = variant === 'priority'

  const iconBg = isDone ? '#edf7f1' : isPriority ? '#fff8f3' : '#f7f6f2'
  const iconColor = isDone ? '#1f5d3a' : isPriority ? BRAND_ORANGE : '#6b7280'
  const border = isPriority ? `1px solid ${BRAND_ORANGE}` : '0.5px solid #e8e5de'
  const chevronColor = isPriority ? BRAND_ORANGE : isDone ? '#1f5d3a' : '#c0bdb8'

  const inner = (
    <div style={{
      background: '#ffffff',
      borderRadius: 14,
      border,
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxSizing: 'border-box',
    }}>
      <span style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: iconBg,
        color: iconColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        flexShrink: 0,
      }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: description ? 4 : 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#2b2b2b' }}>{label}</span>
          {isDone && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#1f5d3a',
              background: '#edf7f1',
              borderRadius: 10,
              padding: '1px 6px',
            }}>완료</span>
          )}
          {isPriority && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: BRAND_ORANGE,
              background: '#fff8f3',
              borderRadius: 10,
              padding: '1px 6px',
            }}>먼저 입력</span>
          )}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: status || statusNote ? 4 : 0, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
        <div style={{ fontSize: 12, color: isDone ? '#374151' : '#9ca3af' }}>
          {status ? (
            <>
              <span style={{ fontWeight: 600, color: '#2b2b2b' }}>{status}</span>
              {statusNote && <span style={{ color: '#9ca3af' }}> · {statusNote}</span>}
            </>
          ) : statusNote}
        </div>
      </div>
      <span style={{ fontSize: 20, color: chevronColor, flexShrink: 0 }}>›</span>
    </div>
  )

  return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
}
