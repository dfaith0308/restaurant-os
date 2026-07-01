import Link from 'next/link'
import { getTodayDashboard } from '@/actions/today'
import { getMoneyDashboard } from '@/actions/money'
import { getMenus } from '@/actions/menus'
import { getSubscriptionStatus } from '@/actions/subscribe'
import {
  buildTodayActionPriority,
  buildTodayMainOperationFeed,
  buildTodayOperationHubFromMenusAndIngredients,
  buildTodayOrderParseInsights,
  buildTodayRiskFlowChains,
  buildTodaySupplierOperationInsights,
} from '@/lib/order-capture'
import { getOrdersOperationSlice } from '@/actions/orders'
import { getIngredientsOperationData } from '@/actions/ingredients'
import { formatKRW } from '@/lib/utils'
import type { Order, SavingOpportunity, TodayDashboard } from '@/types'
import { getTenantId } from '@/lib/get-restaurant'
import { TodayOperationInsights } from '@/components/today/TodayOperationInsights'
import { TodayRiskSection } from '@/components/today/TodayRiskSection'
import OrderTodayParseInsights from '@/components/orders/OrderTodayParseInsights'
import TodaySupplierInsights from '@/components/today/TodaySupplierInsights'
import SupplierRiskSection from '@/components/today/SupplierRiskSection'
import TodayMainOperationFeed from '@/components/today/TodayMainOperationFeed'
import TodayActionPriorityCard from '@/components/today/TodayActionPriorityCard'
import KakaoInputRequest from '@/components/common/KakaoInputRequest'

