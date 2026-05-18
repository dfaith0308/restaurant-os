import Link from 'next/link'
import type { OrderOperationInsights } from '@/lib/order-capture'

export default function OrderRiskSummary({ insights }: { insights: OrderOperationInsights }) {
  const manualHint = insights.off_platform_ratio_high
    ? '최근 흡수 주문 중 전화·직접 입력 비중이 높아요.'
    : '최근 흡수 주문은 플랫폼과 오프라인이 섞여 있어요.'

  return (
    <section
      style={{
        background: '#ffffff',
        border: '0.5px solid #ece8df',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>주문 운영 요약</h2>
        <Link
          href="/orders"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-primary)',
            textDecoration: 'none',
          }}
        >
          주문 기록
        </Link>
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 13,
          color: '#374151',
          lineHeight: 1.55,
        }}
      >
        <li>
          미확인 흡수 주문{' '}
          <strong style={{ color: '#1f5d3a' }}>{insights.unconfirmed_capture_count}</strong>건 (납품 대기)
        </li>
        <li>
          최근 7일 카카오 흡수{' '}
          <strong style={{ color: '#1f5d3a' }}>{insights.kakao_capture_last_7_days}</strong>건
        </li>
        <li style={{ color: '#6b7280' }}>{manualHint}</li>
      </ul>
    </section>
  )
}
