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
import { getIngredientsOperationData, probeTodayOnboardingSignals } from '@/actions/ingredients'
import { formatKRW } from '@/lib/utils'
import { KAKAO_CHANNEL_URL } from '@/lib/constants'
import { createServerClient } from '@/lib/supabase-server'
import type { Order, SavingOpportunity, TodayDashboard } from '@/types'
import { getTenantId } from '@/lib/get-restaurant'
import { TodayOperationInsights } from '@/components/today/TodayOperationInsights'
import { TodayRiskSection } from '@/components/today/TodayRiskSection'
import OrderTodayParseInsights from '@/components/orders/OrderTodayParseInsights'
import TodaySupplierInsights from '@/components/today/TodaySupplierInsights'
import SupplierRiskSection from '@/components/today/SupplierRiskSection'
import TodayMainOperationFeed from '@/components/today/TodayMainOperationFeed'
import TodayActionPriorityCard from '@/components/today/TodayActionPriorityCard'

const BRAND_GREEN = '#1f5d3a'
const PAGE_BG = '#f7f6f2'
const TEXT_CHARCOAL = '#2b2b2b'
const BORDER_LIGHT = '#e2e1dc'
const KAKAO_YELLOW = '#FEE500'

async function getTenantGreetingName(tenantId: string): Promise<string> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('tenants')
    .select('name, representative_name')
    .eq('id', tenantId)
    .maybeSingle()

  const storeName = data?.name?.trim()
  if (storeName) return storeName

  const repName = data?.representative_name?.trim()
  if (repName) return repName

  return ''
}

export default async function TodayPage() {
  const tenant_id = await getTenantId()

  const [orderProbeRes, onboardingProbe, subStatus] = await Promise.all([
    getOrdersOperationSlice(tenant_id, 1).catch((): { success: true; data: Order[] } => ({
      success: true,
      data: [],
    })),
    probeTodayOnboardingSignals().catch(() => ({
      activeIngredientsCount: 0,
      hasIngredientOperationMeta: false,
    })),
    getSubscriptionStatus(),
  ])

  const isSubscriber = subStatus.is_active
  const orderProbe =
    orderProbeRes.success && orderProbeRes.data ? orderProbeRes.data : []
  const ingOpEmpty = !onboardingProbe.hasIngredientOperationMeta
  const isNewUser = orderProbe.length === 0 && ingOpEmpty
  const greetingName = isNewUser ? await getTenantGreetingName(tenant_id) : ''

  const subscribeBanner = !isSubscriber ? (
    <Link
      href="/subscribe"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 16px',
        background: BRAND_GREEN,
        textDecoration: 'none',
      }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>
          얼리버드 선착순 100명 · 월 9,900원
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
          지금 구독하고 장바구니 할인 혜택 받으세요
        </p>
      </div>
      <span
        style={{
          flexShrink: 0,
          padding: '8px 12px',
          borderRadius: 8,
          background: '#fff',
          color: BRAND_GREEN,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        구독하기 →
      </span>
    </Link>
  ) : null

  if (isNewUser) {
    const welcomeTitle = greetingName
      ? `${greetingName} 대표님, 환영합니다.`
      : '사장님, 환영합니다.'

    return (
      <main
        style={{
          maxWidth: 480,
          margin: '0 auto',
          minHeight: 'calc(100vh - 64px)',
          background: PAGE_BG,
          padding: '0 0 96px',
        }}
      >
        {subscribeBanner ? (
          <div style={{ position: 'sticky', top: 0, zIndex: 10, background: PAGE_BG }}>
            {subscribeBanner}
          </div>
        ) : null}

        <div style={{ padding: '20px 16px 0' }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: BRAND_GREEN,
              margin: '0 0 8px',
              letterSpacing: '0.02em',
            }}
          >
            식식이OS
          </p>
          <h1
            style={{
              fontSize: 21,
              fontWeight: 700,
              color: TEXT_CHARCOAL,
              margin: '0 0 8px',
              lineHeight: 1.35,
            }}
          >
            {welcomeTitle}
          </h1>
          <p style={{ fontSize: 13, color: '#888888', margin: '0 0 20px', lineHeight: 1.5 }}>
            처음이시라면 아래 3가지부터 시작해보세요.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ReceiptPhotoCard />
            <NewUserActionRow
              href="/buy"
              icon="🛒"
              title="식자재 구매하기"
              description="구독자 전용가로 더 저렴하게"
            />
            <NewUserActionRow
              href="/rfq"
              icon="📋"
              title="발주 요청하기"
              description="원하는 식자재를 찾아드립니다"
            />
          </div>
        </div>
      </main>
    )
  }

  const [result, money, menusRes, orderSliceRes, ingOpRes] = await Promise.all([
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
  ])

  const d = result.data
  const ingOp = ingOpRes.success && ingOpRes.data ? ingOpRes.data : null
  const menus = menusRes.success && menusRes.data ? menusRes.data : []
  const orderSlice =
    orderSliceRes.success && orderSliceRes.data ? orderSliceRes.data : []

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

const RECEIPT_CHECKLIST = [
  '지금 가격이 적정한지',
  '더 합리적인 거래처가 있는지',
  '원가 구조가 맞는지',
] as const

function ReceiptPhotoCard() {
  return (
    <div
      style={{
        background: '#ffffff',
        border: `1.5px solid ${BRAND_GREEN}`,
        borderRadius: 14,
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: '#e4efe9',
            color: BRAND_GREEN,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
          aria-hidden
        >
          📄
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: TEXT_CHARCOAL, margin: '0 0 4px' }}>
            전표 사진 보내기
          </p>
          <p style={{ fontSize: 13, color: '#555555', margin: 0, lineHeight: 1.5 }}>
            지금 구매하시는 식자재, 전문가가 직접 점검해드립니다
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 0 }}>
        {RECEIPT_CHECKLIST.map((item) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: BRAND_GREEN, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>✓</span>
            <p style={{ fontSize: 13, color: '#444444', margin: 0 }}>{item}</p>
          </div>
        ))}
      </div>

      <a
        href={KAKAO_CHANNEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          marginTop: 16,
          padding: 13,
          background: KAKAO_YELLOW,
          color: '#191600',
          borderRadius: 10,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        카카오톡으로 보내기
      </a>

      <p style={{ fontSize: 11, color: '#aaaaaa', textAlign: 'center', margin: '10px 0 0' }}>
        🛡 확인 후 사진 즉시 삭제
      </p>
    </div>
  )
}

function NewUserActionRow({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        background: '#ffffff',
        border: `0.5px solid ${BORDER_LIGHT}`,
        borderRadius: 12,
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: '#f5f5f3',
          color: '#888888',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
        }}
        aria-hidden
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: TEXT_CHARCOAL, margin: '0 0 2px' }}>{title}</p>
        <p style={{ fontSize: 12, color: '#888888', margin: 0 }}>{description}</p>
      </div>
      <span style={{ fontSize: 16, color: '#cccccc', flexShrink: 0 }} aria-hidden>
        →
      </span>
    </Link>
  )
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
