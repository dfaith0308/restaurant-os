import Link from 'next/link'
import { getTodayDashboard } from '@/actions/today'
import { getMoneyDashboard } from '@/actions/money'
import { getTodayOperationHubData } from '@/actions/menus'
import {
  buildOrderOperationInsights,
  buildRecentOrderActivities,
} from '@/lib/order-capture'
import { getOrdersOperationSlice } from '@/actions/orders'
import { formatKRW } from '@/lib/utils'
import type { Order, SavingOpportunity, TodayDashboard } from '@/types'
import { getTenantId } from '@/lib/get-restaurant'
import { TodayOperationInsights } from '@/components/today/TodayOperationInsights'
import { TodayRiskSection } from '@/components/today/TodayRiskSection'
import OrderRiskSummary from '@/components/orders/OrderRiskSummary'
import RecentOrderActivity from '@/components/orders/RecentOrderActivity'

export default async function TodayPage() {
  const tenant_id = await getTenantId()

  const [result, money, hubRes, orderSliceRes] = await Promise.all([
    getTodayDashboard(tenant_id).catch(() => ({
      success: false as const,
      data: undefined,
    })),
    getMoneyDashboard(tenant_id).catch(() => ({
      success: false as const,
      data: undefined,
    })),
    getTodayOperationHubData().catch(() => ({
      success: false as const,
      data: undefined,
    })),
    getOrdersOperationSlice(tenant_id).catch((): { success: true; data: Order[] } => ({
      success: true,
      data: [],
    })),
  ])

  const d = result.data
  const hub = hubRes.success && hubRes.data ? hubRes.data : null
  const orderSlice =
    orderSliceRes.success && orderSliceRes.data ? orderSliceRes.data : []
  const orderInsights = buildOrderOperationInsights(orderSlice)
  const orderRecent = buildRecentOrderActivities(orderSlice, 5)

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px' }}>오늘운영</h1>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 6px' }}>
        최근 공급가와 메뉴 원가 흐름 기준 운영 위험을 보여드려요.
      </p>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>
        오늘 해야 할 일을 3가지 이내로 정리해요
      </p>

      {hub ? (
        <>
          <TodayOperationInsights
            risk_menu_count={hub.risk_menu_count}
            spike_ingredient_count={hub.spike_ingredient_count}
            ocr_recent_count={hub.ocr_recent_count}
            avg_margin_rate={hub.avg_margin_rate}
          />
          <TodayRiskSection
            top_risk_menus={hub.top_risk_menus}
            top_spike_ingredients={hub.top_spike_ingredients}
            recent_ocr={hub.recent_ocr}
          />
        </>
      ) : null}

      <OrderRiskSummary insights={orderInsights} />
      <RecentOrderActivity items={orderRecent} compact heading="최근 주문 활동" />

      {!d ? (
        <div style={{ padding: 20, borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280' }}>
          데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
        </div>
      ) : (
        <TodayCards d={d} moneyTight={money.data?.is_tight ?? false} />
      )}

      <section
        style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <Link
          href="/buy"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--color-primary)',
            textDecoration: 'none',
          }}
        >
          구매하기 <span aria-hidden>→</span>
        </Link>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 0' }}>플랫폼에서 바로 살 수 있는 상품을 볼 수 있어요</p>
      </section>
    </main>
  )
}

function TodayCards({ d, moneyTight }: { d: TodayDashboard; moneyTight: boolean }) {
  const cards: Array<React.ReactNode> = []

  // 최대 3개 카드(초과 금지) — 우선순위: 돈흐름 > 절약기회 > 오늘할일

  // 1순위: 돈흐름 카드
  if (cards.length < 3 && (d.payment_due_3days > 0 || moneyTight)) {
    cards.push(
      <Card
        key="money"
        title="돈흐름"
        desc={`이번 주 나갈 돈: ${formatKRW(d.payment_due_3days)}`}
        ctaLabel="지금 정리하기"
        href="/money/upcoming"
        tone="danger"
      />,
    )
  }

  // 2순위: 절약기회 카드
  if (cards.length < 3) {
    const opp = pickSavingOpportunity(d.saving_opportunities)
    if (opp) {
      cards.push(
        <Card
          key="saving"
          title="절약기회"
          desc={`지금 ${opp.ingredient_name} 가격이 조금 높은 편이에요`}
          ctaLabel="같이 비교해보기"
          href="/rfq/new"
          tone="warning"
        />,
      )
    }
  }

  // 3순위: 오늘할일 카드
  if (cards.length < 3) {
    const hasTodo = d.open_rfqs > 0 || d.pending_deliveries.length > 0
    if (hasTodo) {
      const msg =
        d.open_rfqs > 0
          ? `미처리 발주요청 ${d.open_rfqs}건이 있어요`
          : `납품 확인이 필요한 주문 ${d.pending_deliveries.length}건이 있어요`
      cards.push(
        <Card
          key="todo"
          title="오늘할일"
          desc={msg}
          ctaLabel="하나씩 해결하기"
          href="/rfq"
          tone="neutral"
        />,
      )
    }
  }

  if (cards.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '44px 0', borderRadius: 14, border: '1px dashed #e5e7eb', background: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>
          오늘도 잘 운영하고 계세요 👍
        </div>
        <Link
          href="/rfq/new"
          style={{ display: 'inline-block', padding: '10px 14px', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 800 }}
        >
          발주요청 하러 가기
        </Link>
      </div>
    )
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{cards}</div>
}

function pickSavingOpportunity(opps: SavingOpportunity[]): SavingOpportunity | null {
  for (const o of opps ?? []) {
    const hist = o.personal_history ?? []
    const prices = hist.map((h) => h.price).filter((p) => typeof p === 'number' && p > 0)
    if (!prices.length) continue

    const min = Math.min(...prices)
    const last = hist[0]?.price
    const current = o.current_price

    // 조건 (PRODUCT §8-3 확정):
    // - 최근 구매가 대비 추천가 -5% 이상 (min price를 추천가로 근사)
    // - 또는 직전 구매 대비 +10% 이상 상승
    const cheaperBy5 = current > 0 && (current - min) / current >= 0.05
    const up10 = typeof last === 'number' && last > 0 && current >= last * 1.1
    if (cheaperBy5 || up10) return o
  }
  return null
}

function Card({
  title,
  desc,
  ctaLabel,
  href,
  tone,
}: {
  title: string
  desc: string
  ctaLabel: string
  href: string
  tone: 'danger' | 'warning' | 'neutral'
}) {
  const border = tone === 'danger' ? '#FCA5A5' : tone === 'warning' ? '#FCD34D' : '#e5e7eb'
  const bg = tone === 'danger' ? '#FFF1F2' : tone === 'warning' ? '#FFFBEB' : '#fff'
  const titleColor = tone === 'danger' ? '#B91C1C' : tone === 'warning' ? '#92400E' : 'var(--color-text)'
  return (
    <div style={{ border: `1px solid ${border}`, background: bg, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: titleColor, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.35, marginBottom: 10 }}>
        {desc}
      </div>
      <Link
        href={href}
        style={{ display: 'inline-block', padding: '9px 12px', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 800 }}
      >
        {ctaLabel}
      </Link>
    </div>
  )
}

