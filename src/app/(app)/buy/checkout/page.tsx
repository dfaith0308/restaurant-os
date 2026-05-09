import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCart } from '@/actions/buy'
import BuyCheckoutClient from '@/components/buy/BuyCheckoutClient'

const shell = { maxWidth: 480, margin: '0 auto', padding: '20px 16px 96px' } as const

export default async function BuyCheckoutPage() {
  const res = await getCart()
  if (!res.success) {
    return (
      <main style={shell}>
        <p style={{ color: '#b91c1c' }}>{res.error}</p>
        <Link href="/buy/cart">장바구니로</Link>
      </main>
    )
  }

  const items = res.data?.items ?? []
  if (items.length === 0) {
    redirect('/buy/cart')
  }

  return (
    <main style={shell}>
      <Link href="/buy/cart" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← 장바구니
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 16px' }}>결제</h1>
      <BuyCheckoutClient items={items} />
    </main>
  )
}
