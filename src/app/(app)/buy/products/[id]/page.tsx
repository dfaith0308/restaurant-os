import { notFound } from 'next/navigation'
import { getListing } from '@/actions/buy'
import BuyProductDetailClient from '@/components/buy/BuyProductDetailClient'
import ProductDetailTemplate from '@/components/buy/ProductDetailTemplate'

export default async function BuyProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getListing(id)
  if (!res.success || !res.data?.listing) notFound()
  const p = res.data.listing

  const productName = p.product_name ?? ''
  const brandName = p.brand_name ?? ''
  const price = p.commerce_price

  return (
    <BuyProductDetailClient
      listingId={p.id}
      productName={productName}
      brandName={brandName}
      price={price}
      originalPrice={p.original_price ?? null}
      thumbnailUrl={p.thumbnail_url ?? null}
      imageUrls={p.image_urls ?? []}
      description={p.description ?? null}
      shippingFree={p.shipping_free ?? true}
      baseShippingFee={p.base_shipping_fee ?? 3500}
      freeShippingQty={p.free_shipping_qty ?? null}
      bulkQty={p.bulk_qty ?? null}
      bulkDiscountRate={p.bulk_discount_rate ?? null}
      boxQty={p.box_qty ?? 1}
      origin={p.origin ?? null}
      storageMethod={p.storage_method ?? null}
      minOrderQty={p.min_order_qty ?? 1}
      packageUnit={p.package_unit ?? null}
      usageDesc={p.usage_desc ?? null}
      allergen={p.allergen ?? null}
      ingredients={p.ingredients ?? null}
      manufacturer={p.manufacturer ?? null}
      detailTemplate={
        <div style={{ padding: '0 16px 8px' }}>
          <ProductDetailTemplate
            productName={productName}
            brandName={brandName}
            spec={p.spec ?? null}
            aiStrengths={p.ai_strengths ?? p.description ?? null}
            aiUsage={p.ai_usage ?? null}
            aiSummary={p.ai_summary ?? null}
            ingredients={p.ingredients ?? null}
            price={price}
          />
        </div>
      }
    />
  )
}
