import Link from 'next/link'
import { getCart } from '@/actions/buy'
import BuyCartClient from '@/components/buy/BuyCartClient'

const shell = { maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' } as const

export default async function BuyCartPage() {
  const res = await getCart()
  const items = res.success ? res.data?.items ?? [] : []

  return (
    <main style={shell}>
      <Link href="/buy" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← 구매하기
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 16px' }}>장바구니</h1>

      {!res.success ? (
        <p style={{ color: '#b91c1c', fontSize: 14 }}>{res.error}</p>
      ) : (
        <BuyCartClient items={items} />
      )}
    </main>
  )
}