export default async function TodayPage() {
  const tenant_id = await getTenantId()

  const [result, money, menusRes, orderSliceRes, ingOpRes, subStatus] = await Promise.all([
    getTodayDashboard(tenant_id).catch(() => ({
      success: false as const,
      data: undefined,
    })),
    getMoneyDashboard(tenant_id).catch(() => ({
      success: false as const,
      data: undefined,
    })),
    getMenus().catch(() => ({
      success: false as const,
      data: undefined,
    })),
    getOrdersOperationSlice(tenant_id).catch((): { success: true; data: Order[] } => ({
      success: true,
      data: [],
    })),
    getIngredientsOperationData().catch(() => ({
      success: false as const,
      data: undefined,
    })),
    getSubscriptionStatus(),
  ])

  const isSubscriber = subStatus.is_active

  const d = result.data
  const ingOp = ingOpRes.success && ingOpRes.data ? ingOpRes.data : null
  const menus = menusRes.success && menusRes.data ? menusRes.data : []
  const orderSlice =
    orderSliceRes.success && orderSliceRes.data ? orderSliceRes.data : []

  const ingOpEmpty =
    !ingOpRes.success ||
    !ingOpRes.data ||
    Object.keys(ingOpRes.data.metaByIngredient).length === 0
  const isNewUser = orderSlice.length === 0 && ingOpEmpty

  const subscribeBanner = !isSubscriber ? (
    <Link
      href="/subscribe"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: '#1f5d3a',
        borderRadius: 12,
        textDecoration: 'none',
        marginBottom: 12,
      }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>
          🎁 얼리버드 선착순 100명 · 월 9,900원
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
          지금 구독하고 장바구니 할인 혜택 받으세요
        </p>
      </div>
      <span style={{ fontSize: 14, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
        구독하기 →
      </span>
    </Link>
  ) : null

  if (isNewUser) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 96px', textAlign: 'center' }}>
        <div style={{ textAlign: 'left' }}>
          {subscribeBanner}
          <KakaoInputRequest />
        </div>
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 28, margin: '0 0 12px' }}>👋</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 8px' }}>
            환영합니다, 사장님
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
            식식이OS에서 식자재를 구매하면<br />
            원가와 수익이 자동으로 계산됩니다
          </p>
        </div>

        <Link
          href="/buy"
          style={{
            display: 'block',
            padding: '18px 20px',
            background: '#1f5d3a',
            borderRadius: 14,
            textDecoration: 'none',
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>🛒 식자재 구매하기</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: 0 }}>첫 구매 후 원가 분석이 시작됩니다</p>
        </Link>

        <Link
          href="/rfq"
          style={{
            display: 'block',
            padding: '16px 20px',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            textDecoration: 'none',
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>📋 발주 요청하기</p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>기존 거래처 발주를 앱으로 통합하세요</p>
        </Link>

        <div style={{ marginTop: 32, padding: '16px 20px', background: '#f0f7f3', borderRadius: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1f5d3a', margin: '0 0 10px' }}>식식이OS 혜택</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['2종류 이상 구매 시 장바구니 자동 할인', '무료배송 기준 수량 안내', '원가 자동 계산 · 메뉴 수익성 분석'].map((t) => (
              <p key={t} style={{ fontSize: 12, color: '#374151', margin: 0, textAlign: 'left' }}>
                ✓ {t}
              </p>
            ))}
          </div>
        </div>
      </main>
    )
  }

  const hub =
    menus.length > 0 || ingOp
      ? buildTodayOperationHubFromMenusAndIngredients(menus, ingOp)
      : null
  const parseInsights = buildTodayOrderParseInsights(orderSlice)
  const supplierInsights = buildTodaySupplierOperationInsights(
    orderSlice,
    ingOp?.ocrActivities30d ?? [],
    ingOp?.ocrSupplierByCanonical ?? {},
    ingOp?.ingredientSupplierByName ?? {},
    ingOp?.supplierPriceRisks ?? [],
  )
  const operationFeed = buildTodayMainOperationFeed({
    orders: orderSlice,
    ocrActivities30d: ingOp?.ocrActivities30d ?? [],
    topRiskMenus: menus
      .filter((m) => m.operation_risk_level !== 'normal')
      .slice(0, 8)
      .map((m) => ({
        id: m.id,
        name: m.name,
        operation_risk_level: m.operation_risk_level,
        updated_at: m.updated_at,
      })),
    topSpikeIngredients: ingOp?.top_spike_ingredients ?? [],
    registrationCandidates: parseInsights.registration_candidates,
    supplierPriceRisks: supplierInsights.price_risk_suppliers,
  })

  const judgmentInput = {
    topRiskMenus: hub?.top_risk_menus ?? [],
    topSpikeIngredients: hub?.top_spike_ingredients ?? [],
    repeatUnlinked: parseInsights.repeat_unlinked,
    supplierPriceRisks: supplierInsights.price_risk_suppliers,
    registrationCandidates: parseInsights.registration_candidates,
    menus: menus.map((m) => ({
      id: m.id,
      name: m.name,
      operation_risk_level: m.operation_risk_level,
      impacting_ingredients: m.impacting_ingredients,
    })),
    orders: orderSlice,
  }
  const actionPriority = buildTodayActionPriority(judgmentInput)
  const riskFlowChains = buildTodayRiskFlowChains(judgmentInput)

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px' }}>
        {'\uc624\ub298\uc6b4\uc601'}
      </h1>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 14px', lineHeight: 1.45 }}>
        {
          '\uc624\ub298 \uc2dd\ub2f9\uc5d0\uc11c \ubb34\uc2a8 \uc77c\uc774 \uc77c\uc5b4\ub098\uace0 \uc788\ub294\uc9c0, \ubb34\uc5c7\uc744 \uba3c\uc800 \ud655\uc778\ud560\uc9c0 \ubd10\uc694.'
        }
      </p>

      {subscribeBanner}

      <TodayActionPriorityCard priority={actionPriority} />

      {hub ? (
        <section style={{ marginBottom: 20 }}>
          <TodayOperationInsights
            risk_menu_count={hub.risk_menu_count}
            spike_ingredient_count={hub.spike_ingredient_count}
            ocr_recent_count={hub.ocr_recent_count}
            avg_margin_rate={hub.avg_margin_rate}
          />
        </section>
      ) : null}

      {hub ? (
        <TodayRiskSection
          top_risk_menus={hub.top_risk_menus}
          top_spike_ingredients={hub.top_spike_ingredients}
          recent_ocr={hub.recent_ocr}
          flowChains={riskFlowChains}
        />
      ) : null}

      <section style={{ marginBottom: 20, paddingTop: 4, borderTop: '1px solid #f3f4f6' }}>
        <TodaySupplierInsights insights={supplierInsights} />
        <OrderTodayParseInsights insights={parseInsights} />
        <SupplierRiskSection
          priceRisks={supplierInsights.price_risk_suppliers}
          activeSuppliers={supplierInsights.top_active_suppliers_7d}
          dependencies={supplierInsights.dependency_ingredients}
        />
      </section>

      <section style={{ marginBottom: 20, paddingTop: 4, borderTop: '1px solid #f3f4f6' }}>
        <TodayMainOperationFeed items={operationFeed} />
      </section>

      {!d ? (
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            background: '#fff',
            color: '#6b7280',
          }}
        >
          {'\ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc5b4\uc694. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.'}
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
          {'\uad6c\ub9e4\ud558\uae30'} <span aria-hidden>{'\u2192'}</span>
        </Link>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 0' }}>
          {'\ud50c\ub7ab\ud3fc\uc5d0\uc11c \ubc14\ub85c \uc0b4 \uc218 \uc788\ub294 \uc0c1\ud488\uc744 \ubcfc \uc218 \uc788\uc5b4\uc694'}
        </p>
      </section>
    </main>
  )
}

