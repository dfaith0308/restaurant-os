import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentKey?: string; orderId?: string; amount?: string }>
}) {
  const { paymentKey, orderId, amount } = await searchParams

  if (!paymentKey || !orderId || !amount) redirect('/buy')

  const cookie = (await headers()).get('cookie') ?? ''

  const res = await fetch(`${appBaseUrl()}/api/toss/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    cache: 'no-store',
  })

  const data = await res.json()

  if (!res.ok) {
    redirect(`/buy/checkout/fail?message=${encodeURIComponent(data.error ?? '결제 실패')}`)
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '40px 20px',
        textAlign: 'center',
        minHeight: '100vh',
        background: '#f7f6f2',
      }}
    >
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 24px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: '0 0 8px' }}>결제 완료!</h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>주문이 접수됐습니다</p>
        <a
          href="/orders"
          style={{
            display: 'block',
            padding: '14px',
            background: '#1f5d3a',
            borderRadius: 12,
            color: '#fff',
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          주문 내역 보기
        </a>
        <a
          href="/buy"
          style={{
            display: 'block',
            padding: '14px',
            background: '#f7f6f2',
            borderRadius: 12,
            color: '#374151',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          쇼핑 계속하기
        </a>
      </div>
    </main>
  )
}
