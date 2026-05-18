'use client'

import { useMemo, useState, useTransition } from 'react'
import { upsertFixedCost, deleteFixedCost } from '@/actions/settings'
import { formatKRW, toKoreanAmount } from '@/lib/utils'
import Link from 'next/link'

const BRAND_GREEN = '#1f5d3a'
const BRAND_ORANGE = '#F97316'

const PRESETS = [
  '임대료',
  '인건비',
  '전기요금',
  '가스요금',
  '수도요금',
  '통신비',
  '카드단말기',
  '보험료',
] as const

const PRESET_MATCH_KEYS: Record<string, string[]> = {
  임대료: ['임대료', '월세', '전세', '원세'],
  인건비: ['인건비', '급여', '인력'],
  전기요금: ['전기'],
  가스요금: ['가스'],
  수도요금: ['수도'],
  통신비: ['통신', '인터넷'],
  카드단말기: ['카드', '단말기', 'VAN'],
  보험료: ['보험'],
}

interface Cost {
  id: string
  name: string
  amount: number
  cycle: string
}

interface Props {
  costs: Cost[]
  restaurantId: string
  workingDaysPerMonth: number
  averageMenuPrice: number | null
}

function matchesPreset(costName: string, preset: string): boolean {
  const name = costName.trim()
  if (name === preset) return true
  const keys = PRESET_MATCH_KEYS[preset] ?? [preset]
  return keys.some((key) => name.includes(key))
}

function isPresetRegistered(preset: string, list: Cost[]): boolean {
  return list.some((cost) => matchesPreset(cost.name, preset))
}

function getCostIconStyle(name: string): { bg: string; color: string; glyph: string } {
  const n = name.trim()
  if (n.includes('인건비') || n.includes('급여') || n.includes('인력')) {
    return { bg: '#edf7f1', color: BRAND_GREEN, glyph: '👥' }
  }
  if (
    n.includes('임대') ||
    n.includes('월세') ||
    n.includes('전세') ||
    n.includes('원세')
  ) {
    return { bg: '#edf7f1', color: BRAND_GREEN, glyph: '🏠' }
  }
  if (n.includes('전기')) {
    return { bg: '#fff8f3', color: BRAND_ORANGE, glyph: '⚡' }
  }
  if (n.includes('가스')) {
    return { bg: '#fff8f3', color: BRAND_ORANGE, glyph: '🔥' }
  }
  return { bg: '#f7f6f2', color: '#6b7280', glyph: '📋' }
}

function formatMonthlyLabel(amount: number): string {
  if (!amount || amount <= 0) return '월 미입력'
  return `월 ${formatKRW(amount)}`
}

function computeDailyFixed(monthlyTotal: number, workingDays: number): number {
  const days = workingDays > 0 ? workingDays : 25
  if (monthlyTotal <= 0 || days <= 0) return 0
  return Math.ceil(monthlyTotal / days)
}

function computeBreakEvenGoal(
  dailyFixed: number,
  averageMenuPrice: number | null,
): string {
  if (dailyFixed <= 0) return '미설정'
  if (!averageMenuPrice || averageMenuPrice <= 0) return '미설정'
  const tablesPerDay = Math.max(1, Math.ceil(dailyFixed / averageMenuPrice))
  return `${tablesPerDay}테이블/일`
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: '0.5px solid #e8e5de',
  borderRadius: 10,
  fontSize: 14,
  background: '#f7f6f2',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  color: '#2b2b2b',
}

