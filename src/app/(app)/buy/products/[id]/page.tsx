import { notFound } from 'next/navigation'
import { getListing, getStoreCategories, getWishlistListingIds } from '@/actions/buy'
import { getBuyListingDetailPage } from '@/actions/buy-detail-page'
import BuyProductDetailClient from '@/components/buy/BuyProductDetailClient'
import ProductDetailTemplate from '@/components/buy/ProductDetailTemplate'
import ProductDetailSections, { ProductDetailHeaderExtra } from '@/components/buy/ProductDetailSections'

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
  const [res, categoriesRes, wishedIds, detailPage] = await Promise.all([
    getListing(id),
    getStoreCategories(),
    getWishlistListingIds(),
    // 새 상세페이지 방식(템플릿). 연결 안 된 상품·마이그레이션 전이면 null → 기존 화면 그대로
    getBuyListingDetailPage(id).catch(() => null),
  ])
  if (!res.success || !res.data?.listing) notFound()
  const p = res.data.listing

  const categories = categoriesRes.success ? categoriesRes.data?.categories ?? [] : []
  const categoryName = resolveCategoryName(p.category_id, categories)

  const productName = p.product_name ?? ''
  const price = p.commerce_price

  return (
    <BuyProductDetailClient
      listingId={p.id}
      wished={wishedIds.includes(p.id)}
      productName={productName}
      price={price}
      thumbnailUrl={p.thumbnail_url ?? null}
      imageUrls={detailPage?.gallery ?? p.image_urls ?? null}
      soldOut={p.status === 'sold_out'}
      baseShippingFee={p.base_shipping_fee ?? 3500}
      freeShippingQty={p.free_shipping_qty ?? null}
      bulkQty={p.bulk_qty ?? null}
      bulkDiscountRate={p.bulk_discount_rate ?? null}
      origin={p.origin ?? null}
      allergen={p.allergen ?? null}
      ingredients={p.ingredients ?? null}
      categoryName={categoryName}
      headerExtra={detailPage ? <ProductDetailHeaderExtra view={detailPage} /> : undefined}
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
          {detailPage ? (
            <div style={{ marginTop: 8 }}>
              <ProductDetailSections view={detailPage} />
            </div>
          ) : null}
        </div>
      }
    />
  )
}
