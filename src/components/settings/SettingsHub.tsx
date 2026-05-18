'use client'

import { useState, useTransition, useRef } from 'react'
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

const WORKING_DAYS_DEFAULT = 25

export default function SettingsHub({ restaurant, fixedCosts, ingredients, menus: initMenus }: Props) {
  // ── 영업일수 (사용자 제어) ────────────────────────────────
  const [workingDays, setWorkingDays] = useState(WORKING_DAYS_DEFAULT)

  // ── 손익 계산 ─────────────────────────────────────────────
  const monthlyFixed   = fixedCosts.reduce((s, c) => s + c.amount, 0)
  const effectiveDays  = workingDays > 0 ? workingDays : WORKING_DAYS_DEFAULT
  const dailyBreakeven = monthlyFixed > 0 ? Math.ceil(monthlyFixed / effectiveDays) : 0

  // ── 완료 상태 ─────────────────────────────────────────────
  const fixedCostFilled  = fixedCosts.length > 0
  const ingredientCount  = ingredients.length
  const pricedCount      = ingredients.filter(i => i.current_price != null).length
  const restaurantFilled = !!restaurant.name && !!restaurant.region

  // ── 행동 연결 조건 ─────────────────────────────────────────
  const canGoRfq = fixedCostFilled && ingredientCount >= 3

  // ── 좌석 구성 (자유형) ───────────────────────────────────────
  const DEFAULT_SEATING: SeatingType[] = [
    { name: '2인 테이블', seats: 2, count: 0 },
    { name: '4인 테이블', seats: 4, count: 0 },
  ]

  const initialSeating: SeatingType[] = DEFAULT_SEATING.map((r) => {
    if (r.seats === 2) return { ...r, count: restaurant.table_2p ?? 0 }
    if (r.seats === 4) return { ...r, count: restaurant.table_4p ?? 0 }
    return r
  })
  const [seating, setSeating]             = useState<SeatingType[]>(
    initialSeating
  )
  const [tableExpanded, setTableExpanded] = useState(false)
  const [canUndo, setCanUndo]             = useState(false)
  const saveTimerRef                      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevSeatingRef                    = useRef<SeatingType[]>(seating)

  // 총 좌석 수 — 유효한 값만 계산
  const totalSeats = seating.reduce((s, r) => {
    const seats = Number.isFinite(r.seats) && r.seats >= 1 ? r.seats : 0
    const count = Number.isFinite(r.count) && r.count >= 0 ? r.count : 0
    return s + seats * count
  }, 0)

  function saveSeating(next: SeatingType[]) {
    prevSeatingRef.current = seating  // 현재 상태를 이전으로 보관
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

  const menuCount = initMenus.length

  // ── 완료도 ────────────────────────────────────────────────
  const doneCores  = [restaurantFilled, fixedCostFilled, ingredientCount > 0].filter(Boolean).length
  const pct        = Math.round(doneCores / 3 * 100)

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px', background: '#ffffff' }}>

      {/* 헤더 */}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px' }}>
        설정
      </h1>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>
        입력할수록 제안이 정확해져요
      </p>

      {/* ── 손익 요약 카드 ── */}
      <div style={{
        background: monthlyFixed > 0 ? 'var(--color-primary)' : '#F9FAFB',
        borderRadius: 16, padding: '20px',
        marginBottom: 12,
        border: monthlyFixed > 0 ? 'none' : '1px dashed #D1D5DB',
      }}>
        {monthlyFixed > 0 ? (
          <>
            <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, marginBottom: 6 }}>
              고정비 기준 최소 매출
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', marginBottom: 4 }}>
              하루 {formatKRW(dailyBreakeven)}
            </div>
            <div style={{ fontSize: 14, color: '#6EE7B7', fontWeight: 600, marginBottom: 14 }}>
              팔면 남아요
            </div>

            {/* 영업일수 인라인 입력 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>월</span>
                <input
                  type="number"
                  min={1} max={31}
                  value={workingDays}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10)
                    if (isNaN(v) || v < 1) setWorkingDays(WORKING_DAYS_DEFAULT)
                    else if (v > 31) setWorkingDays(31)
                    else setWorkingDays(v)
                  }}
                  onBlur={e => {
                    const v = parseInt(e.target.value, 10)
                    if (isNaN(v) || v < 1) setWorkingDays(WORKING_DAYS_DEFAULT)
                  }}
                  style={{
                    width: 44, padding: '4px 6px',
                    background: '#1F2937', color: '#fff',
                    border: '1px solid #374151', borderRadius: 6,
                    fontSize: 14, fontWeight: 700, textAlign: 'center',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <span style={{ fontSize: 12, color: '#6B7280' }}>일 영업 기준입니다</span>
              </div>
            </div>

            <div style={{
              paddingTop: 14, borderTop: '1px solid #374151',
              fontSize: 12, color: '#9CA3AF', lineHeight: 1.8,
            }}>
              이보다 적게 팔면 적자입니다<br />
              <span style={{ color: '#6B7280' }}>→ 구조를 바꾸면 이 기준을 낮출 수 있습니다</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
              고정비를 입력하면
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#9CA3AF', marginBottom: 4 }}>
              하루 얼마나 팔면 되는지
            </div>
            <div style={{ fontSize: 14, color: '#6B7280' }}>
              바로 알 수 있어요
            </div>
          </>
        )}
      </div>

      {/* ── 행동 연결 버튼 ── */}
      {canGoRfq ? (
        <div style={{ marginBottom: 20 }}>
          <Link href="/rfq/new" style={{
            display: 'block', padding: '15px',
            background: '#059669', color: '#fff',
            borderRadius: 12, fontSize: 15, fontWeight: 700,
            textDecoration: 'none', textAlign: 'center',
          }}>
            더 싸게 살 수 있는지 확인하기
          </Link>
        </div>
      ) : monthlyFixed > 0 ? (
        <div style={{
          marginBottom: 20, padding: '10px 14px',
          background: '#F9FAFB', borderRadius: 10,
          fontSize: 12, color: '#6b7280',
        }}>
          식자재를 3개 이상 입력하면 절약 가능 품목을 찾아드려요
        </div>
      ) : null}

      {/* ── 설정 항목 목록 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* 1. 매장 정보 */}
        <SettingsRow
          label="매장 정보"
          description="상호명, 주소, 대표자, 연락처, 사업자번호"
          icon="🏪"
          href="/settings/restaurant"
          status={restaurantFilled ? restaurant.name : null}
          statusNote={restaurantFilled ? restaurant.region ?? undefined : '상호명·위치 미입력'}
          done={restaurantFilled}
        />

        <SettingsRow
          label="고정비"
          description="임대료, 인건비 등 월 고정비"
          icon="💰"
          href="/settings/fixed-costs"
          status={fixedCostFilled ? `${formatKRW(monthlyFixed)} / 월` : null}
          statusNote={fixedCostFilled ? `${fixedCosts.length}개 항목` : '임대료·인건비 등 미입력'}
          done={fixedCostFilled}
          highlight={!fixedCostFilled}
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
          done={ingredientCount > 0}
          highlight={fixedCostFilled && ingredientCount < 3}
        />

        <SettingsRow
          label="메뉴 / 원가"
          description="메뉴 등록, 재료 구성, 원가·마진 확인"
          icon="📋"
          href="/settings/menus"
          status={menuCount > 0 ? `${menuCount}개` : null}
          statusNote={menuCount > 0 ? '메뉴별 원가 관리' : '아직 없음'}
          done={menuCount > 0}
        />

        {/* 4. 좌석 구성 — 자유형 */}
        <div>
          <button
            onClick={() => setTableExpanded(e => !e)}
            style={{
              width: '100%', background: '#fff', border: '1px solid #E5E7EB',
              borderRadius: tableExpanded ? '14px 14px 0 0' : 14,
              padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>🪑</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>좌석 구성</span>
                  {totalSeats > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#059669',
                      background: '#ECFDF5', borderRadius: 10, padding: '1px 6px',
                    }}>완료</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: totalSeats > 0 ? '#374151' : '#9CA3AF' }}>
                  {totalSeats > 0
                    ? `총 ${totalSeats}석 (${seating.filter(r => r.count > 0).map(r => `${r.name} ${r.count}개`).join(', ')})`
                    : '좌석 구조 미입력'}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 18, color: '#9CA3AF' }}>
              {tableExpanded ? '∧' : '›'}
            </span>
          </button>

          {tableExpanded && (
            <div style={{
              background: '#F9FAFB', border: '1px solid #E5E7EB', borderTop: 'none',
              borderRadius: '0 0 14px 14px', padding: '14px 16px',
            }}>
              {/* 좌석 유형 리스트 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {seating.map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      value={row.name}
                      onChange={e => updateSeatingName(i, e.target.value)}
                      placeholder="좌석 유형명"
                      style={{
                        flex: 2, padding: '8px 10px',
                        border: '1px solid #E5E7EB', borderRadius: 8,
                        fontSize: 13, fontFamily: 'inherit', outline: 'none',
                      }}
                    />
                    <input
                      value={row.seats}
                      onChange={e => updateSeatingSeats(i, e.target.value)}
                      placeholder="인원"
                      inputMode="numeric"
                      style={{
                        width: 52, padding: '8px 6px',
                        border: '1px solid #E5E7EB', borderRadius: 8,
                        fontSize: 13, fontFamily: 'inherit', textAlign: 'center', outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>인</span>
                    <input
                      value={row.count}
                      onChange={e => updateSeatingCount(i, e.target.value)}
                      placeholder="수량"
                      inputMode="numeric"
                      style={{
                        width: 52, padding: '8px 6px',
                        border: '1px solid #E5E7EB', borderRadius: 8,
                        fontSize: 13, fontFamily: 'inherit', textAlign: 'center', outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>개</span>
                    <button
                      onClick={() => removeSeatingRow(i)}
                      style={{
                        padding: '6px 8px', background: 'transparent',
                        border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16,
                        lineHeight: 1, fontFamily: 'inherit',
                      }}
                    >×</button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button
                  onClick={addSeatingRow}
                  style={{
                    flex: 1, padding: '9px',
                    background: '#fff', border: '1px dashed #D1D5DB',
                    borderRadius: 8, fontSize: 13, color: '#6B7280',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  + 좌석 유형 추가
                </button>
                {canUndo && (
                  <button
                    onClick={handleUndo}
                    style={{
                      padding: '9px 14px',
                      background: '#fff', border: '1px solid #E5E7EB',
                      borderRadius: 8, fontSize: 13, color: '#6B7280',
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    되돌리기
                  </button>
                )}
              </div>

              {totalSeats > 0 && (
                <div style={{
                  fontSize: 13, fontWeight: 600, color: '#059669',
                  background: '#ECFDF5', borderRadius: 8, padding: '8px 12px',
                }}>
                  총 {totalSeats}석 · 자동 저장됨
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── 세팅 완료도 ── */}
      <div style={{ marginTop: 24, padding: '14px 16px', background: '#F9FAFB', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>핵심 세팅 완료</span>
          <span style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: 700 }}>{pct}%</span>
        </div>
        <div style={{ background: '#E5E7EB', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: pct === 100 ? '#059669' : 'var(--color-primary)',
            borderRadius: 4, transition: 'width 0.3s ease',
          }} />
        </div>
        {pct < 100 && (
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
            {!fixedCostFilled ? '고정비를 먼저 입력하면 손익 분석이 시작돼요' :
             !restaurantFilled ? '매장 정보를 입력해주세요' :
             '식자재를 입력하면 원가 분석이 가능해요'}
          </div>
        )}
      </div>

    </main>
  )
}

