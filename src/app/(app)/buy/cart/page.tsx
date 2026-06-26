import Link from 'next/link'
import { getCart, calcCartDiscount } from '@/actions/buy'
import { getSubscriptionStatus } from '@/actions/subscribe'
import BuyCartClient from '@/components/buy/BuyCartClient'

const shell = { maxWidth: 480, margin: '0 auto', padding: '20px 16px 96px' } as const

export default async function BuyCartPage() {
  const cartPromise = getCart()
  const subStatusPromise = getSubscriptionStatus()
  const res = await cartPromise
  const items = res.success ? res.data?.items ?? [] : []

  const [discountRes, subStatus] = await Promise.all([
    items.length >= 2
      ? calcCartDiscount(
          items.map((i) => ({
            listing_id: i.listing_id,
            quantity: i.quantity,
            commerce_price: i.commerce_price,
          })),
        )
      : Promise.resolve(null),
    subStatusPromise,
  ])

  const discountAmount =
    discountRes?.success ? (discountRes.data?.discount_amount ?? 0) : 0

  const n = items.length

  return (
    <main style={shell}>
      <Link href="/buy" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← 구매하기
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 16px' }}>
        장바구니 ({n}건)
      </h1>

      {!res.success ? (
        <p style={{ color: '#b91c1c', fontSize: 14 }}>{res.error}</p>
      ) : (
        <BuyCartClient
          items={items}
          discountAmount={discountAmount}
          isSubscriber={subStatus.is_active}
        />
      )}
    </main>
  )
}
