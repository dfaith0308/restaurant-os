'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { RfqRequest } from '@/types'
import { formatKRW } from '@/lib/utils'

interface Props {
  rfqs: RfqRequest[]
}

const STATUS_CFG = {
  draft:     { label: '임시',        color: '#6b7280', bg: '#F3F4F6' },
  open:      { label: '견적 확인 중', color: '#1D4ED8', bg: '#EFF6FF' },
  closed:    { label: '종료',        color: '#374151', bg: '#F9FAFB' },
  ordered:   { label: '납품 대기 🚚', color: '#6D28D9', bg: '#EDE9FE' },
  cancelled: { label: '취소',        color: '#9ca3af', bg: '#F3F4F6' },
}

const FILTER_TABS = [
  { key: 'all',     label: '전체'    },
  { key: 'open',    label: '진행중'  },
  { key: 'ordered', label: '납품 대기' },
  { key: 'closed',  label: '종료'    },
]

export default function RfqListClient({ rfqs }: Props) {
  const [tab, setTab] = useState<string>('all')

  const filtered    = tab === 'all' ? rfqs : rfqs.filter(r => r.status === tab)
  const openCount   = rfqs.filter(r => r.status === 'open').length
  const orderedCount = rfqs.filter(r => r.status === 'ordered').length

  return (
    <div>
      {/* 현황 배너 */}
      {openCount > 0 && (
        <div style={{
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: 12, padding: '12px 16px', marginBottom: 8,
          fontSize: 13, color: '#1D4ED8', fontWeight: 600,
        }}>
          📋 {openCount}건 견적 확인 중이에요. 결과를 확인해보세요.
        </div>
      )}
      {orderedCount > 0 && (
        <div style={{
          background: '#EDE9FE', border: '1px solid #C4B5FD',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          fontSize: 13, color: '#6D28D9', fontWeight: 600,
        }}>
          🚚 {orderedCount}건 납품 대기 중이에요. 받으셨으면 확인해주세요.
        </div>
      )}
      {openCount === 0 && orderedCount === 0 && (
        <div style={{ marginBottom: 16 }} />
      )}

      {/* 탭 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
        {FILTER_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none',
              background: tab === t.key ? '#111827' : '#fff',
              color:      tab === t.key ? '#fff' : '#6b7280',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: tab === t.key ? 'none' : '0 0 0 1px #e5e7eb',
            }}>
            {t.label}
            {t.key === 'open' && openCount > 0 && (
              <span style={{
                marginLeft: 5, background: '#EF4444', color: '#fff',
                borderRadius: 10, padding: '1px 6px', fontSize: 10,
              }}>
                {openCount}
              </span>
            )}
            {t.key === 'ordered' && orderedCount > 0 && (
              <span style={{
                marginLeft: 5, background: '#7C3AED', color: '#fff',
                borderRadius: 10, padding: '1px 6px', fontSize: 10,
              }}>
                {orderedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(rfq => <RfqCard key={rfq.id} rfq={rfq} />)}
        </div>
      )}
    </div>
  )
}

function RfqCard({ rfq }: { rfq: RfqRequest }) {
  const cfg = STATUS_CFG[rfq.status]
  const daysAgo = Math.floor((Date.now() - new Date(rfq.created_at).getTime()) / 86400000)

  return (
    <Link href={`/rfq/${rfq.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#fff', borderRadius: 14,
        border: '1px solid #e5e7eb', padding: '14px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
              {rfq.product_name}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              color: cfg.color, background: cfg.bg,
            }}>
              {cfg.label}
            </span>
          </div>

          <div style={{ fontSize: 13, color: '#6b7280' }}>
            {rfq.quantity}{rfq.unit}
            {rfq.current_price && ` · 현재 ${formatKRW(rfq.current_price)}`}
          </div>

          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            {daysAgo === 0 ? '오늘' : `${daysAgo}일 전`} 요청
            {rfq.deadline && ` · 마감 ${rfq.deadline.slice(0, 10)}`}
          </div>
        </div>

        <span style={{ fontSize: 18, color: '#9ca3af', marginLeft: 8 }}>›</span>
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 24px',
      background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
        아직 발주요청이 없어요
      </div>
      <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>
        가격이 비싸다 싶은 품목이 있으면<br />발주요청으로 더 좋은 조건을 받아보세요
      </div>
      <Link href="/rfq/new" style={{
        display: 'inline-block', padding: '12px 24px',
        background: '#111827', color: '#fff', borderRadius: 10,
        fontSize: 14, fontWeight: 600, textDecoration: 'none',
      }}>
        첫 발주요청 해보기
      </Link>
    </div>
  )
}