// ── 테이블 수 입력 ─────────────────────────────────────────────

// ── 설정 항목 행 ──────────────────────────────────────────────

function SettingsRow({ label, description, icon, href, status, statusNote, done, highlight }: {
  label: string
  description?: string
  icon: string
  href: string
  status: string | null
  statusNote?: string
  done: boolean
  highlight?: boolean
}) {
  const inner = (
    <div style={{
      background: '#ffffff',
      borderRadius: 14,
      border: highlight ? '1.5px solid #1f5d3a' : '0.5px solid #e8e5de',
      padding: '16px 18px',
      minHeight: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: description ? 4 : 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#2b2b2b' }}>{label}</span>
            {done && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#1f5d3a',
                background: '#edf7f1', borderRadius: 10, padding: '1px 6px',
              }}>완료</span>
            )}
            {highlight && !done && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#B45309',
                background: '#FFFBEB', borderRadius: 10, padding: '1px 6px',
              }}>먼저 입력</span>
            )}
          </div>
          {description && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: status || statusNote ? 4 : 0, lineHeight: 1.4 }}>
              {description}
            </div>
          )}
          <div style={{ fontSize: 12, color: done ? '#374151' : '#9CA3AF' }}>
            {status ? (
              <>
                <span style={{ fontWeight: 600, color: '#2b2b2b' }}>{status}</span>
                {statusNote && <span style={{ color: '#9CA3AF' }}> · {statusNote}</span>}
              </>
            ) : statusNote}
          </div>
        </div>
      </div>
      <span style={{ fontSize: 20, color: '#1f5d3a', marginLeft: 8, flexShrink: 0 }}>›</span>
    </div>
  )

  return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
}
