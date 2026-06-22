import { notFound } from 'next/navigation'
import { getListing } from '@/actions/buy'
import BuyProductDetailClient from '@/components/buy/BuyProductDetailClient'

export default async function BuyProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getListing(id)
  if (!res.success || !res.data?.listing) notFound()
  const p = res.data.listing

  return (
    <BuyProductDetailClient
      listingId={p.id}
      productName={p.product_name ?? ''}
      brandName={p.brand_name ?? ''}
      price={p.commerce_price}
      originalPrice={p.original_price ?? null}
      thumbnailUrl={p.thumbnail_url ?? null}
      imageUrls={p.image_urls ?? []}
      description={p.description ?? null}
      shippingFree={p.shipping_free ?? true}
      baseShippingFee={p.base_shipping_fee ?? 3500}
      freeShippingQty={p.free_shipping_qty ?? null}
      bulkQty={p.bulk_qty ?? null}
      bulkDiscountRate={p.bulk_discount_rate ?? null}
      origin={p.origin ?? null}
      storageMethod={p.storage_method ?? null}
      minOrderQty={p.min_order_qty ?? 1}
      packageUnit={p.package_unit ?? null}
      usageDesc={p.usage_desc ?? null}
      allergen={p.allergen ?? null}
      ingredients={p.ingredients ?? null}
      manufacturer={p.manufacturer ?? null}
    />
  )
}