export default function FixedCostsClient({
  costs: init,
  restaurantId,
  workingDaysPerMonth,
  averageMenuPrice,
}: Props) {
  const [list, setList] = useState(init)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTr] = useTransition()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  const total = useMemo(
    () => list.reduce((sum, cost) => sum + (cost.amount > 0 ? cost.amount : 0), 0),
    [list],
  )
  const effectiveDays = workingDaysPerMonth > 0 ? workingDaysPerMonth : 25
  const dailyFixed = useMemo(
    () => computeDailyFixed(total, effectiveDays),
    [total, effectiveDays],
  )
  const breakEvenGoal = useMemo(
    () => computeBreakEvenGoal(dailyFixed, averageMenuPrice),
    [dailyFixed, averageMenuPrice],
  )

  function openFormWithPreset(presetName: string) {
    setName(presetName)
    setAmount('')
    setShowForm(true)
  }

  function handleAdd(presetName?: string) {
    const n = presetName ?? name.trim()
    const a = parseInt(amount.replace(/,/g, ''), 10)
    if (!n || !a) return
    startTr(async () => {
      const res = await upsertFixedCost({
        tenant_id: restaurantId,
        name: n,
        amount: a,
      })
      if (res.success) {
        setList((prev) => [
          ...prev,
          { id: Date.now().toString(), name: n, amount: a, cycle: 'monthly' },
        ])
        setName('')
        setAmount('')
        setShowForm(false)
      }
    })
  }

  function handleDelete(id: string) {
    startTr(async () => {
      await deleteFixedCost(id)
      setList((prev) => prev.filter((cost) => cost.id !== id))
    })
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '20px 16px 80px',
        background: '#f7f6f2',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <Link
          href="/settings"
          style={{
            fontSize: 13,
            color: BRAND_GREEN,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          ← 설정
        </Link>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '8px 14px',
            background: BRAND_ORANGE,
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + 추가
        </button>
      </div>

      <p
        style={{
          fontSize: 11,
          color: BRAND_GREEN,
          fontWeight: 500,
          letterSpacing: '0.5px',
          margin: '0 0 6px',
        }}
      >
        고정비
      </p>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 500,
          color: '#2b2b2b',
          letterSpacing: '-0.5px',
          margin: '0 0 8px',
          lineHeight: 1.3,
          whiteSpace: 'pre-line',
        }}
      >
        매달 나가는 돈을{'\n'}입력해주세요
      </h1>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px', lineHeight: 1.5 }}>
        입력하면 하루 손익분기점을 계산할 수 있어요
      </p>

      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          border: '0.5px solid #e8e5de',
          padding: '16px 18px',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 12, color: '#9ca3af' }}>월 고정비 합계</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            {list.length}가지 항목
          </span>
        </div>
        <p
          style={{
            fontSize: 26,
            fontWeight: 500,
            color: BRAND_GREEN,
            margin: '0 0 12px',
          }}
        >
          {formatKRW(total)}
        </p>
        <div
          style={{
            borderTop: '0.5px solid #f0ede8',
            paddingTop: 12,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          <div
            style={{
              background: '#f7f6f2',
              borderRadius: 10,
              padding: '10px 12px',
            }}
          >
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px' }}>
              하루 고정비
            </p>
            <p
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: '#2b2b2b',
                margin: 0,
              }}
            >
              {dailyFixed > 0 ? formatKRW(dailyFixed) : '-'}
            </p>
          </div>
          <div
            style={{
              background: '#fff8f3',
              border: '0.5px solid #fde8d4',
              borderRadius: 10,
              padding: '10px 12px',
            }}
          >
            <p style={{ fontSize: 11, color: BRAND_ORANGE, margin: '0 0 4px' }}>
              손익분기 목표
            </p>
            <p
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: BRAND_ORANGE,
                margin: 0,
              }}
            >
              {breakEvenGoal}
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p
          style={{
            fontSize: 12,
            color: '#9ca3af',
            fontWeight: 500,
            margin: '0 0 8px',
          }}
        >
          자주 있는 고정비를 선택해보세요
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESETS.map((preset) => {
            const selected = isPresetRegistered(preset, list)
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  if (!selected) openFormWithPreset(preset)
                }}
                style={{
                  padding: '6px 14px',
                  background: selected ? '#edf7f1' : '#ffffff',
                  border: selected
                    ? '0.5px solid #1f5d3a'
                    : '0.5px solid #e8e5de',
                  borderRadius: 20,
                  fontSize: 13,
                  color: selected ? BRAND_GREEN : '#2b2b2b',
                  cursor: selected ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: selected ? 500 : 400,
                }}
              >
                {preset}
              </button>
            )
          })}
        </div>
      </div>

      {showForm && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            border: '0.5px solid #e8e5de',
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: '#2b2b2b',
                marginBottom: 6,
              }}
            >
              항목명
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 임대료"
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: '#2b2b2b',
                marginBottom: 6,
              }}
            >
              금액 (월)
            </div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="예: 1500000"
              inputMode="numeric"
              style={INPUT_STYLE}
            />
            {amount && (
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, marginBottom: 0 }}>
                {toKoreanAmount(amount)}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => handleAdd()}
              disabled={isPending || !name.trim() || !amount}
              style={{
                flex: 2,
                padding: '11px',
                background: BRAND_ORANGE,
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: isPending || !name.trim() || !amount ? 0.65 : 1,
              }}
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                flex: 1,
                padding: '11px',
                background: '#ffffff',
                border: '0.5px solid #e8e5de',
                borderRadius: 10,
                fontSize: 13,
                cursor: 'pointer',
                color: '#6b7280',
                fontFamily: 'inherit',
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {list.length === 0 && !showForm ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            border: '0.5px solid #e8e5de',
            padding: '32px 20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <p
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: '#2b2b2b',
              margin: '0 0 6px',
            }}
          >
            고정비를 입력하면 손익 분석이 시작돼요
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
            위의 항목을 선택하거나 + 추가 버튼을 눌러주세요
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((cost) => {
            const icon = getCostIconStyle(cost.name)
            return (
              <div
                key={cost.id}
                style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  border: '0.5px solid #e8e5de',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: icon.bg,
                    color: icon.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  {icon.glyph}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#2b2b2b',
                      margin: '0 0 2px',
                    }}
                  >
                    {cost.name}
                  </p>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
                    {formatMonthlyLabel(cost.amount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(cost.id)}
                  disabled={isPending}
                  style={{
                    padding: '5px 10px',
                    background: 'transparent',
                    border: '0.5px solid #fde8d4',
                    borderRadius: 8,
                    fontSize: 12,
                    color: BRAND_ORANGE,
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  삭제
                </button>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
