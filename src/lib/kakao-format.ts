export type KakaoOrderSummaryLine = {
  title: string
  quantity: number
  unit_price: number
  line_total: number
}

export type KakaoOrderSummaryInput = {
  order_number: string | null
  payment_label: string
  total_amount: number
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  delivery_memo: string | null
  lines: KakaoOrderSummaryLine[]
}

/** DB 없이 주문 요약 문자열만 생성 (Server Action이 아님) */
export function buildKakaoOrderSummary(input: KakaoOrderSummaryInput): string {
  const no = input.order_number?.trim() || '(번호 생성 중)'
  const lines = input.lines
    .map((l) => `• ${l.title} × ${l.quantity} = ${l.line_total.toLocaleString()}원`)
    .join('\n')
  const memo = input.delivery_memo?.trim() ? `\n배송 메모: ${input.delivery_memo.trim()}` : ''
  return (
    `[식식이OS 구매 주문]\n` +
    `주문번호: ${no}\n` +
    `결제: ${input.payment_label}\n` +
    `합계: ${input.total_amount.toLocaleString()}원\n` +
    `수령인: ${input.shipping_name} / ${input.shipping_phone}\n` +
    `주소: ${input.shipping_address}${memo}\n\n` +
    `품목:\n${lines}\n\n` +
    `무통장 입금 확인 후 배송이 진행됩니다.`
  )
}