function TodayCards({ d, moneyTight }: { d: TodayDashboard; moneyTight: boolean }) {
  const cards: Array<React.ReactNode> = []

  if (cards.length < 3 && (d.payment_due_3days > 0 || moneyTight)) {
    cards.push(
      <Card
        key="money"
        title={'\ub3c8\ud750\ub984'}
        desc={`\uc774\ubc88 \uc8fc \ub098\uac08 \ub3c8: ${formatKRW(d.payment_due_3days)}`}
        ctaLabel={'\uc9c0\uae08 \uc815\ub9ac\ud558\uae30'}
        href="/money/upcoming"
        tone="danger"
      />,
    )
  }

  if (cards.length < 3) {
    const opp = pickSavingOpportunity(d.saving_opportunities)
    if (opp) {
      cards.push(
        <Card
          key="saving"
          title={'\uc808\uc57d\uae30\ud68c'}
          desc={`\uc9c0\uae08 ${opp.ingredient_name} \uac00\uaca9\uc774 \uc870\uae08 \ub192\uc740 \ud3b8\uc774\uc5d0\uc694`}
          ctaLabel={'\uac19\uc774 \ube44\uad50\ud574\ubcf4\uae30'}
          href="/rfq/new"
          tone="warning"
        />,
      )
    }
  }

  if (cards.length < 3) {
    const hasTodo = d.open_rfqs > 0 || d.pending_deliveries.length > 0
    if (hasTodo) {
      const msg =
        d.open_rfqs > 0
          ? `\ubbf8\ucc98\ub9ac \ubc1c\uc8fc\uc694\uccad ${d.open_rfqs}\uac74\uc774 \uc788\uc5b4\uc694`
          : `\ub0a9\ud488 \ud655\uc778\uc774 \ud544\uc694\ud55c \uc8fc\ubb38 ${d.pending_deliveries.length}\uac74\uc774 \uc788\uc5b4\uc694`
      cards.push(
        <Card
          key="todo"
          title={'\uc624\ub298\ud560\uc77c'}
          desc={msg}
          ctaLabel={'\ud558\ub098\uc529 \ud574\uacb0\ud558\uae30'}
          href="/rfq"
          tone="neutral"
        />,
      )
    }
  }

  if (cards.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '44px 0',
          borderRadius: 14,
          border: '1px dashed #e5e7eb',
          background: '#fff',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>
          {'\uc624\ub298\ub3c4 \uc798 \uc6b4\uc601\ud558\uace0 \uacc4\uc138\uc694'}
        </div>
        <Link
          href="/rfq/new"
          style={{
            display: 'inline-block',
            padding: '10px 14px',
            borderRadius: 10,
            background: 'var(--color-primary)',
            color: '#fff',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {'\ubc1c\uc8fc\uc694\uccad \ud558\ub7ec \uac00\uae30'}
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
  const titleColor =
    tone === 'danger' ? '#B91C1C' : tone === 'warning' ? '#92400E' : 'var(--color-text)'
  return (
    <div style={{ border: `1px solid ${border}`, background: bg, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: titleColor, marginBottom: 6 }}>{title}</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: 'var(--color-text)',
          lineHeight: 1.35,
          marginBottom: 10,
        }}
      >
        {desc}
      </div>
      <Link
        href={href}
        style={{
          display: 'inline-block',
          padding: '9px 12px',
          borderRadius: 10,
          background: 'var(--color-primary)',
          color: '#fff',
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        {ctaLabel}
      </Link>
    </div>
  )
}
