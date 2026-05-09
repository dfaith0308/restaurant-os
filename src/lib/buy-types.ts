/** 식당OS /buy — 'use server' 액션 파일과 분리한 타입 */

export type BuyListingRow = {
  id: string
  tenant_id: string
  product_id: string | null
  commerce_price: number
  status: string
  is_visible: boolean
  created_at: string
  product_name: string | null
  category_id: string | null
}

export type RecentOrderItemRow = {
  listing_id: string
  listing_title: string
  unit_price: number
  created_at: string
}

export type CartRow = {
  id: string
  listing_id: string
  quantity: number
  commerce_price: number
  product_name: string | null
}

export type CommerceOrderListRow = {
  id: string
  order_number: string | null
  status: string
  total_amount: number
  created_at: string
}

export interface CreateCommerceOrderInput {
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  delivery_memo?: string | null
  payment_method: 'card' | 'bank_transfer' | 'kakao_manual'
}
