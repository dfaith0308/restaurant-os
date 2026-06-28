/** 식당OS /buy — 'use server' 액션 파일과 분리한 타입 */

export type BuyListingRow = {
  id: string
  tenant_id: string
  product_id: string | null
  commerce_price: number
  /** 시중/정상가(원). NULL이면 절감 라인 미표시 */
  original_price: number | null
  status: string
  is_visible: boolean
  created_at: string
  thumbnail_url: string | null
  image_urls: string[] | null
  description: string | null
  product_name: string | null
  category_id: string | null
  /** false면 무료배송 뱃지 숨김. 미정이면 기본 무료(추후 listing별 정책) */
  shipping_free?: boolean | null
  base_shipping_fee?: number | null
  free_shipping_qty?: number | null
  bulk_qty?: number | null
  bulk_discount_rate?: number | null
  box_qty?: number | null
  brand_name?: string | null
  spec?: string | null
  origin?: string | null
  storage_method?: string | null
  min_order_qty?: number | null
  package_unit?: string | null
  usage_desc?: string | null
  allergen?: string | null
  ingredients?: string | null
  manufacturer?: string | null
  ai_strengths?: string | null
  ai_usage?: string | null
  ai_summary?: string | null
}

export type RecentOrderItemRow = {
  listing_id: string
  listing_title: string
  unit_price: number
  created_at: string
  thumbnail_url: string | null
  /** 현재 listing 판매가 (미판매·삭제 시 null) */
  current_price: number | null
  /** listing 정상가 — 없으면 절감 미표시 */
  original_price: number | null
  listing_buyable: boolean
  shipping_free?: boolean | null
}

export type CartRow = {
  id: string
  listing_id: string
  quantity: number
  commerce_price: number
  product_id: string | null
  product_name: string | null
  thumbnail_url: string | null
}

export type CommerceOrderListRow = {
  id: string
  order_number: string | null
  status: string
  total_amount: number
  created_at: string
}

export interface CreateCommerceOrderInput {
  /** 주문 제출 시도당 1회 발급 UUID; 재전송·연타 시 동일 주문으로 수령 */
  checkout_submission_id: string
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  delivery_memo?: string | null
    payment_method: 'card' | 'bank_transfer' | 'kakao_manual'
  discount_amount?: number
}
