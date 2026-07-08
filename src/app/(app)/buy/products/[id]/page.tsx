import { notFound } from 'next/navigation'
import { getListing, getStoreCategories } from '@/actions/buy'
import BuyProductDetailClient from '@/components/buy/BuyProductDetailClient'
import ProductDetailTemplate from '@/components/buy/ProductDetailTemplate'

function resolveCategoryName(
  categoryId: string | null | undefined,
  categories: { id: string; name: string; children: { id: string; name: string }[] }[],
): string | null {
  if (!categoryId) return null
  for (const cat of categories) {
    if (cat.id === categoryId) return cat.name
    const child = cat.children.find((c) => c.id === categoryId)
    if (child) return child.name
  }
  return null
}

export default async function BuyProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [res, categoriesRes] = await Promise.all([getListing(id), getStoreCategories()])
  if (!res.success || !res.data?.listing) notFound()
  const p = res.data.listing

  const categories = categoriesRes.success ? categoriesRes.data?.categories ?? [] : []
  const categoryName = resolveCategoryName(p.category_id, categories)

  const productName = p.product_name ?? ''
  const price = p.commerce_price

  return (
    <BuyProductDetailClient
      listingId={p.id}
      productName={productName}
      price={price}
      thumbnailUrl={p.thumbnail_url ?? null}
      baseShippingFee={p.base_shipping_fee ?? 3500}
      freeShippingQty={p.free_shipping_qty ?? null}
      bulkQty={p.bulk_qty ?? null}
      bulkDiscountRate={p.bulk_discount_rate ?? null}
      origin={p.origin ?? null}
      allergen={p.allergen ?? null}
      ingredients={p.ingredients ?? null}
      categoryName={categoryName}
      detailTemplate={
        <div style={{ padding: '0 16px 8px' }}>
          <ProductDetailTemplate
            productName={productName}
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
