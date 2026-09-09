import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCart, calcCartDiscount } from '@/actions/buy'
import { getStorefrontBankTransferForCheckout } from '@/actions/storefront-bank-transfer'
import BuyCheckoutClient from '@/components/buy/BuyCheckoutClient'
import type { StorefrontBankTransferSettings } from '@/lib/storefront-bank-transfer'

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

  // 표시용 금액. 주문 확정 시 createCommerceOrder 가 같은 규칙으로 다시 계산한다.
  let discountAmount = 0
  if (items.length > 0) {
    const discountRes = await calcCartDiscount()
    if (discountRes.success) discountAmount = discountRes.data?.discount_amount ?? 0
  }

  let bankTransfer: StorefrontBankTransferSettings | null = null
  const bankRes = await getStorefrontBankTransferForCheckout()
  if (bankRes.success && bankRes.data) {
    bankTransfer = bankRes.data
  }

  const tossEnabled = Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY)

  return (
    <main style={shell}>
      <Link href="/buy/cart" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← 장바구니
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 16px' }}>결제</h1>
      <BuyCheckoutClient
        items={items}
        bankTransfer={bankTransfer}
        discountAmount={discountAmount}
        tossEnabled={tossEnabled}
      />
    </main>
  )
}
